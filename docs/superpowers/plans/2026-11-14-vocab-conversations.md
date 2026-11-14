# Vocab Conversations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Vietnamese-UI web app where a learner picks a situation, 3–5 words and a level, reads an AI-written mixed-language conversation using those words, then takes a quiz.

**Architecture:** Lovable-compatible React SPA plus one Supabase Edge Function (`generate-lesson`). All logic that must be trusted (input checks, prompt building, AI-output parsing and checks, retry, error mapping) lives as pure, import-free TypeScript in `supabase/functions/_shared/`, so the Deno function and the Vitest suite run the exact same code. The function's `index.ts` is a thin `Deno.serve` wrapper. The frontend is a 3-screen state machine with a bundled fallback lesson.

**Tech Stack:** Vite + React 18 + TypeScript + Tailwind + shadcn/ui; Vitest + @testing-library/react; Supabase Edge Functions (Deno); Lovable AI gateway (OpenAI-compatible Chat Completions).

**Spec:** `docs/superpowers/specs/2026-11-14-vocab-conversations-design.md`

## Global Constraints

- **All UI text is Vietnamese.** Fixed copy: "Tạo hội thoại", "Làm bài kiểm tra", "Thử lại", "Hội thoại mới", "Đang tạo hội thoại…".
- **No secrets in the repo.** `LOVABLE_API_KEY` is read only inside the Edge Function via `Deno.env.get`. Frontend env uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- **AI gateway:** `POST https://ai.gateway.lovable.dev/v1/chat/completions`, headers `Authorization: Bearer <key>` and `Lovable-API-Key: <key>`, model `google/gemini-3.7-flash`, `response_format: { "type": "json_object" }`. A 429 means the workspace is over its per-minute limit, a 402 means out of credits. *(Source: TanStack Lovable adapter docs, 2026-11. If the gateway rejects `response_format`, drop it; `parseJsonObject` still copes.)*
- **Words per lesson:** 3–5, no duplicates (case-insensitive, after NFC normalization and trimming); each 1–30 chars of Unicode letters, spaces, hyphens or apostrophes.
- **Conversation:** 4–8 lines. **Quiz:** one question per word, 3 options each.
- **Retry:** at most one retry when AI output fails checks. **Frontend timeout:** 30 s.
- **Files in `supabase/functions/_shared/` import nothing outside that folder,** and import each other with explicit `.ts` extensions (Deno rule). tsconfig needs `allowImportingTsExtensions: true` (with `noEmit`).
- Stack must stay Lovable-importable: Vite, React, TS, Tailwind, shadcn/ui, `@/` → `src/` alias.

## Review Focus

