// src/app/api/finance/banks/route.ts — Fetch supported payout banks & mode info
import { getPaymentProvider } from "@/lib/payments/provider";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const provider = getPaymentProvider("chapa");
    const banks = await provider.getSupportedBanks();
    const isTestMode =
      process.env.CHAPA_MODE === "test" ||
      (process.env.CHAPA_SECRET_KEY || "CHASECK_TEST-").startsWith("CHASECK_TEST-");
    return Response.json({ banks, isTestMode });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
