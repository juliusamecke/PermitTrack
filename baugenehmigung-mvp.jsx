const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
// ============================================================
// PERMITTRACK – MVP mit Supabase Auth + Datenbank
// ============================================================
// SETUP (einmalig, ~15 Minuten):
//
// 1. Supabase Projekt erstellen:
//    → https://supabase.com → New Project
//    → Region: Frankfurt (eu-central-1) ← WICHTIG für DSGVO
//
// 2. Diese zwei Werte unten eintragen:
//    → Settings → API → Project URL + anon public key
//
// 3. SQL in Supabase ausführen (Settings → SQL Editor):
//
//    create table projects (
//      id uuid default gen_random_uuid() primary key,
//      user_id uuid references auth.users not null,
//      name text not null,
//      gemeinde text,
//      bauamt text,
//      kontakt text,
//      status text default 'Vorbereitung',
//      frist date,
//      wiedervorlage date,
//      notizen jsonb default '[]',
//      dokumente jsonb default '[]',
//      created_at timestamptz default now()
//    );
//
//    -- Row Level Security aktivieren (DSGVO: jeder sieht nur seine Daten)
//    alter table projects enable row level security;
//    create policy "Users see own projects"
//      on projects for all
//      using (auth.uid() = user_id);
//
// 4. Vercel Deploy:
//    → https://vercel.com → New Project → GitHub Repo importieren
//    → Environment Variables: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
// ============================================================

import { useState, useEffect } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── FARBEN & KONSTANTEN ────────────────────────────────────
const STATUS_META = {
  Vorbereitung:       { bg: "#1e293b", text: "#94a3b8", dot: "#475569" },
  Eingereicht:        { bg: "#1e3a5f", text: "#60a5fa", dot: "#3b82f6" },
  "Rückfrage Behörde":{ bg: "#3b2a0a", text: "#fbbf24", dot: "#f59e0b" },
  Genehmigt:          { bg: "#052e16", text: "#34d399", dot: "#10b981" },
  Abgelehnt:          { bg: "#2d0a0a", text: "#f87171", dot: "#ef4444" },
};

const DOK_NEXT = { Fehlend: "In Bearbeitung", "In Bearbeitung": "Eingereicht", Eingereicht: "Fehlend" };
const DOK_STYLE = {
  Fehlend:          { bg: "#2d0a0a", color: "#f87171" },
  "In Bearbeitung": { bg: "#3b2a0a", color: "#fbbf24" },
  Eingereicht:      { bg: "#052e16", color: "#34d399" },
};

function getFristInfo(frist) {
  if (!frist) return null;
  const diff = Math.ceil((new Date(frist) - new Date()) / 86400000);
  if (diff < 0)  return { label: "Überfällig", color: "#ef4444", bg: "#2d0a0a" };
  if (diff <= 14) return { label: `${diff} Tage`, color: "#f59e0b", bg: "#3b2a0a" };
  return { label: `${diff} Tage`, color: "#34d399", bg: "#052e16" };
}

const DEFAULT_DOCS = [
  { name: "Lageplan", status: "Fehlend" },
  { name: "Bauzeichnungen", status: "Fehlend" },
  { name: "Baubeschreibung", status: "Fehlend" },
];

