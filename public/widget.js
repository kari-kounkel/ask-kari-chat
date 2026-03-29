(function () {
  const SUPABASE_URL = "https://rhbmuxvbmmlbkjegwtgr.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoYm11eHZibW1sYmtqZWd3dGdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NDY0NjYsImV4cCI6MjA5MDMyMjQ2Nn0.D1qyXKPcDypXFTLdxk2fARkNPQKTiwJeTTX--ifc8UM";
  const headers = { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY };
  const LOGO = "https://chat.karikounkel.com/AskKari.png";
  const LOGO_WHITE = "https://chat.karikounkel.com/AskKari-white.png";
  const RED = "#e03820";
  const AMBER = "#f07830";
  const GRAD = "linear-gradient(135deg," + RED + "," + AMBER + ")";
  const SOFT = "#fdf6f2";
  const BORDER = "#e8cfc0";

  let conversationId = localStorage.getItem("ask_kari_convo_id") || null;
  let pollTimer = null;
  let lastMessageCount = 0;

  const style = document.createElement("style");
  style.textContent = "@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');"
    + "#ak-bubble{position:fixed;bottom:24px;right:24px;width:64px;height:64px;border-radius:50%;background:" + SOFT + ";border:2px solid " + BORDER + ";cursor:pointer;box-shadow:0 4px 18px rgba(224,56,32,0.18);z-index:99999;display:flex;align-items:center;justify-content:center;transition:transform 0.2s;overflow:hidden;padding:0;}"
    + "#ak-bubble:hover{transform:scale(1.08);}"
    + "#ak-bubble img{width:54px;height:54px;object-fit:contain;border-radius:50%;}"
    + "#ak-panel{position:fixed;bottom:98px;right:24px;width:350px;max-height:560px;background:#fff;border:1.5px solid " + BORDER + ";border-radius:20px;box-shadow:0 8px 36px rgba(224,56,32,0.12);z-index:99998;display:none;flex-direction:column;font-family:'DM Sans',sans-serif;overflow:hidden;}"
    + "#ak-panel.open{display:flex;}"
    + "#ak-header{background:" + GRAD + ";padding:16px 20px;display:flex;align-items:center;gap:12px;}"
    + "#ak-header img{width:36px;height:36px;object-fit:contain;border-radius:50%;background:rgba(255,255,255,0.15);flex-shrink:0;}"
    + "#ak-header-text{flex:1;}"
    + "#ak-title{font-size:17px;font-weight:700;color:#fff;}"
    + "#ak-subtitle{font-size:11px;color:rgba(255,255,255,0.85);margin-top:1px;font-style:italic;}"
    + "#ak-close{background:none;border:none;color:rgba(255,255,255,0.75);font-size:22px;cursor:pointer;padding:0;line-height:1;flex-shrink:0;}"
    + "#ak-intro{padding:20px;display:flex;flex-direction:column;gap:10px;background:#fff;overflow-y:auto;}"
    + "#ak-intro-heading{font-size:14px;font-weight:600;color:#2a1a10;}"
    + "#ak-intro-sub{font-size:12px;color:#a07060;margin-top:-4px;}"
    + ".ak-row{display:flex;gap:8px;}"
    + ".ak-row input{flex:1;min-width:0;}"
    + "#ak-intro input{width:100%;padding:10px 13px;background:" + SOFT + ";border:1.5px solid " + BORDER + ";border-radius:10px;color:#2a1a10;font-size:13px;font-family:'DM Sans',sans-serif;outline:none;box-sizing:border-box;}"
    + "#ak-intro input::placeholder{color:#c0a090;}"
    + "#ak-consent-box{background:" + SOFT + ";border:1.5px solid " + BORDER + ";border-radius:10px;padding:12px 14px;font-size:12px;color:#6a4030;line-height:1.6;}"
    + "#ak-consent-box strong{display:block;margin-bottom:8px;font-size:12px;color:#2a1a10;}"
    + ".ak-check-row{display:flex;flex-direction:column;gap:6px;}"
    + ".ak-check-row label{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#2a1a10;}"
    + ".ak-check-row input[type=checkbox]{accent-color:" + RED + ";width:14px;height:14px;cursor:pointer;}"
    + "#ak-start-btn{padding:12px;background:" + GRAD + ";border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;margin-top:4px;}"
    + "#ak-email-error{font-size:11px;color:" + RED + ";display:none;}"
    + "#ak-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:" + SOFT + ";}"
    + ".ak-wrap{display:flex;flex-direction:column;}"
    + ".ak-wrap.visitor{align-items:flex-end;}"
    + ".ak-wrap.agent{align-items:flex-start;}"
    + ".ak-msg{max-width:78%;padding:10px 14px;font-size:13px;line-height:1.5;border-radius:14px;}"
    + ".ak-msg.visitor{background:" + GRAD + ";color:#fff;border-radius:14px 14px 4px 14px;font-weight:500;}"
    + ".ak-msg.agent{background:#fff;color:#2a1a10;border-radius:14px 14px 14px 4px;border:1.5px solid " + BORDER + ";}"
    + ".ak-time{font-size:10px;color:#b09080;margin-top:3px;padding:0 2px;}"
    + "#ak-footer{padding:12px 14px;border-top:1.5px solid " + BORDER + ";background:#fff;display:flex;gap:8px;}"
    + "#ak-input{flex:1;padding:10px 13px;background:" + SOFT + ";border:1.5px solid " + BORDER + ";border-radius:10px;color:#2a1a10;font-size:13px;font-family:'DM Sans',sans-serif;outline:none;}"
    + "#ak-input::placeholder{color:#c0a090;}"
    + "#ak-send{padding:0 18px;background:" + GRAD + ";border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;}"
    + "#ak-reset{text-align:center;padding:8px;background:#fff;border-top:1px solid " + BORDER + ";font-size:11px;color:#b09080;cursor:pointer;}";
  document.head.appendChild(style);

  const bubble = document.createElement("button");
  bubble.id = "ak-bubble";
  bubble.title = "Ask Kari";
  const bImg = document.createElement("img");
  bImg.src = LOGO;
  bImg.alt = "Ask Kari";
  bubble.appendChild(bImg);
  document.body.appendChild(bubble);

  const panel = document.createElement("div");
  panel.id = "ak-panel";
  panel.innerHTML = "<div id='ak-header'>"
    + "<img src='" + LOGO_WHITE + "' alt='Ask Kari' />"
    + "<div id='ak-header-text'><div id='ak-title'>Ask Kari</div><div id='ak-subtitle'>Clarity with a side of mischief</div></div>"
    + "<button id='ak-close'>x</button></div>"
    + "<div id='ak-intro'>"
    + "<div id='ak-intro-heading'>Hey! Let's talk.</div>"
    + "<div id='ak-intro-sub'>I actually read these. Drop your info and I'll get back to you.</div>"
    + "<div class='ak-row'><input id='ak-first' placeholder='First name' /><input id='ak-last' placeholder='Last name' /></div>"
    + "<input id='ak-email' type='email' placeholder='Email address (required)' />"
    + "<div id='ak-email-error'>Email is required — I need a way to reach you back.</div>"
    + "<div id='ak-consent-box'><strong>One quick thing:</strong>"
    + "Kari may use questions as content, always stripped of identifying info."
    + "<div class='ak-check-row' style='margin-top:8px;'>"
    + "<label><input type='checkbox' id='ak-consent-ok' /> I'm okay with that</label>"
    + "<label><input type='checkbox' id='ak-wants-credit' /> Name me if you feature my question</label>"
    + "</div></div>"
    + "<button id='ak-start-btn'>Start chatting \u2192</button>"
    + "</div>"
    + "<div id='ak-messages' style='display:none'></div>"
    + "<div id='ak-footer' style='display:none'><input id='ak-input' placeholder='Type a message...' /><button id='ak-send'>Send</button></div>"
    + "<div id='ak-reset' style='display:none'>Start a new conversation</div>";
  document.body.appendChild(panel);

  bubble.addEventListener("click", () => panel.classList.toggle("open"));
  document.getElementById("ak-close").addEventListener("click", () => panel.classList.remove("open"));

  if (conversationId) { showChat(); loadMessages(); startPolling(); }

  document.getElementById("ak-start-btn").addEventListener("click", async () => {
    try {
      const first = (document.getElementById("ak-first").value || "").trim();
      const last = (document.getElementById("ak-last").value || "").trim();
      const email = (document.getElementById("ak-email").value || "").trim();
      const emailErr = document.getElementById("ak-email-error");
      if (!email) { emailErr.style.display = "block"; return; }
      emailErr.style.display = "none";
      const name = [first, last].filter(Boolean).join(" ") || "Friend";
      const contentConsent = document.getElementById("ak-consent-ok").checked;
      const wantsCredit = document.getElementById("ak-wants-credit").checked;
      const res = await fetch(SUPABASE_URL + "/rest/v1/conversations", {
        method: "POST",
        headers: { ...headers, "Prefer": "return=representation" },
        body: JSON.stringify({ visitor_id: "v_" + Date.now(), visitor_name: name, visitor_email: email, site_origin: window.location.origin, status: "open", content_consent: contentConsent, wants_credit: wantsCredit }),
      });
      const data = await res.json();
      conversationId = data[0].id;
      localStorage.setItem("ask_kari_convo_id", conversationId);
      await sendSystemMsg("Hey " + (first || name) + "! Got your message \u2014 I'll get back to you shortly. \uD83D\uDC4B");
      showChat();
      startPolling();
    } catch(e) { console.error("Ask Kari start error:", e); }
  });

  document.getElementById("ak-send").addEventListener("click", sendMessage);
  document.getElementById("ak-input").addEventListener("keydown", function(e) { if (e.key === "Enter") sendMessage(); });
  document.getElementById("ak-reset").addEventListener("click", function() {
    if (confirm("Start a new conversation? Your history stays on file.")) {
      localStorage.removeItem("ask_kari_convo_id");
      conversationId = null;
      lastMessageCount = 0;
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      document.getElementById("ak-intro").style.display = "flex";
      document.getElementById("ak-messages").style.display = "none";
      document.getElementById("ak-footer").style.display = "none";
      document.getElementById("ak-reset").style.display = "none";
      document.getElementById("ak-messages").innerHTML = "";
    }
  });

  async function sendMessage() {
    try {
      const input = document.getElementById("ak-input");
      const body = (input.value || "").trim();
      if (!body || !conversationId) return;
      input.value = "";
      await fetch(SUPABASE_URL + "/rest/v1/messages", { method: "POST", headers: { ...headers, "Prefer": "return=minimal" }, body: JSON.stringify({ conversation_id: conversationId, sender: "visitor", body: body }) });
      await fetch(SUPABASE_URL + "/rest/v1/conversations?id=eq." + conversationId, { method: "PATCH", headers, body: JSON.stringify({ updated_at: new Date().toISOString() }) });
      loadMessages();
    } catch(e) { console.error("Ask Kari send error:", e); }
  }

  async function sendSystemMsg(body) {
    try {
      await fetch(SUPABASE_URL + "/rest/v1/messages", { method: "POST", headers: { ...headers, "Prefer": "return=minimal" }, body: JSON.stringify({ conversation_id: conversationId, sender: "agent", sender_name: "Kari", body: body }) });
    } catch(e) { console.error("Ask Kari system msg error:", e); }
  }

  async function loadMessages() {
    try {
      if (!conversationId) return;
      const res = await fetch(SUPABASE_URL + "/rest/v1/messages?conversation_id=eq." + conversationId + "&order=created_at.asc", { headers });
      const msgs = await res.json();
      if (!Array.isArray(msgs) || msgs.length === lastMessageCount) return;
      lastMessageCount = msgs.length;
      const container = document.getElementById("ak-messages");
      container.innerHTML = "";
      msgs.forEach(function(m) {
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
    } catch(e) { console.error("Ask Kari load error:", e); }
  }

  function showChat() {
    document.getElementById("ak-intro").style.display = "none";
    document.getElementById("ak-messages").style.display = "flex";
    document.getElementById("ak-footer").style.display = "flex";
    document.getElementById("ak-reset").style.display = "block";
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(loadMessages, 4000);
  }
})();
