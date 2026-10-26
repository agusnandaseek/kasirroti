import Link from "next/link";
import { LayoutDashboard, LogOut } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { CashierNav } from "@/components/layout/cashier-nav";
import { buttonClasses } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { logoutAction } from "@/app/login/actions";

export const dynamic = "force-dynamic";

export default async function CashierLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  const initials = profile.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b-[3px] border-ink bg-paper">
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-5">
          <div className="flex h-16 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <Logo href="/cashier/pos" size="sm" />
              <span className="hidden items-center gap-1.5 border-2 border-ink bg-butter-soft px-2 py-1 font-mono text-[8px] font-bold uppercase tracking-[0.16em] md:inline-flex">
                <span className="size-1.5 rounded-full bg-mint" aria-hidden />
                Area kasir
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              {profile.role === "admin" ? (
                <Link
                  href="/admin"
                  className={buttonClasses({ variant: "secondary", size: "sm" })}
                >
                  <LayoutDashboard className="size-3.5" strokeWidth={3} />
                  <span className="hidden sm:inline">Admin</span>
                  <span className="sr-only sm:hidden">Buka admin</span>
                </Link>
              ) : null}

              <div className="flex items-center gap-2 border-[3px] border-ink bg-cream px-1.5 py-1">
                <span className="flex size-7 shrink-0 items-center justify-center border-2 border-ink bg-butter font-display text-[10px] leading-none text-ink">
                  {initials}
                </span>
                <div className="hidden min-w-0 leading-tight sm:block">
                  <p className="max-w-32 truncate text-[11px] font-bold">{profile.fullName}</p>
                  <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-muted">
                    {profile.role === "admin" ? "Admin" : "Kasir"}
                  </p>
                </div>
              </div>

              <form action={logoutAction}>
                <button
                  type="submit"
                  className={buttonClasses({
                    variant: "secondary",
                    size: "sm",
                    className: "size-9 border-2 px-0",
                  })}
                  title="Keluar"
                >
                  <LogOut className="size-4" strokeWidth={3} />
                  <span className="sr-only">Keluar</span>
                </button>
              </form>
            </div>
          </div>

          <CashierNav />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-5 sm:px-5 sm:py-6">{children}</main>

      <footer className="border-t-[3px] border-ink bg-paper">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-3 font-mono text-[8px] uppercase tracking-[0.16em] text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>RotiPOS · Area kasir</span>
          <span>Harga & total dihitung ulang di server</span>
        </div>
      </footer>
    </div>
  );
}