// ── AUTH SCREEN ────────────────────────────────────────────
function AuthScreen() {
  const [mode, setMode]         = useState("login");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState("");
  const [err, setErr]           = useState("");

  const handle = async () => {
    setErr(""); setMsg(""); setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
        if (error) throw error;
        setMsg("Bestätigungs-E-Mail gesendet – bitte E-Mail bestätigen.");
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setMsg("Passwort-Reset-Link wurde gesendet.");
      }
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  const inp = { width: "100%", marginTop: 4, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif" };
  const lbl = { fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 };

  return (
    <div style={{ minHeight: "100vh", background: "#07090f", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,#3b6fd4,#2a4fa0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, margin: "0 auto 14px" }}>🏛</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: "#fff", fontFamily: "'Playfair Display', serif" }}>PermitTrack</div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Baugenehmigungen einfach tracken</div>
        </div>

        <div style={{ background: "#0f1623", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 28 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {["login","signup"].map(m => (
              <button key={m} onClick={() => { setMode(m); setErr(""); setMsg(""); }}
                style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: "'DM Sans', sans-serif",
                  background: mode === m ? "rgba(59,111,212,0.25)" : "rgba(255,255,255,0.05)",
                  color: mode === m ? "#7ba3f5" : "#64748b" }}>
                {m === "login" ? "Anmelden" : "Registrieren"}
              </button>
            ))}
          </div>

          {mode === "signup" && (
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Max Mustermann" style={inp} />
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>E-Mail</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="name@buero.de" type="email" style={inp} />
          </div>
          {mode !== "reset" && (
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Passwort</label>
              <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="••••••••" onKeyDown={e => e.key === "Enter" && handle()} style={inp} />
            </div>
          )}

          {err && <div style={{ padding: "8px 12px", borderRadius: 8, background: "#2d0a0a", color: "#f87171", fontSize: 13, marginBottom: 12 }}>{err}</div>}
          {msg && <div style={{ padding: "8px 12px", borderRadius: 8, background: "#052e16", color: "#34d399", fontSize: 13, marginBottom: 12 }}>{msg}</div>}

          <button onClick={handle} disabled={loading}
            style={{ width: "100%", padding: "11px 0", borderRadius: 8, border: "none", cursor: loading ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, color: "#fff", fontFamily: "'DM Sans', sans-serif",
              background: loading ? "#1e3a5f" : "linear-gradient(135deg,#3b6fd4,#2a4fa0)" }}>
            {loading ? "Laden…" : mode === "login" ? "Anmelden" : mode === "signup" ? "Account erstellen" : "Link senden"}
          </button>

          {mode === "login" && (
            <button onClick={() => setMode("reset")} style={{ width: "100%", marginTop: 10, padding: "8px 0", background: "none", border: "none", color: "#475569", fontSize: 12, cursor: "pointer" }}>
              Passwort vergessen?
            </button>
          )}
        </div>
        <div style={{ textAlign: "center", marginTop: 14, fontSize: 11, color: "#1e293b" }}>
          🔒 Daten in Frankfurt (EU) · DSGVO-konform
        </div>
      </div>
    </div>
  );
}

// ── PROJECT DETAIL MODAL ───────────────────────────────────
function ProjectModal({ project, onClose, onUpdate }) {
  const [docs, setDocs]     = useState(project.dokumente || []);
  const [status, setStatus] = useState(project.status);
  const [notiz, setNotiz]   = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (patch) => {
    setSaving(true);
    const merged = { status, dokumente: docs, notizen: project.notizen || [], ...patch };
    const { data } = await supabase.from("projects").update(merged).eq("id", project.id).select().single();
    if (data) onUpdate(data);
    setSaving(false);
    return data;
  };

  const toggleDoc = async (i) => {
    const nd = docs.map((d, idx) => idx === i ? { ...d, status: DOK_NEXT[d.status] } : d);
    setDocs(nd);
    await save({ dokumente: nd });
  };

  const addNotiz = async () => {
    if (!notiz.trim()) return;
    const nn = [...(project.notizen || []), { text: notiz, datum: new Date().toISOString().split("T")[0] }];
    setNotiz("");
    const updated = await save({ notizen: nn });
    if (updated) onUpdate(updated);
  };

  const ampel = getFristInfo(project.frist);
  const sm = STATUS_META[status] || STATUS_META["Vorbereitung"];
  const base = { fontFamily: "'DM Sans', sans-serif" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
      <div style={{ ...base, width: "100%", maxWidth: 580, maxHeight: "90vh", overflowY: "auto", borderRadius: 16, background: "#0f1623", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2 style={{ margin: 0, color: "#fff", fontSize: 17, fontFamily: "'Playfair Display', serif" }}>{project.name}</h2>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>{project.gemeinde} · {project.bauamt}</p>
              {project.kontakt && <p style={{ margin: "2px 0 0", color: "#64748b", fontSize: 12 }}>📞 {project.kontakt}</p>}
            </div>
            <button onClick={onClose} style={{ fontSize: 22, color: "#64748b", background: "none", border: "none", cursor: "pointer" }}>×</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, alignItems: "center" }}>
            <select value={status} onChange={e => { setStatus(e.target.value); save({ status: e.target.value }); }}
              style={{ fontSize: 12, padding: "4px 10px", borderRadius: 20, border: "none", cursor: "pointer", background: sm.bg, color: sm.text, fontFamily: "'DM Sans', sans-serif" }}>
              {Object.keys(STATUS_META).map(s => <option key={s}>{s}</option>)}
            </select>
            {ampel && <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 20, background: ampel.bg, color: ampel.color }}>⏱ {ampel.label}</span>}
            {saving && <span style={{ fontSize: 11, color: "#475569" }}>Speichern…</span>}
          </div>
        </div>

        <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 3, color: "#334155", marginBottom: 10 }}>Unterlagen</div>
          {docs.map((d, i) => {
            const ds = DOK_STYLE[d.status] || DOK_STYLE["Fehlend"];
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", marginBottom: 6 }}>
                <span style={{ color: "#e2e8f0", fontSize: 13 }}>{d.name}</span>
                <button onClick={() => toggleDoc(i)} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 12, border: "none", cursor: "pointer", background: ds.bg, color: ds.color, fontFamily: "'DM Sans', sans-serif" }}>{d.status}</button>
              </div>
            );
          })}
          <p style={{ fontSize: 11, color: "#334155", marginTop: 4 }}>↑ Klick auf Status zum Wechseln</p>
        </div>

        <div style={{ padding: "16px 24px" }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 3, color: "#334155", marginBottom: 10 }}>Behördenkommunikation</div>
          {(project.notizen || []).length === 0 && <p style={{ color: "#334155", fontSize: 13, marginBottom: 10 }}>Noch keine Notizen.</p>}
          {(project.notizen || []).map((n, i) => (
            <div key={i} style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", marginBottom: 6 }}>
              <p style={{ margin: 0, color: "#e2e8f0", fontSize: 13 }}>{n.text}</p>
              <p style={{ margin: "4px 0 0", color: "#475569", fontSize: 11 }}>{n.datum}</p>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input value={notiz} onChange={e => setNotiz(e.target.value)} onKeyDown={e => e.key === "Enter" && addNotiz()} placeholder="Neue Notiz…"
              style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 13, outline: "none", fontFamily: "'DM Sans', sans-serif" }} />
            <button onClick={addNotiz} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", color: "#fff", background: "linear-gradient(135deg,#3b6fd4,#2a4fa0)", fontWeight: 600 }}>+</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── NEW PROJECT MODAL ──────────────────────────────────────
function NewProjectModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: "", gemeinde: "", bauamt: "", kontakt: "", frist: "", wiedervorlage: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handle = async () => {
    if (!form.name || !form.gemeinde) { setErr("Name und Gemeinde sind Pflichtfelder."); return; }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("projects").insert({
      user_id: user.id, ...form,
      frist: form.frist || null, wiedervorlage: form.wiedervorlage || null,
      status: "Vorbereitung", notizen: [], dokumente: DEFAULT_DOCS,
    }).select().single();
    if (error) { setErr(error.message); setLoading(false); return; }
    onCreate(data); onClose();
  };

  const inp = { width: "100%", marginTop: 4, padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
      <div style={{ width: "100%", maxWidth: 420, borderRadius: 16, padding: 24, background: "#0f1623", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, color: "#fff", fontSize: 16, fontFamily: "'Playfair Display', serif" }}>Neues Projekt</h2>
          <button onClick={onClose} style={{ fontSize: 22, color: "#64748b", background: "none", border: "none", cursor: "pointer" }}>×</button>
        </div>
        {[["Projektname *","name","Wohnhaus Musterstraße 12"],["Gemeinde *","gemeinde","München"],["Bauamt","bauamt","Bauordnungsamt München"],["Kontakt","kontakt","Fr. Huber – 089/233-123"]].map(([l,k,ph]) => (
          <div key={k} style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "#475569" }}>{l}</label>
            <input value={form[k]} onChange={e => set(k, e.target.value)} placeholder={ph} style={inp} />
          </div>
        ))}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 }}>
          {[["Frist","frist"],["Wiedervorlage","wiedervorlage"]].map(([l,k]) => (
            <div key={k}>
              <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "#475569" }}>{l}</label>
              <input type="date" value={form[k]} onChange={e => set(k, e.target.value)} style={{ ...inp, colorScheme: "dark" }} />
            </div>
          ))}
        </div>
        {err && <div style={{ padding: "8px 12px", borderRadius: 8, background: "#2d0a0a", color: "#f87171", fontSize: 13, marginTop: 8 }}>{err}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(255,255,255,0.06)", color: "#64748b" }}>Abbrechen</button>
          <button onClick={handle} disabled={loading} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer", background: "linear-gradient(135deg,#3b6fd4,#2a4fa0)", color: "#fff", fontWeight: 600 }}>
            {loading ? "Erstellen…" : "Erstellen"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ───────────────────────────────────────────────
export default function App() {
  const [session, setSession]   = useState(null);
  const [authReady, setReady]   = useState(false);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew]   = useState(false);
  const [filter, setFilter]     = useState("Alle");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setReady(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    supabase.from("projects").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { setProjects(data || []); setLoading(false); });
  }, [session]);

  if (!authReady) return (
    <div style={{ minHeight: "100vh", background: "#07090f", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", fontFamily: "'DM Sans', sans-serif" }}>
      Laden…
    </div>
  );
  if (!session) return <AuthScreen />;

  const stats = {
    gesamt:    projects.length,
    laufend:   projects.filter(p => ["Vorbereitung","Eingereicht","Rückfrage Behörde"].includes(p.status)).length,
    genehmigt: projects.filter(p => p.status === "Genehmigt").length,
    kritisch:  projects.filter(p => getFristInfo(p.frist)?.label === "Überfällig").length,
  };

  const filtered = filter === "Alle" ? projects : projects.filter(p => p.status === filter);

  return (
    <div style={{ minHeight: "100vh", background: "#07090f", fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Topbar */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#3b6fd4,#2a4fa0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🏛</div>
          <span style={{ fontSize: 17, fontWeight: 600, color: "#fff", fontFamily: "'Playfair Display', serif" }}>PermitTrack</span>
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "rgba(59,111,212,0.15)", color: "#7ba3f5" }}>Beta</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "#475569" }}>{session.user.email}</span>
          <button onClick={() => supabase.auth.signOut()} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "none", color: "#64748b", cursor: "pointer" }}>Abmelden</button>
          <button onClick={() => setShowNew(true)} style={{ fontSize: 13, padding: "6px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#3b6fd4,#2a4fa0)", color: "#fff", cursor: "pointer", fontWeight: 500 }}>+ Neues Projekt</button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Projekte", val: stats.gesamt,    color: "#7ba3f5" },
            { label: "Laufend",  val: stats.laufend,   color: "#7ba3f5" },
            { label: "Genehmigt",val: stats.genehmigt, color: "#34d399" },
            { label: "Überfällig",val: stats.kritisch,  color: stats.kritisch > 0 ? "#ef4444" : "#34d399" },
          ].map(s => (
            <div key={s.label} style={{ padding: "16px 18px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "#334155", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 600, color: s.color, fontFamily: "'Playfair Display', serif" }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {["Alle",...Object.keys(STATUS_META)].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ fontSize: 12, padding: "5px 14px", borderRadius: 20, cursor: "pointer",
                border: filter === f ? "1px solid rgba(59,111,212,0.4)" : "1px solid transparent",
                background: filter === f ? "rgba(59,111,212,0.25)" : "rgba(255,255,255,0.05)",
                color: filter === f ? "#7ba3f5" : "#64748b" }}>
              {f}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#334155" }}>Projekte werden geladen…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#334155" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🏛</div>
            <div>{filter === "Alle" ? "Noch keine Projekte – erstelle dein erstes!" : "Keine Projekte in dieser Kategorie."}</div>
          </div>
        ) : filtered.map(p => {
          const sm    = STATUS_META[p.status] || STATUS_META["Vorbereitung"];
          const ampel = getFristInfo(p.frist);
          const docs  = p.dokumente || [];
          const einge = docs.filter(d => d.status === "Eingereicht").length;
          const fehlt = docs.filter(d => d.status === "Fehlend").length;
          const prog  = docs.length > 0 ? Math.round(einge / docs.length * 100) : 0;
          return (
            <div key={p.id} onClick={() => setSelected(p)}
              style={{ padding: "16px 18px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", marginBottom: 8, transition: "background .15s" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ color: "#e2e8f0", fontWeight: 500, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: sm.bg, color: sm.text, flexShrink: 0 }}>
                      <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: sm.dot, marginRight: 5, verticalAlign: "middle" }}></span>
                      {p.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#475569", marginBottom: 10 }}>{p.gemeinde} · {p.bauamt || "–"}</div>
                  {docs.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 4, borderRadius: 4, background: "rgba(255,255,255,0.08)" }}>
                        <div style={{ height: 4, borderRadius: 4, width: `${prog}%`, background: prog === 100 ? "#34d399" : "linear-gradient(90deg,#3b6fd4,#7ba3f5)" }} />
                      </div>
                      <span style={{ fontSize: 11, color: "#475569", whiteSpace: "nowrap" }}>{einge}/{docs.length} Dok.</span>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end", flexShrink: 0 }}>
                  {ampel && <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 10, background: ampel.bg, color: ampel.color }}>{ampel.label}</span>}
                  {fehlt > 0 && <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 10, background: "#2d0a0a", color: "#f87171" }}>{fehlt} fehlend</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <ProjectModal project={selected} onClose={() => setSelected(null)}
          onUpdate={u => { setProjects(ps => ps.map(p => p.id === u.id ? u : p)); setSelected(u); }} />
      )}
      {showNew && (
        <NewProjectModal onClose={() => setShowNew(false)} onCreate={p => setProjects(ps => [p, ...ps])} />
      )}
    </div>
  );
}
