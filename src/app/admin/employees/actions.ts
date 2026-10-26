"use server";

import { revalidatePath } from "next/cache";
import { getActionProfile } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { employeeCreateSchema, employeeUpdateSchema } from "@/lib/validation/schemas";
import { actionFail, actionOk, type ActionResult, toActionError } from "@/lib/errors";

function refresh() {
  revalidatePath("/admin/employees");
}

export async function createEmployeeAction(
  _previous: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    await getActionProfile(["admin"]);
    const parsed = employeeCreateSchema.safeParse({
      fullName: formData.get("fullName") ?? "",
      email: formData.get("email") ?? "",
      role: formData.get("role") ?? "cashier",
      password: formData.get("password") ?? "",
    });

    if (!parsed.success) {
      return actionFail(parsed.error.issues[0]?.message ?? "Data pegawai tidak valid.");
    }

    const admin = getAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.fullName },
    });

    if (error || !data.user) {
      if (/already|exists|registered/i.test(error?.message ?? "")) {
        return actionFail(toActionError("EMAIL_SUDAH_DIGUNAKAN"));
      }
      console.error("[rotipos-employee]", error?.message);
      return actionFail("Gagal membuat akun pegawai. Coba lagi.");
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: data.user.id,
      full_name: parsed.data.fullName,
      role: parsed.data.role,
      is_active: true,
    });

    if (profileError) {
      // Avoid leaving an auth user without a profile.
      await admin.auth.admin.deleteUser(data.user.id);
      throw profileError;
    }

    refresh();
    return actionOk({ id: data.user.id });
  } catch (error) {
    return actionFail(toActionError(error));
  }
}

export async function updateEmployeeAction(
  _previous: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await getActionProfile(["admin"]);
    const parsed = employeeUpdateSchema.safeParse({
      id: formData.get("id"),
      fullName: formData.get("fullName") ?? "",
      role: formData.get("role") ?? "cashier",
      isActive: formData.get("isActive") ?? null,
    });

    if (!parsed.success) {
      return actionFail(parsed.error.issues[0]?.message ?? "Data pegawai tidak valid.");
    }

    const admin = getAdminClient();
    const { data: target, error: targetError } = await admin
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", parsed.data.id)
      .maybeSingle<{ id: string; role: "admin" | "cashier"; is_active: boolean }>();

    if (targetError) throw targetError;
    if (!target) return actionFail("Pegawai tidak ditemukan.");

    const losesAdmin =
      target.role === "admin" && (parsed.data.role !== "admin" || !parsed.data.isActive);

    if (target.id === actor.id && (losesAdmin || !parsed.data.isActive)) {
      return actionFail(toActionError("TIDAK_BISA_AKUN_SENDIRI"));
    }

    if (target.role === "admin" && target.is_active && losesAdmin) {
      const { count, error: countError } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("is_active", true);

      if (countError) throw countError;
      if ((count ?? 0) <= 1) {
        return actionFail(toActionError("ADMIN_TERAKHIR"));
      }
    }

    const { error } = await admin
      .from("profiles")
      .update({
        full_name: parsed.data.fullName,
        role: parsed.data.role,
        is_active: parsed.data.isActive,
      })
      .eq("id", parsed.data.id);

    if (error) throw error;
    refresh();
    return actionOk({ id: parsed.data.id });
  } catch (error) {
    return actionFail(toActionError(error));
  }
}
