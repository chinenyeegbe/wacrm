/**
 * Prompt builders for the CRM's AI features.
 *
 * Everything here is written for African SMB reality: WhatsApp-first
 * customers, multilingual buyers (English, Pidgin, Swahili, French, Hausa,
 * Yoruba, Arabic, Zulu, Amharic, …), price-sensitive negotiation, and a
 * relationship-driven sales culture. The model is told to mirror the
 * customer's language and to keep replies short enough for a phone screen.
 */

import type { ChatMessage } from "./client";
import { redact } from "@/lib/safety/pii";

export interface ConversationContext {
  contactName?: string | null;
  contactCompany?: string | null;
  /** Oldest → newest. Only text is used. */
  history: { fromCustomer: boolean; text: string }[];
  /** Optional free-text notes about the business / product catalogue. */
  businessContext?: string | null;
}

const BASE_SYSTEM = `You are the AI sales and support assistant inside wacrm, a WhatsApp CRM used by businesses across Africa.

Operating principles:
- Reply in the SAME language and register the customer is using. If they write Pidgin, Swahili, French, Hausa, Yoruba, Arabic, Zulu or any mix, match it naturally.
- Keep messages short and WhatsApp-friendly: 1–4 sentences, warm, human, no corporate stiffness.
- Be helpful and move the sale forward: answer the question, then nudge toward the next step (confirm order, share price, book a call, send payment details).
- Never invent prices, stock, delivery times, or policies you were not given. If unknown, ask or offer to check.
- No markdown, no headings, no emoji spam (one tasteful emoji at most). Plain text a person would actually send.`;

/** Suggest the next reply an agent should send to the customer. */
export function buildReplyPrompt(ctx: ConversationContext): {
  system: string;
  messages: ChatMessage[];
} {
  const who = ctx.contactName ? `The customer's name is ${ctx.contactName}.` : "";
  const company = ctx.contactCompany
    ? ` They are from ${ctx.contactCompany}.`
    : "";
  const biz = ctx.businessContext
    ? `\n\nAbout your business (use this, do not contradict it):\n${ctx.businessContext}`
    : "";

  // Redact PII (card numbers, emails, phones, IDs) before the transcript
  // ever leaves the box for an external LLM. The model doesn't need a
  // customer's card to draft a reply.
  const transcript = ctx.history
    .map((m) => `${m.fromCustomer ? "Customer" : "You"}: ${redact(m.text)}`)
    .join("\n");

  return {
    system: BASE_SYSTEM,
    messages: [
      {
        role: "user",
        content: `${who}${company}${biz}

Here is the WhatsApp conversation so far:
${transcript || "(no messages yet, the customer just reached out)"}

Write ONLY the next message you should send as the business. No preamble, no quotes, just the message text.`,
      },
    ],
  };
}

export type ImproveMode =
  | "rewrite"
  | "shorten"
  | "professional"
  | "friendly"
  | "fix"
  | "translate";

const IMPROVE_INSTRUCTIONS: Record<ImproveMode, string> = {
  rewrite: "Rewrite this message so it is clearer and more persuasive.",
  shorten: "Make this message shorter and punchier without losing meaning.",
  professional: "Rewrite this message in a polished, professional tone.",
  friendly: "Rewrite this message in a warm, friendly, human tone.",
  fix: "Fix the spelling, grammar and punctuation. Keep the meaning and tone.",
  translate: "Translate this message",
};

/** Improve / transform a draft the agent has already typed. */
export function buildImprovePrompt(
  draft: string,
  mode: ImproveMode,
  targetLanguage?: string,
): { system: string; messages: ChatMessage[] } {
  const instruction =
    mode === "translate"
      ? `${IMPROVE_INSTRUCTIONS.translate} into ${targetLanguage || "English"}.`
      : IMPROVE_INSTRUCTIONS[mode];

  return {
    system: BASE_SYSTEM,
    messages: [
      {
        role: "user",
        content: `${instruction}

Return ONLY the resulting message text, nothing else.

Message:
${draft}`,
      },
    ],
  };
}

