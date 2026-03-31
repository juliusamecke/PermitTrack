import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── VOLLSTÄNDIGE DOKUMENTENLISTE ───────────────────────────
const DOKUMENT_KATEGORIEN = [
  {
    kategorie: "Planunterlagen",
    dokumente: [
      "Lageplan (amtlich)",
      "Lageplan (nicht amtlich)",
      "Grundrisse alle Geschosse",
      "Ansichten (alle Seiten)",
      "Schnitte",
      "Dachaufsicht",
      "Abstandsflächenplan",
      "Freiflächenplan",
    ],
  },
  {
    kategorie: "Baubeschreibung & Antrag",
    dokumente: [
      "Baubeschreibung",
      "Bauantrag (ausgefüllt)",
      "Betriebsbeschreibung",
      "Nutzungsänderungsantrag",
    ],
  },
  {
    kategorie: "Nachweise & Berechnungen",
    dokumente: [
      "Wohnflächenberechnung",
      "Brutto-Rauminhalt Berechnung",
      "Abstandsflächenberechnung",
      "Stellplatznachweis",
      "Erschließungsnachweis",
    ],
  },
  {
    kategorie: "Technische Nachweise",
    dokumente: [
      "Standsicherheitsnachweis (Statik)",
      "Wärmeschutznachweis (EnEV/GEG)",
      "Schallschutznachweis",
      "Brandschutznachweis",
      "Brandschutzkonzept",
      "Lüftungskonzept",
      "Entwässerungsplan",
    ],
  },
  {
    kategorie: "Behörden & Genehmigungen",
    dokumente: [
      "Grundbuchauszug",
      "Liegenschaftskarte",
      "Zustimmung Nachbarn",
      "Denkmalschutz-Genehmigung",
      "Naturschutz-Stellungnahme",
      "Wasserrechtliche Erlaubnis",
      "Immissionsschutz-Genehmigung",
    ],
  },
  {
    kategorie: "Sonstiges",
    dokumente: [
      "Vollmacht Bauherr",
      "Nachweis Bauvorlageberechtigung",
      "Versicherungsnachweis",
      "Fotodokumentation Bestand",
    ],
  },
];

const ALLE_DOKUMENTE = DOKUMENT_KATEGORIEN.flatMap(k => k.dokumente);

const STATUS_META = {
  Vorbereitung:        { bg: "#1e293b", text: "#94a3b8", dot: "#8898b2" },
  Eingereicht:         { bg: "#1e3a5f", text: "#60a5fa", dot: "#3b82f6" },
  "Rückfrage Behörde": { bg: "#3b2a0a", text: "#fbbf24", dot: "#f59e0b" },
  Genehmigt:           { bg: "#052e16", text: "#34d399", dot: "#10b981" },
  Abgelehnt:           { bg: "#2d0a0a", text: "#f87171", dot: "#ef4444" },
};

const DOK_NEXT  = { Fehlend: "In Bearbeitung", "In Bearbeitung": "Eingereicht", Eingereicht: "Fehlend" };
const DOK_STYLE = {
  Fehlend:          { bg: "#2d0a0a", color: "#f87171" },
  "In Bearbeitung": { bg: "#3b2a0a", color: "#fbbf24" },
  Eingereicht:      { bg: "#052e16", color: "#34d399" },
};

function getFristInfo(frist) {
  if (!frist) return null;
  const diff = Math.ceil((new Date(frist) - new Date()) / 86400000);
  if (diff < 0)   return { label: "Überfällig", color: "#ef4444", bg: "#2d0a0a" };
  if (diff <= 14) return { label: `${diff} Tage`,  color: "#f59e0b", bg: "#3b2a0a" };
  return           { label: `${diff} Tage`,         color: "#34d399", bg: "#052e16" };
}

