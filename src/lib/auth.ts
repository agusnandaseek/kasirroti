import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

export type Role = "admin" | "cashier";

export type SessionProfile = {
  id: string;
  fullName: string;
  role: Role;
  email: string;
};

export const getCurrentProfile = cache(async (): Promise<SessionProfile | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  const { data: profile } = await getAdminClient()
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) return null;

  return {
    id: profile.id,
    fullName: profile.full_name,
    role: profile.role as Role,
    email: user.email,
  };
});

export async function requireProfile(): Promise<SessionProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireRole(roles: Role[]): Promise<SessionProfile> {
  const profile = await requireProfile();

  if (!roles.includes(profile.role)) {
    redirect(profile.role === "admin" ? "/admin" : "/cashier/pos");
  }

  return profile;
}

export async function getActionProfile(roles: Role[] = ["cashier", "admin"]): Promise<SessionProfile> {
  const profile = await getCurrentProfile();

  if (!profile) {
    throw new Error("UNAUTHENTICATED");
  }

  if (!roles.includes(profile.role)) {
    throw new Error("AKSES_DITOLAK");
  }

  return profile;
}
