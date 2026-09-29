// convex/auth.config.ts
import type { AuthConfig } from "convex/server";

const rawDomain = process.env.CLERK_JWT_ISSUER_DOMAIN ?? "";
const domains = Array.from(
  new Set(
    rawDomain
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean),
  ),
);

export default {
  providers: domains.map((domain) => ({
    domain,
    applicationID: "convex",
  })),
} satisfies AuthConfig;
