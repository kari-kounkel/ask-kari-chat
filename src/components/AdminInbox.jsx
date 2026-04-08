import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";

const printTranscript = (active, messages, siteTag, timeAgo) => {
  const formatTime = (ts) => new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  const rows = messages.map(m => `
    <div class="msg ${m.sender === "agent" ? "agent" : "visitor"}">
      <div class="bubble">${m.body.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
      <div class="meta">${m.sender === "agent" ? "Kari" : (active.visitor_name || "Visitor")} · ${formatTime(m.created_at)}</div>
    </div>`).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <title>Ask Kari — Chat Transcript</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Playfair+Display:wght@700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', sans-serif; background: #fdf6f2; color: #2a1a10; padding: 40px; max-width: 700px; margin: 0 auto; }
    .header { border-bottom: 2px solid #e03820; padding-bottom: 20px; margin-bottom: 28px; }
    .logo { font-family: 'Playfair Display', serif; font-size: 26px; color: #e03820; }
    .tagline { font-size: 11px; color: #a07060; font-style: italic; margin-top: 2px; }
    .meta-block { margin-top: 12px; font-size: 12px; color: #a07060; line-height: 1.8; }
    .meta-block strong { color: #2a1a10; }
    .messages { display: flex; flex-direction: column; gap: 16px; }
    .msg { display: flex; flex-direction: column; }
    .msg.agent { align-items: flex-end; }
    .msg.visitor { align-items: flex-start; }
    .bubble { max-width: 75%; padding: 10px 16px; border-radius: 14px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
    .agent .bubble { background: linear-gradient(135deg,#e03820,#f07830); color: #fff; border-radius: 16px 16px 4px 16px; }
    .visitor .bubble { background: #fff; border: 1.5px solid #e8cfc0; color: #2a1a10; border-radius: 16px 16px 16px 4px; }
    .meta { font-size: 11px; color: #b09080; margin-top: 4px; padding: 0 4px; }
    .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #e8cfc0; font-size: 11px; color: #c0a090; text-align: center; }
    @media print { body { background: #fff; } .agent .bubble { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style></head><body>
  <div class="header">
    <div class="logo">Ask Kari</div>
    <div class="tagline">Clarity with a side of mischief · CARES Consulting Inc.</div>
    <div class="meta-block">
      <strong>Visitor:</strong> ${active.visitor_name || "Anonymous"}<br/>
      ${active.visitor_email ? `<strong>Email:</strong> ${active.visitor_email}<br/>` : ""}
      <strong>Site:</strong> ${siteTag(active.site_origin)}<br/>
      <strong>Printed:</strong> ${new Date().toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
    </div>
  </div>
  <div class="messages">${rows}</div>
  <div class="footer">Ask Kari · karikounkel.com · Kari Hoglund Kounkel · 651-334-1300</div>
  </body></html>`;

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 600);
};

const RED = "#e03820";
const AMBER = "#f07830";
const GRAD = "linear-gradient(135deg," + RED + "," + AMBER + ")";
const SOFT = "#fdf6f2";
const BORDER = "#e8cfc0";

const SORTS = [
  { label: "Newest", fn: (a, b) => new Date(b.updated_at) - new Date(a.updated_at) },
  { label: "Oldest", fn: (a, b) => new Date(a.updated_at) - new Date(b.updated_at) },
  { label: "Name A-Z", fn: (a, b) => (a.visitor_name || "").localeCompare(b.visitor_name || "") },
  { label: "Email A-Z", fn: (a, b) => (a.visitor_email || "").localeCompare(b.visitor_email || "") },
  { label: "Site", fn: (a, b) => (a.site_origin || "").localeCompare(b.site_origin || "") },
];

export default function AdminInbox({ agent, onLogout }) {
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [sortIdx, setSortIdx] = useState(0);
  const [showClosed, setShowClosed] = useState(false);
  const [tab, setTab] = useState("inbox");
  const [priorityResponse, setPriorityResponse] = useState("");
  const [loomUrl, setLoomUrl] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("conversations").select("*").order("updated_at", { ascending: false });
      if (data) setConversations(data);
    };
    load();
    const channel = supabase.channel("convos").on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => load()).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    if (!active) return;
    const load = async () => {
      const { data } = await supabase.from("messages").select("*").eq("conversation_id", active.id).order("created_at", { ascending: true });
      if (data) setMessages(data);
    };
    load();
    const channel = supabase.channel("msgs-" + active.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "conversation_id=eq." + active.id }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
      }).subscribe();
    return () => supabase.removeChannel(channel);
  }, [active]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendReply = async () => {
    if (!reply.trim() || !active) return;
    setSending(true);
    await supabase.from("messages").insert({ conversation_id: active.id, sender: "agent", sender_name: agent.email, body: reply.trim() });
    await supabase.from("conversations").update({ updated_at: new Date().toISOString(), last_sender: "agent" }).eq("id", active.id);
    setReply("");
    setSending(false);
  };

  const closeConvo = async (id) => {
    await supabase.from("conversations").update({ status: "closed", last_sender: "agent" }).eq("id", id);
    if (active?.id === id) setActive(null);
  };

  const reopenConvo = async (id) => {
    await supabase.from("conversations").update({ status: "open" }).eq("id", id);
  };

  const deleteConvo = async (id) => {
    if (!confirm("Delete this conversation and all its messages? This cannot be undone.")) return;
    await supabase.from("messages").delete().eq("conversation_id", id);
    await supabase.from("conversations").delete().eq("id", id);
    if (active?.id === id) setActive(null);
    setConversations(prev => prev.filter(c => c.id !== id));
  };

  const siteTag = (origin) => {
    if (!origin) return "Unknown";
    try { return new URL(origin).hostname.replace("www.", ""); } catch { return origin; }
  };

  const timeAgo = (ts) => {
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return m + "m ago";
    const h = Math.floor(m / 60);
    if (h < 24) return h + "h ago";
    return Math.floor(h / 24) + "d ago";
  };

  const consentLabel = (c) => {
    if (c.content_consent === null || c.content_consent === undefined) return null;
    if (!c.content_consent) return null;
    if (c.wants_credit) return { text: "OK to use · wants credit", color: AMBER };
    return { text: "OK to use · anonymous", color: "#7ab87a" };
  };

  const filtered = conversations
    .filter(c => {
      const q = search.toLowerCase();
      return !q || (c.visitor_name || "").toLowerCase().includes(q) || (c.visitor_email || "").toLowerCase().includes(q) || (c.site_origin || "").toLowerCase().includes(q);
    })
    .sort(SORTS[sortIdx].fn);

  const freeConvos = filtered.filter(c => c.type !== "priority");
  const priorityConvos = filtered.filter(c => c.type === "priority");
  const unanswered = freeConvos.filter(c => c.status === "open" && c.last_sender === "visitor");
  const answered = freeConvos.filter(c => c.status === "open" && c.last_sender !== "visitor");
  const closed = freeConvos.filter(c => c.status === "closed");
  const priorityOpen = priorityConvos.filter(c => c.status === "open");
  const priorityClosed = priorityConvos.filter(c => c.status === "closed");

  const SectionLabel = ({ label, count, color }) => (
    <div style={{ padding: "10px 14px 6px", fontSize: 10, color: color || AMBER, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
      {label} <span style={{ background: color || AMBER, color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{count}</span>
    </div>
  );

  const ConvoCard = ({ c, dimmed }) => {
    const consent = consentLabel(c);
    const needsReply = c.last_sender === "visitor" && c.status === "open";
    return (
      <div onClick={() => setActive(c)} style={{ padding: "12px 14px", borderBottom: "1px solid " + BORDER, cursor: "pointer", background: active?.id === c.id ? "#fff5f0" : "transparent", borderLeft: active?.id === c.id ? "3px solid " + RED : needsReply ? "3px solid " + RED : "3px solid transparent", transition: "all 0.15s", opacity: dimmed ? 0.6 : 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: needsReply ? 700 : 600, color: dimmed ? "#a07060" : "#2a1a10" }}>{c.visitor_name || "Visitor"}</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#b09080" }}>{timeAgo(c.updated_at)}</span>
            <span onClick={e => { e.stopPropagation(); deleteConvo(c.id); }} style={{ fontSize: 14, color: "#c0a090", cursor: "pointer", lineHeight: 1, padding: "0 2px" }} title="Delete">×</span>
          </div>
        </div>
        <div style={{ fontSize: 11, color: AMBER, fontWeight: 600, marginBottom: 2 }}>{siteTag(c.site_origin)}</div>
        {c.visitor_email && <div style={{ fontSize: 11, color: "#a07060" }}>{c.visitor_email}</div>}
        {needsReply && <div style={{ fontSize: 10, color: RED, marginTop: 3, fontWeight: 700 }}>● Needs reply</div>}
        {consent && <div style={{ fontSize: 10, color: consent.color, marginTop: 3, fontStyle: "italic" }}>{consent.text}</div>}
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: SOFT, fontFamily: "'DM Sans',sans-serif", display: "flex", flexDirection: "column" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />

      <div style={{ background: GRAD, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 12px rgba(224,56,32,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/AskKari-white.png" alt="Ask Kari" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "contain", background: "rgba(255,255,255,0.15)" }} />
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: "#fff" }}>Ask Kari — Inbox</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>{agent.email}</span>
          <button onClick={onLogout} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Log out</button>
        </div>
      </div>

      <div style={{ background: GRAD, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 12px rgba(224,56,32,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/AskKari-white.png" alt="Ask Kari" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "contain", background: "rgba(255,255,255,0.15)" }} />
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: "#fff" }}>Ask Kari — Inbox</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", gap: 4, background: "rgba(0,0,0,0.15)", borderRadius: 10, padding: 4 }}>
            <button onClick={() => { setTab("inbox"); setActive(null); }} style={{ padding: "6px 16px", borderRadius: 7, border: "none", background: tab === "inbox" ? "#fff" : "transparent", color: tab === "inbox" ? RED : "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s" }}>Inbox</button>
            <button onClick={() => { setTab("priority"); setActive(null); setPriorityResponse(""); setLoomUrl(""); }} style={{ padding: "6px 16px", borderRadius: 7, border: "none", background: tab === "priority" ? "#fff" : "transparent", color: tab === "priority" ? "#C9A84C" : "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 5 }}>
              ⭐ Priority {priorityOpen.length > 0 && <span style={{ background: "#C9A84C", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10 }}>{priorityOpen.length}</span>}
            </button>
          </div>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>{agent.email}</span>
          <button onClick={onLogout} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Log out</button>
        </div>
      </div>

      {tab === "priority" ? (
        <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "calc(100vh - 57px)" }}>
          <div style={{ width: 300, background: "#fff", borderRight: "1.5px solid " + BORDER, display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={{ padding: "12px 14px 8px", borderBottom: "1px solid " + BORDER }}>
              <div style={{ fontSize: 10, color: "#C9A84C", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Priority Queue</div>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {priorityOpen.length === 0 && <div style={{ padding: "16px 14px", fontSize: 12, color: "#b09080" }}>No open priority asks</div>}
              {priorityOpen.map(c => (
                <div key={c.id} onClick={() => { setActive(c); setPriorityResponse(c.agent_response || ""); setLoomUrl(c.loom_url || ""); }}
                  style={{ padding: "12px 14px", borderBottom: "1px solid " + BORDER, cursor: "pointer", background: active?.id === c.id ? "#fff8f0" : "transparent", borderLeft: active?.id === c.id ? "3px solid #C9A84C" : "3px solid transparent" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#2a1a10" }}>{c.visitor_name || "Visitor"}</span>
                    <span style={{ fontSize: 10, color: "#b09080" }}>{timeAgo(c.updated_at)}</span>
                  </div>
                  {c.visitor_email && <div style={{ fontSize: 11, color: "#a07060" }}>{c.visitor_email}</div>}
                  <div style={{ fontSize: 10, color: "#C9A84C", fontWeight: 700, marginTop: 3 }}>⭐ Priority · $26 paid</div>
                </div>
              ))}
              {priorityClosed.length > 0 && (
                <>
                  <div style={{ padding: "10px 14px 6px", fontSize: 10, color: "#b09080", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, borderTop: "1px solid " + BORDER, marginTop: 8 }}>Completed ({priorityClosed.length})</div>
                  {priorityClosed.map(c => (
                    <div key={c.id} onClick={() => { setActive(c); setPriorityResponse(c.agent_response || ""); setLoomUrl(c.loom_url || ""); }}
                      style={{ padding: "12px 14px", borderBottom: "1px solid " + BORDER, cursor: "pointer", opacity: 0.6, background: active?.id === c.id ? "#fff8f0" : "transparent" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#2a1a10" }}>{c.visitor_name || "Visitor"}</div>
                      {c.visitor_email && <div style={{ fontSize: 11, color: "#a07060" }}>{c.visitor_email}</div>}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {!active ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#b09080", fontSize: 15 }}>Select a priority ask to respond</div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "16px 24px", borderBottom: "1.5px solid " + BORDER, background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 600, color: "#2a1a10" }}>{active.visitor_name || "Visitor"}</span>
                    <span style={{ fontSize: 11, background: "#fff8e0", border: "1px solid #e0c060", borderRadius: 6, padding: "2px 8px", color: "#C9A84C", fontWeight: 700 }}>⭐ Priority</span>
                  </div>
                  {active.visitor_email && <div style={{ fontSize: 12, color: "#a07060", marginTop: 2 }}>{active.visitor_email}</div>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {active.status === "open" && <button onClick={() => closeConvo(active.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid " + BORDER, background: "transparent", color: "#a07060", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Mark Complete</button>}
                  {active.status === "closed" && <button onClick={() => reopenConvo(active.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid " + BORDER, background: "transparent", color: AMBER, fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Reopen</button>}
                  <button onClick={() => deleteConvo(active.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid #f0c0b0", background: "transparent", color: RED, fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Delete</button>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", background: SOFT }}>
                <div style={{ background: "#fff", border: "1.5px solid #e8cfc0", borderRadius: 14, padding: "16px 20px", marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: "#C9A84C", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Their Question</div>
                  <div style={{ fontSize: 14, color: "#2a1a10", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                    {messages.filter(m => m.sender === "visitor").map(m => m.body).join("\n\n") || "Loading..."}
                  </div>
                  {active.attachment_url && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid " + BORDER }}>
                      <a href={active.attachment_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: RED, textDecoration: "none", fontWeight: 600 }}>📎 View Attachment →</a>
                    </div>
                  )}
                </div>

                {active.status === "open" && (
                  <div style={{ background: "#fff", border: "1.5px solid #e8cfc0", borderRadius: 14, padding: "16px 20px" }}>
                    <div style={{ fontSize: 11, color: "#a07060", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Your Response</div>

                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: "block", fontSize: 11, color: "#a07060", marginBottom: 6 }}>LOOM / VIDEO LINK (optional)</label>
                      <input
                        value={loomUrl}
                        onChange={e => setLoomUrl(e.target.value)}
                        placeholder="https://loom.com/share/..."
                        style={{ width: "100%", padding: "10px 14px", background: SOFT, border: "1.5px solid " + BORDER, borderRadius: 8, color: "#2a1a10", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" }}
                      />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", fontSize: 11, color: "#a07060", marginBottom: 6 }}>WRITTEN RESPONSE</label>
                      <textarea
                        value={priorityResponse}
                        onChange={e => setPriorityResponse(e.target.value)}
                        placeholder="Type your thorough, tailored response here. This is the good stuff."
                        rows={8}
                        style={{ width: "100%", padding: "12px 14px", background: SOFT, border: "1.5px solid " + BORDER, borderRadius: 8, color: "#2a1a10", fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box" }}
                      />
                    </div>

                    <button
                      onClick={async () => {
                        if (!priorityResponse.trim() && !loomUrl.trim()) return;
                        await supabase.from("conversations").update({ agent_response: priorityResponse, loom_url: loomUrl, updated_at: new Date().toISOString() }).eq("id", active.id);
                        var subject = encodeURIComponent("Your Priority Ask Kari Response");
                        var body = encodeURIComponent(
                          "Hi " + (active.visitor_name || "there") + ",\n\nThank you for your Priority Ask. Here's my response:\n\n" +
                          (loomUrl ? "VIDEO RESPONSE: " + loomUrl + "\n\n" : "") +
                          (priorityResponse ? priorityResponse + "\n\n" : "") +
                          "You have one follow-up exchange included. Just reply to this email.\n\n" +
                          "Now go sparkle. That's an order.\n\nKari\nkari@karikounkel.com\n651-334-1300"
                        );
                        window.open("mailto:" + active.visitor_email + "?subject=" + subject + "&body=" + body);
                      }}
                      disabled={!priorityResponse.trim() && !loomUrl.trim()}
                      style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg,#C9A84C,#e0c060)", border: "none", borderRadius: 10, color: "#2a1a10", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", opacity: (!priorityResponse.trim() && !loomUrl.trim()) ? 0.5 : 1 }}
                    >
                      ⭐ Open in Email & Send →
                    </button>
                    <div style={{ fontSize: 11, color: "#b09080", textAlign: "center", marginTop: 8 }}>Opens your email client with everything pre-filled. Hit send, then mark complete.</div>
                  </div>
                )}

                {active.status === "closed" && active.agent_response && (
                  <div style={{ background: "#fff", border: "1.5px solid #e8cfc0", borderRadius: 14, padding: "16px 20px" }}>
                    <div style={{ fontSize: 11, color: "#7ab87a", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>✓ Response Sent</div>
                    {active.loom_url && <div style={{ fontSize: 13, color: RED, marginBottom: 8 }}>🎥 <a href={active.loom_url} target="_blank" rel="noreferrer" style={{ color: RED }}>Loom Link</a></div>}
                    <div style={{ fontSize: 14, color: "#2a1a10", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{active.agent_response}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "calc(100vh - 57px)" }}>
        <div style={{ width: 300, background: "#fff", borderRight: "1.5px solid " + BORDER, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid " + BORDER, display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, site..."
              style={{ width: "100%", padding: "8px 12px", background: SOFT, border: "1.5px solid " + BORDER, borderRadius: 8, color: "#2a1a10", fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#b09080", flexShrink: 0 }}>Sort:</span>
              <select value={sortIdx} onChange={e => setSortIdx(Number(e.target.value))} style={{ flex: 1, padding: "5px 8px", background: SOFT, border: "1.5px solid " + BORDER, borderRadius: 6, color: "#2a1a10", fontSize: 11, fontFamily: "'DM Sans',sans-serif", outline: "none", cursor: "pointer" }}>
                {SORTS.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {unanswered.length > 0 && (
              <>
                <SectionLabel label="Needs Reply" count={unanswered.length} color={RED} />
                {unanswered.map(c => <ConvoCard key={c.id} c={c} dimmed={false} />)}
              </>
            )}

            {answered.length > 0 && (
              <>
                <SectionLabel label="Open" count={answered.length} color={AMBER} />
                {answered.map(c => <ConvoCard key={c.id} c={c} dimmed={false} />)}
              </>
            )}

            {unanswered.length === 0 && answered.length === 0 && (
              <div style={{ padding: "16px 14px", fontSize: 12, color: "#b09080" }}>No open conversations</div>
            )}

            <div
              onClick={() => setShowClosed(p => !p)}
              style={{ padding: "10px 14px 6px", fontSize: 10, color: "#b09080", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginTop: 8, borderTop: "1px solid " + BORDER }}
            >
              Closed ({closed.length}) <span style={{ fontSize: 10 }}>{showClosed ? "▲" : "▼"}</span>
            </div>
            {showClosed && closed.map(c => <ConvoCard key={c.id} c={c} dimmed={true} />)}
          </div>
        </div>

        {!active ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#b09080", fontSize: 15 }}>Select a conversation to start</div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "14px 24px", borderBottom: "1.5px solid " + BORDER, background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#2a1a10" }}>{active.visitor_name || "Visitor"}</div>
                <div style={{ fontSize: 12, color: "#a07060", marginTop: 2 }}>{siteTag(active.site_origin)}{active.visitor_email ? " · " + active.visitor_email : ""}</div>
                {consentLabel(active) && <div style={{ fontSize: 11, color: consentLabel(active).color, marginTop: 3, fontStyle: "italic" }}>{consentLabel(active).text}</div>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => printTranscript(active, messages, siteTag, timeAgo)} style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid #c8e6c8", background: "transparent", color: "#5a9a5a", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>⬇ Save PDF</button>
                {active.status === "open" && <button onClick={() => closeConvo(active.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid " + BORDER, background: "transparent", color: "#a07060", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Close</button>}
                {active.status === "closed" && <button onClick={() => reopenConvo(active.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid " + BORDER, background: "transparent", color: AMBER, fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Reopen</button>}
                <button onClick={() => deleteConvo(active.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid #f0c0b0", background: "transparent", color: RED, fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Delete</button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12, background: SOFT }}>
              {messages.map(m => (
                <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: m.sender === "agent" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "70%", padding: "10px 16px", borderRadius: m.sender === "agent" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: m.sender === "agent" ? GRAD : "#fff", color: m.sender === "agent" ? "#fff" : "#2a1a10", fontSize: 14, lineHeight: 1.5, fontWeight: m.sender === "agent" ? 500 : 400, border: m.sender === "agent" ? "none" : "1.5px solid " + BORDER }}>
                    {m.body}
                  </div>
                  <div style={{ fontSize: 11, color: "#b09080", marginTop: 4, paddingLeft: 4, paddingRight: 4 }}>
                    {m.sender === "agent" ? "You" : (active.visitor_name || "Visitor")} · {timeAgo(m.created_at)}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {active.status === "open" && (
              <div style={{ padding: "16px 24px", borderTop: "1.5px solid " + BORDER, background: "#fff", display: "flex", gap: 12 }}>
                <textarea value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }} placeholder="Type a reply... (Enter to send, Shift+Enter for new line)" rows={2} style={{ flex: 1, padding: "12px 16px", background: SOFT, border: "1.5px solid " + BORDER, borderRadius: 10, color: "#2a1a10", fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none", resize: "none", lineHeight: 1.5 }} />
                <button onClick={sendReply} disabled={sending || !reply.trim()} style={{ padding: "0 24px", borderRadius: 10, border: "none", background: GRAD, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", opacity: sending || !reply.trim() ? 0.5 : 1 }}>Send</button>
              </div>
            )}
            {active.status === "closed" && (
              <div style={{ padding: "16px 24px", borderTop: "1.5px solid " + BORDER, background: "#fff", textAlign: "center", color: "#b09080", fontSize: 13 }}>
                Closed. <span onClick={() => reopenConvo(active.id)} style={{ color: AMBER, cursor: "pointer", fontWeight: 600 }}>Reopen?</span>
              </div>
            )}
          </div>
        )}
        </div>
      )}
    </div>
  );
}
