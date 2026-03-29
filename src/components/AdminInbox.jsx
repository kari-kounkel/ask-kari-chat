import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";

export default function AdminInbox({ agent, onLogout }) {
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  // Load conversations
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("conversations").select("*").order("updated_at", { ascending: false });
      if (data) setConversations(data);
    };
    load();
    const channel = supabase.channel("convos").on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => load()).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // Load messages for active conversation
  useEffect(() => {
    if (!active) return;
    const load = async () => {
      const { data } = await supabase.from("messages").select("*").eq("conversation_id", active.id).order("created_at", { ascending: true });
      if (data) setMessages(data);
    };
    load();
    const channel = supabase.channel("msgs-" + active.id).on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "conversation_id=eq." + active.id }, (payload) => {
      setMessages(prev => [...prev, payload.new]);
    }).subscribe();
    return () => supabase.removeChannel(channel);
  }, [active]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendReply = async () => {
    if (!reply.trim() || !active) return;
    setSending(true);
    await supabase.from("messages").insert({ conversation_id: active.id, sender: "agent", sender_name: agent.email, body: reply.trim() });
    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", active.id);
    setReply("");
    setSending(false);
  };

  const closeConvo = async (id) => {
    await supabase.from("conversations").update({ status: "closed" }).eq("id", id);
    if (active?.id === id) setActive(null);
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

  const open = conversations.filter(c => c.status === "open");
  const closed = conversations.filter(c => c.status === "closed");

  return (
    <div style={{ minHeight: "100vh", background: "#0f1923", fontFamily: "'DM Sans',sans-serif", display: "flex", flexDirection: "column" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: "#1a2535", borderBottom: "1px solid #2a3a50", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: "#C9A84C" }}>Ask Kari — Inbox</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 12, color: "#7a8fa8" }}>{agent.email}</span>
          <button onClick={onLogout} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #2a3a50", background: "transparent", color: "#7a8fa8", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Log out</button>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "calc(100vh - 57px)" }}>

        {/* Sidebar */}
        <div style={{ width: 300, background: "#141f2e", borderRight: "1px solid #2a3a50", overflowY: "auto", flexShrink: 0 }}>
          <div style={{ padding: "16px 16px 8px", fontSize: 11, color: "#7a8fa8", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>
            Open ({open.length})
          </div>
          {open.length === 0 && <div style={{ padding: "12px 16px", fontSize: 13, color: "#4a5a6a" }}>No open conversations</div>}
          {open.map(c => (
            <div key={c.id} onClick={() => setActive(c)} style={{ padding: "14px 16px", borderBottom: "1px solid #1e2d3e", cursor: "pointer", background: active?.id === c.id ? "#1e3050" : "transparent", borderLeft: active?.id === c.id ? "3px solid #C9A84C" : "3px solid transparent", transition: "all 0.15s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#f0e6d0" }}>{c.visitor_name || "Visitor"}</span>
                <span style={{ fontSize: 11, color: "#4a5a6a" }}>{timeAgo(c.updated_at)}</span>
              </div>
              <div style={{ fontSize: 11, color: "#C9A84C", marginBottom: 2 }}>{siteTag(c.site_origin)}</div>
              {c.visitor_email && <div style={{ fontSize: 11, color: "#7a8fa8" }}>{c.visitor_email}</div>}
            </div>
          ))}

          {closed.length > 0 && (
            <>
              <div style={{ padding: "16px 16px 8px", fontSize: 11, color: "#4a5a6a", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginTop: 8 }}>
                Closed ({closed.length})
              </div>
              {closed.map(c => (
                <div key={c.id} onClick={() => setActive(c)} style={{ padding: "14px 16px", borderBottom: "1px solid #1a2535", cursor: "pointer", background: active?.id === c.id ? "#1a2535" : "transparent", opacity: 0.6, borderLeft: active?.id === c.id ? "3px solid #4a5a6a" : "3px solid transparent" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: "#7a8fa8" }}>{c.visitor_name || "Visitor"}</span>
                    <span style={{ fontSize: 11, color: "#4a5a6a" }}>{timeAgo(c.updated_at)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#4a5a6a" }}>{siteTag(c.site_origin)}</div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Main panel */}
        {!active ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#4a5a6a", fontSize: 15 }}>
            Select a conversation to start
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* Convo header */}
            <div style={{ padding: "14px 24px", borderBottom: "1px solid #2a3a50", background: "#1a2535", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#f0e6d0" }}>{active.visitor_name || "Visitor"}</div>
                <div style={{ fontSize: 12, color: "#7a8fa8", marginTop: 2 }}>
                  {siteTag(active.site_origin)}{active.visitor_email ? " · " + active.visitor_email : ""}
                </div>
              </div>
              {active.status === "open" && (
                <button onClick={() => closeConvo(active.id)} style={{ padding: "6px 16px", borderRadius: 8, border: "1px solid #2a3a50", background: "transparent", color: "#7a8fa8", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                  Close conversation
                </button>
              )}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
              {messages.map(m => (
                <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: m.sender === "agent" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "70%", padding: "10px 16px", borderRadius: m.sender === "agent" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: m.sender === "agent" ? "linear-gradient(135deg,#C9A84C,#a07830)" : "#1e2d3e", color: m.sender === "agent" ? "#0f1923" : "#f0e6d0", fontSize: 14, lineHeight: 1.5, fontWeight: m.sender === "agent" ? 500 : 400 }}>
                    {m.body}
                  </div>
                  <div style={{ fontSize: 11, color: "#4a5a6a", marginTop: 4, paddingLeft: 4, paddingRight: 4 }}>
                    {m.sender === "agent" ? "You" : (active.visitor_name || "Visitor")} · {timeAgo(m.created_at)}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Reply box */}
            {active.status === "open" && (
              <div style={{ padding: "16px 24px", borderTop: "1px solid #2a3a50", background: "#141f2e", display: "flex", gap: 12 }}>
                <textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                  placeholder="Type a reply... (Enter to send, Shift+Enter for new line)"
                  rows={2}
                  style={{ flex: 1, padding: "12px 16px", background: "#1a2535", border: "1px solid #2a3a50", borderRadius: 10, color: "#f0e6d0", fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none", resize: "none", lineHeight: 1.5 }}
                />
                <button onClick={sendReply} disabled={sending || !reply.trim()} style={{ padding: "0 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#C9A84C,#a07830)", color: "#0f1923", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", opacity: sending || !reply.trim() ? 0.5 : 1 }}>
                  Send
                </button>
              </div>
            )}
            {active.status === "closed" && (
              <div style={{ padding: "16px 24px", borderTop: "1px solid #2a3a50", background: "#141f2e", textAlign: "center", color: "#4a5a6a", fontSize: 13 }}>
                This conversation is closed.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
