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

PixelArena is a LAN-only multiplayer top-down shooter. It has three files of substance:

- **`server.js`** — Node.js HTTP + WebSocket server. Pure relay: broadcasts each message to all other clients in the same room. No game logic lives here. Rooms are ephemeral `Map<roomCode, Set<WebSocket>>`.
- **`game.js`** — All game logic, UI, and rendering in a single browser-side file (~1400+ LOC). Structured as IIFE modules assigned to constants.
- **`index.html`** — Static shell with screen divs; `game.js` drives all transitions.
- **`style.css`** — Dark pixel aesthetic using CSS custom properties (`--bg`, `--accent`, etc.).

### game.js module structure

| Module | Role |
|---|---|
| `Net` | WebSocket client. Handles connect/reconnect, room join, message relay. Assigns a random `me` ID per session. |
| `CHARACTERS[]` | Static definitions: 12 characters with `baseHp`, `baseSpeed`, `ultName`, `ultCost`. No logic here. |
| `State` | Shared mutable singleton: current screen, room code, `isHost` flag, `players` map keyed by Net ID. |
| `ui` | DOM ref cache — all `getElementById` calls are here. |
| `Game` | IIFE containing the entire game engine: map/wall data, bullet/particle/powerup arrays, input handling, host tick loop, renderer, snapshot serialization. |
| `Audio` | Web Audio API sound effects. |

### Networking model — host-authoritative

- **Host** runs `hostTick(dt, now)` every frame: moves all players, resolves bullet collisions, applies powerups, tracks kills and match timer. Sends `snap` messages (~20/s) to all peers.
- **Clients** send `input` messages (WASD + aim angle + shoot/ult flags) back to host on each received snapshot via `snapshotInput()`.
- **`buildSnapshot(now)`** serializes full world state (players, bullets, powerups, walls, turrets, firePads). **`applySnap(s)`** deserializes it on client side.
- Messages schema: `{ room, from, type, payload }`. Types used: `hello`, `me`, `roster`, `start`, `input`, `snap`, `sfx`, `pickup`, `killfeed`, `end`.

### Lobby flow

1. Host clicks "Host Game" → generates 5-char room code → `enterLobby()` → `Net.connect()`.
2. Joiner enters code → same `enterLobby()` path with `isHost = false`.
3. Players broadcast `me` (name/avatar/ready) every 1.2s; host re-broadcasts full `roster` to sync late joiners.
4. Host clicks "Start Match" (enabled when ≥2 players all ready) → sends `start` with seed + map index → all clients call `Game.start()`.

### Map system

`MAPS[]` inside `Game` defines named wall layouts (e.g. "FORTRESS", "CROSSROADS"). `reset(seed)` picks a map, places walls, and finds valid spawn points using `findSpawn()`. The `mulberry32` seeded RNG ensures deterministic map generation from the same seed across all clients.

### Character ultimates

Each of the 12 characters has a unique ult activated by `[Q]`. Logic lives in `activateUlt(p, ch, now)` inside `hostTick`. Ult energy (`mp`) charges on damage dealt. Examples: TANK gets a shield, BLITZ teleports forward, WARDEN deploys an auto-targeting turret entity.

### Arena dimensions

Canvas: 1280x720 px viewport. World: 1800x1200 px (`ARENA`). Camera follows local player with lerp (`cam.x += (me.x - cam.x) * 0.12`).
