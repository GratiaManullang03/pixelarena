# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Start the server (serves static files + runs game logic on port 3001)
npm start
# or
node server.js

# Open in browser
# http://localhost:3001
# Share LAN IP printed in console to other players on same network
```

No test suite is configured (`npm test` is a placeholder).

## Architecture

PixelArena is an online/LAN multiplayer top-down shooter. The backend is **server-authoritative**: all game logic (physics, bullets, collision, ultimates) runs in `server.js` on Node.js. Clients only send input and render world snapshots.

```
Browser A ──► input ──┐
Browser B ──► input ──┼──► Node.js (hostTick per room at ~30 Hz) ──► snapshot to all
Browser C ──► input ──┘
```

**Entry points:**
- **`server.js`** — Node.js HTTP + WebSocket server. Maintains per-room game state, runs `hostTick` via `setInterval(33ms)`, broadcasts snapshots. Rooms: `Map<roomCode, { clients: Set<WebSocket>, state: roomState }>`.
- **`server/`** — Server-side game engine (Node.js CommonJS modules, no browser APIs).
- **`index.html`** — Static shell. Loads `js/main.js` as an ES module.
- **`js/main.js`** — Bootstrap: creates canvas/context, caches DOM refs into `ui`, defines `show(screen)`.
- **`style.css`** — Dark pixel aesthetic using CSS custom properties.

### server/ — server-side game engine (Node.js, CommonJS)

| File | Role |
|---|---|
| `game-engine.js` | `createRoomState()`, `resetRoom(state, seed)`, `hostTick(state, dt, now, broadcast, endCb)` — full authoritative simulation. |
| `physics.js` | `moveWithWalls(p, dt, walls)`, `findSpawn(walls)` — takes walls as parameter (no global state, safe for multiple rooms). |
| `snapshot.js` | `buildSnapshot(state, now)` — serializes world state for broadcast. |
| `ult-engine.js` | `activateUlt(state, p, ch, now, broadcast)`, `onKill(...)` — ultimate abilities. Audio replaced by `broadcast('sfx', ...)`. |
| `spawner.js` | `spawnPowerup(rng, walls, ...)`, `spawnHpItem(...)` — pickup placement. |
| `maps.js` | `MAPS[]`, `ARENA`, `mulberry32`, `rectHit` — verbatim copy of `js/maps.js`. |
| `characters.js` | `CHARACTERS[]` — verbatim copy of `js/characters.js`. |

### js/ module map (browser, ES modules)

| File | Role |
|---|---|
| `state.js` | Shared mutable singleton (`screen`, `room`, `myId`, `players`, `gameMode`, `spectating`). No `isHost`. |
| `characters.js` | Static array of 12 character definitions. |
| `maps.js` | `MAPS[]` wall layouts, `ARENA`, `mulberry32`, `rectHit`. |
| `net.js` | WebSocket client. Filters `from === '__server__'` messages through (server-sent). |
| `input.js` | Keyboard/mouse state. `snapshotInput()` returns current input flags. |
| `mobile.js` | Touch joystick overlays. |
| `audio.js` | Web Audio API sound effects. |
| `lobby.js` | Lobby UI. Any player can click Start (no host-only guard). |
| `lobby-net.js` | Lobby networking: `enterLobby()`, `broadcastMe()`. No `broadcastRoster` (server handles roster). |
| `game-loop.js` | `startMatch()`, `endMatch()`, `startGameLoop()`. All clients equal — no `isHost` branching. |
| `countdown.js` | Pre-match countdown overlay. |

### js/engine/ — client-side rendering helpers

| File | Role |
|---|---|
| `game-engine.js` | Client render arrays only (`bullets`, `powerups`, `hpItems`, `firePads`, `turrets`, `killFeed`, `pushKillFeed`). No simulation logic. |
| `physics.js` | `walls[]`, `setWalls()`, `moveWithWalls()`, `snapshotInput()`. Walls updated by `applySnap`. |
| `snapshot.js` | `applySnap(s)` deserializes server snapshots. Ring buffer interpolation (4 frames, adaptive 40–150ms delay). `matchEnd` converted from server `Date.now()` to local `performance.now()`. |
| `ult-engine.js` | **Unused by client** — all ult logic is on server. |
| `particles.js` | Visual effects: muzzle flash, hit sparks, floaters, camera shake. |
| `spawner.js` | **Unused by client** — pickup spawning is on server. |

### js/renderer/ — rendering

| File | Role |
|---|---|
| `renderer.js` | `draw(ctx, ...)` — main render. Camera lerp. Draws walls (from client `physics.walls`), bullets, powerups. |
| `draw-player.js` | Per-player sprite: body, character icon, shield, fire trail, shadow. |
| `draw-hud.js` | `updateHUD()` — HP bars, kill feed, timer, scoreboard, minimap. |
| `draw-powerup.js` | Powerup and HP item sprites. |

### Networking model

- **Server** runs `hostTick` per room at ~30 Hz via `setInterval`. Sends `snapshot` to all clients.
- **Clients** send `input` messages (WASD + aim + shoot/ult flags) every 33ms.
- Server broadcasts use `{ room, from: '__server__', type, payload }`. Client `net.js` accepts these (only drops `from === myId`).
- Client-side interpolation: 4-frame ring buffer with adaptive delay.
- Message types: `hello`, `me`, `roster`, `start`, `input`, `snapshot`, `shot`, `hit`, `sfx`, `pickup`, `killfeed`, `spectator`, `end`, `walls`.

### Game modes

`State.gameMode` is `'classic'` (3-minute deathmatch) or `'survival'` (3 lives, last alive wins).

### Arena dimensions

Canvas: 1280×720 px viewport. World: 1800×1200 px (`ARENA`). Camera lerp: `cam.x += (target.x - cam.x) * 0.12`.
