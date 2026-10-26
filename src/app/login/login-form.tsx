"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LogIn, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { loginAction, type LoginState } from "./actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="mt-7">
      <form action={formAction} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email" required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            placeholder="nama@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>

        <Field label="Password" htmlFor="password" required>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pr-11"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-1 top-1 flex size-9 items-center justify-center border-2 border-transparent text-muted transition hover:border-ink hover:bg-cream"
              aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
            >
              {showPassword ? (
                <EyeOff className="size-4" strokeWidth={2.6} />
              ) : (
                <Eye className="size-4" strokeWidth={2.6} />
              )}
            </button>
          </div>
        </Field>

        {state && !state.ok ? (
          <div
            role="alert"
            className="flex items-start gap-2 border-[3px] border-ink bg-[#fdeae6] px-3 py-2.5 text-xs font-semibold leading-relaxed text-danger"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2.8} />
            {state.error}
          </div>
        ) : null}

        <Button type="submit" size="lg" className="w-full" loading={pending}>
          {pending ? "Memeriksa…" : "Masuk ke POS"}
          {!pending ? <LogIn className="size-4" strokeWidth={3} /> : null}
        </Button>
      </form>
    </div>
  );
}
