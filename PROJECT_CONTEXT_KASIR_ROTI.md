# PROJECT CONTEXT & IMPLEMENTATION SPEC — WEB KASIR ROTI

> **Nama kerja:** RotiPOS (placeholder, bisa diganti)
> **Versi dokumen:** 1.0 — MVP
> **Status:** Spesifikasi awal untuk eksekusi oleh AI coding agent
> **Bahasa UI:** Indonesia
> **Mata uang:** Rupiah (IDR, tanpa desimal)
> **Zona waktu toko default:** `Asia/Jakarta` (konfigurabel)

---

## 0. INSTRUKSI UTAMA UNTUK AI CODING AGENT

Anda adalah AI coding agent yang ditugaskan membangun aplikasi web kasir dan pre-order roti berdasarkan dokumen ini. Gunakan dokumen ini sebagai **single source of truth** untuk cakupan produk. Prioritaskan sistem yang **berfungsi end-to-end**, mudah digunakan oleh karyawan, dan aman, dibandingkan fitur ekstra atau desain yang berlebihan.

**Aturan kerja:**
1. Periksa dahulu isi repository, stack, dan progress yang sudah ada. Jika proyek kosong, inisialisasi proyek sesuai rekomendasi teknologi di bawah. Jangan menimpa pekerjaan/kode yang sudah ada tanpa alasan.
2. Implementasikan MVP secara bertahap: **fondasi → POS → antrean → pre-order publik → konfirmasi/jadwal → tracking → admin → testing**.
3. Jangan menambah fitur di luar scope tanpa diminta. Hindari modul inventori bahan, produksi batch, absensi, payroll, notifikasi otomatis, program loyalitas, dan integrasi payment gateway.
4. **Tidak ada payment gateway.** Pembayaran dicatat **secara manual oleh kasir**. Pre-order **dibayar saat pengambilan**. Jangan membuat integrasi Midtrans, Xendit, Stripe, API QRIS dinamis, webhook pembayaran, atau mengasumsikan pembayaran otomatis.
5. Semua validasi transaksi dan hak akses harus dilakukan di server/database, bukan hanya di UI.
6. Jangan membuat dummy button atau data hard-coded seolah fitur sudah berjalan. Gunakan database nyata; jalur deploy tidak memuat seed/demo data.
7. Dokumentasikan keputusan teknis, cara menjalankan, variabel environment, migrasi, dan cara testing dalam `README.md`. Sediakan `.env.example` tanpa secret.
8. Jalankan lint, typecheck, build, dan pengujian yang tersedia setiap selesai tahap penting. Perbaiki kegagalan sebelum menganggap tahap selesai.
9. Apabila ada detail produk yang belum ditentukan, gunakan **default MVP** dalam dokumen ini, catat sebagai asumsi, dan jangan menghentikan pengembangan kecuali benar-benar memerlukan kredensial atau keputusan yang memblokir.
10. Setelah implementasi, ringkas file yang dibuat/diubah, fitur yang berjalan, cara test, dan hal yang belum selesai. Jangan mengklaim selesai tanpa verifikasi.

### Definisi selesai

MVP selesai jika seorang pelanggan bisa melakukan pre-order tanpa login, menerima kode dan link tracking, kasir bisa mengonfirmasi, memasukkan order ke antrean sesuai waktu, mengubah status hingga siap, mencatat pembayaran manual saat pelanggan datang, menyelesaikan pesanan, dan admin bisa melihat transaksi nyata. Jalur pembelian langsung di kasir juga harus berfungsi sampai selesai.

---

## 1. TUJUAN & KONTEKS BISNIS

Toko menjual roti yang biasanya dibuat/dipanggang setelah pesanan diterima. Alur dasarnya **pesan → masuk antrean → dibuat/dipanggang → siap diambil → diserahkan**. Ada dua sumber pesanan:

- **Walk-in:** pelanggan datang langsung ke toko, memesan dan membayar di kasir; roti kemudian disiapkan.
- **Pre-order online:** pelanggan memesan melalui website **tanpa login**, memilih tanggal dan jam pengambilan, mengisi email + nomor telepon, lalu menunggu konfirmasi **manual kasir**. **Pembayaran baru dilakukan saat mengambil roti.**

Aplikasi terdiri dari **tiga area berbagi satu database**:

1. **Kasir:** tepat **3 menu utama**: `Kasir`, `List Pesanan`, `Pre-order`.
2. **Admin/Owner:** manajemen penjualan, produk, karyawan, pre-order, pengaturan, dan laporan sederhana.
3. **Publik/Pelanggan:** katalog + form pre-order + link tracking tanpa login.

### Prinsip produk

- Operasional kasir **cepat, minim klik, mudah dipahami**.
- Antrean produksi memakai **FIFO berdasarkan saat benar-benar masuk antrean**, bukan tanggal pre-order dibuat.
- Pre-order tidak otomatis memenuhi antrean produksi sejak konfirmasi; perlu dimasukkan secara manual oleh kasir mendekati waktu pengambilan pada MVP.
- **Status pesanan ≠ status pembayaran.** Roti bisa siap tetapi belum dibayar.
- Admin memperoleh laporan dari data transaksi riil; **pre-order belum dibayar bukan omzet**.
- UI responsif untuk tablet/laptop di kasir dan HP pelanggan.

---

## 2. RUANG LINGKUP MVP

### 2.1. Area Kasir — persis 3 menu utama

