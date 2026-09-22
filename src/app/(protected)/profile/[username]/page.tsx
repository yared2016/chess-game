import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { preloadQuery, preloadedQueryResult } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";
import { ProfileDashboard } from "@/components/profile/profile-dashboard";
import { Section } from "@/components/ui-kit";

export async function generateMetadata(
  props: PageProps<"/profile/[username]">,
): Promise<Metadata> {
  const { username } = await props.params;
  return { title: `${username} — Player Profile` };
}

/**
 * `params` is a Promise in Next 15+/16 — always await it.
 */
export default async function ProfilePage(props: PageProps<"/profile/[username]">) {
  const { username } = await props.params;

  const preloaded = await preloadQuery(api.players.getByUsername, { username });
  if (preloadedQueryResult(preloaded) === null) notFound();

  return (
    <Section width="app" padding="md" className="pt-6 sm:pt-8" innerClassName="max-w-4xl mx-auto">
      <ProfileDashboard preloaded={preloaded} username={username} />
    </Section>
  );
}
