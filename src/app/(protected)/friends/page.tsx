import type { Metadata } from "next";
import { FriendsHub } from "@/components/friends/friends-hub";
import { Section } from "@/components/ui-kit";

export const metadata: Metadata = {
  title: "Friends & Social",
  description: "Connect with friends, manage friend requests, challenge other players, and build your Castle Chess circle.",
};

export default function FriendsPage() {
  return (
    <Section width="app" padding="none" className="py-4 sm:py-8 overflow-x-hidden max-w-full">
      <FriendsHub />
    </Section>
  );
}
