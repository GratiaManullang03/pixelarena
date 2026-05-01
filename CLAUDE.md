# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Start the server (serves static files + WebSocket relay on port 3001)
npm start
# or
node server.js

# Open in browser
# http://localhost:3001
# Share LAN IP printed in console to other players on same network
```

No test suite is configured (`npm test` is a placeholder).

## Architecture

PixelArena is a LAN-only multiplayer top-down shooter. The backend is a pure relay server; all game logic runs in the host's browser.

**Entry points:**
- **`server.js`** — Node.js HTTP + WebSocket relay. Broadcasts each message to all other clients in the same room. No game logic. Rooms are ephemeral `Map<roomCode, Set<WebSocket>>`.
- **`index.html`** — Static shell with screen divs. Loads `js/main.js` as an ES module.
- **`js/main.js`** — Bootstrap: creates canvas/context, caches DOM refs into `ui`, defines `show(screen)`, then calls init functions from other modules.
- **`style.css`** — Dark pixel aesthetic using CSS custom properties (`--bg`, `--accent`, etc.).

### js/ module map

| File | Role |
|---|---|
| `state.js` | Shared mutable singleton (`screen`, `room`, `isHost`, `myId`, `players`, `gameMode`, `spectating`). |
| `characters.js` | Static array of 12 character definitions (`baseHp`, `baseSpeed`, `ultName`, `ultCost`, `desc`). |
| `maps.js` | `MAPS[]` wall layouts, `ARENA` dimensions, `mulberry32` seeded RNG, `rectHit` collision helper. |
| `net.js` | WebSocket client. `connect(room, cb)`, `send(type, payload)`, `on(fn)`, `close()`, `id()`, `getLastSeen(peerId)`. |
| `input.js` | Keyboard/mouse state capture. `snapshotInput()` returns current input flags. |
| `mobile.js` | Touch joystick and ULT button overlays for mobile/landscape play. |
| `audio.js` | Web Audio API sound effects. |
| `lobby.js` | Lobby UI: avatar/character grid, player list render, ready/start button wiring. |
| `lobby-net.js` | Lobby networking: `enterLobby()`, `broadcastMe()`, `broadcastRoster()`, disconnect detection. |
| `game-loop.js` | `startMatch()`, `endMatch()`, `startGameLoop()`, `setupNetGameHandlers()`. The `requestAnimationFrame` loop lives here. |
| `countdown.js` | Pre-match countdown overlay. |

### js/engine/ — host-authoritative game engine

| File | Role |
|---|---|
| `game-engine.js` | Exports mutable arrays (`bullets`, `powerups`, `hpItems`, `firePads`, `turrets`, `killFeed`). `reset(seed)` initializes map. `hostTick(dt, now)` is the authoritative simulation step called only on the host. |
| `physics.js` | Wall array, `moveWithWalls()`, `findSpawn()`, `snapshotInput()` (sends client input to host). |
| `snapshot.js` | `buildSnapshot(now)` serializes world state. `applySnap(s)` deserializes on clients. Ring buffer with adaptive interpolation delay (~80ms). |
| `ult-engine.js` | `activateUlt(p, ch, now)` — per-character ultimate logic. `onKill()` — kill reward logic. |
| `particles.js` | Visual effects: `spawnMuzzle`, `spawnHit`, `spawnPickupFx`, `shake`, `floaters`, `tickParticles`. |
| `spawner.js` | `spawnPowerup()`, `spawnHpItem()` — random powerup/HP placement. |

### js/renderer/ — rendering

| File | Role |
|---|---|
| `renderer.js` | `draw(ctx, ...)` — main render call. Camera lerp (`cam`). Draws walls, bullets, powerups. |
| `draw-player.js` | Per-player draw: body, character sprite, shield, fire trail, shadow. |
| `draw-hud.js` | `updateHUD()` — HP bars, kill feed, timer, scoreboard. |
| `draw-powerup.js` | Powerup and HP item sprites. |

### Networking model

- **Host** calls `hostTick(dt, now)` every frame, sends `snap` messages (~20/s) to all peers.
- **Clients** send `input` messages (WASD + aim angle + shoot/ult flags) to host via `snapshotInput()` on each received snapshot.
- Client-side interpolation uses a 4-frame ring buffer in `snapshot.js` with adaptive delay.
- Message schema: `{ room, from, type, payload }`. Types: `hello`, `me`, `roster`, `start`, `input`, `snap`, `sfx`, `pickup`, `killfeed`, `spectator`, `end`.

### Game modes

`State.gameMode` is either `'classic'` (timed deathmatch) or `'survival'` (3 lives, last alive wins). Survival adds `livesLeft` and `isSpectator` fields to each player object. Spectating is tracked in `State.spectating`.

### Arena dimensions

Canvas: 1280×720 px viewport. World: 1800×1200 px (`ARENA`). Camera follows local player with lerp: `cam.x += (target.x - cam.x) * 0.12`.
