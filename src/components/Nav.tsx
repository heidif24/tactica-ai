"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/#features", label: "Features" },
  { href: "/#how", label: "How it works" },
  { href: "/#toolkit", label: "Toolkit" },
  { href: "/pricing", label: "Pricing" },
];

export function Nav() {
  const path = usePathname();
  const isApp = path?.startsWith("/app");

  return (
    <header className="sticky top-0 z-50 border-b border-ink-100/60 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight text-ink-950"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-lumen-500 to-lumen-700 text-sm text-white shadow-soft ring-1 ring-lumen-400/30 transition group-hover:scale-105">
            ✦
          </span>
          <span>
            Lumen
            <span className="ml-1.5 hidden text-[10px] font-sans font-medium uppercase tracking-wider text-ink-400 sm:inline">
              analytics
            </span>
          </span>
        </Link>

        {!isApp && (
          <nav className="hidden items-center gap-1 text-sm text-ink-600 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-full px-3.5 py-1.5 transition hover:bg-ink-50 hover:text-ink-950",
                  path === l.href && "bg-ink-50 font-medium text-ink-950"
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2 sm:gap-3">
          {!isApp && (
            <Link href="/pricing" className="hidden text-sm font-medium text-ink-600 transition hover:text-ink-950 sm:inline">
              Pricing
            </Link>
          )}
          <Link href="/app" className="btn-primary !px-4 !py-2 text-sm">
            {isApp ? "Workspace" : "Open app"}
          </Link>
        </div>
      </div>
    </header>
  );
}
