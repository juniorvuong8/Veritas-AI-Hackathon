# LLM Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A rerunnable evaluation in `eval/` that compares a dictionary-and-template baseline with the app's LLM on 24 fixed cases. The developer rates every dialogue blind, and the results fill the submission sentence.

**Architecture:** Pure, testable modules live in `eval/lib/`: case checks, baseline generation, the resumable runner, rating order, scoring. Thin Node scripts live in `eval/scripts/` and do the file input/output. The rating page is a separate Vite entry, `eval.html`, using React. The LLM side calls the production `generateLesson` + `createClaudeAiCaller` unchanged.

**Tech Stack:** Existing: TypeScript, Vitest, React, Vite. Scripts run with `node` (Node 24 runs TypeScript directly). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-14-llm-evaluation-design.md`

## Global Constraints

- **24 cases = 4 places × 3 levels × 2 word sets.** Set A: 3 suggested words. Set B: 4 words (3 suggested + 1 Vietnamese). Both sets are reused at levels 1–3.
- **Headline:** the % of 24 cases with Q1 = Có **and** Q2 = Có. A failed LLM case counts as a fail.
- **Rating questions** (verbatim): Q1 "Mỗi từ tiếng Anh có được dùng đúng nghĩa và đúng tình huống không?", Q2 "Phần tiếng Việt có tự nhiên, như người thật nói không?", note "Lỗi (nếu có)".
- **Dialogue id:** `"baseline:<caseId>"` / `"llm:<caseId>"`. Never displayed.
- **The key** is read only from `supabase/.env` (`ANTHROPIC_API_KEY`). It is never printed, logged or committed.
- **The LLM uses production settings** (model, effort, speed, prompt, checks, one retry) via `createClaudeAiCaller` and `generateLesson`.
- **The full paid run happens only after the one-case smoke test succeeds.** The user gave the go-ahead ("run it").
- Outputs, ratings and RESULTS.md are committed.

## Review Focus

1. **A rerun after an interrupted LLM run** must not pay again for finished cases, and must not keep a half-written results file. Test in Task 3.
2. **A Vietnamese input word** must reach the baseline as its English word (via `vi_to_en`), and the rating page must show the learner's original input. Tests in Tasks 2 and 4.
3. **The rating page reloaded mid-way** must keep the same order and the answers given so far. Test in Task 4.
4. **Formatting can't reveal the method:** the rendered dialogue screen has no method name, no title and no badge, and both methods render through the same component. Test in Task 4.
5. **Missing or extra entries in ratings.json** (an unrated dialogue, a typo'd id) must make scoring stop with a clear message, not produce a wrong %. Test in Task 5.

---

### Task 1: Test cases

**Files:** Create `eval/lib/types.ts`, `eval/cases.json`. Test `eval/lib/cases.test.ts`. Modify `vite.config.ts` (add `eval/**/*.test.ts` to `test.include`).

**Interfaces — Produces (`types.ts`):**
```ts
export type EvalCase = LessonRequest & { id: string; set: 'A' | 'B' }
export type Method = 'baseline' | 'llm'
export type RunResult = { ok: true; lesson: Lesson } | { ok: false; code: string }
export type ResultsFile = Record<string, RunResult>        // keyed by case id
export type Rating = { q1: boolean; q2: boolean; note: string }
export type RatingsFile = Record<string, Rating>           // keyed by dialogue id
export const dialogueId = (m: Method, caseId: string) => `${m}:${caseId}`
```
Case ids: `<scenarioId>-<set>-L<level>`, e.g. `cafe-A-L1`.

- [ ] **Step 1: Failing tests:**
  - there are 24 cases with unique ids;
  - each `scenarioId` × `set` appears at levels 1, 2 and 3 with identical words;
  - every case passes `checkLessonRequest`;
  - set A has 3 words, all from `getScenario(id).suggestedWords`;
  - set B has 4 words: 3 suggested plus exactly 1 not in the list that contains a Vietnamese diacritic.
- [ ] **Step 2:** `npx vitest run eval/lib/cases.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Write `types.ts` and `cases.json`.
- [ ] **Step 4:** Re-run. Expected: PASS. **Commit** `eval: test cases`.

---

### Task 2: Baseline

**Files:** Create `eval/baseline/dictionary.json`, `eval/baseline/templates.json`, `eval/lib/baseline.ts`. Test `eval/lib/baseline.test.ts`.

