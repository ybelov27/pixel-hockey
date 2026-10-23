# Pixel Hockey: Build Prompt

> Copy everything below the line into an AI coding assistant (or hand it to a developer) to build the game.
> The prompt covers the tech stack, art style, rink, controls, physics, AI, rules, game modes, all 32 NHL teams, UI, audio, and acceptance criteria.

---

## PROMPT

You are an expert HTML5 game developer and pixel artist. Build **"Pixel Hockey"**, a complete, polished, retro-style ice hockey game that runs in a desktop or mobile web browser. It should feel like a mix of *NHL '94* (Sega Genesis) and *Ice Hockey* (NES, 1988): fast, arcade-style, readable, and fun in 30 seconds, with enough depth to keep players coming back. Use all 32 real NHL teams with their real city names, team names, abbreviations, and colors.

### 1. Tech stack and project structure

- **Language:** TypeScript (or modern ES2022 JavaScript if you have to), bundled with **Vite**.
- **Rendering:** HTML5 Canvas 2D. No game engine required. (Phaser 3 is allowed if you prefer, but keep the same specs.)
- **Internal resolution:** **480 × 270** logical pixels (16:9), scaled up by a whole number to fit the window (`image-rendering: pixelated`, `ctx.imageSmoothingEnabled = false`). Letterbox with black bars and never use non-integer scaling.
- **Game loop:** fixed timestep at **60 updates/second** (accumulator pattern), with rendering decoupled from updates and interpolated.
- **Audio:** Web Audio API. Generate all SFX procedurally (chiptune-style square, triangle, and noise channels) so there are no audio files. Start the AudioContext only after the first user input.
- **Persistence:** `localStorage` (wrapped in try/catch) for settings, season progress, and stats.
- **No backend.** It has to work as static files (deployable to GitHub Pages, Netlify, or Vercel).
- Suggested folders:
  ```
  src/
    main.ts            // boot, scaling, loop
    core/              // input, audio, storage, rng, math (vec2)
    game/              // GameState, Rink, Puck, Player, Goalie, Team, Rules, Referee
    ai/                // skater AI, goalie AI, team tactics
    render/            // sprite generation, camera, HUD, particles
    scenes/            // Title, TeamSelect, Game, Pause, Intermission, Results, Season, Settings
    data/teams.ts      // all 32 NHL teams (see section 9)
  ```
- Draw every sprite **procedurally in code** (pixel arrays or `fillRect`) or from one small hand-made spritesheet PNG. Jerseys must be **palette-swapped at runtime** from team colors, so one skater sprite set works for all 32 teams.

### 2. Visual style: how the game looks

- **Look:** 16-bit-era pixel art with a limited palette per sprite (4–6 colors plus outline). Crisp 1-pixel dark outlines. No anti-aliasing, blur, or gradients except dithered ones.
- **Camera:** **top-down, slightly tilted (¾ view)**, like NHL '94. The rink scrolls **vertically** (the attacking direction is up or down the screen) and the camera smoothly follows the puck with a lead offset in the direction the puck is moving. Clamp the camera to the rink bounds. Add a small camera shake on big hits, posts, and goals.
- **Rink sprite (in world units, see section 3):**
  - White/very light blue ice (`#E8F4FF`) with faint dithered skate scratches that build up over the period. Reset them at intermissions to mimic the Zamboni.
  - **Red center line** (dashed or checkered pattern in pixel form), **two blue lines**, **red goal lines**, a **blue center faceoff circle and dot**, **four red end-zone faceoff circles** with hash marks, **four neutral-zone faceoff dots**, a **light-blue goal crease** (semicircle), and a **referee's crease** at center ice.
  - Boards: a white kickplate with a yellow bottom strip (like real NHL boards), and **pixel ad panels** with generic fake sponsors ("PIXEL COLA", "8-BIT AUTO", "RETRO BANK"). Never use real brands.
  - **Glass** shown as a semi-transparent light strip above the boards. A **crowd** behind the glass made of 2×2 pixel "heads" in the home team's colors, animated (bobbing) and going wild after goals.
  - **Home team's center-ice logo:** a simple pixel crest made from the team's colors and abbreviation (e.g. a circle with "BOS"). **Do not copy official NHL logos.** Make original, simple pixel emblems.
  - **Goals:** red pipes, white net with a mesh pattern; the net bulges/ripples for 20 frames when the puck goes in.
