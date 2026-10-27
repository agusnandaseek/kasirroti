# RotiPOS

Web POS + pre-order untuk toko roti. Satu aplikasi, satu database, tiga area:

- **Publik** — pre-order tanpa akun dan pelacakan pesanan dengan kode 5 karakter.
- **Kasir** — terminal POS, antrean otomatis dengan prioritas manual, dan konfirmasi pre-order.
- **Admin** — dashboard, penjualan, pre-order, produk, karyawan, laporan (Excel/PDF), pengaturan.

Aplikasi ini **tidak** memakai payment gateway. Pembayaran tunai/QRIS manual dicatat oleh kasir di toko, dan omzet hanya dihitung dari pembayaran yang benar-benar tercatat.

---

## Stack

| Lapisan | Teknologi |
| --- | --- |
| Framework | Next.js 16.4.3 (App Router, Server Actions, `src/proxy.ts`) |
| UI | React 19, TypeScript, Tailwind CSS 4, gaya neobrutalism “Butter & Ink” |
| Database | Supabase (PostgreSQL, Auth, RPC) |
| Validasi | Zod 4 |
| Unit test | Vitest 5 |

Semua halaman bersifat dinamis (`force-dynamic`); tidak ada Cache Components dan tidak ada query Supabase langsung dari browser.

---

## Arsitektur & keamanan

