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
// (Mix-Ziele als CSS-Variablen, damit Night Mode passende Ziele setzen kann)
export function subColor(thema, idx) {
  const base = (THEMEN[thema] || {}).hex || "#777";
  const pct = [0, 18, 34, 48, 60, 26, 42][idx % 7];
  return idx % 2 === 0
    ? `color-mix(in srgb, ${base} ${100 - pct}%, var(--mix-hell, white))`
    : `color-mix(in srgb, ${base} ${100 - pct}%, var(--mix-dunkel, #29241b))`;
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
const defState = () => ({ leitner: {}, sessions: [], offen: [], antwortLog: [], pending: [], geloescht: [], settings: { name: "", nta: true, theme: "auto", scoring: window.ST_CONFIG.scoringVariante }, deviceId: "d-" + Math.random().toString(36).slice(2, 10) });
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
    for (const a of S.antwortLog) if (!a.aid) a.aid = antwortId(a); // Sync-Schluessel nachtragen
  }
  return S;
}
// Stabiler Schluessel je Antwort: dieselbe Antwort ergibt auf jedem Geraet dieselbe
// aid, damit der Merge nicht dupliziert. ts ist pro Antwort eindeutig (werteAus zaehlt hoch).
const antwortId = (a) => `${a.ts}-${a.qid}`;
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
  for (const a of S.antwortLog) if (!a.aid) a.aid = antwortId(a); // Sync-Schluessel fuer Alt-Backups
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
  const e = { sid: null, gewaehlt: null, max: null, zeit: null, ...a, ts: a.ts ?? Date.now() };
  e.aid = e.aid || antwortId(e);
  st.antwortLog.push(e);
  save();
  syncBald(); // Explore-Antworten gebuendelt hochschieben
}

// Lernstand komplett neu aus dem Antwort-Log aufbauen (chronologisch
// abgespielt) — nötig, wenn eine Session gelöscht wird.
export function rebuildLeitner() {
  const st = state();
  st.leitner = {};
  for (const a of [...st.antwortLog].sort((x, y) => x.ts - y.ts)) leitnerApply(st.leitner, a.qid, a, a.ts);
  save();
}

// Loeschen muss den anderen Geraeten mitgeteilt werden — sonst holt der Merge
// die Session beim naechsten Sync wieder zurueck. Darum Grabstein-Liste.
export function loescheSession(id) {
  const st = state();
  st.sessions = st.sessions.filter((s) => s.id !== id);
  st.antwortLog = st.antwortLog.filter((a) => a.sid !== id);
  if (!st.geloescht.includes(id)) st.geloescht.push(id);
  rebuildLeitner();
  syncLernstand();
}

// Einzelantworten (Stöbern) löschen: die aids wandern als Grabsteine in die
// geloescht-Liste, sonst holt der Merge sie vom nächsten Gerät zurück.
export function loescheEinzel(aids) {
  const st = state();
  const weg = new Set(aids);
  st.antwortLog = st.antwortLog.filter((a) => a.sid || !weg.has(a.aid || antwortId(a)));
  for (const aid of aids) if (!st.geloescht.includes(aid)) st.geloescht.push(aid);
  rebuildLeitner();
  syncLernstand();
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
  if (!st.geloescht.includes(id)) st.geloescht.push(id); // alte Wertung ist ueberall weg
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
  // Neue Id: die alte traegt jetzt einen Grabstein und darf nicht wiederverwendet werden
  const sess = { id: neueId(), erstellt: s.erstellt, cfg, runde, idx: erste < 0 ? 0 : erste, restSek, dauerSek: s.dauerSek || 0 };
  st.offen.push(sess); save();
  syncLernstand();
  return sess;
}
const neueId = () => "s-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);

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
// Ein echter Versuch braucht Lesezeit. Unter 3s (z.B. schnelles Durchtippen im
// Explore) zaehlt fuer Aktivitaet, aber NICHT fuer Qualitaetszahlen (Quote, Zeit,
// Staerken/Schwaechen) — sonst verfaelschen Schnelltaps die Diagnose.
const plausibel = (a) => a.zeit == null || a.zeit >= 3;

