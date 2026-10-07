import { AgentConsole } from "./agent-console";

export default function AgentPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Research agent</h1>
      <p className="mt-2 max-w-3xl text-zinc-600 dark:text-zinc-400">
        Give an AI agent a question and a budget. It browses a Tollgate-protected publisher, reads each 402 price quote,
        decides what is worth paying for, pays from its PayPal-funded wallet, and answers with citations to what it bought.
      </p>
      <AgentConsole />
    </main>
  );
}
