import { Metadata } from "next";
import { Suspense } from "react";
import { AdminView } from "@/components/admin/admin-view";

export const metadata: Metadata = {
  title: "Admin Panel",
  description: "Platform Administration and Finance Management",
};

export default function AdminPage() {
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