**Interfaces — Produces:** `buildBaselineLesson(c: EvalCase, dict: Dictionary, templates: Templates): Lesson`, with:
```ts
type Dictionary = { words: Record<string, { meaning_vi: string; usage_vi: string }>; vi_to_en: Record<string, string> }
type TemplateLine = { speaker: 'host' | 'guest'; text: string; translation_vi?: string }  // text has a {w} slot for word lines
type PlaceTemplates = { roles: { host: string; guest: string }; levels: Record<'1'|'2'|'3', {
  opening: TemplateLine[]; closing: TemplateLine[]; words: Record<string, TemplateLine>; fallback: TemplateLine }> }
type Templates = Record<string, PlaceTemplates>
```
Rules, per the spec:
- Vietnamese input → `vi_to_en`.
- The dialogue is the opening, then each word's own line (or the fallback) in case order, then the closing.
- `vocab[i].input` is the original word, and `word` is the English.
- Quiz: one question per word, from a fixed Vietnamese template using `usage_vi`, with the other case words as distractors. Each set has 4 words, so 3 options are always available.
- The answer position is rotated as `i % 3`.
- `translation_vi` is filled from the template line at level 3, and null otherwise.

- [ ] **Step 1: Failing tests:**
  - every one of the 24 cases → `checkLesson(lesson, case).ok === true`;
  - every suggested word in all 4 places has a dictionary entry and a word line at each level;
  - `vi_to_en` covers every set-B Vietnamese word;
  - **(Review Focus 2)** for `cafe-B-L1`, the vocab entry for "hóa đơn" has `input: 'hóa đơn', word: 'receipt'`, and some line contains "receipt";
  - the same case gives an identical lesson twice (deterministic).
- [ ] **Step 2:** `npx vitest run eval/lib/baseline.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Write the dictionary, the templates (natural Vietnamese, written in good faith; level 3 lines in English, each with its own translation) and `baseline.ts`.
- [ ] **Step 4:** Re-run. Expected: PASS. **Commit** `eval: dictionary-and-template baseline`.

---

### Task 3: Runners

**Files:** Create `eval/lib/runner.ts`, `eval/lib/env.ts`, `eval/scripts/run-baseline.ts`, `eval/scripts/run-llm.ts`. Test `eval/lib/runner.test.ts`. Add npm scripts `eval:baseline`, `eval:llm`, `eval:score`.

**Interfaces — Produces:**
- `readEnvKey(text: string, name: string): string | undefined` (parses `KEY=value` lines, ignoring comments and quotes).
- `runCases(cases: EvalCase[], existing: ResultsFile, generate: (c: EvalCase) => Promise<RunResult>, save: (r: ResultsFile) => void): Promise<ResultsFile>`. It skips cases already in `existing` with `ok: true`, retries cases recorded as failures, and calls `save` after each case.
- `run-llm.ts`:
  - wraps `generateLesson(case, createClaudeAiCaller(key, { client }))`, where `client` is a real `Anthropic` instance whose `messages.create` is wrapped to add up `usage`;
  - writes atomically (temp file + rename) to `eval/results/llm.json`;
  - `--only <caseId>` runs one case (the smoke test);
  - prints totals: cases ok/failed, input/output tokens, estimated cost at $8/$40 per million tokens (fast) or $4/$20 (standard), using `usage.speed` when present.

- [ ] **Step 1: Failing tests:**
  - `readEnvKey` handles `A=1`, `# comment`, `B="two"`, and a missing key;
  - **(Review Focus 1)** `runCases` with 2 of 3 cases already ok calls `generate` once; a case recorded as `{ok:false}` is retried; `save` is called after each case with the cumulative results;
  - a generate that throws is recorded as `{ ok: false, code: 'exception' }`, and the run continues.
