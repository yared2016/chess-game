import { Metadata } from "next";
import { AdminView } from "@/components/admin/admin-view";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Manage deposits, withdrawals, and platform revenue.",
};

export default function AdminPage() {
  return <AdminView />;
}
