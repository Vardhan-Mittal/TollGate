// Minimal renderer for the seeded articles: "## " headings, "- " lists, paragraphs.
export function ArticleBody({ body }: { body: string }) {
  const blocks = body.trim().split(/\n\s*\n/);

  return (
    <div className="space-y-5 text-[17px] leading-8 text-zinc-700 dark:text-zinc-300">
      {blocks.map((block, i) => {
        if (block.startsWith("## ")) {
          return (
            <h2 key={i} className="pt-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {block.slice(3)}
            </h2>
          );
        }
        const lines = block.split("\n");
        if (lines.every((line) => line.startsWith("- "))) {
          return (
            <ul key={i} className="list-disc space-y-2 pl-6">
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
