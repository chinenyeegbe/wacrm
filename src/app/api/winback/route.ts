import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { selectDormant, isWinbackWindow } from "@/lib/winback/dormant";

/**
 * Win-back: who hasn't this business heard from in a while.
 *
 * GET /api/winback?days=30  ->  { days, count, customers[] }
 *
 * Read-only and authenticated. It only SELECTS who to re-engage; it does not
 * send anything. Re-engaging a customer who last messaged over 24 hours ago
 * is outside WhatsApp's care window, so the actual outreach must go through
 * the broadcast flow as an approved template. This endpoint feeds that flow.
 */

// Cap the list we hand back so a huge contact book stays a fast page.
const MAX_RESULTS = 100;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = Number(new URL(request.url).searchParams.get("days") ?? 30);
  const days = isWinbackWindow(raw) ? raw : 30;

  // RLS already scopes to this user; the explicit filter is belt-and-braces.
  const { data, error } = await supabase
    .from("conversations")
    .select("id, last_message_at, status, contact:contacts(name, phone)")
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const dormant = selectDormant(data ?? [], { days });
  const customers = dormant.slice(0, MAX_RESULTS).map((d) => {
    const c = Array.isArray(d.item.contact) ? d.item.contact[0] : d.item.contact;
    return {
      conversation_id: d.item.id,
      name: c?.name ?? null,
      phone: c?.phone ?? null,
      days_quiet: d.daysQuiet,
    };
  });

  return NextResponse.json({ days, count: dormant.length, customers });
}
