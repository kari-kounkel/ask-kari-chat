// Ask Kari — inbound SMS/MMS webhook.
//
// Twilio POSTs here (form-encoded) whenever a text arrives at the Ask Kari number.
// A reply from Kari's phone lands in the visitor's chat thread as a message from her,
// so she can answer from anywhere without opening the admin inbox.
//
// Routing: every alert text carries the conversation's 3-character short_code. A reply
// that starts with that code goes to that thread ("7K2 on my way"). With no code we fall
// back to the most recently updated open conversation — right when only one person is
// talking to her, which is the common case, and why the code exists for when it isn't.
//
// Deployed with verify_jwt = false: Twilio can't send a Supabase JWT. Authentication is
// the X-Twilio-Signature HMAC plus a hard check that the sender is Kari's own number.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LOG = "[sms-inbound]";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const KARI_ALERT_NUMBER = Deno.env.get("KARI_ALERT_NUMBER");
// Set this if the URL Twilio calls differs from what the runtime reports (proxies rewrite
// it); the signature is computed over the exact URL Twilio used, so a mismatch fails auth.
const TWILIO_WEBHOOK_URL = Deno.env.get("TWILIO_WEBHOOK_URL");

const MEDIA_BUCKET = "support-files";

const db = createClient(SUPABASE_URL, SERVICE_ROLE);

// TwiML — Twilio reads this as the response to the inbound message. An empty <Response/>
// means "received, say nothing back."
function twiml(message?: string): Response {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${
      message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    }</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response/>`;
  return new Response(body, { status: 200, headers: { "Content-Type": "text/xml" } });
}

// Twilio's signature: HMAC-SHA1 over the request URL with every POST param appended in
// alphabetical order as key+value, base64-encoded.
async function validSignature(url: string, params: Record<string, string>, signature: string | null): Promise<boolean> {
  if (!signature || !TWILIO_AUTH_TOKEN) return false;
  let payload = url;
  for (const key of Object.keys(params).sort()) payload += key + params[key];
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(TWILIO_AUTH_TOKEN),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  // Constant-time-ish compare.
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

// Phone numbers arrive in a few shapes; compare on digits alone.
function sameNumber(a: string | undefined | null, b: string | undefined | null): boolean {
  const digits = (s: string | undefined | null) => String(s || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  const x = digits(a), y = digits(b);
  return Boolean(x) && x === y;
}

// Pull "7K2 rest of the message" apart. The code is 3 chars from the same alphabet the
// generator uses, optionally followed by a separator.
function splitCode(body: string): { code: string | null; text: string } {
  const m = body.match(/^\s*([2-9A-HJ-NP-Z]{3})\s*[:,.\-—]?\s+([\s\S]+)$/i);
  if (m) return { code: m[1].toUpperCase(), text: m[2].trim() };
  // A bare code with nothing after it isn't a message — treat the whole thing as text.
  return { code: null, text: body.trim() };
}

// MMS media lives on Twilio's CDN behind account auth and doesn't stay forever, so copy
// it into the same bucket the widget uploads visitor screenshots to.
async function storeMedia(mediaUrl: string, contentType: string, conversationId: string): Promise<string | null> {
  try {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return null;
    const res = await fetch(mediaUrl, {
      headers: { Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`) },
    });
    if (!res.ok) throw new Error(`fetch media ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const ext = (contentType.split("/")[1] || "jpg").split(";")[0].replace(/[^a-z0-9]/gi, "") || "jpg";
    const path = `${conversationId}/kari-${Date.now()}.${ext}`;
    const { error } = await db.storage.from(MEDIA_BUCKET).upload(path, bytes, {
      contentType,
      upsert: true,
    });
    if (error) throw new Error(error.message);
    return `${SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
  } catch (e) {
    console.error(`${LOG} media copy failed:`, e instanceof Error ? e.message : String(e));
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return twiml();

  const raw = await req.text();
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(raw)) params[k] = v;

  const url = TWILIO_WEBHOOK_URL || req.url;
  if (!(await validSignature(url, params, req.headers.get("x-twilio-signature")))) {
    console.error(`${LOG} bad signature for ${url}`);
    return new Response("forbidden", { status: 403 });
  }

  const from = params.From || "";
  const body = (params.Body || "").trim();

  // Only Kari's phone may write into conversations. Anyone else who texts the number gets
  // a polite nudge and nothing is stored.
  if (!sameNumber(from, KARI_ALERT_NUMBER)) {
    console.error(`${LOG} rejected inbound from ${from}`);
    return twiml("This number only takes replies from Ask Kari. Reach Kari at chat.karikounkel.com.");
  }

  const { code, text } = splitCode(body);

  let conv: { id: string; short_code: string | null; visitor_name: string | null } | null = null;
  if (code) {
    const { data } = await db
      .from("conversations")
      .select("id, short_code, visitor_name")
      .eq("short_code", code)
      .neq("status", "closed")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    conv = data ?? null;
    if (!conv) return twiml(`No open conversation with code ${code}. Text the code from the alert, then your reply.`);
  } else {
    const { data } = await db
      .from("conversations")
      .select("id, short_code, visitor_name")
      .neq("status", "closed")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    conv = data ?? null;
    if (!conv) return twiml("No open conversations to reply to right now.");
  }

  // Copy any attached photos across before posting, so they arrive in order.
  const bodies: string[] = [];
  const numMedia = parseInt(params.NumMedia || "0", 10) || 0;
  for (let i = 0; i < numMedia; i++) {
    const mediaUrl = params[`MediaUrl${i}`];
    const contentType = params[`MediaContentType${i}`] || "image/jpeg";
    if (!mediaUrl) continue;
    const stored = await storeMedia(mediaUrl, contentType, conv.id);
    if (stored) bodies.push(stored);
  }
  if (text) bodies.unshift(text);
  if (bodies.length === 0) return twiml("Nothing to send — the text was empty.");

  for (const b of bodies) {
    const { error } = await db.from("messages").insert({
      conversation_id: conv.id,
      sender: "agent",
      sender_name: "Kari",
      body: b,
    });
    if (error) {
      console.error(`${LOG} insert failed:`, error.message);
      return twiml("Couldn't post that — nothing was sent.");
    }
  }

  await db
    .from("conversations")
    .update({ updated_at: new Date().toISOString(), last_sender: "agent" })
    .eq("id", conv.id);

  const who = conv.visitor_name || "the visitor";
  return twiml(`Sent to ${who}${conv.short_code ? ` (${conv.short_code})` : ""}.`);
});
