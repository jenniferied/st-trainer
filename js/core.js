// ============ Daten, Zustand, Engine, Sync ============

export const THEMEN = {
  "schultheorie-1":        { name: "Schultheorie I",   kurz: "ST I",  color: "var(--c-st1)", hex: "#2f5d9e" },
  "schultheorie-2":        { name: "Schultheorie II",  kurz: "ST II", color: "var(--c-st2)", hex: "#7a4f9e" },
  "schultheorie-3":        { name: "Schultheorie III", kurz: "ST III",color: "var(--c-st3)", hex: "#1e7d74" },
  "schulqualitaet":        { name: "Schulqualität",    kurz: "SQ",    color: "var(--c-sq)",  hex: "#b07f18" },
  "schulrecht":            { name: "Schulrecht",       kurz: "SR",    color: "var(--c-sr)",  hex: "#a83a4f" },
  "unterricht-motivierend":{ name: "Motivation",       kurz: "MOT",   color: "var(--c-um)",  hex: "#4e7d2e" },
};

export const QUELLEN_ORDNUNG = [
  ["pingo-2026", "Pingo SoSe 26"],
  ["pingo-2025", "Pingo 2025"],
  ["loesungen-2023", "Klausur 2023"],
  ["fragen-schultheorie", "Fragensammlung"],
  ["klausurfragen-wichtig", "Klausurfragen"],
  ["schultheorie-fragen", "Studocu-Fragen"],
  ["generiert", "KI-generiert"],
];
export const quelleLabel = (q) => (QUELLEN_ORDNUNG.find(([k]) => k === q) || [q, q])[1];
export const quelleRank = (q) => { const i = QUELLEN_ORDNUNG.findIndex(([k]) => k === q); return i < 0 ? 99 : i; };

// Farbabstufung für Unterthemen: Basis-Hex Richtung hell/dunkel mischen
export function subColor(thema, idx) {
  const base = (THEMEN[thema] || {}).hex || "#777";
  const pct = [0, 18, 34, 48, 60, 26, 42][idx % 7];
  return idx % 2 === 0
    ? `color-mix(in srgb, ${base} ${100 - pct}%, white)`
    : `color-mix(in srgb, ${base} ${100 - pct}%, #29241b)`;
}

// ---------- Daten laden ----------
let POOL = [];
export const pool = () => POOL;

export async function ladeFragen() {
  const res = await fetch("data/manifest.json");
  const manifest = await res.json();
  const teile = await Promise.all(
    manifest.dateien.map((f) => fetch("data/" + f).then((r) => r.json()).catch(() => []))
  );
  POOL = teile.flat().filter((q) => q && q.id && Array.isArray(q.optionen) && q.optionen.length > 1
    && q.relevanz !== "ausgeschlossen"); // Kant & Schulgeschichte: laut Rose komplett raus
  // Nur Fragen mit bekannter Lösung sind quizbar
  for (const q of POOL) {
    q.quizbar = q.optionen.every((o) => o.richtig === true || o.richtig === false)
      && q.optionen.some((o) => o.richtig === true);
    q.maxPunkte = q.punkte || q.optionen.filter((o) => o.richtig).length || 2;
    q.unterthema = q.unterthema || "allgemein";
  }
  return POOL;
}

export function unterthemen(thema) {
  const set = new Map();
  for (const q of POOL) if (q.oberthema === thema) set.set(q.unterthema, (set.get(q.unterthema) || 0) + 1);
  return [...set.entries()].sort((a, b) => b[1] - a[1]);
}

