# PIXEL ARENA

LAN multiplayer top-down shooter for 2–8 players. Host on one machine, others join from the same WiFi using a 5-character room code.

## Run

```bash
npm install
npm start
```

Open `http://localhost:3001` in a browser. Share the LAN IP printed in the console to other players on the same network.

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

Pure LAN — no internet required. The Node.js server is a dumb WebSocket relay; all game logic runs in the host's browser. Clients send input, host sends snapshots at ~20/s.
