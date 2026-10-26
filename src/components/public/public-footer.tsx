import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SiteCredit } from "@/components/public/site-credit";
import { buttonClasses } from "@/components/ui/button";

export function PublicFooter({ storeName }: { storeName: string }) {
  return (
    <footer className="border-t-[3px] border-ink bg-ink text-cream">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div>
          <Logo href="/" />
          <p className="mt-3 max-w-xs text-xs leading-relaxed text-cream/70">
            Pre-order roti dari {storeName}. Pesanan dikonfirmasi manual oleh kasir dan dibayar
            saat pengambilan di toko.
          </p>
        </div>

        <div>
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-butter">
            Pelanggan
          </p>
          <div className="mt-3 flex flex-col items-start gap-2 text-xs text-cream/80">
            <Link href="/preorder" className="hover:text-butter">
              Buat pre-order
            </Link>
            <Link href="/lacak" className="hover:text-butter">
              Lacak pesanan
            </Link>
          </div>
        </div>

        <div>
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-butter">
            Pegawai
          </p>
          <div className="mt-3 flex flex-col items-start gap-2 text-xs text-cream/80">
            <Link href="/login" className="hover:text-butter">
              Masuk kasir / admin
            </Link>
            <Link
              href="/login"
              className={buttonClasses({
                variant: "primary",
                size: "sm",
                className: "mt-1",
              })}
            >
              Buka POS
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t-2 border-cream/20">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-4 font-mono text-[9px] uppercase tracking-[0.16em] text-cream/55 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} {storeName}</span>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <span>Bayar di toko · Konfirmasi kasir</span>
            <SiteCredit className="text-cream/55 hover:text-butter" />
          </div>
        </div>
      </div>
    </footer>
  );
}
