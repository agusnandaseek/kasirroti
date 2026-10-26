import Link from "next/link";
import { ExternalLink, LogOut } from "lucide-react";
import { AdminMobileMenu } from "@/components/layout/admin-mobile-menu";
import { AdminNav } from "@/components/layout/admin-nav";
import { buttonClasses } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { logoutAction } from "@/app/login/actions";
import { getSettings } from "@/lib/data/settings";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [profile, settings] = await Promise.all([requireRole(["admin"]), getSettings()]);

  const initials = profile.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[258px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r-[3px] border-ink bg-ink text-cream lg:flex">
        <div className="border-b-[3px] border-cream/15 px-5 py-5">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="relative flex size-10 shrink-0 items-center justify-center border-[3px] border-cream bg-butter font-display text-xl leading-none text-ink">
              R
              <span className="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-ink bg-cream" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-display text-xl uppercase tracking-tight">
                Roti<span className="text-butter">POS</span>
              </span>
              <span className="mt-1 font-mono text-[8px] font-semibold uppercase tracking-[0.22em] text-cream/50">
                Ruang admin
              </span>
            </span>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-5">
          <AdminNav />
        </div>

        <div className="border-t-[3px] border-cream/15 p-3">
          <div className="border-2 border-cream/25 p-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center border-2 border-cream bg-cream font-display text-xs text-ink">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold">{profile.fullName}</p>
                <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-cream/50">
                  {settings.storeName}
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                href="/cashier/pos"
                className={buttonClasses({
                  variant: "secondary",
                  size: "sm",
                  className: "h-8 border-cream bg-transparent px-2 text-[8px] text-cream hover:bg-cream hover:text-ink",
                })}
              >
                <ExternalLink className="size-3" strokeWidth={3} />
                Kasir
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className={buttonClasses({
                    variant: "secondary",
                    size: "sm",
                    className: "h-8 w-full border-cream bg-transparent px-2 text-[8px] text-cream hover:bg-cream hover:text-ink",
                  })}
                >
                  <LogOut className="size-3" strokeWidth={3} />
                  Keluar
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 border-b-[3px] border-ink bg-paper lg:hidden">
          <div className="flex items-center justify-between gap-3 px-3 py-3">
            <Link href="/admin" className="flex min-w-0 items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center border-[3px] border-ink bg-butter font-display text-base leading-none">
                R
              </span>
              <span className="font-display text-lg uppercase leading-none">
                Roti<span className="text-terracotta">POS</span>
              </span>
              <span className="border-2 border-ink bg-ink px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.12em] text-cream">
                Admin
              </span>
            </Link>

            <AdminMobileMenu
              fullName={profile.fullName}
              initials={initials}
              storeName={settings.storeName}
            />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-3 py-5 sm:px-5 sm:py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>

        <footer className="border-t-[3px] border-ink bg-paper">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-3 font-mono text-[8px] uppercase tracking-[0.16em] text-muted sm:flex-row sm:items-center sm:justify-between">
            <span>RotiPOS · Area admin</span>
            <span>Omzet dihitung dari pembayaran tercatat</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