1. **AI wraps JSON in ```json fences or adds a sentence before it.** Expect the lesson to still parse. Test in Task 4 (`parseJsonObject`).
2. **A target word sits inside another word or next to punctuation** ("go" in "good", "menu?" at a line end). Expect only whole-word matches to count as "used" or get highlighted. Tests in Task 3 (`containsWord`) and Task 7 (`splitHighlights`).
3. **Vietnamese typed on macOS arrives decomposed (NFD)**, e.g. "hóa đơn" as base letters plus combining marks. Expect it to be accepted, matched against `vocab.input`, and de-duplicated like NFC text. Tests in Task 2 and Task 3.
4. **The gateway is out of credits or rate-limited while a judge is trying the app.** Expect a Vietnamese message plus the sample-lesson offer, not a generic crash. Tests in Task 5 (status mapping) and Task 9 (error screen).
5. **A custom word that duplicates a suggested chip** ("Menu " vs chip "menu"). Expect no second copy; the chip shows as selected. Test in Task 6 (`addWord`).

---

### Task 1: Project scaffold

**Files:**
- Create: Vite React-TS project at repo root (`package.json`, `index.html`, `vite.config.ts`, `tsconfig*.json`, `src/main.tsx`, `src/App.tsx`, `src/index.css`), Tailwind config, shadcn/ui init (`components.json`, `src/components/ui/button.tsx`, `src/lib/utils.ts`)
- Create: `vitest.config.ts` (or `test` block in `vite.config.ts`): environment `jsdom`, include `src/**/*.test.{ts,tsx}` and `supabase/functions/_shared/**/*.test.ts`, setup file `src/test/setup.ts` importing `@testing-library/jest-dom/vitest`
- Create: `.env.example` with `VITE_SUPABASE_URL=` and `VITE_SUPABASE_PUBLISHABLE_KEY=`; add `.env`, `.env.local`, `node_modules`, `dist` to `.gitignore`
- Create: `src/App.test.tsx`

**Interfaces:**
- Produces: `npm run dev`, `npm run build`, `npm test` (= `vitest run`); `@/` alias; shadcn `Button`.

- [ ] **Step 1:** Scaffold with `npm create vite@latest . -- --template react-ts` (keep README.md/docs), add Tailwind and run `npx shadcn@latest init`, then `npx shadcn@latest add button card badge input progress`. Install `vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event`. Set `<html lang="vi">` and use a font with full Vietnamese coverage (e.g. Be Vietnam Pro from Google Fonts).
- [ ] **Step 2: Write the smoke test** `src/App.test.tsx`: render `<App />` and expect `screen.getByText("Tạo hội thoại")` to be in the document. (`App` can be a placeholder that renders a button with that text for now.)
- [ ] **Step 3:** Run `npm test`. Expected: 1 passed. Run `npm run build`. Expected: exit 0.
- [ ] **Step 4: Commit** `chore: scaffold Vite React app with Tailwind, shadcn and Vitest`

---

### Task 2: Shared types, scenarios and input checks

**Files:**
- Create: `supabase/functions/_shared/types.ts`
- Create: `supabase/functions/_shared/scenarios.ts`
- Create: `supabase/functions/_shared/validate-request.ts`
- Test: `supabase/functions/_shared/validate-request.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  export type Level = 1 | 2 | 3;
  export interface LessonRequest { scenarioId: string; words: string[]; level: Level }
  export interface LessonLine { speaker_vi: string; text: string; translation_vi: string | null }
  export interface VocabItem { input: string; word: string; meaning_vi: string; usage_vi: string }
  export interface QuizQuestion { question_vi: string; options: string[]; answer_index: number; explanation_vi: string }
  export interface Lesson { title_vi: string; level: Level; lines: LessonLine[]; vocab: VocabItem[]; quiz: QuizQuestion[] }
  export type CheckResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };
  export type ErrorCode = "bad_request" | "rate_limited" | "out_of_credits" | "ai_failed";
  export interface ErrorBody { code: ErrorCode; message_vi: string }
  ```
- Produces (`scenarios.ts`): `interface Scenario { id: string; emoji: string; name_vi: string; promptContext: string; suggestedWords: string[] }`, `SCENARIOS: Scenario[]`, `getScenario(id: string): Scenario | undefined`, `normalizeWord(w: string): string` (NFC, trim, collapse inner whitespace).
- Produces (`validate-request.ts`): `checkLessonRequest(body: unknown): CheckResult<LessonRequest>`. On success `words` are normalized (`normalizeWord`), with the learner's casing kept.

For now `SCENARIOS` holds only `cafe` (☕ "Quán cà phê", promptContext "ordering drinks at a Vietnamese-style café in an English-speaking setting", ~12 suggested words: menu, to go, receipt, medium, large, refill, straw, iced, takeaway cup, napkin, order, change). The other three come in Task 10.

- [ ] **Step 1: Write failing tests** in `validate-request.test.ts`:
  - `accepts a valid request`: `{scenarioId:"cafe", words:["menu","to go","receipt"], level:1}` → `ok: true`.
  - `rejects unknown scenario` (`"moon"`), `rejects level 0 and 4`, `rejects 2 words and 6 words`.
  - `rejects duplicates ignoring case and spaces`: `["menu","Menu ","receipt"]` → `ok:false`.
  - `rejects a word over 30 chars`, `rejects digits or symbols` (`"menu1"`, `"<b>"`), `rejects non-object body` (`null`, `"x"`).
  - `accepts Vietnamese with diacritics`: `["hóa đơn","menu","to go"]` → ok.
  - **(Review Focus 3)** `accepts NFD input and normalizes to NFC`: `"hóa đơn".normalize("NFD")` in words → ok, and `value.words[0] === "hóa đơn".normalize("NFC")`; and NFD+NFC copies of the same word are rejected as duplicates.
- [ ] **Step 2:** Run `npx vitest run supabase/functions/_shared/validate-request.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement `types.ts`, `scenarios.ts` and `checkLessonRequest`. Word rule regex: `/^[\p{L}\p{M}' -]{1,30}$/u` applied after normalization.
- [ ] **Step 4:** Run the same command. Expected: all pass.
- [ ] **Step 5: Commit** `feat: shared lesson types, café scenario and request checks`

