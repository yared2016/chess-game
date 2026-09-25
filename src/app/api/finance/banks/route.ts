// src/app/api/finance/banks/route.ts — Fetch supported payout banks
import { getPaymentProvider } from "@/lib/payments/provider";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const provider = getPaymentProvider("chapa");
    const banks = await provider.getSupportedBanks();
    return Response.json({ banks });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
