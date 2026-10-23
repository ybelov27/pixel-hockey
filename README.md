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
| Pass / Switch player | PASS / SWITCH | J or Z | A |
| Shoot (tap = wrist, hold = slap) / Body check | SHOOT / CHECK | K, X or Space | X or B |
| Deke / Poke check | DEKE / POKE | L or C | Y |
| Pause | II button | Esc or P | Start |

**Tips:**
- Press SHOOT while a pass is on its way to you for a **one-timer**.
- Hold up or down while shooting to pick a corner.
- On faceoffs, press PASS or SHOOT right when the puck drops.

## Features

- **Teams:** all 32 NHL clubs in their 2025-26 divisions, each with its real city, name and colors. Home teams wear their colors and away teams wear white.
- **Rink:** a 3/4-view rink built to NHL proportions (200 x 85 ft, 28 ft corners, real line and faceoff-dot positions), with boards, glass, fake sponsor ads, team benches and an animated crowd.
- **Rules:** faceoffs, offside, no-touch icing, and penalties (delayed calls, power plays, shorthanded play).
- **Game flow:** stamina, line changes, 3-on-3 overtime, shootouts, and a goal replay.
- **Goalies:** they play the angle, react to shots, give up rebounds, and freeze or pass the puck.
- **CPU difficulty:** four levels (Rookie, Pro, All-Star, Legend).
- **Season mode:** choose 10, 20, 41 or 82 games. Standings use NHL points, and the playoffs follow the NHL format (top 3 per division plus 2 wild cards per conference) with best-of-1, 3, 5 or 7 series, ending with the Pixel Cup.
- **Presentation:** procedural chiptune music and sound effects. There are no image or audio assets besides the app icons.

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

`dist/` is a fully static site that you can host anywhere (GitHub Pages, Netlify, Vercel, Cloudflare Pages). The included workflow (`.github/workflows/deploy.yml`) publishes to **GitHub Pages** on every push to `main` (or the current default branch). To turn it on, go to the repo's **Settings > Pages > Build and deployment > Source** and choose **GitHub Actions**. Home-screen install and offline mode require HTTPS, which all of these hosts provide.
