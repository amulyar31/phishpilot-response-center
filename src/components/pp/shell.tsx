import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { LayoutDashboard, FilePlus2, ListChecks, Bot, ClipboardCheck, ScrollText, Settings, Menu, X, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/submit", label: "Report incident", icon: FilePlus2 },
  { to: "/incidents", label: "Incidents", icon: ListChecks },
  { to: "/agents", label: "Agent activity", icon: Bot },
  { to: "/approvals", label: "Approval queue", icon: ClipboardCheck },
  { to: "/audit", label: "Audit logs", icon: ScrollText },
  { to: "/settings", label: "Settings & demo", icon: Settings },
] as const;

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 px-1">
      <span className="flex size-8 items-center justify-center rounded-md bg-brand text-brand-foreground"><ShieldAlert className="size-4.5" /></span>
      <span className="leading-tight">
        <span className="block text-sm font-bold tracking-wide text-navy-foreground">PHISHPILOT</span>
        <span className="block text-[10px] text-navy-muted">Multi-agent phishing response</span>
      </span>
    </Link>
  );
}

function NavList({ onNav }: { onNav?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ to, label, icon: Icon }) => (
        <Link key={to} to={to} onClick={onNav} activeOptions={{ exact: to === "/" }}
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-navy-muted transition-colors hover:bg-navy-border hover:text-navy-foreground"
          activeProps={{ className: "bg-navy-border text-navy-foreground font-medium shadow-[inset_2px_0_0_var(--brand)]" }}>
          <Icon className="size-4" />{label}
        </Link>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r border-navy-border bg-navy p-4 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <Brand />
        <NavList />
        <div className="mt-auto rounded-md border border-navy-border p-3 text-[11px] leading-relaxed text-navy-muted">
          Prototype. Actions are simulated and require analyst approval. Signed in as <span className="text-navy-foreground">Demo Analyst</span>.
        </div>
      </aside>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-navy-border bg-navy px-4 py-3 lg:hidden">
        <Brand />
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-md p-2 text-navy-foreground hover:bg-navy-border"><Menu className="size-5" /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col gap-6 bg-navy p-4">
            <div className="flex items-center justify-between"><Brand /><button aria-label="Close menu" onClick={() => setOpen(false)} className="p-2 text-navy-foreground"><X className="size-5" /></button></div>
            <NavList onNav={() => setOpen(false)} />
          </div>
        </div>
      )}
      <main className={cn("min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8")}>
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