#### Menu 1: `Kasir` — `/cashier/pos`

Fitur wajib:
- Katalog produk aktif: foto opsional, nama, harga, status tersedia.
- Cari/pilih produk, tambah/kurangi kuantitas, hapus item.
- Keranjang dengan subtotal item dan total rupiah.
- Pilih metode pembayaran **manual**: `Tunai` wajib didukung; `QRIS Manual` opsional jika toko memang mempunyai QRIS statis. Tidak perlu integrasi API atau pengecekan otomatis.
- Tombol `Bayar & Buat Pesanan`, dengan konfirmasi kasir bahwa pembayaran sudah diterima.
- Setelah sukses: buat order jenis `walk_in`, payment `paid`, status `queued`, nomor antrean/kode unik; tampilkan detail ringkas dan opsi membuat transaksi berikutnya.
- Cegah double submit atau pembayaran tercatat ganda.
- Harga berasal dari database, tidak dipercaya dari nilai input frontend.

#### Menu 2: `List Pesanan` — `/cashier/orders`

Fitur wajib:
- Tampilkan **antrean produksi aktif** untuk kedua jenis order (`walk_in` dan pre-order yang sudah diantrekan).
- Status aktif: `queued`, `preparing`, `ready`.
- Urutan default **`queued_at ASC`**, lalu `created_at ASC`, lalu `id ASC` sebagai tie-breaker stabil. Order paling lama di antrean berada paling atas.
- Per kartu: kode pesanan, sumber (Langsung / Pre-order), jam masuk antrean, item+jumlah, status, dan jadwal pickup untuk pre-order.
- Aksi sesuai status: `Mulai Proses` (`queued → preparing`), `Siap Diambil` (`preparing → ready`), `Selesaikan` (`ready → completed`).
- Tombol `Selesaikan` hanya berhasil jika pembayaran sudah `paid`. Pada pre-order tampilkan langkah `Terima Pembayaran` lebih dulu.
- Filter/tabs boleh `Aktif`, `Siap Diambil`, `Selesai` tetapi **jangan jadikan menu sidebar tambahan**.
- Order `completed`, `cancelled`, `rejected` tidak muncul pada antrean aktif; historinya tetap tersimpan.
- Perubahan muncul ke kasir lain secara real-time atau refresh/polling yang andal.

#### Menu 3: `Pre-order` — `/cashier/preorders`

Fitur wajib:
- Dua tab utama: `Menunggu Konfirmasi` dan `Terkonfirmasi / Terjadwal`.
- Daftar `pending_confirmation` diurutkan berdasarkan waktu dibuat (yang terlama lebih dulu), menampilkan detail produk, total, kontak pelanggan, dan jadwal yang diminta.
- Kasir bisa `Konfirmasi` atau `Tolak` (penolakan memerlukan alasan singkat).
- Daftar `confirmed` diurutkan berdasarkan `pickup_at ASC`. Tandai pesanan yang sudah mendekati atau melewati jadwal produksi.
- Tombol `Masukkan ke Antrean` mengubah `confirmed → queued` dan mengisi `queued_at` dengan waktu saat aksi berhasil.
- Pre-order yang sudah diantrekan selanjutnya dikerjakan dari menu `List Pesanan` (bukan dikelola di dua tempat berbeda).
- Status pembayaran pre-order tetap `unpaid` hingga kasir menerima pembayaran pada hari pengambilan.

### 2.2. Area Admin — `/admin`

Menu admin yang disarankan:

| Menu | Path | Cakupan MVP |
|---|---|---|
| Dashboard | `/admin` | Omzet pembayaran riil, transaksi lunas, jumlah order aktif, pre-order menunggu konfirmasi/akan diambil, produk terlaris |
| Penjualan | `/admin/sales` | Riwayat walk-in & pre-order, cari, filter tanggal/status, lihat detail |
| Pre-order | `/admin/preorders` | Semua pre-order, filter jadwal/status, detail dan histori |
| Produk | `/admin/products` | Daftar ringkas (klik untuk detail), nama, harga jual, harga modal opsional, deskripsi, foto opsional, ketersediaan |
| Karyawan | `/admin/employees` | Buat akun, nonaktifkan, beri peran (`admin`/`cashier`) |
| Laporan | `/admin/reports` | Omzet + keuntungan harian/bulanan, detail per kasir, produk terlaris, ekspor Excel/PDF |
| Pengaturan | `/admin/settings` | Nama toko, jam buka, slot pickup, minimal lead time, zona waktu |

Catatan:
- Admin bisa mengakses fungsi kasir bila diperlukan.
- Dasar laporan omzet: **jumlah pembayaran yang benar-benar diterima berdasarkan `paid_at`**, bukan seluruh nilai order yang dibuat.
- Keuntungan di laporan adalah **margin kotor** = omzet - harga modal (`order_items.unit_cost`) yang di-snapshot saat pesanan dibuat. Harga modal opsional; produk tanpa modal dihitung Rp0.
- Tidak ada payroll, shift, absensi, inventori, retur/refund lengkap, maupun multi-cabang pada MVP.
- Admin tidak boleh melihat perhitungan laba bersih seolah nyata karena biaya operasional di luar HPP belum tersedia.

### 2.3. Area Publik — tanpa login

#### Form pre-order — `/preorder`

