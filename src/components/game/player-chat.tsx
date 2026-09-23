"use client";

import { useId, useRef, useState } from "react";
import { SendHorizontalIcon, Paperclip, Reply, X, FileImage, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatList, ChatMessage } from "@/components/ui-kit";
import { PersonaHeader, type PersonaStatus } from "./persona-header";
import { useIsLandscape, useIsKeyboardOpen } from "./use-viewport";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";

export interface PlayerChatMessage {
  id: string;
  text: string;
  mine: boolean;
  createdAt: number;
  sequence: number;
}

export interface PlayerChatState {
  messages: PlayerChatMessage[];
  draft: string;
  loading: boolean;
  sending: boolean;
  error: string | null;
  onDraftChange(text: string): void;
  send(text?: string): void;
}

const QUICK_CHAT_OPTIONS = [
  "Good luck! 👋",
  "Nice move! 👏",
  "Thanks! 😊",
  "Well played! 🤝",
  "Hello! ✨",
] as const;

export function PlayerChat({
  chat,
  name,
  meta,
  status,
  online,
  lastSeen,
}: {
  chat: PlayerChatState;
  name: string;
  meta?: string;
  status: PersonaStatus;
  online?: boolean | null;
  lastSeen?: number | null;
}) {
  const fieldId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [replyingTo, setReplyingTo] = useState<PlayerChatMessage | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const generateUploadUrl = useMutation(api.storage?.generateUploadUrl as any);
  const getFileUrl = useMutation(api.storage?.getFileUrl as any);

  const latest = chat.messages.findLast((message) => !message.mine);
  const isLandscape = useIsLandscape();
  const isKeyboardOpen = useIsKeyboardOpen();
  const hideQuickReplies = isLandscape && isKeyboardOpen;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be under 5MB");
      return;
    }

    try {
      setIsUploading(true);
      const postUrl = await generateUploadUrl();
      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      const { storageId } = await res.json();
      const directUrl = await getFileUrl({ storageId });

      if (directUrl) {
        const caption = chat.draft.trim();
        const payload = `[img:${directUrl}]${caption ? ` ${caption}` : ""}`;
        chat.send(payload);
        chat.onDraftChange("");
        setReplyingTo(null);
        toast.success("Image sent in chat!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to upload image");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSend = () => {
    const trimmed = chat.draft.trim();
    if (!trimmed) return;

    if (replyingTo) {
      const quoteAuthor = replyingTo.mine ? "You" : name;
      const cleanSnippet = replyingTo.text
        .replace(/\[img:[^\]]+\]/g, "📷 Image")
        .replace(/>\s*\[reply:[^\]]+\]:[^\n]+\n\n/, "")
        .replace(/\n/g, " ")
        .slice(0, 45);
      const fullText = `> [reply:${quoteAuthor}]: ${cleanSnippet}\n\n${trimmed}`;
      chat.send(fullText);
      setReplyingTo(null);
    } else {
      chat.send();
    }
  };

  const renderMessageContent = (message: PlayerChatMessage) => {
    let content = message.text;
    let replyBlock = null;
    let imageUrl = null;

    // Check for quoted reply: `> [reply:Author]: Snippet\n\nRemaining`
    const replyMatch = content.match(/^>\s*\[reply:([^\]]+)\]:\s*([^\n]+)\n\n([\s\S]*)$/);
    if (replyMatch) {
      const author = replyMatch[1];
      const snippet = replyMatch[2];
      content = replyMatch[3];
      replyBlock = (
        <div className="mb-1.5 rounded-md border-l-2 border-primary/70 bg-black/10 dark:bg-white/10 px-2 py-1 text-[11px] text-muted-foreground">
          <span className="font-bold text-foreground block text-[10px]">{author}</span>
          <span className="line-clamp-1 italic text-[11px]">{snippet}</span>
        </div>
      );
    }

    // Check for attached image `[img:URL]`
    const imgMatch = content.match(/\[img:([^\]]+)\]/);
    if (imgMatch) {
      imageUrl = imgMatch[1];
      content = content.replace(/\[img:[^\]]+\]/, "").trim();
    }

    const timeFormatted = new Date(message.createdAt).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

    return (
      <div className="space-y-1">
        {replyBlock}

        {imageUrl && (
          <div className="relative overflow-hidden rounded-lg border border-border/80 bg-black/10 my-1 max-w-[220px]">
            <img
              src={imageUrl}
              alt="Shared attachment"
              className="max-h-48 w-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
              onClick={() => setPreviewImage(imageUrl)}
            />
          </div>
        )}

        {content ? (
          <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] block">
            {content}
          </span>
        ) : null}

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => setReplyingTo(message)}
            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 hover:text-foreground font-semibold transition-colors"
          >
            <Reply className="size-2.5" />
            Reply
          </button>
          <span className="text-[10px] text-muted-foreground/60 font-mono select-none">
            {timeFormatted}
          </span>
        </div>
      </div>
    );
  };

  return (
    <>
      <PersonaHeader name={name} meta={meta} status={status} online={online} lastSeen={lastSeen} />
      <p className="sr-only" aria-live="polite">
        {latest ? `${name}: ${latest.text}` : ""}
      </p>

      <ChatList
        label={`Conversation with ${name}`}
        messageCount={(chat.messages.at(-1)?.sequence ?? -1) + 1}
        empty={
          chat.loading
            ? "Loading chat…"
            : `Say hello to ${name}. Messages and screenshots appear live for both players.`
        }
        footer={
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleSend();
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}
            data-base-ui-swipe-ignore="true"
            data-swipe-ignore="true"
            className="flex shrink-0 flex-col gap-1.5 sm:gap-2 pointer-events-auto touch-manipulation"
          >
            {/* Quick replies bar */}
            {!hideQuickReplies && !replyingTo && (
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {QUICK_CHAT_OPTIONS.map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    disabled={chat.sending || chat.loading}
                    onClick={() => chat.send(phrase)}
                    className="shrink-0 rounded-full border border-border/70 bg-card px-2.5 py-1 text-[11px] sm:text-[12px] font-medium text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground active:scale-95 disabled:opacity-50"
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            )}

            {/* Replying banner */}
            {replyingTo && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs animate-in fade-in duration-150">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Reply className="size-3.5 text-primary shrink-0" />
                  <span className="text-muted-foreground shrink-0">Replying to</span>
                  <strong className="text-foreground shrink-0">
                    {replyingTo.mine ? "yourself" : name}:
                  </strong>
                  <span className="truncate italic text-muted-foreground">
                    &quot;{replyingTo.text.replace(/\[img:[^\]]+\]/g, "📷 Image").slice(0, 30)}&quot;
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />

            <label htmlFor={fieldId} className="sr-only">
              Message your opponent
            </label>

            <div className="flex items-end gap-1.5 rounded-2xl border border-input/60 bg-muted/40 p-1 pl-2.5 transition-all focus-within:border-primary/60 focus-within:bg-card focus-within:ring-2 focus-within:ring-primary/20 pointer-events-auto touch-manipulation">
              {/* Attachment Button */}
              <button
                type="button"
                disabled={isUploading || chat.sending || chat.loading}
                onClick={() => fileInputRef.current?.click()}
                title="Send screenshot or image"
                className="size-8.5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors disabled:opacity-40 shrink-0"
              >
                {isUploading ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <Paperclip className="size-4" />
                )}
              </button>

              <textarea
                id={fieldId}
                rows={1}
                maxLength={1000}
                value={chat.draft}
                readOnly={chat.sending || chat.loading || isUploading}
                aria-disabled={chat.sending || chat.loading || isUploading || undefined}
                placeholder={replyingTo ? "Write a reply…" : "Message opponent…"}
                inputMode="text"
                autoCapitalize="sentences"
                autoCorrect="on"
                spellCheck={true}
                onTouchStart={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  if (!chat.sending && !chat.loading && !isUploading) {
                    (event.currentTarget as HTMLTextAreaElement).focus();
                  }
                }}
                onChange={(event) => chat.onDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                className="field-sizing-content max-h-24 min-h-[38px] w-full min-w-0 resize-none border-0 bg-transparent py-2 text-[16px] sm:text-[13px] leading-snug text-foreground outline-none placeholder:text-muted-foreground select-text pointer-events-auto touch-manipulation focus:ring-0 focus-visible:ring-0"
              />

              <Button
                type="submit"
                size="icon"
                className="size-8.5 shrink-0 rounded-full active:scale-95 disabled:opacity-30"
                aria-label="Send message"
                disabled={chat.loading || chat.sending || isUploading || !chat.draft.trim()}
              >
                <SendHorizontalIcon aria-hidden className="size-4" />
              </Button>
            </div>

            {chat.error ? (
              <p role="alert" className="text-[12px] text-destructive">
                {chat.error}
              </p>
            ) : null}
          </form>
        }
      >
        {chat.messages.map((message) => (
          <ChatMessage
            key={message.id}
            variant={message.mine ? "you" : "ai"}
            personaName={message.mine ? undefined : name}
          >
            {renderMessageContent(message)}
          </ChatMessage>
        ))}
      </ChatList>

      {/* Image Zoom Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-lg w-full overflow-hidden rounded-2xl bg-card border border-border p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-border/70">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <FileImage className="size-4 text-primary" /> Image Attachment
              </span>
              <button
                onClick={() => setPreviewImage(null)}
                className="size-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="py-2 flex items-center justify-center max-h-[70vh] overflow-auto">
              <img
                src={previewImage}
                alt="Zoomed attachment"
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            </div>
            <div className="pt-2 text-right">
              <a
                href={previewImage}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <ExternalLink className="size-3.5" /> Open Full Image
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
