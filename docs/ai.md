# AI assistant (free LLMs)

wacrm ships with an AI layer that runs on **free** large-language models.
Turn it on with one environment variable and it costs nothing until you
choose to scale.

## What it does today

- **Suggest reply** — in the inbox composer, click the ✨ button with an
  empty box and the AI drafts the next reply from the conversation
  history. It matches the customer's language (English, Pidgin, Swahili,
  French, Hausa, Yoruba, Arabic, …).
- **Rewrite draft** — type something first, then click ✨ to polish it.
- **AI copy API** — `POST /api/ai` also drafts broadcast campaigns
  (`draft_broadcast`) and social-media posts (`draft_social`) so the
  business can market itself. See "API" below.

## Setup (2 minutes, $0)

1. Create a free key at <https://openrouter.ai/keys>.
2. Add it to `.env.local`:

   ```bash
   OPENROUTER_API_KEY=sk-or-...
   ```

3. Restart the dev server. The ✨ button now works.

That's it. The default models all carry a `:free` suffix, so OpenRouter
charges $0 for them.

### Alternative: Nvidia NIM (Nemotron)

Prefer to call Nvidia directly? Get a key at <https://build.nvidia.com>
and set `NVIDIA_API_KEY` instead. OpenRouter takes priority if both are
set.

### Choosing models

The client tries a fallback list and the first model to answer wins —
important on free tiers, which are best-effort and rate-limited. Override
the list with `AI_MODELS` (comma-separated, first preferred):

```bash
AI_MODELS=nvidia/nemotron-nano-9b-v2:free,meta-llama/llama-3.3-70b-instruct:free
```

## Security & cost model

- The provider key lives **only** on the server. The browser receives the
  generated text, never the key.
- Every call is authenticated (Supabase session) and per-user
  rate-limited (30/min) — same posture as the WhatsApp routes.
- No prompt content is stored by wacrm. What the upstream provider logs is
  governed by their policy — read it before sending sensitive data.

## API

`POST /api/ai` (authenticated). Body shapes:

| action            | body                                              | returns        |
| ----------------- | ------------------------------------------------- | -------------- |
| `suggest_reply`   | `{ conversation_id }`                              | `{ result }`   |
| `improve`         | `{ draft, mode, target_language? }`               | `{ result }`   |
| `draft_broadcast` | `{ brief, tone?, language? }`                      | `{ result }`   |
| `draft_social`    | `{ brief, platform }`                             | `{ result }`   |

`improve` modes: `rewrite`, `shorten`, `professional`, `friendly`, `fix`,
`translate` (pair with `target_language`).

Returns `503` when no provider key is configured, so the UI can degrade
gracefully.

## Where the code lives

- `src/lib/ai/client.ts` — provider-agnostic chat client + fallbacks.
- `src/lib/ai/prompts.ts` — Africa-aware prompt builders.
- `src/app/api/ai/route.ts` — the authenticated endpoint.
- `src/components/inbox/message-composer.tsx` — the ✨ button.

See [`STRATEGY.md`](../STRATEGY.md) for the longer roadmap (AI automation
steps, self-marketing, and the operator/agency model).