- Tampilkan produk yang tersedia dan harganya.
- Pilih produk/kuantitas; lihat ringkasan dan total.
- Pilih **tanggal serta slot jam pengambilan** dari slot valid berdasarkan jam toko dan pengaturan.
- Wajib mengisi **email dan nomor HP/WhatsApp**, tanpa akun atau password.
- Jelaskan jelas: **"Bayar di toko saat pengambilan. Pesanan baru berlaku setelah dikonfirmasi kasir."**
- Kirim pre-order → status `pending_confirmation` + `unpaid`.
- Tampilkan **kode order** dan **link tracking pribadi**; tombol salin kode/salin link.
- Tidak perlu kirim email/WhatsApp otomatis dalam MVP. Karena tidak ada akun, ingatkan pelanggan agar **menyimpan link**.

#### Tracking — `/track/[token]`

- Link mengandung **token acak berentropi tinggi**, bukan sekadar `order_code` berurutan.
- Token hanya digunakan untuk mengecek order miliknya; response tidak membocorkan email, nomor telepon, atau data pelanggan lain.
- Tampilkan: kode pesanan, item+jumlah, total yang harus dibayar, status order, status pembayaran, tanggal/jam pickup, dan progres status.
- Setelah kasir mengonfirmasi, menolak, memproses, atau menyelesaikan, perubahan status terlihat di halaman tracking (real-time atau refresh/polling).
- Jika token salah/tidak ditemukan: halaman error yang aman tanpa memberikan petunjuk keberadaan data pribadi.

---

## 3. ATURAN BISNIS & STATE MACHINE

### 3.1. Jenis pesanan

```text
order_type = walk_in | pre_order
```

### 3.2. Status pesanan

```text
pending_confirmation  -> Pre-order menunggu konfirmasi kasir
confirmed             -> Disetujui, menunggu waktu dimasukkan ke antrean
queued                -> Masuk antrean produksi
preparing             -> Roti sedang dibuat
ready                 -> Roti siap diambil
completed             -> Roti sudah diserahkan, pembayaran lunas
rejected              -> Pre-order ditolak
cancelled             -> Pesanan dibatalkan
```

**Transisi utama pre-order:**

```text
pending_confirmation
  ├──> rejected                  [kasir menolak, alasan wajib]
  └──> confirmed                 [kasir menyetujui]
          ├──> cancelled         [jika dibatalkan dengan alasan]
          └──> queued            [kasir: Masukkan ke Antrean]
                  └──> preparing
                          └──> ready
                                  └──> completed [hanya jika sudah paid]
```

**Transisi utama walk-in:**

```text
[Kasir konfirmasi pembayaran manual]
    -> queued (order walk_in + payment paid dibuat secara atomik)
    -> preparing
    -> ready
    -> completed
```

Pembatalan untuk status `queued`/`preparing`/`ready` dapat disediakan **hanya untuk admin** pada MVP dengan alasan wajib dan audit. Order yang sudah `paid` tidak boleh otomatis direfund; jika bisnis meminta refund, buat prosedur/fitur terpisah di fase berikutnya. Jangan mengubah `paid` menjadi `unpaid` secara diam-diam.

### 3.3. Status pembayaran

```text
payment_status = unpaid | paid
```

- **Walk-in:** dibayar saat checkout kasir; hanya masuk antrean setelah kasir menyatakan pembayaran diterima.
- **Pre-order:** dibuat dan dikonfirmasi dalam status `unpaid`; kasir mencatat pembayaran **di toko saat pengambilan**, bukan melalui checkout online.
- `completed` **harus** mensyaratkan `order_status = ready` sebelumnya dan `payment_status = paid`.
- Tidak boleh ada dua pembayaran sukses untuk order yang sama di MVP (satu pelunasan penuh per order).
- Jika pembayaran manual QRIS ditambahkan, kasir wajib memverifikasi penerimaan secara manual; aplikasi **tidak** mengklaim sudah membayar berdasarkan klik pelanggan.
- Fitur uang muka, cicilan/partial payment, pembayaran otomatis, refund otomatis **tidak termasuk** MVP.

### 3.4. FIFO dan pre-order terjadwal

**Penting: `created_at`, `pickup_at`, dan `queued_at` memiliki fungsi berbeda.**

- `created_at`: kapan pesanan dibuat.
- `pickup_at`: target tanggal+jam pengambilan yang diminta pelanggan (hanya pre-order).
- `queued_at`: kapan pesanan benar-benar dimasukkan ke antrean produksi.

Antrean aktif default:

```sql
SELECT *
FROM orders
WHERE order_status IN ('queued', 'preparing', 'ready')
ORDER BY queued_at ASC, created_at ASC, id ASC;
```

**Jangan** mengurutkan antrean produksi berdasarkan `created_at` pre-order karena order yang dibuat kemarin bisa saja untuk diambil besok.

- Pre-order baru **tidak langsung** masuk antrean.
- Setelah disetujui, status `confirmed` hingga kasir mengklik `Masukkan ke Antrean`.
- Untuk MVP, pengingat pesanan mendekati jadwal berdasarkan `pickup_at` tampil di menu pre-order; kasir mengambil keputusan kapan memasukkan ke antrean.
- Ketika dua kasir menekan aksi bersamaan, backend harus menjaga agar transisi terjadi **sekali** saja (`queued_at` tidak berubah pada pengulangan).
- Penjadwalan produksi otomatis, pembagian kapasitas oven, optimasi batch, dan estimasi lama panggang otomatis **ditunda**.

