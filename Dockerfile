# PixelArena — server-authoritative multiplayer shooter (Node.js + ws)
FROM node:20-alpine

# Jalankan sebagai non-root
ENV NODE_ENV=production
WORKDIR /app

# Install deps dulu (manfaatkan layer cache — hanya re-install kalau lockfile berubah)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy sisa source
COPY . .

# Server bind 0.0.0.0 dan baca process.env.PORT (default 3001)
ENV PORT=3001
EXPOSE 3001

# node:alpine sudah punya user "node" non-root
USER node

CMD ["node", "server.js"]
