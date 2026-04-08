import { useState } from "react";
import { supabase } from "../supabaseClient";

const RED = "#e03820";
const AMBER = "#f07830";
const GRAD = "linear-gradient(135deg," + RED + "," + AMBER + ")";
const SOFT = "#fdf6f2";
const BORDER = "#e8cfc0";

export default function AgentLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) setError(err.message);
    else onLogin(data.user);
  };

  const inp = {
    width: "100%", padding: "12px 16px", background: SOFT,
    border: "1.5px solid " + BORDER, borderRadius: 10, color: "#2a1a10",
    fontSize: 16, fontFamily: "'DM Sans',sans-serif", outline: "none",
    boxSizing: "border-box", marginBottom: 16,
  };

  return (
    <div style={{ minHeight: "100vh", background: SOFT, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif", padding: 20 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,700;1,700&display=swap" rel="stylesheet" />
      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Logo block */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 90, height: 90, borderRadius: "50%", background: "radial-gradient(circle, #ffffff 55%, #fdf0ea 100%)", boxShadow: "0 0 22px rgba(224,56,32,0.14), 0 0 6px rgba(224,56,32,0.08)", marginBottom: 20 }}>
            <img src="/AskKari.png" alt="Ask Kari" style={{ width: 60, height: 60, objectFit: "contain" }} />
          </div>
          <div style={{ fontSize: 13, color: "#a07060", fontStyle: "italic" }}>Clarity with a side of mischief.</div>
        </div>

        {/* Card */}
        <div style={{ background: "#fff", border: "1.5px solid " + BORDER, borderRadius: 20, padding: "36px 32px", boxShadow: "0 12px 48px rgba(224,56,32,0.08)" }}>
          <div style={{ fontSize: 11, color: "#a07060", textAlign: "center", marginBottom: 28, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700 }}>Agent Inbox</div>

          {error && (
            <div style={{ background: "#ffe8e8", border: "1.5px solid #f0c0b0", borderRadius: 10, padding: "10px 14px", color: RED, fontSize: 13, marginBottom: 20 }}>
              {error}
            </div>
          )}

          <form onSubmit={handle}>
            <label style={{ display: "block", color: "#a07060", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontWeight: 600 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" style={inp} placeholder="kari@karikounkel.com" />

            <label style={{ display: "block", color: "#a07060", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontWeight: 600 }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" style={{ ...inp, marginBottom: 28 }} placeholder="..." />

            <button type="submit" disabled={loading} style={{ width: "100%", padding: 15, background: loading ? "#e8cfc0" : GRAD, border: "none", borderRadius: 12, color: loading ? "#a07060" : "#fff", fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: "'DM Sans',sans-serif", boxShadow: loading ? "none" : "0 4px 18px rgba(224,56,32,0.28)", transition: "all 0.2s", letterSpacing: 0.3 }}>
              {loading ? "One moment..." : "Enter the Inbox"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 11, color: "#c0a090", lineHeight: 1.7 }}>
          Ask Kari is a product of CARES Consulting Inc.<br />
          <span style={{ color: "#e8cfc0" }}>Kari Hoglund Kounkel</span>
        </div>
      </div>
    </div>
  );
}