---

### Task 3: Lesson output checks

**Files:**
- Create: `supabase/functions/_shared/validate-lesson.ts`, `supabase/functions/_shared/test-fixtures.ts`
- Test: `supabase/functions/_shared/validate-lesson.test.ts`

**Interfaces:**
- Consumes: types from Task 2, `normalizeWord`.
- Produces: `containsWord(text: string, word: string): boolean` (case-insensitive, whole-word: no letter immediately before or after, using `\p{L}`). `checkLesson(data: unknown, req: LessonRequest): CheckResult<Lesson>`.

Rules `checkLesson` enforces, all from the spec: object shape and field types; `level === req.level`; 4–8 lines; `vocab.length === req.words.length` and `normalizeWord(vocab[i].input).toLowerCase() === normalizeWord(req.words[i]).toLowerCase()` for each i; every `vocab[i].word` passes `containsWord` on at least one `lines[].text`; `quiz.length === req.words.length`; each question has exactly 3 options and `answer_index` an integer 0–2; the set of correct options (`options[answer_index]`, compared case-insensitively) covers every `vocab.word`; at level 3 every line has a non-empty `translation_vi`.

- [ ] **Step 1: Write failing tests.** Build a `validLesson()` fixture (level 1, café, words `["menu","to go","receipt"]`, 4 lines using all three, 3 quiz questions whose answers are the three words). Tests:
  - `accepts a valid lesson`.
  - One failing test each for: missing `title_vi`; 3 lines; 9 lines; a word missing from all lines; `vocab` in the wrong order; `vocab.length` 2; quiz length 2; a question with 4 options; `answer_index` 3; `answer_index` 1.5; correct answers not covering "receipt"; level mismatch; level-3 lesson with a `null` translation.
  - `vocab.input in Vietnamese maps to an English word`: request words `["hóa đơn","menu","to go"]`, vocab[0] = `{input:"hóa đơn", word:"receipt", …}`, lines contain "receipt" → ok.
  - **(Review Focus 2)** `containsWord`: `("Is it good?", "go")` → false; `("Can I see the menu?", "menu")` → true; `("TO GO please", "to go")` → true; `("menus", "menu")` → false.
  - **(Review Focus 3)** `matches NFD input against NFC vocab.input`.