// antwortLog -> angereicherte Zeilen (mit Thema/Unterthema aus dem Korpus)
function logZeilen() {
  const out = [];
  for (const a of state().antwortLog) {
    const q = frage(a.qid); if (!q) continue;
    out.push({ qid: a.qid, punkte: a.punkte, max: a.max, voll: a.voll, zeit: a.zeit,
      thema: q.oberthema, unter: q.unterthema, fragetyp: q.fragetyp, paar: q.verwechslungspaar,
      plaus: plausibel(a) });
  }
  return out;
}

// Kern-Auswertung: aus Antwort-Zeilen Staerken, Schwaechen (nach Hebel = Luecke ×
// Anzahl), Verwechslungen und Tempo ableiten. Wird von der globalen Statistik UND
// der Sitzungs-Auswertung genutzt. Nur belastbare Gruppen werden gelabelt:
// Thema ab THEME_MIN Antworten, Unterthema ab SUB_MIN.
const THEME_MIN = 4, SUB_MIN = 3;
export function bewerteRows(input) {
  // Tolerant gegenueber Sitzungs-Zeilen (proFrage nutzt `unterthema`, hat kein `plaus`).
  const rows = input.map((r) => ({ ...r, unter: r.unter ?? r.unterthema,
    plaus: r.plaus !== undefined ? r.plaus : plausibel(r) }));
  const qual = rows.filter((r) => r.plaus && r.max);
  const zAll = avg(qual.map((r) => r.zeit).filter((z) => z != null));
  const grp = (keyFn) => {
    const o = {};
    for (const r of qual) { const k = keyFn(r); if (k == null) continue; (o[k] = o[k] || []).push(r); }
    return o;
  };
  const stat = (arr) => {
    const zt = arr.map((r) => r.zeit).filter((z) => z != null);
    return { n: arr.length, quote: Math.round(100 * avg(arr.map((r) => r.punkte / r.max))),
      pkt: +avg(arr.map((r) => r.punkte)).toFixed(1), maxSchnitt: +avg(arr.map((r) => r.max)).toFixed(1),
      zeit: zt.length ? Math.round(avg(zt)) : null };
  };
  const themen = grp((r) => r.thema);
  const belastbar = Object.entries(themen).filter(([, a]) => a.length >= THEME_MIN)
    .map(([thema, a]) => ({ thema, ...stat(a) }));
  const staerken = belastbar.filter((x) => x.quote >= 80).sort((a, b) => b.quote - a.quote);
  const schwaechen = belastbar.filter((x) => x.quote < 55)
    .map((x) => ({ ...x, tempo: x.zeit != null && zAll != null && x.zeit < 0.55 * zAll,
      // schwaechstes belastbares Unterthema im Thema (fuer den konkreten Fokus)
      brennpunkt: (() => {
        const subs = Object.entries(grp((r) => r.thema === x.thema ? r.unter : null))
          .filter(([, a]) => a.length >= SUB_MIN).map(([u, a]) => ({ u, ...stat(a) }))
          .sort((p, q) => p.quote - q.quote);
        return subs.length && subs[0].quote < 60 ? subs[0] : null;
      })() }))
    .sort((a, b) => (1 - b.quote / 100) * b.n - (1 - a.quote / 100) * a.n);
  const verw = Object.entries(grp((r) => (r.punkte < r.max && r.paar) ? r.paar : null))
    .filter(([, a]) => a.length >= 2).map(([paar, a]) => ({ paar, n: a.length }));
  return { staerken, schwaechen, verwechslung: verw, overallQuote: qual.length ? Math.round(100 * avg(qual.map((r) => r.punkte / r.max))) : null, nQual: qual.length };
}

// Verlauf der abgeschlossenen Sitzungen -> Trend der Punktequote ueber die Zeit.
export function trend() {
  const ses = state().sessions.filter((s) => s.status !== "abgebrochen" && s.max)
    .map((s) => ({ ts: s.ts, modus: s.modus, punkte: s.punkte, max: s.max,
      quote: Math.round(100 * s.punkte / s.max), bestanden: s.bestanden }))
    .sort((a, b) => a.ts - b.ts);
  if (ses.length < 2) return { proSession: ses, genug: false };
  const letzte = ses[ses.length - 1].quote;
  const vorher = Math.round(avg(ses.slice(0, -1).map((s) => s.quote)));
  const delta = letzte - vorher;
  return { proSession: ses, genug: true, delta,
    richtung: delta >= 6 ? "hoch" : delta <= -6 ? "runter" : "stabil" };
}

