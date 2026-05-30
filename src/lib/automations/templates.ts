import type {
  AutomationStepConfig,
  AutomationStepType,
  AutomationTriggerConfig,
  AutomationTriggerType,
} from '@/types'

export type TemplateSlug =
  | 'welcome_message'
  | 'out_of_office'
  | 'lead_qualifier'
  | 'follow_up_reminder'
  | 'ai_responder'
  | 'ai_smart_triage'
  | 'ai_collect_payment'
  | 'win_back'

export interface TemplateStepSeed {
  step_type: AutomationStepType
  step_config: AutomationStepConfig
  branch?: 'yes' | 'no' | null
  /** Index (within this seed list) of the Condition parent, if nested. */
  parent_index?: number | null
}

export interface AutomationTemplateDefinition {
  slug: TemplateSlug
  name: string
  description: string
  trigger_type: AutomationTriggerType
  trigger_config: AutomationTriggerConfig
  steps: TemplateStepSeed[]
}

export const AUTOMATION_TEMPLATES: Record<TemplateSlug, AutomationTemplateDefinition> = {
  welcome_message: {
    slug: 'welcome_message',
    name: 'Welcome Message',
    description: 'Auto-reply to first-time contacts with a greeting.',
    // first_inbound_message (added in PR #33) catches both brand-new
    // contacts AND manually-added/imported contacts on their first-ever
    // reply, which is what a user setting up a "welcome" automation
    // almost always wants. new_contact_created would miss the
    // manually-imported case.
    trigger_type: 'first_inbound_message',
    trigger_config: {},
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: "Hi! 👋 Thanks for reaching out. We'll get back to you shortly.",
        },
      },
      {
        step_type: 'add_tag',
        step_config: { tag_id: '' },
      },
    ],
  },
  out_of_office: {
    slug: 'out_of_office',
    name: 'Out of Office',
    description: 'Auto-reply during off-hours so nobody is left waiting.',
    trigger_type: 'new_message_received',
    trigger_config: {},
    steps: [
      {
        step_type: 'condition',
        step_config: {
          subject: 'time_of_day',
          operand: '18:00-09:00',
        },
      },
      {
        step_type: 'send_message',
        step_config: {
          text:
            "Thanks for your message! Our team is offline right now (9am–6pm) and will reply first thing tomorrow.",
        },
        parent_index: 0,
        branch: 'yes',
      },
    ],
  },
  lead_qualifier: {
    slug: 'lead_qualifier',
    name: 'Lead Qualifier',
    description: 'Ask qualification questions to filter inbound leads.',
    trigger_type: 'keyword_match',
    trigger_config: {
      keywords: ['pricing', 'quote', 'buy'],
      match_type: 'contains',
    },
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text:
            "Great — happy to help with pricing! Quick question: roughly how many seats are you looking for?",
        },
      },
      {
        step_type: 'wait',
        step_config: { amount: 10, unit: 'minutes' },
      },
      {
        step_type: 'assign_conversation',
        step_config: { mode: 'round_robin' },
      },
    ],
  },
  ai_responder: {
    slug: 'ai_responder',
    name: 'AI Auto-Responder',
    description:
      'Let AI answer every incoming message instantly, 24/7, in the customer’s own language. Add your catalogue and prices under Settings → AI.',
    trigger_type: 'new_message_received',
    trigger_config: {},
    steps: [
      {
        step_type: 'ai_reply',
        step_config: {
          instructions:
            'Answer the customer’s question helpfully and move the sale forward. Use the business context for prices and details. If you truly don’t know, say a team member will follow up.',
        },
      },
    ],
  },
  ai_smart_triage: {
    slug: 'ai_smart_triage',
    name: 'AI Smart Triage',
    description:
      'AI reads every message, routes hot leads & complaints to a human, and auto-answers the rest. Your team only touches what matters.',
    trigger_type: 'new_message_received',
    trigger_config: {},
    steps: [
      // 1. Classify the conversation → writes ai_* vars into the run.
      {
        step_type: 'ai_classify',
        step_config: {},
      },
      // 2. Does a human need to step in (hot lead, complaint, anger)?
      {
        step_type: 'condition',
        step_config: {
          subject: 'variable',
          operand: 'ai_needs_human',
          value: 'true',
        },
      },
      // 2a. YES → hand to a human and notify them with the AI's summary.
      {
        step_type: 'assign_conversation',
        step_config: { mode: 'round_robin' },
        parent_index: 1,
        branch: 'yes',
      },
      // 2b. NO → let the AI answer it, 24/7.
      {
        step_type: 'ai_reply',
        step_config: {
          instructions:
            'Answer helpfully using the business context and move toward a sale. Keep it short and in the customer’s language.',
        },
        parent_index: 1,
        branch: 'no',
      },
    ],
  },
  win_back: {
    slug: 'win_back',
    name: 'Win-Back Dormant Clients',
    description:
      'Re-warm a customer you haven’t heard from in a while. Tag a contact "win-back" (or run on a schedule) and the AI sends a personal, non-pushy reconnect message — then hands replies to you.',
    // Fired by tagging a contact 'win-back' — gives the owner manual control
    // over exactly who gets re-engaged (and avoids messaging active clients).
    trigger_type: 'tag_added',
    trigger_config: { tag_id: '' },
    steps: [
      {
        step_type: 'ai_reply',
        step_config: {
          instructions:
            'This is a past customer we have not heard from in a while. Write a warm, personal reconnect message — reference that it has been a while, ask how they are, and gently invite them back with a reason to return (new stock, a small returning-customer offer if appropriate). Do NOT be salesy or guilt-trip them. One short message.',
        },
      },
    ],
  },
  ai_collect_payment: {
    // Listed under the AI cluster — closes AND collects in one flow.
    slug: 'ai_collect_payment',
    name: 'AI Close & Collect',
    description:
      'When a customer signals they want to buy, the AI confirms the order and sends a payment link automatically. The rail that turns chats into collected cash.',
    trigger_type: 'new_message_received',
    trigger_config: {},
    steps: [
      { step_type: 'ai_classify', step_config: {} },
      {
        step_type: 'condition',
        step_config: { subject: 'variable', operand: 'ai_intent', value: 'buying' },
      },
      {
        step_type: 'ai_reply',
        step_config: {
          instructions:
            'The customer wants to buy. Confirm exactly what they are ordering and the total price from the business context in one short message, then tell them a secure payment link is coming.',
        },
        parent_index: 1,
        branch: 'yes',
      },
    ],
  },
  follow_up_reminder: {
    slug: 'follow_up_reminder',
    name: 'Follow-up Reminder',
    description: 'Send a nudge if a contact has not replied within 24 hours.',
    trigger_type: 'new_message_received',
    trigger_config: {},
    steps: [
      {
        step_type: 'wait',
        step_config: { amount: 1, unit: 'days' },
      },
      {
        step_type: 'send_message',
        step_config: {
          text:
            "Just circling back — did you have any other questions for us? Happy to help!",
        },
      },
    ],
  },
}

export function getTemplate(slug: string): AutomationTemplateDefinition | null {
  return AUTOMATION_TEMPLATES[slug as TemplateSlug] ?? null
}