### 3.5. Jadwal pickup

MVP mendukung pemilihan slot pada web publik:
- Jadwal memakai zona waktu toko (`Asia/Jakarta` sebagai default), disimpan di DB dalam `timestamptz`.
- Slot sesuai jam operasional toko, interval pengambilan yang bisa diatur (default awal **30 menit**, bisa diganti admin).
- Minimal jarak waktu pre-order awal **60 menit** (konfigurabel; ini asumsi pengembangan, bukan hasil kesepakatan bisnis final).
- Slot tanggal lampau/toko tutup tidak dapat dipilih.
- Validasi dilakukan lagi di server saat checkout dan saat konfirmasi kasir.
- Jika slot tak memungkinkan, kasir **tolak dengan alasan** dan pelanggan diminta membuat order baru pada MVP. Fitur reschedule dua arah ditunda.
- Bila admin mengaktifkan kapasitas maksimum per slot pada fase lanjut, penerapannya harus atomik untuk menghindari overbooking. Pada MVP, cukup validasi jam dan lead time; jangan mengklaim kapasitas produksi telah dijamin.

### 3.6. Kode order & token tracking

- `order_code` mudah dibaca petugas, unik, misalnya `W-000001` untuk walk-in dan `PO-000001` untuk pre-order. Buat dengan sequence/transaksi database yang aman dari race condition.
- Kode bukan password dan **tidak boleh** menjadi satu-satunya kunci akses publik.
- Link tracking mengandung token acak kriptografis (contoh 32 byte acak, dikodekan base64url). Simpan **hash token** di database; jangan simpan atau log token mentah jika tidak perlu.
- Token dikirim/ditampilkan kepada pelanggan **saat order berhasil dibuat**. Contoh pola: `https://domain-toko.com/track/<random-token>`.
- Sistem tidak perlu mengirim email otomatis pada MVP. Halaman sukses menyediakan tombol salin tautan.

---

## 4. DATA MODEL / DATABASE

Gunakan PostgreSQL (Supabase disarankan). Untuk MVP buat 7 tabel utama berikut. Gunakan UUID untuk primary key tabel transaksi/profil, integer rupiah untuk uang, FK yang jelas, dan timestamp dengan timezone.

### 4.1. `profiles` (akun karyawan)

> Gunakan Supabase Auth (`auth.users`) untuk autentikasi. Jangan menyimpan password plaintext dalam tabel sendiri.

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `uuid PK` | FK ke `auth.users.id` |
| `full_name` | `text NOT NULL` | Nama karyawan |
| `role` | `text NOT NULL` | `admin` / `cashier` (CHECK/enum) |
| `is_active` | `boolean NOT NULL DEFAULT true` | Akun masih aktif |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Waktu pembuatan |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | Waktu perubahan |

Email login dapat berasal dari Supabase Auth. Admin menyediakan alur pembuatan/undangan akun karyawan di sisi server yang aman. Penonaktifan akun harus diperiksa pada setiap operasi berizin; tidak cukup hanya menyembunyikan tombol.

### 4.2. `products`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `uuid PK` | UUID |
| `name` | `text NOT NULL` | Nama roti |
| `description` | `text` | Opsional |
| `price` | `bigint NOT NULL` | Rupiah, CHECK `price >= 0` |
| `image_url` | `text` | Opsional |
| `is_available` | `boolean NOT NULL DEFAULT true` | Bisa dijual atau tidak |
| `created_at` | `timestamptz` | Default now |
| `updated_at` | `timestamptz` | Default now |

Produk historis sebaiknya dinonaktifkan, bukan dihapus dari transaksi masa lalu.

### 4.3. `orders` (walk-in + pre-order dalam satu tabel)

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `uuid PK` | UUID |
| `order_code` | `text UNIQUE NOT NULL` | Kode display + pengambilan |
| `order_type` | `text NOT NULL` | `walk_in` / `pre_order` |
| `order_status` | `text NOT NULL` | Nilai dari state machine |
| `payment_status` | `text NOT NULL` | `unpaid` / `paid` |
| `customer_email` | `text` | Wajib untuk pre-order; kosong pada walk-in boleh |
| `customer_phone` | `text` | Wajib untuk pre-order; kosong pada walk-in boleh |
| `pickup_at` | `timestamptz` | Wajib untuk pre-order |
| `total_amount` | `bigint NOT NULL` | Snapshot total IDR, >= 0 |
| `tracking_token_hash` | `text UNIQUE` | Untuk pre-order, tidak diberikan ke klien secara langsung |
| `created_by` | `uuid FK profiles.id` | Kasir pembuat; null untuk guest |
| `confirmed_by` | `uuid FK profiles.id` | Kasir yang menyetujui |
| `confirmed_at` | `timestamptz` | Waktu disetujui |
| `queued_at` | `timestamptz` | **Kunci FIFO** |
| `completed_at` | `timestamptz` | Waktu selesai |
| `cancellation_reason` | `text` | Alasan tolak/batal dapat dicatat di sini atau history |
| `created_at` | `timestamptz` | Default now |
| `updated_at` | `timestamptz` | Default now |

Constraints penting:
- Pre-order wajib punya kontak, pickup, dan token tracking.
- Walk-in dibuat hanya oleh kasir terautentikasi.
- `queued_at` wajib untuk status antrean/produksi/ready/completed.
- Jangan menerima `total_amount`, `payment_status`, `order_status`, atau `created_by` yang dapat dimanipulasi dari body request publik.
- Buat indeks untuk `order_status`, `queued_at`, `pickup_at`, `created_at`, dan kode unik.

