# City Game: Design

**Date:** 2026-11-14
**Status:** Draft, awaiting approval
**Builds on:** `docs/superpowers/specs/2026-11-14-vocab-conversations-design.md` (the vocab app, already built and on `main`)

## Intent

Turn the vocab app into a small 2D game, so learning feels **more fun and different from the usual** learning app (user's words). The learner walks a character around a city. Each place in the city is one of the app's situations, and walking in starts that situation's lesson, acted out inside the place.

Everything that makes the lessons good and reliable stays: the AI call, the checks, the retry, the sample lessons, Vietnamese UI, and the word explanations.

## Who it's for

Same as the vocab app: Vietnamese speakers who are beginners in English, reading Vietnamese UI. Judges of the Veritas AI Hackathon will try it from a public Lovable link, possibly on a phone, and read the code.

## Decisions made with the user

- **A 2D city you walk around**, with one place per situation: café, supermarket, taxi stand, clinic.
- **Both "A" and "B" from the brainstorm:** the city with a passport of stamps (A), and the lesson played out inside each place as a conversation and a quiz with the person there (B).
- **Level is chosen once at the start of the game** and stays the same until all four places are finished.
- **Words are chosen inside each place:** after you enter and before the conversation starts, you pick suggested words or type your own (English or Vietnamese), 3–5 words, as in the current app.
- **Emoji as placeholder art** for now, to be replaced later.
- **Build approach: a tile grid in React** (approach A below).

## Goals

1. Walking to a place and starting its lesson feels like playing, not like filling in a form.
2. The conversation feels acted out: one line at a time, in speech bubbles, between your character and the person in the place.
3. Finishing places gives visible progress (coins, stamps, a celebration at the end) and a reason to replay.
4. Playable with a keyboard on a computer and with taps on a phone (375 px wide).
5. Lesson quality and reliability are unchanged: the same checked lessons and the same fallback when the AI fails.
6. The new game logic is covered by automated tests, as the rest of the app is.

## Non-goals (for this build)

- Real art, animations beyond simple slides and fades, sound effects or music.
- A scrolling or multi-screen city, or more places than the four situations.
- People walking around the city, or talking to anyone outside the four places.
- Role-play (choosing your own lines in the conversation).
- Accounts or progress synced across devices.

## Anti-goals

- **The game gets in the way of learning:** long walks, mazes, or tricky movement before every lesson. The city must be small, and every door a few seconds away.
- **Hard to play on a phone,** or controls that only make sense to gamers.
- **Breaking what works:** the AI and fallback paths must behave exactly as today.
- English-only instructions anywhere in the game.

## Approaches considered

| Approach | Trade-offs | Decision |
|---|---|---|
| **Tile grid in React** (emoji tiles, character steps tile to tile with a slide animation, scenes are React screens) | Same stack and tools as the app; every part testable like the current screens; Lovable import stays safe; emoji become image tiles later by changing one lookup table. Tile-by-tile movement, not free roaming; a big scrolling world would need more work. | **Chosen by the user.** |
| Game engine (Phaser) on a canvas | Smooth movement, camera, collisions built in; a better fit for a large city with real art. A big new library, the city becomes hard to test, more import risk, and emoji look worse on a canvas. | Not chosen. |
| 3D or isometric engine | Far too much for placeholders and a hackathon clock. | Ruled out. |

## Design

### The flow

```
Start ──► City ──(walk into a door)──► Place: greeting → pick words → (loading) → conversation → word notes → quiz → stamp
  ▲         ▲                                                                                                │
  │         └──────────────────────────── back to the city, standing outside that door ◄─────────────────────┘
  │
  └── Celebration (after the 4th stamp): play again at this level, or move up a level (fresh passport)
```

### 1. Start screen

Title ("Học từ qua hội thoại"), a one-line explanation of the game, the three levels (same descriptions as today), and a "Bắt đầu" (start) button. The level is locked for the round: it is shown in the city's top bar, and there is no way to change it mid-round.

If saved progress exists, the start screen offers "Chơi tiếp" (continue), which goes straight to the city, and "Chơi mới" (new game), which asks for a level and clears the saved round. *(My call.)*

### 2. City

- **One screen, a grid of emoji tiles** (about 10 columns × 8 rows, so tiles stay about 34 px on a 375 px phone). The map is defined in code as rows of characters, e.g. `.` road, `"` grass, `#` building wall, `D` door, with a lookup table from each place's door to its situation. Exact layout left to the builder; the farthest door must be reachable in about 12 steps or fewer from the start tile.
- **Four places**, each a small block of building tiles with one door tile. A sign above or next to it shows the place's emoji and Vietnamese name (☕ Quán cà phê, 🛒 Siêu thị, 🚕 Gọi taxi, 🏥 Phòng khám). Finished places show a ✓.
- **The character** (an emoji) stands on a road or grass tile and can't walk through walls, buildings or water.
- **Controls:**
  - Keyboard: arrow keys and WASD move one tile per press; holding a key repeats.
  - Tap/click: tapping a reachable tile walks the character there step by step along the shortest path. Tapping a building walks to its door.
  - Movement animates as a short slide (~120 ms per tile).
- **Entering a place:** stepping onto a door tile opens that place.
- **Top bar:** current level, coins, and the passport: four stamps, filled when that place is finished.
- A short Vietnamese hint the first time ("Đi đến một địa điểm để bắt đầu"). It disappears after the first move.

### 3. Inside a place

A scene with the place's emoji backdrop, the **host** (the person who works there, e.g. 🧑‍🍳 barista, 🧑‍💼 cashier, 🧑‍✈️ driver, 🧑‍⚕️ doctor; exact emoji left to the builder) on one side and your character on the other. A "Rời đi" (leave) button returns to the city at any point before the quiz ends, without a stamp.

**a. Greeting and word picking.** The host greets you in a speech bubble (a fixed Vietnamese line per place, e.g. "Chào bạn! Hôm nay bạn muốn học từ nào?"). Below it is the same word picker as today, for this place's situation: suggested word chips, an "add your own word" box (English or Vietnamese, same validation and Vietnamese hint), and the 3–5 counter. The level is not shown here (it's fixed for the round). The button is "Bắt đầu hội thoại" (start the conversation). The last words used in this place are pre-selected when you come back. *(My call.)*

