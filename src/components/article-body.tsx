// Minimal renderer for the seeded articles: "## " headings, "- " lists, paragraphs.
export function ArticleBody({ body }: { body: string }) {
  const blocks = body.trim().split(/\n\s*\n/);

  return (
    <div className="flex max-w-[65ch] flex-col gap-5 text-[17px] leading-[1.7] text-pretty text-zinc-700 dark:text-zinc-300">
      {blocks.map((block, i) => {
        if (block.startsWith("## ")) {
          return (
            <h2 key={i} className="pt-5 text-xl font-semibold tracking-tight text-balance text-zinc-900 dark:text-zinc-100">
              {block.slice(3)}
            </h2>
          );
        }
        const lines = block.split("\n");
        if (lines.every((line) => line.startsWith("- "))) {
          return (
            <ul key={i} className="flex list-disc flex-col gap-2 pl-6 marker:text-emerald-500">
              {lines.map((line, j) => (
                <li key={j}>{line.slice(2)}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{block}</p>;
      })}
    </div>
  );
}
