"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/blog", label: "Demo publisher" },
  { href: "/live", label: "Live demo" },
  { href: "/deals", label: "Agent deals" },
  { href: "/wallet", label: "Agent wallet" },
  { href: "/dashboard", label: "Publisher dashboard" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-background/80 backdrop-blur dark:border-zinc-800">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
        <Link href="/" className="font-semibold tracking-tight">
          Tollgate
        </Link>
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`relative py-1 ${active ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"}`}
            >
              {link.label}
              {/* One underline that glides to whichever page is open. */}
              {active && <motion.span layoutId="nav-underline" className="absolute inset-x-0 -bottom-[13px] h-0.5 rounded-full bg-emerald-500" />}
            </Link>
          );
        })}
        <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
          PayPal sandbox
        </span>
      </nav>
    </header>
  );
}
