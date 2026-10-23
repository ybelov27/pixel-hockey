# Pixel Hockey

A retro pixel-art ice hockey game for the web, with a chunky sports-game look inspired by classics like *Retro Bowl* and *NHL '94*. It has all 32 NHL teams, full seasons, NHL-format playoffs, shootouts and touch controls. Add it to your iPhone or iPad home screen and it runs full-screen like a native app, even offline.

> Fan-made, non-commercial game. Not affiliated with or endorsed by the NHL or its teams. NHL and team names are trademarks of their respective owners. Crests are original pixel designs, and all player names are fictional.

## Play on iPhone / iPad like an app

1. Open the game's URL in **Safari**.
2. Tap **Share**, then **Add to Home Screen**, then **Add**.
3. Launch it from the new icon. It opens full-screen with no browser bars, keeps your season saved, and works offline after the first launch.

Hold the device in landscape. In portrait the game asks you to rotate.

## Controls

| | Touch | Keyboard | Gamepad |
|---|---|---|---|
| Skate | Drag on the left half (push fully to sprint) | Arrows / WASD, Shift to sprint | Left stick, RT to sprint |
| Pass (tap) / Shoot (hold) / Switch player | PASS / SWITCH | Space, J or Z | A |
| Shoot (tap = wrist, hold = slap) / Body check | SHOOT / CHECK | K or X | X or B |
| Deke / Poke check | DEKE / POKE | L or C | Y |
| Pause | II button | Esc or P | Start |

**Tips:**
- Press SHOOT while a pass is on its way to you for a **one-timer**.
- Hold up or down while shooting to pick a corner.
- On faceoffs, press PASS or SHOOT right when the puck drops.

## Features

- **Teams:** all 32 NHL clubs in their 2025-26 divisions, each with its real city, name and colors. Home teams wear their colors and away teams wear white.
- **Rink:** a 3/4-view rink built to NHL proportions (200 x 85 ft, 28 ft corners, real line and faceoff-dot positions), with boards, glass, fake sponsor ads, team benches and an animated crowd.
- **Rules:** faceoffs, optional no-touch icing, and penalties (delayed calls, power plays, shorthanded play). There is no offside.
- **Game flow:** stamina, line changes, 3-on-3 overtime, shootouts, and a goal replay.
- **Goalies:** they play the angle, react to shots, give up rebounds, and freeze or pass the puck.
- **CPU difficulty:** four levels (Rookie, Pro, All-Star, Legend).
- **Practice mode:** skate in alone on a goalie (or an empty net) with no clock. A teammate returns every pass for one-timer practice; press PASS without the puck to call for it. A fresh puck arrives after every goal or save, and a tracker shows goals, shots on goal, bar downs and shooting %.
- **Online 1v1:** play a friend over the internet. One player taps **ONLINE 1V1 > CREATE ROOM** and shares the 5-letter code; the other taps **JOIN ROOM** and types it in. Each player controls their own team. The game runs on the host's device and streams to the guest over a direct peer-to-peer WebRTC connection. PeerJS's free public server only introduces the two devices, so the game needs no server of its own. Very strict networks (some schools and offices) can block peer-to-peer connections.
- **Fights:** every penalty is followed by a fight you control: gloves and sticks hit the ice, then you step in and out with left/right, punch (SHOOT), throw a heavy uppercut (DEKE), block (hold PASS) or duck (hold down). Punches only land in range, swings cost stamina, blocking then hitting back is a 1.6x COUNTER, and three clean hits in a row is a combo. Uppercuts can knock helmets off. Win by knockout or have more health when the linesmen skate in after 18 seconds; the losing team is rattled. There are at most 2 penalties, and so at most 2 fights, per game.
- **Living arena:** fans bob individually, do the wave around the bowl and jump up for shots and goals; the boards and glass flex when players or pucks slam into them, and a big hit or high slap shot can occasionally shatter the glass, which stops play for repairs.
- **Season mode:** choose 10, 20, 41 or 82 games. Standings use NHL points, and the playoffs follow the NHL format (top 3 per division plus 2 wild cards per conference) with best-of-1, 3, 5 or 7 series, ending with the Pixel Cup.
- **Easy Controls** (on by default): shots aim at the open corner, marked by a yellow SHOOT target on the net. Passes have no aim error, the puck is better protected, the defender nearest the puck is selected automatically, and first-time tips explain the controls. New players start on Rookie with icing off; every assist and rule can be changed in Settings.
- **Hockey moments:** BAR DOWN goals off the crossbar (any slap shot you charge past the halfway mark on the power meter is a guaranteed bar down, and 80% of other goals ring in off the bar too, with a metallic "ting", the net snapping and the crowd erupting), post-and-in goals, goal labels (top shelf, five hole, one-timer, shorty and more), slap-shot speed in MPH, "ROBBED!" saves, and hat tricks with hats thrown on the ice. Home goals in Detroit bring an octopus and in Florida bring plastic rats.
- **Arena:** a center-hung jumbotron with live score and goal animations, red goal lights behind each net, ice reflections and sheen, painted ice ads, banners, a catwalk light rig, fans holding signs, camera flashes, and an ice resurfacer at intermission.
- **Sound:** the goal horn and a goal song made from each team's name play for home goals only, as in NHL arenas. Away goals get a crowd groan. The home crowd also does "LET'S GO" organ-and-clap chants.
- **Presentation:** procedural chiptune music and sound effects. There are no image or audio assets besides the app icons.

## Using a real bar-down recording

The crossbar "ting" is synthesized by default. To use a real recording, add an audio file at **`public/sounds/bardown.mp3`** (`.m4a` and `.wav` also work). It plays for bar-down goals and crossbar hits. You can also add **`public/sounds/post.mp3`** for post hits; without it the bar-down file plays at a slightly lower pitch. Short clips (about 1-2 s, trimmed so the ping starts immediately) sound best. The easiest way to add one is on GitHub: open the repo, go to `public/sounds`, choose **Add file > Upload files**, then commit. The deploy workflow republishes the game automatically. Use a recording whose license allows it in a public project (CC0, or one with any required credit added below).

## Development

```bash
npm install
npm run dev       # local dev server (also reachable from your phone on the same Wi-Fi)
npm test          # unit + full-game simulation tests
npm run build     # static site in dist/
npm run icons     # regenerate the app icons
```

Tech: TypeScript, Vite and Canvas 2D at a low internal resolution, scaled up by whole numbers for crisp pixels. The fixed-timestep engine runs at 60 Hz. A generated service worker caches the game for offline play.

## Deploying

`dist/` is a fully static site that you can host anywhere. This repo publishes it to **GitHub Pages** at https://ybelov27.github.io/pixel-hockey/. The workflow in `.github/workflows/deploy.yml` builds the game on every push and force-pushes the build to the `gh-pages` branch, which Pages serves. Home-screen install and offline mode require HTTPS, which GitHub Pages provides.
