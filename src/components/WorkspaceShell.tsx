"use client";

import type { ReactNode } from "react";

export function WorkspaceShell({
  title,
  subtitle,
  badge,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-[80vh] pb-16">
      <div className="border-b border-ink-100/80 bg-white/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <p className="section-label">Workspace</p>
            <h1 className="display mt-1 text-3xl sm:text-4xl">{title}</h1>
            {subtitle && <p className="mt-2 max-w-xl text-sm text-ink-500">{subtitle}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {badge}
            {actions}
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">{children}</div>
    </div>
  );
}

export function Panel({
  title,
  step,
  children,
  className = "",
}: {
  title: string;
  step?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-ink-100/90 bg-white/90 p-6 shadow-soft backdrop-blur-sm ${className}`}>
      <div className="mb-4 flex items-center gap-2">
        {step && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-lumen-50 text-[11px] font-bold text-lumen-700 ring-1 ring-lumen-100">
            {step}
          </span>
        )}
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function ResultCard({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border p-6 shadow-soft backdrop-blur-sm ${
        accent
          ? "border-lumen-200 bg-gradient-to-br from-lumen-50/90 to-white"
          : "border-ink-100/90 bg-white/95"
      }`}
    >
      <h3 className="text-sm font-semibold tracking-tight text-ink-900">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}
