"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/blog", label: "Demo publisher" },
  { href: "/live", label: "Live demo" },
  { href: "/deals", label: "Deals" },
  { href: "/wallet", label: "Wallet" },
  { href: "/dashboard", label: "Dashboard" },
];

export function ActiveNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}

/** The nav links; `pathname` is null while the active page is still unknown. */
export function NavLinks({ pathname }: { pathname: string | null }) {
  return LINKS.map((link) => {
    const active = pathname !== null && (pathname === link.href || pathname.startsWith(`${link.href}/`));
    return (
      <Link
        key={link.href}
        href={link.href}
        aria-current={active ? "page" : undefined}
        className={`relative shrink-0 rounded-full px-3 py-1.5 transition-colors ${
          active ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        }`}
      >
        {/* One soft highlight that glides to whichever page is open. */}
        {active && (
          <motion.span layoutId="nav-active" className="absolute inset-0 rounded-full bg-zinc-900/[0.06] dark:bg-white/10" />
        )}
        <span className="relative">{link.label}</span>
      </Link>
    );
  });
}
