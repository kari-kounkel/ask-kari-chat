(function () {
  const SUPABASE_URL = "https://rhbmuxvbmmlbkjegwtgr.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoYm11eHZibW1sYmtqZWd3dGdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NDY0NjYsImV4cCI6MjA5MDMyMjQ2Nn0.D1qyXKPcDypXFTLdxk2fARkNPQKTiwJeTTX--ifc8UM";
  const headers = { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY };

  let conversationId = sessionStorage.getItem("ask_kari_convo_id") || null;
  let pollTimer = null;
  let lastMessageCount = 0;

  const style = document.createElement("style");
  style.textContent = "@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');"
    + "#ak-bubble{position:fixed;bottom:24px;right:24px;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#e83a1f,#f07030);border:none;cursor:pointer;box-shadow:0 4px 24px rgba(232,58,31,0.45);z-index:99999;display:flex;align-items:center;justify-content:center;font-size:26px;transition:transform 0.2s,box-shadow 0.2s;}"
    + "#ak-bubble:hover{transform:scale(1.1);box-shadow:0 6px 28px rgba(232,58,31,0.6);}"
    + "#ak-panel{position:fixed;bottom:94px;right:24px;width:350px;max-height:520px;background:#fff;border:1.5px solid #f0d0c0;border-radius:20px;box-shadow:0 8px 40px rgba(232,58,31,0.15);z-index:99998;display:none;flex-direction:column;font-family:'DM Sans',sans-serif;overflow:hidden;}"
    + "#ak-panel.open{display:flex;}"
    + "#ak-header{background:linear-gradient(135deg,#e83a1f,#f07030);padding:18px 20px;display:flex;align-items:center;justify-content:space-between;}"
    + "#ak-title{font-size:18px;font-weight:700;color:#fff;letter-spacing:-0.3px;}"
    + "#ak-subtitle{font-size:11px;color:rgba(255,255,255,0.85);margin-top:2px;font-style:italic;}"
    + "#ak-close{background:none;border:none;color:rgba(255,255,255,0.8);font-size:22px;cursor:pointer;padding:0;line-height:1;}"
    + "#ak-intro{padding:20px;display:flex;flex-direction:column;gap:10px;background:#fff;}"
    + "#ak-intro-heading{font-size:14px;font-weight:600;color:#2a1a10;margin-bottom:2px;}"
    + "#ak-intro-sub{font-size:12px;color:#a07060;margin-bottom:4px;}"
    + ".ak-row{display:flex;gap:8px;}"
    + ".ak-row input{flex:1;}"
    + "#ak-intro input{padding:10px 13px;background:#fdf8f5;border:1.5px solid #f0d0c0;border-radius:10px;color:#2a1a10;font-size:13px;font-family:'DM Sans',sans-serif;outline:none;}"
    + "#ak-intro input::placeholder{color:#c0a090;}"
    + "#ak-start-btn{padding:11px;background:linear-gradient(135deg,#e83a1f,#f07030);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;}"
    + "#ak-email-error{font-size:11px;color:#e83a1f;display:none;}"
    + "#ak-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#fdf8f5;}"
    + ".ak-wrap{display:flex;flex-direction:column;}"
    + ".ak-wrap.visitor{align-items:flex-end;}"
    + ".ak-wrap.agent{align-items:flex-start;}"
    + ".ak-msg{max-width:78%;padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.5;}"
    + ".ak-msg.visitor{background:linear-gradient(135deg,#e83a1f,#f07030);color:#fff;border-radius:14px 14px 4px 14px;font-weight:500;}"
    + ".ak-msg.agent{background:#fff;color:#2a1a10;border-radius:14px 14px 14px 4px;border:1.5px solid #f0d0c0;}"
    + ".ak-time{font-size:10px;color:#c0a090;margin-top:3px;padding:0 2px;}"
    + "#ak-footer{padding:12px 14px;border-top:1.5px solid #f0d0c0;background:#fff;display:flex;gap:8px;}"
    + "#ak-input{flex:1;padding:10px 13px;background:#fdf8f5;border:1.5px solid #f0d0c0;border-radius:10px;color:#2a1a10;font-size:13px;font-family:'DM Sans',sans-serif;outline:none;}"
    + "#ak-input::placeholder{color:#c0a090;}"
    + "#ak-send{padding:0 18px;background:linear-gradient(135deg,#e83a1f,#f07030);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;}";
  document.head.appendChild(style);

  const bubble = document.createElement("button");
  bubble.id = "ak-bubble";
  bubble.innerHTML = "💬";
  bubble.title = "Ask Kari";
  document.body.appendChild(bubble);

  const panel = document.createElement("div");
  panel.id = "ak-panel";
  panel.innerHTML = "<div id='ak-header'><div><div id='ak-title'>Ask Kari</div><div id='ak-subtitle'>Clarity with a side of mischief</div></div><button id='ak-close'>×</button></div>"
    + "<div id='ak-intro'><div id='ak-intro-heading'>Hey! Let's talk.</div><div id='ak-intro-sub'>I actually read these. Drop your info and your question.</div>"
    + "<div class='ak-row'><input id='ak-first' placeholder='First name' /><input id='ak-last' placeholder='Last name' /></div>"
    + "<input id='ak-email' placeholder='Email address (required)' type='email' />"
    + "<div id='ak-email-error'>Email is required — I need a way to reach you back.</div>"
    + "<button id='ak-start-btn'>Start chatting →</button></div>"
    + "<div id='ak-messages' style='display:none'></div>"
    + "<div id='ak-footer' style='display:none'><input id='ak-input' placeholder='Type a message...' /><button id='ak-send'>Send</button></div>";
  document.body.appendChild(panel);

  bubble.addEventListener("click", () => panel.classList.toggle("open"));
  document.getElementById("ak-close").addEventListener("click", () => panel.classList.remove("open"));

  if (conversationId) { showChat(); loadMessages(); startPolling(); }

  document.getElementById("ak-start-btn").addEventListener("click", async () => {
    const first = document.getElementById("ak-first").value.trim();
    const last = document.getElementById("ak-last").value.trim();
    const email = document.getElementById("ak-email").value.trim();
    const emailErr = document.getElementById("ak-email-error");
    if (!email) { emailErr.style.display = "block"; document.getElementById("ak-email").focus(); return; }
    emailErr.style.display = "none";
    const name = [first, last].filter(Boolean).join(" ") || "Friend";
    const res = await fetch(SUPABASE_URL + "/rest/v1/conversations", {
      method: "POST",
      headers: { ...headers, "Prefer": "return=representation" },
      body: JSON.stringify({ visitor_id: "v_" + Date.now(), visitor_name: name, visitor_email: email, site_origin: window.location.origin, status: "open" }),
    });
    const data = await res.json();
    conversationId = data[0].id;
    sessionStorage.setItem("ask_kari_convo_id", conversationId);
    await sendSystemMessage("Hey " + (first || name) + "! Got your message — I'll get back to you shortly. \uD83D\uDC4B");
    showChat();
    startPolling();
  });

  document.getElementById("ak-send").addEventListener("click", sendMessage);
  document.getElementById("ak-input").addEventListener("keydown", e => { if (e.key === "Enter") sendMessage(); });

  async function sendMessage() {
    const input = document.getElementById("ak-input");
    const body = input.value.trim();
    if (!body || !conversationId) return;
    input.value = "";
    await fetch(SUPABASE_URL + "/rest/v1/messages", { method: "POST", headers: { ...headers, "Prefer": "return=minimal" }, body: JSON.stringify({ conversation_id: conversationId, sender: "visitor", body }) });
    await fetch(SUPABASE_URL + "/rest/v1/conversations?id=eq." + conversationId, { method: "PATCH", headers, body: JSON.stringify({ updated_at: new Date().toISOString() }) });
    loadMessages();
  }

  async function sendSystemMessage(body) {
    await fetch(SUPABASE_URL + "/rest/v1/messages", { method: "POST", headers: { ...headers, "Prefer": "return=minimal" }, body: JSON.stringify({ conversation_id: conversationId, sender: "agent", sender_name: "Kari", body }) });
  }

  async function loadMessages() {
    if (!conversationId) return;
    const res = await fetch(SUPABASE_URL + "/rest/v1/messages?conversation_id=eq." + conversationId + "&order=created_at.asc", { headers });
    const msgs = await res.json();
    if (!Array.isArray(msgs) || msgs.length === lastMessageCount) return;
    lastMessageCount = msgs.length;
    const container = document.getElementById("ak-messages");
    container.innerHTML = "";
    msgs.forEach(m => {
      const wrap = document.createElement("div");
      wrap.className = "ak-wrap " + m.sender;
      const bub = document.createElement("div");
      bub.className = "ak-msg " + m.sender;
      bub.textContent = m.body;
      const time = document.createElement("div");
      time.className = "ak-time";
      time.textContent = new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      wrap.appendChild(bub);
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
