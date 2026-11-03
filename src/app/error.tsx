"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";
import { PageHeader, PageShell, ui } from "@/components/ui/kit";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageShell>
      <div className="py-12 sm:py-16">
        <PageHeader
          eyebrow="Tollgate"
          title="Something went"
          accent="sideways."
          description="This page couldn't load, usually because the database or PayPal sandbox was slow to answer. Trying again normally fixes it."
          actions={
            <>
              <button type="button" onClick={() => retry()} className={ui.btnPrimary}>
                Try again
              </button>
              <Link href="/" className={ui.btnSecondary}>
                Back to home
              </Link>
            </>
          }
        />
        {error.digest && <p className="mt-6 font-mono text-xs text-zinc-500">Reference: {error.digest}</p>}
      </div>
    </PageShell>
  );
}
