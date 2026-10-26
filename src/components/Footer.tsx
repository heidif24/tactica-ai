import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-ink-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <div className="flex items-center gap-2 font-display font-semibold text-ink-950">
            <span className="text-lumen-600">✦</span> Lumen
          </div>
          <p className="mt-1 text-sm text-ink-500">Light on your data.</p>
        </div>
        <div className="flex gap-6 text-sm text-ink-500">
          <Link href="/pricing" className="hover:text-ink-900">Pricing</Link>
          <Link href="/app" className="hover:text-ink-900">App</Link>
        </div>
        <p className="text-xs text-ink-400">© {new Date().getFullYear()} Lumen. For analysis and learning.</p>
      </div>
    </footer>
  );
}