export function statistik() {
  const st = state();
  const log = st.antwortLog;
  const rows = logZeilen();
  const qual = rows.filter((r) => r.plaus && r.max);
  const zeit = avg(qual.map((r) => r.zeit).filter((z) => z != null));
  const themen = {};
  for (const r of qual) {
    const t = (themen[r.thema] = themen[r.thema] || { n: 0, quoten: [], zeiten: [], pkt: [], mx: [], subs: {} });
    t.n++; t.quoten.push(r.punkte / r.max); t.pkt.push(r.punkte); t.mx.push(r.max);
    if (r.zeit != null) t.zeiten.push(r.zeit);
    const s = (t.subs[r.unter] = t.subs[r.unter] || { n: 0, quoten: [], zeiten: [], pkt: [], mx: [] });
    s.n++; s.quoten.push(r.punkte / r.max); s.pkt.push(r.punkte); s.mx.push(r.max);
    if (r.zeit != null) s.zeiten.push(r.zeit);
  }
  const meister = (thema, unter) => {
    let m = 0, tot = 0;
    for (const q of POOL) if (q.oberthema === thema && (unter == null || q.unterthema === unter) && zaehlt(q)) { tot++; if (gemeistert(q.id)) m++; }
    return { m, tot };
  };
  const mkSub = (thema, u, s) => ({ u, n: s.n,
    quote: Math.round(100 * avg(s.quoten)), pkt: +avg(s.pkt).toFixed(1), maxSchnitt: +avg(s.mx).toFixed(1),
    zeit: s.zeiten.length ? Math.round(avg(s.zeiten)) : null, ...meister(thema, u) });
  const proThema = Object.entries(themen).map(([slug, t]) => ({
    slug, n: t.n,
    quote: t.quoten.length ? Math.round(100 * avg(t.quoten)) : null,
    pkt: +avg(t.pkt).toFixed(1), maxSchnitt: +avg(t.mx).toFixed(1),
    zeit: t.zeiten.length ? Math.round(avg(t.zeiten)) : null,
    ...meister(slug, null),
    unterthemen: Object.entries(t.subs).map(([u, s]) => mkSub(slug, u, s)).sort((a, b) => b.n - a.n),
  })).sort((a, b) => b.n - a.n);
  const tage14 = [];
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  for (let i = 13; i >= 0; i--) {
    const von = heute.getTime() - i * 86400000;
    tage14.push({ ts: von, n: log.filter((a) => a.ts >= von && a.ts < von + 86400000).length });
  }
  return {
    beantwortet: log.length,
    nQual: qual.length,
    punkteQuote: qual.length ? Math.round(100 * avg(qual.map((r) => r.punkte / r.max))) : null,
    vollQuote: qual.length ? Math.round((100 * qual.filter((r) => r.voll).length) / qual.length) : null,
    avgZeit: zeit != null ? Math.round(zeit) : null,
    uebungsTage: new Set(log.map((a) => new Date(a.ts).toDateString())).size,
    sessions: st.sessions.length,
    proThema, tage14,
    analyse: bewerteRows(rows),
    trend: trend(),
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
  // Auswahl-Strategie: wie wird aus dem gefilterten Pool die Runde gebaut?
  //   smart   = Spaced Repetition (Wackliges/Fälliges zuerst, dazu Neues) — die Wissenschaft
  //   fokus   = nur Ungelerntes & Schwieriges, das Härteste zuerst
  //   zufall  = rein zufällig, alle Fragen gleich wahrscheinlich
  //   klausur = repräsentativer Mix über alle Themen wie in der echten Klausur
  // Alt-Configs ohne `auswahl` werden aus den früheren Flags abgeleitet.
  const strat = cfg.auswahl || (cfg.spaced ? "smart" : cfg.nurFehler ? "fokus"
    : (cfg.modus === "klausur" || cfg.modus === "halbe") ? "klausur" : "smart");
  const nMax = Math.min(cfg.anzahl || 10, qs.length);
  // Nie zwei Varianten derselben Frage in einer Runde: pro Gruppe genau ein Vertreter
  const grp = (q) => q.sprachVarianteVon || q.variantenVon || q.id;
  const gruppen = new Map();
  for (const q of qs) { const g = grp(q); (gruppen.get(g) || gruppen.set(g, []).get(g)).push(q); }
  const reps = [...gruppen.values()].map((arr) => arr[Math.floor(Math.random() * arr.length)]);
  const auswahl = waehleFragen(reps, nMax, strat);
  shuffle(auswahl); // Anzeige-Reihenfolge mischen (auch bei Klausur-Mix wie im Ernstfall)
  return auswahl.map((q) => ({ qid: q.id, optOrder: shuffle([...q.optionen.keys()]), gewaehlt: null }));
}

// Strategien der Fragen-Auswahl. reps = ein Vertreter je Varianten-Gruppe.
function waehleFragen(reps, n, strat) {
  n = Math.min(n, reps.length);
  const L = state().leitner;
  if (strat === "zufall") return shuffle([...reps]).slice(0, n);

  if (strat === "klausur") {
    // Stratifiziert nach Oberthema, proportional zur Poolgröße (Largest Remainder),
    // zufällig innerhalb der Themen — deckt alle Themen ab wie die echte Klausur.
    const byTh = {};
    for (const q of reps) (byTh[q.oberthema] = byTh[q.oberthema] || []).push(q);
    const soll = Object.keys(byTh).map((t) => ({ t, exakt: (n * byTh[t].length) / reps.length }));
    soll.forEach((s) => { s.base = Math.floor(s.exakt); s.rest = s.exakt - s.base; });
    let vergeben = soll.reduce((a, s) => a + s.base, 0);
    [...soll].sort((a, b) => b.rest - a.rest).forEach((s) => { if (vergeben < n) { s.base++; vergeben++; } });
    const out = [];
    for (const s of soll) out.push(...shuffle(byTh[s.t]).slice(0, s.base));
    if (out.length < n) out.push(...shuffle(reps.filter((q) => !out.includes(q))).slice(0, n - out.length));
    return out.slice(0, n);
  }

  if (strat === "fokus") {
    // Nur Ungelerntes & Schwieriges (Level < 3). Gewicht: falsch/negativ am stärksten,
    // dann ungesehen, dann wacklig. Gewichtete Ziehung. Reicht der Pool nicht, wird
    // mit gemeisterten Fragen aufgefüllt (damit die Runde voll wird).
    const hart = (q) => { const e = L[q.id]; if (!e || !e.seen) return 5; if (e.lvl < 0) return 9; return [4, 3, 2][Math.min(2, e.lvl)]; };
    let pool = reps.filter((q) => !gemeistert(q.id));
    if (pool.length < n) pool = pool.concat(shuffle(reps.filter((q) => gemeistert(q.id))));
    return zieheGewichtet(pool, n, hart);
  }

  // smart = Spaced Repetition: Fälliges/Wackliges zuerst, dann Neues, dann Bald-Fälliges
  const SR_TAGE = [0, 1, 2, 4, 6, 9]; // Soll-Abstand in Tagen je Level 0-5; Level < 0 = sofort fällig
  const jetzt = Date.now();
  const neu = [], faellig = [], bald = [];
  for (const q of reps) {
    const e = L[q.id];
    if (!e || !e.seen) { neu.push({ q }); continue; }
    const ueber = (jetzt - (e.ts || 0)) / 86400000 - SR_TAGE[Math.max(0, Math.min(5, e.lvl))];
    (ueber >= 0 ? faellig : bald).push({ q, ueber, lvl: e.lvl });
  }
  faellig.sort((a, b) => a.lvl - b.lvl || b.ueber - a.ueber);
  bald.sort((a, b) => b.ueber - a.ueber);
  shuffle(neu);
  const out = [];
  const nimm = (arr, limit) => { for (const x of arr) { if (out.length >= limit) return; if (!out.includes(x.q)) out.push(x.q); } };
  nimm(faellig, Math.ceil(n * 0.7)); // max ~70% Wiederholung, damit immer Neues dabei ist
  nimm(neu, n); nimm(faellig, n); nimm(bald, n);
  return out.slice(0, n);
}

// Gewichtete Ziehung (Gewicht × Zufall) — priorisiert nach gewFn, aber jede Runde anders.
function zieheGewichtet(pool, n, gewFn) {
  return pool.map((q) => ({ q, s: gewFn(q) * (0.4 + Math.random()) }))
    .sort((a, b) => b.s - a.s).slice(0, n).map((x) => x.q);
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
  const sess = { id: neueId(), erstellt: Date.now(), cfg, runde, idx: 0, restSek: null, dauerSek: 0 };
  state().offen.push(sess); save();
  syncLernstand();
  return sess;
}
// grabstein=false beim regulaeren Abschluss: die Session lebt gleich als gewertete
// Session mit derselben Id weiter, ein Grabstein wuerde sie beim Merge killen.
export function verwerfeOffene(id, grabstein = true) {
  const st = state();
  st.offen = st.offen.filter((s) => s.id !== id);
  if (grabstein && !st.geloescht.includes(id)) st.geloescht.push(id);
  save();
  if (grabstein) syncLernstand();
}

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
  syncLernstand();
  return session;
}