- **Skaters:** about **16×20 px**, 8-direction sprites. Animations: idle (2 frames), skate (4 frames), stride-sprint (4), shoot/wind-up (3), pass (2), body-check (3), fall/knocked down (3), celebrate (4, stick raised), and fight (optional easter egg off by default). Jersey = team primary, pants/shoulders = secondary, plus a white or dark helmet, a stick, and a jersey number shown as 3×5 pixel digits on the back when facing away.
- **Goalies:** about **18×22 px**, bigger pads and blocker/glove. Animations: stance, shuffle left/right, butterfly, glove save, blocker save, pad stack, poke check, and recover.
- **Puck:** a 3×2 px black puck with a 1-px shadow. At high speed, draw a 3–4 frame **motion trail**. When lifted (saucer pass or slap shot), offset the sprite upward by its `z` height while the shadow stays on the ice.
- **Selected player indicator:** a colored pixel **star or arrow** above the player's head (P1 = yellow, P2 = cyan), plus an off-screen arrow on the screen edge when the player is out of view.
- **Particles:** ice spray when stopping hard, sparks when the puck hits the post, confetti and crowd flash on goals, a "WHAM!" pixel text pop on big hits.
- **Fonts:** a pixel bitmap font (draw your own 5×7 font or use "Press Start 2P" from Google Fonts).
- **Colour themes:** the menus use the selected team's colors as the accent.

### 3. Rink and world units

Model the rink on official NHL dimensions, scaled down:
- Real rink: **200 ft × 85 ft**, corner radius **28 ft**.
- Goal lines: **11 ft** from the end boards. Blue lines: **64 ft** from each goal line, so the **neutral zone is 50 ft**.
- Center circle: **30 ft** diameter. Faceoff spots are **2 ft** wide. There are nine faceoff spots: center, four in the neutral zone, and two in each end zone.
- Goal opening: **6 ft wide × 4 ft tall**.
- **Scale:** 1 ft = **2.4 px**, so the rink is **480 px long × 204 px wide** in world space. Rotate it so the length runs **vertically** on screen. The screen shows about half the rink at once, and the camera scrolls.
- Collide with the boards along the **rounded corners** using the real corner radius, so the puck rims around the boards realistically.

### 4. Controls

**Keyboard (Player 1):**
| Action | Offense (has puck) | Defense (no puck) |
|---|---|---|
| Move | Arrow keys / WASD | Arrow keys / WASD |
| **A**: `J` | Pass (tap) / saucer pass (hold) | Switch to the skater closest to the puck |
| **B**: `K` | Shoot (tap = wrist shot, hold & release = slap shot with power meter) | Body check (hold with speed for a bigger hit) |
| **C**: `L` | Deke / spin move | Poke check / stick lift |
| Sprint | `Shift` (drains stamina) | `Shift` |
| Pause | `Esc` / `P` | |

- **Player 2 (local versus or co-op):** IJKL + `1`/`2`/`3`/`Right Shift`, or a second gamepad.
- **Gamepad:** full support via the **Gamepad API** (A = pass/switch, B/X = shoot/check, Y = deke/poke, RT = sprint, Start = pause). Up to 4 gamepads for 2v2 co-op.
- **Mobile/touch:** a virtual joystick on the left, three buttons on the right (Pass, Shoot, Check/Deke), and a pause button. Force landscape with a "rotate your device" message in portrait.
- **Passing is aim-assisted:** a pass goes to the teammate best aligned with the stick direction (weighted by angle, distance, and open lane). With no direction held, it goes to the nearest open teammate.
- **One-timers:** pressing Shoot while a pass is on its way to the controlled player triggers a one-timer on arrival (a brief timing window of about 12 frames, with a bonus to power and accuracy).
- Show remappable controls in Settings.

### 5. Physics and core mechanics

All movement uses velocity plus acceleration with friction. Use **vec2** math, run at a fixed 60 Hz.

