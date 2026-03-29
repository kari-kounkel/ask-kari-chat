import { useState } from "react";
import { supabase } from "../supabaseClient";

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
    width: "100%", padding: "12px 16px", background: "#1a2535",
    border: "1px solid #2a3a50", borderRadius: 10, color: "#f0e6d0",
    fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none",
    boxSizing: "border-box", marginBottom: 16,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f1923", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif", padding: 20 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />
      <div style={{ width: "100%", maxWidth: 400, background: "#1a2535", border: "1px solid #2a3a50", borderRadius: 16, padding: 36 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: "#C9A84C", marginBottom: 6, textAlign: "center" }}>Ask Kari</div>
        <div style={{ fontSize: 13, color: "#7a8fa8", textAlign: "center", marginBottom: 28 }}>Agent Inbox — Log In</div>
        {error && <div style={{ background: "#ff444418", border: "1px solid #ff444444", borderRadius: 8, padding: "10px 14px", color: "#ff6b6b", fontSize: 13, marginBottom: 16 }}>{error}</div>}
        <form onSubmit={handle}>
          <label style={{ display: "block", color: "#7a8fa8", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inp} placeholder="you@email.com" />
          <label style={{ display: "block", color: "#7a8fa8", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ ...inp, marginBottom: 24 }} placeholder="••••••••" />
          <button type="submit" disabled={loading} style={{ width: "100%", padding: 14, background: "linear-gradient(135deg,#C9A84C,#a07830)", border: "none", borderRadius: 10, color: "#0f1923", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>
      </div>
    </div>
  );
}
