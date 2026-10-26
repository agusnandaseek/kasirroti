/**
 * Create (or promote) the first admin account on a deployed Supabase project.
 *
 * Usage with an env file:
 *   node --env-file=.env.production scripts/bootstrap-admin.mjs
 *
 * Required environment variables:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ADMIN_EMAIL
 *   ADMIN_PASSWORD
 *
 * Optional:
 *   ADMIN_NAME (default: "Admin")
 *
 * The service role key is only used by this local setup script. Never expose it
 * to the browser or commit it to the repository.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "";
const fullName = (process.env.ADMIN_NAME ?? "Admin").trim() || "Admin";

if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi.");
  process.exit(1);
}

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("ADMIN_EMAIL wajib diisi dengan alamat email yang valid.");
  process.exit(1);
}

if (password.length < 8) {
  console.error("ADMIN_PASSWORD minimal 8 karakter.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(target) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;

    const found = data.users.find((user) => user.email?.toLowerCase() === target);
    if (found) return found;
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function main() {
  let user = null;
  let created = false;

  const result = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (result.error) {
    user = await findUserByEmail(email);
    if (!user) throw result.error;
  } else {
    user = result.data.user;
    created = true;
  }

  if (!user) throw new Error("User admin tidak dibuat dan tidak ditemukan.");

  if (!created) {
    const confirm = await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
    if (confirm.error) throw confirm.error;
  }

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: user.id,
      full_name: fullName,
      role: "admin",
      is_active: true,
    },
    { onConflict: "id" },
  );

  if (profileError) throw profileError;

  console.log(`${created ? "Admin dibuat" : "Admin diperbarui"}: ${email}`);
  console.log(`User ID: ${user.id}`);
  console.log("Simpan password di tempat aman. Script ini tidak menyimpannya.");
}

main().catch((error) => {
  console.error("Gagal menyiapkan admin:", error.message ?? error);
  process.exit(1);
});
