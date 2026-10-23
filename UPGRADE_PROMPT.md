# Pixel Hockey: Upgrade Prompt (v1.1)

> This is the build prompt for the second pass on Pixel Hockey. It covers three things: making the game easier to pick up, making the arena look and feel more alive, and adding the hockey moments fans love (bar down, goal horn, goal light, hat tricks, and more). It extends `PIXEL_HOCKEY_PROMPT.md` and keeps the existing engine, look and file layout.

---

## PROMPT

You are improving **Pixel Hockey**, an existing retro pixel-art hockey web game (TypeScript, Vite, Canvas 2D, installable on the iOS home screen). Keep the current architecture (`src/game/match.ts` engine, `src/render/*` art, `src/scenes/*` screens) and the chunky Retro Bowl-style look. Make these improvements.

### 1. Easier to play (accessibility first)

Research notes: *NHL '94* is remembered as pick-up-and-play. Reviewers say most people master its simple controls within minutes, and its one-timer was "one of the most accessible scoring options". The same retrospectives warn that a move the CPU can't use makes losing to the AI frustrating, so keep assists fair.

1. **Easy Controls assist (setting, default ON).** For the human only:
   - **Shot aim assist.** Shots auto-aim at the open corner, away from the goalie, when no direction is held. Aim error is cut to about 40%.
   - **Shot height targeting.** Each shot is given a target height (low, mid or top shelf) by computing the vertical launch speed, so pucks reach the net instead of sailing high.
   - **Faster slap shots.** A full slap-shot charge takes 0.5 s instead of 0.9 s.
   - **Pass assist.** The human's passes have no angle error, and the receiver gets a larger catch radius.
   - **Puck protection.** CPU poke checks and body checks succeed about 40% less often against the human puck carrier.
   - **Faceoff help.** The faceoff timing window gets +0.12 s.
   - **Target reticle.** When the human carries the puck in the attacking half, a pulsing yellow target is drawn on the net corner where an assisted shot will go, so players always know a shot will be on net.
2. **Auto-switch (setting, default ON).** On defense, control moves to the skater closest to the puck. It uses hysteresis: switch only if another skater is clearly closer (25% closer and at least 20 px) and at most every 0.35 s, so control never flickers.
3. **Arcade rules by default.** New players start with icing OFF, on ROOKIE difficulty (offside was later removed entirely). Existing saves keep their choices, migrated once with a settings version. All rules stay toggleable.
4. **Bigger touch targets.** SHOOT radius 22, PASS 17, DEKE 14, plus a bigger floating joystick.
5. **Contextual first-time tips.** These show once per install and are stored in `localStorage`:
   - The first time you have the puck: "TAP SHOOT TO SHOOT - HOLD FOR A SLAPSHOT".
   - The first time you defend: "CHECK OR POKE TO STEAL - SWITCH CHANGES PLAYER".
   - The first faceoff: the existing drop hint.
6. Keep CPU penalties rarer against the human, and keep the existing per-difficulty goalie tuning.

### 2. Better arena (presentation)

Research notes: NHL arenas feature a **center-hung video board** (usually four-sided) above center ice, **goal lights** behind each net that light up red on every goal, LED **dasher-board ads** near the benches, and painted ice logos.

1. **Center-hung jumbotron.** A pixel scoreboard cube hangs on cables above center ice, behind the far glass. Its screen shows live content:
   - normally: both crests' colors, the score and the clock
   - after a goal: a flashing "GOAL!" in the scoring team's colors
   - for big moments: "HAT TRICK!", "BAR DOWN!"
   - for crowd prompts: "LET'S GO <ABBR>!" and "MAKE SOME NOISE!"
2. **Goal lights.** A red lamp sits on the glass behind each net. It is dark when idle and flashes with a glow halo for 3 s after a goal at that net.
3. **Ice upgrades:**
   - glossy sheen streaks and a faint vignette near the boards
   - faint painted sponsor logos in the neutral zone (generic fake brands)
   - **player reflections**: each skater and goalie mirrored below them at low opacity