- [ ] **Step 2:** `npx vitest run eval/lib/runner.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. `run-baseline.ts` writes `eval/results/baseline.json` from Task 2.
- [ ] **Step 4:** Re-run. Then `npm run eval:baseline`. Expected: 24 lessons written. **Commit** `eval: baseline and LLM runners`.

---

### Task 4: Rating page

**Files:** Create `eval.html`, `eval/ui/main.tsx`, `eval/ui/RatingApp.tsx`, `eval/lib/order.ts`. Tests `eval/lib/order.test.ts`, `eval/ui/RatingApp.test.tsx`. Modify `vite.config.ts` (`build.rollupOptions.input` = `index.html` + `eval.html`; test include `eval/**/*.test.tsx`) and `tsconfig.app.json` (include `eval/ui`, `eval/lib`).

**Interfaces — Produces:**
- `buildOrder(cases: EvalCase[], results: Record<Method, ResultsFile>, seed: number): string[]`: dialogue ids for every successful dialogue, shuffled with a seeded generator (mulberry32 + Fisher–Yates). `seed = 20261114`.
- `RatingApp(props: { cases: EvalCase[]; results: Record<Method, ResultsFile>; storage?: Storage })`:
  - one screen per id;
  - shows place name, level and target words (as the learner typed them), plus the lines through one shared `DialogueView` (bubbles; translations at level 3);
  - Q1/Q2 as Có/Không buttons, and the note field;
  - "Trước" / "Tiếp", progress "x / N";
  - saves to `localStorage` key `eval-ratings-v1` on every answer;
  - "Lưu kết quả" downloads `ratings.json`;
  - opens at the first unrated screen.
- `eval/ui/main.tsx` imports the two results files and `cases.json` directly (Vite JSON import).

- [ ] **Step 1: Failing tests:**
  - `buildOrder` gives the same order for the same seed; it excludes `ok:false` dialogues; it contains every successful dialogue once;
  - **(Review Focus 4)** a rendered baseline screen and a rendered LLM screen contain neither "baseline", "llm", "Bài mẫu" nor the lesson's `title_vi`;
  - **(Review Focus 2)** a set-B screen shows "hóa đơn" among the target words;
  - answering Q1/Q2 and clicking "Tiếp" shows "2 / N";
  - **(Review Focus 3)** after re-rendering with the same storage, the earlier answers are restored and it opens at the first unrated screen.
- [ ] **Step 2:** `npx vitest run eval/lib/order.test.ts eval/ui`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run. Then `npm test && npm run build`. Expected: green, exit 0. **Commit** `eval: blind rating page`.

---

### Task 5: Scoring

**Files:** Create `eval/lib/score.ts`, `eval/scripts/score.ts`. Test `eval/lib/score.test.ts`.

**Interfaces — Produces:**
- `score(cases, results, ratings): Report`, which **throws** listing the ids of unrated successful dialogues, or of rating ids that match no dialogue.
- `Report` holds, per method:
  - `headline` (% of 24, rounded to whole numbers), `q1Rate`, `q2Rate`;
  - `structurePass` (% of the method's lessons passing `checkLesson`);
  - `failedRuns`;
  - `byLevel` and `byPlace` headline %s;
  - `notes`: `{ caseId, note }[]` for LLM dialogues that failed Q1 or Q2.
- `renderResults(r: Report): string`: Markdown with the filled-in sentence ("On the same 24 test cases, the baseline achieved X% and the LLM achieved Y%. The LLM still failed when …"), the tables, the limits paragraph from the spec, the notes, and the rerun commands. The "failed when" phrase is left as `___ (see notes below)` for the developer to write from the notes.

- [ ] **Step 1: Failing tests** with small fixtures:
  - the headline counts only cases with both Có;
  - a failed LLM run counts as a fail and is not required in ratings;
  - **(Review Focus 5)** a missing rating throws naming the id; an extra unknown id throws;
  - `byLevel` splits correctly;
  - `renderResults` contains "On the same 24 test cases".
- [ ] **Step 2:** `npx vitest run eval/lib/score.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. The script reads `eval/ratings.json` and writes `eval/RESULTS.md`.
- [ ] **Step 4:** Re-run. Then `npm test`. Expected: green. **Commit** `eval: scoring and results report`.

---

### Task 6: Run it

- [ ] **Step 1: Smoke test:** `npm run eval:llm -- --only cafe-A-L1`. Expected: 1 ok, with a cost printed (around $0.10). If it fails with an auth error, stop and tell the user (the key is wrong).
- [ ] **Step 2: Full run:** `npm run eval:llm`. Expected: 24 cases processed and a cost total printed. Failures are allowed and are recorded.
- [ ] **Step 3:** Add a README "Evaluation" section (the sentence placeholder, a link to `eval/RESULTS.md`, how to rate, the commands). **Commit** the outputs and README: `eval: generate baseline and LLM dialogues`.
- [ ] **Step 4 (user):** run `npm run dev`, open `/eval.html`, rate everything, click "Lưu kết quả", and move `ratings.json` into `eval/`.
- [ ] **Step 5:** `npm run eval:score`, then write the "failed when" phrase from the notes and commit `RESULTS.md` and `ratings.json`.