### 4.4. `order_items`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `uuid PK` | UUID |
| `order_id` | `uuid FK orders.id NOT NULL` | Parent order |
| `product_id` | `uuid FK products.id NOT NULL` | Produk asli |
| `product_name` | `text NOT NULL` | **Snapshot** nama saat dibeli |
| `quantity` | `integer NOT NULL` | CHECK `quantity > 0` |
| `unit_price` | `bigint NOT NULL` | **Snapshot** harga per unit |
| `subtotal` | `bigint NOT NULL` | `quantity × unit_price` |

Snapshot penting agar laporan tidak berubah saat admin mengubah nama/harga produk. Hitung di server.

### 4.5. `payments`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `uuid PK` | UUID |
| `order_id` | `uuid FK orders.id UNIQUE NOT NULL` | **Satu pembayaran sukses/order** pada MVP |
| `amount` | `bigint NOT NULL` | Sama dengan total order |
| `payment_method` | `text NOT NULL` | `cash` atau `manual_qris` jika enabled |
| `paid_at` | `timestamptz NOT NULL` | Waktu kasir konfirmasi pembayaran |
| `received_by` | `uuid FK profiles.id NOT NULL` | Kasir yang menerima |

Pembayaran dan pengubahan status order ke `paid` harus atomik. Tidak ada callback provider. Jangan menyebut metode `manual_qris` sebagai verifikasi otomatis.

### 4.6. `order_status_history`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `uuid PK` | UUID |
| `order_id` | `uuid FK orders.id NOT NULL` | Order terkait |
| `from_status` | `text` | Null saat order dibuat |
| `to_status` | `text NOT NULL` | Status baru |
| `changed_by` | `uuid FK profiles.id` | Null untuk event dari sistem/guest |
| `actor_type` | `text NOT NULL` | `guest`, `cashier`, `admin`, `system` |
| `notes` | `text` | Alasan penolakan/pembatalan |
| `changed_at` | `timestamptz NOT NULL` | Default now |

Setiap perpindahan status dicatat dalam transaksi database yang sama dengan update order.

### 4.7. `store_settings`

Satu row konfigurasi toko dalam MVP (single-store).

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `smallint PK` | Singleton (`id = 1`) |
| `store_name` | `text NOT NULL` | Nama bisnis |
| `timezone` | `text NOT NULL` | Default `Asia/Jakarta` |
| `business_hours` | `jsonb NOT NULL` | Jam buka per hari |
| `slot_interval_minutes` | `integer NOT NULL` | Default awal `30` |
| `min_preorder_minutes` | `integer NOT NULL` | Default awal `60` |
| `manual_qris_enabled` | `boolean NOT NULL` | Default `false` |
| `updated_at` | `timestamptz NOT NULL` | Default now |

Bila jam toko belum diketahui, gunakan default 08:00–20:00 yang dapat diubah admin sebelum operasional.

### Relasi

```text
auth.users (1) ── (1) profiles
profiles   (1) ── (N) orders.created_by / confirmed_by
orders     (1) ── (N) order_items ── (N:1) products
orders     (1) ── (0..1) payments
orders     (1) ── (N) order_status_history
store_settings ── singleton konfigurasi
```

### Catatan implementasi DB

- Gunakan migrations (`supabase/migrations/` atau mekanisme repo yang sudah ada).
- Pasang FK, unique, check constraints dan indeks.
- Update `updated_at` secara konsisten.
- Gunakan transaksi atomik/RPC server-side untuk: checkout walk-in + payment + items, create pre-order + items + status history, konfirmasi status, masukkan ke antrean, bayar pre-order + perubahan status, dan finalisasi.
- Gunakan optimistic check `WHERE current_status = expected_status`/locking untuk mencegah perubahan status ganda saat dua kasir beraksi bersamaan.
- Supabase Realtime atau polling tidak menggantikan keharusan membaca kebenaran terakhir dari DB.

---

## 5. ROUTES & AKSES

| Route | Hak akses | Fungsi |
|---|---|---|
| `/login` | Publik | Login pegawai |
| `/cashier/pos` | `cashier`, `admin` | POS |
| `/cashier/orders` | `cashier`, `admin` | Antrean dan pengambilan |
| `/cashier/preorders` | `cashier`, `admin` | Konfirmasi dan penjadwalan |
| `/admin` | `admin` | Dashboard |
| `/admin/sales` | `admin` | Riwayat penjualan |
| `/admin/preorders` | `admin` | Manajemen pre-order |
| `/admin/products` | `admin` | Produk |
| `/admin/employees` | `admin` | Akun pegawai |
| `/admin/reports` | `admin` | Laporan |
| `/admin/settings` | `admin` | Pengaturan toko |
| `/preorder` | Publik tanpa login | Katalog/form |
| `/track/[token]` | Pemegang token | Tracking aman |

Boleh ada route halaman detail/nested route jika diperlukan, tetapi kasir **tetap hanya memiliki 3 menu navigasi utama**.

---

## 6. UI/UX PRINCIPLES

