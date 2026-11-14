# Học từ qua hội thoại (Vocab Conversations)

A small 2D city game that teaches beginner English vocabulary to Vietnamese speakers through everyday conversations. Built for the Veritas AI Hackathon.

You walk around a city with four places: a café, a supermarket, a taxi stand and a clinic. Walk into one, choose 3–5 English words (from a suggested list, or typed in English *or* Vietnamese), and the person who works there acts out a short AI-written conversation with you, using those words naturally. Each word comes with an explanation of what it means and **when to use it**. Then the host quizzes you: right answers earn coins, and finishing earns the place's stamp in your passport.

## How to play

1. **Choose a level** (it stays the same until you've stamped all four places).
2. **Walk** with the arrow keys / WASD, or tap the map to walk there.
3. **Enter a place** and pick your words.
4. **Read the conversation** one line at a time (tap "Tiếp ▸", or press Enter/Space). Highlighted words have 🔊 to hear them.
5. **Take the host's quiz**: +10 🪙 per right answer, and a stamp when you finish.
6. **Collect all four stamps** to finish the level, then play again or move up a level.

Progress (level, stamps, coins) is saved in the browser.

| Level | What the conversation looks like |
|---|---|
| 1 | Vietnamese sentences with only the chosen English words: *"Chị uống ở đây hay **to go** ạ?"* |
| 2 | Vietnamese with short English phrases: *"Dạ, em muốn **a coffee to go**, cảm ơn."* |
| 3 | Whole lines in English, with a Vietnamese translation under each |

## How it works

```
Browser (React game)           Supabase Edge Function              Lovable AI gateway
  city → place ─ POST {place,──► generate-lesson                ──►  (Gemini)
  words, level}                  1. check the request
                                 2. build the prompt
  conversation ◄── Lesson JSON   3. parse + check the answer  ◄──
  quiz → stamp                   4. retry once if it fails checks
```

- **The AI key never reaches the browser.** Only the Edge Function talks to the AI gateway.
- **The app never shows broken AI output.** Every lesson is checked before it is shown: every word is used in the conversation as a whole word, the vocab matches what the learner chose, there is one quiz question per word with a valid answer, and level 3 has a translation on every line. A bad answer is retried once.
- **Something always works.** If the AI is down, rate-limited or out of credits, the learner sees a Vietnamese message, can retry, or can open a hand-written sample lesson that passes the same checks.
- Words are read aloud with the browser's built-in voice (🔊).

## Run it locally

```bash
npm install
cp .env.example .env      # fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

To run the Edge Function locally, install the [Supabase CLI](https://supabase.com/docs/guides/cli), put `LOVABLE_API_KEY=...` in `supabase/.env` (git-ignored), and run:

```bash
supabase functions serve generate-lesson --env-file supabase/.env
```

## Tests

```bash
npm test
```

The suite (Vitest) covers:

- **Request checks:** word count, duplicates, allowed characters, Vietnamese input (including macOS decomposed Unicode), unknown situations and levels.
- **Lesson checks:** every way an AI answer can be wrong (missing words, words hidden inside other words, wrong vocab order, bad quiz answers, missing translations).
- **AI handling:** JSON wrapped in code fences or prose, the gateway request format, rate-limit and out-of-credits errors.
- **Edge Function logic:** one retry on a bad answer, no retry on rate limits, clear error codes.
- **Game logic:** the city map, movement and collisions, tap-to-walk pathfinding (every place within 12 steps), stamps/coins/levels, and saved progress (including corrupt or blocked storage).
- **Screens:** word picking, highlighting words in mixed-language text, the line-by-line conversation, the host quiz and coins, the city controls (keyboard, taps, cancelling a walk), the full game flow including the error → sample lesson path.
- **Sample lessons** pass the same checks as AI lessons.

## Deploying on Lovable

1. Import this GitHub repository into a new Lovable project.
2. Enable Lovable Cloud (Supabase) and Lovable AI. Lovable provides the `LOVABLE_API_KEY` secret to Edge Functions.
3. Check that the `generate-lesson` function is deployed, then open the public link and generate a lesson at each level.

## Project structure

```
src/                          React app (Vite, Tailwind, shadcn/ui)
  game/                       pure game logic: map, movement, pathfinding, state, saving, emoji art table
  components/game/            StartScreen, CityScreen, PlaceScreen, conversation, quiz, celebration
  lib/                        API client, word selection, highlighting, speech, quiz scoring
  data/fallback-lessons.ts    hand-written sample lessons
supabase/functions/
  _shared/                    pure TypeScript shared by the function and the tests:
                              types, situations, checks, prompt, AI adapter, handler
  generate-lesson/index.ts    the Edge Function (thin Deno wrapper)
docs/superpowers/             design doc and implementation plan
```

## Author

James Vuong Jr
