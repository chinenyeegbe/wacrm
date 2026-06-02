"use client";

import { useState, useRef, useCallback, KeyboardEvent } from "react";
import { Send, LayoutTemplate, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReplyQuote } from "./reply-quote";

interface ReplyDraft {
  /** Internal UUID of the message being replied to, sent back through onSend. */
  id: string;
  authorLabel: string;
  preview: string;
}

interface MessageComposerProps {
  conversationId: string;
  sessionExpired: boolean;
  onSend: (text: string, replyToId?: string) => void;
  onOpenTemplates: () => void;
  replyTo?: ReplyDraft | null;
  onClearReply?: () => void;
}

export function MessageComposer({
  conversationId,
  sessionExpired,
  onSend,
  onOpenTemplates,
  replyTo,
  onClearReply,
}: MessageComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    // Max 4 lines (~96px)
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || sessionExpired) return;

    setSending(true);
    try {
      onSend(trimmed, replyTo?.id);
      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } finally {
      setSending(false);
    }
  }, [text, sending, sessionExpired, onSend, replyTo?.id]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      adjustHeight();
    },
    [adjustHeight]
  );

  // AI assist: with an empty box it suggests the next reply from the
  // conversation history; with a draft already typed it rewrites it. The
  // provider key lives server-side, we only ever receive the finished text.
  const handleAI = useCallback(async () => {
    if (aiLoading || sessionExpired) return;
    const draft = text.trim();
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          draft
            ? { action: "improve", draft, mode: "rewrite" }
            : { action: "suggest_reply", conversation_id: conversationId }
        ),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload?.error || `AI failed: HTTP ${res.status}`);
        return;
      }
      if (payload?.result) {
        setText(payload.result);
        // Value updates next render; resize once the DOM has it.
        requestAnimationFrame(adjustHeight);
        textareaRef.current?.focus();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI request failed");
    } finally {
      setAiLoading(false);
    }
  }, [aiLoading, sessionExpired, text, conversationId, adjustHeight]);

  return (
    <div className="border-t border-border bg-card p-3">
      {replyTo && (
        <div className="mb-2">
          <ReplyQuote
            authorLabel={replyTo.authorLabel}
            preview={replyTo.preview}
            onDismiss={onClearReply}
          />
        </div>
      )}
      {sessionExpired && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-amber-500/10 px-3 py-2">
          <p className="text-xs text-amber-400">
            24-hour session expired. Use a template to re-engage.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-amber-400 hover:text-amber-300"
            onClick={onOpenTemplates}
          >
            <LayoutTemplate className="mr-1 h-3 w-3" />
            Templates
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-foreground"
          onClick={onOpenTemplates}
          title="Send template"
        >
          <LayoutTemplate className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 shrink-0 p-0 text-primary hover:text-primary/80 disabled:opacity-40"
          onClick={handleAI}
          disabled={aiLoading || sessionExpired}
          title={
            text.trim()
              ? "AI: rewrite this draft"
              : "AI: suggest a reply"
          }
        >
          {aiLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
        </Button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={
            sessionExpired
              ? "Session expired - use a template"
              : "Type a message... (Shift+Enter for new line)"
          }
          disabled={sessionExpired}
          rows={1}
          className={cn(
            "flex-1 resize-none rounded-xl border border-border bg-muted px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary/50",
            sessionExpired && "cursor-not-allowed opacity-50"
          )}
        />

        <Button
          size="sm"
          className="h-9 w-9 shrink-0 bg-primary p-0 hover:bg-primary/90 disabled:opacity-40"
          disabled={!text.trim() || sessionExpired || sending}
          onClick={handleSend}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Hint sits outside the flex row so its height doesn't push
          `items-end` buttons below the textarea. Indented to line up
          under the textarea left edge (w-9 button + gap-2 = 44px). */}
      <p className="mt-1 pl-11 text-[10px] text-muted-foreground">
        Type &apos;/&apos; for quick replies
      </p>
    </div>
  );
}
