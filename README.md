# Laboratory Monitoring System

Simple Laboratory Monitoring System using WebRTC (peer-to-peer) for live video/audio streaming and Socket.IO as signaling server. No database required. Configuration for labs stored in `config/labs.json`.

## Features

- Panel Lab (kiosk): auto camera + mic, auto connect, auto reconnect, status, preview
- Panel Ruang Kontrol (admin): login, dashboard, monitoring, live view, snapshot, record, fullscreen
- WebRTC peer-to-peer streaming (video/audio)
- Socket.IO used only for signaling
- No database; configs in `config/` and activity logs in-memory

## Struktur Proyek

lab-monitoring/
- server/
- config/
- public/
  - assets/
    - css/
    - js/
- package.json
- README.md

## Instalasi

1. Buka terminal di folder `lab-monitoring`.
2. Install dependensi:

```bash
cd lab-monitoring
npm install
```

## Menjalankan

### Opsi 1: Localhost (Development - Tanpa Certificate)

Jalankan server:

```bash
npm start
```

Akses dari komputer yang sama:
- Panel Lab: `http://localhost:3000/lab.html?id=LAB-B10`
- Panel Kontrol: `http://localhost:3000/control.html`

### Opsi 2: Network Access (Multiple Computers - Dengan HTTPS Certificate) ⭐ RECOMMENDED

Untuk mengakses panel lab dari komputer lain di network, Anda perlu HTTPS karena browser hanya mengizinkan akses kamera via HTTPS atau localhost.

**Langkah 1: Generate Certificate**

```bash
npm run generate-cert
```

Perintah ini akan membuat folder `certs/` dengan file:
- `certs/server.crt` 
- `certs/server.key`

**Langkah 2: Jalankan Server**

```bash
npm start
```

Perhatikan output, akan menampilkan:
```
🔐 SECURE Server running on https://0.0.0.0:3000
Local access: https://localhost:3000
Network access: https://192.168.1.6:3000
```

**Langkah 3: Akses dari Network**

Dari server Admin (192.168.1.6):
- Panel Kontrol: `https://192.168.1.6:3000/control.html`

Dari komputer Lab (192.168.1.11):
- Panel Lab: `https://192.168.1.6:3000/lab.html?id=LAB-B11`

**⚠️ Catatan:** Browser akan menampilkan warning karena certificate self-signed:
- **Chrome**: Klik "Advanced" → "Proceed to 192.168.1.6 (unsafe)"
- **Firefox**: Klik "Advanced" → "Accept the Risk and Continue"
- **Safari**: Klik "Show Details" → "Visit this website"

Setelah accept, browser akan mengingat dan tidak menampilkan warning lagi.

## Akses Kamera dari Multiple Computers

Jika Anda mendapatkan error **"Camera permission denied or not available"** saat mengakses dari komputer lain:

1. **Sudah generate certificate?**
   ```bash
   npm run generate-cert
   npm start
   ```

2. **Gunakan HTTPS, bukan HTTP:**
   - ❌ http://192.168.1.6:3000 (akan error)
   - ✅ https://192.168.1.6:3000 (akan berhasil)

3. **Pastikan firewall mengizinkan port 3000:**
   ```bash
   # Windows
   netsh advfirewall firewall add rule name="Lab Monitoring" dir=in action=allow protocol=tcp localport=3000
   
   # Linux
   sudo ufw allow 3000/tcp
   ```

## Konfigurasi

- `config/labs.json` — definisi lab (id, name, ip, location)
- `config/admin.json` — user admin (simple credential)

## Catatan

- Untuk operasi P2P yang andal, pastikan jaringan mengizinkan traffic WebRTC (STUN digunakan). Jika laboratorium dan ruang kontrol berada di jaringan berbeda dengan NAT, Anda mungkin membutuhkan TURN server untuk reliabilitas.
- Browser akan meminta izin kamera/mikrofon sekali; gunakan mode kiosk atau atur permission browser agar tidak diminta berulang.
