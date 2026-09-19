import { Suspense } from "react";
import { LoginForm } from "./form";
import { LoginArt } from "./art";
import { Logo, Wordmark } from "@/components/logo";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      {/* form */}
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-[46%] lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 flex items-center gap-3">
            <Logo size={44} />
            <Wordmark size="sm" />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1.5 text-sm text-[var(--muted)]">
            Back office for projects, capital and finance.
          </p>

          <div className="mt-8">
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </div>

          <p className="mt-10 text-xs text-[var(--muted)]">
            Access is by invitation. Ask an administrator to add your account.
          </p>
        </div>
      </div>

      {/* artwork */}
      <div className="relative hidden overflow-hidden lg:block lg:w-[54%]">
        <LoginArt />
        {/* scrim so the copy stays legible over the elevation */}
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[#081420] via-[#081420]/90 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-14 pb-20">
          <p className="font-sans text-[11px] uppercase tracking-[0.28em] text-[var(--denim)]">
            Construction &amp; Interior Design
          </p>
          <p className="mt-4 max-w-md font-display text-4xl font-bold leading-[1.15] text-white">
            Built to last, finished to live in.
          </p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">
            Every project, every bill and every rufiyaa of profit — in one place.
          </p>
        </div>
      </div>
    </div>
  );
}
