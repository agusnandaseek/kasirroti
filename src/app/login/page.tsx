import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Check, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { getCurrentProfile } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Masuk pegawai",
  robots: { index: false, follow: false },
};

const POINTS = [
  "Antrean produksi FIFO berdasarkan waktu masuk",
  "Pre-order dikonfirmasi manual oleh kasir",
  "Pembayaran dicatat saat roti diambil",
];

export default async function LoginPage() {
  const profile = await getCurrentProfile();
  if (profile) {
    redirect(profile.role === "admin" ? "/admin" : "/cashier/pos");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r-[3px] border-ink bg-ink p-10 text-cream lg:flex">
        <div className="dots pointer-events-none absolute inset-0 opacity-[0.08]" />
        <div className="relative">
          <Logo href="/" />
          <div className="mt-16 max-w-lg">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-butter">
              Ruang kerja toko
            </p>
            <h1 className="mt-4 text-5xl uppercase leading-[0.95]">
              Antrean rapi,
              <br />
              roti <span className="text-butter">hangat.</span>
            </h1>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-cream/70">
              Satu tempat untuk mencatat pembayaran walk-in, mengelola pre-order, dan menjaga
              urutan produksi tetap adil.
            </p>
          </div>
        </div>

        <div className="relative mt-12 max-w-md">
          <ul className="space-y-2.5">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-xs text-cream/85">
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center border-2 border-butter bg-butter text-ink">
                  <Check className="size-2.5" strokeWidth={4} />
                </span>
                {point}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex items-center gap-2 border-2 border-cream/25 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-cream/55">
            <ShieldCheck className="size-3.5" strokeWidth={3} />
            Sesi pegawai diverifikasi di server pada setiap aksi
          </div>
        </div>

        <div className="relative mt-10 flex items-center justify-between border-t-2 border-cream/15 pt-4 font-mono text-[9px] uppercase tracking-[0.18em] text-cream/45">
          <span>RotiPOS · Area pegawai</span>
          <span>v1.0</span>
        </div>
      </section>

      <section className="flex flex-col justify-center px-4 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Logo href="/" />
            <Link
              href="/"
              className="inline-flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-muted"
            >
              <ArrowLeft className="size-3" strokeWidth={3} />
              Beranda
            </Link>
          </div>

          <div className="border-[3px] border-ink bg-paper p-6 shadow-hard-lg sm:p-8">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-terracotta">
              Masuk pegawai
            </p>
            <h2 className="mt-2 text-3xl uppercase">Selamat datang.</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Gunakan akun yang diberikan admin. Kasir hanya melihat tiga menu operasional.
            </p>

            <LoginForm />
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
            <Link href="/" className="inline-flex items-center gap-1 hover:text-ink">
              <ArrowLeft className="size-3" strokeWidth={3} />
              Halaman pelanggan
            </Link>
            <span>RotiPOS</span>
          </div>
        </div>
      </section>
    </div>
  );
}
