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

// ---------- Begriffe-Blitz (Zuordnungs-Paare) ----------
// Eigenes kleines Dataset (data/begriffe.json); Antworten darauf landen als
// ganz normale antwortLog-Eintraege (qid = "bg-...", modus "begriffe") und
// syncen damit ueber Geraete wie alles andere. In die Fragen-Statistik
// flieszen sie nicht ein (frage(qid) kennt sie nicht) — bewusst.
let BEGRIFFE = [];
export const begriffe = () => BEGRIFFE;
export async function ladeBegriffe() {
  try {
    const r = await fetch("data/begriffe.json");
    BEGRIFFE = r.ok ? await r.json() : [];
  } catch { BEGRIFFE = []; }
  if (!Array.isArray(BEGRIFFE)) BEGRIFFE = [];
  return BEGRIFFE;
}
// Lernstand je Paar aus dem Antwort-Log (erster Match-Versuch je Runde zaehlt)
export function begriffStats() {
  const o = {};
  for (const a of state().antwortLog) {
    if (!String(a.qid).startsWith("bg-")) continue;
    const s = (o[a.qid] = o[a.qid] || { n: 0, ok: 0 });
    s.n++; if (a.voll) s.ok++;
  }
  return o;
}

// ---------- Klausurtraining (Probeklausur I-V) ----------
// Feste, kuratierte 42er-Sets (data/probeklausuren.json, von scripts/baue-
// probeklausuren.py): global unique ueber die ganze Serie, alle Unterthemen
// abgedeckt, lowkey auf Roses Schwaechen gewichtet. I ist offen; jede weitere
// schaltet sich frei durch Abschluss der vorigen + PK_FREI_KARTEN Karten Ueben.
let PKS = [];
export const probeklausuren = () => PKS;
export const PK_ROEM = ["", "I", "II", "III", "IV", "V"];
export const PK_FREI_KARTEN = 100;
export async function ladeProbeklausuren() {
  try {
    const r = await fetch("data/probeklausuren.json");
    const d = r.ok ? await r.json() : null;
    // Klausuren ohne (fertiges) Set bleiben als "in Vorbereitung" sichtbar & klickbar
    PKS = (d?.klausuren || []).map((k) => {
      const qids = (k.qids || []).filter((id) => { const q = frage(id); return q && q.quizbar; });
      return { nr: k.nr, qids, bereit: qids.length >= 30 };
    });
  } catch { PKS = []; }
  return PKS;
}

