(function () {
  var SURL = "https://rhbmuxvbmmlbkjegwtgr.supabase.co";
  var SKEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoYm11eHZibW1sYmtqZWd3dGdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NDY0NjYsImV4cCI6MjA5MDMyMjQ2Nn0.D1qyXKPcDypXFTLdxk2fARkNPQKTiwJeTTX--ifc8UM";
  var H = { "Content-Type": "application/json", "apikey": SKEY, "Authorization": "Bearer " + SKEY };
  var LOGO = "https://chat.karikounkel.com/AskKari.png";
  var LOGO_W = "https://chat.karikounkel.com/AskKari-white.png";
  var GRAD = "linear-gradient(135deg,#e03820,#f07830)";
  var SOFT = "#fdf6f2"; var BOR = "#e8cfc0"; var RED = "#e03820";

  var cid = localStorage.getItem("ak_cid") || null;
  var poll = null; var lastCount = 0;

  var css = document.createElement("style");
  css.textContent = [
    "@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');",
    "#ak-bub{position:fixed;bottom:24px;right:24px;width:64px;height:64px;border-radius:50%;background:#fdf6f2;border:2px solid #e8cfc0;cursor:pointer;box-shadow:0 4px 18px rgba(224,56,32,0.18);z-index:99999;display:flex;align-items:center;justify-content:center;transition:transform 0.2s;overflow:hidden;padding:0;}",
    "#ak-bub:hover{transform:scale(1.08);}",
    "#ak-bub img{width:54px;height:54px;object-fit:contain;border-radius:50%;}",
    "#ak-pan{position:fixed;bottom:98px;right:24px;width:350px;max-height:600px;background:#fff;border:1.5px solid #e8cfc0;border-radius:20px;box-shadow:0 8px 36px rgba(224,56,32,0.12);z-index:99998;display:none;flex-direction:column;font-family:'DM Sans',sans-serif;overflow:hidden;}",
    "#ak-pan.open{display:flex;}",
    "#ak-hdr{background:" + GRAD + ";padding:16px 20px;display:flex;align-items:center;gap:12px;}",
    "#ak-hdr img{width:36px;height:36px;object-fit:contain;border-radius:50%;background:rgba(255,255,255,0.15);flex-shrink:0;}",
    "#ak-hdr-txt{flex:1;}",
    "#ak-title{font-size:17px;font-weight:700;color:#fff;}",
    "#ak-sub{font-size:11px;color:rgba(255,255,255,0.85);margin-top:1px;font-style:italic;}",
    "#ak-x{background:none;border:none;color:rgba(255,255,255,0.75);font-size:22px;cursor:pointer;padding:0;line-height:1;flex-shrink:0;}",
    "#ak-intro{padding:20px;display:flex;flex-direction:column;gap:10px;background:#fff;overflow-y:auto;}",
    "#ak-intro h3{margin:0;font-size:15px;font-weight:700;color:#2a1a10;}",
    "#ak-intro p{margin:0;font-size:12px;color:#a07060;}",
    ".ak-row{display:flex;gap:8px;}",
    ".ak-row input{flex:1;min-width:0;}",
    "#ak-intro input,#ak-intro textarea{width:100%;padding:10px 13px;background:#fdf6f2;border:1.5px solid #e8cfc0;border-radius:10px;color:#2a1a10;font-size:13px;font-family:'DM Sans',sans-serif;outline:none;box-sizing:border-box;}",
    "#ak-intro textarea{resize:none;line-height:1.5;}",
    "#ak-intro input::placeholder,#ak-intro textarea::placeholder{color:#c0a090;}",
    "#ak-err{font-size:11px;color:#e03820;display:none;}",
    "#ak-cb{background:#fdf6f2;border:1.5px solid #e8cfc0;border-radius:10px;padding:12px 14px;font-size:12px;color:#6a4030;line-height:1.6;overflow:visible;}",
    "#ak-cb strong{display:block;margin-bottom:6px;font-size:12px;color:#2a1a10;}",
    ".ak-cbl{display:grid;grid-template-columns:16px 1fr;gap:8px;cursor:pointer;font-size:12px;color:#2a1a10;margin-bottom:5px;line-height:1.4;width:100%;}",
    ".ak-cbl input[type=checkbox]{accent-color:#e03820;width:14px;height:14px;flex-shrink:0;margin-top:2px;cursor:pointer;}",
    "#ak-rem-row{display:flex;align-items:center;gap:8px;font-size:12px;color:#a07060;cursor:pointer;}",
    "#ak-rem-row input{accent-color:#e03820;width:14px;height:14px;flex-shrink:0;cursor:pointer;}",
    "#ak-go{padding:12px;background:" + GRAD + ";border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;}",
    "#ak-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#fdf6f2;}",
    ".ak-w{display:flex;flex-direction:column;}",
    ".ak-w.visitor{align-items:flex-end;}",
    ".ak-w.agent{align-items:flex-start;}",
    ".ak-m{max-width:78%;padding:10px 14px;font-size:13px;line-height:1.5;border-radius:14px;}",
    ".ak-m.visitor{background:" + GRAD + ";color:#fff;border-radius:14px 14px 4px 14px;font-weight:500;}",
    ".ak-m.agent{background:#fff;color:#2a1a10;border-radius:14px 14px 14px 4px;border:1.5px solid #e8cfc0;}",
    ".ak-t{font-size:10px;color:#b09080;margin-top:3px;padding:0 2px;}",
    "#ak-foot{padding:12px 14px;border-top:1.5px solid #e8cfc0;background:#fff;display:flex;gap:8px;}",
    "#ak-inp{flex:1;padding:10px 13px;background:#fdf6f2;border:1.5px solid #e8cfc0;border-radius:10px;color:#2a1a10;font-size:13px;font-family:'DM Sans',sans-serif;outline:none;}",
    "#ak-inp::placeholder{color:#c0a090;}",
    "#ak-send{padding:0 18px;background:" + GRAD + ";border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;}",
    "#ak-reset{text-align:center;padding:8px;background:#fff;border-top:1px solid #e8cfc0;font-size:11px;color:#b09080;cursor:pointer;display:none;}"
  ].join("");
  document.head.appendChild(css);

  var bub = document.createElement("button");
  bub.id = "ak-bub"; bub.title = "Ask Kari";
  var bi = document.createElement("img"); bi.src = LOGO; bi.alt = "Ask Kari";
  bub.appendChild(bi); document.body.appendChild(bub);

  var pan = document.createElement("div"); pan.id = "ak-pan";
  pan.innerHTML = [
    "<div id='ak-hdr'>",
      "<img src='" + LOGO_W + "' alt='Ask Kari'/>",
      "<div id='ak-hdr-txt'><div id='ak-title'>Ask Kari</div><div id='ak-sub'>Clarity with a side of mischief</div></div>",
      "<button id='ak-x'>x</button>",
    "</div>",
    "<div id='ak-intro'>",
      "<h3>Let\u2019s untangle this.</h3>",
      "<p>I read every one. Drop your info\u2014I\u2019ll get back to you.</p>",
      "<div class='ak-row'><input id='ak-fn' placeholder='First name'/><input id='ak-ln' placeholder='Last name'/></div>",
      "<input id='ak-em' type='email' placeholder='Email address (required)'/>",
      "<div id='ak-err'>Email is required \u2014 I need a way to reach you back.</div>",
      "<textarea id='ak-q' rows='3' placeholder='What\u2019s your question or ask?'></textarea>",
      "<div id='ak-cb'>",
        "<strong>One quick thing (the fine print, but friendly):</strong>",
        "I may turn great questions into content\u2014always stripped of identifying details.",
        "<div style='margin-top:8px;'>",
          "<label class='ak-cbl'><input type='checkbox' id='ak-ok'/><span>I'm okay with that</span></label>",
          "<label class='ak-cbl'><input type='checkbox' id='ak-named'/><span>Name me if you feature my question</span></label>",
        "</div>",
      "</div>",
      "<label id='ak-rem-row'><input type='checkbox' id='ak-rem' checked/> Remember my conversation on this device</label>",
      "<button id='ak-go'>Let\u2019s do this \u2192</button>",
    "</div>",
    "<div id='ak-msgs' style='display:none'></div>",
    "<div id='ak-foot' style='display:none'><input id='ak-inp' placeholder='Type a message...'/><button id='ak-send'>Send</button></div>",
    "<div id='ak-reset'>Start a new conversation</div>"
  ].join("");
  document.body.appendChild(pan);

  bub.addEventListener("click", function() { pan.classList.toggle("open"); });
  document.getElementById("ak-x").addEventListener("click", function() { pan.classList.remove("open"); });

  if (cid) { showChat(); loadMsgs(); startPoll(); }

  document.getElementById("ak-go").addEventListener("click", async function() {
    try {
      var fn = (document.getElementById("ak-fn").value || "").trim();
      var ln = (document.getElementById("ak-ln").value || "").trim();
      var em = (document.getElementById("ak-em").value || "").trim();
      var q  = (document.getElementById("ak-q").value  || "").trim();
      var err = document.getElementById("ak-err");
      if (!em) { err.style.display = "block"; return; }
      err.style.display = "none";
      var name = [fn, ln].filter(Boolean).join(" ") || "Friend";
      var ok    = document.getElementById("ak-ok").checked;
      var named = document.getElementById("ak-named").checked;
      var rem   = document.getElementById("ak-rem").checked;
      var res = await fetch(SURL + "/rest/v1/conversations", {
        method: "POST",
        headers: Object.assign({}, H, { "Prefer": "return=representation" }),
        body: JSON.stringify({ visitor_id: "v_" + Date.now(), visitor_name: name, visitor_email: em, site_origin: window.location.origin, status: "open", content_consent: ok, wants_credit: named })
      });
      var data = await res.json();
      cid = data[0].id;
      if (rem) { localStorage.setItem("ak_cid", cid); } else { sessionStorage.setItem("ak_cid", cid); }
      if (q) { await postMsg("visitor", q); }
      await postMsg("agent", "Give me a minute — or seven.");
      showChat(); startPoll();
    } catch(e) { console.error("Ask Kari error:", e); }
  });

  document.getElementById("ak-send").addEventListener("click", sendMsg);
  document.getElementById("ak-inp").addEventListener("keydown", function(e) { if (e.key === "Enter") sendMsg(); });
  document.getElementById("ak-reset").addEventListener("click", function() {
    if (confirm("Start a new conversation? Your history stays on file.")) {
      localStorage.removeItem("ak_cid"); sessionStorage.removeItem("ak_cid");
      cid = null; lastCount = 0;
      if (poll) { clearInterval(poll); poll = null; }
      document.getElementById("ak-intro").style.display = "flex";
      document.getElementById("ak-msgs").style.display = "none";
      document.getElementById("ak-foot").style.display = "none";
      document.getElementById("ak-reset").style.display = "none";
      document.getElementById("ak-msgs").innerHTML = "";
    }
  });

  async function postMsg(sender, body) {
    await fetch(SURL + "/rest/v1/messages", {
      method: "POST",
      headers: Object.assign({}, H, { "Prefer": "return=minimal" }),
      body: JSON.stringify({ conversation_id: cid, sender: sender, sender_name: sender === "agent" ? "Kari" : null, body: body })
    });
  }

  async function sendMsg() {
    try {
      var inp = document.getElementById("ak-inp");
      var body = (inp.value || "").trim();
      if (!body || !cid) return;
      inp.value = "";
      await postMsg("visitor", body);
      await fetch(SURL + "/rest/v1/conversations?id=eq." + cid, { method: "PATCH", headers: H, body: JSON.stringify({ updated_at: new Date().toISOString(), last_sender: "visitor" }) });
      loadMsgs();
    } catch(e) { console.error("Ask Kari send error:", e); }
  }

  async function loadMsgs() {
    try {
      if (!cid) return;
      var res = await fetch(SURL + "/rest/v1/messages?conversation_id=eq." + cid + "&order=created_at.asc", { headers: H });
      var msgs = await res.json();
      if (!Array.isArray(msgs) || msgs.length === lastCount) return;
      lastCount = msgs.length;
      var c = document.getElementById("ak-msgs");
      c.innerHTML = "";
      msgs.forEach(function(m) {
        var w = document.createElement("div"); w.className = "ak-w " + m.sender;
        var b = document.createElement("div"); b.className = "ak-m " + m.sender; b.textContent = m.body;
        var t = document.createElement("div"); t.className = "ak-t";
        t.textContent = new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        w.appendChild(b); w.appendChild(t); c.appendChild(w);
      });
      c.scrollTop = c.scrollHeight;
    } catch(e) { console.error("Ask Kari load error:", e); }
  }

  function showChat() {
    document.getElementById("ak-intro").style.display = "none";
    document.getElementById("ak-msgs").style.display = "flex";
    document.getElementById("ak-foot").style.display = "flex";
    document.getElementById("ak-reset").style.display = "block";
    loadMsgs();
  }

  function startPoll() {
    if (poll) return;
    poll = setInterval(loadMsgs, 4000);
  }
})();
