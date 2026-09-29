// convex/auth.config.ts
import type { AuthConfig } from "convex/server";

const rawDomains =
  process.env.CLERK_JWT_ISSUER_DOMAINS || process.env.CLERK_JWT_ISSUER_DOMAIN || "";
const domains = Array.from(
  new Set(
    rawDomains
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean),
  ),
);

// Fallback to primary domain if none resolved
if (domains.length === 0 && process.env.CLERK_JWT_ISSUER_DOMAIN) {
  domains.push(process.env.CLERK_JWT_ISSUER_DOMAIN.trim());
}

export default {
  providers: domains.map((domain) => ({
    domain,
    applicationID: "convex",
  })),
} satisfies AuthConfig;