// ---------- Zustand (localStorage) ----------
const KEY = "st-trainer-v1";
const defState = () => ({ leitner: {}, sessions: [], offen: [], einzeln: [], pending: [], settings: { name: "", nta: true, scoring: window.ST_CONFIG.scoringVariante }, deviceId: "d-" + Math.random().toString(36).slice(2, 10) });
let S = null;
export function state() {
  if (!S) {
    try { S = { ...defState(), ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { S = defState(); }
    if (S.active) { S.offen = [...(S.offen || []), S.active]; delete S.active; } // Migration
  }
  return S;
}
export function save() { localStorage.setItem(KEY, JSON.stringify(S)); }

export function exportState() {
  const blob = new Blob([JSON.stringify(S, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `st-trainer-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}
export async function importState(file) {
  const txt = await file.text();
  S = { ...defState(), ...JSON.parse(txt) };
  save();
}

// ---------- Scoring ----------
export function scoreFrage(q, gewaehlt) {
  // Fix: strenge Variante (offizieller Klausurtext): +1 je richtigem, −0,5 je falschem Kreuz, floor 0
  const richtigGesetzt = gewaehlt.filter((i) => q.optionen[i].richtig).length;
  const falschGesetzt = gewaehlt.length - richtigGesetzt;
  const p = Math.max(0, Math.min(q.maxPunkte, richtigGesetzt * 1 - falschGesetzt * 0.5));
  const voll = richtigGesetzt === q.optionen.filter((o) => o.richtig).length && falschGesetzt === 0;
  return { punkte: p, voll, richtigGesetzt, falschGesetzt };
}

// ---------- Leitner ----------
// Level-Skala: −3 … +5. Voll richtig +1; teilweise −1; komplett falsch −2
// (positives Level fällt dabei direkt auf 0, darunter geht's ins Minus).
function leitnerApply(L, qid, ergebnis, ts) {
  const e = L[qid] || { lvl: 0, seen: 0, ok: 0, teils: 0, falsch: 0 };
  e.seen++;
  if (ergebnis.voll) { e.lvl = Math.min(5, e.lvl + 1); e.ok++; }
  else if (ergebnis.punkte > 0) { e.lvl = Math.max(-3, e.lvl - 1); e.teils++; }
  else { e.lvl = Math.max(-3, Math.min(e.lvl - 2, 0)); e.falsch++; }
  e.ts = ts;
  L[qid] = e;
}
export function leitnerUpdate(qid, ergebnis) { leitnerApply(state().leitner, qid, ergebnis, Date.now()); save(); }
export const lvl = (qid) => (state().leitner[qid] || {}).lvl || 0;
export const gemeistert = (qid) => lvl(qid) >= 3;

// Einzelantworten (Explore) lokal mitloggen, damit rebuildLeitner sie kennt
export function logEinzeln(qid, erg) {
  const st = state();
  (st.einzeln = st.einzeln || []).push({ qid, punkte: erg.punkte, voll: erg.voll, ts: Date.now() });
  save();
}

// Lernstand komplett neu aus allen Sessions + Einzelantworten aufbauen
// (chronologisch abgespielt) — nötig, wenn eine Session gelöscht wird.
export function rebuildLeitner() {
  const st = state();
  const antworten = [];
  for (const s of st.sessions) (s.proFrage || []).forEach((x, i) => antworten.push({ ts: s.ts, i, qid: x.qid, erg: x }));
  for (const e of st.einzeln || []) antworten.push({ ts: e.ts, i: 0, qid: e.qid, erg: e });
  antworten.sort((a, b) => a.ts - b.ts || a.i - b.i);
  st.leitner = {};
  for (const a of antworten) leitnerApply(st.leitner, a.qid, a.erg, a.ts);
  save();
}

export function loescheSession(id) {
  const st = state();
  st.sessions = st.sessions.filter((s) => s.id !== id);
  rebuildLeitner();
}

// Fortschritt immer getrennt nach Originalfragen (OG) und KI-generierten
export function splitFortschritt(qs) {
  const og = qs.filter((q) => q.quelle !== "generiert");
  const ki = qs.filter((q) => q.quelle === "generiert");
  const mo = og.filter((q) => gemeistert(q.id)).length;
  const mk = ki.filter((q) => gemeistert(q.id)).length;
  return {
    n: qs.length, m: mo + mk,
    pct: qs.length ? Math.round((100 * (mo + mk)) / qs.length) : 0,
    og: { m: mo, n: og.length }, ki: { m: mk, n: ki.length },
  };
}
export function themaFortschritt(thema) {
  return splitFortschritt(POOL.filter((q) => q.oberthema === thema && q.quizbar && q.relevanz !== "laut-rose-nicht-relevant"));
}
export function gesamtFortschritt() {
  return splitFortschritt(POOL.filter((q) => q.quizbar && q.relevanz !== "laut-rose-nicht-relevant"));
}
export function lernscore() {
  const qs = POOL.filter((q) => q.quizbar && q.relevanz !== "laut-rose-nicht-relevant");
  if (!qs.length) return 0;
  const sum = qs.reduce((a, q) => a + Math.max(0, Math.min(lvl(q.id), 3)) / 3, 0);
  return Math.round((100 * sum) / qs.length);
}
export function pruefungsStreak() {
  let n = 0;
  const sims = state().sessions.filter((s) => s.modus === "klausur" && s.fertig);
  for (let i = sims.length - 1; i >= 0; i--) { if (sims[i].bestanden) n++; else break; }
  return n;
}

// ---------- Runden bauen ----------
export function baueRunde(cfg) {
  let qs = POOL.filter((q) => q.quizbar);
  if (!cfg.inklNichtRelevant) qs = qs.filter((q) => q.relevanz !== "laut-rose-nicht-relevant");
  if (cfg.sprache) qs = qs.filter((q) => (q.sprache || "schwer") === cfg.sprache || !q.sprachVarianteVon);
  if (cfg.themen?.length) qs = qs.filter((q) => cfg.themen.includes(q.oberthema));
  if (cfg.unterthemen?.length) qs = qs.filter((q) => cfg.unterthemen.includes(q.oberthema + "/" + q.unterthema));
  if (cfg.nurFehler) qs = qs.filter((q) => { const e = state().leitner[q.id]; return e && e.seen > 0 && e.lvl < 3; });
  if (cfg.quellen?.length) qs = qs.filter((q) => cfg.quellen.includes(q.quelle));
  // Gewichtung: niedrige Leitner-Level zuerst wahrscheinlicher, negative am stärksten
  const gewicht = (q) => {
    const l = lvl(q.id);
    return (l < 0 ? 10 : [8, 5, 3, 2, 1, 1][l]) * (q.quelle?.startsWith("pingo") ? 1.4 : 1);
  };
  const gew = qs.map((q) => ({ q, w: gewicht(q) * (0.5 + Math.random()) }));
  gew.sort((a, b) => b.w - a.w);
  const n = Math.min(cfg.anzahl || 10, gew.length);
  const auswahl = gew.slice(0, n).map((x) => x.q);
  // Reihenfolge mischen + Optionsreihenfolge fixieren (gemischt)
  shuffle(auswahl);
  return auswahl.map((q) => ({ qid: q.id, optOrder: shuffle([...q.optionen.keys()]), gewaehlt: null }));
}
export function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const frage = (qid) => POOL.find((q) => q.id === qid);

export function timerMinuten(anzahl, modus) {
  const k = window.ST_CONFIG.klausur;
  if (modus === "nta") return Math.ceil((anzahl * k.minutenNTA) / k.fragen);
  if (modus === "normal") return Math.ceil((anzahl * k.minutenNormal) / k.fragen);
  return 0;
}

// ---------- Session-Abschluss + Auswertung ----------
// Eine Session entsteht beim Erstellen (Preset/Baukasten) und lebt in state().offen,
// bis sie fertig gewertet oder verworfen/abgebrochen wird.
export function erstelleSession(cfg) {
  const runde = baueRunde(cfg);
  if (!runde.length) return null;
  const sess = {
    id: "s-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    erstellt: Date.now(), cfg, runde, idx: 0, restSek: null, dauerSek: 0,
  };
  state().offen.push(sess); save();
  return sess;
}
export function verwerfeOffene(id) { const st = state(); st.offen = st.offen.filter((s) => s.id !== id); save(); }

export function werteAus(runde, meta) {
  const proFrage = runde.filter((r) => r.gewaehlt).map((r) => {
    const q = frage(r.qid);
    const erg = scoreFrage(q, r.gewaehlt);
    return { qid: r.qid, gewaehlt: r.gewaehlt, ...erg, zeit: r.zeitSek ?? null, max: q.maxPunkte, thema: q.oberthema, unterthema: q.unterthema, fragetyp: q.fragetyp, paar: q.verwechslungspaar };
  });
  const punkte = proFrage.reduce((a, x) => a + x.punkte, 0);
  const max = runde.map((r) => frage(r.qid).maxPunkte).reduce((a, b) => a + b, 0);
  const bestehenBei = meta.modus === "klausur" ? window.ST_CONFIG.klausur.bestehen : Math.ceil(max * 0.5);
  const session = {
    id: meta.sessionId || "s-" + Date.now(), ts: Date.now(), erstellt: meta.erstellt || Date.now(),
    fertig: true, status: meta.status || "fertig",
    modus: meta.modus, timerModus: meta.timerModus, dauerSek: meta.dauerSek, sprache: meta.sprache || "schwer",
    anzahl: runde.length, beantwortet: proFrage.length,
    punkte: Math.round(punkte * 2) / 2, max, bestehenBei, bestanden: meta.status !== "abgebrochen" && punkte >= bestehenBei,
    proFrage,
  };
  state().sessions.push(session);
  for (const x of proFrage) leitnerUpdate(x.qid, x);
  save();
  syncSession(session);
  return session;
}

export function insights(session) {
  const out = [];
  const byTyp = gruppiere(session.proFrage, (x) => x.fragetyp || "positiv");
  const acc = (arr) => arr.reduce((a, x) => a + x.punkte / x.max, 0) / arr.length;
  if (byTyp.negation?.length >= 2 && byTyp.positiv?.length >= 2 && acc(byTyp.negation) < acc(byTyp.positiv) - 0.15)
    out.push("NICHT-Fragen kosten dich überdurchschnittlich Punkte. Tipp: Bei ‚NICHT' erst alle richtigen Aussagen markieren, dann umdrehen.");
  const paare = gruppiere(session.proFrage.filter((x) => x.punkte < x.max && x.paar), (x) => x.paar);
  for (const [p, arr] of Object.entries(paare)) if (arr.length >= 2) out.push(`Verwechslungsgefahr bei: ${p} — hier lohnt gezieltes Differenzieren.`);
  const themen = gruppiere(session.proFrage, (x) => x.thema);
  const schwach = Object.entries(themen).filter(([, arr]) => arr.length >= 3 && acc(arr) < 0.5).map(([t]) => THEMEN[t]?.name || t);
  if (schwach.length) out.push("Schwächste Themen in dieser Runde: " + schwach.join(", ") + ".");
  return out;
}
export function gruppiere(arr, fn) { const o = {}; for (const x of arr) { const k = fn(x); if (k == null) continue; (o[k] = o[k] || []).push(x); } return o; }

// ---------- Supabase-Sync (Dual-Write, offline-tolerant) ----------
function supaHeaders() {
  const c = window.ST_CONFIG;
  return { apikey: c.supabaseAnonKey, Authorization: "Bearer " + c.supabaseAnonKey, "Content-Type": "application/json", Prefer: "return=minimal" };
}
export function supaAktiv() { const c = window.ST_CONFIG; return !!(c.supabaseUrl && c.supabaseAnonKey); }

export function syncEvent(ev) {
  state().pending.push({ tabelle: "events", zeile: { ...ev, device_id: state().deviceId, nutzer: state().settings.name || "anon" } });
  save(); flushSync();
}
export function syncSession(s) {
  state().pending.push({ tabelle: "sessions", zeile: {
    session_id: s.id, ts: new Date(s.ts).toISOString(), modus: s.modus, timer_modus: s.timerModus,
    dauer_sek: s.dauerSek, anzahl: s.anzahl, punkte: s.punkte, max_punkte: s.max, bestanden: s.bestanden,
    sprache: s.sprache, device_id: state().deviceId, nutzer: state().settings.name || "anon",
    detail: { status: s.status, proFrage: s.proFrage },
  } });
  save(); flushSync();
}
let flushLauft = false;
export async function flushSync() {
  if (!supaAktiv() || flushLauft || !state().pending.length) return;
  flushLauft = true;
  try {
    while (state().pending.length) {
      const item = state().pending[0];
      const r = await fetch(`${window.ST_CONFIG.supabaseUrl}/rest/v1/${item.tabelle}`, { method: "POST", headers: supaHeaders(), body: JSON.stringify(item.zeile) });
      if (!r.ok && r.status !== 409) break; // 409 = Duplikat, überspringen
      state().pending.shift(); save();
    }
  } catch { /* offline — bleibt in der Queue */ }
  flushLauft = false;
}
if (typeof window !== "undefined") window.addEventListener("online", () => flushSync());
