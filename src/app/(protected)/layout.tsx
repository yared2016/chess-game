import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ProfileCompletionGate } from "@/components/auth/profile-completion-gate";

/**
 * Second of the three FR-4 layers. `src/proxy.ts` already gates these prefixes,
 * but proxy coverage can silently vanish (a matcher change, a Server Function
 * POSTing to a path the matcher skips), so the check is repeated here. Convex
 * re-derives identity server-side regardless (FR-5).
 */
export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }
  return <ProfileCompletionGate>{children}</ProfileCompletionGate>;
}
