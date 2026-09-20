import type { UserRole } from "./types";

export interface NavItem {
  href: string;
  label: string;
  /** Roles allowed to see this item. Omitted = everyone signed in. */
  roles?: UserRole[];
}

export interface NavGroup {
  group: string;
  /** Collapsed by default unless the current route is inside it. */
  defaultOpen?: boolean;
  items: NavItem[];
}

const ALL: UserRole[] = ["admin", "manager", "finance", "viewer"];
const MONEY: UserRole[] = ["admin", "manager", "finance"];

/**
 * Sidebar navigation. Modules are added back here one at a time as they are
 * built; the earlier full set lives in the git history.
 */
export const NAV: NavGroup[] = [
  {
    group: "Core",
    defaultOpen: true,
    items: [
      { href: "/", label: "Dashboard", roles: ALL },
      { href: "/projects", label: "Projects", roles: ALL },
      { href: "/clients", label: "Clients", roles: ALL },
      { href: "/tasks", label: "Tasks & Calendar", roles: ALL },
      { href: "/pnl", label: "Project P&L", roles: MONEY },
      { href: "/gst", label: "GST Input Schedule", roles: MONEY },
    ],
  },
];

/** Shortcuts pinned above the navigation. Only routes present in NAV show. */
export const QUICK_ACTIONS: NavItem[] = [];

const navHrefs = new Set(NAV.flatMap((g) => g.items.map((i) => i.href)));

export function visibleFor(role: UserRole | undefined): NavGroup[] {
  const r = role ?? "viewer";
  return NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.roles || i.roles.includes(r)),
  })).filter((g) => g.items.length > 0);
}

export function quickActionsFor(role: UserRole | undefined): NavItem[] {
  const r = role ?? "viewer";
  // a shortcut to a route that is not in the nav would be a dead end
  return QUICK_ACTIONS.filter(
    (a) => navHrefs.has(a.href) && (!a.roles || a.roles.includes(r)),
  );
}
