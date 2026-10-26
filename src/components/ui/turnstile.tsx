"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          action?: string;
          cData?: string;
          callback?: (token: string) => void;
          "error-callback"?: (errorCode?: string) => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "flexible" | "compact";
          retry?: "auto" | "never";
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoaded?: () => void;
  }
}

const SCRIPT_ID = "cf-turnstile-script";

type Props = {
  action?: string;
  onSuccess?: (token: string) => void;
  onError?: (errorCode?: string) => void;
  onExpire?: () => void;
  className?: string;
  theme?: "light" | "dark" | "auto";
};

export function TurnstileWidget({
  action,
  onSuccess,
  onError,
  onExpire,
  className,
  theme = "light",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [token, setToken] = useState("");
  const [loaded, setLoaded] = useState(false);

  const siteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey) return;
    const key = siteKey;

    let isMounted = true;

    function renderWidget() {
      if (!isMounted || !containerRef.current || !window.turnstile) return;

      // Clean up previous widget if already rendered
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
        widgetIdRef.current = null;
      }

      try {
        const id = window.turnstile.render(containerRef.current, {
          sitekey: key,
          action,
          theme,
          callback: (receivedToken: string) => {
            if (!isMounted) return;
            setToken(receivedToken);
            onSuccess?.(receivedToken);
          },
          "error-callback": (err?: string) => {
            if (!isMounted) return;
            setToken("");
            onError?.(err);
          },
          "expired-callback": () => {
            if (!isMounted) return;
            setToken("");
            onExpire?.();
          },
        });
        widgetIdRef.current = id;
        setLoaded(true);
      } catch (err) {
        console.error("[turnstile-render-error]", err);
      }
    }

    // Check if script is already present
    if (window.turnstile) {
      renderWidget();
    } else {
      const existingScript = document.getElementById(SCRIPT_ID);
      if (!existingScript) {
        const script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.onload = () => {
          renderWidget();
        };
        document.head.appendChild(script);
      } else {
        existingScript.addEventListener("load", renderWidget);
      }
    }

    return () => {
      isMounted = false;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, action, theme, onSuccess, onError, onExpire]);

  if (!siteKey) {
    return (
      <div className="border border-dashed border-ink/40 p-2 text-center font-mono text-[9px] text-muted">
        Cloudflare Turnstile Key belum diset di .env.local
      </div>
    );
  }

  return (
    <div className={cn("min-h-[65px] my-2", className)}>
      <input type="hidden" name="cf-turnstile-response" value={token} />
      <div ref={containerRef} className="flex justify-center" />
      {!loaded ? (
        <div className="flex items-center justify-center gap-1.5 py-2 font-mono text-[9px] uppercase tracking-wider text-muted">
          <ShieldCheck className="size-3.5 animate-pulse text-terracotta" strokeWidth={2.8} />
          Memuat verifikasi keamanan Cloudflare…
        </div>
      ) : null}
    </div>
  );
}
