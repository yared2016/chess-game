// src/app/(protected)/profile/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Section } from "@/components/ui-kit";
import { Loader2 } from "lucide-react";

export default function MyProfileRedirectPage() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.players.me, isAuthenticated ? {} : "skip");

  useEffect(() => {
    if (me?.username) {
      router.replace(`/profile/${encodeURIComponent(me.username)}`);
    }
  }, [me, router]);

  return (
    <Section width="app" padding="md" className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm font-medium">Opening your profile…</p>
      </div>
    </Section>
  );
}
