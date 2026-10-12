troubleshooting.md - Guide Troubleshooting Laboratory Monitoring System

## ❌ Error: "Camera permission denied or not available"

### Penyebab
Browser modern tidak mengizinkan akses kamera dari HTTP non-localhost. Hanya diizinkan untuk:
- `http://localhost:3000` ✅
- `https://192.168.x.x:3000` ✅ (dengan HTTPS)
- `http://192.168.x.x:3000` ❌ (HTTP dari network = DITOLAK)

### Solusi

**Langkah 1: Generate HTTPS Certificate**

```bash
npm run generate-cert
```

Output akan menunjukkan:
```
✅ Certificate generated successfully!

📝 Files created:
  ✓ certs/server.crt
  ✓ certs/server.key
```

**Langkah 2: Start Server**

```bash
npm start
```

Server akan menunjukkan:
```
🔐 SECURE Server running on https://0.0.0.0:3000
Network access: https://192.168.1.6:3000
```

**Langkah 3: Gunakan HTTPS URL**

- ❌ JANGAN: `http://192.168.1.6:3000/lab.html`
- ✅ HARUS: `https://192.168.1.6:3000/lab.html`

### Jika Tetap Error

1. **Browser cache?**
   - Bersihkan cache: Ctrl+Shift+Delete
   - Reload halaman: Ctrl+Shift+R (Hard Refresh)

2. **Certificate error?**
   - Buka console (F12)
   - Lihat pesan error spesifik
   - Jika certificate error, delete folder `certs/` dan jalankan:
     ```bash
     npm run generate-cert
     npm start
     ```

3. **Firewall blocking?**
   ```bash
   # Windows - Buka PowerShell as Admin
   netsh advfirewall firewall add rule name="Lab Monitoring 3000" dir=in action=allow protocol=tcp localport=3000
   
   # Linux
   sudo ufw allow 3000/tcp
   
   # macOS
   sudo pfctl -f /etc/pf.conf  # atau gunakan System Preferences > Security & Privacy
   ```

4. **Perangkat tidak punya kamera?**
   - Pastikan perangkat lab punya USB camera atau built-in webcam
   - Check di Settings > Privacy & Security > Camera

---

## ❌ Error: "OpenSSL not found"

### Solusi untuk Windows

1. **Install Git Bash** (includes OpenSSL):
   - Download: https://gitforwindows.org/
   - Install dengan default settings
   - Buka "Git Bash" dan jalankan:
     ```bash
     npm run generate-cert
     ```

2. **Atau Install Win64OpenSSL**:
   - Download: https://slproweb.com/products/Win32OpenSSL.html
   - Install "Win64OpenSSL-3_x_x" (pilih tidak untuk develop libraries)
   - Add to PATH saat install
   - Buka terminal baru dan jalankan:
     ```bash
     npm run generate-cert
     ```

### Solusi untuk macOS

```bash
brew install openssl
npm run generate-cert
```

### Solusi untuk Linux

```bash
sudo apt-get install openssl
npm run generate-cert
```

---

## ❌ Browser Warning "Your connection is not private"

### Penjelasan
Browser menunjukkan warning karena certificate self-signed (bukan dari Certificate Authority).
Ini NORMAL dan AMAN untuk penggunaan lokal/network pribadi.

### Cara Melanjutkan

**Chrome/Edge:**
1. Klik "Advanced"
2. Klik "Proceed to 192.168.1.6 (unsafe)"
3. Browser akan mengingat untuk akses berikutnya

**Firefox:**
1. Klik "Advanced"
2. Klik "Accept the Risk and Continue"
3. Browser akan mengingat untuk akses berikutnya

**Safari:**
1. Klik "Show Details"
2. Klik "Visit this website"

---

## ❌ Error: "Server tidak dapat diakses dari komputer lain"

### Debug Langkah-langkah