### Kasir
- Desain cepat untuk tablet/laptop, tetap usable di HP.
- Sidebar / bottom navigation memuat **Kasir**, **List Pesanan**, **Pre-order** saja.
- Tombol besar, teks jelas, konfirmasi visual setelah tindakan berhasil.
- Status ditunjukkan dengan label teks; warna hanya pelengkap.
- Di POS, ringkasan keranjang dan tombol bayar mudah dijangkau.
- Pada daftar pesanan, tampilkan kode order dan urutan FIFO dengan jelas; tombol status hanya yang relevan.
- Empty state, loading, error state, dan retry harus ditangani.

### Pelanggan
- Mobile-first, formulir singkat, tanpa signup.
- Pada checkout tulis jelas `Pembayaran dilakukan saat pengambilan di toko` dan `Pesanan menunggu persetujuan kasir`.
- Setelah submit, tampilkan kode order + link tracking dengan tombol copy yang berfungsi.
- Tracking memperlihatkan langkah progres yang mudah dipahami, tanggal/jam pickup, dan total pembayaran.
- Jangan tampilkan nomor HP/email lengkap di halaman tracking.

### Admin
- Dashboard KPI dan daftar pengelolaan yang rapi.
- Utamakan informasi operasional yang actionable (pre-order menunggu konfirmasi, pickup hari ini).
- Grafik sederhana saja bila datanya nyata; tidak perlu dashboard dekoratif kompleks.

---

## 7. API/SERVER ACTIONS (KONTRAK PERILAKU)

Nama endpoint boleh menyesuaikan arsitektur (REST API routes atau server actions). Yang penting seluruh mutasi tervalidasi di server.

| Operasi | Aktor | Ketentuan |
|---|---|---|
| `listAvailableProducts` | publik/kasir | Hanya produk aktif untuk publik |
| `createPreorder(items, email, phone, pickupAt)` | publik | Validasi server, hitung total dari DB, buat kode + token + history |
| `trackPreorder(token)` | pemegang token | Cocokkan **hash** token, kembalikan data aman tanpa PII |
| `createWalkinOrder(items, paymentMethod)` | kasir/admin | Konfirmasi pembayaran manual, transaksi atomik paid + queued |
| `listActiveQueue()` | kasir/admin | FIFO `queued_at ASC` |
| `confirmPreorder(orderId)` | kasir/admin | `pending_confirmation → confirmed` |
| `rejectPreorder(orderId, reason)` | kasir/admin | `pending_confirmation → rejected`, alasan wajib |
| `enqueuePreorder(orderId)` | kasir/admin | `confirmed → queued`, isi queued_at sekali |
| `startPreparing(orderId)` | kasir/admin | `queued → preparing` |
| `markReady(orderId)` | kasir/admin | `preparing → ready` |
| `recordManualPayment(orderId, method)` | kasir/admin | Cek order/amount/status, mencegah double pay, simpan payment dan paid |
| `completeOrder(orderId)` | kasir/admin | Hanya `ready` + `paid` → `completed` |
| `manageProducts/Employees/Settings` | admin | CRUD/aksi tervalidasi |
| `getReports(filter)` | admin | Berdasarkan pembayaran riil, bukan nilai pre-order belum lunas |

Kontrak hasil mutasi setidaknya mengembalikan sukses/gagal, kode error yang bisa ditangani UI, dan representasi state terbaru.

---

## 8. SECURITY & RELIABILITY

### Autentikasi & otorisasi
- Pegawai login menggunakan Supabase Auth, bukan akun/password buatan sendiri.
- Role disimpan di `profiles`, dicek oleh server untuk setiap operasi berizin.
- Terapkan **Row Level Security (RLS)** untuk semua tabel; default deny untuk publik pada order dan informasi pribadi.
- Pembuatan pre-order publik dan tracking melalui endpoint/server action yang membatasi field, bukan akses anonymous langsung ke seluruh tabel `orders`.
- **Service role key**, jika dipakai, **hanya di server**. Jangan expose di browser, git, atau UI.
- Admin yang menambah pegawai harus lewat server action berizin.

### Validasi
- Pastikan `quantity > 0`, item produk valid/tersedia, kontak masuk akal, slot waktu valid, total dihitung server.
- Maksimum jumlah item/kuantitas per request untuk mengurangi abuse (nilai default bisa dikonfigurasi).
- Terapkan rate limiting pada pembuatan pre-order dan tracking publik; proteksi anti-spam sederhana yang tidak memaksa pelanggan login.
- Validasi server agar tidak bisa melewati status, membayar dua kali, atau menyelesaikan order belum lunas.
- Tidak ada email/WA automation maupun notifikasi berbasis provider pada MVP.

### Keandalan
- Idempotency untuk submit pembayaran/order (idempotency key atau perlindungan transaksi/unique constraint).
- Tangani double-click, koneksi lambat, dua kasir mengubah status bersamaan.
- Gunakan DB sebagai source of truth; realtime subscription hanya sinkronisasi tampilan. Jika perlu fallback polling, gunakan interval wajar.
- Catat history setiap perubahan status.
- Kesalahan harus menampilkan feedback yang jelas kepada pengguna tanpa membocorkan stack trace/secret.
- Aplikasi membutuhkan internet untuk transaksi pada MVP; mode offline-first tidak termasuk ruang lingkup.
- Tidak perlu menyimpan data kartu atau kredensial pembayaran pelanggan.

---

## 9. METRIK ADMIN & LOGIKA PERHITUNGAN

Metrik awal:

