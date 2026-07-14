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
  POOL = teile.flat().filter((q) => q && q.id && Array.isArray(q.optionen) && q.optionen.length > 1);
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
const defState = () => ({ leitner: {}, sessions: [], pending: [], settings: { name: "", nta: true, scoring: window.ST_CONFIG.scoringVariante }, active: null, deviceId: "d-" + Math.random().toString(36).slice(2, 10) });
let S = null;
export function state() {
  if (!S) { try { S = { ...defState(), ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { S = defState(); } }
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
  const richtigGesetzt = gewaehlt.filter((i) => q.optionen[i].richtig).length;
  const falschGesetzt = gewaehlt.length - richtigGesetzt;
  let p;
  if ((state().settings.scoring || "streng") === "milde") {
    p = richtigGesetzt > 0 ? q.maxPunkte - 0.5 * falschGesetzt : 0;
  } else {
    p = richtigGesetzt * 1 - falschGesetzt * 0.5;
  }
  p = Math.max(0, Math.min(q.maxPunkte, p));
  const voll = richtigGesetzt === q.optionen.filter((o) => o.richtig).length && falschGesetzt === 0;
  return { punkte: p, voll, richtigGesetzt, falschGesetzt };
}

// ---------- Leitner ----------
export function leitnerUpdate(qid, ergebnis) {
  const L = state().leitner;
  const e = L[qid] || { lvl: 0, seen: 0, ok: 0, teils: 0, falsch: 0 };
  e.seen++;
  if (ergebnis.voll) { e.lvl = Math.min(5, e.lvl + 1); e.ok++; }
  else if (ergebnis.punkte > 0) { e.lvl = Math.max(0, e.lvl - 1); e.teils++; }
  else { e.lvl = 0; e.falsch++; }
  e.ts = Date.now();
  L[qid] = e; save();
}
export const lvl = (qid) => (state().leitner[qid] || {}).lvl || 0;
export const gemeistert = (qid) => lvl(qid) >= 3;

export function themaFortschritt(thema) {
  const qs = POOL.filter((q) => q.oberthema === thema && q.quizbar && q.relevanz !== "laut-rose-nicht-relevant");
  if (!qs.length) return { pct: 0, n: 0, m: 0 };
  const m = qs.filter((q) => gemeistert(q.id)).length;
  return { pct: Math.round((100 * m) / qs.length), n: qs.length, m };
}
export function lernscore() {
  const qs = POOL.filter((q) => q.quizbar && q.relevanz !== "laut-rose-nicht-relevant");
  if (!qs.length) return 0;
  const sum = qs.reduce((a, q) => a + Math.min(lvl(q.id), 3) / 3, 0);
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
  // Gewichtung: niedrige Leitner-Level zuerst wahrscheinlicher
  const gewicht = (q) => [8, 5, 3, 2, 1, 1][lvl(q.id)] * (q.quelle?.startsWith("pingo") ? 1.4 : 1);
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
export function werteAus(runde, meta) {
  const proFrage = runde.filter((r) => r.gewaehlt).map((r) => {
    const q = frage(r.qid);
    const erg = scoreFrage(q, r.gewaehlt);
    return { qid: r.qid, gewaehlt: r.gewaehlt, ...erg, max: q.maxPunkte, thema: q.oberthema, unterthema: q.unterthema, fragetyp: q.fragetyp, paar: q.verwechslungspaar };
  });
  const punkte = proFrage.reduce((a, x) => a + x.punkte, 0);
  const max = runde.map((r) => frage(r.qid).maxPunkte).reduce((a, b) => a + b, 0);
  const bestehenBei = meta.modus === "klausur" ? window.ST_CONFIG.klausur.bestehen : Math.ceil(max * 0.5);
  const session = {
    id: "s-" + Date.now(), ts: Date.now(), fertig: true,
    modus: meta.modus, timerModus: meta.timerModus, dauerSek: meta.dauerSek, sprache: meta.sprache || "schwer",
    anzahl: runde.length, beantwortet: proFrage.length,
    punkte: Math.round(punkte * 2) / 2, max, bestehenBei, bestanden: punkte >= bestehenBei,
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
    detail: s.proFrage,
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
