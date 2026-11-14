# Vocab Conversations: Design

**Date:** 2026-11-14
**Status:** Draft, awaiting approval
**Event:** Veritas AI Hackathon (30 hours)

## Intent

Vietnamese speakers starting English learn single words from flashcards and word lists, but they rarely see **when and how** to use them. This web app teaches beginner English vocabulary inside realistic everyday conversations.

The learner picks a situation (e.g. ordering at a café) and the English words they want to learn. An AI writes a short conversation, mostly in Vietnamese, with those English words placed naturally into the dialogue. Each word comes with an explanation of what it means and when to use it. A short quiz then checks that the learner can use each word in a new situation.

## Who it's for

Vietnamese speakers who are beginners in English. Assume they can't read English instructions comfortably yet.

## Hackathon constraints

- **30 hours** total build time.
- Judging criteria: technical execution, originality, real-world impact, **testing and reliability**, communication.
- Judges watch a **2-minute demo video**, **read the code**, and **try the app themselves**. The app has to work from a public link with no setup, and the code has to be tidy and readable.
- Built in this repo (`juniorvuong8/Veritas-AI-Hackathon`, public), then imported into **Lovable**, which copies the code into its own project and repo and attaches Supabase as the backend. The code therefore has to match Lovable's stack (below). Lovable cannot be pointed at this repo directly.
- The repo is public: **no secrets are ever committed.** The AI gateway key (`LOVABLE_API_KEY`) lives only in Lovable/Supabase secrets.

## Goals

1. A learner can go from "pick a situation" to "finished quiz" in about 3 minutes, entirely in Vietnamese UI.
2. Conversations read naturally and use every chosen word correctly, in context.
3. Three difficulty levels change how much English appears in the conversation.
4. The app never shows broken or half-formed AI output: it either shows a checked, complete conversation or a clear error with a fallback.
5. Real automated tests cover the logic most likely to break.

## Non-goals (for this build)

- Accounts, login, saved progress, history, streaks.
- Role-play / the learner speaking or typing lines of the conversation.
- Speech recognition or pronunciation scoring.
- Languages other than Vietnamese → English.
- Admin tools for editing situations or word lists (they live in code).
- Mobile apps (the web app should still work on a phone screen).

## Anti-goals (would make it a failure even if it "works")

- English-only instructions or buttons: beginners get lost.
- Wrong or awkward Vietnamese, or English words used in the wrong sense.
- The API key exposed in the browser or committed to the repo.
- A blank screen or spinner with no end when the AI is slow or fails, especially during the demo or while a judge is trying it.
- A flashcard app in disguise: words must appear *in* the conversation, used the way people really use them.

## Approaches considered

| Approach | Trade-offs | Decision |
|---|---|---|
| **Lovable-compatible React app + Supabase Edge Function** | Matches where it will be hosted; one codebase; key stays server-side; Lovable gives a public link. Must follow Lovable's stack conventions. | **Chosen by the user.** |
| Next.js app on Vercel | One codebase, good testing story; but the user wants Lovable + Supabase hosting. | Not chosen. |
| Python (FastAPI) backend + separate React frontend | Good for Python-strong teams; two deploys to connect in 30 hours. | Not chosen. |
| Browser-only app calling the AI directly | Fastest; exposes the API key to every visitor. | Ruled out. |

## Decisions made with the user

- **Flow:** read the conversation, then a quick quiz.
- **Word selection:** both a suggested word list for each situation *and* a box to add your own words.
- **Difficulty:** three levels, each adding more English to the conversation (details below).
- **Hosting:** Lovable, with Supabase as the backend. Code is built here first, then imported into Lovable.

## Design

### Stack (Lovable-compatible)

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + shadcn/ui (Lovable's default stack, so the import works).
- **Backend:** one Supabase Edge Function (Deno, TypeScript) at `supabase/functions/generate-lesson/`. It holds the AI call and the output checks.
- **AI:** **Lovable's built-in AI gateway** (user's decision), called only from the Edge Function using the `LOVABLE_API_KEY` secret Lovable provides. No key of our own. Default model is whatever Lovable recommends (Gemini at the time of writing). The builder must check Lovable's current AI docs for the endpoint, model names and how to request JSON output (e.g. a JSON response format or a tool/function call with a schema), because this design can't rely on exact structured outputs.
- **AI adapter:** the gateway call sits behind one small function (`generateLessonJson(prompt) → unknown`) so the rest of the code, and the tests, never depend on the provider. The app's own checks (below) are the real guarantee that the output is usable.
- **Tests:** Vitest for frontend logic; Deno's test runner for the Edge Function's checks, with the AI call mocked.

