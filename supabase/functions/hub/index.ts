// Centralized Notification & AI Hub (kcocares.com)
// Single edge function every product calls for SMS alerts, transactional email,
// and Claude-drafted Ask Kari responses. All credentials come from env/secrets;
// nothing is hardcoded. Authenticated via a shared webhook secret (no user JWT),
// so this function is deployed with verify_jwt = false.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LOG = "[hub]";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HUB_WEBHOOK_SECRET = Deno.env.get("HUB_WEBHOOK_SECRET");

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER");
const KARI_ALERT_NUMBER = Deno.env.get("KARI_ALERT_NUMBER");

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM");

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-opus-4-7";

// Visible disclosure required on every AI-assisted response.
const AI_DISCLOSURE = "\n\n— AI-assisted, reviewed by Kari.";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "*")
  .split(",")
  .map((o) => o.trim());

const db = createClient(SUPABASE_URL, SERVICE_ROLE);

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = ALLOWED_ORIGINS.includes("*")
    ? "*"
    : origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0] ?? "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "content-type, x-hub-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

async function sendSMS(to: string, body: string): Promise<void> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    throw new Error("Twilio SMS env not configured");
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const form = new URLSearchParams({ To: to, From: TWILIO_FROM_NUMBER, Body: body });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
}

async function sendEmail(
  to: string,
  subject: string,
  body: string,
): Promise<void> {
  if (!SENDGRID_API_KEY || !EMAIL_FROM) {
    throw new Error("Twilio Email (SendGrid) env not configured");
  }
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: EMAIL_FROM },
      subject,
      content: [{ type: "text/plain", value: body }],
    }),
  });
  if (!res.ok) throw new Error(`SendGrid ${res.status}: ${await res.text()}`);
}

async function draftReply(question: string, visitorName?: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 600,
      system:
        "You are drafting a warm, concise reply on behalf of Kari Kounkel to a " +
        "visitor's question submitted through the Ask Kari widget. Write in first " +
        "person as Kari. Keep it friendly and practical. Do not invent specifics " +
        "you do not know; offer to follow up where needed. This draft will be " +
        "reviewed and edited by Kari before sending.",
      messages: [
        {
          role: "user",
          content: `Visitor${visitorName ? " " + visitorName : ""} asked:\n\n${question}`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("")
    .trim();
  return text + AI_DISCLOSURE;
}

async function logNotification(
  type: string,
  channel: "sms" | "email",
  payload: Record<string, unknown>,
  source: string | null,
  send: () => Promise<void>,
): Promise<{ id: string; status: string; error?: string }> {
  const { data, error } = await db
    .from("notifications")
    .insert({ type, channel, payload, source, status: "pending" })
    .select("id")
    .single();
  if (error) throw new Error(`notifications insert failed: ${error.message}`);
  const id = data.id as string;
  try {
    await send();
    await db
      .from("notifications")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", id);
    return { id, status: "sent" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.from("notifications").update({ status: "failed", error: message }).eq("id", id);
    console.error(`${LOG} send failed for ${id}:`, message);
    return { id, status: "failed", error: message };
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405, origin);
  }
  if (!HUB_WEBHOOK_SECRET || req.headers.get("x-hub-secret") !== HUB_WEBHOOK_SECRET) {
    return json({ error: "unauthorized" }, 401, origin);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400, origin);
  }

  const action = String(body.action ?? "");
  const source = body.source ? String(body.source) : null;

  try {
    if (action === "notify") {
      // Generic transactional notification from any deployment.
      const channel = String(body.channel ?? "");
      const type = String(body.type ?? "notify");
      if (channel === "sms") {
        const to = String(body.to ?? "");
        const text = String(body.body ?? "");
        if (!to || !text) return json({ error: "to and body required" }, 400, origin);
        const r = await logNotification(type, "sms", { to, body: text }, source, () =>
          sendSMS(to, text)
        );
        return json(r, r.status === "sent" ? 200 : 502, origin);
      }
      if (channel === "email") {
        const to = String(body.to ?? "");
        const subject = String(body.subject ?? "");
        const text = String(body.body ?? "");
        if (!to || !subject || !text) {
          return json({ error: "to, subject and body required" }, 400, origin);
        }
        const r = await logNotification(
          type,
          "email",
          { to, subject, body: text },
          source,
          () => sendEmail(to, subject, text),
        );
        return json(r, r.status === "sent" ? 200 : 502, origin);
      }
      return json({ error: "channel must be sms or email" }, 400, origin);
    }

    if (action === "ask_kari") {
      // Ask Kari submission: alert Kari by SMS now, and draft a reply for review.
      const question = String(body.question ?? "");
      const visitorName = body.visitor_name ? String(body.visitor_name) : undefined;
      const conversationId = body.conversation_id ? String(body.conversation_id) : null;
      if (!question) return json({ error: "question required" }, 400, origin);

      const alert = KARI_ALERT_NUMBER
        ? await logNotification(
          "ask_kari",
          "sms",
          { to: KARI_ALERT_NUMBER, question, visitor_name: visitorName },
          source,
          () =>
            sendSMS(
              KARI_ALERT_NUMBER,
              `Ask Kari${visitorName ? " from " + visitorName : ""}: ${question.slice(0, 300)}`,
            ),
        )
        : { id: null, status: "skipped", error: "KARI_ALERT_NUMBER not set" };

      let draftId: string | null = null;
      let draftError: string | null = null;
      try {
        const draft = await draftReply(question, visitorName);
        const { data, error } = await db
          .from("ai_responses")
          .insert({ submission_id: conversationId, draft_response: draft })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        draftId = data.id as string;
      } catch (e) {
        draftError = e instanceof Error ? e.message : String(e);
        console.error(`${LOG} draft failed:`, draftError);
      }

      return json({ alert, draft_id: draftId, draft_error: draftError }, 200, origin);
    }

    return json({ error: `unknown action: ${action}` }, 400, origin);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`${LOG} unhandled:`, message);
    return json({ error: message }, 500, origin);
  }
});
