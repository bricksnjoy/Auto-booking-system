import { Suspense } from "react";
import { LoginForm } from "./form";
import { LoginArt } from "./art";
import { Logo, Wordmark } from "@/components/logo";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface)] p-4 sm:p-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl bg-[var(--field)] shadow-[0_24px_60px_-20px_rgba(13,27,42,0.35)] lg:grid-cols-2">
        {/* form */}
        <div className="flex flex-col justify-center px-8 py-12 sm:px-12">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-9 flex items-center gap-3">
              <Logo size={40} />
              <Wordmark size="sm" />
            </div>

            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="mt-1.5 text-sm text-[var(--muted)]">
              Back office for projects, capital and finance.
            </p>

            <div className="mt-7">
              <Suspense fallback={null}>
                <LoginForm />
              </Suspense>
            </div>

            <p className="mt-8 text-xs text-[var(--muted)]">
              Access is by invitation. Ask an administrator to add your account.
            </p>
          </div>
        </div>

        {/* artwork */}
        <div className="relative hidden min-h-[560px] overflow-hidden lg:block">
          <LoginArt />
          {/* scrim so the copy stays legible over the elevation */}
          <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[#081420] via-[#081420]/90 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-10">
            <p className="font-sans text-[10px] uppercase tracking-[0.26em] text-[var(--denim)]">
              Construction &amp; Interior Design
            </p>
            <p className="mt-3.5 max-w-xs font-display text-[30px] font-bold leading-[1.18] text-white">
              Raising the Standard, one build at a time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
