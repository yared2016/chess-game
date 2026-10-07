import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { AdminView } from "@/components/admin/admin-view";

export const metadata: Metadata = {
  title: "Admin Command Center",
  description: "Secure administrative management for Castle Chess.",
};

export default async function SecretAdminPage() {
  const { userId } = await auth();
  const user = await currentUser();
  const userEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase();

  const isAuthorizedAdmin =
    userEmail === "yaredusk@gmail.com" ||
    userId === "user_3JfrI7CJEW9GIMo1UsEAvK9M0Ki";

  if (!isAuthorizedAdmin) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-12 flex flex-col items-center justify-center space-y-3">
          <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-muted-foreground">Loading Admin Control Panel...</p>
        </div>
      }
    >
      <AdminView />
    </Suspense>
  );
}
