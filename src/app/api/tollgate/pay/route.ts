import { NextResponse, after, type NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/http";
import { readBearerKey } from "@/lib/tollgate/keys";
import { TollgateError, findAgentByKey, payQuote } from "@/lib/tollgate/service";
import { autoRecharge } from "@/lib/wallet";

const Body = z.object({ quote_id: z.string().min(1) });

export async function POST(req: NextRequest) {
  const agentKey = readBearerKey(req.headers);
  if (!agentKey) {
    return NextResponse.json(
      { error: "missing_agent_key", message: "Send Authorization: Bearer <agent API key>." },
      { status: 401 },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request", message: "Body must be { quote_id }." }, { status: 400 });
  }

  const pay = () => payQuote({ agentKey, quoteId: parsed.data.quote_id, origin: req.nextUrl.origin });

  try {
    let result;
    try {
      result = await pay();
    } catch (err) {
      // Out of money: if the operator saved PayPal for auto-recharge, refill
      // from it right now and retry once, so the agent never stalls.
      if (!(err instanceof TollgateError && err.code === "insufficient_funds")) throw err;
      const agent = await findAgentByKey(agentKey);
      const recharged = await autoRecharge(agent.id, { force: true });
      if (!recharged?.credited) throw err;
      result = await pay();
    }

    // Keep the wallet above the operator's threshold without slowing this response.
    after(async () => {
      const agent = await findAgentByKey(agentKey);
      await autoRecharge(agent.id);
    });

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