- **Omzet diterima:** `SUM(payments.amount)` dengan filter `payments.paid_at` pada periode.
- **Keuntungan kotor:** `SUM(payments.amount - (order_items.unit_cost × quantity))`; `unit_cost` adalah snapshot harga modal saat pesanan dibuat.
- **Jumlah transaksi lunas:** count order yang memiliki payment sukses pada periode.
- **Pre-order menunggu konfirmasi:** count `order_type=pre_order AND order_status=pending_confirmation`.
- **Pre-order mendatang:** confirmed/queued/preparing/ready dengan `pickup_at` sesuai filter.
- **Antrean aktif:** count order status `queued`, `preparing`, atau `ready`.
- **Produk terlaris:** agregasi kuantitas `order_items` untuk order yang **sudah dibayar** sesuai filter periode pembayaran; gunakan snapshot data produk bila nama berubah.

Jangan menganggap total pre-order yang belum dibayar sebagai uang masuk. Jangan menghitung laba bersih sebelum ada data modal/harga pokok dan biaya.

---

## 10. TECHNOLOGY STACK YANG DIREKOMENDASIKAN

Apabila repo sudah memiliki stack layak, pertahankan dan adaptasikan. Jika repo kosong:

- **Frontend + Backend:** Next.js App Router + TypeScript.
- **Styling:** Tailwind CSS (komponen UI konsisten dan accessible).
- **Database:** Supabase PostgreSQL.
- **Authentication:** Supabase Auth untuk karyawan.
- **Live updates:** Supabase Realtime pada kanal yang aman, atau polling bila lebih sederhana/stabil.
- **Deployment:** Vercel untuk aplikasi + project Supabase untuk backend.
- **Form validation:** schema validator seperti Zod di server; client validation sebagai UX tambahan.
- **Timezone:** simpan sebagai UTC/`timestamptz`, format menurut `store_settings.timezone`.
- **Money:** integer rupiah (`bigint` DB) tanpa floating point.

Contoh environment (nama bisa disesuaikan implementasi):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=  # SERVER ONLY; jika memang digunakan
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Jangan mengisi `.env.example` dengan kredensial sungguhan. Jangan membuat ketergantungan pada API pembayaran atau layanan berbayar yang tidak diperlukan.

---

## 11. RENCANA IMPLEMENTASI BERTAHAP UNTUK AGENT

### Fase 1 — Fondasi

- [ ] Audit repo; inisialisasi proyek bila perlu.
- [ ] Layout, routing, UI bahasa Indonesia.
- [ ] Supabase client/server config + `.env.example`.
- [ ] SQL migrations untuk tujuh tabel, indeks, constraints, RLS.
- [ ] Auth untuk pegawai + peran `admin`/`cashier`.
- [ ] Bootstrap admin pertama dan pengaturan toko awal.

**Acceptance:** pegawai dapat login, role dibatasi, admin dapat melihat kerangka dashboard, database valid.

### Fase 2 — Kasir POS & FIFO

- [ ] POS produk & keranjang.
- [ ] Checkout walk-in, pembayaran manual, penciptaan order + item + payment secara atomik.
- [ ] Generator kode pesanan yang tahan concurrency.
- [ ] List antrean FIFO dengan status `queued`, `preparing`, `ready`, `completed`.
- [ ] Histori status dan pengaman transisi/double click.

**Acceptance:** walk-in dibayar di kasir, masuk antrean sesuai urutan, diproses, lalu selesai dan muncul di penjualan.

### Fase 3 — Pre-order publik & tracking

- [ ] Katalog/order form tanpa login.
- [ ] Validasi email, telepon, tanggal/jam pickup dan item.
- [ ] `pending_confirmation` + `unpaid`; kode & token tracking.
- [ ] Halaman sukses dan copy link/kode.
- [ ] Tracking read-only yang aman tanpa bocor PII.

**Acceptance:** pelanggan dapat membuat order dari HP, menyimpan tautan, melihat status pesanan, tanpa login.

### Fase 4 — Pre-order kasir & pembayaran pengambilan

- [ ] Tab pending + terjadwal; konfirmasi/tolak.
- [ ] Masukkan ke antrean secara manual (`queued_at`).
- [ ] Pre-order yang diantrekan muncul di antrean bersama walk-in menurut FIFO.
- [ ] Catat pembayaran manual saat pengambilan; selesaikan order hanya setelah lunas.
- [ ] Tracking memperbarui status tanpa reload penuh (realtime atau polling).

**Acceptance:** alur pre-order berjalan dari dibuat → dikonfirmasi → diantrekan → dibuat → siap → dibayar → selesai.

### Fase 5 — Admin & quality

- [ ] CRUD produk dan karyawan.
- [ ] Dashboard dan riwayat penjualan berdasarkan pembayaran riil.
- [ ] Laporan harian/bulanan sederhana.
- [ ] Pengaturan jam buka, slot, lead time.
- [ ] Loading/error/empty states, responsive UI, validasi dan pengamanan.
- [ ] Automated tests untuk state machine, akses, pembayaran, FIFO, tracking.
- [ ] README, setup/migration/bootstrap/deploy instructions, build sukses.

**Acceptance:** admin dapat mengelola bisnis dasar dan semua angka laporan konsisten dengan `payments`.

---

## 12. TEST CASE / ACCEPTANCE CHECKLIST

### Jalur happy path

