import { Suspense } from "react";
import { LoginForm } from "./form";
import { LogoTile } from "@/components/logo";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center"><LogoTile size={56} /></div>
          <h1 className="text-xl font-semibold tracking-tight">Spruce &amp; Co</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Back office — sign in to continue
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
