import Link from "next/link";

const LINKS = [
  { href: "/blog", label: "Demo publisher" },
  { href: "/live", label: "Live demo" },
  { href: "/deals", label: "Agent deals" },
  { href: "/wallet", label: "Agent wallet" },
  { href: "/dashboard", label: "Publisher dashboard" },
];

export function SiteNav() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
        <Link href="/" className="font-semibold tracking-tight">
          Tollgate
        </Link>
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            {link.label}
          </Link>
        ))}
        <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
          PayPal sandbox
        </span>
      </nav>
    </header>
  );
}
