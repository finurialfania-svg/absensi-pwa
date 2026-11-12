# HadirKu — PWA Absensi Mahasiswa

Aplikasi starter yang bisa langsung dikembangkan: React + TypeScript + Vite + Firebase Authentication + Cloud Firestore + PWA. Terdapat role admin dan mahasiswa, pembuatan sesi, kode sesi, presensi mahasiswa, rekap, pencarian, dan ekspor CSV.

## 1. Persiapan
- Install Node.js versi LTS: https://nodejs.org
- Install Visual Studio Code: https://code.visualstudio.com
- Buat project di https://console.firebase.google.com
- Aktifkan **Authentication → Sign-in method → Email/Password**
- Buat **Firestore Database** (production mode), lalu deploy rules dari file `firestore.rules`.

## 2. Jalankan di VS Code
Ekstrak ZIP, buka folder `absensi-mahasiswa-pwa` di VS Code, lalu buka Terminal:

```bash
npm install
```

Salin `.env.example` menjadi `.env` lalu isi konfigurasi Web App Firebase:
Firebase Console → Project settings → General → Your apps → Web app → SDK setup.

```bash
npm run dev
```
Buka alamat lokal yang ditampilkan Vite.

## 3. Membuat akun admin dengan aman
1. Daftarkan akun admin pertama melalui aplikasi (akun awal akan ber-role `student`).
2. Buka Firebase Console → Firestore Database → `users` → dokumen dengan ID UID akun tersebut.
3. Ubah field `role` dari `student` menjadi `admin`.
4. Logout lalu login kembali. Admin sekarang dapat membuat/menutup sesi, melihat rekap, menghapus sesi, dan mengubah role pengguna.
5. Untuk menjadikan mahasiswa sebagai admin tambahan, ubah role dokumen user melalui Firebase Console.

Jangan pernah menaruh kredensial Admin SDK atau service account di frontend. Role admin disimpan di Firestore dan perubahan role hanya dapat dilakukan admin/rules. Amankan akun admin dengan kata sandi kuat dan aktifkan MFA jika tersedia.

## 4. Deploy rules dan hosting Firebase (opsional)
```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore:rules
npm run build
firebase deploy --only hosting
```

## 5. Push ke GitHub
Buat repository kosong di GitHub, lalu dari terminal folder proyek:
```bash
git init
git add .
git commit -m "Initial HadirKu PWA"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```
Jangan commit `.env`. Sudah masuk `.gitignore`.

## 6. Deploy ke Vercel
1. Push repository ke GitHub.
2. Buka https://vercel.com → Add New → Project → Import repository.
3. Framework: Vite; Build command `npm run build`; Output directory `dist`.
4. Masukkan seluruh variabel dari `.env` ke **Project Settings → Environment Variables** (tanpa awalan `=`).
5. Deploy. Setiap push ke branch utama akan memicu deployment baru.

Firebase Authentication → Settings → Authorized domains: tambahkan domain `*.vercel.app`/domain custom yang digunakan (tambahkan domain spesifik yang ditampilkan Vercel).

## Fitur saat ini
- Daftar/login email dan password Firebase.
- Role admin/mahasiswa.
- Profil mahasiswa (nama dan NIM).
- Admin membuat sesi dengan kode unik dan batas waktu, serta mengaktifkan/menutup sesi.
- Mahasiswa mengisi kode sesi untuk check-in; satu mahasiswa hanya bisa absen sekali per sesi.
- Riwayat pribadi, rekap admin, pencarian, dan ekspor CSV.
- PWA installable dan service worker untuk aset aplikasi.

## Catatan penting sebelum dipakai resmi
Ini starter yang fungsional, bukan sistem anti-kecurangan tingkat tinggi. Kode sesi dapat dibagikan. Untuk presensi resmi, pertimbangkan QR dinamis, validasi lokasi/geofence, batas waktu yang divalidasi server, Cloud Functions untuk transaksi/validasi, audit log, dan kebijakan privasi. Jam browser mahasiswa tidak boleh dijadikan satu-satunya sumber waktu tepercaya. Periksa ulang rules sesuai kebutuhan kampus.