**b. Loading.** The host's bubble shows a thinking animation and "Đang chuẩn bị…".

**c. Conversation.** The lesson's lines play one at a time as speech bubbles. Lines from the host's role sit on the host's side, the other role's on your side. *(My call: the AI prompt gains one rule: "use exactly two speakers; the first line is spoken by the person who works there (staff, cashier, driver, doctor)". The app treats the first speaker in `lines` as the host and any other speaker as you. This is a prompt-only change with a prompt test; the lesson checks don't change, so no lesson that passes today gets rejected.)* Each bubble shows the speaker's Vietnamese role name. English target words are highlighted with 🔊 buttons. At level 3 the Vietnamese translation sits under each line. Tap anywhere, or press Space/Enter, to show the next line ("Tiếp ▸"). Earlier lines stay visible above, so you can scroll back. Any Vietnamese input that the AI mapped to an English word is shown once before the first line ("hóa đơn → receipt").

**d. Word notes.** After the last line, the host says "Cùng xem lại các từ nhé!" (let's review the words) and the vocab cards appear (word, 🔊, meaning, when to use it), as on today's Read screen. Then "Làm bài kiểm tra" (take the quiz).

**e. Quiz with the host.** The host asks each question in a speech bubble, with the 3 options as buttons below. A right answer earns **+10 coins** (a small "+10 🪙" pop-up) and the host says "Đúng rồi!" with the explanation; a wrong answer shows "Chưa đúng." with the explanation. One question per word, as today.

**f. Stamp.** After the last question: your score for this place, coins earned, and the place's stamp landing in the passport (a short animation). Finishing the quiz earns the stamp whatever the score. *(My call: the stamp is for finishing; coins reward right answers.)* Then "Về thành phố" (back to the city), standing on the road tile just outside that door.

**Replaying a place** that already has its stamp is allowed: you can pick new words and earn more coins. The stamp stays.

### 4. Celebration

After the fourth stamp, back in the city, a celebration overlay: "Bạn đã hoàn thành cấp N!", total coins for the round, and buttons:
- "Chơi lại cấp N" (play again at this level): a fresh passport, coins reset.
- "Lên cấp N+1" (move up a level): a fresh passport at the next level. Not shown at level 3.
- "Tiếp tục dạo phố" (keep exploring): closes the overlay, so you can replay places and earn coins with the full passport. *(My call.)*

The round is then **complete**, and that is saved. While it's complete, a "🏆" button in the top bar reopens the celebration. Reloading a complete round opens the city with that button, not the celebration. *(My call.)*

### When the AI fails

The same error codes and Vietnamese messages as today, said by the host in a speech bubble, with buttons:
- "Thử lại" (try again; hidden for `bad_request`, as today);
- "Xem bài mẫu" (see a sample): the host acts out the café sample lesson for the round's level, labeled "Bài mẫu", followed by the normal word notes and quiz. Finishing it still earns that place's stamp. *(My call: the sample is the café lesson in every place. Writing a sample for each place is out of scope.)*;
- "Chọn lại từ" (pick words again).

### Saved progress

The round (level, stamps, coins) and the last words used per place are saved in the browser's `localStorage` and restored on reload. All reads and writes are wrapped in try/catch, and the game works normally without it (a private window just doesn't remember). Leaving or reloading mid-lesson loses that lesson, not the round.

### Architecture

- **Pure game logic in `src/game/`, no React:**
  - the map: parsing, walkable tiles, doors to situations;
  - movement: one step with collision;
  - pathfinding: shortest path to a tapped tile, BFS on the grid;
  - game state: a reducer for level, stamps, coins, rounds, and moving up a level;
  - saving and loading.
- **React screens:** `StartScreen`, `CityScreen`, `PlaceScreen` (word picking → conversation → word notes → quiz → stamp), `Celebration`.
- **Reused as is:** `requestLesson`, word selection rules, `splitHighlights`, `speak`, `scoreQuiz`, fallback lessons, and everything in `supabase/functions/` except the one prompt rule above (host speaks first, two speakers). The word picker part of `ChooseScreen` becomes a `WordPicker` component used inside places.
- **The game replaces the old three-screen flow** as the app. Components that only served the old flow (`ChooseScreen`'s situation and level steps, `ReadScreen`, `QuizScreen`) are removed or folded into the new screens, so the code doesn't carry two apps. Their tests move with the parts that survive. *(My call.)*
- **Emoji swap:** all emoji (tiles, character, hosts, place signs) come from one lookup table, so art can replace them later.

### Tests

- **Map:** parsing, walkable vs blocked tiles, each door maps to the right situation, every door reachable from the start tile.
- **Movement:** stepping into walls or off the map does nothing; stepping onto a door reports which place.
- **Pathfinding:** shortest path around walls; unreachable target → no path; tapping a building targets its door.
- **Game state:** finishing a place adds the stamp; coins add up; the fourth stamp marks the round complete and triggers the celebration once; play again resets stamps and coins and keeps the level; moving up increments the level, and is unavailable at level 3; "keep exploring" leaves the round complete; replaying a stamped place keeps one stamp.
- **Saving:** round restores after reload, including a complete round (city with the 🏆 button); broken or missing saved data → a fresh game; storage throwing → the game still works.
- **Screens:** start → city with the chosen level; keyboard movement onto a door opens that place; word picking → conversation advances line by line on click and Enter; quiz awards coins; finishing returns to the city with a stamp; the AI error path offers the sample lesson inside the place.
- **Prompt:** the system prompt states the two-speaker, host-first rule.
- All other existing shared tests (`supabase/functions/_shared/`) keep passing unchanged.

### Where it's built

In this repo (`juniorvuong8/Veritas-AI-Hackathon`). The user's Lovable project is connected to this same GitHub repo; as of 2026-11-14, Lovable had pushed no commits of its own. Build on a feature branch, merge to `main` after the final review, then push; Lovable syncs from `main`. Before merging, fetch `origin/main` and merge in any commits Lovable made in the meantime (edits made in Lovable's editor land there).

## Left to the builder

- The exact map layout, the tile emoji, and the host and character emoji (within the rules above).
- Colors, fonts, bubble and animation styling (friendly, clean, readable Vietnamese diacritics).
- Animation timings within the rough values above.
- Each host's greeting line and the small Vietnamese UI copy not fixed above.
- How the city grid scales between phone and desktop widths.