- Browser hanya memanggil **Server Action** Next.js. Tidak ada tabel Supabase yang diekspos ke browser.
- Server memakai **service-role key** dan memvalidasi ulang setiap input. RLS aktif dengan default deny; akses `anon`/`authenticated` ke tabel dicabut.
- Operasi multi-tabel berjalan lewat RPC PostgreSQL atomik (`create_walkin_order`, `create_preorder`, `confirm_preorder`, `enqueue_preorder`, `record_manual_payment`, `prioritize_queue_order`, `clear_queue_priority`, `complete_order`, `report_cashiers`, `report_transactions`, dll.).
- RPC staf memanggil `assert_active_staff` sehingga pemanggilan langsung tetap ditolak bila bukan staf aktif.
- **FIFO default**: antrean yang tidak disentuh memakai urutan `queued_at ASC, created_at ASC, id ASC`. Pre-order hanya masuk antrean setelah kasir memanggil *Masukkan antrean*.
- **Prioritas antrean manual (opsional)**: kasir dapat menekan **Proses** pada pesanan `queued` mana pun. Bila belum ada pesanan aktif, pesanan itu langsung menjadi `preparing`. Bila sudah ada pesanan aktif, pesanan tersebut ditandai `queue_priority = true` dan menjadi pesanan berikutnya setelah pesanan aktif selesai — tanpa mengubah urutan FIFO pesanan lain. Hanya satu pesanan yang dapat bertanda prioritas; menandai pesanan lain memindahkan prioritas. Prioritas otomatis dibersihkan saat pesanan mulai diproses, dan dapat dibatalkan lewat **Batalkan**.
- **Satu pesanan aktif**: paling banyak satu order berstatus `preparing` atau `ready`. Pesanan baru masuk `queued`; bila tidak ada pesanan aktif, pesanan pertama otomatis dipromosikan ke `preparing`. Saat pesanan aktif selesai/dibatalkan, pesanan berprioritas dipromosikan lebih dulu, lalu FIFO. RPC produksi memakai advisory lock `rotipos_production_queue`, dan partial unique index menjadi pengaman terakhir di database.
- **Nama pemesan wajib** pada checkout walk-in maupun pre-order, sehingga kartu antrean kasir selalu punya nama yang bisa dipanggil. Halaman tracking tetap tidak menampilkan nama, email, atau nomor HP.
- **Pembayaran**: walk-in dibayar sebelum masuk antrean; pre-order dibayar saat pengambilan. `completed` hanya sah bila status sebelumnya `ready` dan pembayaran `paid`. Satu order maksimal satu pelunasan penuh.
- **Kode tracking**: 5 karakter dari alfabet tanpa huruf/angka ambigu (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`), diturunkan secara deterministik dari `HMAC-SHA256(TRACKING_TOKEN_PEPPER, "preorder:" + idempotencyKey + ":" + salt)`. Database hanya menyimpan `HMAC-SHA256` dari kode yang sudah dinormalisasi (`tracking_code_hash`) beserta `tracking_code_salt` untuk retry idempoten. Kode tidak dapat ditebak dari kode order, dan halaman tracking tidak menampilkan nama/email/nomor HP.
- **Kode lacak untuk staf**: halaman pre-order admin dan kasir menampilkan kode lacak 5 karakter (bukan kode order) dan tombol **Konfirmasi WhatsApp**. Tombol membuka `wa.me` dengan pesan berisi email pelanggan, kode lacak, rincian menu, dan tautan tracking. Kode diturunkan ulang di server dari `idempotency_key` + `tracking_code_salt`; kode mentah tetap tidak disimpan di database.
- **Laporan**: omzet dihitung dari `payments.paid_at`, bukan dari status pesanan. Harga modal opsional per produk disimpan sebagai `cost_price` dan di-snapshot ke `order_items.unit_cost` saat pesanan dibuat, sehingga laporan menampilkan **omzet dan keuntungan** yang stabil secara historis. Admin dapat mengekspor laporan ke **Excel (.xlsx)** dan **PDF** untuk rentang tanggal, satu hari, atau bulan tertentu, lengkap dengan transaksi dan keuntungan per kasir.
- **Idempotensi**: checkout walk-in dan pembuatan pre-order memakai idempotency key untuk mencegah pesanan ganda saat retry. Retry pre-order memakai salt yang tersimpan agar kode tracking tetap sama.
- **Rate limit**: pembuatan pre-order dan halaman tracking dibatasi lewat tabel `rate_limits` (fail-open bila infrastruktur limiter bermasalah).
- Semua waktu disimpan sebagai `timestamptz`; tampilan, slot, dan laporan memakai zona waktu toko (`Asia/Jakarta` secara default).
- Validasi slot dilakukan di server saat pre-order dibuat **dan** saat kasir mengonfirmasi.

---

## Prasyarat

- Node.js 20+ dan npm
- Docker Desktop (untuk Supabase lokal)
- Supabase CLI — dijalankan lewat `npx`, tidak perlu instal global

---

## Menjalankan secara lokal

```bash
npm install
```

### 1. Start Supabase lokal

```bash
npm run db:start
npm run db:status
```

`db:status` menampilkan API URL, anon key, dan service-role key. Studio lokal tersedia di `http://127.0.0.1:54323`.

### 2. Buat `.env.local`

```bash
# Windows PowerShell
Copy-Item .env.example .env.local
```

Isi nilainya:

| Variabel | Keterangan |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | API URL Supabase, lokal default `http://127.0.0.1:54321` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key dari `npm run db:status` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key — **rahasia, hanya server** |
| `NEXT_PUBLIC_APP_URL` | URL aplikasi, lokal `http://localhost:3000` |
| `TRACKING_TOKEN_PEPPER` | String acak minimal 32 karakter |

Buat pepper:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

> **Penting:** jangan mengganti `TRACKING_TOKEN_PEPPER` setelah ada pre-order. Semua kode tracking lama akan berhenti cocok karena database hanya menyimpan hash-nya.

### 3. Terapkan migrasi

```bash
npm run db:reset
```

Perintah ini menjalankan seluruh migrasi di `supabase/migrations/` dan membuat database lokal yang bersih. Tidak ada seed/demo data yang dimuat otomatis. Migrasi `20261026090000_manual_queue.sql` tetap ada di riwayat, tetapi digantikan oleh `20261026100000_priority_queue_reports_tracking.sql`. Untuk database yang sudah berisi data, jalankan `npm run db:push` atau `npx supabase migration up --local` agar migrasi baru diterapkan tanpa reset.

### 4. Buat admin pertama

Setelah database siap, buat akun admin pertama dengan service-role key:

```bash
# PowerShell
$env:ADMIN_EMAIL="admin@tokoanda.com"
$env:ADMIN_PASSWORD="password-yang-kuat"
$env:ADMIN_NAME="Nama Admin"
npm run bootstrap:admin

# macOS/Linux
ADMIN_EMAIL="admin@tokoanda.com" \
ADMIN_PASSWORD="password-yang-kuat" \
ADMIN_NAME="Nama Admin" \
npm run bootstrap:admin
```

Script ini membuat user Auth terkonfirmasi dan profil `admin` yang sesuai. Jika email sudah terdaftar, profilnya akan dipromosikan menjadi admin. Setelah itu, akun kasir dan admin lain dibuat dari halaman **Karyawan**.

### 5. Jalankan aplikasi

```bash
npm run dev
```

Buka `http://localhost:3000`.

---

## Halaman

### Publik

| Route | Fungsi |
| --- | --- |
| `/` | Landing page hero: CTA pre-order dan form lacak pesanan |
| `/preorder` | Form pre-order + kode order & kode lacak 5 karakter setelah submit |
| `/lacak` | Form untuk memasukkan kode lacak |
| `/track/[code]` | Status pesanan, progres, jadwal pickup, total |

### Kasir (butuh login)

| Route | Fungsi |
| --- | --- |
| `/cashier/pos` | Terminal walk-in: pilih produk, isi nama pemesan, bayar, masuk antrean |
| `/cashier/orders` | Kartu antrean ringkas (mobile-first), prioritas Proses/Batalkan, aksi status/pembayaran, dan hapus transaksi |
| `/cashier/preorders` | Konfirmasi/tolak pre-order, lihat kode lacak, kirim WhatsApp, dan masukkan ke antrean |

Navigasi kasir hanya berisi tiga menu tersebut.

### Admin (butuh login)

| Route | Fungsi |
| --- | --- |
| `/admin` | KPI hari ini, antrean, pre-order menunggu, produk terlaris |
| `/admin/sales` | Riwayat penjualan + filter tanggal/status/tipe/pencarian, dengan label kasir di tiap transaksi |
| `/admin/preorders` | Semua pre-order + filter jadwal pickup, kode lacak, dan tombol WhatsApp |
| `/admin/products` | Daftar produk ringkas (klik untuk detail), harga jual, harga modal opsional, dan ketersediaan |
| `/admin/employees` | Buat akun, ubah peran/status, proteksi admin terakhir |
| `/admin/reports` | Grafik omzet & keuntungan, transaksi per kasir yang dapat diklik, penanda kasir berkeuntungan tertinggi, produk terlaris, ekspor Excel/PDF |
| `/admin/settings` | Nama toko, zona waktu, jam buka, slot, lead time, QRIS manual |
| `/admin/logs` | Log aktivitas transaksi (status, pembayaran, pelaku) |
| `/admin/logs/deletions` | Log penghapusan transaksi: akun penghapus, waktu, alasan, item, dan stok yang dikembalikan |
| `/admin/orders/[id]` | Detail pesanan, riwayat status, pembayaran, pembatalan, dan hapus transaksi permanen |

Admin dapat membuka area kasir. Kasir tidak dapat membuka area admin.

---

## Alur pesanan

### Walk-in

1. Kasir memilih produk di `/cashier/pos` dan **wajib mengisi nama pemesan**.
2. Kasir memilih tunai atau QRIS manual (jika diaktifkan admin).
3. Satu RPC atomik membuat order, item, pembayaran, riwayat status, dan langsung memberi `queued_at`.
4. Bila tidak ada pesanan aktif, pesanan baru langsung dipromosikan ke `preparing`; bila ada, pesanan menunggu di antrean FIFO dan diproses otomatis setelah pesanan aktif selesai. Kasir dapat memprioritaskan pesanan mana pun dari `/cashier/orders` dengan tombol **Proses**.
5. Pesanan dihitung sebagai omzet pada saat pembayaran. Kartu di `/cashier/orders` hanya menampilkan kode, nama pemesan, daftar produk, status ringkas, dan aksi yang relevan.

### Pre-order

1. Pelanggan mengisi form tanpa akun: nama pemesan, produk, email, nomor HP/WhatsApp, slot pickup.
2. Server memvalidasi ulang slot dan harga, lalu membuat order `pending_confirmation` + `unpaid`.
3. Pelanggan menerima kode order dan **kode lacak 5 karakter** (mis. `AB7K2`). Kode ini unik dan tidak memuat data pribadi.
4. Kasir mengonfirmasi (slot divalidasi ulang) atau menolak dengan alasan. Bila perlu, kasir mengirim rincian melalui tombol **Konfirmasi WhatsApp** pada kartu pre-order.
5. Saat produksi siap, kasir memanggil **Masukkan antrean**; `queued_at` diisi dan FIFO berlaku. Bila tidak ada pesanan aktif, pesanan langsung menjadi `preparing`; bila ada, pesanan menunggu dan dipromosikan otomatis setelah pesanan aktif selesai. Kasir dapat memprioritaskan pesanan dari `/cashier/orders`.
6. Status berjalan `queued → preparing → ready` (atau langsung `preparing` bila antrean kosong).
7. Saat pelanggan mengambil, kasir mencatat pembayaran.
8. Pesanan menjadi `completed` hanya jika sudah `ready` dan `paid`. Penyelesaian pesanan aktif otomatis mempromosikan pesanan berikutnya di antrean.

Pre-order yang belum dibayar **bukan** omzet. Laporan hanya membaca `payments.paid_at`.

### Prioritas antrean

Halaman `/cashier/orders` membagi pesanan menjadi **Sedang diproses / Siap diambil**, **Antrean menunggu** (dengan penanda **Prioritas**), dan **Selesai**. Kotak antrean tetap ringkas dan hanya menampilkan kode, nama pemesan, produk, status, serta aksi yang relevan.

Daftar antrean dan pesanan selesai bersifat **toko-wide**, bukan per akun kasir: semua kasir melihat antrean yang sama agar siapa pun bisa melanjutkan pesanan. Atribusi kasir tetap dicatat saat pembayaran (`payments.received_by`) dan ditampilkan di daftar penjualan admin serta laporan per kasir.

- **Proses** pada pesanan `queued` menjadikannya pesanan berikutnya. Bila tidak ada pesanan aktif, pesanan langsung mulai diproses. Bila ada pesanan aktif, pesanan ditandai `queue_priority = true` dan menunggu tepat setelah pesanan aktif tersebut.
- Contoh: antrean `1 2 3 4` dengan #1 sedang diproses. Menekan **Proses** pada #4 menghasilkan urutan `1 4 2 3`; #2 dan #3 tetap FIFO satu sama lain.
- Hanya satu pesanan dapat bertanda prioritas. Menekan **Proses** pada pesanan lain memindahkan prioritas ke pesanan itu.
- **Batalkan** menghapus tanda prioritas dan mengembalikan pesanan ke urutan FIFO-nya.
- Prioritas dibersihkan secara otomatis saat pesanan mulai diproses, dan pesanan berikutnya kembali dipilih dari prioritas lalu FIFO.
- Tanpa aksi manual, `queue_priority` bernilai `false`, sehingga urutan tetap FIFO murni (`queued_at`, `created_at`, `id`).
- Semua aksi memakai advisory lock `rotipos_production_queue`; invariant satu pesanan aktif tetap dijaga.

### Laporan & ekspor

Halaman `/admin/reports` menampilkan omzet, keuntungan, jumlah transaksi, rata-rata per transaksi, produk terlaris, rekapitulasi harian/bulanan, dan **kinerja tiap kasir**. Setiap baris kasir dapat diklik untuk melihat jumlah transaksi, penjualan, keuntungan, rata-rata, serta daftar transaksi yang ditangani. Kasir dengan keuntungan terbesar diberi label kecil **Keuntungan tertinggi**. Rentang tanggal dapat diatur, termasuk preset **Hari ini** dan bulan berjalan.

Keuntungan dihitung dari omzet dikurangi harga modal yang tercatat saat pesanan dibuat. Harga modal bersifat opsional; produk tanpa modal dihitung dengan modal Rp0 dan ditampilkan sebagai **Modal belum diisi** di halaman produk.

Tombol **Excel** dan **PDF** mengunduh laporan untuk rentang yang sedang dipilih:

- Excel berisi sheet Ringkasan, Per Kasir, Rekap Periode, Produk Terlaris, dan Transaksi dengan kolom keuntungan.
- PDF berisi ringkasan, tabel per kasir, rekap periode, produk terlaris, dan rincian transaksi (otomatis berhalaman untuk data banyak).
- Nama file: `laporan-rotipos-<dari>_<sampai>.xlsx` atau `.pdf`.

Keduanya hanya menghitung pembayaran yang tercatat (`payments.paid_at`); pre-order yang belum dibayar tidak termasuk omzet.

### Pembatalan

Admin dapat membatalkan pesanan pada status `pending_confirmation`, `confirmed`, `queued`, `preparing`, atau `ready`. Pembatalan wajib menyertakan alasan. Jika pesanan yang dibatalkan sedang aktif, pesanan berprioritas (atau antrean terdepan bila tidak ada prioritas) otomatis dipromosikan. Jika pesanan sudah dibayar, sistem menampilkan peringatan bahwa refund dilakukan manual di luar aplikasi.

### Penghapusan transaksi permanen

Kasir dan admin dapat menghapus transaksi dari kartu pesanan kasir atau dari kartu **Tindakan** pada detail pesanan admin. Penghapusan wajib memilih alasan:

| Kode | Alasan |
| --- | --- |
| `wrong_input` | Salah input transaksi |
| `duplicate` | Transaksi duplikat |
| `customer_cancelled` | Pelanggan membatalkan |
| `stock_mismatch` | Stok tidak sesuai |
| `other` | Lainnya, wajib menulis catatan minimal 5 karakter |

Saat transaksi dihapus:

- Order dan pembayarannya dihapus permanen sehingga tidak lagi muncul di penjualan, laporan, dashboard, atau antrean kasir.
- Untuk **walk-in**, stok setiap produk ditambahkan kembali sesuai jumlah yang terjual dan produk ditandai tersedia kembali.
- Untuk **pre-order**, stok tidak dikembalikan karena pembuatan pre-order tidak pernah mengurangi stok.
- Jika order yang dihapus sedang aktif (`queued`, `preparing`, `ready`), pesanan berikutnya otomatis dipromosikan.
- Snapshot audit tetap disimpan di `order_deletions`: kode order, pelanggan, item dan harga saat itu, pembayaran, akun penghapus beserta perannya, waktu, alasan, catatan, serta jumlah stok yang dikembalikan.
- Audit dapat dibuka di `/admin/logs/deletions` (tab **Penghapusan** pada halaman log).

RPC `delete_order_with_audit` berjalan atomik: validasi alasan, snapshot audit, pengembalian stok, penghapusan pembayaran/order, dan promosi antrean berada dalam satu transaksi. Tabel `order_deletions` memakai RLS default-deny dan hanya dapat diakses service role.

---

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Jalankan hasil build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript tanpa emit |
| `npm run test` | Unit test Vitest |
| `npm run verify:routes` | Cek route publik, guard login, dan akses kasir/admin (server harus aktif) |
| `npm run bootstrap:admin` | Buat/promosikan admin pertama dari environment variable |
| `npm run db:start` | Start Supabase lokal |
| `npm run db:stop` | Stop Supabase lokal |
| `npm run db:status` | URL dan key lokal |
| `npm run db:reset` | Reset DB lokal + jalankan semua migrasi (tanpa seed) |
| `npm run db:push` | Dorong migrasi ke project Supabase terhubung |

### Test

```bash
npm run test
```

Unit test mencakup pembentukan slot & timezone, validasi skema, rentang tanggal, pemetaan data, pemetaan error, format IDR/waktu, derivasi/normalisasi/hash kode tracking 5 karakter, serta normalisasi nomor dan pesan WhatsApp.

Route smoke test (butuh aplikasi berjalan di `NEXT_PUBLIC_APP_URL`):

```bash
npm run verify:routes
```

Perintah ini memeriksa halaman publik, redirect tanpa sesi, halaman tracking berbasis kode, dan 404 detail pesanan. Untuk ikut memeriksa halaman kasir/admin, isi environment variable berikut (jangan commit kredensial):

```bash
VERIFY_ADMIN_EMAIL=
VERIFY_ADMIN_PASSWORD=
VERIFY_CASHIER_EMAIL=
VERIFY_CASHIER_PASSWORD=
```

Jika variabel tersebut kosong, pengecekan sesi akan dilewati dengan aman.

---

## Migrasi & tipe database

Migrasi berada di `supabase/migrations/`. Untuk perubahan skema:

```bash
# buat file migrasi baru
npx supabase migration new nama_perubahan
npm run db:reset
```

Regenerasi tipe setelah skema berubah:

```bash
npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
```

Di PowerShell, redirect `>` dapat menghasilkan UTF-16. Gunakan `cmd /c` atau konversi file ke UTF-8 agar ESLint tidak menganggapnya biner:

```powershell
cmd /c "npx supabase gen types typescript --local > src\lib\supabase\database.types.ts"
```

---

## Deploy

### 1. Supabase cloud

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npm run db:push
```

Ambil **Project URL**, **anon key**, dan **service_role key** dari dashboard Supabase. Di **Authentication → URL Configuration**, set Site URL ke domain produksi.

### 2. Bootstrap admin pertama

Aplikasi tidak membuat profil otomatis dari `auth.users`. Setelah migrasi diterapkan, jalankan:

```bash
ADMIN_EMAIL="admin@tokoanda.com" \
ADMIN_PASSWORD="password-yang-kuat" \
ADMIN_NAME="Nama Admin" \
node scripts/bootstrap-admin.mjs
```

Pada PowerShell, set `$env:ADMIN_EMAIL`, `$env:ADMIN_PASSWORD`, dan `$env:ADMIN_NAME` terlebih dahulu. Script memakai `NEXT_PUBLIC_SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` dari environment. Setelah admin pertama bisa login, akun lain dibuat dari halaman **Karyawan**. Pengaturan toko dan produk diisi dari halaman **Pengaturan** dan **Produk**.

### 3. Vercel (atau host Node lain)

- Build command: `npm run build`
- Start command: `npm run start`
- Set environment variables yang sama seperti `.env.local`, dengan `NEXT_PUBLIC_APP_URL` berisi URL produksi.
- `SUPABASE_SERVICE_ROLE_KEY` dan `TRACKING_TOKEN_PEPPER` hanya boleh tersedia sebagai environment server.
- Isi `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY` dan `CLOUDFLARE_TURNSTILE_SECRET_KEY`. Tanpa keduanya, login staf dan form pre-order akan ditolak. Daftarkan domain produksi pada widget Turnstile di dashboard Cloudflare.
- Pastikan domain produksi juga terdaftar di **Authentication → URL Configuration** Supabase (Site URL dan Redirect URLs).

---

## Batasan saat ini

- Tanpa payment gateway, pembayaran online, cicilan, uang muka, atau refund otomatis.
- QRIS bersifat manual dan diverifikasi kasir; aplikasi tidak mengklaim menerima pembayaran dari klik pelanggan.
- Satu pelunasan penuh per order.
- Tidak ada reschedule dua arah; jika slot tidak memungkinkan, kasir menolak dengan alasan dan pelanggan membuat order baru.
- Tidak ada jaminan kapasitas produksi per slot saat ini.
- Pembaruan status memakai polling 15–30 detik, bukan Supabase Realtime.
- Kode tracking hanya ditampilkan mentah pada layar staf (admin/kasir) dengan menurunkannya ulang dari `idempotency_key` + salt; database tidak menyimpan kode mentah. Halaman publik tetap hanya bisa mencari lewat hash.
