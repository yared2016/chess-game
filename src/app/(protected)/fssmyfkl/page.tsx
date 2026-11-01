import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { AdminView } from "@/components/admin/admin-view";

export const metadata: Metadata = {
  title: "Staff Operations Center | Abay Chess",
  description: "Scoped administrative operations and player safety management.",
};

export default async function StaffAdminPage() {
  const { userId } = await auth();

  // Guard: User must be signed in
  if (!userId) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-12 flex flex-col items-center justify-center space-y-3">
          <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-muted-foreground">Loading Staff Operations Center...</p>
        </div>
      }
    >
      <AdminView isOwnerPortal={false} />
    </Suspense>
  );
}
