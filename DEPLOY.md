# Deploy ke Railway

Panduan lengkap untuk mendeploy Pixel Arena ke Railway agar bisa dimainkan teman dari mana saja tanpa harus satu WiFi.

---

## Persiapan: Apa yang perlu disiapkan

- Akun GitHub (gratis)
- Akun Railway — daftar di [railway.app](https://railway.app) pakai GitHub login
- Project ini sudah di-push ke GitHub (lihat langkah 1)

---

## Apakah perlu Docker?

**Tidak.** Railway mendeteksi Node.js secara otomatis dari `package.json`. Tidak perlu `Dockerfile`, tidak perlu mengatur path Docker, tidak perlu image apapun. Railway langsung jalankan `npm start` → `node server.js`.

---

## Langkah 1 — Push ke GitHub

Jika belum punya repo GitHub untuk project ini:

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/pixel-arena.git
git push -u origin main
```

Ganti `USERNAME` dengan username GitHub kamu.

Jika sudah punya repo, pastikan perubahan terbaru sudah di-push:

```bash
git add .
git commit -m "ready for railway deploy"
git push
```

---

## Langkah 2 — Buat Project di Railway

1. Buka [railway.app](https://railway.app) → login
2. Klik **New Project**
3. Pilih **Deploy from GitHub repo**
4. Izinkan Railway akses ke repo kamu → pilih repo `pixel-arena`
5. Railway langsung mulai build otomatis

Build selesai dalam ~30 detik. Status berubah jadi **Active**.

---

## Langkah 3 — Service yang Dibuat

Railway membuat **1 service** saja:

| Service | Tipe | Keterangan |
|---------|------|-----------|
| `pixel-arena` | Web Service (Node.js) | Menjalankan `server.js` — melayani file statis (HTML/CSS/JS) sekaligus WebSocket relay di path `/ws` |

Tidak ada database, tidak ada worker terpisah, tidak ada Redis. Satu service sudah cukup karena server ini stateless (room hanya ada di memory selama server hidup).

---

## Langkah 4 — Pengaturan Deploy

Railway mendeteksi otomatis, tapi pastikan pengaturan ini benar di dashboard Railway:

### Build & Start

| Setting | Nilai |
|---------|-------|
| **Build Command** | `npm install` (otomatis terdeteksi) |
| **Start Command** | `npm start` (otomatis dari `package.json`) |
| **Root Directory** | `/` (biarkan default, tidak perlu diubah) |
| **Watch Paths** | biarkan default |

Tidak perlu mengubah apapun secara manual — Railway membaca `package.json` dan menjalankan `"start": "node server.js"`.

### Domain

1. Di halaman service → tab **Settings** → bagian **Networking**
2. Klik **Generate Domain**
3. Kamu akan dapat URL seperti:
   ```
   https://pixel-arena-production.up.railway.app
   ```
4. URL ini yang dibagikan ke teman

---

## Langkah 5 — Environment Variables

Project ini **tidak membutuhkan** environment variable tambahan. Railway otomatis menginject satu variable:

| Variable | Diset oleh | Kegunaan |
|----------|-----------|---------|
| `PORT` | Railway (otomatis) | Port yang dipakai server. `server.js` sudah membaca ini via `process.env.PORT \|\| 3001` |

Tidak perlu menambahkan `.env` apapun di Railway dashboard.

---

## Langkah 6 — Verifikasi Deploy

Setelah deploy berhasil:

1. Buka URL Railway yang kamu dapat di browser
2. Harusnya muncul layar Pixel Arena
3. Klik **Host Game** → catat 5-digit room code
4. Kirim URL Railway ke teman → teman buka URL yang sama → klik **Join Game** → masukkan room code
5. Kalau berhasil join lobby, deploy sukses

Untuk cek log server jika ada masalah:
- Di Railway dashboard → klik service → tab **Logs**
- Harusnya terlihat: `Server berjalan di port XXXX` dan `Running on Railway. Share the Railway URL with friends.`

---

## Catatan: Free Tier Railway

Railway memberikan **$5 credit gratis per bulan**. Untuk server Node.js ringan seperti ini:

| Resource | Estimasi pemakaian |
|----------|--------------------|
| RAM | ~50–80 MB |
| CPU | sangat kecil (idle relay) |
| Estimasi biaya | ~$0.50–1.00/bulan |
| Sisa credit untuk main | ~$4–4.50/bulan |

Credit $5/bulan cukup untuk server ini hidup terus-menerus. Railway tidak mematikan server seperti Render (yang sleep setelah 15 menit idle).

---

## Troubleshooting

### Build gagal — "Cannot find module"
Pastikan `node_modules` tidak ada di dalam commit. Cek `.gitignore` sudah berisi `node_modules/`.

### App crash saat start
Buka tab **Logs** di Railway. Paling sering terjadi karena `PORT` tidak terbaca. Pastikan `server.js` baris 7 berbunyi:
```js
const PORT = process.env.PORT || 3001;
```

### Teman tidak bisa join
- Pastikan teman membuka **URL Railway yang sama** (bukan `localhost`)
- Pastikan room code diketik dengan benar (5 huruf kapital)
- Coba refresh dan host ulang — rooms hilang kalau server restart

### WebSocket gagal connect
Railway mendukung WebSocket secara native. Jika teman melihat "Disconnected" terus-menerus, kemungkinan browser mereka memblokir WebSocket (jarang terjadi). Coba browser lain (Chrome/Edge paling kompatibel).

---

## Deploy Ulang

Setiap kali kamu `git push` ke branch `main`, Railway otomatis build dan deploy ulang. Tidak perlu melakukan apapun di dashboard.

```bash
# Workflow sehari-hari
git add .
git commit -m "update"
git push
# Railway otomatis redeploy dalam ~30 detik
```
