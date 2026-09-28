import { Suspense } from "react";
import type { Metadata } from "next";
import { FeedbackView } from "@/components/feedback/feedback-view";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Player Feedback · Castle Chess",
  description: "Share feedback, report problems, and propose features for Castle 3D Chess.",
};

function FeedbackLoadingFallback() {
  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-8 animate-pulse">
      <div className="text-center space-y-3">
        <Skeleton className="h-6 w-40 mx-auto rounded-full" />
        <Skeleton className="h-10 w-64 mx-auto rounded-xl" />
        <Skeleton className="h-4 w-80 mx-auto rounded-lg" />
      </div>
      <Skeleton className="h-11 w-full max-w-md mx-auto rounded-xl" />
      <Skeleton className="h-[400px] w-full rounded-2xl" />
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={<FeedbackLoadingFallback />}>
      <FeedbackView />
    </Suspense>
  );
}
