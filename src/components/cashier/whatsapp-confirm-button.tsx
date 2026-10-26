import { MessageCircle } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { env } from "@/lib/env";
import type { OrderView } from "@/lib/types";
import { buildPreorderWhatsappUrl } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

export function WhatsappConfirmButton({
  order,
  storeName,
  className,
}: {
  order: OrderView;
  storeName?: string;
  className?: string;
}) {
  const trackingCode = order.trackingCode;
  const href = trackingCode
    ? buildPreorderWhatsappUrl({
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        trackingCode,
        trackingUrl: `${env.appUrl}/track/${trackingCode}`,
        items: order.items,
        totalAmount: order.totalAmount,
        storeName,
      })
    : null;

  if (!href) {
    return (
      <span
        aria-disabled="true"
        title={
          trackingCode
            ? "Nomor WhatsApp pelanggan tidak valid."
            : "Kode lacak belum tersedia untuk pesanan ini."
        }
        className={buttonClasses({
          variant: "secondary",
          size: "sm",
          className: cn("cursor-not-allowed opacity-45", className),
        })}
      >
        <MessageCircle className="size-3.5" strokeWidth={3} />
        Konfirmasi WhatsApp
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClasses({
        variant: "secondary",
        size: "sm",
        className: cn("bg-mint-soft hover:bg-[#c3dfc6]", className),
      })}
    >
      <MessageCircle className="size-3.5" strokeWidth={3} />
      Konfirmasi WhatsApp
    </a>
  );
}
