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
        className={`relative py-1 ${active ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"}`}
      >
        {link.label}
        {/* One underline that glides to whichever page is open. */}
        {active && <motion.span layoutId="nav-underline" className="absolute inset-x-0 -bottom-[13px] h-0.5 rounded-full bg-emerald-500" />}
      </Link>
    );
  });
}
