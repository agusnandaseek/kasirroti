/**
 * Route-level smoke test against a running server.
 * Usage: node --env-file=.env.local scripts/verify-routes.mjs
 *
 * Verifies public pages, auth redirects, and role-gated cashier/admin pages.
 * Start the app first (`npm run dev` or `npm run start`).
 */
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const cashierEmail = process.env.VERIFY_CASHIER_EMAIL;
const cashierPassword = process.env.VERIFY_CASHIER_PASSWORD;
const adminEmail = process.env.VERIFY_ADMIN_EMAIL;
const adminPassword = process.env.VERIFY_ADMIN_PASSWORD;

if (!url || !anonKey) {
  console.error("Missing Supabase env vars. Use --env-file=.env.local");
  process.exit(1);
}

const results = [];
function check(name, condition, extra = "") {
  results.push({ name, ok: Boolean(condition) });
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${extra ? ` - ${extra}` : ""}`);
  if (!condition) process.exitCode = 1;
}

async function sessionFor(email, password) {
  const jar = new Map();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value } of cookies) jar.set(name, value);
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login ${email} gagal: ${error.message}`);
  if (!data.user) throw new Error(`Login ${email} tidak mengembalikan user`);

  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function get(path, cookie = "") {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    headers: cookie ? { cookie } : {},
  });

  return {
    status: response.status,
    location: response.headers.get("location") ?? "",
    body: await response.text(),
  };
}

function contains(page, text) {
  return page.body.toLowerCase().includes(text.toLowerCase());
}

const serverIsUp = await fetch(baseUrl, { redirect: "manual" })
  .then(() => true)
  .catch(() => false);

if (!serverIsUp) {
  console.error(`Server tidak berjalan di ${baseUrl}. Jalankan npm run dev atau npm run start.`);
  process.exit(1);
}

const home = await get("/");
check("GET /", home.status === 200, `status ${home.status}`);
check("beranda menampilkan hero", contains(home, "Roti hangat"));
check("beranda menampilkan CTA pre-order", contains(home, "Pre-order"));
check(
  "beranda hanya berisi hero",
  !contains(home, "Cara kerjanya") && !contains(home, "Menu hari ini"),
);

const preorder = await get("/preorder");
check("GET /preorder", preorder.status === 200, `status ${preorder.status}`);
check("form pre-order memuat produk", contains(preorder, "Roti"));

const lookup = await get("/lacak");
check("GET /lacak", lookup.status === 200, `status ${lookup.status}`);
check("halaman lacak memuat form", contains(lookup, "Lacak pesananmu"));

const badCode = "ZZZZZ";
const trackMissing = await get(`/track/${badCode}`);
check("GET /track/[code] format valid tanpa order", trackMissing.status === 200);
check("tracking tidak membocorkan data", contains(trackMissing, "Kode tidak ditemukan"));

const trackMalformed = await get("/track/pendek");
check("GET /track/[code] format salah", trackMalformed.status === 200);
check("format kode salah ditolak", contains(trackMalformed, "Kode tidak ditemukan"));

const login = await get("/login");
check("GET /login", login.status === 200, `status ${login.status}`);
check("halaman login tampil", contains(login, "Masuk pegawai"));

const guardCashier = await get("/cashier/pos");
check(
  "kasir tanpa sesi diarahkan ke login",
  guardCashier.status === 307 && guardCashier.location.includes("/login"),
  `${guardCashier.status} ${guardCashier.location}`,
);

const guardAdmin = await get("/admin");
check(
  "admin tanpa sesi diarahkan ke login",
  guardAdmin.status === 307 && guardAdmin.location.includes("/login"),
  `${guardAdmin.status} ${guardAdmin.location}`,
);

if (cashierEmail && cashierPassword) {
  const cashierCookie = await sessionFor(cashierEmail, cashierPassword);
  const cashierPos = await get("/cashier/pos", cashierCookie);
  check("kasir bisa membuka POS", cashierPos.status === 200, `status ${cashierPos.status}`);
  check("POS menampilkan tombol bayar", contains(cashierPos, "Bayar"));

  const cashierOrders = await get("/cashier/orders", cashierCookie);
  check("kasir bisa membuka antrean", cashierOrders.status === 200, `status ${cashierOrders.status}`);

  const cashierPreorders = await get("/cashier/preorders", cashierCookie);
  check(
    "kasir bisa membuka pre-order",
    cashierPreorders.status === 200,
    `status ${cashierPreorders.status}`,
  );

  const cashierToAdmin = await get("/admin", cashierCookie);
  check(
    "kasir ditolak dari admin",
    cashierToAdmin.status === 307 && cashierToAdmin.location.includes("/cashier"),
    `${cashierToAdmin.status} ${cashierToAdmin.location}`,
  );
} else {
  console.log("SKIP  cek sesi kasir (VERIFY_CASHIER_EMAIL/PASSWORD belum diisi)");
}

if (adminEmail && adminPassword) {
  const adminCookie = await sessionFor(adminEmail, adminPassword);
  const adminPages = [
    ["/admin", "Selamat datang"],
    ["/admin/sales", "Riwayat penjualan"],
    ["/admin/preorders", "Kelola pre-order"],
    ["/admin/products", "Tambah produk"],
    ["/admin/employees", "Tambah karyawan"],
    ["/admin/reports", "Laporan penjualan"],
    ["/admin/settings", "Identitas toko"],
    ["/admin/logs", "Log Aktivitas"],
  ];

  for (const [path, marker] of adminPages) {
    const page = await get(path, adminCookie);
    check(`admin GET ${path}`, page.status === 200 && contains(page, marker), `status ${page.status}`);
  }

  const adminCashier = await get("/cashier/pos", adminCookie);
  check("admin bisa membuka kasir", adminCashier.status === 200, `status ${adminCashier.status}`);

  const missingOrder = await get("/admin/orders/99999999-9999-4999-8999-999999999999", adminCookie);
  check("detail order tidak ditemukan", missingOrder.status === 404, `status ${missingOrder.status}`);

  const adminLoginPage = await get("/login", adminCookie);
  check(
    "login dengan sesi admin diarahkan ke dashboard",
    adminLoginPage.status === 307 && adminLoginPage.location.includes("/admin"),
    `${adminLoginPage.status} ${adminLoginPage.location}`,
  );
} else {
  console.log("SKIP  cek sesi admin (VERIFY_ADMIN_EMAIL/PASSWORD belum diisi)");
}

const passed = results.filter((item) => item.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
