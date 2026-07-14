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
const defState = () => ({ leitner: {}, sessions: [], offen: [], antwortLog: [], pending: [], settings: { name: "", nta: true, scoring: window.ST_CONFIG.scoringVariante }, deviceId: "d-" + Math.random().toString(36).slice(2, 10) });
let S = null;
export function state() {
  if (!S) {
    try { S = { ...defState(), ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { S = defState(); }
    if (S.active) { S.offen = [...(S.offen || []), S.active]; delete S.active; } // Migration
    // Migration: zentrales Antwort-Log aus Alt-Daten (Sessions + Explore-Einzelantworten) aufbauen
    if (!S.antwortLog.length && (S.sessions.length || S.einzeln?.length)) {
      for (const s of S.sessions) (s.proFrage || []).forEach((x, i) =>
        S.antwortLog.push({ ts: (s.ts || 0) + i, qid: x.qid, sid: s.id, modus: s.modus, gewaehlt: x.gewaehlt, punkte: x.punkte, max: x.max, voll: x.voll, zeit: x.zeit ?? null }));
      for (const e of S.einzeln || [])
        S.antwortLog.push({ ts: e.ts, qid: e.qid, sid: null, modus: "explore", gewaehlt: null, punkte: e.punkte, max: null, voll: e.voll, zeit: null });
      S.antwortLog.sort((a, b) => a.ts - b.ts);
    }
    delete S.einzeln;
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

// Zentrales Antwort-Log: JEDE beantwortete Frage landet hier —
// { ts, qid, sid (Session-Id oder null), modus, gewaehlt, punkte, max, voll, zeit }
export function logAntwort(a) {
  const st = state();
  st.antwortLog.push({ sid: null, gewaehlt: null, max: null, zeit: null, ...a, ts: a.ts ?? Date.now() });
  save();
}

// Lernstand komplett neu aus dem Antwort-Log aufbauen (chronologisch
// abgespielt) — nötig, wenn eine Session gelöscht wird.
export function rebuildLeitner() {
  const st = state();
  st.leitner = {};
  for (const a of [...st.antwortLog].sort((x, y) => x.ts - y.ts)) leitnerApply(st.leitner, a.qid, a, a.ts);
  save();
}

export function loescheSession(id) {
  const st = state();
  st.sessions = st.sessions.filter((s) => s.id !== id);
  st.antwortLog = st.antwortLog.filter((a) => a.sid !== id);
  rebuildLeitner();
}

// Fertige/abgebrochene Session aus dem Verlauf wieder öffnen: alte Wertung
// zurückrechnen (wie beim Löschen), Session mit den bisherigen Antworten
// zurück zu den offenen. Beim Abschluss wird alles neu gewertet & geloggt.
export function reaktiviereSession(id) {
  const st = state();
  const s = st.sessions.find((x) => x.id === id);
  if (!s?.runde) return null; // ältere Sessions ohne Fragen-Snapshot
  st.sessions = st.sessions.filter((x) => x.id !== id);
  st.antwortLog = st.antwortLog.filter((a) => a.sid !== id);
  rebuildLeitner();
  const runde = s.runde.filter((r) => frage(r.qid)).map((r) => ({
    qid: r.qid,
    optOrder: r.optOrder || shuffle([...frage(r.qid).optionen.keys()]),
    gewaehlt: r.gewaehlt || null,
    zeitSek: r.zeitSek ?? null,
  }));
  const cfg = { pausierbar: true, feedback: ["klausur", "halbe"].includes(s.modus) ? "ende" : "sofort", modus: s.modus, timerModus: s.timerModus, ...(s.cfg || {}) };
  let restSek = null;
  if (cfg.timerModus && cfg.timerModus !== "aus") {
    restSek = Math.max(0, timerMinuten(runde.length, cfg.timerModus) * 60 - (s.dauerSek || 0));
    if (restSek < 60) { cfg.timerModus = "aus"; restSek = null; } // Zeit war um → ohne Zeitdruck zu Ende
  }
  const erste = runde.findIndex((r) => !r.gewaehlt);
  const sess = { id: s.id, erstellt: s.erstellt, cfg, runde, idx: erste < 0 ? 0 : erste, restSek, dauerSek: s.dauerSek || 0 };
  st.offen.push(sess); save();
  return sess;
}

// ---------- Statistiken ----------
const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
export function frageStats(qid) {
  const log = state().antwortLog.filter((a) => a.qid === qid);
  if (!log.length) return null;
  const quoten = log.filter((a) => a.max).map((a) => a.punkte / a.max);
  const zeit = avg(log.map((a) => a.zeit).filter((z) => z != null));
  return {
    n: log.length,
    voll: log.filter((a) => a.voll).length,
    quote: quoten.length ? Math.round(100 * avg(quoten)) : null,
    zeit: zeit != null ? Math.round(zeit) : null,
    letzte: log.slice(-5).reverse(),
  };
}
export function statistik() {
  const st = state();
  const log = st.antwortLog;
  const mitMax = log.filter((a) => a.max);
  const zeit = avg(log.map((a) => a.zeit).filter((z) => z != null));
  const themen = {};
  for (const a of log) {
    const q = frage(a.qid); if (!q) continue;
    const t = (themen[q.oberthema] = themen[q.oberthema] || { n: 0, quoten: [], zeiten: [] });
    t.n++;
    if (a.max) t.quoten.push(a.punkte / a.max);
    if (a.zeit != null) t.zeiten.push(a.zeit);
  }
  const proThema = Object.entries(themen).map(([slug, t]) => ({
    slug, n: t.n,
    quote: t.quoten.length ? Math.round(100 * avg(t.quoten)) : null,
    zeit: t.zeiten.length ? Math.round(avg(t.zeiten)) : null,
  })).sort((a, b) => b.n - a.n);
  const tage14 = [];
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  for (let i = 13; i >= 0; i--) {
    const von = heute.getTime() - i * 86400000;
    tage14.push({ ts: von, n: log.filter((a) => a.ts >= von && a.ts < von + 86400000).length });
  }
  return {
    beantwortet: log.length,
    punkteQuote: mitMax.length ? Math.round(100 * avg(mitMax.map((a) => a.punkte / a.max))) : null,
    vollQuote: log.length ? Math.round((100 * log.filter((a) => a.voll).length) / log.length) : null,
    avgZeit: zeit != null ? Math.round(zeit) : null,
    uebungsTage: new Set(log.map((a) => new Date(a.ts).toDateString())).size,
    sessions: st.sessions.length,
    proThema, tage14,
  };
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
// Einfache-Sprache-Varianten zählen nicht doppelt in Fortschritt/Lernscore (sie vertreten ihr Original)
const zaehlt = (q) => q.quizbar && q.relevanz !== "laut-rose-nicht-relevant" && (q.sprache || "schwer") !== "einfach";
export function themaFortschritt(thema) {
  return splitFortschritt(POOL.filter((q) => q.oberthema === thema && zaehlt(q)));
}
export function gesamtFortschritt() {
  return splitFortschritt(POOL.filter(zaehlt));
}
export function lernscore() {
  const qs = POOL.filter(zaehlt);
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
  // Sprache: bei "einfach" ersetzt die einfache Variante ihr schweres Original (Fallback: Original,
  // wenn keine Variante existiert); Standard "schwer" blendet einfache Varianten aus
  if (cfg.sprache === "einfach") {
    const hatEinfach = new Set(POOL.filter((q) => q.sprache === "einfach" && q.sprachVarianteVon).map((q) => q.sprachVarianteVon));
    qs = qs.filter((q) => q.sprache === "einfach" || !hatEinfach.has(q.id));
  } else {
    qs = qs.filter((q) => (q.sprache || "schwer") !== "einfach");
  }
  if (cfg.themen?.length) qs = qs.filter((q) => cfg.themen.includes(q.oberthema));
  if (cfg.unterthemen?.length) qs = qs.filter((q) => cfg.unterthemen.includes(q.oberthema + "/" + q.unterthema));
  if (cfg.nurFehler) qs = qs.filter((q) => { const e = state().leitner[q.id]; return e && e.seen > 0 && e.lvl < 3; });
  if (cfg.quellen?.length) qs = qs.filter((q) => cfg.quellen.includes(q.quelle));
  // Spaced Repetition: fällige Wiederholungen zuerst (wackligste und am längsten
  // überfällige vorn), dann neue Fragen, zuletzt Bald-Fälliges als Auffüller
  if (cfg.spaced) {
    const SR_TAGE = [0, 1, 2, 4, 6, 9]; // Soll-Abstand in Tagen je Level 0-5; Level < 0 = sofort fällig
    const L = state().leitner;
    const jetzt = Date.now();
    const neu = [], faellig = [], bald = [];
    for (const q of qs) {
      const e = L[q.id];
      if (!e || !e.seen) { neu.push({ q }); continue; }
      const ueber = (jetzt - (e.ts || 0)) / 86400000 - SR_TAGE[Math.max(0, Math.min(5, e.lvl))];
      (ueber >= 0 ? faellig : bald).push({ q, ueber, lvl: e.lvl });
    }
    faellig.sort((a, b) => a.lvl - b.lvl || b.ueber - a.ueber);
    bald.sort((a, b) => b.ueber - a.ueber); // am nächsten an der Fälligkeit zuerst
    shuffle(neu);
    const grp = (q) => q.sprachVarianteVon || q.variantenVon || q.id;
    const nMax = Math.min(cfg.anzahl || 15, qs.length);
    const auswahl = []; const belegt = new Set();
    const nimm = (arr, limit) => {
      for (const x of arr) {
        if (auswahl.length >= limit) return;
        const g = grp(x.q);
        if (!belegt.has(g)) { belegt.add(g); auswahl.push(x.q); }
      }
    };
    nimm(faellig, Math.ceil(nMax * 0.7)); // max ~70% Wiederholung, damit immer Neues dabei ist
    nimm(neu, nMax);
    nimm(faellig, nMax);
    nimm(bald, nMax);
    shuffle(auswahl);
    return auswahl.map((q) => ({ qid: q.id, optOrder: shuffle([...q.optionen.keys()]), gewaehlt: null }));
  }
  // Gewichtung: niedrige Leitner-Level zuerst wahrscheinlicher, negative am stärksten
  const gewicht = (q) => {
    const l = lvl(q.id);
    return (l < 0 ? 10 : [8, 5, 3, 2, 1, 1][l]) * (q.quelle?.startsWith("pingo") ? 1.4 : 1);
  };
  const gew = qs.map((q) => ({ q, w: gewicht(q) * (0.5 + Math.random()) }));
  gew.sort((a, b) => b.w - a.w);
  // Keine zwei Varianten derselben Frage in einer Runde (variantenVon/sprachVarianteVon-Gruppe)
  const gruppe = (q) => q.sprachVarianteVon || q.variantenVon || q.id;
  const n = Math.min(cfg.anzahl || 10, gew.length);
  const auswahl = []; const belegt = new Set();
  for (const { q } of gew) {
    if (auswahl.length >= n) break;
    const g = gruppe(q);
    if (belegt.has(g)) continue;
    belegt.add(g); auswahl.push(q);
  }
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
    // Snapshot für "Fortsetzen" aus dem Verlauf (auch unbeantwortete Fragen)
    cfg: meta.cfg || null,
    runde: runde.map((r) => ({ qid: r.qid, optOrder: r.optOrder, gewaehlt: r.gewaehlt || null, zeitSek: r.zeitSek ?? null })),
  };
  state().sessions.push(session);
  proFrage.forEach((x, i) => logAntwort({ ts: session.ts + i, qid: x.qid, sid: session.id, modus: session.modus, gewaehlt: x.gewaehlt, punkte: x.punkte, max: x.max, voll: x.voll, zeit: x.zeit }));
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
