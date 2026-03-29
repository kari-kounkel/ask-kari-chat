(function () {
  const SUPABASE_URL = "https://rhbmuxvbmmlbkjegwtgr.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoYm11eHZibW1sYmtqZWd3dGdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NDY0NjYsImV4cCI6MjA5MDMyMjQ2Nn0.D1qyXKPcDypXFTLdxk2fARkNPQKTiwJeTTX--ifc8UM";

  const headers = { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY };

  let conversationId = sessionStorage.getItem("ask_kari_convo_id") || null;
  let pollTimer = null;
  let lastMessageCount = 0;

  // Inject styles
  const style = document.createElement("style");
  style.textContent = [
    "@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');",
    "#ask-kari-bubble{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#C9A84C,#a07830);border:none;cursor:pointer;box-shadow:0 4px 20px rgba(201,168,76,0.4);z-index:99999;display:flex;align-items:center;justify-content:center;font-size:24px;transition:transform 0.2s;}",
    "#ask-kari-bubble:hover{transform:scale(1.1);}",
    "#ask-kari-panel{position:fixed;bottom:90px;right:24px;width:340px;height:480px;background:#141f2e;border:1px solid #2a3a50;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.5);z-index:99998;display:none;flex-direction:column;font-family:'DM Sans',sans-serif;overflow:hidden;}",
    "#ask-kari-panel.open{display:flex;}",
    "#ak-header{background:#1a2535;padding:16px 18px;border-bottom:1px solid #2a3a50;display:flex;align-items:center;justify-content:space-between;}",
    "#ak-title{font-size:16px;font-weight:700;color:#C9A84C;}",
    "#ak-subtitle{font-size:11px;color:#7a8fa8;margin-top:2px;}",
    "#ak-close{background:none;border:none;color:#7a8fa8;font-size:20px;cursor:pointer;padding:0;line-height:1;}",
    "#ak-intro{padding:16px 18px;display:flex;flex-direction:column;gap:10px;}",
    "#ak-intro input{padding:10px 14px;background:#1a2535;border:1px solid #2a3a50;border-radius:8px;color:#f0e6d0;font-size:13px;font-family:'DM Sans',sans-serif;outline:none;}",
    "#ak-start-btn{padding:10px;background:linear-gradient(135deg,#C9A84C,#a07830);border:none;border-radius:8px;color:#0f1923;font-size:13px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;}",
    "#ak-messages{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px;}",
    ".ak-msg{max-width:80%;padding:9px 13px;border-radius:12px;font-size:13px;line-height:1.5;}",
    ".ak-msg.visitor{align-self:flex-end;background:linear-gradient(135deg,#C9A84C,#a07830);color:#0f1923;border-radius:12px 12px 4px 12px;font-weight:500;}",
    ".ak-msg.agent{align-self:flex-start;background:#1e2d3e;color:#f0e6d0;border-radius:12px 12px 12px 4px;}",
    ".ak-msg-time{font-size:10px;color:#4a5a6a;margin-top:3px;align-self:flex-end;}",
    ".ak-msg-time.agent{align-self:flex-start;}",
    "#ak-footer{padding:12px 14px;border-top:1px solid #2a3a50;background:#1a2535;display:flex;gap:8px;}",
    "#ak-input{flex:1;padding:9px 13px;background:#141f2e;border:1px solid #2a3a50;border-radius:8px;color:#f0e6d0;font-size:13px;font-family:'DM Sans',sans-serif;outline:none;}",
    "#ak-send{padding:0 16px;background:linear-gradient(135deg,#C9A84C,#a07830);border:none;border-radius:8px;color:#0f1923;font-size:13px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;}",
  ].join("");
  document.head.appendChild(style);

  // Build bubble
  const bubble = document.createElement("button");
  bubble.id = "ask-kari-bubble";
  bubble.innerHTML = "💬";
  bubble.title = "Ask Kari";
  document.body.appendChild(bubble);

  // Build panel
  const panel = document.createElement("div");
  panel.id = "ask-kari-panel";
  panel.innerHTML = [
    "<div id='ak-header'>",
    "  <div><div id='ak-title'>Ask Kari</div><div id='ak-subtitle'>Clarity with a side of mischief</div></div>",
    "  <button id='ak-close'>×</button>",
    "</div>",
    "<div id='ak-intro'>",
    "  <input id='ak-name' placeholder='Your name' />",
    "  <input id='ak-email' placeholder='Your email (optional)' type='email' />",
    "  <button id='ak-start-btn'>Start chatting →</button>",
    "</div>",
    "<div id='ak-messages' style='display:none'></div>",
    "<div id='ak-footer' style='display:none'>",
    "  <input id='ak-input' placeholder='Type a message...' />",
    "  <button id='ak-send'>Send</button>",
    "</div>",
  ].join("");
  document.body.appendChild(panel);

  // Toggle
  bubble.addEventListener("click", () => panel.classList.toggle("open"));
  document.getElementById("ak-close").addEventListener("click", () => panel.classList.remove("open"));

  // If returning visitor — restore chat
  if (conversationId) {
    showChat();
    loadMessages();
    startPolling();
  }

  // Start chat
  document.getElementById("ak-start-btn").addEventListener("click", async () => {
    const name = document.getElementById("ak-name").value.trim() || "Visitor";
    const email = document.getElementById("ak-email").value.trim();
    const res = await fetch(SUPABASE_URL + "/rest/v1/conversations", {
      method: "POST",
      headers: { ...headers, "Prefer": "return=representation" },
      body: JSON.stringify({ visitor_id: "v_" + Date.now(), visitor_name: name, visitor_email: email || null, site_origin: window.location.origin, status: "open" }),
    });
    const data = await res.json();
    conversationId = data[0].id;
    sessionStorage.setItem("ask_kari_convo_id", conversationId);
    // Send welcome message from agent side
    await sendSystemMessage("Hey " + name + "! Got your message. I'll get back to you shortly. 👋");
    showChat();
    startPolling();
  });

  // Send message
  document.getElementById("ak-send").addEventListener("click", sendMessage);
  document.getElementById("ak-input").addEventListener("keydown", e => { if (e.key === "Enter") sendMessage(); });

  async function sendMessage() {
    const input = document.getElementById("ak-input");
    const body = input.value.trim();
    if (!body || !conversationId) return;
    input.value = "";
    await fetch(SUPABASE_URL + "/rest/v1/messages", {
      method: "POST",
      headers: { ...headers, "Prefer": "return=minimal" },
      body: JSON.stringify({ conversation_id: conversationId, sender: "visitor", body }),
    });
    await fetch(SUPABASE_URL + "/rest/v1/conversations?id=eq." + conversationId, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ updated_at: new Date().toISOString() }),
    });
    loadMessages();
  }

  async function sendSystemMessage(body) {
    await fetch(SUPABASE_URL + "/rest/v1/messages", {
      method: "POST",
      headers: { ...headers, "Prefer": "return=minimal" },
      body: JSON.stringify({ conversation_id: conversationId, sender: "agent", sender_name: "Kari", body }),
    });
  }

  async function loadMessages() {
    if (!conversationId) return;
    const res = await fetch(SUPABASE_URL + "/rest/v1/messages?conversation_id=eq." + conversationId + "&order=created_at.asc", { headers });
    const msgs = await res.json();
    if (!Array.isArray(msgs)) return;
    if (msgs.length === lastMessageCount) return;
    lastMessageCount = msgs.length;
    const container = document.getElementById("ak-messages");
    container.innerHTML = "";
    msgs.forEach(m => {
      const wrap = document.createElement("div");
      wrap.style.display = "flex";
      wrap.style.flexDirection = "column";
      wrap.style.alignItems = m.sender === "visitor" ? "flex-end" : "flex-start";
      const bubble = document.createElement("div");
      bubble.className = "ak-msg " + m.sender;
      bubble.textContent = m.body;
      const time = document.createElement("div");
      time.className = "ak-msg-time " + m.sender;
      time.textContent = new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      wrap.appendChild(bubble);
      wrap.appendChild(time);
      container.appendChild(wrap);
    });
    container.scrollTop = container.scrollHeight;
  }

  function showChat() {
    document.getElementById("ak-intro").style.display = "none";
    document.getElementById("ak-messages").style.display = "flex";
    document.getElementById("ak-footer").style.display = "flex";
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(loadMessages, 4000);
  }
})();