/** Draft a broadcast / campaign message from a short brief. */
export function buildBroadcastPrompt(
  brief: string,
  opts: { tone?: string; language?: string } = {},
): { system: string; messages: ChatMessage[] } {
  const tone = opts.tone ? ` Tone: ${opts.tone}.` : "";
  const lang = opts.language ? ` Write it in ${opts.language}.` : "";
  return {
    system: BASE_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Write a WhatsApp broadcast message for this campaign brief.${tone}${lang}

It must feel personal (not spammy), have a clear call to action, and respect WhatsApp etiquette. Where a customer's name fits, use the placeholder {{1}}.

Return ONLY the message text.

Brief:
${brief}`,
      },
    ],
  };
}

/** Draft social-media copy so the business can market itself. */
export function buildSocialPrompt(
  brief: string,
  platform: string,
): { system: string; messages: ChatMessage[] } {
  return {
    system: `You are a social-media marketer for an African small business. Write copy that stops the scroll, sounds authentic to the local audience, and drives people to message the business on WhatsApp. Keep it tight and platform-appropriate. No markdown headings.`,
    messages: [
      {
        role: "user",
        content: `Write a ${platform} post for this:

${brief}

Include a strong hook, 2–4 relevant hashtags, and a clear call to action to chat on WhatsApp. Return ONLY the post text.`,
      },
    ],
  };
}

// ============================================================
// Classification / routing (the AI qualifier)
// ============================================================

/** The shape the qualifier returns. Kept small and stable so the
 *  automation engine can branch on it deterministically. */
export interface ConversationClassification {
  /** What the customer is trying to do. */
  intent:
    | "buying"
    | "question"
    | "support"
    | "complaint"
    | "spam"
    | "other";
  /** Overall emotional tone of the latest customer message(s). */
  sentiment: "positive" | "neutral" | "negative";
  /** True when this looks like a real purchase opportunity worth a human. */
  hot_lead: boolean;
  /** Whether a human should step in (anger, high value, edge cases). */
  needs_human: boolean;
  /** One short line an operator can read at a glance. */
  summary: string;
}

const CLASSIFY_SYSTEM = `You are a triage engine for a WhatsApp CRM used by African businesses. You read a conversation and classify it. You output STRICT JSON only, no prose, no markdown, no code fences. The JSON must match exactly:

{"intent":"buying|question|support|complaint|spam|other","sentiment":"positive|neutral|negative","hot_lead":true|false,"needs_human":true|false,"summary":"one short sentence"}

Rules:
- "buying" = clear purchase intent (wants to order, asks to pay, confirms an item).
- hot_lead = true when there is real, near-term purchase intent worth a human's time.
- needs_human = true for anger, complaints, threats, refunds, or anything risky to automate.
- summary = at most 12 words, plain text, the operator's quick read.
- Output ONLY the JSON object.`;

export function buildClassifyPrompt(ctx: ConversationContext): {
  system: string;
  messages: ChatMessage[];
} {
  const biz = ctx.businessContext
    ? `\n\nBusiness context (for judging intent and value):\n${ctx.businessContext}`
    : "";
  const transcript = ctx.history
    .map((m) => `${m.fromCustomer ? "Customer" : "Business"}: ${redact(m.text)}`)
    .join("\n");

  return {
    system: CLASSIFY_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Classify this WhatsApp conversation.${biz}

Conversation:
${transcript || "(no messages yet)"}

Return ONLY the JSON object.`,
      },
    ],
  };
}

/**
 * Parse the model's classification output defensively. Free models
 * sometimes wrap JSON in prose or code fences, so we extract the first
 * balanced `{...}` and validate every field, falling back to safe
 * defaults (route to a human) on anything unexpected.
 */
export function parseClassification(raw: string): ConversationClassification {
  const fallback: ConversationClassification = {
    intent: "other",
    sentiment: "neutral",
    hot_lead: false,
    needs_human: true,
    summary: "Could not classify, routed to a human.",
  };

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return fallback;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return fallback;
  }

  const intents = ["buying", "question", "support", "complaint", "spam", "other"];
  const sentiments = ["positive", "neutral", "negative"];

  const intent = intents.includes(parsed.intent as string)
    ? (parsed.intent as ConversationClassification["intent"])
    : "other";
  const sentiment = sentiments.includes(parsed.sentiment as string)
    ? (parsed.sentiment as ConversationClassification["sentiment"])
    : "neutral";

  return {
    intent,
    sentiment,
    hot_lead: parsed.hot_lead === true,
    needs_human: parsed.needs_human === true,
    summary:
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim().slice(0, 120)
        : fallback.summary,
  };
}
