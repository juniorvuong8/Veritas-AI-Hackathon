# LLM Evaluation: Design

**Date:** 2026-11-14
**Status:** Draft, awaiting approval

## Intent

The hackathon submission needs one honest, checkable claim about how well the AI writes lessons. It fills in this sentence for the judges:

> "We use a pretrained LLM to generate contextual dialogues with target vocabulary. Our baseline substitutes English vocabulary into fixed Vietnamese dialogues using a dictionary. On the same ___ test cases, the baseline achieved ___ and the LLM achieved ___. The LLM still failed when ___."

Judges score "testing and reliability" and read the code, so the evaluation has to be **fair** (same cases, rated without knowing which method made what), **real** (it measures what players get), and **rerunnable** (anyone can regenerate and recompute it from the repo).

## Decisions made with the user

- **Human rating (option C):** the user, a native Vietnamese speaker, rates every dialogue from both methods. No AI judge.
- **24 test cases → 48 dialogues,** about 45–60 minutes of rating.
- **The rubric** (yes/no questions) and the headline score below.
- **Build approach A:** an `eval/` folder in the repo that reuses the app's own lesson code.

## Goals

1. Produce the four blanks: number of cases, baseline score, LLM score, and the LLM's remaining failure modes, backed by files in the repo.
2. Rating is blind and the order is shuffled, so neither method is favoured.
3. The LLM side runs through the production code path: same prompt, model, settings, checks and retry as the live app.
4. One command recomputes the results from saved files. Regenerating the dialogues is a separate, opt-in command because it costs money.

## Non-goals

- An AI judge, inter-rater agreement, or statistical significance testing.
- Testing the deployed Lovable app over the network.
- Changing the app's prompt or model based on the results (a possible follow-up, not part of this).
- Measuring speed or cost (beyond noting what the run cost).

## Anti-goals

- **A rigged comparison:** a strawman baseline, cherry-picked cases, or the rater able to tell which method made a dialogue from formatting.
- **A number that doesn't hold up when a judge reads the code:** results that can't be traced to `cases.json` → outputs → `ratings.json`.
- **Spending money without the user's go-ahead.**
- Committing the API key.

## Approaches considered

| Approach | Trade-offs | Decision |
|---|---|---|
| **A. `eval/` folder reusing the app's lesson code**, local rating page | Tests exactly what players get; rerunnable; judges can read it. About two hours to build. | **Chosen by the user.** |
| B. Same, but calling the live Lovable app over HTTP | Also proves the deployment; depends on the live setup and key working (unconfirmed), slower, and reruns spend live credit. | Not chosen. |
| C. Rate in a spreadsheet | Least to build; hard to keep blind; slow and error-prone to rate long dialogues in cells. | Not chosen. |

## Design

### Test cases: `eval/cases.json`

**24 cases = 4 places × 3 levels × 2 word sets.**

- Each case is `{ id, scenarioId, level, words }`, using the same `LessonRequest` shape as the app.
- **3–5 words per case.** Each place has two word sets:
  - **Set A:** 3 suggested words for that place.
  - **Set B:** 4 words, three suggested plus **one typed in Vietnamese** (e.g. "hóa đơn" at the café, "thuốc" at the clinic). This exercises the Vietnamese-input feature.
- Each set is reused at levels 1, 2 and 3, so level is the only thing that changes across those three cases.
- Words are chosen before any dialogue is generated, and the file is committed before the run, so cases can't be tuned to results.

### Baseline: `eval/baseline/`

