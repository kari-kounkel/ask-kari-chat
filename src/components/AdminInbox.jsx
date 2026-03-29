import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";

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

  const unanswered = filtered.filter(c => c.status === "open" && c.last_sender === "visitor");
  const answered = filtered.filter(c => c.status === "open" && c.last_sender !== "visitor");
  const closed = filtered.filter(c => c.status === "closed");

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
    </div>
  );
}
