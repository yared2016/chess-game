"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  SendHorizontalIcon,
  Paperclip,
  Reply,
  X,
  FileImage,
  ExternalLink,
  Loader2,
  Download,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatList, ChatMessage } from "@/components/ui-kit";
import { PersonaHeader, type PersonaStatus } from "./persona-header";
import { useIsLandscape, useIsKeyboardOpen } from "./use-viewport";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import type { Colour } from "@/lib/types";

export interface PlayerChatMessage {
  id: string;
  text: string;
  mine: boolean;
  createdAt: number;
  sequence: number;
  seen?: boolean;
}

export interface PlayerChatState {
  messages: PlayerChatMessage[];
  draft: string;
  loading: boolean;
  sending: boolean;
  error: string | null;
  onDraftChange(text: string): void;
  send(text?: string): void;
  markAsRead?(): void;
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
  seat,
  active = true,
}: {
  chat: PlayerChatState;
  name: string;
  meta?: string;
  status: PersonaStatus;
  online?: boolean | null;
  lastSeen?: number | null;
  seat?: Colour | "both" | null;
  active?: boolean;
}) {
  const fieldId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [replyingTo, setReplyingTo] = useState<PlayerChatMessage | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; name?: string } | null>(null);

  // Mark chat as read only when actively viewing messages
  useEffect(() => {
    if (active) {
      chat.markAsRead?.();
    }
  }, [active, chat.messages.length, chat.markAsRead]);

  const handleDownload = async (url: string, filename?: string) => {
    try {
      toast.info("Downloading…", { duration: 1200 });
      const response = await fetch(url);
      if (!response.ok) throw new Error("Fetch failed");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename || `file-${Date.now()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
      toast.success("Download complete!");
    } catch {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "download";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const generateUploadUrl = useMutation(api.storage?.generateUploadUrl as any);
  const getFileUrl = useMutation(api.storage?.getFileUrl as any);

  const latest = chat.messages.findLast((message) => !message.mine);
  const isLandscape = useIsLandscape();
  const isKeyboardOpen = useIsKeyboardOpen();
  const hideQuickReplies = isLandscape && isKeyboardOpen;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be under 10MB");
      return;
    }

    try {
      setIsUploading(true);
      const postUrl = await generateUploadUrl();
      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });

      const { storageId } = await res.json();
      const directUrl = await getFileUrl({ storageId });

      if (directUrl) {
        const caption = chat.draft.trim();
        const isImage = file.type.startsWith("image/");
        let payload = isImage
          ? `[img:${directUrl}|${file.name}]${caption ? ` ${caption}` : ""}`
          : `[file:${directUrl}|${file.name}|${formatBytes(file.size)}]${caption ? ` ${caption}` : ""}`;
        if (replyingTo) {
          const quoteAuthor = replyingTo.mine ? "You" : name;
          const replyingImgMatch = replyingTo.text.match(/\[img:([^\]|]+)/);
          const quoteImg = replyingImgMatch ? replyingImgMatch[1] : "";
          const cleanSnippet = replyingTo.text
            .replace(/\[img:[^\]]+\]/g, "")
            .replace(/\[file:[^\]]+\]/g, "📁 File")
            .replace(/>\s*\[reply:[^\]]+\]:[^\n]+\n\n/, "")
            .replace(/\n/g, " ")
            .trim()
            .slice(0, 45);
          payload = `> [reply:${quoteAuthor}${quoteImg ? `|${quoteImg}` : ""}]: ${cleanSnippet || "Photo"}\n\n${payload}`;
        }
        chat.send(payload);
        chat.onDraftChange("");
        setReplyingTo(null);
        toast.success(isImage ? "Image sent in chat!" : "File sent in chat!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to upload file");
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
      const replyingImgMatch = replyingTo.text.match(/\[img:([^\]|]+)/);
      const quoteImg = replyingImgMatch ? replyingImgMatch[1] : "";
      const cleanSnippet = replyingTo.text
        .replace(/\[img:[^\]]+\]/g, "")
        .replace(/\[file:[^\]]+\]/g, "📁 File")
        .replace(/>\s*\[reply:[^\]]+\]:[^\n]+\n\n/, "")
        .replace(/\n/g, " ")
        .trim()
        .slice(0, 45);
      const fullText = `> [reply:${quoteAuthor}${quoteImg ? `|${quoteImg}` : ""}]: ${cleanSnippet || "Photo"}\n\n${trimmed}`;
      chat.send(fullText);
      setReplyingTo(null);
    } else {
      chat.send();
    }
  };

  const renderMessageContent = (message: PlayerChatMessage) => {
    let content = message.text;
    let replyBlock = null;
    let imageUrl: string | null = null;
    let imageName = "image.png";
    let fileUrl: string | null = null;
    let fileName = "document";
    let fileSize: string | null = null;

    // Check for quoted reply: `> [reply:Author|optionalImg]: Snippet\n\nRemaining`
    const replyMatch = content.match(/^>\s*\[reply:([^\]|]+)(?:\|([^\]]+))?\]:\s*([^\n]+)\n\n([\s\S]*)$/);
    if (replyMatch) {
      const author = replyMatch[1];
      const quotedImg = replyMatch[2] || null;
      const snippet = replyMatch[3];
      content = replyMatch[4];
      replyBlock = (
        <div className="mb-1.5 flex items-center gap-2 rounded-lg border-l-2 border-primary/70 bg-black/10 dark:bg-white/10 px-2 py-1 text-[11px] text-muted-foreground">
          {quotedImg && (
            <img
              src={quotedImg}
              alt="Quoted"
              className="size-7 rounded object-cover shrink-0 border border-border/60"
            />
          )}
          <div className="min-w-0 flex-1">
            <span className="font-bold text-foreground block text-[10px] leading-tight">{author}</span>
            <span className="line-clamp-1 italic text-[11px] leading-snug">{snippet}</span>
          </div>
        </div>
      );
    }

    // Check for attached image `[img:URL|optionalName]` or `[img:URL]`
    const imgMatch = content.match(/\[img:([^\]|]+)(?:\|([^\]]+))?\]/);
    if (imgMatch) {
      imageUrl = imgMatch[1];
      imageName = imgMatch[2] || "image.png";
      content = content.replace(/\[img:[^\]]+\]/, "").trim();
    }

    // Check for attached file `[file:URL|name|size]`
    const fileMatch = content.match(/\[file:([^\]|]+)\|([^\]|]+)(?:\|([^\]]+))?\]/);
    if (fileMatch) {
      fileUrl = fileMatch[1];
      fileName = fileMatch[2] || "document";
      fileSize = fileMatch[3] || null;
      content = content.replace(/\[file:[^\]]+\]/, "").trim();
    }

    const timeFormatted = new Date(message.createdAt).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

    return (
      <div className="space-y-1">
        {replyBlock}

        {imageUrl && (
          <div className="relative group overflow-hidden rounded-xl border border-border/80 bg-black/10 my-1.5 max-w-[240px]">
            <img
              src={imageUrl}
              alt={imageName}
              className="max-h-48 w-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
              onLoad={() => {
                if (!message.mine) {
                  chat.markAsRead?.();
                }
              }}
              onClick={() => {
                setPreviewImage({ url: imageUrl!, name: imageName });
                if (!message.mine) {
                  chat.markAsRead?.();
                }
              }}
            />
            <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!message.mine) {
                    chat.markAsRead?.();
                  }
                  void handleDownload(imageUrl!, imageName);
                }}
                title="Download image"
                className="size-7 rounded-full bg-black/75 hover:bg-black text-white flex items-center justify-center backdrop-blur-xs transition-transform active:scale-95 shadow-md"
              >
                <Download className="size-3.5" />
              </button>
            </div>
          </div>
        )}

        {fileUrl && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-muted/60 p-2.5 my-1.5 max-w-[280px]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <FileText className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">{fileName}</p>
                {fileSize ? <p className="text-[10px] text-muted-foreground font-mono">{fileSize}</p> : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!message.mine) {
                  chat.markAsRead?.();
                }
                void handleDownload(fileUrl!, fileName);
              }}
              title="Download file"
              className="size-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center shrink-0 transition-transform active:scale-95"
            >
              <Download className="size-4" />
            </button>
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
          <div className="flex items-center gap-1 font-mono select-none">
            <span className="text-[10px] text-muted-foreground/60">
              {timeFormatted}
            </span>
            {message.mine ? (
              message.seen ? (
                <span
                  className="text-[11px] font-bold text-green-400 dark:text-green-400 inline-flex items-center gap-0.5 filter drop-shadow-[0_0_6px_rgba(74,222,128,0.7)]"
                  title="Seen by opponent"
                >
                  <span className="tracking-tighter">✓✓</span>
                  <span className="text-[9px] font-semibold ml-0.5">Seen</span>
                </span>
              ) : online === true ? (
                <span
                  className="text-[11px] font-semibold text-muted-foreground/75 inline-flex items-center gap-0.5"
                  title="Delivered to opponent"
                >
                  <span className="tracking-tighter">✓✓</span>
                </span>
              ) : (
                <span
                  className="text-[11px] text-muted-foreground/60 inline-flex items-center gap-0.5"
                  title="Sent"
                >
                  ✓
                </span>
              )
            ) : null}
          </div>
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
            {replyingTo && (() => {
              const repImgMatch = replyingTo.text.match(/\[img:([^\]|]+)/);
              const repImgUrl = repImgMatch ? repImgMatch[1] : null;
              const repText = replyingTo.text
                .replace(/\[img:[^\]]+\]/g, "")
                .replace(/\[file:[^\]]+\]/g, "📁 File")
                .replace(/>\s*\[reply:[^\]]+\]:[^\n]+\n\n/, "")
                .trim();
              return (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs animate-in fade-in duration-150">
                  <div className="flex items-center gap-2 min-w-0">
                    <Reply className="size-3.5 text-primary shrink-0" />
                    {repImgUrl && (
                      <img
                        src={repImgUrl}
                        alt="Replying image preview"
                        className="size-7 rounded object-cover shrink-0 border border-primary/30"
                      />
                    )}
                    <span className="text-muted-foreground shrink-0">Replying to</span>
                    <strong className="text-foreground shrink-0">
                      {replyingTo.mine ? "yourself" : name}:
                    </strong>
                    <span className="truncate italic text-muted-foreground">
                      &quot;{repText ? repText.slice(0, 30) : (repImgUrl ? "Photo" : "")}&quot;
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="rounded-md p-1 text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              );
            })()}

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*,application/pdf,text/plain,.pgn"
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
        {chat.messages.map((message) => {
          const senderSide: "w" | "b" | null =
            seat === "both" || seat == null
              ? null
              : message.mine
                ? (seat === "w" ? "w" : "b")
                : (seat === "w" ? "b" : "w");

          return (
            <ChatMessage
              key={message.id}
              variant={message.mine ? "you" : "ai"}
              personaName={message.mine ? undefined : name}
              side={senderSide}
            >
              {renderMessageContent(message)}
            </ChatMessage>
          );
        })}
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
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5 truncate max-w-[80%]">
                <FileImage className="size-4 text-primary shrink-0" />
                <span className="truncate">{previewImage.name || "Image Attachment"}</span>
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
                src={previewImage.url}
                alt={previewImage.name || "Zoomed attachment"}
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            </div>
            <div className="pt-2 flex items-center justify-between border-t border-border/70 mt-1">
              <button
                type="button"
                onClick={() => void handleDownload(previewImage.url, previewImage.name)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm active:scale-95"
              >
                <Download className="size-3.5" /> Download image
              </button>
              <a
                href={previewImage.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="size-3.5" /> Open in new tab
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