### Screens (all UI text in Vietnamese)

**1. Choose.** Situation cards (≈4 to start: ☕ quán cà phê, 🛒 siêu thị, 🚕 taxi, 🏥 phòng khám). Picking one shows that situation's suggested words as tappable chips (≈10–15 per situation). Below that is an "add your own word" box, which accepts **English or Vietnamese** (user's decision; e.g. "hóa đơn"), and a level selector (1 / 2 / 3, each with a one-line Vietnamese description). The learner picks **3–5 words** in total, from the list and/or their own. Then a "Tạo hội thoại" (create conversation) button.

**2. Read + listen.** The conversation, about 4–8 lines between two named roles (e.g. Nhân viên / Khách). Target words are highlighted and each has a 🔊 button that reads it aloud with the browser's built-in voice (Web Speech API, `en-US`). Above the conversation, any Vietnamese input is shown with the English word chosen for it ("hóa đơn → receipt"). Under the conversation, one card per word: the word, its Vietnamese meaning, and **when to use it** in Vietnamese. Then a "Làm bài kiểm tra" (take the quiz) button.

**3. Quiz.** One multiple-choice question per screen, **one question per chosen word** (3–5 total), so every word gets tested. *(My call; the brainstorm proposed exactly 3.)* Each question puts the learner in a *new* situation and asks which word fits, so it tests use and not just definitions. After each answer, show right or wrong and a one-line Vietnamese explanation. At the end: score, "Thử lại" (retry the same quiz), and "Hội thoại mới" (new conversation, back to screen 1 with choices kept).

A wireframe of all three screens is saved at `.superpowers/brainstorm/` (not committed).

### Difficulty levels

| Level | What the conversation looks like | Example line |
|---|---|---|
| **1** | Vietnamese sentences with only the chosen English words inserted. | "Chị uống ở đây hay **to go** ạ?" |
| **2** | Vietnamese sentences with short English phrases built around the chosen words. | "Dạ, em muốn **a coffee to go**, cảm ơn." |
| **3** | Whole lines in English, each with a Vietnamese translation underneath. | "Can I get it **to go**?" / *Cho em mang đi được không?* |

At every level, explanations and quiz instructions stay in Vietnamese.

### Lesson data shape

The Edge Function returns one JSON object (the AI is asked for exactly this shape, and the app checks it):

```ts
type Lesson = {
  title_vi: string;                 // e.g. "Gọi đồ uống ở quán cà phê"
  level: 1 | 2 | 3;
  lines: {
    speaker_vi: string;             // "Nhân viên", "Khách"
    text: string;                   // the line as shown, mixed language per level
    translation_vi: string | null;  // required at level 3, null otherwise
  }[];                              // 4–8 lines
  vocab: {
    input: string;                  // exactly what the learner picked or typed (English or Vietnamese)
    word: string;                   // the English word taught; equals `input` when input was English
    meaning_vi: string;             // short Vietnamese meaning
    usage_vi: string;               // when/how to use it, in Vietnamese
  }[];                              // one per chosen word, same order
  quiz: {
    question_vi: string;            // a new situation, in Vietnamese
    options: string[];              // 3 options, English words/phrases
    answer_index: number;           // 0–2
    explanation_vi: string;
  }[];                              // one per chosen word (3–5)
};
```

### Edge Function: `generate-lesson`

**Request:** `{ scenarioId: string, words: string[], level: 1 | 2 | 3 }`

