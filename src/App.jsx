import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import AdminInbox from "./components/AdminInbox";
import AgentLogin from "./components/AgentLogin";

export default function App() {
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setAgent(session.user);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setAgent(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0f1923", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif", color: "#C9A84C", fontSize: 18 }}>
      Loading...
    </div>
  );

  if (!agent) return <AgentLogin onLogin={setAgent} />;
  return <AdminInbox agent={agent} onLogout={async () => { await supabase.auth.signOut(); setAgent(null); }} />;
}
