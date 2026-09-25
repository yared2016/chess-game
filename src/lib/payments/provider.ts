// src/lib/payments/provider.ts — Payment Provider Factory / Resolver
import { ChapaAdapter } from "./chapa/adapter";
import type { PaymentProvider } from "./types";

let cachedChapaAdapter: ChapaAdapter | null = null;

export function getPaymentProvider(providerId = "chapa"): PaymentProvider {
  switch (providerId.toLowerCase()) {
    case "chapa": {
      if (!cachedChapaAdapter) {
        cachedChapaAdapter = new ChapaAdapter();
      }
      return cachedChapaAdapter;
    }
    default:
      throw new Error(`Unsupported payment provider: ${providerId}`);
  }
}
