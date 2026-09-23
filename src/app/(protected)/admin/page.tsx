import { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { AdminView } from "@/components/admin/admin-view";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Manage deposits, withdrawals, and platform revenue.",
};

export default async function AdminPage() {
  const { userId } = await auth();
  const adminId = process.env.ADMIN_CLERK_ID ?? "user_3JfrI7CJEW9GIMo1UsEAvK9M0Ki";
  const user = await currentUser();
  const userEmail = user?.primaryEmailAddress?.emailAddress;

  const isAuthorizedAdmin =
    userId === adminId ||
    userEmail === "yaredusk@gmail.com" ||
    userEmail === "yaredtekleye@gmail.com";

  if (!isAuthorizedAdmin) {
    notFound();
  }

  return <AdminView />;
}
