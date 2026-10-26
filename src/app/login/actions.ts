"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { loginSchema } from "@/lib/validation/schemas";
import { actionFail, type ActionResult } from "@/lib/errors";

export type LoginState = ActionResult<null> | null;

export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const turnstileToken = formData.get("cf-turnstile-response") as string | null;
  const turnstileCheck = await verifyTurnstileToken(turnstileToken);
  if (!turnstileCheck.success) {
    return actionFail(turnstileCheck.error, "CAPTCHA_FAILED");
  }

  if (!(await checkRateLimit("login", 20, 300))) {
    return actionFail("Terlalu banyak percobaan masuk. Tunggu 5 menit lalu coba lagi.");
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return actionFail(parsed.error.issues[0]?.message ?? "Data login tidak valid.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return actionFail("Email atau password salah.", "INVALID_CREDENTIALS");
  }

  const { data: profile, error: profileError } = await getAdminClient()
    .from("profiles")
    .select("role, is_active")
    .eq("id", data.user.id)
    .maybeSingle<{ role: string; is_active: boolean }>();

  if (profileError) {
    console.error("[rotipos-login]", profileError.message);
  }

  if (!profile) {
    await supabase.auth.signOut();
    return actionFail("Akun ini belum memiliki profil pegawai. Hubungi admin.");
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    return actionFail("Akun ini sudah dinonaktifkan. Hubungi admin.");
  }

  redirect(profile.role === "admin" ? "/admin" : "/cashier/pos");
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