1. **Pastikan server running:**
   ```bash
   npm start
   ```
   
   Harus menampilkan:
   ```
   🔐 SECURE Server running on https://0.0.0.0:3000
   Network access: https://192.168.1.6:3000
   ```

2. **Test dari komputer yang sama dulu:**
   ```
   https://localhost:3000
   ```
   Jika ini berhasil, masalahnya adalah network/firewall.

3. **Check IP address:**
   
   Windows:
   ```bash
   ipconfig
   ```
   Cari "IPv4 Address" di section yang benar (bukan Virtual)

   Linux/Mac:
   ```bash
   ifconfig
   # atau
   hostname -I
   ```

4. **Test koneksi jaringan:**
   
   Dari komputer lain, test ping:
   ```bash
   ping 192.168.1.6
   ```
   
   Jika reply = jaringan OK
   Jika timeout = check firewall/network

5. **Open firewall:**
   
   Windows:
   ```bash
   netsh advfirewall firewall add rule name="Lab Monitoring" dir=in action=allow protocol=tcp localport=3000
   ```
   
   Linux:
   ```bash
   sudo ufw allow 3000/tcp
   ```
   
   macOS:
   ```bash
   # System Preferences > Security & Privacy > Firewall Options
   # Atau enable Allow app downloaded from anywhere
   ```

---

## ❌ Microphone/Audio tidak bekerja

### Solusi

1. **Izin browser:**
   - Chrome/Firefox: Settings > Privacy > Permissions > Microphone > Allow
   - Pastikan lab.html dan control.html dalam allowed list

2. **Perangkat audio:**
   - Cek Settings > Sound > Input devices
   - Pastikan ada microfone yang connected dan enabled
   - Test microphone di Settings

3. **Socket.IO tidak terhubung:**
   - Buka Console (F12) > Console tab
   - Lihat apakah ada koneksi error
   - Coba refresh halaman

---

## ❌ Warning Console: "Connecting to ... com.chrome.devtools.json violates Content Security Policy default-src 'none'"

### Penyebab
Pesan ini muncul di Console saat Anda membuka **Chrome DevTools (F12)**. 
Google Chrome otomatis mencoba mencari konfigurasi workspace/devtools di URL `/.well-known/appspecific/com.chrome.devtools.json`. 

Secara default di Express.js, request ke URL yang tidak ada menghasilkan respon **404 Not Found** dengan header bawaan Express `Content-Security-Policy: default-src 'none'`. Karena Chrome menganggap ini pemblokiran CSP, Chrome menampilkan warning merah di console. 

> **Catatan:** Peringatan ini **TIDAK merusak aplikasi** dan tidak mempengaruhi streaming kamera/WebRTC sama sekali.

### Solusi
Tambahkan endpoint khusus di `server/index.js` untuk merespons probe Chrome DevTools dengan status `204 No Content`:

```javascript
// Silence Chrome DevTools automatic probe (prevents CSP 404 console noise)
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.status(204).end();
});
```

Setelah itu:
1. **Restart server:** Tekan `Ctrl + C` di terminal, lalu jalankan kembali `npm run dev` atau `npm start`.
2. **Hard Refresh browser:** Tekan `Ctrl + Shift + R` pada browser. Peringatan tersebut akan hilang.

---

## ✅ Checklist untuk Network Setup

- [ ] Server running: `npm start`
- [ ] HTTPS enabled: Output menunjukkan "🔐 SECURE"
- [ ] Certificate exists: Folder `certs/` ada dengan 2 file
- [ ] Network IP correct: Gunakan IP yang ditampilkan server
- [ ] Firewall port 3000 open: Ping berhasil dari komputer lain
- [ ] HTTPS URL yang benar: `https://192.168.1.x:3000`
- [ ] Browser warning: Accept/Proceed
- [ ] Camera permission: Browser ask consent
- [ ] Microphone permission: Browser ask consent
- [ ] Refresh hard (Ctrl+Shift+R): Clear cache

---

Jika masih ada masalah, check console browser (F12) untuk error messages spesifik.
