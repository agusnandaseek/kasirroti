import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import type { EmployeeView } from "@/lib/types";

type ProfileRow = {
  id: string;
  full_name: string;
  role: "admin" | "cashier";
  is_active: boolean;
  created_at: string;
};

export async function listEmployees(): Promise<EmployeeView[]> {
  const admin = getAdminClient();

  const [profilesResult, usersResult] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, role, is_active, created_at")
      .order("created_at", { ascending: true }),
    admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
  ]);

  if (profilesResult.error) {
    throw new Error(`Gagal memuat pegawai: ${profilesResult.error.message}`);
  }
  if (usersResult.error) {
    throw new Error(`Gagal memuat akun: ${usersResult.error.message}`);
  }

  const emailById = new Map(
    usersResult.data.users.map((user) => [user.id, user.email ?? "—"]),
  );

  return ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => ({
    id: profile.id,
    fullName: profile.full_name,
    email: emailById.get(profile.id) ?? "—",
    role: profile.role,
    isActive: profile.is_active,
    createdAt: profile.created_at,
  }));
}