**Skaters**
- Attributes (1–99) derived from team ratings: `speed`, `acceleration`, `shotPower`, `shotAccuracy`, `passing`, `checking`, `puckHandling`, `stamina`, `defense`.
- Base max speed is about **90 px/s**, about **125 px/s** while sprinting. Turning is momentum-based: changing direction sharply at high speed causes a short skid with ice spray. Skaters should glide and feel like they're on ice, not like a top-down shooter.
- **Stamina:** a bar from 0 to 100. Sprinting drains it, and it recovers while gliding or on the bench. Below 30, top speed and shot power drop by 15%.
- **Line changes:** automatic by default (when average line stamina < 40% and the puck is in the offensive or neutral zone), or manual with a button. Use 3 forward lines and 2 defense pairs.

**Puck**
- Has `pos (x,y)`, `z` (height), `vel`, and `vz`.
- Ice friction: `vel *= 0.985` per tick. When `z > 0`, apply gravity `vz -= 9.8 * k` and bounce on landing with restitution 0.3.
- **Boards:** reflect with restitution **0.6** and add a slight random deflection (±5°). **Posts/crossbar:** restitution 0.8, with a "PING!" sound and sparks.
- **Possession:** a skater picks up a loose puck if it's within about 6 px of their stick blade and slower than a threshold. Higher `puckHandling` gives a larger pickup radius. A carried puck sits at the stick blade offset in front of the skater and wobbles a little.
- **Pass:** speed about 220 px/s, with lead targeting (aim where the receiver *will be*). A saucer pass lifts the puck to clear sticks. Bad `passing` adds an angle error. Defenders' sticks in the lane can **intercept** it.
- **Wrist shot:** fast release, speed about 260 px/s, accuracy-weighted.
- **Slap shot:** hold to charge (a meter over the player, 0.2–1.0 s). Speed is 280–380 px/s with more `z`. It's less accurate, and the wind-up takes longer, so it can be blocked or poke-checked.
- **Shot aiming:** the direction held at release picks the target (glove side, blocker side, five-hole, or high/low). Accuracy spread is `(100 - shotAccuracy) * k`, plus extra error when shooting off-balance or exhausted.
- **Deflections and rebounds:** pucks that hit skaters change direction. Goalie saves produce rebounds whose speed depends on shot speed and save type (glove saves catch and freeze the puck, which means a faceoff).

**Body checking and stick play**
- A check succeeds when the checker's relative velocity and the angle toward the target exceed thresholds. The knockdown chance is `checking + speed` vs. the target's `puckHandling + strength`.
- A knocked-down player is out for 0.8–1.5 s and drops the puck as a loose puck.
- **Poke check:** short-range swipe, which can knock the puck loose. Missing leaves you briefly off balance.
- **Stick lift / steal:** from behind or the side.
- **Deke/spin:** a burst move that can dodge a check or poke. It has a cooldown, and success depends on `puckHandling`.

**Goaltending**
- The goalie stays on an arc in front of the crease and **cuts down the angle**, positioned between the puck and the center of the net.
- Save logic: when a shot is on target, compute reaction time from goalie rating and shot speed and distance, then pick a save animation that matches the puck's arrival point. The save probability formula is roughly:
  ```
  saveChance = clamp(base(goalieRating) - shotQuality, 0.55, 0.97)
  shotQuality = f(shotSpeed, distance, angle, screened?, oneTimer?, rebound?, crossCrease?)
  ```
  Screened shots, one-timers, quick rebounds, and cross-crease passes are much harder to save.
- Goalies can **cover the puck** (freeze it), which means a faceoff in that zone.
- **Pull the goalie** option (a button combo) late in the game for an extra attacker.
- Optional **manual goalie control** toggle (default: AI).

### 6. Rules (togglable in Settings)

