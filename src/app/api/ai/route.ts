import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { chatComplete, isAIConfigured, AINotConfiguredError } from "@/lib/ai/client";
import {
  buildReplyPrompt,
  buildImprovePrompt,
  buildBroadcastPrompt,
  buildSocialPrompt,
  type ImproveMode,
} from "@/lib/ai/prompts";

/**
 * Single AI endpoint for the whole app. Dispatches on `action`:
 *   - suggest_reply   { conversation_id }      → draft the next reply
 *   - improve         { draft, mode, target_language }
 *   - draft_broadcast { brief, tone, language }
 *   - draft_social    { brief, platform }
 *
 * The provider key never leaves the server — the browser only ever sees the
 * generated text. Auth + per-user rate limiting mirror the WhatsApp routes.
 */

// Free LLM calls are slow-ish; give them room beyond the default budget.
const AI_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

// How many recent messages to feed the model for a reply suggestion. Enough
// for context, capped so we stay well inside free-tier token limits.
const HISTORY_LIMIT = 15;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAIConfigured()) {
      return NextResponse.json(
        {
          error:
            "AI is not configured. Add OPENROUTER_API_KEY (free models) to your environment.",
        },
        { status: 503 },
      );
    }

    const limit = checkRateLimit(`ai:${user.id}`, AI_RATE_LIMIT);
    if (!limit.success) return rateLimitResponse(limit);

    const body = await request.json().catch(() => ({}));
    const action = body?.action as string | undefined;

    switch (action) {
      case "suggest_reply": {
        const conversationId = body?.conversation_id as string | undefined;
        if (!conversationId) {
          return NextResponse.json(
            { error: "conversation_id is required" },
            { status: 400 },
          );
        }

        // RLS guarantees the user can only read their own conversation.
        const { data: conversation, error: convError } = await supabase
          .from("conversations")
          .select("id, contact:contacts(name, company)")
          .eq("id", conversationId)
          .eq("user_id", user.id)
          .single();

        if (convError || !conversation) {
          return NextResponse.json(
            { error: "Conversation not found" },
            { status: 404 },
          );
        }

        const { data: messages, error: msgError } = await supabase
          .from("messages")
          .select("sender_type, content_text, content_type, created_at")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false })
          .limit(HISTORY_LIMIT);

        if (msgError) {
          return NextResponse.json(
            { error: "Failed to load conversation" },
            { status: 500 },
          );
        }

        const contact = Array.isArray(conversation.contact)
          ? conversation.contact[0]
          : conversation.contact;

        // Pull the workspace business context so the inbox suggestion and
        // the AI Reply automation step share one source of truth.
        const { data: aiSettings } = await supabase
          .from("ai_settings")
          .select("business_context")
          .eq("user_id", user.id)
          .maybeSingle();

        const history = (messages ?? [])
          .slice()
          .reverse()
          .filter((m) => m.content_text)
          .map((m) => ({
            fromCustomer: m.sender_type === "customer",
            text:
              m.content_type === "text"
                ? (m.content_text as string)
                : `[${m.content_type}] ${m.content_text}`,
          }));

        const { system, messages: prompt } = buildReplyPrompt({
          contactName: contact?.name,
          contactCompany: contact?.company,
          history,
          businessContext: aiSettings?.business_context ?? null,
        });

        const result = await chatComplete({
          system,
          messages: prompt,
          temperature: 0.6,
        });
        return NextResponse.json({ result });
      }

      case "improve": {
        const draft = (body?.draft as string | undefined)?.trim();
        const mode = (body?.mode as ImproveMode | undefined) ?? "rewrite";
        const targetLanguage = body?.target_language as string | undefined;
        if (!draft) {
          return NextResponse.json(
            { error: "draft is required" },
            { status: 400 },
          );
        }
        const { system, messages: prompt } = buildImprovePrompt(
          draft,
          mode,
          targetLanguage,
        );
        const result = await chatComplete({
          system,
          messages: prompt,
          temperature: 0.4,
        });
        return NextResponse.json({ result });
      }

      case "draft_broadcast": {
        const brief = (body?.brief as string | undefined)?.trim();
        if (!brief) {
          return NextResponse.json(
            { error: "brief is required" },
            { status: 400 },
          );
        }
        const { system, messages: prompt } = buildBroadcastPrompt(brief, {
          tone: body?.tone,
          language: body?.language,
        });
        const result = await chatComplete({
          system,
          messages: prompt,
          temperature: 0.7,
        });
        return NextResponse.json({ result });
      }

      case "draft_social": {
        const brief = (body?.brief as string | undefined)?.trim();
        const platform = (body?.platform as string | undefined) ?? "Instagram";
        if (!brief) {
          return NextResponse.json(
            { error: "brief is required" },
            { status: 400 },
          );
        }
        const { system, messages: prompt } = buildSocialPrompt(brief, platform);
        const result = await chatComplete({
          system,
          messages: prompt,
          temperature: 0.8,
        });
        return NextResponse.json({ result });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    if (error instanceof AINotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Error in AI route:", error);
    return NextResponse.json(
      { error: "AI request failed. Please try again." },
      { status: 502 },
    );
  }
}