A plausible non-AI approach, built **in good faith**: the strongest version of "substitute English words into fixed Vietnamese dialogues using a dictionary". *(My call, after the builder check. A slots-in-order baseline would fail by construction and wouldn't hold up when judges read it.)*

- `dictionary.json`
  - every suggested word of the four places → `meaning_vi` and `usage_vi`, written like a normal bilingual dictionary entry;
  - a `vi_to_en` table for the Vietnamese inputs used in the cases (e.g. "hóa đơn" → "receipt").
- `templates.json`, for each place and each level:
  - **a fixed opening and closing** (2 lines) between that place's two roles;
  - **one fixed line per suggested word** of that place (12 per place), written so that word fits naturally. This is the dictionary's "example sentence", with the word in a `{w}` slot;
  - **one generic fallback line** with a `{w}` slot, used for any word without its own line;
  - line styles per level: level 1 is Vietnamese with the English word; level 2 is Vietnamese with a short English phrase around the word; level 3 is English lines, each with its own matching Vietnamese translation.
- `generate.ts`
  - maps Vietnamese inputs through `vi_to_en` first;
  - builds the dialogue as the opening, then the line for each word in the order given (its own line, or the generic fallback), then the closing;
  - builds `vocab` from the dictionary and a quiz from fixed templates (a question per word, the other case words as distractors);
  - output is a full `Lesson` in the app's format.
- What the comparison then shows honestly: the baseline's lines are correct on their own, but they're stitched together, so the conversation doesn't flow. Every case gets the same fixed lines, and words outside the list fall back to a generic line.

### LLM run: `eval/run-llm.ts`

- The deployed Lovable app runs this same Edge Function code (once `ANTHROPIC_API_KEY` is set there), so this measures the live generation code, not a copy.
- Calls the app's own `generateLesson(body, callAi)` with `createClaudeAiCaller(apiKey)`, reading `ANTHROPIC_API_KEY` from `supabase/.env` (git-ignored; never printed or logged).
- Same model, effort, speed, prompt, checks and single retry as production. Run with Node directly (`node eval/run-llm.ts`, using Node's built-in TypeScript support) or a small npm script.
- Runs cases one at a time, saving after each, so an interrupted run resumes without paying twice.
- Saves the lesson for each case. If a case still fails after the retry, it saves the error code instead. A failed case counts as **not passing** in the results, shown as "no dialogue" on the rating page, and is listed as a failure.
- Before the full run, a **one-case smoke test** (about $0.10) confirms the key works and fast mode is available. If fast mode isn't available, the code already falls back to standard speed.
- Prints the token usage and estimated cost at the end. Estimated cost for 24 cases: about **$2–4** (Opus 5.5 fast mode). **The run needs the user's go-ahead.**
- `run-baseline.ts` writes `eval/results/baseline.json` (free, deterministic).

### Rating page

- A small page in the existing Vite app at **`/eval.html`** (a separate entry, so it is not part of the game). It loads both results files.
- **Cases the LLM couldn't generate** (failed after the retry) are scored as fails automatically and **not shown**, so a "no dialogue" screen can't give the method away.
- **Shuffled once with a fixed seed**, saved as `eval/rating-order.json`, so the order is the same after a reload and can be audited.
- **One dialogue per screen,** rendered identically for both methods: same bubble style, no method name, no badge, and the lesson's `title_vi` hidden. It shows the place, level, target words, and the conversation lines (with translations at level 3). Vocab cards and quiz are not shown: the rubric is about the dialogue.
- **Questions, in Vietnamese:**
  1. "Mỗi từ tiếng Anh có được dùng đúng nghĩa và đúng tình huống không?" (Có / Không)
  2. "Phần tiếng Việt có tự nhiên, như người thật nói không?" (Có / Không)
  3. A free-text note: "Lỗi (nếu có)". Optional, for any dialogue; the rater doesn't know which method made it.
- Progress "12 / 48", next/back, and answers saved as you go: in `localStorage`, plus a "Lưu kết quả" button that downloads `ratings.json`. The user moves it into `eval/`; a static page can't write into the repo.
- Ratings are keyed by the dialogue's id (`<method>:<caseId>`). The page never displays that id.

### Results: `eval/score.ts` → `eval/RESULTS.md`

- Reads `cases.json`, both results files and `ratings.json`. Fails loudly if any dialogue is unrated.
- **Headline score per method:** the % of the 24 cases where both Q1 and Q2 are "Có". A missing dialogue counts as a fail.
- Also reports, per method: the Q1 rate, the Q2 rate, the structure-check pass rate (`checkLesson`), and a breakdown by level and by place.
- States the evaluation's known limits in RESULTS.md: one rater (the developer); the baseline's fixed lines repeat across cases, so the rater may recognise them, which makes the rating blind to formatting but not fully blind; and what the baseline does and doesn't do.
- Lists the user's notes on the LLM's failed dialogues, grouped by hand afterwards into the "still failed when ___" phrase.
- Writes `eval/RESULTS.md` with the filled-in sentence, the tables, and how to rerun.

### Repo

- Everything in `eval/` is committed, including the generated outputs, ratings and RESULTS.md, so judges can see the evidence without paying to regenerate.
- The README gets a short "Evaluation" section with the sentence, a link to RESULTS.md, and the commands.
- No new dependencies.

## Left to the builder

- The exact words in each case (within the rules above) and the baseline dictionary entries and template text. Natural, correct Vietnamese, written in good faith.
- The seed, the rating page's styling (plain is fine; it can reuse the game's look), and file and function names.
- How the quiz distractors are picked in the baseline.
