// Ask Kari — inbound SMS/MMS webhook.
//
// Twilio POSTs here (form-encoded) whenever a text arrives at the Ask Kari number.
// A reply from Kari's phone lands in the visitor's chat thread as a message from her,
// so she can answer from anywhere without opening the admin inbox.
//
// Routing: every alert text carries the conversation's 3-character short_code. A reply
// that starts with that code goes to that thread ("4BX on my way"). With no code we fall
// back to the most recently updated open conversation.
//
// Deployed with verify_jwt = false: Twilio can't send a Supabase JWT. Authentication is
// the X-Twilio-Signature HMAC plus a hard check that the sender is Kari's own number.
//
// SIGNATURE URL: Twilio signs the exact URL it requested. Behind Supabase's edge runtime
// req.url does not always match that (scheme and host can be rewritten upstream), and a
// mismatch fails every inbound message with a 403 — which Twilio reports as 11200 and is
// otherwise invisible. So we try the canonical public URL built from SUPABASE_URL first,
// then req.url, then an explicit TWILIO_WEBHOOK_URL override.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LOG = "[sms-inbound]";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const KARI_ALERT_NUMBER = Deno.env.get("KARI_ALERT_NUMBER");
const TWILIO_WEBHOOK_URL = Deno.env.get("TWILIO_WEBHOOK_URL");

const MEDIA_BUCKET = "support-files";
const db = createClient(SUPABASE_URL, SERVICE_ROLE);

function twiml(message?: string): Response {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${
      message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    }</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response/>`;
  return new Response(body, { status: 200, headers: { "Content-Type": "text/xml" } });
}

async function signatureFor(url: string, params: Record<string, string>): Promise<string> {
  let payload = url;
  for (const k of Object.keys(params).sort()) payload += k + params[k];
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(TWILIO_AUTH_TOKEN ?? ""),
    { name: "HMAC", hash: "SHA-1" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(mac)));
}

async function validSignature(candidates: string[], params: Record<string, string>, sig: string | null): Promise<boolean> {
  if (!sig || !TWILIO_AUTH_TOKEN) return false;
  for (const url of candidates) {
    if (!url) continue;
    if (await signatureFor(url, params) === sig) return true;
  }
  return false;
}

function sameNumber(a: string | undefined | null, b: string | undefined | null): boolean {
  const digits = (s: string | undefined | null) => String(s || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  const x = digits(a), y = digits(b);
  return Boolean(x) && x === y;
}

// Twilio handles STOP/START/HELP itself on most configurations, but when a number is in a
// Messaging Service without Advanced Opt-Out they arrive here instead. They are carrier
// keywords, not chat messages — never post them into someone's conversation.
const CARRIER_KEYWORDS = new Set([
  "START", "YES", "UNSTOP", "STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT",
  "OPTOUT", "REVOKE", "HELP", "INFO", "JOIN",
]);

function splitCode(body: string): { code: string | null; text: string } {
  const m = body.match(/^\s*([2-9A-HJ-NP-Z]{3})\s*[:,.\-—]?\s+([\s\S]+)$/i);
  if (m) return { code: m[1].toUpperCase(), text: m[2].trim() };
  return { code: null, text: body.trim() };
}

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
    const { error } = await db.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType, upsert: true });
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

  const canonical = `${SUPABASE_URL}/functions/v1/sms-inbound`;
  const candidates = [canonical, req.url, TWILIO_WEBHOOK_URL ?? ""];
  if (!(await validSignature(candidates, params, req.headers.get("x-twilio-signature")))) {
    console.error(`${LOG} bad signature; tried: ${candidates.filter(Boolean).join(" | ")}`);
    return new Response("forbidden", { status: 403 });
  }

  const from = params.From || "";
  const body = (params.Body || "").trim();

  if (!sameNumber(from, KARI_ALERT_NUMBER)) {
    console.error(`${LOG} rejected inbound from ${from}`);
    return twiml("This number only takes replies from Ask Kari. Reach Kari at chat.karikounkel.com.");
  }

  // Carrier keywords are consumed here, never posted to a conversation.
  if (CARRIER_KEYWORDS.has(body.toUpperCase())) {
    console.log(`${LOG} carrier keyword: ${body.toUpperCase()}`);
    const kw = body.toUpperCase();
    if (kw === "START" || kw === "YES" || kw === "UNSTOP" || kw === "JOIN") {
      return twiml("Ask Kari: You're now subscribed to alerts when someone messages you through your website chat. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to cancel.");
    }
    if (kw === "HELP" || kw === "INFO") {
      return twiml("Ask Kari: For help email kari@karikounkel.com. Msg frequency varies. Msg & data rates may apply. Reply STOP to cancel.");
    }
    return twiml("You have successfully been unsubscribed. You will not receive any more messages from this number. Reply START to resubscribe.");
  }

  const { code, text } = splitCode(body);

  let conv: { id: string; short_code: string | null; visitor_name: string | null } | null = null;
  if (code) {
    const { data } = await db.from("conversations").select("id, short_code, visitor_name")
      .eq("short_code", code).neq("status", "closed")
      .order("updated_at", { ascending: false }).limit(1).maybeSingle();
    conv = data ?? null;
    if (!conv) return twiml(`No open conversation with code ${code}. Text the code from the alert, then your reply.`);
  } else {
    const { data } = await db.from("conversations").select("id, short_code, visitor_name")
      .neq("status", "closed")
      .order("updated_at", { ascending: false }).limit(1).maybeSingle();
    conv = data ?? null;
    if (!conv) return twiml("No open conversations to reply to right now.");
  }

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
      conversation_id: conv.id, sender: "agent", sender_name: "Kari", body: b,
    });
    if (error) {
      console.error(`${LOG} insert failed:`, error.message);
      return twiml("Couldn't post that — nothing was sent.");
    }
  }

  await db.from("conversations")
    .update({ updated_at: new Date().toISOString(), last_sender: "agent" })
    .eq("id", conv.id);

  const who = conv.visitor_name || "the visitor";
  return twiml(`Sent to ${who}${conv.short_code ? ` (${conv.short_code})` : ""}.`);
});