**Steps:**
1. **Check the input.** The scenario exists, there are 3–5 words with no duplicates, each word is 1–30 characters of Unicode letters (Vietnamese diacritics included), spaces, hyphens or apostrophes, and the level is 1–3. Reject anything else with a 400 and a Vietnamese error message. This also limits how much free text from the learner reaches the AI prompt.
2. **Call the AI** (through the adapter) with a fixed system prompt (the teaching rules, the level definitions, the exact JSON shape, and "if an input word is Vietnamese, choose the most common beginner English word for it in this situation") and a user message naming the scenario, the words and the level.
3. **Parse and check the output.** It must be valid JSON in the `Lesson` shape (checked with a schema library such as Zod), plus:
   - `vocab` has exactly one entry per input word, in the same order, with `input` matching;
   - every `vocab.word` appears in at least one line (case-insensitive);
   - `quiz` has one question per word, each with 3 options and a valid `answer_index`, and the correct options cover every `vocab.word`;
   - `translation_vi` is present on every line at level 3.
4. If the checks fail, **retry once**. If they fail again, return a 502 with a Vietnamese error message.
5. Return the `Lesson`.

The output checks are a pure function shared by (or copied into) the Edge Function so they can be unit-tested without calling the AI.

### Reliability

- **Loading state:** a clear Vietnamese "đang tạo hội thoại…" message with a gentle animation; generation is expected to take several seconds.
- **Fallback lessons:** a few ready-made lessons for the café situation (one per level, with the default word set) bundled in the frontend. If the function errors or times out (~30 s), the app shows the error with "try again" **and** offers the café sample at the same level, clearly labeled as a sample, whatever situation or words were chosen. *(My call: no fallbacks for other situations, to save content time.)* This also keeps the demo video safe.
- **Errors** are always shown in Vietnamese with a "try again" button; never a blank screen.
- **Usage guard:** input limits (3–5 short words) and a sensible output-length cap keep each call small. Lovable's AI usage comes out of the workspace's included credits; if the gateway returns a rate-limit or out-of-credits error, show a Vietnamese message plus the sample lesson. No per-user rate limiting in this build.

### Tests (for the "testing and reliability" criterion)

- **Output checks:** valid lesson passes; non-JSON or wrong shape, missing word, vocab/input mismatch, wrong quiz length, bad `answer_index`, missing level-3 translation each fail.
- **Input checks:** word count, duplicates, character rules (Vietnamese diacritics accepted), unknown scenario, bad level.
- **Edge Function:** with the AI adapter mocked, a bad first response triggers one retry, and two bad responses return the error.
- **Frontend:** word highlighting finds target words in mixed-language text (case, punctuation, multi-word phrases); quiz scoring.
- `README` explains how to run the tests.

### Getting it into Lovable *(my call)*

1. Build a thin working slice here first: the three screens with one situation, the Edge Function, and the tests.
2. Push to this public repo and **import into Lovable early** (via Lovable's GitHub import) to prove the hard parts on day one: the Edge Function deploys, the AI gateway answers, and the public link works.
3. After the import, the Lovable-created repo is the source of truth. Clone it here and keep working there; Lovable syncs both ways. Tests, README and `supabase/` must survive the import, so check for them right after.
4. Judges get the Lovable public link and the Lovable repo.

### Build order and what gets cut *(my call; one builder, 30 hours)*

Build in this order, so there is always a working, demo-able app:

1. Thin slice: café situation, level 1, the three screens, the Edge Function with checks, core tests. Import into Lovable.
2. Levels 2 and 3, Vietnamese input, the 🔊 buttons.
3. The other three situations and their word lists; café fallback lessons.
4. Polish: loading state, error states, phone layout, README.
5. Demo video (keep ~3 hours for it at the end).

If time runs short, cut from the bottom of this list first: extra situations → level 3 → Vietnamese input. Never cut the output checks, the tests or the fallback lesson.

### Repo and secrets

- `.env.example` documents `LOVABLE_API_KEY` for local Edge Function runs (and the Supabase URL/anon key for the frontend); real `.env` files are ignored by git.
- README covers what the app does, how to run it locally, how to run the tests, and how to import into Lovable and set the secret.

## Left to the builder

- File and component structure, styling details, colors and fonts (keep it clean and friendly; Vietnamese diacritics must render well).
- The exact system prompt wording, as long as it follows the level definitions and data shape above.
- The exact suggested word lists for each situation (beginner-level, 10–15 each).
- Which gateway model to use: start with a fast one to keep responses quick, and switch to a stronger one only if conversation quality suffers.
- How to run the Edge Function locally (Supabase CLI or a thin local wrapper).
