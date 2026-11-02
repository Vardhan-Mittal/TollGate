import { getBoardData } from "./data";
import { LiveBoardWindow } from "./live-board-window";

/** Loads the demo publisher's traffic, pricing, deals and Guardian events for the tabbed window. */
export async function LiveBoard() {
  // A slow or unreachable database must not take the landing page down with it.
  const data = await getBoardData().catch((err) => {
    console.error("live board: could not load board data", err);
    return null;
  });
  if (!data) {
    return (
      <p className="mt-10 rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
        Live traffic is taking a moment to load. Refresh, or open the publisher dashboard.
      </p>
    );
  }
  return <LiveBoardWindow data={data} />;
}

/** Same footprint as the tab bar and window, so the page doesn't jump when data arrives. */
export function LiveBoardSkeleton() {
  return (
    <div aria-hidden className="mt-10">
      <div className="mb-5 flex justify-center">
        <div className="h-[42px] w-80 max-w-full rounded-full border border-zinc-200 bg-white/70 dark:border-zinc-800 dark:bg-zinc-950/70" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white/70 dark:border-zinc-800 dark:bg-zinc-950/70">
        <div className="flex h-10 items-center gap-1.5 border-b border-zinc-200 px-4 dark:border-zinc-800">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          ))}
        </div>
        <div className="flex h-[560px] sm:h-[506px]">
          <div className="hidden w-52 shrink-0 border-r border-zinc-200 md:block dark:border-zinc-800" />
          <div className="flex-1 space-y-3 overflow-hidden p-4">
            <div className="h-8 rounded-lg bg-zinc-100 motion-safe:animate-pulse dark:bg-zinc-900" />
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="h-11 rounded-lg bg-zinc-100/70 motion-safe:animate-pulse dark:bg-zinc-900/70" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