// Einzeln beantwortete Fragen (Stöbern, ohne Session) als Tages-Gruppen für den
// Verlauf — sie sind vollwertige Übung und sollen dort sichtbar sein.
export function einzelGruppen() {
  const tage = {};
  for (const a of state().antwortLog) {
    if (a.sid) continue;
    const tag = new Date(a.ts).toDateString();
    (tage[tag] = tage[tag] || []).push(a);
  }
  return Object.values(tage).map((arr) => {
    const mitMax = arr.filter((x) => x.max);
    return {
      einzel: true, id: "einzel-" + arr[0].ts,
      erstellt: arr[0].ts, ts: arr[arr.length - 1].ts,
      n: arr.length,
      punkte: Math.round(mitMax.reduce((s, x) => s + x.punkte, 0) * 2) / 2,
      max: mitMax.reduce((s, x) => s + x.max, 0),
      antworten: arr,
    };
  });
}

export function insights(session) {
  const out = [];
  const byTyp = gruppiere(session.proFrage, (x) => x.fragetyp || "positiv");
  const acc = (arr) => arr.reduce((a, x) => a + x.punkte / x.max, 0) / arr.length;
  // Nur der taktische NICHT-Frage-Tipp bleibt hier — Themen-Staerken/-Schwaechen
  // und Verwechslungen deckt jetzt die „Wo du stehst"-Karte (bewerteRows) ab.
  if (byTyp.negation?.length >= 2 && byTyp.positiv?.length >= 2 && acc(byTyp.negation) < acc(byTyp.positiv) - 0.15)
    out.push("NICHT-Fragen kosten dich gerade mehr Punkte. Tipp: Bei ‚NICHT' erst alle richtigen Aussagen markieren, dann umdrehen.");
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
// ---------- Lernstand-Sync (gemeinsamer Stand ueber alle Geraete) ----------
// Ein Sync-Code = ein Lernstand. Ablauf immer Pull → Merge → Push, damit zwei
// Geraete, die gleichzeitig ueben, sich nicht gegenseitig ueberschreiben.
// Der Merge ist eine Vereinigung: Antworten und Sessions kommen nur dazu,
// Geloeschtes traegt einen Grabstein, der Lernstand wird danach neu berechnet.
// Bewusst leergeraeumter Code heisst "Sync aus" — darum != null statt ||,
// sonst faellt man auf den Default zurueck und synct doch wieder.
export const syncCode = () => {
  const s = state().settings.syncCode;
  return String(s != null ? s : (window.ST_CONFIG.syncCode || "")).trim();
};
export const syncAktiv = () => supaAktiv() && !!syncCode();

function snapshot() {
  const st = state();
  // pending/deviceId/settings bleiben lokal — die gehoeren dem Geraet, nicht dem Lernstand
  return { sessions: st.sessions, antwortLog: st.antwortLog, offen: st.offen, geloescht: st.geloescht };
}

// Kompakte Signatur eines Stands — jsonb aus Postgres kommt mit anderer Schluessel-
// reihenfolge zurueck, ein JSON-Textvergleich waere darum immer ungleich.
function signatur(d) {
  const ids = (arr, f) => (arr || []).map(f).sort().join(",");
  return [
    ids(d.sessions, (s) => s.id),
    ids(d.antwortLog, (a) => a.aid || antwortId(a)),
    ids(d.offen, (s) => s.id + ":" + (s.runde || []).filter((r) => r.gewaehlt?.length).length),
    (d.geloescht || []).slice().sort().join(","),
  ].join("|");
}

// Vereinigt den Remote-Stand in den lokalen. Gibt true zurueck, wenn sich lokal etwas geaendert hat.
export function mergeLernstand(remote) {
  const st = state();
  const vorher = signatur(snapshot());

  st.geloescht = [...new Set([...st.geloescht, ...(remote.geloescht || [])])];
  const tot = new Set(st.geloescht);

  const sess = new Map();
  for (const s of [...(remote.sessions || []), ...st.sessions]) if (!tot.has(s.id)) sess.set(s.id, s);
  st.sessions = [...sess.values()].sort((a, b) => (a.ts || 0) - (b.ts || 0));

  const log = new Map();
  for (const a of [...(remote.antwortLog || []), ...st.antwortLog]) {
    if (!a?.qid) continue;
    if (a.sid && tot.has(a.sid)) continue;
    // Einzelantworten (ohne sid) tragen ihre aid als Grabstein in derselben Liste —
    // alte App-Versionen reichen unbekannte Ids einfach mit weiter (Union)
    if (!a.sid && tot.has(a.aid || antwortId(a))) continue;
    log.set(a.aid || antwortId(a), a);
  }
  st.antwortLog = [...log.values()].sort((a, b) => a.ts - b.ts);

  // Offene Runden: die weiter fortgeschrittene Fassung gewinnt; fertig gewertete
  // oder verworfene fliegen raus.
  const beantwortet = (s) => (s.runde || []).filter((r) => r.gewaehlt?.length).length;
  const off = new Map();
  for (const s of [...(remote.offen || []), ...st.offen]) {
    if (tot.has(s.id) || sess.has(s.id)) continue;
    const alt = off.get(s.id);
    if (!alt || beantwortet(s) >= beantwortet(alt)) off.set(s.id, s);
  }
  st.offen = [...off.values()];

  rebuildLeitner(); // save() steckt drin
  return signatur(snapshot()) !== vorher;
}

export let syncStatus = { ts: 0, fehler: null, laeuft: false };
const horcher = new Set();
export function onSync(fn) { horcher.add(fn); return () => horcher.delete(fn); }
const melde = () => horcher.forEach((f) => { try { f(syncStatus); } catch { /* egal */ } });

// Laeuft immer nur ein Sync zur Zeit, und hoechstens einer wartet — der nimmt alles
// mit, was inzwischen dazugekommen ist. Wichtig: das zurueckgegebene Promise ist
// erst erfuellt, wenn wirklich gepusht wurde (sonst warten Aufrufer ins Leere).
let kette = Promise.resolve(false), wartend = 0;
export function syncLernstand() {
  if (!syncAktiv()) return Promise.resolve(false);
  if (wartend) return kette; // es steht schon einer an, der macht unsere Aenderung mit
  wartend++;
  kette = kette.then(() => { wartend--; return einSync(); }, () => { wartend--; return einSync(); });
  return kette;
}

async function einSync() {
  if (!syncAktiv()) return false;
  syncStatus = { ...syncStatus, laeuft: true, fehler: null }; melde();
  let geaendert = false;
  try {
    const url = window.ST_CONFIG.supabaseUrl + "/rest/v1/lernstand";
    const q = `?code=eq.${encodeURIComponent(syncCode())}&select=daten&order=ts.desc&limit=1`;
    const r = await fetch(url + q, { headers: { ...supaHeaders(), Prefer: "" } });
    if (!r.ok) throw new Error("Pull " + r.status);
    const rows = await r.json();
    const remote = rows[0]?.daten || null;

    const lokalGeaendert = remote ? mergeLernstand(remote) : false;
    const neu = snapshot();
    // Push nur, wenn der Server nicht schon genau unseren Stand hat
    if (!remote || signatur(remote) !== signatur(neu)) {
      const p = await fetch(url, {
        method: "POST", headers: supaHeaders(),
        body: JSON.stringify({ code: syncCode(), device_id: state().deviceId, daten: neu }),
      });
      if (!p.ok) throw new Error("Push " + p.status);
    }
    geaendert = lokalGeaendert;
    syncStatus = { ts: Date.now(), fehler: null, laeuft: false };
  } catch (e) {
    syncStatus = { ...syncStatus, laeuft: false, fehler: e.message || "offline" };
  }
  melde();
  return geaendert;
}

let syncTimer = null;
export function syncBald(ms = 2500) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncLernstand(), ms);
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
if (typeof window !== "undefined") window.addEventListener("online", () => { flushSync(); syncLernstand(); });
