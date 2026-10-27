import Link from "next/link";

export function Footer() {
  return (
    <footer className="relative mt-auto border-t border-ink-100/80 bg-white/80">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <div className="flex items-center gap-2 font-display text-lg font-semibold text-ink-950">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-lumen-500 to-lumen-700 text-xs text-white">
                ✦
              </span>
              Lumen
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-500">
              Light on your data. Statistical clarity for analysts, founders, and teams —
              regression to Cox, briefs you can share.
            </p>
          </div>
          <div>
            <p className="section-label">Product</p>
            <ul className="mt-3 space-y-2 text-sm text-ink-600">
              <li><Link href="/app" className="hover:text-lumen-700">Workspace</Link></li>
              <li><Link href="/pricing" className="hover:text-lumen-700">Pricing</Link></li>
              <li><Link href="/#toolkit" className="hover:text-lumen-700">Toolkit</Link></li>
            </ul>
          </div>
          <div>
            <p className="section-label">Methods</p>
            <ul className="mt-3 space-y-2 text-sm text-ink-600">
              <li>OLS · ANOVA · t-test</li>
              <li>Kaplan–Meier · Cox PH</li>
              <li>Multilevel · Chi-square</li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-ink-100 pt-6 text-xs text-ink-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Lumen. For analysis and learning.</p>
          <p>Browser-side processing on the free tier · Upgrade for unlimited runs</p>
        </div>
      </div>
    </footer>
  );
}
