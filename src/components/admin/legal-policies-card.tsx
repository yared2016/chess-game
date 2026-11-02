"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  ShieldCheck,
  FileText,
  Lock,
  Coins,
  Award,
  Save,
  CheckCircle2,
  Eye,
  Edit3,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";

export function LegalPoliciesCard() {
  const policies = useQuery((api as any).policies.listPoliciesForAdmin, {});
  const savePolicy = useMutation((api as any).policies.savePolicy);

  const [selectedSlug, setSelectedSlug] = useState<string>("terms");
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedVersion, setEditedVersion] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [editedStatus, setEditedStatus] = useState<"draft" | "published" | "archived">("published");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentPolicy = policies?.find((p: any) => p.slug === selectedSlug);

  const handleSelectPolicy = (slug: string) => {
    setSelectedSlug(slug);
    setIsEditing(false);
  };

  const handleStartEdit = () => {
    if (!currentPolicy) return;
    setEditedTitle(currentPolicy.title);
    setEditedVersion(currentPolicy.version);
    setEditedContent(currentPolicy.content);
    setEditedStatus(currentPolicy.status);
    setIsEditing(true);
  };

  const handleSave = async (statusOverride?: "draft" | "published") => {
    if (!editedTitle.trim() || !editedContent.trim()) {
      toast.error("Title and content cannot be empty");
      return;
    }
    const finalStatus = statusOverride ?? editedStatus;

    setIsSubmitting(true);
    try {
      await savePolicy({
        slug: selectedSlug,
        title: editedTitle.trim(),
        version: editedVersion.trim() || "4.2.7",
        content: editedContent.trim(),
        status: finalStatus,
      });

      toast.success(
        finalStatus === "published"
          ? `Successfully published ${editedTitle} (v${editedVersion})!`
          : `Saved draft of ${editedTitle}`
      );
      setIsEditing(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save policy document");
    } finally {
      setIsSubmitting(false);
    }
  };

  const SLUG_ICONS: Record<string, any> = {
    terms: FileText,
    privacy: Lock,
    payments: Coins,
    licenses: Award,
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground">
              Legal &amp; Policy Governance Center
            </h2>
            <p className="text-xs text-muted-foreground">
              Owner-only management of terms, privacy directives, tariffs, and open-source licenses.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/legal"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-muted/30 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/60 transition-colors"
          >
            <span>Public Portal</span>
            <ExternalLink className="size-3.5 text-muted-foreground" />
          </Link>
        </div>
      </div>

      {/* Policy Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {policies?.map((pol: any) => {
          const Icon = SLUG_ICONS[pol.slug] ?? FileText;
          const isSelected = pol.slug === selectedSlug;
          return (
            <button
              key={pol.slug}
              type="button"
              onClick={() => handleSelectPolicy(pol.slug)}
              className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30"
                  : "border-border/80 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate text-foreground">{pol.title}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span>v{pol.version}</span>
                  <span>&bull;</span>
                  <span className={pol.status === "published" ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
                    {pol.status}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Policy Editor or Details View */}
      {currentPolicy && (
        <div className="rounded-xl border border-border/80 bg-muted/15 p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">{currentPolicy.title}</span>
                <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                  v{currentPolicy.version}
                </span>
                <span className="rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  {currentPolicy.status}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                Slug: /legal/{currentPolicy.slug} &bull; Updated: {new Date(currentPolicy.updatedAt).toLocaleString()}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {!isEditing ? (
                <>
                  <Link
                    href={`/legal/${currentPolicy.slug === "terms" ? "terms" : currentPolicy.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground mr-2"
                  >
                    <Eye className="size-3.5" />
                    <span>View Live</span>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleStartEdit}
                    className="h-8 gap-1.5 text-xs font-semibold cursor-pointer"
                  >
                    <Edit3 className="size-3.5" />
                    <span>Edit Policy</span>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditing(false)}
                    className="h-8 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSave("draft")}
                    disabled={isSubmitting}
                    className="h-8 gap-1.5 text-xs font-semibold cursor-pointer"
                  >
                    <span>Save Draft</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSave("published")}
                    disabled={isSubmitting}
                    className="h-8 gap-1.5 text-xs font-bold bg-primary text-primary-foreground hover:brightness-110 cursor-pointer shadow-xs"
                  >
                    <Save className="size-3.5" />
                    <span>Publish Document</span>
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Form or Preview */}
          {isEditing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-foreground">Document Title</label>
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Version Tag</label>
                  <input
                    type="text"
                    value={editedVersion}
                    onChange={(e) => setEditedVersion(e.target.value)}
                    placeholder="e.g. 4.2.7"
                    className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Document Body (Markdown)</label>
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  rows={14}
                  className="flex w-full rounded-xl border border-input bg-background p-3 text-xs font-mono leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-xl border border-border/60 bg-background/50 p-4 text-xs font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed select-text">
              {currentPolicy.content}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
