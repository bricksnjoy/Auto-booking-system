import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { visibleFor, quickActionsFor } from "@/lib/nav";
import { signOut } from "@/app/actions/auth";
import { initials } from "@/lib/format";
import { Badge } from "@/components/ui";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, job_title")
    .eq("id", user.id)
    .single();

  const name = profile?.full_name || user.email || "User";
  const groups = visibleFor(profile?.role);
  const quickActions = quickActionsFor(profile?.role);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] md:block">
        <div className="flex h-16 items-center gap-2.5 border-b border-[var(--border)] px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand)] text-sm font-bold text-white">
            S
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Spruce &amp; Co</p>
            <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
              Back Office
            </p>
          </div>
        </div>
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto">
          <Sidebar groups={groups} quickActions={quickActions} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-6">
          <p className="text-sm text-[var(--muted)] md:hidden">Spruce &amp; Co</p>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{name}</p>
              <p className="text-xs text-[var(--muted)]">
                {profile?.job_title || user.email}
              </p>
            </div>
            <Badge value={profile?.role} />
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-soft)] text-xs font-semibold text-[var(--brand)]">
              {initials(name)}
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--brand-soft)] hover:text-[var(--text)]"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
