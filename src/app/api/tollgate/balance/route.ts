import { NextResponse, type NextRequest } from "next/server";
import { centsToMoney } from "@/lib/money";
import { readBearerKey } from "@/lib/tollgate/keys";
import { TollgateError, findAgentByKey } from "@/lib/tollgate/service";

export async function GET(req: NextRequest) {
  const agentKey = readBearerKey(req.headers);
  if (!agentKey) {
    return NextResponse.json({ error: "missing_agent_key", message: "Send Authorization: Bearer <agent API key>." }, { status: 401 });
  }

  try {
    const agent = await findAgentByKey(agentKey);
    return NextResponse.json({
      agent: agent.name,
      balance: centsToMoney(agent.balanceCents),
      daily_budget: agent.dailyBudgetCents == null ? null : centsToMoney(agent.dailyBudgetCents),
    });
  } catch (err) {
    if (err instanceof TollgateError) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}
