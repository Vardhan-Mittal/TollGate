"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-24">
      <p className="text-sm font-medium uppercase tracking-widest text-emerald-600">Tollgate</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
        Something went <span className="font-serif text-[1.08em] font-normal italic text-emerald-600">sideways.</span>
      </h1>
      <p className="mt-4 max-w-xl text-zinc-600 dark:text-zinc-400">
        This page couldn&apos;t load, usually because the database or PayPal sandbox was slow to answer. Trying again normally fixes it.
      </p>
      {error.digest && <p className="mt-2 text-xs text-zinc-500">Reference: {error.digest}</p>}
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-700"
        >
          Try again
        </button>
        <Link href="/" className="rounded-lg border border-zinc-300 px-5 py-2.5 font-medium dark:border-zinc-700">
          Back to home
        </Link>
      </div>
    </main>
  );
}
