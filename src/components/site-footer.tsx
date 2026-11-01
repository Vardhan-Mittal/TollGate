import Link from "next/link";
import { Aurora } from "@/components/aurora";
import { DotWordmark } from "@/components/dot-wordmark";
import { Lift, Reveal } from "@/components/motion";

const REPO = "https://github.com/Vardhan-Mittal/TollGate";

const LINKS = [
  { href: "/live", label: "Live demo" },
  { href: "/dashboard", label: "Dashboard" },
  { href: REPO, label: "GitHub", external: true },
  { href: `${REPO}/blob/main/LICENSE`, label: "MIT license", external: true },
];

/** The closing section on every page: one last call to action, the wordmark, and the fine print. */
export function SiteFooter() {
  return (
    <footer className="relative isolate mt-auto w-full overflow-hidden pt-28 sm:pt-40">
      {/* The aurora melts away on every side, so it never shows a hard edge. */}
      <div className="absolute inset-x-0 top-0 bottom-14 -z-10 [mask-image:radial-gradient(ellipse_75%_70%_at_50%_55%,black_30%,transparent_100%)]">
        <Aurora className="h-full w-full" />
      </div>

      <div className="mx-auto max-w-5xl px-4">
        <Reveal className="text-center">
          <h2 className="text-4xl font-bold tracking-tight text-balance sm:text-6xl">
            Let the machines <span className="font-serif text-[1.08em] font-normal italic text-emerald-600">pay their way.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-pretty text-zinc-600 dark:text-zinc-400">
            Every page an agent reads can pay the person who wrote it: cents from a PayPal-funded wallet, cashed out through PayPal.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Lift>
              <Link href="/live" className="block rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-700">
                Watch an agent pay
              </Link>
            </Lift>
            <a
              href={REPO}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-zinc-300 bg-background/60 px-5 py-2.5 font-medium backdrop-blur transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500"
            >
              View the code ↗
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.1} className="mt-16 sm:mt-24">
          <DotWordmark />
        </Reveal>
      </div>

      <div className="mt-10 border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Tollgate</span> · Built for the PayPal AI hackathon · Runs on the
            PayPal sandbox
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LINKS.map((link) => (
              <li key={link.label}>
                {link.external ? (
                  <a href={link.href} target="_blank" rel="noreferrer" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                    {link.label}
                  </a>
                ) : (
                  <Link href={link.href} className="hover:text-zinc-900 dark:hover:text-zinc-100">
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