- **Teams on ice:** 5 skaters + 1 goalie per side (default). Optional **3-on-3 arcade mode**.
- **Periods:** 3 periods, adjustable length (2, 3, 5, or 20 minutes; default **3 minutes**), with a running game clock that stops on whistles. Intermission screens show stats.
- **Faceoffs:** start of each period, after goals, and after every stoppage, at the correct faceoff spot (the closest end-zone dot for icing, offside, or a frozen puck). Faceoff mini-game: the puck drops after a random delay of 0.3–1.0 s and pressing Pass/Shoot within the timing window wins it. A better timing window comes with a better faceoff rating, and early presses are a "faceoff violation" (the player is swapped out).
- **Offside:** on by default. An attacker can't enter the offensive zone ahead of the puck. Show a "delayed offside" linesman arm signal, and blow the whistle if the attacker touches the puck before tagging up.
- **Icing:** on by default (hybrid icing: the whistle goes when the defender is projected to reach the puck first). It isn't called while a team is shorthanded. The faceoff goes back to the offending team's end, and the offending team can't change lines.
- **Penalties** (on by default, frequency slider): tripping, hooking, slashing, roughing, interference, high-sticking, delayed-game (puck over the glass). A **delayed penalty** shows the referee's raised arm and the team that drew it gets an extra attacker. Minor = 2:00 **power play**, and it ends early if the power-play team scores. Show the penalty box and a timer in the HUD.
- **Overtime:** in regular season games, **5-minute 3-on-3 sudden death**, then a **shootout** (best of 3, then sudden death). In playoffs, **20-minute 5-on-5 sudden-death periods** until someone scores.
- **Shootout mini-game:** the shooter skates in alone from center and can deke or shoot. In the player's goalie turn, they control the goalie's lateral movement and save button.
- **Scoring:** 2 points for a win, 1 point for an overtime or shootout loss, 0 for a regulation loss (NHL standings rules).

### 7. AI

Build the AI as a lightweight **state machine per skater** plus a **team tactics layer**.

- **Team states:** `OFFENSE`, `DEFENSE`, `TRANSITION`, `LOOSE_PUCK`, `POWER_PLAY`, `PENALTY_KILL`.
- **Roles:** C, LW, RW, LD, RD, G. Each role has **formation anchor points** for each team state and puck zone (defensive, neutral, offensive). AI skaters steer toward their anchor point, shifted toward the puck.
- **Puck carrier AI:** each tick, score the options: *shoot* (scoring chance from the slot is good), *pass* (open teammate in a better spot, no defender in the lane), *carry* (open ice ahead), *dump in* (blocked at the blue line), or *clear* (under pressure in its own zone). Pick using weighted randomness so it isn't predictable.
- **Defensive AI:** the nearest player pressures the puck carrier, the second covers the passing lane or slot, the defensemen stay between the puck and the net, and players block shots by stepping into the lane.
- **Difficulty levels:** **Rookie / Pro / All-Star / Legend.** These scale AI reaction delay (300 ms down to 60 ms), pass accuracy, shot selection, checking aggressiveness, and goalie save bonus. Don't cheat with speed boosts at higher levels. Make the AI smarter instead.
- **Optional rubber-banding** (off by default) for casual mode.

### 8. Game modes