- [ ] **Step 2:** Run `npx vitest run supabase/functions/_shared/validate-lesson.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. For `containsWord`, escape the word for regex and wrap it in `(?<![\p{L}])` … `(?![\p{L}])` with flags `iu`.
- [ ] **Step 4:** Re-run. Expected: all pass.
- [ ] **Step 5: Commit** `feat: lesson output checks`

---

### Task 4: Prompt, JSON parsing and AI gateway adapter

**Files:**
- Create: `supabase/functions/_shared/prompt.ts`
- Create: `supabase/functions/_shared/ai.ts`
- Test: `supabase/functions/_shared/prompt.test.ts`, `supabase/functions/_shared/ai.test.ts`

**Interfaces:**
- Consumes: `Scenario`, `LessonRequest`.
- Produces (`prompt.ts`): `type ChatMessage = { role: "system" | "user"; content: string }`; `buildMessages(scenario: Scenario, req: LessonRequest): ChatMessage[]` returning `[system, user]`.
- Produces (`ai.ts`): `type AiCaller = (messages: ChatMessage[]) => Promise<string>`; `class AiGatewayError extends Error { status: number }`; `createLovableAiCaller(apiKey: string, fetchFn: typeof fetch = fetch, model = "google/gemini-3.7-flash"): AiCaller`; `parseJsonObject(text: string): unknown | undefined`.

The system prompt (builder writes the wording) must state: the learner is a Vietnamese beginner; explanations and quiz questions are in Vietnamese; the three level definitions verbatim from the spec's table; each chosen word must be used naturally, in the sense people really use it in this situation; if an input word is Vietnamese, pick the most common beginner English word for it here, set `input` to the exact input and `word` to the English; quiz questions put the learner in a *new* situation, one per word, in input order, 3 options, the correct option being that word; output **only** a JSON object in the `Lesson` shape (include the shape in the prompt). The user message names the scenario (`promptContext`), the words as a JSON array, and the level.

- [ ] **Step 1: Write failing tests.**
  - `prompt.test.ts`: `buildMessages` returns 2 messages; the system message contains each level's key phrase and the words `"input"` and `"answer_index"`; the user message contains `JSON.stringify(req.words)` and `Level: 2` for a level-2 request.
  - `ai.test.ts` → `parseJsonObject`: plain JSON → object; **(Review Focus 1)** ```` ```json\n{…}\n``` ```` → object; `"Here you go: {…} Enjoy!"` → object; `"not json"` → `undefined`; `"[1,2]"` → `undefined` (top-level must be an object).
  - `ai.test.ts` → `createLovableAiCaller` with a fake `fetchFn`: sends POST to `https://ai.gateway.lovable.dev/v1/chat/completions` with both auth headers, `model`, `messages` and `response_format: {type:"json_object"}`; returns `choices[0].message.content`; a 429 response throws `AiGatewayError` with `status 429`; a 402 throws with `status 402`; a 200 with no content throws `AiGatewayError` with `status 502`.
- [ ] **Step 2:** Run `npx vitest run supabase/functions/_shared/prompt.test.ts supabase/functions/_shared/ai.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. `parseJsonObject`: try `JSON.parse(text)`; otherwise take the substring from the first `{` to the last `}` and try again; return it only if it is a non-null, non-array object.
- [ ] **Step 4:** Re-run. Expected: all pass.
- [ ] **Step 5: Commit** `feat: prompt builder, JSON parsing and Lovable AI adapter`

---

### Task 5: `generateLesson` handler and the Edge Function

**Files:**
- Create: `supabase/functions/_shared/generate.ts`
- Create: `supabase/functions/generate-lesson/index.ts`
- Create: `supabase/config.toml` with `[functions.generate-lesson]` and `verify_jwt = false` (public app, no login)
- Test: `supabase/functions/_shared/generate.test.ts`

**Interfaces:**
- Consumes: `checkLessonRequest`, `getScenario`, `buildMessages`, `AiCaller`, `AiGatewayError`, `parseJsonObject`, `checkLesson`.
- Produces: `generateLesson(body: unknown, callAi: AiCaller): Promise<{ status: number; body: Lesson | ErrorBody }>`. `index.ts` exports nothing: it handles CORS (`OPTIONS` → 200 with `Access-Control-Allow-Origin: *`, allowed headers `authorization, x-client-info, apikey, content-type`), parses the JSON body (bad JSON → 400 `bad_request`), builds the caller from `Deno.env.get("LOVABLE_API_KEY")`, and returns `generateLesson`'s status and body as JSON with CORS headers.

Status mapping (copy is fixed here):

| Case | status | code | message_vi |
|---|---|---|---|
| request fails checks | 400 | `bad_request` | "Yêu cầu không hợp lệ. Vui lòng chọn lại từ vựng." |
| gateway 429 | 429 | `rate_limited` | "Hệ thống đang bận. Vui lòng thử lại sau ít phút." |
| gateway 402 | 503 | `out_of_credits` | "Hệ thống tạm thời không tạo được hội thoại. Bạn có thể xem bài mẫu." |
| two failed attempts (bad JSON/check failure/other gateway error) | 502 | `ai_failed` | "Không tạo được hội thoại. Vui lòng thử lại." |

- [ ] **Step 1: Write failing tests** with a fake `callAi` (a `vi.fn` that returns queued strings or throws). Reuse `validLesson()` from `test-fixtures.ts` (Task 3).
  - `returns 200 and the lesson on a good first answer`; `callAi` called once.
  - `retries once when the first answer fails checks` → 200, `callAi` called twice.
  - `retries once when the first answer is not JSON` → 200.
  - `returns 502 ai_failed after two bad answers`; `callAi` called exactly twice.
  - `returns 400 bad_request without calling the AI` for `{words:[]}`.
  - **(Review Focus 4)** `maps gateway 429 to rate_limited` and `maps gateway 402 to out_of_credits (503)`, with no retry in either case.
- [ ] **Step 2:** Run `npx vitest run supabase/functions/_shared/generate.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `generateLesson`, then `index.ts` as described above (`Deno.serve`).
- [ ] **Step 4:** Re-run. Expected: all pass. Run `npm test`. Expected: whole suite green.
- [ ] **Step 5: Commit** `feat: generate-lesson edge function with retry and error mapping`