// Quarantaene: Fragen einer noch NICHT bestandenen Probeklausur sind im Training
// gesperrt (inkl. aller Formulierungs- und Einfache-Sprache-Varianten) — die
// Probeklausur soll echtes Themenwissen an unbekannten Fragen messen, nicht
// Wiedererkennen. Nach dem Bestehen wandern die Fragen in den Uebungs-Korpus.
let sperrCache = null, sperrKey = "";
export function pkGesperrt() {
  const st = state();
  const bestanden = new Set(st.sessions
    .filter((s) => s.modus === "probeklausur" && s.bestanden && s.cfg?.pk).map((s) => s.cfg.pk));
  const key = PKS.map((p) => p.nr + ":" + p.qids.length).join(",") + "|" + [...bestanden].sort().join(",");
  if (sperrCache && sperrKey === key) return sperrCache;
  const direkt = new Set();
  for (const pk of PKS) if (!bestanden.has(pk.nr)) for (const id of pk.qids) direkt.add(id);
  const out = new Set();
  if (direkt.size) {
    const byId = new Map(POOL.map((q) => [q.id, q]));
    const rootOf = (q) => {
      const orig = q.sprachVarianteVon ? (byId.get(q.sprachVarianteVon) || q) : q;
      return orig.variantenVon || orig.id;
    };
    const roots = new Set();
    for (const id of direkt) { const q = byId.get(id); if (q) roots.add(rootOf(q)); }
    for (const q of POOL) if (roots.has(rootOf(q))) out.add(q.id);
  }
  sperrCache = out; sperrKey = key;
  return out;
}
// Status je Probeklausur: frei/gesperrt, bisherige Durchgaenge, Freischalt-Fortschritt.
// Alles aus sessions + antwortLog abgeleitet -> synct automatisch ueber Geraete.
export function pkStatus() {
  const st = state();
  const spam = spamAids();
  const faellige = (nr) => st.sessions
    .filter((s) => s.modus === "probeklausur" && s.cfg?.pk === nr && s.status !== "abgebrochen")
    .sort((a, b) => (a.ts || 0) - (b.ts || 0));
  return PKS.map((pk) => {
    const fertige = faellige(pk.nr);
    let frei = pk.nr === 1, fehltKarten = null, vorherFertig = true;
    if (pk.nr > 1) {
      const prev = faellige(pk.nr - 1);
      vorherFertig = prev.length > 0;
      if (!vorherFertig) frei = false;
      else {
        // Karten seit dem ERSTEN Abschluss der vorigen Probeklausur (deren eigene
        // Antworten zaehlen nicht mit; Spam-Wiederholungen auch nicht)
        const p0 = prev[0];
        let n = 0;
        for (const a of st.antwortLog)
          if (a.ts > (p0.ts || 0) && a.sid !== p0.id && !spam.has(a.aid || antwortId(a))) n++;
        fehltKarten = Math.max(0, PK_FREI_KARTEN - n);
        frei = fehltKarten === 0;
      }
    }
    const offen = st.offen.find((o) => o.cfg?.modus === "probeklausur" && o.cfg?.pk === pk.nr);
    return { ...pk, frei, fertige, vorherFertig, fehltKarten,
      beste: fertige.length ? Math.max(...fertige.map((s) => s.punkte)) : null,
      bestanden: fertige.some((s) => s.bestanden), offen };
  });
}
// Probeklausur starten: festes Fragenset, nur Reihenfolgen werden gemischt.
// Wiederholungen zaehlen als 2./3. Versuch derselben Kette (Versuchs-Vergleich).
export function erstelleProbeklausur(pk, { timerModus = "nta", pausierbar = false, feedback = "ende" } = {}) {
  const qs = pk.qids.map(frage).filter(Boolean);
  if (!qs.length) return null;
  const runde = shuffle([...qs]).map((q) => ({ qid: q.id, optOrder: shuffle([...q.optionen.keys()]), gewaehlt: null }));
  const cfg = { modus: "probeklausur", pk: pk.nr, anzahl: runde.length, timerModus, pausierbar, feedback, examLook: true, sprache: "schwer", auswahl: "fest" };
  const sess = { id: neueId(), erstellt: Date.now(), cfg, runde, idx: 0, restSek: null, dauerSek: 0 };
  const fruehere = state().sessions.filter((s) => s.modus === "probeklausur" && s.cfg?.pk === pk.nr);
  if (fruehere.length) {
    const root = fruehere[0].versuchVon || fruehere[0].id;
    sess.versuchVon = root;
    sess.versuchNr = 1 + state().sessions.filter((x) => x.id === root || x.versuchVon === root).length;
  }
  state().offen.push(sess); save();
  syncLernstand();
  return sess;
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
  return e;
}

