"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "!rounded-none !border-[3px] !border-ink !bg-paper !font-sans !text-ink !shadow-[6px_6px_0_0_#171310]",
          title: "!text-sm !font-bold",
          description: "!text-xs !text-[#746458]",
          actionButton: "!bg-ink !text-cream !rounded-none",
          cancelButton: "!bg-cream !text-ink !rounded-none",
          error: "!bg-[#fdeae6]",
          success: "!bg-[#e7f1e4]",
          closeButton: "!border-ink !bg-paper",
        },
      }}
    />
  );
}
