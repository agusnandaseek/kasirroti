import {
  ChartColumnBig,
  LayoutDashboard,
  Package,
  ReceiptText,
  ScrollText,
  Settings,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AdminNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type AdminNavGroup = {
  label: string;
  links: AdminNavLink[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Utama",
    links: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/sales", label: "Penjualan", icon: ReceiptText },
      { href: "/admin/reports", label: "Laporan", icon: ChartColumnBig },
    ],
  },
  {
    label: "Operasional",
    links: [
      { href: "/admin/preorders", label: "Pre-order", icon: Ticket },
      { href: "/admin/products", label: "Produk", icon: Package },
    ],
  },
  {
    label: "Sistem",
    links: [
      { href: "/admin/employees", label: "Karyawan", icon: Users },
      { href: "/admin/settings", label: "Pengaturan", icon: Settings },
      { href: "/admin/logs", label: "Log Aktivitas", icon: ScrollText },
    ],
  },
];

export function isAdminNavActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}
