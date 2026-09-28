import { Metadata } from "next";
import { notFound } from "next/navigation";
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

  return <AdminView />;
}
