import { useState } from "react";
import { supabase } from "../supabaseClient";

const GRAD = "linear-gradient(135deg,#e03820,#f07830)";
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
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/AskKari.png" alt="Ask Kari" style={{ width: 120, height: 120, objectFit: "contain" }} />
          <div style={{ fontSize: 13, color: "#a07060", marginTop: 4, fontStyle: "italic" }}>Clarity with a side of mischief</div>
        </div>
        <div style={{ background: "#fff", border: "1.5px solid " + BORDER, borderRadius: 20, padding: 36, boxShadow: "0 8px 36px rgba(224,56,32,0.08)" }}>
          <div style={{ fontSize: 11, color: "#a07060", textAlign: "center", marginBottom: 24, textTransform: "uppercase", letterSpacing: 2, fontWeight: 600 }}>Agent Inbox — Log In</div>
          {error && (
            <div style={{ background: "#ffe8e8", border: "1.5px solid #f0c0b0", borderRadius: 8, padding: "10px 14px", color: "#e03820", fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}
          <form onSubmit={handle}>
            <label style={{ display: "block", color: "#a07060", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" style={inp} placeholder="you@email.com" />
            <label style={{ display: "block", color: "#a07060", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" style={{ ...inp, marginBottom: 28 }} placeholder="••••••••" />
            <button type="submit" disabled={loading} style={{ width: "100%", padding: 14, background: GRAD, border: "none", borderRadius: 10, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", opacity: loading ? 0.7 : 1, boxShadow: "0 4px 16px rgba(224,56,32,0.25)" }}>
              {loading ? "Logging in..." : "Log In \u2192"}
            </button>
          </form>
        </div>
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: "#c0a090" }}>
          Ask Kari · CARES Consulting Inc. · Kari Hoglund Kounkel
        </div>
      </div>
    </div>
  );
}
