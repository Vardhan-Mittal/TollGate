import Link from "next/link";
import { LazyAurora, LazyDotWordmark } from "@/components/footer-art";
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
      {/* The aurora sits low, behind the wordmark, and melts away before it reaches the headline. */}
      <div className="absolute inset-x-0 top-0 bottom-14 -z-10 [mask-image:radial-gradient(ellipse_70%_55%_at_50%_78%,black_20%,transparent_100%)]">
        <LazyAurora className="h-full w-full" />
      </div>

      <div className="mx-auto max-w-5xl px-4">
        <Reveal className="text-center">
          <h2 className="text-4xl font-semibold tracking-[-0.04em] text-balance sm:text-6xl">
            <span className="text-sheen">Let the machines </span>
            <span className="font-serif text-[1.08em] font-normal italic tracking-[-0.01em] text-emerald-600 dark:text-emerald-400">pay their way.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-pretty text-zinc-600 dark:text-zinc-400">
            Every page an agent reads can pay the person who wrote it: cents from a PayPal-funded wallet, cashed out through PayPal.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Lift>
              <Link
                href="/live"
                className="group inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3 font-medium text-white shadow-[0_8px_24px_rgb(0_0_0/0.18)] transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:shadow-[0_0_32px_rgb(255_255_255/0.12)] dark:hover:bg-white"
              >
                Watch an agent pay <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            </Lift>
            <a
              href={REPO}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-zinc-200 bg-white/60 px-6 py-3 font-medium backdrop-blur transition-colors hover:border-zinc-300 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20"
            >
              View the code ↗
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.1} className="mt-16 sm:mt-24">
          <LazyDotWordmark />
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
