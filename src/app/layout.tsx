import type { Metadata, Viewport } from "next";
import { Archivo_Black, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const archivo = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-archivo",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "RotiPOS — Pesan roti, bayar di toko",
    template: "%s · RotiPOS",
  },
  description:
    "Pre-order roti tanpa akun, konfirmasi manual oleh kasir, dan bayar saat pengambilan di toko.",
  applicationName: "RotiPOS",
};

export const viewport: Viewport = {
  themeColor: "#f6ead5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${archivo.variable} ${jakarta.variable} ${jetbrains.variable}`}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
