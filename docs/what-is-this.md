# What is this product, really?

> A plain-English map of what we've built, who it's for, and exactly how the
> pieces fit together to make money. If you ever feel lost, start here.

---

## 1. The one-sentence answer

**We sell an AI employee that lives inside a business's WhatsApp.** It reads
every message, replies in the customer's own language, figures out who's
ready to buy, collects the payment with a tap-to-pay link, and only
interrupts a human when one is truly needed.

The business keeps its customers and its money. We take a small slice of
each payment the AI helps collect — so we only win when they win.

---

## 2. Explain it like I'm 10

Imagine a lemonade stand where **every customer talks to you on WhatsApp** —
they message to ask the price, to order, and to pay.

Now imagine a **smart helper robot** that:

- 👀 **Watches** every message the moment it arrives, even at 2am.
- 🗣️ **Replies** in the language the customer used (English, Pidgin, Swahili,
  French…), and already knows your prices because you taught it once.
- 🧠 **Decides** what each message means — "wants to buy!", "angry, get a
  human!", "just a question".
- 💸 **Collects the cash** with a payment link in the chat, and pings you the
  moment it's paid.
- 🙋 **Calls a human** only when one is really needed.

**We built that robot.** Its brain runs on *free* AI, so even a tiny shop can
afford it. We earn a small cut of each sale the robot closes.

---

## 3. The two halves: filing cabinet + brain

The project has two layers. It helps to keep them separate in your head.

| Layer | What it is | Who built it |
| --- | --- | --- |
| **The filing cabinet** (base "wacrm") | A tidy place to *see* WhatsApp chats: shared inbox, contacts, sales pipeline, broadcasts, basic automations. It **stores and shows**. | The open-source template we started from. |
| **The brain + cash register** (our work) | The part that **acts on its own**: AI that reads/replies/decides, a payments rail that collects money, a privacy guard, and dials to control how much the AI does alone. | Us, this project. |

A filing cabinet is useful. A filing cabinet with a brain that runs the
business for you is a *superpower*. That's the leap we're building.

---

## 4. What a business actually gets (the features, grouped)

```mermaid
mindmap
  root((WhatsApp AI<br/>Business))
    See & Organize
      Shared inbox
      Contacts + tags
      Sales pipeline
      Broadcasts
    The AI Brain
      Suggest a reply
      Auto-answer 24/7
      Classify & route
      Match the language
    Get Paid
      Payment links in chat
      Paystack / Flutterwave / manual
      Auto-confirm + receipt
      Commission tracked
    Stay Safe
      Hide card numbers / IDs
      Human-in-the-loop (optional)
      Approved templates only
    Grow Itself
      Win-back old customers
      AI writes campaigns
      AI writes social posts
```

---

## 5. How one message flows through the system

This is the heartbeat of the product — what happens when a customer sends
"How much for 2 gowns?"

```mermaid
flowchart TD
    A[Customer messages the business on WhatsApp] --> B[Meta sends a webhook to our app]
    B --> C[Save the message + show it in the inbox in real time]
    C --> D{Any automations switched on?}
    D -- No --> E[A human replies, optionally tapping the AI suggest button]
    D -- Yes --> F[AI Classify reads the chat]
    F --> G{What is this?}
    G -- Angry / complaint --> H[Route to a human teammate]
    G -- Just a question / wants to buy --> I{What is the AI allowed to do?}
    I -- Assist only --> J[AI drafts a reply for a human to approve]
    I -- AI + human / AI only --> K[AI writes & sends the reply in the customer's language]
    K --> L{Customer agrees to buy?}
    L -- Yes --> M[Request Payment: mint a pay-link, send it in chat]
    M --> N[Customer taps & pays via Paystack / Flutterwave / bank]
    N --> O[Payment webhook confirms it]
    O --> P[Drop a paid receipt in the chat + record the sale]
    P --> Q[We keep a small commission; business keeps the rest]
    H --> R[Human closes the conversation, AI keeps notes]
    J --> R
```

The key idea: **the AI doesn't just chat — it carries the customer all the
way from "how much?" to money in the bank**, and steps aside for a human
whenever the business wants.

---

## 6. The three ways a business can run the AI

Human-in-the-loop is the **default**, but every business picks its own
shape (Settings → AI):

```mermaid
flowchart LR
    subgraph Assist[Assist only]
        A1[AI drafts replies] --> A2[Human approves & sends]
    end
    subgraph Loop[AI + human  · default]
        B1[AI auto-answers routine chats] --> B2[Flags hot leads & complaints to a human]
    end
    subgraph Auto[AI only]
        C1[AI handles everything] --> C2[No human needed]
    end
```

A solo trader with no staff might choose **AI only**. A law firm might
choose **Assist only**. Most pick the middle. Same product, their rules.

---

## 7. How the pieces are put together (the architecture)

