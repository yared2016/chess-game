import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { AdminView } from "@/components/admin/admin-view";

export const metadata: Metadata = {
  title: "Owner Command Center | Abay Chess",
  description: "Secure platform financial control and governance.",
};

export default async function OwnerPortalPage() {
  const { userId } = await auth();
  if (!userId) {
    notFound();
  }

  const user = await currentUser();
  const userEmail = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase();
  const ownerClerkId = process.env.OWNER_CLERK_ID || process.env.ADMIN_CLERK_ID;

  // Strict Zero-Trust RBAC: Authorized if Clerk Subject ID matches, or Owner email matches yaredusk0@gmail.com
  const isOwner =
    (ownerClerkId && userId === ownerClerkId) ||
    userEmail === "yaredusk0@gmail.com";

  if (!isOwner) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-12 flex flex-col items-center justify-center space-y-3">
          <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-muted-foreground">Loading Owner Command Center...</p>
        </div>
      }
    >
      <AdminView isOwnerPortal={true} />
    </Suspense>
  );
}
