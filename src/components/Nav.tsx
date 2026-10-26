"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/#features", label: "Features" },
  { href: "/#how", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-ink-100/80 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-ink-950">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-lumen-600 text-sm text-white shadow-soft">✦</span>
          Lumen
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-ink-600 sm:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={cn("transition hover:text-ink-950", path === l.href && "text-ink-950 font-medium")}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/app" className="rounded-full bg-ink-950 px-4 py-2 text-sm font-medium text-white shadow-soft transition hover:bg-ink-800">
            Open app
          </Link>
        </div>
      </div>
    </header>
  );
}