---

### Task 6: Lesson API client and Choose screen

**Files:**
- Create: `src/lib/api.ts`, `src/lib/selection.ts`
- Create: `src/components/ChooseScreen.tsx`
- Test: `src/lib/api.test.ts`, `src/lib/selection.test.ts`, `src/components/ChooseScreen.test.tsx`

**Interfaces:**
- Consumes: shared `types.ts`, `SCENARIOS`, `normalizeWord` (import from `../../supabase/functions/_shared/…ts`; add a `@shared/` alias to that folder in Vite, Vitest and tsconfig).
- Produces (`api.ts`): `type LessonResult = { ok: true; lesson: Lesson } | { ok: false; code: ErrorCode | "timeout" | "network"; message_vi: string }`; `requestLesson(req: LessonRequest, opts?: { fetchFn?: typeof fetch; timeoutMs?: number }): Promise<LessonResult>`. It POSTs to `${VITE_SUPABASE_URL}/functions/v1/generate-lesson` with headers `apikey` and `Authorization: Bearer` set to `VITE_SUPABASE_PUBLISHABLE_KEY`; default timeout 30000 ms via `AbortController`. Timeout message_vi: "Mất quá nhiều thời gian. Vui lòng thử lại."; network: "Không kết nối được. Kiểm tra mạng và thử lại."
- Produces (`selection.ts`): `addWord(selected: string[], word: string): string[]` (normalizes; ignores a case-insensitive duplicate; ignores input when 5 are already selected; ignores empty); `toggleWord(selected: string[], word: string): string[]`; `canSubmit(selected: string[]): boolean` (3–5).
- Produces (`ChooseScreen.tsx`): `ChooseScreen(props: { initial?: LessonRequest; onSubmit: (req: LessonRequest) => void })`.

UI per spec screen 1: scenario cards, chips for `suggestedWords`, a custom word input (placeholder "Thêm từ của bạn (tiếng Anh hoặc tiếng Việt)") with an add button, level selector with one-line descriptions ("Cấp 1: chỉ từ mới bằng tiếng Anh", "Cấp 2: thêm cụm từ tiếng Anh ngắn", "Cấp 3: cả câu tiếng Anh, có dịch"), a counter "Đã chọn x/5 từ (cần ít nhất 3)", and the "Tạo hội thoại" button disabled unless `canSubmit`. Custom words show as selected chips with a remove (×) control.

- [ ] **Step 1: Write failing tests.**
  - `selection.test.ts`: add up to 5; the 6th is ignored; **(Review Focus 5)** `addWord(["menu"], "Menu ")` → `["menu"]`; `toggleWord` adds and removes; `canSubmit` false at 2 and true at 3 and 5.
  - `api.test.ts` (fake `fetchFn`): 200 → `{ok:true, lesson}`; 502 with `ErrorBody` → `{ok:false, code:"ai_failed", message_vi}` from the body; fetch rejects → `code:"network"`; a never-resolving fetch with `timeoutMs: 10` → `code:"timeout"`.
  - `ChooseScreen.test.tsx`: picking café and 3 chips enables the button; clicking it calls `onSubmit` with `{scenarioId:"cafe", words:[…3], level:1}`; typing "hóa đơn" and pressing add shows it as a chip.