1. Kasir login, menambah 2 roti, mengonfirmasi pembayaran tunai, menerima nomor `W-...`; order `paid` dan `queued`.
2. Kasir melakukan transaksi walk-in kedua 2 menit setelahnya; order pertama muncul lebih atas pada list FIFO.
3. Kasir menandai order `preparing → ready → completed`; order hilang dari antrean aktif dan tetap ada di penjualan.
4. Pelanggan tanpa login memilih roti + tanggal/jam, mengisi email/telepon dan submit. Sistem memberi kode `PO-...` dan link token unik; order `pending_confirmation` dan `unpaid`.
5. Kasir mengonfirmasi pre-order. Halaman tracking menampilkan `Terkonfirmasi` sementara pembayaran `Belum dibayar`.
6. Setelah mendekati jadwal, kasir mengklik `Masukkan ke Antrean` (queued_at saat itu), lalu order muncul dalam FIFO setelah order yang telah lebih dahulu antre.
7. Kasir mengubah status pre-order hingga `ready`; pelanggan melihat `Siap Diambil` pada link tracking.
8. Saat pelanggan datang, kasir memilih `Terima Pembayaran` dan konfirmasi `Tunai`, kemudian `Selesaikan`. Laporan omzet bertambah saat pembayaran benar-benar diterima.

### Jalur error/safety

9. Pelanggan mencoba memilih slot di masa lalu/toko tutup → ditolak di server.
10. Pre-order tanpa email/nomor telepon, produk tidak tersedia, item kosong, atau kuantitas negatif → ditolak.
11. Kode order `PO-...` tanpa token **tidak** memberikan akses tracking atau data pelanggan.
12. Pegawai role `cashier` mencoba mengakses aksi admin → ditolak di backend walaupun memanggil endpoint langsung.
13. Pengunjung publik mencoba melihat list semua order/contacts → tidak boleh.
14. Dua kasir menekan `Masukkan ke Antrean` bersamaan → satu transisi saja, `queued_at` stabil.
15. Dua kali klik pembayaran → tepat satu record payment, tanpa omzet ganda.
16. Pre-order yang masih `unpaid` mencoba menjadi `completed` → ditolak.
17. Order lama tidak berubah totalnya setelah harga produk diedit oleh admin.
18. Koneksi buruk/refresh halaman setelah submit tidak membuat order ganda tanpa konfirmasi.
19. Pre-order ditolak menyimpan alasan dan link tracking memperlihatkan status ditolak.
20. Dashboard tidak menjumlahkan nilai pre-order yang belum dibayar ke omzet.

---

## 13. BUKAN BAGIAN MVP — JANGAN IMPLEMENTASI SEKARANG

- Payment gateway (Midtrans/Xendit/Stripe), API pembayaran, webhook, auto-payment reconciliation.
- Online payment untuk pelanggan sebelum pickup.
- Integrasi WhatsApp Business API atau pengiriman email otomatis.
- Manajemen stok bahan baku, resep/BOM, kapasitas oven, produksi per batch.
- Payroll, absensi, jadwal shift, komisi karyawan.
- Promo, voucher, poin loyalitas, multi-outlet.
- Refund otomatis dan pembayaran parsial.
- Mode offline-first, aplikasi native Android/iOS.
- Optimisasi produksi kompleks dan auto-enqueue preorder.

Semua boleh dipertimbangkan pada fase lanjutan **hanya atas permintaan eksplisit pemilik proyek**.

---

## 14. ASUMSI AWAL (BOLEH DIUBAH MELALUI PENGATURAN)

1. Single outlet, satu owner/admin atau lebih dan beberapa kasir.
2. UI dalam bahasa Indonesia dan mata uang IDR.
3. Default timezone `Asia/Jakarta` (perbaiki melalui pengaturan jika toko berada di wilayah lain).
4. Default slot pengambilan 30 menit; minimal lead time 60 menit, bukan keputusan bisnis permanen.
5. Hanya satu pelunasan penuh per pesanan.
6. Pembayaran minimum yang didukung adalah **tunai**. QRIS statis yang diverifikasi manual adalah **opsional**, bukan gateway.
7. Walk-in bayar sebelum masuk antrean; pre-order bayar saat pickup.
8. Karyawan menggunakan akun terautentikasi; pelanggan pre-order **tanpa akun**.
9. Foto produk boleh opsional; aplikasi tetap dapat dipakai tanpa aset gambar.
10. Nomor antrean tampak di kasir dan tracking; tidak perlu layar display pelanggan atau printer pada MVP.

---

## 15. PROMPT PEMBUKA YANG BISA DIBERIKAN KE AI AGENT

> Baca seluruh `PROJECT_CONTEXT_KASIR_ROTI.md` sebelum menulis kode. Bangun MVP sesuai dokumen, mulai dari audit repository dan fondasi. Fokus pada tiga menu kasir, area admin, dan pre-order publik tanpa login. Pre-order dikonfirmasi manual kasir, dijadwalkan tanggal/jam pengambilan, dan dibayar saat pengambilan. **Jangan integrasikan payment gateway atau pembayaran online otomatis.** Gunakan database nyata, state machine yang aman, antrean FIFO berdasarkan `queued_at`, dan tracking dengan token acak. Jalankan implementasi per fase dan lakukan tes tiap fase. Buat README setup/deploy serta jelaskan pekerjaan yang sudah selesai dan yang masih perlu konfigurasi.

---

**Prioritas final:** sederhana, aman, benar secara operasional, mudah digunakan karyawan, dan dapat dikembangkan kemudian tanpa rewrite total.
