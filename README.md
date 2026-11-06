# Void Runner

A self-contained, no-build arcade survival game. Open `index.html` in a modern browser to play; no server, account, network access, or third-party assets are required.

## Play

- **Move:** WASD or arrow keys.
- **Dash:** Space or Shift. On touch screens, use the DASH button.
- **Nova:** Press E or tap NOVA when its charge meter is full to blast enemies and clear incoming shots.
- **Pause:** P, Escape, or the pause button. The game also pauses when the page is hidden.
- **Touch:** Use the on-screen joystick to move.
- **Sound:** Toggle with the music-note button. Audio starts only after a user gesture.

The ship automatically fires at the nearest enemy as soon as one appears; glowing laser trails and a muzzle flash make every shot visible. Keep a kill streak alive for up to an 8× score multiplier. Rare salvage and elite/boss drops offer a repair, temporary overdrive, or a damage-reducing shield. Collect energy to level up and choose an upgrade: expand your salvo, deploy orbiting gun drones, reinforce permanent armor, or improve your Nova reactor. Enemy spitters keep their distance and fire aimed shots; the Void Titan returns for escalating boss fights. Your best score is stored locally in this browser.

## Project structure

| Path | Purpose |
| --- | --- |
| `index.html` | Game markup, responsive styling, canvas renderer, simulation, input, and audio. Kept dependency-free for direct play. |
| `tests/game.test.cjs` | Node-based smoke and behavior tests using built-in test utilities and a small browser mock. |
| `package.json` | Private project metadata and the test command; no runtime or development dependencies. |

This is intentionally a client-only game rather than a SaaS platform. It has no REST API, authentication, server-side services, database, uploads, or background jobs. Adding those layers would increase operational and security risk without supporting the current gameplay.

## Run locally

1. Open `index.html` in a current desktop or mobile browser.
2. Optional: serve the folder locally with `python -m http.server 8000`, then visit `http://localhost:8000`.

## Test

Requires Node.js 18 or newer; there are no packages to install.

```sh
npm test
```

The tests cover initial launch, auto-fire, pause/resume behavior, background-tab pausing, Nova's enemy and projectile clearing, combo scoring and expiry, salvage collection, guaranteed elite drops, timed shields, and continued gameplay through upgrade selections. They use mocked browser APIs; they do not replace manual testing in target browsers or on physical touch devices.

## Security and privacy

- The game makes no network requests and loads no third-party code or assets.
- Persistent data is limited to the best score in `localStorage`; clearing site data resets it.
- The game does not collect accounts, personal information, or telemetry.
- HTML templates use fixed game-owned strings and numeric local state, not user-provided content.
- A static deployment needs only to serve these files over HTTPS. No credentials, secrets, database, or server configuration are required.

## Deployment

Publish `index.html` and the test/documentation files to any static HTTPS host. For production, configure the host to serve `index.html` as the default document, enable compression, and add security headers at the hosting layer. Since the page currently includes inline CSS and JavaScript, a strict Content Security Policy must allow inline assets or be introduced alongside a follow-up change that moves them into separate files. There is no migration or rollback procedure because the game has no server-side state; redeploy the previous static files to roll back.

## Known limitations

- The high score is per browser/device and is not synchronized.
- The canvas gameplay is visually rendered and has no screen-reader equivalent.
- The automated suite is a smoke test with mocked browser APIs; verify visuals, audio, and touch controls in actual browsers before a public release.