const base = { fontFamily: "'DM Sans', sans-serif" };
const inp  = (extra = {}) => ({ ...base, width: "100%", marginTop: 4, padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box", ...extra });
const lbl  = { fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "#8898b2" };

// ── DOKUMENTE AUSWÄHLEN MODAL ──────────────────────────────
function DokumenteModal({ vorhandene, onSave, onClose }) {
  const vorhandeneNamen = vorhandene.map(d => d.name);
  const [ausgewaehlt, setAusgewaehlt] = useState(new Set(vorhandeneNamen));
  const [eigenes, setEigenes]         = useState("");
  const [suche, setSuche]             = useState("");

  const toggle = (name) => {
    setAusgewaehlt(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const eigenesHinzufuegen = () => {
    if (!eigenes.trim()) return;
    setAusgewaehlt(prev => new Set([...prev, eigenes.trim()]));
    setEigenes("");
  };

  const speichern = () => {
    const neueDoks = [...ausgewaehlt].map(name => ({
      name,
      status: vorhandeneNamen.includes(name)
        ? vorhandene.find(d => d.name === name).status
        : "Fehlend",
    }));
    onSave(neueDoks);
  };

  const gefilterteKats = DOKUMENT_KATEGORIEN.map(k => ({
    ...k,
    dokumente: k.dokumente.filter(d => d.toLowerCase().includes(suche.toLowerCase())),
  })).filter(k => k.dokumente.length > 0);

  const eigeneDoks = [...ausgewaehlt].filter(d => !ALLE_DOKUMENTE.includes(d));

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }}>
      <div style={{ ...base, width: "100%", maxWidth: 580, maxHeight: "88vh", display: "flex", flexDirection: "column", borderRadius: 16, background: "#0f1623", border: "1px solid rgba(255,255,255,0.08)" }}>

        {/* Header */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ margin: 0, color: "#fff", fontSize: 16, fontFamily: "'Playfair Display', serif" }}>Unterlagen auswählen</h2>
            <button onClick={onClose} style={{ fontSize: 22, color: "#8898b2", background: "none", border: "none", cursor: "pointer" }}>×</button>
          </div>
          <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Dokument suchen…" style={inp({ marginTop: 0 })} />
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "#8898b2" }}>{ausgewaehlt.size} Dokumente ausgewählt</p>
        </div>

        {/* Scrollbare Liste */}
        <div style={{ overflowY: "auto", flex: 1, padding: "12px 24px" }}>

          {/* Eigene Dokumente oben */}
          {eigeneDoks.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 3, color: "#3b82f6", marginBottom: 8 }}>Eigene Dokumente</div>
              {eigeneDoks.map(d => (
                <label key={d} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 8, cursor: "pointer", marginBottom: 4, background: "rgba(59,130,246,0.08)" }}>
                  <input type="checkbox" checked={ausgewaehlt.has(d)} onChange={() => toggle(d)}
                    style={{ accentColor: "#3b82f6", width: 15, height: 15, cursor: "pointer", flexShrink: 0 }} />
                  <span style={{ color: "#e2e8f0", fontSize: 13 }}>{d}</span>
                </label>
              ))}
            </div>
          )}

          {/* Standardkategorien */}
          {gefilterteKats.map(k => (
            <div key={k.kategorie} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 3, color: "#8898b2", marginBottom: 8 }}>{k.kategorie}</div>
              {k.dokumente.map(d => (
                <label key={d} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 8, cursor: "pointer", marginBottom: 4, background: ausgewaehlt.has(d) ? "rgba(59,130,246,0.08)" : "rgba(255,255,255,0.03)" }}>
                  <input type="checkbox" checked={ausgewaehlt.has(d)} onChange={() => toggle(d)}
                    style={{ accentColor: "#3b82f6", width: 15, height: 15, cursor: "pointer", flexShrink: 0 }} />
                  <span style={{ color: ausgewaehlt.has(d) ? "#e2e8f0" : "#94a3b8", fontSize: 13 }}>{d}</span>
                </label>
              ))}
            </div>
          ))}
        </div>

        {/* Footer: eigenes Dokument + Speichern */}
        <div style={{ padding: "12px 24px", borderTop: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "#8898b2", marginBottom: 8 }}>Eigenes Dokument hinzufügen</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input value={eigenes} onChange={e => setEigenes(e.target.value)} onKeyDown={e => e.key === "Enter" && eigenesHinzufuegen()}
              placeholder="z.B. Gutachten Bodenmechanik…" style={inp({ marginTop: 0, flex: 1 })} />
            <button onClick={eigenesHinzufuegen}
              style={{ padding: "9px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(59,130,246,0.2)", color: "#60a5fa", fontWeight: 600, flexShrink: 0 }}>+</button>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(255,255,255,0.06)", color: "#8898b2" }}>Abbrechen</button>
            <button onClick={speichern} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer", background: "linear-gradient(135deg,#3b6fd4,#2a4fa0)", color: "#fff", fontWeight: 600 }}>
              Speichern ({ausgewaehlt.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
        setMsg("Bestätigungs-E-Mail gesendet – bitte bestätigen.");
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

  return (
    <div style={{ minHeight: "100vh", background: "#07090f", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", ...base }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,#3b6fd4,#2a4fa0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, margin: "0 auto 14px" }}>🏛</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: "#fff", fontFamily: "'Playfair Display', serif" }}>PermitTrack</div>
          <div style={{ fontSize: 12, color: "#8898b2", marginTop: 4 }}>Baugenehmigungen einfach tracken</div>
        </div>
        <div style={{ background: "#0f1623", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 28 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {["login","signup"].map(m => (
              <button key={m} onClick={() => { setMode(m); setErr(""); setMsg(""); }}
                style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, ...base,
                  background: mode === m ? "rgba(59,111,212,0.25)" : "rgba(255,255,255,0.05)",
                  color: mode === m ? "#7ba3f5" : "#8898b2" }}>
                {m === "login" ? "Anmelden" : "Registrieren"}
              </button>
            ))}
          </div>
          {mode === "signup" && (
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Max Mustermann" style={inp()} />
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>E-Mail</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="name@buero.de" type="email" style={inp()} />
          </div>
          {mode !== "reset" && (
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Passwort</label>
              <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="••••••••" onKeyDown={e => e.key === "Enter" && handle()} style={inp()} />
            </div>
          )}
          {err && <div style={{ padding: "8px 12px", borderRadius: 8, background: "#2d0a0a", color: "#f87171", fontSize: 13, marginBottom: 12 }}>{err}</div>}
          {msg && <div style={{ padding: "8px 12px", borderRadius: 8, background: "#052e16", color: "#34d399", fontSize: 13, marginBottom: 12 }}>{msg}</div>}
          <button onClick={handle} disabled={loading}
            style={{ width: "100%", padding: "11px 0", borderRadius: 8, border: "none", cursor: loading ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, color: "#fff", ...base,
              background: loading ? "#1e3a5f" : "linear-gradient(135deg,#3b6fd4,#2a4fa0)" }}>
            {loading ? "Laden…" : mode === "login" ? "Anmelden" : mode === "signup" ? "Account erstellen" : "Link senden"}
          </button>
          {mode === "login" && (
            <button onClick={() => setMode("reset")} style={{ width: "100%", marginTop: 10, padding: "8px 0", background: "none", border: "none", color: "#8898b2", fontSize: 12, cursor: "pointer" }}>
              Passwort vergessen?
            </button>
          )}
        </div>
        <div style={{ textAlign: "center", marginTop: 14, fontSize: 11, color: "#1e293b" }}>🔒 Daten in Frankfurt (EU) · DSGVO-konform</div>
      </div>
    </div>
  );
}

// ── PROJECT DETAIL MODAL ───────────────────────────────────
function ProjectModal({ project, onClose, onUpdate }) {
  const [docs, setDocs]         = useState(project.dokumente || []);
  const [status, setStatus]     = useState(project.status);
  const [notiz, setNotiz]       = useState("");
  const [saving, setSaving]     = useState(false);
  const [showDoks, setShowDoks] = useState(false);

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
    await save({ notizen: nn });
  };

  const saveDoks = async (neueDoks) => {
    setDocs(neueDoks);
    setShowDoks(false);
    await save({ dokumente: neueDoks });
  };

  const ampel = getFristInfo(project.frist);
  const sm    = STATUS_META[status] || STATUS_META["Vorbereitung"];

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
        <div style={{ ...base, width: "100%", maxWidth: 580, maxHeight: "90vh", overflowY: "auto", borderRadius: 16, background: "#0f1623", border: "1px solid rgba(255,255,255,0.08)" }}>

          <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ margin: 0, color: "#fff", fontSize: 17, fontFamily: "'Playfair Display', serif" }}>{project.name}</h2>
                <p style={{ margin: "4px 0 0", color: "#8898b2", fontSize: 12 }}>{project.gemeinde} · {project.bauamt}</p>
                {project.kontakt && <p style={{ margin: "2px 0 0", color: "#8898b2", fontSize: 12 }}>📞 {project.kontakt}</p>}
              </div>
              <button onClick={onClose} style={{ fontSize: 22, color: "#8898b2", background: "none", border: "none", cursor: "pointer" }}>×</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, alignItems: "center" }}>
              <select value={status} onChange={e => { setStatus(e.target.value); save({ status: e.target.value }); }}
                style={{ fontSize: 12, padding: "4px 10px", borderRadius: 20, border: "none", cursor: "pointer", background: sm.bg, color: sm.text, ...base }}>
                {Object.keys(STATUS_META).map(s => <option key={s}>{s}</option>)}
              </select>
              {ampel && <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 20, background: ampel.bg, color: ampel.color }}>⏱ {ampel.label}</span>}
              {project.wiedervorlage && <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 20, background: "rgba(255,255,255,0.06)", color: "#8898b2" }}>Wiedervorlage: {project.wiedervorlage}</span>}
              {saving && <span style={{ fontSize: 11, color: "#8898b2" }}>Speichern…</span>}
            </div>
          </div>

          {/* Dokumente */}
          <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 3, color: "#8b9cb8" }}>
                Unterlagen ({docs.filter(d => d.status === "Eingereicht").length}/{docs.length})
              </div>
              <button onClick={() => setShowDoks(true)}
                style={{ fontSize: 11, padding: "4px 12px", borderRadius: 8, border: "1px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.1)", color: "#60a5fa", cursor: "pointer" }}>
                + Bearbeiten
              </button>
            </div>
            {docs.length === 0 && <p style={{ color: "#8b9cb8", fontSize: 13 }}>Noch keine Unterlagen – klicke auf „Bearbeiten".</p>}
            {docs.map((d, i) => {
              const ds = DOK_STYLE[d.status] || DOK_STYLE["Fehlend"];
              return (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", marginBottom: 5 }}>
                  <span style={{ color: "#e2e8f0", fontSize: 13 }}>{d.name}</span>
                  <button onClick={() => toggleDoc(i)} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 12, border: "none", cursor: "pointer", background: ds.bg, color: ds.color, ...base }}>{d.status}</button>
                </div>
              );
            })}
            {docs.length > 0 && <p style={{ fontSize: 11, color: "#8b9cb8", marginTop: 4 }}>↑ Klick auf Status zum Wechseln</p>}
          </div>

          {/* Notizen */}
          <div style={{ padding: "16px 24px" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 3, color: "#8b9cb8", marginBottom: 10 }}>Behördenkommunikation</div>
            {(project.notizen || []).length === 0 && <p style={{ color: "#8b9cb8", fontSize: 13, marginBottom: 10 }}>Noch keine Notizen.</p>}
            {(project.notizen || []).map((n, i) => (
              <div key={i} style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", marginBottom: 6 }}>
                <p style={{ margin: 0, color: "#e2e8f0", fontSize: 13 }}>{n.text}</p>
                <p style={{ margin: "4px 0 0", color: "#8898b2", fontSize: 11 }}>{n.datum}</p>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input value={notiz} onChange={e => setNotiz(e.target.value)} onKeyDown={e => e.key === "Enter" && addNotiz()} placeholder="Neue Notiz…"
                style={{ ...inp({ marginTop: 0 }), flex: 1 }} />
              <button onClick={addNotiz} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", color: "#fff", background: "linear-gradient(135deg,#3b6fd4,#2a4fa0)", fontWeight: 600 }}>+</button>
            </div>
          </div>
        </div>
      </div>
      {showDoks && <DokumenteModal vorhandene={docs} onSave={saveDoks} onClose={() => setShowDoks(false)} />}
    </>
  );
}

// ── NEW PROJECT MODAL ──────────────────────────────────────
function NewProjectModal({ onClose, onCreate }) {
  const [form, setForm]             = useState({ name: "", gemeinde: "", bauamt: "", kontakt: "", frist: "", wiedervorlage: "" });
  const [selectedDoks, setSelectedDoks] = useState(new Set());
  const [showDoks, setShowDoks]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [err, setErr]               = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handle = async () => {
    if (!form.name || !form.gemeinde) { setErr("Name und Gemeinde sind Pflichtfelder."); return; }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const dokumente = [...selectedDoks].map(name => ({ name, status: "Fehlend" }));
    const { data, error } = await supabase.from("projects").insert({
      user_id: user.id, ...form,
      frist: form.frist || null, wiedervorlage: form.wiedervorlage || null,
      status: "Vorbereitung", notizen: [], dokumente,
    }).select().single();
    if (error) { setErr(error.message); setLoading(false); return; }
    onCreate(data); onClose();
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
        <div style={{ ...base, width: "100%", maxWidth: 440, borderRadius: 16, padding: 24, background: "#0f1623", border: "1px solid rgba(255,255,255,0.08)", maxHeight: "90vh", overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ margin: 0, color: "#fff", fontSize: 16, fontFamily: "'Playfair Display', serif" }}>Neues Projekt</h2>
            <button onClick={onClose} style={{ fontSize: 22, color: "#8898b2", background: "none", border: "none", cursor: "pointer" }}>×</button>
          </div>
          {[["Projektname *","name","Wohnhaus Musterstraße 12"],["Gemeinde *","gemeinde","München"],["Bauamt","bauamt","Bauordnungsamt München"],["Kontakt","kontakt","Fr. Huber – 089/233-123"]].map(([l,k,ph]) => (
            <div key={k} style={{ marginBottom: 12 }}>
              <label style={lbl}>{l}</label>
              <input value={form[k]} onChange={e => set(k, e.target.value)} placeholder={ph} style={inp()} />
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            {[["Frist","frist"],["Wiedervorlage","wiedervorlage"]].map(([l,k]) => (
              <div key={k}>
                <label style={lbl}>{l}</label>
                <input type="date" value={form[k]} onChange={e => set(k, e.target.value)} style={inp({ colorScheme: "dark" })} />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Unterlagen</label>
            <button onClick={() => setShowDoks(true)}
              style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 8, border: "1px dashed rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.06)", color: selectedDoks.size > 0 ? "#60a5fa" : "#8898b2", cursor: "pointer", fontSize: 13, textAlign: "left" }}>
              {selectedDoks.size > 0 ? `✓  ${selectedDoks.size} Unterlagen ausgewählt` : "+ Unterlagen auswählen"}
            </button>
          </div>
          {err && <div style={{ padding: "8px 12px", borderRadius: 8, background: "#2d0a0a", color: "#f87171", fontSize: 13, marginBottom: 10 }}>{err}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(255,255,255,0.06)", color: "#8898b2" }}>Abbrechen</button>
            <button onClick={handle} disabled={loading} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer", background: "linear-gradient(135deg,#3b6fd4,#2a4fa0)", color: "#fff", fontWeight: 600 }}>
              {loading ? "Erstellen…" : "Erstellen"}
            </button>
          </div>
        </div>
      </div>
      {showDoks && (
        <DokumenteModal
          vorhandene={[...selectedDoks].map(n => ({ name: n, status: "Fehlend" }))}
          onSave={doks => { setSelectedDoks(new Set(doks.map(d => d.name))); setShowDoks(false); }}
          onClose={() => setShowDoks(false)}
        />
      )}
    </>
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

  if (!authReady) return <div style={{ minHeight: "100vh", background: "#07090f", display: "flex", alignItems: "center", justifyContent: "center", color: "#8898b2", ...base }}>Laden…</div>;
  if (!session)   return <AuthScreen />;

  const stats = {
    gesamt:    projects.length,
    laufend:   projects.filter(p => ["Vorbereitung","Eingereicht","Rückfrage Behörde"].includes(p.status)).length,
    genehmigt: projects.filter(p => p.status === "Genehmigt").length,
    kritisch:  projects.filter(p => getFristInfo(p.frist)?.label === "Überfällig").length,
  };

  const filtered = filter === "Alle" ? projects : projects.filter(p => p.status === filter);

  return (
    <div style={{ minHeight: "100vh", background: "#07090f", ...base }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#3b6fd4,#2a4fa0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🏛</div>
          <span style={{ fontSize: 17, fontWeight: 600, color: "#fff", fontFamily: "'Playfair Display', serif" }}>PermitTrack</span>
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "rgba(59,111,212,0.15)", color: "#7ba3f5" }}>Beta</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "#8898b2" }}>{session.user.email}</span>
          <button onClick={() => supabase.auth.signOut()} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "none", color: "#8898b2", cursor: "pointer" }}>Abmelden</button>
          <button onClick={() => setShowNew(true)} style={{ fontSize: 13, padding: "6px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#3b6fd4,#2a4fa0)", color: "#fff", cursor: "pointer", fontWeight: 500 }}>+ Neues Projekt</button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Projekte",   val: stats.gesamt,    color: "#7ba3f5" },
            { label: "Laufend",    val: stats.laufend,   color: "#7ba3f5" },
            { label: "Genehmigt",  val: stats.genehmigt, color: "#34d399" },
            { label: "Überfällig", val: stats.kritisch,  color: stats.kritisch > 0 ? "#ef4444" : "#34d399" },
          ].map(s => (
            <div key={s.label} style={{ padding: "16px 18px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "#8b9cb8", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 600, color: s.color, fontFamily: "'Playfair Display', serif" }}>{s.val}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {["Alle",...Object.keys(STATUS_META)].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ fontSize: 12, padding: "5px 14px", borderRadius: 20, cursor: "pointer",
                border: filter === f ? "1px solid rgba(59,111,212,0.4)" : "1px solid transparent",
                background: filter === f ? "rgba(59,111,212,0.25)" : "rgba(255,255,255,0.05)",
                color: filter === f ? "#7ba3f5" : "#8898b2" }}>
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#8b9cb8" }}>Projekte werden geladen…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#8b9cb8" }}>
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
              style={{ padding: "16px 18px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", marginBottom: 8 }}
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
                  <div style={{ fontSize: 12, color: "#8898b2", marginBottom: 10 }}>{p.gemeinde} · {p.bauamt || "–"}</div>
                  {docs.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 4, borderRadius: 4, background: "rgba(255,255,255,0.08)" }}>
                        <div style={{ height: 4, borderRadius: 4, width: `${prog}%`, background: prog === 100 ? "#34d399" : "linear-gradient(90deg,#3b6fd4,#7ba3f5)" }} />
                      </div>
                      <span style={{ fontSize: 11, color: "#8898b2", whiteSpace: "nowrap" }}>{einge}/{docs.length} Dok.</span>
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

      {selected && <ProjectModal project={selected} onClose={() => setSelected(null)} onUpdate={u => { setProjects(ps => ps.map(p => p.id === u.id ? u : p)); setSelected(u); }} />}
      {showNew   && <NewProjectModal onClose={() => setShowNew(false)} onCreate={p => setProjects(ps => [p, ...ps])} />}
    </div>
  );
}
