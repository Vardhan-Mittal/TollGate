import { PageHeader, PageShell } from "@/components/ui/kit";
import { AgentConsole } from "./agent-console";

export default function AgentPage() {
  return (
    <PageShell width="6xl">
      <PageHeader
        eyebrow="Research agent"
        title="An AI agent that decides what is"
        accent="worth paying for."
        description="Give it a question and a budget. It browses a Tollgate-protected publisher, reads each 402 price quote, decides what is worth paying for, pays from its PayPal-funded wallet, and answers with citations to what it bought."
      />
      <AgentConsole />
    </PageShell>
  );
}
