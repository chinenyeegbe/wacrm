import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Magic-link landing — the only place a session is ever minted (there
// are no passwords anywhere in this app).
//
// Flow: the user requests a link from /login or /signup
// (`signInWithOtp`), which stores a PKCE code-verifier cookie in their
// browser. Supabase emails a link to its own /verify endpoint; clicking
// it bounces the browser back here with a short-lived `?code`. We trade
// that code (plus the verifier cookie) for a session via
// `exchangeCodeForSession`, which writes the auth cookies, then forward
// the user into the app.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));
  const emailedError = searchParams.get("error_description");

  const bounceToLogin = (message: string) =>
    NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(message)}`,
    );

  // Supabase appends error_description when the link itself is bad
  // (expired, already used) — surface that rather than a blank code.
  if (emailedError) return bounceToLogin(emailedError);

  if (!code) {
    return bounceToLogin(
      "That sign-in link is invalid or has expired. Request a new one.",
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return bounceToLogin(
      "That sign-in link is invalid or has expired. Request a new one.",
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}

// Only same-origin relative paths are allowed as the post-login
// destination, so a crafted `?next=https://evil.example` can't turn the
// callback into an open redirect. `//` is rejected (protocol-relative).
function sanitizeNext(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}