- [ ] **Step 2:** Run `npx vitest run src/lib src/components/ChooseScreen.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run. Expected: all pass.
- [ ] **Step 5: Commit** `feat: lesson API client and choose screen`

---

### Task 7: Read screen with highlighting and speech

**Files:**
- Create: `src/lib/highlight.ts`, `src/lib/speech.ts`, `src/components/ReadScreen.tsx`
- Test: `src/lib/highlight.test.ts`, `src/components/ReadScreen.test.tsx`

**Interfaces:**
- Consumes: `Lesson`.
- Produces: `type Segment = { text: string; word?: string }`; `splitHighlights(text: string, words: string[]): Segment[]` (whole-word, case-insensitive, longest word first so "to go" wins over "go"; `word` holds the canonical vocab word, `text` the original casing). `speak(text: string): void` and `canSpeak(): boolean` (Web Speech API, `lang = "en-US"`, rate 0.9). `ReadScreen(props: { lesson: Lesson; isSample?: boolean; onStartQuiz: () => void })`.

UI per spec screen 2: title; if `isSample`, a badge "Bài mẫu"; for each vocab item whose `input !== word`, a line "hóa đơn → receipt" above the conversation; lines with speaker labels, target words highlighted with a 🔊 button each (hidden when `!canSpeak()`); level-3 translations in muted italics under each line; one card per vocab item (word + 🔊, `meaning_vi`, `usage_vi`); "Làm bài kiểm tra" button.

- [ ] **Step 1: Write failing tests.**
  - `highlight.test.ts`: `("Chị uống ở đây hay to go ạ?", ["to go"])` → 3 segments with the middle `{text:"to go", word:"to go"}`; **(Review Focus 2)** `("Is it good?", ["go"])` → one plain segment; `("Menu, please. The MENU!", ["menu"])` → two highlighted segments keeping original casing; overlapping `["go","to go"]` on "to go" → a single "to go" segment.
  - `ReadScreen.test.tsx`: renders all line texts; shows "hóa đơn → receipt" when vocab maps; shows "Bài mẫu" only when `isSample`; clicking "Làm bài kiểm tra" calls `onStartQuiz`.
- [ ] **Step 2:** Run `npx vitest run src/lib/highlight.test.ts src/components/ReadScreen.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement (stub `window.speechSynthesis` as absent in jsdom; `canSpeak` returns false there).
- [ ] **Step 4:** Re-run. Expected: all pass.
- [ ] **Step 5: Commit** `feat: read screen with word highlighting and speech`

---

### Task 8: Quiz screen

**Files:**
- Create: `src/lib/quiz.ts`, `src/components/QuizScreen.tsx`
- Test: `src/lib/quiz.test.ts`, `src/components/QuizScreen.test.tsx`

**Interfaces:**
- Consumes: `QuizQuestion`.
- Produces: `scoreQuiz(questions: QuizQuestion[], answers: number[]): { correct: number; total: number }`. `QuizScreen(props: { quiz: QuizQuestion[]; onNewConversation: () => void })`.

UI per spec screen 3: "Câu i / n", the question, 3 option buttons; after choosing, lock the options, mark right/wrong, show "Đúng rồi!" or "Chưa đúng." plus `explanation_vi`, and a "Câu tiếp theo" button. End screen: "Bạn trả lời đúng x/n câu", "Thử lại" (restart this quiz from question 1 with answers cleared) and "Hội thoại mới" (calls `onNewConversation`).