// Nachtraeglich Felder an einen bestehenden Log-Eintrag haengen (Selbsterklaerung/
// Abgleich kommen zeitlich NACH dem Loggen der Antwort). Der Merge dedupliziert
// per aid und die lokale Fassung gewinnt — Ergaenzungen syncen also sauber mit.
export function ergaenzeAntwort(aid, felder) {
  const a = state().antwortLog.find((x) => (x.aid || antwortId(x)) === aid);
  if (!a) return;
  Object.assign(a, felder);
  save();
  syncBald();
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

// Fertige Session als NEUEN Versuch wiederholen: gleiche Fragen, frisch gemischt.
// Der alte Eintrag bleibt unangetastet — der neue Durchgang wird als Versuch
// 2/3/4… derselben Kette gewertet und in der Auswertung verglichen.
export function wiederholeSession(id) {
  const st = state();
  const s = st.sessions.find((x) => x.id === id);
  if (!s) return null;
  const qids = (s.runde?.length ? s.runde : s.proFrage || []).map((r) => r.qid).filter((qid) => frage(qid));
  if (!qids.length) return null;
  const root = s.versuchVon || s.id;
  const nr = 1 + st.sessions.filter((x) => x.id === root || x.versuchVon === root).length;
  const runde = shuffle([...qids]).map((qid) => ({ qid, optOrder: shuffle([...frage(qid).optionen.keys()]), gewaehlt: null }));
  const cfg = { ...(s.cfg || { modus: s.modus, timerModus: s.timerModus, pausierbar: true, feedback: ["klausur", "halbe"].includes(s.modus) ? "ende" : "sofort", examLook: ["klausur", "halbe"].includes(s.modus) }) };
  let restSek = null;
  if (cfg.timerModus && cfg.timerModus !== "aus") restSek = timerMinuten(runde.length, cfg.timerModus) * 60;
  const sess = { id: neueId(), erstellt: Date.now(), cfg, runde, idx: 0, restSek, dauerSek: 0, versuchVon: root, versuchNr: nr };
  st.offen.push(sess); save();
  syncLernstand();
  return sess;
}
// Alle frueheren Versuche derselben Kette (Original = Versuch 1), aelteste zuerst.
export function vorVersuche(session) {
  const root = session.versuchVon || session.id;
  return state().sessions
    .filter((x) => (x.id === root || x.versuchVon === root) && x.id !== session.id && (x.ts || 0) <= (session.ts || Infinity))
    .sort((a, b) => (a.ts || 0) - (b.ts || 0));
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
// Ein echter Versuch braucht Lesezeit. Unter 3s (z.B. schnelles Durchtippen im
// Explore) zaehlt fuer Aktivitaet, aber NICHT fuer Qualitaetszahlen (Quote, Zeit,
// Staerken/Schwaechen) — sonst verfaelschen Schnelltaps die Diagnose.
const plausibel = (a) => a.zeit == null || a.zeit >= 3;

// Zweiter Diagnose-Filter: dieselbe Frage direkt nochmal (z.B. "Nochmal üben"-
// Schleife, Frust-Getippe) ist kein eigenstaendiger Versuch — die Loesung war
// gerade sichtbar. Fuer Qualitaetszahlen zaehlt ein erneuter Versuch derselben
// Frage erst, wenn die letzte Antwort darauf >10 Minuten her ist.
const SPAM_FENSTER = 10 * 60000;
function spamAids() {
  const spam = new Set();
  const letzte = {};
  for (const a of [...state().antwortLog].sort((x, y) => x.ts - y.ts)) {
    if (letzte[a.qid] != null && a.ts - letzte[a.qid] < SPAM_FENSTER) spam.add(a.aid || antwortId(a));
    letzte[a.qid] = a.ts;
  }
  return spam;
}

// antwortLog -> angereicherte Zeilen (mit Thema/Unterthema aus dem Korpus)
function logZeilen() {
  const out = [];
  const spam = spamAids();
  for (const a of state().antwortLog) {
    const q = frage(a.qid); if (!q) continue;
    out.push({ qid: a.qid, ts: a.ts, punkte: a.punkte, max: a.max, voll: a.voll, zeit: a.zeit,
      thema: q.oberthema, unter: q.unterthema, fragetyp: q.fragetyp, paar: q.verwechslungspaar,
      plaus: plausibel(a) && !spam.has(a.aid || antwortId(a)) });
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

// "Werde ich besser?" — vergleicht je Thema (und gesamt) die aeltere Haelfte
// der plausiblen Antworten mit der neueren. Nur belastbare Aussagen: mindestens
// 5 Antworten je Haelfte (gesamt) bzw. 4 (Thema).
export function entwicklung() {
  const rows = logZeilen().filter((r) => r.plaus && r.max).sort((a, b) => a.ts - b.ts);
  const quote = (arr) => Math.round(100 * arr.reduce((s, r) => s + r.punkte / r.max, 0) / arr.length);
  const halb = (arr, min) => {
    if (arr.length < min * 2) return null;
    const mitte = Math.floor(arr.length / 2);
    const vorher = quote(arr.slice(0, mitte)), jetzt = quote(arr.slice(mitte));
    return { vorher, jetzt, delta: jetzt - vorher, n: arr.length };
  };
  const gesamt = halb(rows, 5);
  const proThema = Object.entries(gruppiere(rows, (r) => r.thema))
    .map(([thema, arr]) => ({ thema, ...halb(arr, 4) }))
    .filter((x) => x.n)
    .sort((a, b) => b.delta - a.delta);
  return { gesamt, proThema };
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
    const tagQual = qual.filter((r) => r.ts >= von && r.ts < von + 86400000);
    tage14.push({ ts: von, n: log.filter((a) => a.ts >= von && a.ts < von + 86400000).length,
      // Tages-Punktequote nur, wenn genug echte Versuche fuer eine Aussage da sind
      quote: tagQual.length >= 5 ? Math.round(100 * avg(tagQual.map((r) => r.punkte / r.max))) : null });
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
    entwicklung: entwicklung(),
  };
}

// Datenpunkte fuer die Lernlandkarte & die Nach-Stand-Ansicht im Stoebern:
// je Frage mit mindestens einem echten Versuch (Plausibilitaets- + Spam-Filter)
// Anzahl Wiederholungen und mittlere Punktequote. Nie Geuebtes bleibt draussen.
export function karteDaten() {
  const spam = spamAids();
  const agg = new Map();
  for (const a of state().antwortLog) {
    if (!a.max || !plausibel(a) || spam.has(a.aid || antwortId(a))) continue;
    const q = frage(a.qid); if (!q) continue;
    const e = agg.get(a.qid) || { qid: a.qid, n: 0, sum: 0 };
    e.n++; e.sum += a.punkte / a.max;
    agg.set(a.qid, e);
  }
  return [...agg.values()].map((e) => {
    const q = frage(e.qid);
    return { qid: e.qid, n: e.n, quote: Math.round((100 * e.sum) / e.n),
      thema: q.oberthema, unter: q.unterthema, frage: q.frage };
  });
}

// ---------- Tagesziel & Sicherheits-Sterne (Endspurt) ----------
// Tages-Aktivitaet: alle heutigen Antworten (inkl. Begriffe-Blitz) ausser
// Spam-Wiederholungen. Bewusst OHNE 3s-Filter: die Bar misst Einsatz, nicht
// Qualitaet — schnelle Wiederholrunden sind trotzdem Ueben.
export function tagesStand() {
  const cfg = window.ST_CONFIG;
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  const spam = spamAids();
  let n = 0;
  for (const a of state().antwortLog)
    if (a.ts >= heute.getTime() && !spam.has(a.aid || antwortId(a))) n++;
  let tage = null;
  if (cfg.klausurTag) tage = Math.round((new Date(cfg.klausurTag + "T00:00:00") - heute) / 86400000);
  return { n, tage, ...tagesPlan(heute, tage) };
}

// Dynamischer Tagesplan (Jennifer 18.07.): drei Stufen statt fester Zahl.
//   ziel    = Tagespensum: echter Restbedarf bis "wirklich alles gemeistert",
//             durch die verbleibenden Uebungstage geteilt (bewusst ambitioniert)
//   minimum = geschuetzter Boden fuer zaehe Tage — erreichbar, nie beschaemend
//   stretch = Streckziel/Vorsprung fuer starke Tage (Bar-Ende, Gold)
// Restbedarf: je MC-Karte fehlende Voll-richtig-Antworten bis Level 3 (neu/wacklig 3,
// Lvl 1 -> 2, Lvl 2 -> 1), geteilt durch Roses persoenliche Voll-Quote der letzten
// 100 echten Versuche (x1,15 Wiederholungs-Bonus: bekannte Karten gelingen oefter,
// geklemmt 55-85%). Begriffe-Paare zaehlen mit (2 Treffer = sitzt, ~85% Trefferrate).
// Der Plan wird EINMAL pro Tag eingefroren (settings.tzPlan, geraetelokal) — ein Ziel,
// das mittags schrumpft oder waechst, waere Psycho-Gift. Kappung bei 350/Tag: mehr
// zeigen wir nie an, auch wenn der Rest groesser ist (Panik-Schutz); Vortag der
// Klausur fest locker (80) — festigen und frueh schlafen statt pauken.
// NextGen Block C (21.07.): Das 350er-Endspurt-Pensum ist Geschichte — mit dem
// neuen Klausurtermin (18.09.) gilt Successive Relearning: TAEGLICH machbar
// schlaegt Marathon. Zielband 60-100 Karten (~20-30 min bei Roses Tempo-Mix),
// harter Deckel bei 100 — mehr zeigen wir nie an, auch wenn der Restbedarf
// groesser waere. Rechnung wie gehabt (fehlende Voll-Antworten bis Level 3,
// durch persoenliche Voll-Quote geteilt, auf Resttage verteilt), nur sanft
// geklemmt. Vortag der Klausur fest locker (50). Plan friert 1x pro Tag ein
// (settings.tzPlan, geraetelokal); v:2 verdraengt eingefrorene Alt-Plaene.
function tagesPlan(heute, tage) {
  const st = state();
  const key = heute.toDateString();
  const alt = st.settings.tzPlan;
  if (alt && alt.tag === key && alt.v === 2) return alt;
  let vollBedarf = 0;
  for (const q of POOL) {
    if (!(q.quizbar && q.relevanz !== "laut-rose-nicht-relevant" && (q.sprache || "schwer") !== "einfach")) continue;
    const lvl = (st.leitner[q.id] || {}).lvl || 0;
    vollBedarf += lvl >= 3 ? 0 : lvl === 2 ? 1 : lvl === 1 ? 2 : 3;
  }
  const bs = begriffStats();
  let bgBedarf = 0;
  for (const p of BEGRIFFE) bgBedarf += Math.max(0, 2 - (bs[p.id]?.ok || 0));
  const mc = st.antwortLog.filter((a) => a.max && plausibel(a) && !String(a.qid).startsWith("bg-")).slice(-100);
  const basisRate = mc.length >= 20 ? mc.filter((a) => a.voll).length / mc.length : 0.6;
  const rate = Math.min(0.85, Math.max(0.55, basisRate * 1.15));
  const restBedarf = Math.ceil(vollBedarf / rate) + Math.ceil(bgBedarf / 0.85);
  const restTage = Math.max(1, tage == null ? 30 : tage);
  const r10 = (x) => Math.round(x / 10) * 10;
  let ziel = Math.max(60, Math.min(100, r10(restBedarf / restTage)));
  if (tage === 1) ziel = Math.min(ziel, 50);
  const plan = { v: 2, tag: key, ziel, minimum: Math.max(25, r10(ziel * 0.35)),
    stretch: Math.min(140, r10(ziel * 1.25)), restBedarf };
  st.settings.tzPlan = plan; save();
  return plan;
}

// Aktivitaet je Kalendertag (fuer Heatmap & Trend): alle Antworten ausser
// Spam-Wiederholungen (misst Einsatz wie die Tagesziel-Bar), dazu wie viele
// davon voll richtig waren — fuer die zweite Trend-Linie (Konvergenz
// geuebt vs. richtig = sichtbar steigende Qualitaet).
export function aktivitaetProTag() {
  const spam = spamAids();
  const tage = {};
  for (const a of state().antwortLog) {
    if (spam.has(a.aid || antwortId(a))) continue;
    const d = new Date(a.ts); d.setHours(0, 0, 0, 0);
    const e = tage[d.getTime()] || (tage[d.getTime()] = { n: 0, voll: 0 });
    e.n++;
    if (a.voll) e.voll++;
  }
  return tage;
}

// Sicherheits-Sterne je Oberthema (0-3, ehrliche Momentaufnahme):
// Basis sind die letzten 30 echten Antworten (Plausibilitaets- + Spam-Filter)
// UND die Abdeckung (wie viel vom Thema ueberhaupt gesehen wurde) — damit
// 5 richtige Antworten auf immer dieselben Karten kein "pruefungsreif" ergeben.
// Bewusst aus den NEUEN Antworten gerechnet: alte Fehler vom Anfang druecken
// die Sterne nicht ewig, Verbesserung wird sichtbar (Wachstums-Logik).
export const STERN_STUFEN = [
  { stars: 1, n: 8,  quote: 50, abdeckung: 0.20 },
  { stars: 2, n: 15, quote: 65, abdeckung: 0.45 },
  { stars: 3, n: 20, quote: 78, abdeckung: 0.65 },
];
export function sicherheit() {
  const spam = spamAids();
  const byThema = {};
  for (const a of state().antwortLog) {
    if (!a.max || !plausibel(a) || spam.has(a.aid || antwortId(a))) continue;
    const q = frage(a.qid); if (!q) continue;
    (byThema[q.oberthema] = byThema[q.oberthema] || []).push(a);
  }
  return Object.keys(THEMEN).map((slug) => {
    const qs = POOL.filter((q) => q.oberthema === slug && zaehlt(q));
    const gesehen = qs.filter((q) => ((state().leitner[q.id] || {}).seen || 0) > 0).length;
    const abdeckung = qs.length ? gesehen / qs.length : 0;
    const rows = (byThema[slug] || []).sort((a, b) => a.ts - b.ts).slice(-30);
    const quote = rows.length ? Math.round((100 * rows.reduce((s, a) => s + a.punkte / a.max, 0)) / rows.length) : null;
    let stars = 0;
    for (const st of STERN_STUFEN) if (rows.length >= st.n && quote >= st.quote && abdeckung >= st.abdeckung) stars = st.stars;
    // Konkreter kleinster Schritt zum naechsten Stern: fehlende Karten (Antworten
    // oder ungesehene Fragen) — oder, wenn nur die Quote fehlt, Wiederholen.
    const next = STERN_STUFEN.find((st) => st.stars === stars + 1);
    let fehlt = null;
    if (next) {
      const karten = Math.max(next.n - rows.length, Math.ceil(next.abdeckung * qs.length) - gesehen, 0);
      fehlt = karten > 0 ? { karten } : { quote: next.quote };
    }
    return { slug, stars, quote, n: rows.length, abdeckung, gesehen, gesamt: qs.length, fehlt };
  });
}

// Fortschritt immer getrennt nach Originalfragen (OG) und KI-generierten.
// Zusätzlich Stufen für die Anzeige: gemeistert (Lvl ≥3) / auf gutem Weg (Lvl 1–2) /
// angefangen (beantwortet, Lvl ≤0) / neu (nie gesehen) — damit Fortschritt sichtbar
// wird, lange bevor die erste Frage "gemeistert" ist.
export function splitFortschritt(qs) {
  const og = qs.filter((q) => q.quelle !== "generiert");
  const ki = qs.filter((q) => q.quelle === "generiert");
  const mo = og.filter((q) => gemeistert(q.id)).length;
  const mk = ki.filter((q) => gemeistert(q.id)).length;
  const L = state().leitner;
  const st = { gem: 0, weg: 0, ang: 0, neu: 0 };
  for (const q of qs) {
    const e = L[q.id];
    if (!e) st.neu++;
    else if ((e.lvl || 0) >= 3) st.gem++;
    else if ((e.lvl || 0) >= 1) st.weg++;
    else st.ang++;
  }
  return {
    n: qs.length, m: mo + mk,
    pct: qs.length ? Math.round((100 * (mo + mk)) / qs.length) : 0,
    og: { m: mo, n: og.length }, ki: { m: mk, n: ki.length }, st,
  };
}
// Einfache-Sprache-Varianten zählen nicht doppelt in Fortschritt/Lernscore (sie vertreten ihr Original);
// Quarantäne-Fragen (in offener Probeklausur) zählen erst, wenn sie freigespielt sind.
const zaehlt = (q) => q.quizbar && q.relevanz !== "laut-rose-nicht-relevant" && (q.sprache || "schwer") !== "einfach" && !pkGesperrt().has(q.id);
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
  // Probeklausuren sind vollwertige Klausur-Simulationen — zaehlen fuer die Serie mit
  const sims = state().sessions.filter((s) => (s.modus === "klausur" || s.modus === "probeklausur") && s.fertig);
  for (let i = sims.length - 1; i >= 0; i--) { if (sims[i].bestanden) n++; else break; }
  return n;
}

// ---------- Runden bauen ----------
export function baueRunde(cfg) {
  let qs = POOL.filter((q) => q.quizbar);
  if (!cfg.inklNichtRelevant) qs = qs.filter((q) => q.relevanz !== "laut-rose-nicht-relevant");
  // Probeklausur-Quarantaene: diese Fragen kommen erst nach bestandener PK ins Training
  const sperr = pkGesperrt();
  if (sperr.size) qs = qs.filter((q) => !sperr.has(q.id));
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

  if (strat === "sprach") {
    // Sprachverstaendnis-Modus (Block D NextGen): Fragen, die Rose real schlecht
    // versteht (niedrige Quote in der Historie), + antizipiert schwere —
    // Negationen (ihr teuerster Fragetyp), lange Staemme, Anwendungs-Vignetten.
    const hist = {};
    for (const a of state().antwortLog) {
      if (!a.max || !plausibel(a)) continue;
      const s = hist[a.qid] || (hist[a.qid] = { n: 0, p: 0 });
      s.n++; s.p += a.punkte / a.max;
    }
    const boost = schwacheUnterthemen();
    const gew = (q) => {
      let w = 1;
      if (q.fragetyp === "negation") w *= 2.5;
      else if (q.fragetyp === "anwendung") w *= 1.5;
      if ((q.frage || "").length > 180) w *= 1.4;
      const s = hist[q.id];
      if (s && s.p / s.n < 0.5) w *= 2.5;          // real schlecht verstanden
      else if (s && s.n >= 2 && s.p / s.n >= 0.9) w *= 0.4; // sitzt laengst
      if (boost[q.oberthema + "/" + q.unterthema]) w *= 1.5;
      return w;
    };
    return zieheGewichtet([...reps], n, gew);
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
  // Neue Fragen nicht rein zufällig: Unterthemen, die in der Historie schwach waren,
  // bekommen bevorzugt UNGESEHENE Fragen. Die echte Klausur besteht aus lauter neuen
  // Fragen — gekonnt sein muss das Thema, nicht die (auswendig gelernte) Frage.
  const boost = schwacheUnterthemen();
  // Persoenliche Fragen (an Roses Lebenswelt angedockt, persoenlich:true) kommen
  // bevorzugt frueh dran — Relevanz ist der staerkste Motivations-Hebel.
  const neuSortiert = zieheGewichtet(neu, neu.length, (x) => (boost[x.q.oberthema + "/" + x.q.unterthema] || 1) * (x.q.persoenlich ? 2 : 1));
  neu.length = 0; neu.push(...neuSortiert);
  const out = [];
  const nimm = (arr, limit) => { for (const x of arr) { if (out.length >= limit) return; if (!out.includes(x.q)) out.push(x.q); } };
  nimm(faellig, Math.ceil(n * 0.7)); // max ~70% Wiederholung, damit immer Neues dabei ist
  nimm(neu, n); nimm(faellig, n); nimm(bald, n);
  return out.slice(0, n);
}

// Unterthemen-Schwäche aus der KOMPLETTEN Antwort-Historie (nicht nur dem aktuellen
// Leitner-Stand): ein Unterthema, das mal schwach war, bleibt geboostet, bis auch
// frische Fragen daraus sitzen — erst dann steigt die Quote und der Boost fällt weg.
// Schnell-Taps (< 3 s) zählen nicht, sie sind kein echter Versuch (Plausibilitäts-Filter).
function schwacheUnterthemen() {
  const agg = {};
  const spam = spamAids();
  for (const a of state().antwortLog) {
    if (a.zeit != null && a.zeit < 3) continue;
    if (spam.has(a.aid || antwortId(a))) continue;
    const q = frage(a.qid); if (!q) continue;
    const k = q.oberthema + "/" + q.unterthema;
    const s = agg[k] || (agg[k] = { n: 0, voll: 0 });
    s.n++; s.voll += a.voll ? 1 : 0;
  }
  const w = {};
  for (const [k, s] of Object.entries(agg)) {
    if (s.n < 3) continue; // zu wenig Daten, um "schwach" zu behaupten
    const quote = s.voll / s.n;
    if (quote < 0.6) w[k] = quote < 0.35 ? 3 : 2;
  }
  return w;
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
    return { qid: r.qid, gewaehlt: r.gewaehlt, ...erg, zeit: r.zeitSek ?? null, max: q.maxPunkte, thema: q.oberthema, unterthema: q.unterthema, fragetyp: q.fragetyp, paar: q.verwechslungspaar,
      // Selbsterklaerung (Block A NextGen): Text + Abgleich wandern mit in Log & Sync
      ...(r.selbst ? { selbstErkl: r.selbst.text || null, selbstAbgleich: r.selbst.abgleich || null, selbstSkip: !!r.selbst.skip } : {}),
      // Paraphrase (Block D): "Was will diese Frage?" in Roses Worten — spaeter
      // auswertbar (falsch paraphrasiert <-> falsch beantwortet?)
      ...(r.para ? { paraphrase: r.para } : {}) };
  });
  const punkte = proFrage.reduce((a, x) => a + x.punkte, 0);
  const max = runde.map((r) => frage(r.qid).maxPunkte).reduce((a, b) => a + b, 0);
  const bestehenBei = meta.modus === "klausur" ? window.ST_CONFIG.klausur.bestehen : Math.ceil(max * 0.5);
  const session = {
    id: meta.sessionId || "s-" + Date.now(), ts: Date.now(), erstellt: meta.erstellt || Date.now(),
    fertig: true, status: meta.status || "fertig",
    modus: meta.modus, timerModus: meta.timerModus, dauerSek: meta.dauerSek, sprache: meta.sprache || "schwer",
    versuchVon: meta.versuchVon || null, versuchNr: meta.versuchNr || null,
    anzahl: runde.length, beantwortet: proFrage.length,
    punkte: Math.round(punkte * 2) / 2, max, bestehenBei, bestanden: meta.status !== "abgebrochen" && punkte >= bestehenBei,
    proFrage,
    // Snapshot für "Fortsetzen" aus dem Verlauf (auch unbeantwortete Fragen)
    cfg: meta.cfg || null,
    runde: runde.map((r) => ({ qid: r.qid, optOrder: r.optOrder, gewaehlt: r.gewaehlt || null, zeitSek: r.zeitSek ?? null })),
  };
  state().sessions.push(session);
  proFrage.forEach((x, i) => logAntwort({ ts: session.ts + i, qid: x.qid, sid: session.id, modus: session.modus, gewaehlt: x.gewaehlt, punkte: x.punkte, max: x.max, voll: x.voll, zeit: x.zeit,
    ...(x.selbstErkl != null || x.selbstAbgleich != null || x.selbstSkip ? { selbstErkl: x.selbstErkl ?? null, selbstAbgleich: x.selbstAbgleich ?? null, selbstSkip: !!x.selbstSkip } : {}),
    ...(x.paraphrase ? { paraphrase: x.paraphrase } : {}) }));
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
