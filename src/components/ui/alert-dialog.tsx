"use client";

import type { ComponentProps, ReactNode } from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/button";

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

export function AlertDialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/55 backdrop-blur-[2px]" />
      <AlertDialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 border-[3px] border-ink bg-paper p-6 shadow-hard-lg",
          className,
        )}
        {...props}
      >
        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  );
}

export function AlertDialogTitle({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      className={cn("text-xl uppercase leading-tight", className)}
      {...props}
    />
  );
}

export function AlertDialogDescription({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      className={cn("mt-2 text-sm leading-relaxed text-muted", className)}
      {...props}
    />
  );
}

export function AlertDialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end", className)} {...props} />
  );
}

export function AlertDialogCancel({
  className,
  children = "Batal",
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      className={buttonClasses({ variant: "secondary", size: "md", className })}
      {...props}
    >
      {children}
    </AlertDialogPrimitive.Cancel>
  );
}

export function AlertDialogAction({
  className,
  children = "Ya, lanjutkan",
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Action> & { children?: ReactNode }) {
  return (
    <AlertDialogPrimitive.Action
      className={buttonClasses({ variant: "danger", size: "md", className })}
      {...props}
    >
      {children}
    </AlertDialogPrimitive.Action>
  );
}