- [ ] **Step 1: Write failing tests.** `scoreQuiz` counts correct answers (all right, none right, mixed). `QuizScreen.test.tsx`: answering 3 questions (2 right) shows "Bạn trả lời đúng 2/3 câu"; "Thử lại" returns to "Câu 1 / 3"; "Hội thoại mới" calls the callback.
- [ ] **Step 2:** Run `npx vitest run src/lib/quiz.test.ts src/components/QuizScreen.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run. Expected: all pass.
- [ ] **Step 5: Commit** `feat: quiz screen`

---

### Task 9: App flow, loading, errors and fallback lessons

**Files:**
- Create: `src/data/fallback-lessons.ts`
- Modify: `src/App.tsx`
- Test: `src/data/fallback-lessons.test.ts`, `src/App.test.tsx` (replace the smoke test)

**Interfaces:**
- Consumes: `requestLesson`, the three screens, `checkLesson`.
- Produces: `FALLBACK_REQUESTS: Record<Level, LessonRequest>` and `FALLBACK_LESSONS: Record<Level, Lesson>`, three hand-written café lessons using the words `["menu","to go","receipt"]`, one per level, following the spec's level table.

App states: `choose` → `loading` ("Đang tạo hội thoại…" with an animated indicator) → `read` → `quiz`, plus `error`. The error state shows `message_vi`, a "Thử lại" button (re-sends the same request), and "Xem bài mẫu" (opens `FALLBACK_LESSONS[req.level]` in `read` with `isSample`). "Hội thoại mới" returns to `choose` with the last request as `initial`. Layout is a single centered column, max width ~640 px, usable at 375 px wide.

- [ ] **Step 1: Write failing tests.**
  - `fallback-lessons.test.ts`: for each level, `checkLesson(FALLBACK_LESSONS[l], FALLBACK_REQUESTS[l]).ok === true`. This keeps the hand-written samples honest.
  - `App.test.tsx` (mock `@/lib/api`): success path, where choosing café + 3 words → submit → "Đang tạo hội thoại…" → the lesson title → "Làm bài kiểm tra" → "Câu 1 / 3"; **(Review Focus 4)** error path, where the mock returns `{ok:false, code:"out_of_credits", message_vi:"Hệ thống tạm thời…"}` → the message is shown → "Xem bài mẫu" shows the "Bài mẫu" badge; "Thử lại" calls `requestLesson` a second time with the same request.
- [ ] **Step 2:** Run `npx vitest run src/data src/App.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Write the three fallback lessons and implement the App state machine.
- [ ] **Step 4:** Run `npm test` and `npm run build`. Expected: all green, build exits 0.
- [ ] **Step 5: Commit** `feat: app flow with loading, errors and sample lessons`

---

### Task 10: README, push and early Lovable import

**Files:**
- Modify: `README.md`

README sections: what the app does and who it's for (2–3 sentences, plus a screenshot later); how it works (the diagram: browser → Edge Function → Lovable AI gateway, with checks and retry); run locally (`npm install`, `npm run dev`, `.env` from `.env.example`; `supabase functions serve generate-lesson --env-file supabase/.env` with `LOVABLE_API_KEY`); `npm test` and what the tests cover; deploying on Lovable (below); project structure (one line per folder).

- [ ] **Step 1:** Write the README. Run `npm test && npm run build`. Expected: green, exit 0.
- [ ] **Step 2:** Run `git status` and `git grep -n -i "lovable_api_key=\|sk-\|eyJ"`. Expected: no secrets in tracked files.
- [ ] **Step 3: Commit** `docs: README with setup, tests and deployment` and push `main`.
- [ ] **Step 4 (user, in Lovable):** Import the public GitHub repo into a new Lovable project, enable Lovable Cloud (Supabase) and AI, and confirm that the `generate-lesson` function deploys and `LOVABLE_API_KEY` exists. Open the public link and generate one café lesson at each level.
- [ ] **Step 5:** Clone the Lovable-created repo locally (next to this one). Check that `supabase/functions/`, the tests and the README survived the import (`npm test` green). From here on, work in that repo.

---

### Task 11: Remaining situations (work in the Lovable repo)

**Files:**
- Modify: `supabase/functions/_shared/scenarios.ts`
- Test: `supabase/functions/_shared/scenarios.test.ts`

Add 🛒 `supermarket` "Siêu thị", 🚕 `taxi` "Gọi taxi", 🏥 `clinic` "Phòng khám", each with a `promptContext` and 10–15 beginner words.

- [ ] **Step 1: Write failing test** `scenarios.test.ts`: there are 4 scenarios with unique ids; every scenario has 10–15 suggested words; every suggested word passes the request word rule (call `checkLessonRequest` with it plus two other valid words) and has no duplicates within its scenario.
- [ ] **Step 2:** Run `npx vitest run supabase/functions/_shared/scenarios.test.ts`. Expected: FAIL (only 1 scenario).
- [ ] **Step 3:** Add the three scenarios.
- [ ] **Step 4:** Re-run, then `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `feat: add supermarket, taxi and clinic situations`

---

---

**After Task 11:** polish on the live app (phone layout, a screenshot in the README), then the 2-minute demo video. Leave about 3 hours for these, as the spec says. They are outside this plan's code tasks.
