import "server-only";
import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  TRACKING_TOKEN_PEPPER: z
    .string()
    .min(32, "TRACKING_TOKEN_PEPPER minimal 32 karakter"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Environment variables tidak lengkap — ${missing}`);
}

export const env = {
  supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  serviceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
  appUrl: parsed.data.NEXT_PUBLIC_APP_URL.replace(/\/$/, ""),
  trackingPepper: parsed.data.TRACKING_TOKEN_PEPPER,
  isProduction: process.env.NODE_ENV === "production",
};
