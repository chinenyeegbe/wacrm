/**
 * Payment providers, a thin, PSP-agnostic abstraction over the African
 * payment gateways that matter (Paystack, Flutterwave), plus a zero-config
 * "manual" fallback (bank / mobile-money instructions) so a merchant can
 * start collecting before they have any gateway account.
 *
 * Why this shape
 * --------------
 * This is the rail that makes commission *collectable*: money moves through
 * a checkout link we mint, so the platform fee is taken at settlement, not
 * invoiced. Each provider only needs to (1) create a hosted checkout link
 * for an amount and (2) verify an incoming webhook so we can flip a request
 * to 'paid'. Everything else (attribution, fee math, persistence) is
 * provider-independent and lives in the route/engine.
 *
 * Amounts are ALWAYS in minor units (kobo/cents) as integers, no floats.
 */

export type PaymentProvider = "paystack" | "flutterwave" | "manual";

export interface CreateCheckoutInput {
  provider: PaymentProvider;
  /** Decrypted secret key (ignored for 'manual'). */
  secretKey?: string | null;
  amountMinor: number;
  currency: string;
  /** Our own reference, the idempotency + reconciliation key. */
  reference: string;
  /** Customer email; PSPs require one. We synthesise a placeholder if absent. */
  email: string;
  description?: string;
  /** Where the PSP returns the customer after payment. */
  callbackUrl?: string;
  /** Free-text instructions for the 'manual' provider. */
  manualInstructions?: string;
}

export interface CreateCheckoutResult {
  /** Hosted checkout URL, or null for 'manual' (instructions are the "link"). */
  checkoutUrl: string | null;
  /** Provider-side reference if it differs from ours; defaults to ours. */
  providerReference: string;
  /** For 'manual': the text to send the customer instead of a URL. */
  instructions?: string;
}

const PAYSTACK_BASE = "https://api.paystack.co";
const FLUTTERWAVE_BASE = "https://api.flutterwave.com/v3";

/** Build the message we send the customer for any provider. */
export function paymentMessage(
  result: CreateCheckoutResult,
  opts: { amountMinor: number; currency: string; description?: string },
): string {
  const amount = formatMinor(opts.amountMinor, opts.currency);
  const what = opts.description ? ` for ${opts.description}` : "";
  if (result.checkoutUrl) {
    return `Here is your secure payment link${what}: ${amount}\n${result.checkoutUrl}\n\nTap to pay, you'll get a confirmation once it goes through. Thank you! 🙏`;
  }
  // manual
  return `To complete your payment${what} (${amount}):\n\n${result.instructions ?? ""}\n\nPlease send proof once done and we'll confirm. Thank you! 🙏`;
}

/** Human-readable amount from minor units. */
export function formatMinor(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  // Intl gives proper grouping; fall back to a plain string if the currency
  // code is unknown to the runtime.
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}

export async function createCheckout(
  input: CreateCheckoutInput,
): Promise<CreateCheckoutResult> {
  switch (input.provider) {
    case "paystack":
      return createPaystackCheckout(input);
    case "flutterwave":
      return createFlutterwaveCheckout(input);
    case "manual":
      return {
        checkoutUrl: null,
        providerReference: input.reference,
        instructions:
          input.manualInstructions ||
          "Bank transfer, ask us for account details.",
      };
    default:
      throw new Error(`Unknown payment provider: ${input.provider}`);
  }
}

async function createPaystackCheckout(
  input: CreateCheckoutInput,
): Promise<CreateCheckoutResult> {
  if (!input.secretKey) throw new Error("Paystack secret key not configured");

  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount: input.amountMinor, // Paystack expects minor units (kobo)
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: { description: input.description },
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    status?: boolean;
    message?: string;
    data?: { authorization_url?: string; reference?: string };
  };

  if (!res.ok || !data.status || !data.data?.authorization_url) {
    throw new Error(
      `Paystack init failed: ${data.message || `HTTP ${res.status}`}`,
    );
  }

  return {
    checkoutUrl: data.data.authorization_url,
    providerReference: data.data.reference ?? input.reference,
  };
}

async function createFlutterwaveCheckout(
  input: CreateCheckoutInput,
): Promise<CreateCheckoutResult> {
  if (!input.secretKey)
    throw new Error("Flutterwave secret key not configured");

  const res = await fetch(`${FLUTTERWAVE_BASE}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: input.reference,
      // Flutterwave uses MAJOR units (naira, not kobo).
      amount: (input.amountMinor / 100).toFixed(2),
      currency: input.currency,
      redirect_url: input.callbackUrl,
      customer: { email: input.email },
      customizations: { title: "Payment", description: input.description },
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    status?: string;
    message?: string;
    data?: { link?: string };
  };

  if (!res.ok || data.status !== "success" || !data.data?.link) {
    throw new Error(
      `Flutterwave init failed: ${data.message || `HTTP ${res.status}`}`,
    );
  }

  return {
    checkoutUrl: data.data.link,
    providerReference: input.reference,
  };
}

/**
 * Compute the platform commission for a paid amount.
 * Pure integer math on minor units, bps/10000 of the gross.
 */
export function computePlatformFee(
  amountMinor: number,
  feeBps: number,
): number {
  if (feeBps <= 0) return 0;
  return Math.round((amountMinor * feeBps) / 10000);
}
