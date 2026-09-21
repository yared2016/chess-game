"use client";

import { useId } from "react";
import { SendHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatList, ChatMessage } from "@/components/ui-kit";
import { PersonaHeader, type PersonaStatus } from "./persona-header";

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

export function PlayerChat({ chat, name, meta, status }: {
  chat: PlayerChatState;
  name: string;
  meta?: string;
  status: PersonaStatus;
}) {
  const fieldId = useId();
  const latest = chat.messages.findLast((message) => !message.mine);
  return (
    <>
      <PersonaHeader name={name} meta={meta} status={status} />
      <p className="sr-only" aria-live="polite">{latest ? `${name}: ${latest.text}` : ""}</p>
      <ChatList
        label={`Conversation with ${name}`}
        messageCount={(chat.messages.at(-1)?.sequence ?? -1) + 1}
        empty={chat.loading ? "Loading chat…" : `Say hello to ${name}. Messages appear live for both players.`}
        footer={
          <form onSubmit={(event) => { event.preventDefault(); chat.send(); }} className="flex shrink-0 flex-col gap-1.5 sm:gap-2">
            <div className="flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {QUICK_CHAT_OPTIONS.map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  disabled={chat.sending || chat.loading}
                  onClick={() => chat.send(phrase)}
                  className="shrink-0 rounded-full border border-border/70 bg-card px-2.5 py-1 text-[11px] sm:text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground active:scale-95 disabled:opacity-50"
                >
                  {phrase}
                </button>
              ))}
            </div>
            <label htmlFor={fieldId} className="text-[11px] sm:text-[12px] font-medium text-foreground">Message your opponent</label>
            <div className="flex items-end gap-2">
              <textarea
                id={fieldId}
                rows={1}
                maxLength={1000}
                value={chat.draft}
                readOnly={chat.sending || chat.loading}
                aria-disabled={chat.sending || chat.loading || undefined}
                placeholder="Say good luck or tap above…"
                onChange={(event) => chat.onDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    chat.send();
                  }
                }}
                className="field-sizing-content max-h-24 min-h-9 w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-[12px] sm:text-[13px] outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <Button type="submit" size="icon" className="size-9 shrink-0 pointer-coarse:size-10" aria-label="Send message" disabled={chat.loading || chat.sending || !chat.draft.trim()}>
                <SendHorizontalIcon aria-hidden className="size-4" />
              </Button>
            </div>
            {chat.error ? <p role="alert" className="text-[12px] text-destructive">{chat.error}</p> : null}
          </form>
        }
      >
        {chat.messages.map((message) => (
          <ChatMessage key={message.id} variant={message.mine ? "you" : "ai"} personaName={message.mine ? undefined : name}>
            <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.text}</span>
          </ChatMessage>
        ))}
      </ChatList>
    </>
  );
}