4. **Arena dressing:**
   - championship-style banners (generic, in team colors) hanging at the top of the stands
   - a catwalk light rig
   - fans holding signs ("GO BOS!", "GOAL!", "#1 FAN")
   - random **camera flashes** in the crowd, which surge on shots and goals
5. **Ice resurfacer.** A generic resurfacing machine (not the trademarked brand name) drives laps across the ice during intermissions and leaves a fresh, glossy strip behind it.

### 3. Hockey moments ("stuff like that")

Research notes: **"bar down"** is slang for a goal where the puck hits the crossbar and deflects down into the net, ideally with a satisfying metallic "clank" or "ping". It is seen as a very showy finish. "Bar out" (or bar north) is when it ricochets away instead. Fans throw **hats** onto the ice for a hat trick. Detroit fans traditionally throw an **octopus** (since 1952), and Florida fans throw plastic **rats** (the 1995 "rat trick").

1. **Crossbar physics:**
   - A puck that crosses the goal line between the posts at crossbar height (within about 2 px below the bar) is a **BAR DOWN** goal: it plays a crossbar PING, shows a "BAR DOWN!" banner and appears on the jumbotron.
   - A puck just above the bar is a **CROSSBAR** hit: it pings and deflects back out with a "CROSSBAR!" pop.
   - A goal scored within 0.25 s of a post hit is **POST AND IN**.
   - **Half-power rule (player request):** every slap shot the player charges past half power (the white tick on the power meter, which turns gold and reads "BAR DOWN!") is a guaranteed bar-down goal. It can't be saved or blocked and threads past the posts. CPU shots are not affected. (`HALF_POWER` in `src/game/match.ts`.)
   - **Offside removed (player request):** there is no offside rule or setting.
   - **Bar-down rate (player request):** 80% of goals go in bar down, and a puck that clips the crossbar drops in 80% of the time. It is set by `BAR_DOWN_CHANCE` in `src/game/match.ts`.
   - **Bar-down sound:** a struck-steel "ting" built from a sharp click plus inharmonic, slightly beating partials at the vibration ratios of a metal bar (1 : 2.76 : 5.4 : 8.93), then the snap of the net and the crowd erupting. The goal horn comes in a beat later so the ting is heard first.
2. **Goal tags** appear in the goal banner and the scoring log: BAR DOWN, POST AND IN, TOP SHELF, FIVE HOLE, ONE-TIMER, REBOUND, BREAKAWAY, SLAPSHOT, POWER PLAY GOAL, SHORTY.
3. **Shot speed.** Hard slap shots show a broadcast-style speed pop, e.g. "98 MPH".
4. **Goal horn and goal song.** These follow NHL arena tradition:
   - **Home team goal:** the full goal horn (a long, detuned, low brass chord with vibrato), then a short **team goal song** (a chiptune jingle generated from the team's name so every club sounds different), then a crowd roar.
   - **Away team goal:** no horn. The crowd groans, with a small pocket of cheering visiting fans.
   - The goal light flashes for both.
5. **Hat trick.** A player's third goal shows "HAT TRICK!", and pixel hats are thrown onto the ice and stay there until the next faceoff. Easter eggs:
   - a Detroit goal at home throws an **octopus** onto the ice
   - a Florida goal at home throws plastic **rats**
6. **Big saves.** A save against a high-quality chance (save chance below 65%) pops "ROBBED!" and plays a crowd "OOH".
7. **Crowd chants.** When the home team presses in the offensive zone, the organ plays a "LET'S GO <TEAM>" clap pattern and the jumbotron shows the chant. This replaces the random organ sting some of the time.

### 4. Acceptance criteria

- `npm test` passes, with new tests for bar-down and crossbar detection and for the assist settings migration.
- With Easy Controls on, a new player can score on Rookie within the first period by skating in and tapping SHOOT.
- Every new effect works on an iPhone in landscape at 60 FPS and fits inside the safe areas.
- The non-affiliation disclaimer remains. Logos, sponsors and the resurfacer are generic and original.
