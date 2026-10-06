import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { readBearerKey } from "@/lib/tollgate/keys";
import { TollgateError, payQuote } from "@/lib/tollgate/service";

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

  try {
    const result = await payQuote({ agentKey, quoteId: parsed.data.quote_id, origin: req.nextUrl.origin });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof TollgateError) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}
