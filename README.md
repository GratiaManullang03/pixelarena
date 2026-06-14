# PIXEL ARENA

Online/LAN multiplayer top-down shooter for 2–8 players. Host on one machine, others join using a 5-character room code — works over the internet or on the same WiFi.

**Play online:** deploy to Railway in ~2 minutes (see [DEPLOY.md](DEPLOY.md)), or self-host with Docker on your own VPS (see [Docker](#docker) below).

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3001`. For LAN play, share the IP printed in the console. For internet play, deploy to Railway or self-host behind a domain.

## Docker

The server is fully containerized. Build and run:

```bash
docker build -t pixelarena .
docker run -d --name pixelarena --restart unless-stopped -p 3001:3001 pixelarena
```

The container listens on port `3001` (override with `-e PORT=...`). Behind a reverse proxy (e.g. nginx), forward both HTTP and the WebSocket upgrade to the container. Example nginx server block:

```nginx
server {
    server_name pixelarena.example.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

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

Works both LAN and internet. For internet play, deploy to Railway (see [DEPLOY.md](DEPLOY.md)) or self-host with [Docker](#docker). No database, no auth required.