1. **Quick Play / Exhibition:** pick any two teams, home/away, period length, and difficulty.
2. **Versus (local 2-player):** same keyboard or 2 gamepads. Also **co-op** (both players on the same team vs. the CPU).
3. **Season:** pick a team, play a shortened schedule (e.g. 10, 20, or 41 games; other games are simulated from team ratings), track standings by division and conference, then playoffs.
4. **Playoffs:** the 16-team NHL format. The top 3 teams in each division plus 2 wild cards per conference make it, and every round is best-of-7 (best-of-1, best-of-3, or best-of-5 can be chosen in settings). The winner lifts a pixel championship cup (generic name: "The Pixel Cup", so it isn't Stanley Cup branding).
5. **Shootout Challenge:** pure shootout mini-game, endless or best-of-5.
6. **Practice:** free skate with no opponents and a toggle for goalie, cones, and passing targets.

### 9. NHL teams data (all 32 clubs, 2025–26 alignment)

Put this in `src/data/teams.ts`. Colors are hex approximations of each club's identity. Ratings are **fictional** game balance values (1–99) for offense (OFF), defense (DEF), and goaltending (GOA). Tune them as you like. Use **fictional player names** generated per team (e.g. "J. Kowalski #19") instead of real players, because real player names and likenesses need NHLPA licensing.

```ts
export type Conference = 'Eastern' | 'Western';
export type Division = 'Atlantic' | 'Metropolitan' | 'Central' | 'Pacific';

export interface Team {
  abbr: string; city: string; name: string;
  conference: Conference; division: Division;
  primary: string; secondary: string; accent: string; // jersey, trim, numbers
  off: number; def: number; goa: number;
}

export const TEAMS: Team[] = [
  // ── EASTERN CONFERENCE ─ Atlantic Division ──
  { abbr:'BOS', city:'Boston',       name:'Bruins',          conference:'Eastern', division:'Atlantic',     primary:'#FFB81C', secondary:'#000000', accent:'#FFFFFF', off:80, def:84, goa:86 },
  { abbr:'BUF', city:'Buffalo',      name:'Sabres',          conference:'Eastern', division:'Atlantic',     primary:'#003087', secondary:'#FFB81C', accent:'#FFFFFF', off:79, def:76, goa:78 },
  { abbr:'DET', city:'Detroit',      name:'Red Wings',       conference:'Eastern', division:'Atlantic',     primary:'#CE1126', secondary:'#FFFFFF', accent:'#000000', off:80, def:77, goa:79 },
  { abbr:'FLA', city:'Florida',      name:'Panthers',        conference:'Eastern', division:'Atlantic',     primary:'#C8102E', secondary:'#041E42', accent:'#B9975B', off:88, def:87, goa:85 },
  { abbr:'MTL', city:'Montréal',     name:'Canadiens',       conference:'Eastern', division:'Atlantic',     primary:'#AF1E2D', secondary:'#192168', accent:'#FFFFFF', off:82, def:77, goa:80 },
  { abbr:'OTT', city:'Ottawa',       name:'Senators',        conference:'Eastern', division:'Atlantic',     primary:'#C52032', secondary:'#000000', accent:'#C2912C', off:81, def:79, goa:81 },
  { abbr:'TBL', city:'Tampa Bay',    name:'Lightning',       conference:'Eastern', division:'Atlantic',     primary:'#002868', secondary:'#FFFFFF', accent:'#000000', off:87, def:82, goa:88 },
  { abbr:'TOR', city:'Toronto',      name:'Maple Leafs',     conference:'Eastern', division:'Atlantic',     primary:'#00205B', secondary:'#FFFFFF', accent:'#FFFFFF', off:88, def:80, goa:81 },

  // ── EASTERN CONFERENCE ─ Metropolitan Division ──
  { abbr:'CAR', city:'Carolina',     name:'Hurricanes',      conference:'Eastern', division:'Metropolitan', primary:'#CE1126', secondary:'#000000', accent:'#A2AAAD', off:85, def:89, goa:82 },
  { abbr:'CBJ', city:'Columbus',     name:'Blue Jackets',    conference:'Eastern', division:'Metropolitan', primary:'#002654', secondary:'#CE1126', accent:'#A4A9AD', off:80, def:76, goa:78 },
  { abbr:'NJD', city:'New Jersey',   name:'Devils',          conference:'Eastern', division:'Metropolitan', primary:'#CE1126', secondary:'#000000', accent:'#FFFFFF', off:85, def:82, goa:82 },
  { abbr:'NYI', city:'New York',     name:'Islanders',       conference:'Eastern', division:'Metropolitan', primary:'#00539B', secondary:'#F47D30', accent:'#FFFFFF', off:77, def:80, goa:84 },
  { abbr:'NYR', city:'New York',     name:'Rangers',         conference:'Eastern', division:'Metropolitan', primary:'#0038A8', secondary:'#CE1126', accent:'#FFFFFF', off:83, def:78, goa:89 },
  { abbr:'PHI', city:'Philadelphia', name:'Flyers',          conference:'Eastern', division:'Metropolitan', primary:'#F74902', secondary:'#000000', accent:'#FFFFFF', off:79, def:78, goa:77 },
  { abbr:'PIT', city:'Pittsburgh',   name:'Penguins',        conference:'Eastern', division:'Metropolitan', primary:'#000000', secondary:'#FCB514', accent:'#FFFFFF', off:81, def:75, goa:77 },
  { abbr:'WSH', city:'Washington',   name:'Capitals',        conference:'Eastern', division:'Metropolitan', primary:'#C8102E', secondary:'#041E42', accent:'#FFFFFF', off:85, def:83, goa:83 },

  // ── WESTERN CONFERENCE ─ Central Division ──
  { abbr:'CHI', city:'Chicago',      name:'Blackhawks',      conference:'Western', division:'Central',      primary:'#CF0A2C', secondary:'#000000', accent:'#FFFFFF', off:76, def:72, goa:76 },
  { abbr:'COL', city:'Colorado',     name:'Avalanche',       conference:'Western', division:'Central',      primary:'#6F263D', secondary:'#236192', accent:'#A2AAAD', off:90, def:84, goa:82 },
  { abbr:'DAL', city:'Dallas',       name:'Stars',           conference:'Western', division:'Central',      primary:'#006847', secondary:'#8F8F8C', accent:'#FFFFFF', off:86, def:86, goa:86 },
  { abbr:'MIN', city:'Minnesota',    name:'Wild',            conference:'Western', division:'Central',      primary:'#154734', secondary:'#A6192E', accent:'#EAAA00', off:83, def:83, goa:81 },
  { abbr:'NSH', city:'Nashville',    name:'Predators',       conference:'Western', division:'Central',      primary:'#FFB81C', secondary:'#041E42', accent:'#FFFFFF', off:78, def:77, goa:84 },
  { abbr:'STL', city:'St. Louis',    name:'Blues',           conference:'Western', division:'Central',      primary:'#002F87', secondary:'#FCB514', accent:'#FFFFFF', off:79, def:79, goa:82 },
  { abbr:'UTA', city:'Utah',         name:'Mammoth',         conference:'Western', division:'Central',      primary:'#71AFE5', secondary:'#090909', accent:'#FFFFFF', off:82, def:80, goa:80 },
  { abbr:'WPG', city:'Winnipeg',     name:'Jets',            conference:'Western', division:'Central',      primary:'#041E42', secondary:'#004C97', accent:'#AC162C', off:85, def:84, goa:92 },

  // ── WESTERN CONFERENCE ─ Pacific Division ──
  { abbr:'ANA', city:'Anaheim',      name:'Ducks',           conference:'Western', division:'Pacific',      primary:'#F47A38', secondary:'#000000', accent:'#B9975B', off:79, def:76, goa:80 },
  { abbr:'CGY', city:'Calgary',      name:'Flames',          conference:'Western', division:'Pacific',      primary:'#C8102E', secondary:'#F1BE48', accent:'#FFFFFF', off:77, def:79, goa:82 },
  { abbr:'EDM', city:'Edmonton',     name:'Oilers',          conference:'Western', division:'Pacific',      primary:'#041E42', secondary:'#FF4C00', accent:'#FFFFFF', off:92, def:81, goa:79 },
  { abbr:'LAK', city:'Los Angeles',  name:'Kings',           conference:'Western', division:'Pacific',      primary:'#111111', secondary:'#A2AAAD', accent:'#FFFFFF', off:81, def:86, goa:82 },
  { abbr:'SEA', city:'Seattle',      name:'Kraken',          conference:'Western', division:'Pacific',      primary:'#001628', secondary:'#99D9D9', accent:'#E9072B', off:78, def:77, goa:78 },
  { abbr:'SJS', city:'San Jose',     name:'Sharks',          conference:'Western', division:'Pacific',      primary:'#006D75', secondary:'#EA7200', accent:'#000000', off:76, def:71, goa:75 },
  { abbr:'VAN', city:'Vancouver',    name:'Canucks',         conference:'Western', division:'Pacific',      primary:'#00205B', secondary:'#00843D', accent:'#FFFFFF', off:80, def:80, goa:85 },
  { abbr:'VGK', city:'Vegas',        name:'Golden Knights',  conference:'Western', division:'Pacific',      primary:'#B4975A', secondary:'#333F42', accent:'#C8102E', off:86, def:85, goa:83 },
];
```

**Team usage requirements:**
- Every team has a **home jersey** (primary body, secondary trim) and an **away jersey** (white body, primary trim). If both teams' jerseys are too similar, automatically switch the away team to its alternate (compare color distance in Lab space; use ΔE < 25 as the threshold).
- **Team select screen:** a grid of 32 pixel crests (original designs from abbreviation + colors), grouped by conference and division, with OFF/DEF/GOA bars and a big pixel skater preview in that team's jersey.
- Rosters: generate 12 F, 6 D, and 2 G per team with fictional names, numbers, and attributes spread around the team's OFF/DEF/GOA ratings. Use a seeded RNG so rosters are the same every time.
- **Pixel goal horn and goal song:** a generic 8-bit horn plus a short 4-bar chiptune jingle, with the pitch/key varied per team so each team feels different.
- Add a **disclaimer** on the title screen and in the README: *"Fan-made, non-commercial game. Not affiliated with or endorsed by the NHL or its teams. NHL and team names are trademarks of their respective owners."*

### 10. HUD and UI

- **Scoreboard (top center):** `[BOS crest] BOS 2 – 1 TOR [crest] | 2nd | 1:47`, plus a power-play indicator (`PP 1:12`) and a shots counter.
- **Bottom-left:** controlled player name and number, and a stamina bar.
- **Shot power meter** over the shooter while charging.
- **Mini-map (optional, toggle):** a small rink outline in a corner with dots for all players and the puck.
- **Goal sequence:** freeze for 0.3 s, then a big pixel "GOAL!" banner sliding in with the team's colors, the goal horn, crowd flashing, the scorer's name + assists, and an **instant replay** (keep a 5-second ring buffer of game state and play it back at 0.5× speed with a "REPLAY" tag; skippable).
- **Referee/linesman sprites** that skate around and make signals (offside, icing wash-out, penalty arm).
- **Intermission screen:** shots, faceoff %, hits, power play (e.g. 1/3), time on attack, and 3 stars of the game after the final.
- **Menus:** fully navigable by keyboard, gamepad, and touch, with a blinking selection cursor and menu "blip" sounds.
- **Title screen:** animated pixel arena, a Zamboni driving across the ice, "PIXEL HOCKEY" logo, and "PRESS START".
- **Settings:** period length, difficulty, rules toggles (offside, icing, penalties), line changes auto/manual, camera speed, screen shake on/off, CRT scanline filter on/off (a subtle overlay), master/SFX/music volume, controls remapping, and reset save data.

### 11. Audio (procedural chiptune)

- SFX: skate scrape (filtered noise, looped while moving fast), stick-on-puck "tock", pass, wrist shot "snap", slap shot "CRACK", post "PING", glass/board "THUD", body check "BOOM", whistle (two quick square-wave tones), goal horn (low sawtooth chord, 1.5 s), crowd roar (swelling noise), and a menu blip.
- Music: a short looping chiptune for menus and intermissions; organ-style "charge!" stings during play, triggered at random on offensive pressure.

### 12. Performance and quality

- Steady **60 FPS** on a mid-range phone. Avoid allocating memory in the hot loop (pool particles and vectors).
- All gameplay code is **deterministic** given a seed (helps with replays and debugging).
- **Pause on tab blur** (`visibilitychange`).
- Accessibility: a colorblind-friendly option (adds a shape marker under each team's skaters: circle vs. square), remappable keys, and adjustable game speed (75%/100%).
- Include unit tests (Vitest) for: puck–board collision, offside detection, icing detection, the standings point calculation, and the playoff seeding algorithm.

### 13. Deliverables and acceptance criteria

The game is done when:
1. `npm install && npm run dev` launches it, and `npm run build` produces a static `dist/` that runs from any static host.
2. A full 3-period exhibition can be played between **any two of the 32 NHL teams**, with faceoffs, passing, one-timers, shooting, checking, goalie saves, rebounds, offside, icing, penalties, power plays, overtime, and a shootout all working.
3. Keyboard, gamepad, and touch controls all work. 2-player local versus works.
4. Season mode tracks standings by division with NHL points rules and leads into a 16-team playoff bracket.
5. The game looks like a cohesive 16-bit pixel art game at every integer scale, with team colors correctly applied to jerseys, crowd, and menus.
6. No console errors. It runs at 60 FPS. Settings and season progress persist across reloads.
7. A `README.md` explains controls, modes, how to run and deploy, and includes the non-affiliation disclaimer.

**Build it in this order and make each step playable before moving on:**
1. Loop, scaling, input, and the rink drawing with the scrolling camera.
2. One controllable skater plus puck physics, board collisions, and shooting into an empty net.
3. Goalies and the save system.
4. 5v5 with basic AI, passing, switching, and faceoffs.
5. Checking, stamina, and line changes.
6. Rules: offside, icing, penalties, power play, periods, overtime, and shootout.
7. Teams data, palette-swapped jerseys, team select, and the HUD.
8. Audio, particles, goal celebration, and replay.
9. Season and playoffs, persistence, and settings.
10. Mobile touch controls, polish, tests, and the README.

Write clean, well-structured, commented code. When a design detail isn't specified here, choose whatever makes the game **more fun and readable**, in keeping with classic 16-bit hockey games.