```mermaid
flowchart TB
    subgraph Phone[Customer]
        WA[WhatsApp chat]
    end

    subgraph Meta[Meta / WhatsApp Cloud API]
        MW[Webhooks in/out]
    end

    subgraph App[Our App · Next.js]
        IN[Inbox UI]
        SET[Settings: AI · Payments · WhatsApp]
        AUTO[Automation builder]
        subgraph Server[Server routes]
            WH["whatsapp/webhook"]
            AI["api/ai"]
            PAY["payments routes"]
            ENG[Automation engine]
        end
        subgraph Brains[The smart bits]
            LLM[AI client → free LLMs]
            PII[PII guard / redaction]
            PROV[Payment providers]
        end
    end

    subgraph Cloud[Outside services]
        OR[OpenRouter / Nvidia · free models]
        PS[Paystack / Flutterwave]
        DB[(Supabase: Postgres + Auth + Realtime)]
    end

    WA <--> MW
    MW <--> WH
    WH --> ENG
    ENG --> LLM
    ENG --> PROV
    LLM --> OR
    PROV --> PS
    AI --> LLM
    LLM --> PII
    PAY --> PROV
    PS -. payment confirmed .-> PAY
    IN <--> DB
    SET <--> DB
    AUTO <--> DB
    WH --> DB
    ENG --> DB
    PAY --> DB
    IN -. live updates .- DB
```

**Plain reading of the diagram:**
- The **customer** only ever sees WhatsApp.
- **Meta** is the postman carrying messages both ways.
- **Our app** is the shop's back office: the inbox a human sees, the
  settings, the automation builder, and the server "workers" that do the
  heavy lifting.
- The **smart bits** are reusable engines: the AI client (talks to *free*
  models), the privacy guard (hides card numbers before anything leaves),
  and the payment providers (mint links, take the fee).
- **Outside services**: free AI (OpenRouter/Nvidia), the payment gateways,
  and Supabase (our database + login + the live-updating inbox).

---

## 8. The customer journey, end to end

```mermaid
journey
    title A customer buys, with the AI in the middle
    section Discover
      Sees a WhatsApp link in an ad or status: 4: Customer
      Sends first message: 5: Customer
    section Engage
      AI greets in their language, knows the catalogue: 5: AI
      Customer asks price & details: 4: Customer
      AI answers accurately from business context: 5: AI
    section Decide
      Customer says "I'll take 2": 5: Customer
      AI confirms order & total: 5: AI
    section Pay
      AI sends a tap-to-pay link: 5: AI
      Customer pays: 4: Customer
      Chat shows a paid receipt instantly: 5: AI, Business
    section Keep
      Weeks later, AI sends a friendly win-back: 4: AI
      Customer returns: 5: Customer
```

---

## 9. The business owner's journey (setup → running)

```mermaid
journey
    title Getting a business up and running
    section Set up once
      Connect WhatsApp number: 3: Owner
      Paste catalogue & prices into Settings → AI: 4: Owner
      Connect Paystack or bank details: 3: Owner
      Pick how much the AI does (assist / hybrid / auto): 5: Owner
    section Turn it on
      Add the "AI Close & Collect" automation: 5: Owner
      Flip it active: 5: Owner
    section Let it run
      AI answers & sells 24/7: 5: AI
      Owner handles only flagged chats: 4: Owner
      Money lands; receipts appear: 5: Owner, AI
    section Grow
      AI drafts broadcasts & social posts: 4: AI
      Win-back brings old customers back: 4: AI
```

---

## 10. How *we* (the platform) make money

```mermaid
flowchart LR
    A[AI helps close a sale] --> B[Payment flows through a link WE mint]
    B --> C[Money settles to the business]
    C --> D[We keep a small commission · basis points]
    D --> E{Bigger company?}
    E -- prefers predictability --> F[Optional flat subscription]
    E -- small trader --> G[Pay nothing upfront · only commission]
```

- **No subscriptions for the little guy** — they hate/can't afford them. We
  take a small commission **only on money actually collected**.
- **Bigger companies** can opt into a flat plan instead.
- Our cost to run the AI is near **zero** (free models), so the math works
  even on tiny transactions.

Full detail: [`../STRATEGY.md`](../STRATEGY.md) §5.

---

## 11. Where every part lives in the code

| The part | Where it lives |
| --- | --- |
| AI brain (talks to free models) | `src/lib/ai/client.ts`, `src/lib/ai/prompts.ts` |
| AI endpoint (suggest/improve/campaigns) | `src/app/api/ai/route.ts` |
| Auto-answer & routing (the engine) | `src/lib/automations/engine.ts` |
| The automation builder UI | `src/components/automations/automation-builder.tsx` |
| Ready-made recipes (templates) | `src/lib/automations/templates.ts` |
| Payments brain | `src/lib/payments/` |
| Payment endpoints + webhook | `src/app/api/payments/` |
| Privacy guard | `src/lib/safety/pii.ts` |
| Business settings (AI, Payments) | `src/components/settings/` |
| WhatsApp connection + inbox | `src/app/api/whatsapp/`, `src/components/inbox/` |
| Database tables | `supabase/migrations/` |

---

## 12. What it is NOT (to avoid confusion)

- ❌ It is **not** a chatbot you bolt onto a website. It lives in the
  business's real WhatsApp, with real customers.
- ❌ It is **not** a spam blaster. It respects WhatsApp's rules (opt-in,
  approved templates, the 24-hour window).
- ❌ It is **not** "AI replaces everyone." Human-in-the-loop is the default;
  the AI removes the *boring* 80%, and hands the human the 20% that needs
  judgement.
- ❌ It is **not** an expensive enterprise tool. The brain is free to run, so
  it's built for a market that can't pay subscriptions.

---

## 13. The whole thing in three sentences

1. Businesses in Africa run on WhatsApp but drown in messages and lose
   sales overnight.
2. We give them an **AI employee** that answers, sells, and collects money
   in the chat 24/7 — with a human in the loop exactly as much as they
   want.
3. It costs them nothing upfront because the AI runs on free models, and we
   earn a small cut of every sale it closes — so our success is glued to
   theirs.
