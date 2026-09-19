import { Suspense } from "react";
import { LoginForm } from "./form";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-5 flex justify-center"><Logo size={72} /></div>
          <h1 className="font-serif text-2xl tracking-tight">Spruce &amp; Co</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Construction &amp; Interior Design · Back office
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
