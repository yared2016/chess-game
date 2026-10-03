import type { Metadata } from "next";
import { NotificationsView } from "@/components/notifications/notifications-view";
import { Section } from "@/components/ui-kit";

export const metadata: Metadata = {
  title: "Notifications",
  description: "View all game challenges, wallet transactions, match rematches, and social notifications in detail.",
};

export default function NotificationsPage() {
  return (
    <Section width="app" padding="md" className="py-6 sm:py-10">
      <NotificationsView />
    </Section>
  );
}
