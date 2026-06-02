/**
 * AI client, a thin, provider-agnostic wrapper over OpenAI-compatible
 * chat-completion APIs, tuned to run on FREE large-language models.
 *
 * Why this exists
 * ---------------
 * This template is built for African businesses that need a genuine
 * superpower without a cloud bill. Every model defaulted to here is on a
 * provider's free tier, so a forker can switch the whole AI layer on with
 * a single env var and pay nothing until they choose to scale up.
 *
 * Providers (auto-selected from whichever key is present):
 *   1. OpenRouter, set OPENROUTER_API_KEY. Aggregates dozens of free
 *      models (Llama, Gemini, DeepSeek, Nvidia Nemotron, …) behind one
 *      OpenAI-compatible endpoint. Free models carry a `:free` suffix.
 *   2. Nvidia NIM, set NVIDIA_API_KEY. Hosts Nemotron directly, also
 *      OpenAI-compatible. Generous free quota for builders.
 *
 * Both speak the same `/chat/completions` shape, so the only difference is
 * the base URL, the auth header, and a couple of optional headers.
 *
 * Resilience: free endpoints are best-effort and rate-limited, so we try a
 * list of models in order and fall through to the next one on failure. The
 * first model that answers wins. Nothing here throws on a missing key, 
 * callers check `isAIConfigured()` and degrade gracefully.
 */

type Provider = "openrouter" | "nvidia";

interface ProviderConfig {
  provider: Provider;
  apiKey: string;
  baseUrl: string;
  /** Ordered model fallback list, first to answer wins. */
  models: string[];
  /** Extra headers (OpenRouter likes attribution headers). */
  extraHeaders: Record<string, string>;
}

/** Sensible free-tier defaults. Override per deployment via env. */
const DEFAULT_OPENROUTER_MODELS = [
  "nvidia/nemotron-nano-9b-v2:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "google/gemini-2.0-flash-exp:free",
  "qwen/qwen-2.5-72b-instruct:free",
];

const DEFAULT_NVIDIA_MODELS = [
  "nvidia/nemotron-4-340b-instruct",
  "meta/llama-3.3-70b-instruct",
];

function parseModels(raw: string | undefined): string[] | null {
  if (!raw) return null;
  const list = raw
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return list.length ? list : null;
}

/**
 * Resolve the active provider from the environment. OpenRouter wins if both
 * keys are set, because it gives the widest free-model selection.
 */
function resolveConfig(): ProviderConfig | null {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://wacrm.tech";

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey) {
    return {
      provider: "openrouter",
      apiKey: openrouterKey,
      baseUrl: "https://openrouter.ai/api/v1",
      models:
        parseModels(process.env.AI_MODELS) ??
        parseModels(process.env.OPENROUTER_MODEL) ??
        DEFAULT_OPENROUTER_MODELS,
      extraHeaders: {
        // OpenRouter uses these for attribution / free-tier ranking.
        "HTTP-Referer": siteUrl,
        "X-Title": "wacrm",
      },
    };
  }

  const nvidiaKey = process.env.NVIDIA_API_KEY;
  if (nvidiaKey) {
    return {
      provider: "nvidia",
      apiKey: nvidiaKey,
      baseUrl: "https://integrate.api.nvidia.com/v1",
      models:
        parseModels(process.env.AI_MODELS) ??
        parseModels(process.env.NVIDIA_MODEL) ??
        DEFAULT_NVIDIA_MODELS,
      extraHeaders: {},
    };
  }

  return null;
}

/** True when at least one provider key is configured. */
export function isAIConfigured(): boolean {
  return resolveConfig() !== null;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  system?: string;
  messages: ChatMessage[];
  /** 0 = deterministic, 1 = creative. Defaults to 0.6. */
  temperature?: number;
  maxTokens?: number;
  /** Abort the whole call (across fallbacks) after this many ms. */
  timeoutMs?: number;
}

export class AINotConfiguredError extends Error {
  constructor() {
    super(
      "No AI provider configured. Set OPENROUTER_API_KEY (recommended) or NVIDIA_API_KEY.",
    );
    this.name = "AINotConfiguredError";
  }
}

/**
 * Run a chat completion against the configured provider, falling through the
 * model list on failure. Returns the assistant's text.
 *
 * @throws AINotConfiguredError when no provider key is set.
 * @throws Error when every model in the fallback list fails.
 */
export async function chatComplete(options: ChatOptions): Promise<string> {
  const config = resolveConfig();
  if (!config) throw new AINotConfiguredError();

  const {
    system,
    messages,
    temperature = 0.6,
    maxTokens = 600,
    timeoutMs = 30_000,
  } = options;

  const fullMessages: ChatMessage[] = system
    ? [{ role: "system", content: system }, ...messages]
    : messages;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let lastError: unknown = null;
  try {
    for (const model of config.models) {
      try {
        const res = await fetch(`${config.baseUrl}/chat/completions`, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
            ...config.extraHeaders,
          },
          body: JSON.stringify({
            model,
            messages: fullMessages,
            temperature,
            max_tokens: maxTokens,
          }),
        });

        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          lastError = new Error(
            `Model ${model} returned ${res.status}: ${detail.slice(0, 200)}`,
          );
          // 4xx that isn't rate-limiting won't fix itself on another model
          // of the same kind, but trying the next (different) model is cheap
          // and often the right move on free tiers, so we keep going.
          continue;
        }

        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) return text;

        lastError = new Error(`Model ${model} returned an empty response`);
      } catch (err) {
        lastError = err;
        // Abort = caller timeout; stop trying further models.
        if (err instanceof Error && err.name === "AbortError") break;
      }
    }
  } finally {
    clearTimeout(timer);
  }

  const reason =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`All AI models failed. Last error: ${reason}`);
}
