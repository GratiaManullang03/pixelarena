# PIXEL ARENA

Online/LAN multiplayer top-down shooter for 2–8 players. Host on one machine, others join using a 5-character room code — works over the internet or on the same WiFi.

**Play online:** deploy to Railway in ~2 minutes, no Docker needed. See [DEPLOY.md](DEPLOY.md).

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3001`. For LAN play, share the IP printed in the console. For internet play, deploy to Railway and share the Railway URL.

## Controls

| Action   | Keyboard          | Mobile (landscape)  |
| -------- | ----------------- | ------------------- |
| Move     | `WASD`            | Left joystick       |
| Aim      | Mouse             | Right joystick      |
| Shoot    | Left click / hold | Right joystick hold |
| Ultimate | `Q`               | ULT button          |

## Characters (12)

| Name     | HP  | Style                         |
| -------- | --- | ----------------------------- |
| TANK     | 150 | Slow, tough — piercing shots  |
| SNIPER   | 80  | One-shot power, long range    |
| BLITZ    | 90  | Fast spray-and-pray           |
| PHANTOM  | 100 | Bullets phase through walls   |
| BOMBER   | 100 | Shotgun spread (3-way burst)  |
| MEDIC    | 110 | Lifesteal on hit (+5 HP)      |
| ASSASSIN | 80  | Melee dagger — no projectile  |
| BRUTE    | 130 | Knockback shots               |
| GHOST    | 90  | Bullets pierce one player     |
| PYRO     | 95  | Passive fire trail            |
| WARDEN   | 115 | Turret ultimate               |
| REAPER   | 100 | Lifesteal 20% of damage dealt |

## Maps (5)

| Name       | Description                               |
| ---------- | ----------------------------------------- |
| FORTRESS   | Central stronghold with surrounding cover |
| CROSSROADS | Four-way intersection, open centre        |
| CORRIDORS  | Narrow chokepoints and flanking routes    |
| ARENA      | Open circle with scattered pillars        |
| MAZE       | Dense wall grid                           |

## Network

The Node.js server is **server-authoritative** — all game logic (physics, bullets, collisions, ultimates) runs on the server. Every client is equal: they send input, receive world snapshots at ~30 Hz, and render with client-side interpolation. Lag is independent of any player's connection quality.

Works both LAN and internet. For internet play, deploy to Railway (see [DEPLOY.md](DEPLOY.md)). No database, no auth, no Docker required.
