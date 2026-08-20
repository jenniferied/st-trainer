// ============ Daten, Zustand, Engine, Sync ============

// Geteilt mit dem GE-Trainer. Quelle: rose/geteilte-styles/tagesstand.js —
// diese Datei ist eine verteilte Kopie und wird NIE hier bearbeitet.
import { heuteBlock } from "./geteilt-tagesstand.js";

/* ---------- Wer zaehlt die offenen Tagesaufgaben? ----------
   Die Liste der Tagesaufgaben lebt in spiele.js (dailies()), und spiele.js
   importiert diese Datei hier — ein Import in die Gegenrichtung waere ein
   Kreis. Deshalb meldet sich der Zaehler an, statt geholt zu werden;
   angemeldet wird er beim Start in main.js.

   Nicht angemeldet heisst null heisst "wir wissen es nicht" — und das ist
   streng etwas anderes als die 0, die "heute alles erledigt" heisst. Der
   heute-Block laesst das Feld dann weg, und der Querlink drueben zeigt gar
   kein Offen-Signal, statt faelschlich Entwarnung zu geben.
   Der GE-Trainer hat dieselbe Bauweise in sync.js. */
let offenZaehler = null;
export function setzeOffenZaehler(f) { offenZaehler = typeof f === "function" ? f : null; }

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

// ---------- Pingo-Filter (Option pro Runde) ----------
// Rose kann das Ueben auf die Fragen aus den Pingo-Abstimmungen der Vorlesung
// begrenzen (pingo-2025 + pingo-2026). Der Schalter stand vom 11.-12.08. global
// in den Einstellungen und steht seit 12.08. (Jennifer) dort, wo die Runde
// zusammengestellt wird: eine Option je Runde, wie Timer oder Feedback.
// settings.nurPingo ist seitdem nur noch die GEMERKTE Wahl — der Vorschlag fuer
// die naechste Runde und der Wert, den die Schnellstart-Knoepfe ohne eigenen
// Baukasten uebernehmen. Verbindlich ist immer cfg.nurPingo der laufenden Runde.
// Ausgenommen sind die drei echten Simulationen: volle Klausur, halbe Klausur,
// Probeklausur. Die sollen die echte Klausur abbilden (repraesentativer Themen-Mix,
// unbekannte Fragen) — 42 Fragen aus 41 waeren ein Wiedererkennungstest.
// BEWUSST NICHT an examLook gehaengt: die Klausuransicht in der Eigenen Runde ist
// eine ANSICHT (Exam.UP-Look + Fragen-Navigation), keine Simulation. Haengt der
// Filter an examLook, waehlt der Baukasten nur die Pingo-Unterthemen an, zieht
// dann aber ungefiltert — eine Runde ueber den ganzen Bestand, der still ein
// Drittel der Unterthemen fehlt. Probeklausuren laufen ohnehin an baueRunde vorbei.
export const istPingo = (q) => String(q.quelle || "").startsWith("pingo");
// Gemerkte Wahl aus der letzten Runde — NICHT die Bedingung fuer den Filter.
export const nurPingoGemerkt = () => !!state().settings.nurPingo;
export const SIM_MODI = ["klausur", "halbe", "probeklausur"];
export const pingoFilterGilt = (cfg = {}) => !!cfg.nurPingo && !SIM_MODI.includes(cfg.modus);

// Verfuegbare Pingo-Fragen je Unterthema (Schluessel "oberthema/unterthema"),
// nach denselben Regeln, die auch baueRunde anlegt: quizbar, laut Rose relevant,
// keine Einfache-Sprache-Variante, nicht in Probeklausur-Quarantaene. Die
// Oberflaeche zeigt damit Zahlen, die zum Filter passen — eine Zahl, die luegt,
// ist schlimmer als gar keine.
export function pingoCounts() {
  const sperr = pkGesperrt();
  const o = {}, gesehen = new Set();
  for (const q of POOL) {
    if (!istPingo(q) || !q.quizbar || q.relevanz === "laut-rose-nicht-relevant") continue;
    if ((q.sprache || "schwer") === "einfach" || sperr.has(q.id)) continue;
    // Umformulierungen derselben Frage zaehlen einmal — baueRunde zieht je
    // Varianten-Gruppe genau einen Vertreter, sonst waere die Zahl zu hoch
    const grp = q.sprachVarianteVon || q.variantenVon || q.id;
    if (gesehen.has(grp)) continue;
    gesehen.add(grp);
    const k = q.oberthema + "/" + q.unterthema;
    o[k] = (o[k] || 0) + 1;
  }
  return o;
}
export const pingoGesamt = () => Object.values(pingoCounts()).reduce((a, b) => a + b, 0);

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
// Lehrerzimmer (Story-Modus). Der Modus-Name steht als Konstante, weil er an vier
// Stellen entscheidet: Leitner-Ausschluss in werteAus() und rebuildLeitner(),
// Einzelantwort-Erkennung (PSEUDO_SIDS) und der Fortschritt in story.js.
export const STORY_MODUS = "story";
let STORY = null;
export const story = () => STORY;
// data/story.json entsteht in sync-fragen.py aus fragen/story/kapitel-*.json.
// Enthaelt nur Szenen mit qid-Zeigern, nie Fragen — die kommen aus dem Pool.
// Fehlt die Datei, bleibt STORY null und main.js blendet die Kachel aus.
export async function ladeStory() {
  try {
    const r = await fetch("data/story.json");
    const d = r.ok ? await r.json() : null;
    if (!d?.kapitel?.length) return (STORY = null);
    // Szenen ohne auffindbare Frage fliegen still raus, statt die Runde zu
    // sprengen — dieselbe Haltung wie bei den Probeklausuren.
    STORY = { ...d, kapitel: d.kapitel.map((k) => ({ ...k, szenen: k.szenen.filter((s) => frage(s.qid)) })).filter((k) => k.szenen.length) };
  } catch { STORY = null; }
  return STORY;
}
// Alle Szenen der Reihe nach — die Story ist bewusst linear (Jennifer, 13.08.).
export const storySzenen = () => (STORY?.kapitel || []).flatMap((k) => k.szenen.map((s) => ({ ...s, kapitel: k })));
// Die Geschichte laeuft in Runden zu zehn Szenen, dazwischen eine Stunde Pause
// (Jennifer, 13.08.2026). Der Sinn ist Rationierung: 42 Szenen an einem Abend
// weggelesen sind einmal Spass, ueber zwei Wochen verteilt sind sie ein Grund,
// die App wieder aufzumachen.
export const STORY_RUNDE = 10;
export const STORY_PAUSE_MS = 60 * 60 * 1000;

// Fortschritt und Sperre werden ABGELEITET, nicht gespeichert: welche
// Story-Fragen wann beantwortet wurden, steht im antwortLog — und das wird
// ohnehin gesynct. Damit braucht der Modus kein eigenes Feld in
// snapshot()/signatur(), und die Pause gilt automatisch auf beiden Geraeten.
export function storyStand() {
  const log = state().antwortLog.filter((a) => a.modus === STORY_MODUS);
  const fertig = new Set(log.map((a) => a.qid));
  const alle = storySzenen();
  const n = alle.filter((s) => fertig.has(s.qid)).length;

  // Zeitstempel der zuletzt beantworteten Szene — nicht der letzte Log-Eintrag,
  // denn ein Wiederlesen einer schon bekannten Szene soll die Pause nicht neu
  // starten. Darum ueber die Menge der frischen qids gehen.
  const gesehen = new Set();
  let letzterNeuer = 0;
  for (const a of [...log].sort((x, y) => x.ts - y.ts)) {
    if (gesehen.has(a.qid)) continue;
    gesehen.add(a.qid); letzterNeuer = a.ts;
  }

  // Gesperrt ist nur die Schwelle zwischen zwei vollen Runden. Wer mittendrin
  // aufhoert, darf jederzeit weiter — die Pause soll bremsen, nicht bestrafen.
  const anRundenGrenze = n > 0 && n < alle.length && n % STORY_RUNDE === 0;
  const restMs = anRundenGrenze ? Math.max(0, STORY_PAUSE_MS - (Date.now() - letzterNeuer)) : 0;

  return {
    fertig, n, gesamt: alle.length,
    runde: Math.floor(n / STORY_RUNDE) + 1,
    rundenGesamt: Math.ceil(alle.length / STORY_RUNDE),
    imRest: n % STORY_RUNDE,              // wie viele der laufenden Runde schon durch sind
    gesperrt: restMs > 0, restMs,
    durch: n >= alle.length,
  };
}

// Die naechsten Szenen am Stueck: ab der ersten ungesehenen, hoechstens bis zum
// Ende der laufenden Zehnerrunde.
export function storyRunde() {
  const st = storyStand();
  const alle = storySzenen();
  const start = alle.findIndex((s) => !st.fertig.has(s.qid));
  if (start < 0) return [];
  const bisEnde = STORY_RUNDE - (start % STORY_RUNDE);
  return alle.slice(start, start + bisEnde);
}

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
    // Abgeleitete Zusatzfelder fuer die Darstellung — die Freischalt-Rechnung
    // oben bleibt unangetastet (ROADMAP 20c: Abschluss + 100 Karten). Wichtig
    // ist nur, dass ein Durchlauf, der abgegeben wurde BEVOR alle Fragen dran
    // waren, nicht wie ein zu Ende gebrachter aussieht.
    const besteS = fertige.length ? fertige.reduce((a, b) => (b.punkte > a.punkte ? b : a)) : null;
    const ganze = fertige.filter((s) => (s.beantwortet || 0) >= (s.anzahl || 0));
    return { ...pk, frei, fertige, vorherFertig, fehltKarten,
      beste: besteS ? besteS.punkte : null,
      besteMax: besteS ? besteS.max : null,
      besteSession: besteS,
      bestehenBei: besteS ? besteS.bestehenBei : null,
      // abgegeben, aber nicht zu Ende gebracht — und noch kein ganzer Durchlauf da
      nurTeilweise: fertige.length > 0 && ganze.length === 0,
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
const defState = () => ({ leitner: {}, sessions: [], offen: [], antwortLog: [], pending: [], geloescht: [], mk: {}, mkChat: [], mkChatGeloeschtBis: 0, frageChat: [], settings: { name: "", nta: true, theme: "auto", scoring: window.ST_CONFIG.scoringVariante }, deviceId: "d-" + Math.random().toString(36).slice(2, 10) });
let S = null;
export function state() {
  if (!S) {
    try { S = { ...defState(), ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { S = defState(); }
    if (S.active) { S.offen = [...(S.offen || []), S.active]; delete S.active; } // Migration
    // Migration: die Ei-Wahl lag frueher in settings.mkEi und wurde darum nie
    // gesynct. Muss VOR dem ersten Sync passieren, sonst laedt das Geraet ein
    // leeres Maskottchen hoch und die Ankunft kommt ein zweites Mal.
    S.mk = S.mk || {};
    if (!S.mk.ei && S.settings && S.settings.mkEi) S.mk.ei = S.settings.mkEi;
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
  // Story-Antworten hier genauso ueberspringen wie in werteAus() — sonst holt
  // ein Rebuild (z. B. nach dem Loeschen einer Session) genau die Stufen zurueck,
  // die der Live-Pfad bewusst nicht vergeben hat.
  for (const a of [...st.antwortLog].sort((x, y) => x.ts - y.ts))
    if (a.modus !== STORY_MODUS) leitnerApply(st.leitner, a.qid, a, a.ts);
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

// Pseudo-Sessions: Spiel- und Begriffe-Antworten tragen eine feste sid
// ("spiel"/"begriffe") statt einer echten Session-Id. Fuer Verlauf, Loeschen
// und Merge zaehlen sie wie Einzelantworten (aid-Grabsteine, keine Session).
const PSEUDO_SIDS = new Set(["spiel", "begriffe", "story"]);
export const istEinzelAntwort = (a) => !a.sid || PSEUDO_SIDS.has(a.sid);

// Einzelantworten (Stöbern, Spiele, Begriffe) löschen: die aids wandern als
// Grabsteine in die geloescht-Liste, sonst holt der Merge sie zurück.
export function loescheEinzel(aids) {
  const st = state();
  const weg = new Set(aids);
  st.antwortLog = st.antwortLog.filter((a) => !istEinzelAntwort(a) || !weg.has(a.aid || antwortId(a)));
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
// ---------- Session-Zustand (rein abgeleitet) ----------
// Der EINE Ort, an dem "kann weitergehen" von "ist zu Ende" unterschieden wird
// (Jennifer 12.08.: auf der Startseite sahen ein pausierter und ein
// abgeschlossener, nicht bestandener Durchlauf gleich aus).
// Sechs Zustaende, drei Achsen: wo die Session lebt (offen/sessions), wie
// vollstaendig sie ist (beantwortet vs. anzahl) und wie sie ausging (bestanden/
// abgebrochen). Nichts davon wird gespeichert — sonst fehlte das Feld an
// Sessions, die ueber den Lernstand-Merge von einem anderen Geraet kommen.
//   neu          angelegt, noch keine Frage beantwortet   -> Starten
//   pausiert     mittendrin                                -> Weitermachen
//   abgabebereit alles beantwortet, noch nicht abgegeben   -> Abgeben & auswerten
//   restOffen    abgegeben/abgebrochen, Fragen blieben leer-> Rest bearbeiten
//   offenZiel    fertig, aber unter der Bestehensgrenze    -> Nochmal antreten
//   bestanden    fertig und ueber der Grenze               -> Nochmal (Score)
// Ton: "noch nicht bestanden" / "das Ziel liegt bei N" — nie gescheitert.
export function sessZustand(s) {
  if (!s) return null;
  if (!s.fertig) {
    const n = (s.runde || []).length;
    const done = (s.runde || []).filter((r) => r.gewaehlt).length;
    // "Zum Abgeben", nicht "Abgeben": der Knopf fuehrt in die Runde zurueck, wo
    // der echte Abgeben-Knopf sitzt — ein Label darf keine Aktion versprechen,
    // die es nicht ausfuehrt.
    if (n && done >= n) return { key: "abgabebereit", label: "alles beantwortet", kurz: "abgeben", icon: "📤", cls: "z-abgabe", tat: "Zum Abgeben", lang: "alles beantwortet, noch nicht abgegeben", weiter: true, zuEnde: false };
    if (!done) return { key: "neu", label: "noch nicht angefangen", kurz: "bereit", icon: "▷", cls: "z-neu", tat: "Starten", weiter: true, zuEnde: false };
    return { key: "pausiert", label: "angefangen", kurz: "angefangen", icon: "▶", cls: "z-auf", tat: "Weitermachen", weiter: true, zuEnde: false };
  }
  const abgebrochen = s.status === "abgebrochen";
  const rest = Math.max(0, (s.anzahl || 0) - (s.beantwortet || 0));
  if (s.bestanden) return { key: "bestanden", label: "bestanden", kurz: "bestanden", icon: "✓", cls: "z-ok", tat: "Nochmal antreten", weiter: false, zuEnde: true, abgebrochen };
  if (rest > 0 && s.runde) return { key: "restOffen", label: abgebrochen ? "abgebrochen, Rest offen" : "abgegeben, Rest offen", kurz: "Rest offen", icon: "⏸", cls: "z-rest", tat: "Rest bearbeiten", weiter: true, zuEnde: false, abgebrochen, rest };
  return { key: "offenZiel", label: abgebrochen ? "abgebrochen, gewertet" : "abgeschlossen, noch nicht bestanden", kurz: "abgeschlossen", icon: "◆", cls: "z-zuende", tat: "Nochmal antreten", weiter: false, zuEnde: true, abgebrochen };
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
  /* STAERKE ab 75, nicht ab 80 (14.08.2026). Die App hatte zwei Leitern fuer
     dieselbe Frage: die Balken und Siegel in der Statistik sagen seit dem
     21.07. "ab 75 % sicherer Bereich, ab 90 % Gold", die Auswertung hier sagte
     80. Roses bestes Thema stand am 14.08. bei 79 % — sie sah also ein
     gruenes Siegel und daneben den Satz, es reiche noch nicht fuer eine
     Aussage. Eine Leiter reicht, und es ist die, die schon sichtbar ist. */
  const staerken = belastbar.filter((x) => x.quote >= 75).sort((a, b) => b.quote - a.quote);
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
  /* belastbar faehrt seit dem 14.08. MIT nach draussen (absteigend sortiert).
     Grund: ohne sie konnte analyseHtml nicht unterscheiden, ob gar keine Daten
     da sind oder ob nur kein Thema eine der beiden Schwellen reisst — und hat
     beides gleich beschriftet ("noch zu wenig echte Antworten"). Bei 939
     gewerteten Antworten war dieser Satz schlicht falsch. Wer die Liste hat,
     kann relativ vergleichen, wenn absolut nichts heraussticht. */
  return { staerken, schwaechen, verwechslung: verw, belastbar: belastbar.slice().sort((a, b) => b.quote - a.quote), overallQuote: qual.length ? Math.round(100 * avg(qual.map((r) => r.punkte / r.max))) : null, nQual: qual.length };
}

// ---------- Qualitaet je UEBUNGSTAG (eine einzige Definition) ----------
// Jennifer 22.07.: Fortschritt soll Konstanz zeigen, nicht "immer mehr". Basis
// dafuer ist ueberall dieselbe Zahl: die Punktequote (punkte/max) ueber
// qual-gefilterte Antworten (3-s-Filter + keine Sofort-Wiederholung) — exakt
// das, was auch die Beherrschungs-Balken anzeigen. Bewusst NICHT voll/n aus
// aktivitaetProTag(): das ist ungefiltert und alles-oder-nichts und wuerde neben
// den Prozentzahlen eine zweite, andere Wahrheit erzaehlen.
// Gezaehlt werden nur Tage, an denen wirklich geuebt wurde — Ruhetage werden
// uebersprungen, nicht als 0 eingerechnet. Eine Pause darf die Quote nie druecken.
export const QUAL_FENSTER = 5; // gleitendes Fenster in Uebungstagen
const tagStempel = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };

// [{ ts, n, quote }] je Uebungstag, aufsteigend. Optional auf ein Thema gefiltert.
export function qualProTag(rows) {
  const basis = (rows || logZeilen()).filter((r) => r.plaus && r.max);
  const tage = new Map();
  for (const r of basis) {
    const k = tagStempel(r.ts);
    const e = tage.get(k) || { ts: k, n: 0, summe: 0 };
    e.n++; e.summe += r.punkte / r.max;
    tage.set(k, e);
  }
  return [...tage.values()].sort((a, b) => a.ts - b.ts)
    .map((e) => ({ ts: e.ts, n: e.n, quote: Math.round((100 * e.summe) / e.n), summe: e.summe }));
}

// Gleitender Schnitt ueber die letzten `fenster` Uebungstage — je Uebungstag ein
// Punkt (nach Antworten gewichtet, damit ein Tag mit 3 Karten den Schnitt nicht
// so stark zieht wie einer mit 80).
export function qualVerlauf(tage, fenster = QUAL_FENSTER) {
  return tage.map((t, i) => {
    const s = tage.slice(Math.max(0, i - (fenster - 1)), i + 1);
    const n = s.reduce((a, x) => a + x.n, 0);
    return { ts: t.ts, quote: Math.round((100 * s.reduce((a, x) => a + x.summe, 0)) / n), n };
  });
}

// Schnitt eines Uebungstage-Abschnitts (null, wenn zu duenn fuer eine Aussage)
function abschnitt(tage, minAntworten) {
  const n = tage.reduce((a, x) => a + x.n, 0);
  if (!tage.length || n < minAntworten) return null;
  return { quote: Math.round((100 * tage.reduce((a, x) => a + x.summe, 0)) / n), n };
}

// "Werde ich besser?" (Jennifer 22.07. neu gefasst): letzte QUAL_FENSTER
// Uebungstage gegen die QUAL_FENSTER Uebungstage davor — gesamt und je Thema.
// Frueher war das die aeltere gegen die neuere Haelfte ALLER Antworten; das
// verglich nach Wochen des Uebens immer noch mit dem allerersten Tag und wurde
// dadurch traege. Ruhetage zaehlen nicht mit.
export function entwicklung() {
  const rows = logZeilen().filter((r) => r.plaus && r.max);
  const fenstervergleich = (arr, min) => {
    const tage = qualProTag(arr);
    if (tage.length < 2) return null;
    const jetztTage = tage.slice(-QUAL_FENSTER);
    const vorherTage = tage.slice(Math.max(0, tage.length - 2 * QUAL_FENSTER), tage.length - jetztTage.length);
    const jetzt = abschnitt(jetztTage, min), vorher = abschnitt(vorherTage, min);
    if (!jetzt || !vorher) return null;
    return { vorher: vorher.quote, jetzt: jetzt.quote, delta: jetzt.quote - vorher.quote,
      n: jetzt.n + vorher.n, tage: jetztTage.length };
  };
  const gesamt = fenstervergleich(rows, 5);
  const proThema = Object.entries(gruppiere(rows, (r) => r.thema))
    .map(([thema, arr]) => ({ thema, ...(fenstervergleich(arr, 4) || {}) }))
    .filter((x) => x.n)
    .sort((a, b) => b.delta - a.delta);
  return { gesamt, proThema, fenster: QUAL_FENSTER };
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
    // Uebungstage = Tage mit echter Uebung (Jennifer 22.07.): dieselbe Basis wie
    // die gefaerbten Kalenderzellen — Sofort-Wiederholungen zaehlen nicht als Tag.
    uebungsTage: Object.keys(aktivitaetProTag()).length,
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
//
// Seit dem 12.08. eine eigene Funktion, aus zwei Gruenden:
//   1. snapshot() schreibt dieselbe Zahl in den Querlink-Block. Ueber
//      tagesStand() ginge das nicht ohne Seiteneffekt — das friert per
//      tagesPlan() den Tagesplan ein und ruft save(); beides hat im Sync
//      nichts zu suchen.
//   2. Pille und Zonen-Bar muessen dieselbe Zahl zeigen. Ein zweites,
//      danebengerechnetes n waere genau der Fehler, aus dem die alte
//      Quoten-Pille entstanden ist (siehe geteilt-tagesstand.js).
// Heisst absichtlich genauso wie im GE-Trainer (stats.js heuteAntworten()).
export function heuteAntworten() {
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  const spam = spamAids();
  let n = 0;
  for (const a of state().antwortLog)
    if (a.ts >= heute.getTime() && !spam.has(a.aid || antwortId(a))) n++;
  return n;
}

export function tagesStand() {
  const cfg = window.ST_CONFIG;
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  let tage = null;
  if (cfg.klausurTag) tage = Math.round((new Date(cfg.klausurTag + "T00:00:00") - heute) / 86400000);
  return { n: heuteAntworten(), tage, ...tagesPlan(heute, tage) };
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
/* ---------- Fokus-Woche GE (Jennifer, 20.08.2026) ----------
   BEFRISTET BIS ZUM 26.08.2026 - danach ersatzlos loeschen, samt der drei
   Zeilen unten in tagesPlan. Jennifer woertlich: "die kommende Woche ist GE
   der Fokus. Fuege 50% zu der dynamischen Tageskala hinzu und ziehe 50% bei ST
   ab, fuer 1 Woche." Das Gegenstueck steht in ge-trainer/app/js/stats.js
   (FOKUS_FAKTOR 1,5) - wer hier dreht, muss dort mitziehen, sonst wandert das
   Pensum nur einseitig. Grund: die GE-Klausur ist am 10.09. und damit die
   naehere von beiden; ST hat bis zum 18.09. acht Tage mehr Luft.

   WARUM DER FAKTOR AN DIE BANDGRENZEN MUSS UND NICHT IN DIE ROHRECHNUNG: das
   Ziel ist hier auf 60-100 geklemmt. Ein Faktor weiter innen liefe gegen den
   BODEN von 60 und waere je nach Restbedarf ganz oder halb wirkungslos - Rose
   saehe weiter 60. Deshalb wandert das ganze Band mit auf 30-50, und der
   geschuetzte Boden (minimum) zieht nach; sonst laege er bei 25 und damit fast
   auf dem Tagesziel selbst.

   Nicht angefasst: der Deckel von 140 bei stretch. Er bindet in diesem Band
   ohnehin nicht (50 * 1,25 = 63). */
const FOKUS_VON = "2026-08-20", FOKUS_BIS = "2026-08-26", FOKUS_FAKTOR = 0.5;

function fokusFaktor(d) {
  const m = d.getMonth() + 1, t = d.getDate();
  const tag = d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (t < 10 ? "0" : "") + t;
  return tag >= FOKUS_VON && tag <= FOKUS_BIS ? FOKUS_FAKTOR : 1;
}

function tagesPlan(heute, tage) {
  const st = state();
  const key = heute.toDateString();
  const alt = st.settings.tzPlan;
  if (alt && alt.tag === key && alt.v === 3) return alt;
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
  const fokus = fokusFaktor(heute);
  let ziel = Math.max(r10(60 * fokus), Math.min(r10(100 * fokus), r10(restBedarf * fokus / restTage)));
  if (tage === 1) ziel = Math.min(ziel, r10(50 * fokus));
  const plan = { v: 3, tag: key, ziel, minimum: Math.max(r10(25 * fokus), r10(ziel * 0.35)),
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
/* Der Fragen-Pool einer Runde: alles, was nach den Filtern uebrig bleibt, schon
   auf einen Vertreter je Varianten-Gruppe eingedampft. Also GENAU die Menge, aus
   der baueRunde() danach zieht — laenger kann eine Runde nicht werden.

   Seit dem 19.08.2026 eine eigene Funktion, weil der Baukasten sie VORHER
   braucht: Rose hat 15 Fragen eingestellt und 10 bekommen, ohne dass irgendwo
   stand, warum (Jennifer beim Zuschauen). Die Zahl still zu kuerzen ist die
   unangenehmste Variante — sie sieht aus wie ein Fehler der App oder wie ein
   Fehler von ihr. Sie muss aber aus DERSELBEN Rechnung kommen wie die Runde,
   sonst steht in der Vorschau eine Zahl, die die Runde nicht einloest. Darum
   eine Funktion und zwei Aufrufer, nicht zwei Filterketten. */
export function rundenPool(cfg) {
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
  // Globaler Pingo-Filter: greift in JEDEM Uebungsmodus (Schnellrunde, Baukasten,
  // Wackel-Runde, Unterthema-Blitz, Empfehlungen) — ausser in Klausur-Simulationen
  if (pingoFilterGilt(cfg)) qs = qs.filter(istPingo);
  // Nie zwei Varianten derselben Frage in einer Runde: pro Gruppe genau ein Vertreter
  const grp = (q) => q.sprachVarianteVon || q.variantenVon || q.id;
  const gruppen = new Map();
  for (const q of qs) { const g = grp(q); (gruppen.get(g) || gruppen.set(g, []).get(g)).push(q); }
  // Vertreter-Wahl je Varianten-Gruppe: ungesehene Mitglieder zuerst, darunter
  // nicht-direkte (Roses Wunsch 10.08.): gesehene Wortlaut-Fragen bleiben im
  // Bestand, aber ihre neuen indirekten Geschwister (-aw) kommen bevorzugt dran.
  const Lrep = state().leitner;
  const repRang = (q) => ((Lrep[q.id]?.seen ? 2 : 0) + (q.direktheit === "direkt" ? 1 : 0));
  const reps = [...gruppen.values()].map((arr) => {
    const best = Math.min(...arr.map(repRang));
    const kand = arr.filter((q) => repRang(q) === best);
    return kand[Math.floor(Math.random() * kand.length)];
  });
  return reps;
}
/* Wie lang wird die Runde? Die Zahl, die der Baukasten anzeigt, BEVOR Rose
   startet — als Spanne, weil sie eine Spanne IST.

   Der Pool ist nur die Obergrenze. Danach fallen noch Archiv-Fragen weg, deren
   umgeschriebene Fassung schon in der Runde steht (Jennifers Regel vom 10.08.:
   nie beide zusammen) — und WIE VIELE das sind, haengt daran, welche Vertreter
   gezogen wurden. Gemessen: dieselbe Einstellung lieferte abwechselnd 14 und 15.
   Erst hier stand, die Laenge sei deterministisch; fuenf Messungen hintereinander
   haben das widerlegt. Eine Vorschau, die "15" verspricht und 14 liefert, waere
   schlimmer als die stille Kuerzung, die wir gerade abschaffen.

   Deshalb zwei Zahlen mit klarer Bedeutung:
     sicher     — so viele kommen mit Sicherheit (alle Nicht-Archiv-Fragen)
     hoechstens — mehr koennen es nicht werden
   Meistens sind beide gleich (Archiv-Fragen sind selten), dann steht in der
   Oberflaeche eine einzelne Zahl und niemand muss ueber Spannen nachdenken. */
export function rundenLaenge(cfg) {
  const reps = rundenPool(cfg);
  const n = Math.min(cfg.anzahl || 10, reps.length);
  return { sicher: Math.min(n, reps.filter((q) => !q.archiv).length), hoechstens: n };
}

export function baueRunde(cfg) {
  const reps = rundenPool(cfg);
  // Auswahl-Strategie: wie wird aus dem gefilterten Pool die Runde gebaut?
  //   smart   = Spaced Repetition (Wackliges/Fälliges zuerst, dazu Neues) — die Wissenschaft
  //   fokus   = nur Ungelerntes & Schwieriges, das Härteste zuerst
  //   zufall  = rein zufällig, alle Fragen gleich wahrscheinlich
  //   klausur = repräsentativer Mix über alle Themen wie in der echten Klausur
  // Alt-Configs ohne `auswahl` werden aus den früheren Flags abgeleitet.
  const strat = cfg.auswahl || (cfg.spaced ? "smart" : cfg.nurFehler ? "fokus"
    : (cfg.modus === "klausur" || cfg.modus === "halbe") ? "klausur" : "smart");
  const nMax = Math.min(cfg.anzahl || 10, reps.length);
  const auswahl = waehleFragen(reps, nMax, strat);
  shuffle(auswahl); // Anzeige-Reihenfolge mischen (auch bei Klausur-Mix wie im Ernstfall)
  return auswahl.map((q) => ({ qid: q.id, optOrder: shuffle([...q.optionen.keys()]), gewaehlt: null }));
}

// Strategien der Fragen-Auswahl. reps = ein Vertreter je Varianten-Gruppe.
function waehleFragen(reps, n, strat) {
  n = Math.min(n, reps.length);
  // Archiv-Fragen (alte Wortlaut-Fassungen vor dem Umbau 10.08., archiv:true)
  // kommen IMMER ganz nach hinten: sie fuellen eine Runde nur auf, wenn alle
  // anderen Fragen nicht reichen — und nie zusammen mit ihrer umgeschriebenen
  // Fassung in derselben Runde (Jennifers Regel 10.08.).
  const archiv = reps.filter((q) => q.archiv);
  if (archiv.length) {
    const haupt = waehleFragen(reps.filter((q) => !q.archiv), n, strat);
    if (haupt.length >= n) return haupt;
    const drin = new Set(haupt.map((q) => q.id));
    const frei = shuffle(archiv.filter((q) => !drin.has(q.id.replace(/-alt$/, ""))));
    return haupt.concat(frei.slice(0, n - haupt.length));
  }
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
      if (q.direktheit === "direkt") w *= 0.5;     // Wortlaut-Fragen sind nicht klausurnah
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

  // smart = Spaced Repetition: Wackliges/Fälliges zuerst, dann Neues; Gemeistertes
  // (Level >= 3) kommt erst NACH dem Neuen dran, auch wenn es fällig ist — Roses
  // Wunsch (09.08.): wiederholen soll sich, was wackelt oder neu ist, Gekonntes
  // immer seltener und später.
  // Soll-Abstand in Tagen je Level 0-5; Level < 0 = sofort fällig. Max 14 Tage,
  // damit vor der Klausur (18.09.) alles mindestens noch einmal vorbeikommt.
  const SR_TAGE = [0, 1, 3, 5, 8, 14];
  const jetzt = Date.now();
  const neu = [], faellig = [], faelligStark = [], bald = [];
  for (const q of reps) {
    const e = L[q.id];
    if (!e || !e.seen) { neu.push({ q }); continue; }
    const ueber = (jetzt - (e.ts || 0)) / 86400000 - SR_TAGE[Math.max(0, Math.min(5, e.lvl))];
    (ueber < 0 ? bald : e.lvl >= 3 ? faelligStark : faellig).push({ q, ueber, lvl: e.lvl });
  }
  // Direkte (Wortlaut-)Fragen bei gleichem Level ans Ende — die Klausur fragt
  // nie im Folien-Wortlaut, also sollen indirekte Wiederholungen zuerst kommen.
  const direktNach = (a, b) => ((a.q.direktheit === "direkt") - (b.q.direktheit === "direkt"));
  faellig.sort((a, b) => a.lvl - b.lvl || direktNach(a, b) || b.ueber - a.ueber);
  faelligStark.sort((a, b) => a.lvl - b.lvl || direktNach(a, b) || b.ueber - a.ueber);
  bald.sort((a, b) => direktNach(a, b) || b.ueber - a.ueber);
  // Neue Fragen nicht rein zufällig: Unterthemen, die in der Historie schwach waren,
  // bekommen bevorzugt UNGESEHENE Fragen. Die echte Klausur besteht aus lauter neuen
  // Fragen — gekonnt sein muss das Thema, nicht die (auswendig gelernte) Frage.
  const boost = schwacheUnterthemen();
  // Persoenliche Fragen (an Roses Lebenswelt angedockt, persoenlich:true) kommen
  // bevorzugt frueh dran — Relevanz ist der staerkste Motivations-Hebel.
  const neuSortiert = zieheGewichtet(neu, neu.length, (x) => (boost[x.q.oberthema + "/" + x.q.unterthema] || 1) * (x.q.persoenlich ? 2 : 1) * (x.q.direktheit === "direkt" ? 0.35 : 1));
  neu.length = 0; neu.push(...neuSortiert);
  const out = [];
  const nimm = (arr, limit) => { for (const x of arr) { if (out.length >= limit) return; if (!out.includes(x.q)) out.push(x.q); } };
  nimm(faellig, Math.ceil(n * 0.7)); // max ~70% wacklige Wiederholung, damit immer Neues dabei ist
  nimm(neu, n); nimm(faellig, n); nimm(faelligStark, n); nimm(bald, n);
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
  // Im Session-Snapshot festhalten, ob der Pingo-Filter in dieser Runde WIRKLICH
  // galt — sonst sind spaeter zwei Runden nicht mehr auseinanderzuhalten. In den
  // Simulationen greift er nie, dort muss auch nichts angekreuzt bleiben.
  cfg.nurPingo = pingoFilterGilt(cfg);
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
      // Selbsterklaerung (Block A NextGen): Text + Abgleich + Modus/Nachkommentar
      ...(r.selbst ? { selbstErkl: r.selbst.text || null, selbstAbgleich: r.selbst.abgleich || null, selbstSkip: !!r.selbst.skip,
        ...(r.selbst.modus ? { selbstModus: r.selbst.modus } : {}), ...(r.selbst.text2 ? { selbstErkl2: r.selbst.text2 } : {}),
        // Die zwei Antworten je Option ("warum ausgewaehlt" / "warum falsch")
        // strukturiert mitnehmen, nicht nur als zusammengeklebten Satz in
        // selbstErkl: die Trennung ist der auswertbare Teil (welcher Decoy zieht
        // bei ihr, und erkennt sie ihn hinterher selbst?). Bis zum 19.08.2026
        // ging sie beim Rundenabschluss verloren.
        ...(r.selbst.proOption ? { selbstProOption: r.selbst.proOption } : {}) } : {}),
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
    // nur lokal + im Lernstand-Sync; die Supabase-Tabelle sessions kennt die Spalte nicht
    nurPingo: !!(meta.cfg && meta.cfg.nurPingo),
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
    ...(x.selbstErkl != null || x.selbstAbgleich != null || x.selbstSkip ? { selbstErkl: x.selbstErkl ?? null, selbstAbgleich: x.selbstAbgleich ?? null, selbstSkip: !!x.selbstSkip,
      ...(x.selbstModus ? { selbstModus: x.selbstModus } : {}), ...(x.selbstErkl2 ? { selbstErkl2: x.selbstErkl2 } : {}),
      ...(x.selbstProOption ? { selbstProOption: x.selbstProOption } : {}) } : {}),
    ...(x.paraphrase ? { paraphrase: x.paraphrase } : {}) }));
  // Der Lehrerzimmer-Modus zaehlt NICHT in den Leitner (Jennifer, 13.08.2026).
  // Seine Fragen sind fuer den Erzaehlfluss bewusst leicht gewaehlt; wuerden sie
  // regulaer hochstufen, meldeten "Schlaues Wiederholen" und "Fehler-Training"
  // Stoff als gemeistert, den Rose nicht sicher kann — und genau die zwei Modi
  // muessen am 18.09. tragen. Die Antworten werden trotzdem geloggt (Verlauf,
  // Tagesstand, Statistik), sie bewegen nur den Lernstand nicht.
  // Gegenstueck in rebuildLeitner(): der Wiederaufbau filtert dieselben Zeilen.
  if (STORY_MODUS !== session.modus) for (const x of proFrage) leitnerUpdate(x.qid, x);
  save();
  syncSession(session);
  syncLernstand();
  return session;
}

// Einzeln beantwortete Fragen (Stöbern) UND Spiel-/Begriffe-Runden als
// Tages-Gruppen für den Verlauf — vollwertige Übung, sichtbar und (mit
// aid-Grabsteinen) einzeln löschbar, z. B. nach Test-Antworten.
//
// INVARIANTE (Jennifer 12.08.): Diese Tagesgruppen entstehen NUR hier zur
// Anzeige und landen nie in state().sessions — sie leben ausschliesslich im
// antwortLog. Daran haengt die Trendzeile in der Auswertung (main.js): die
// liest sessions und hat die Dailies damit ohne eigenen Filter schon draussen.
// Wer Begriffe-Blitz, Stoebern, Verwechslungspaare, Operatoren oder Detektiv
// jemals als echte Session speichert, kippt diesen Schnitt still — Karten sind
// deutlich leichter als Klausurfragen (bei Rose 75 % vs. 64 %) und wuerden ihn
// nach oben verfaelschen. Der Rundenschnitt soll Klausurnaehe messen.
const EINZEL_ARTEN = {
  explore: { icon: "🗂", label: "Einzelfragen", badge: "Stöbern" },
  vp: { icon: "🔀", label: "Verwechslungspaare", badge: "Training" },
  op: { icon: "🔎", label: "Operatoren", badge: "Training" },
  detektiv: { icon: "🕵️", label: "Fragen-Detektiv", badge: "Training" },
  begriffe: { icon: "🃏", label: "Begriffe-Blitz", badge: "Training" },
};
export function einzelGruppen() {
  const gruppen = {};
  for (const a of state().antwortLog) {
    if (!istEinzelAntwort(a)) continue;
    const art = EINZEL_ARTEN[a.modus] ? a.modus : "explore";
    const key = new Date(a.ts).toDateString() + "|" + art;
    (gruppen[key] = gruppen[key] || { art, arr: [] }).arr.push(a);
  }
  return Object.values(gruppen).map(({ art, arr }) => {
    const mitMax = arr.filter((x) => x.max);
    return {
      einzel: true, art, ...EINZEL_ARTEN[art],
      id: "einzel-" + art + "-" + arr[0].ts,
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
// ---------- Chatverlauf des Maskottchens (gesynct) ----------
// Bis zum 12.08. lag der Verlauf geraetelokal in localStorage und verfiel mit dem
// Kalendertag. Jennifer will ihn gespeichert und "immer sofort ueber alle Geraete"
// synchron haben — damit ist die alte Entscheidung ("NICHT im Lernstand, nicht im
// Snapshot, nicht in signatur()") aufgehoben. Der Verlauf faehrt jetzt im Lernstand
// mit, mit denselben Regeln wie alles andere hier: Vereinigung ueber stabile Ids,
// nie "der neuere Stand gewinnt".
//
// Form je Nachricht: { id, role: "user" | "assistant", content, ts }
//   role/content heissen absichtlich wie im geteilten Baustein und in der Edge
//   Function — so ist derselbe Array zugleich Anzeige-Zustand und Prompt-Verlauf,
//   ohne Umbau dazwischen (llm.js wirft id und ts beim Senden ohnehin weg).
//   id  ist der Schluessel der Vereinigung. Er laesst sich NICHT wie bei Antworten
//       aus dem Inhalt ableiten: "Was mach ich als Naechstes?" darf zehnmal im
//       Verlauf stehen und ist zehnmal eine eigene Nachricht. Also Zeitstempel plus
//       Zufall. Praefix "c-", damit eine Chat-Id in der geloescht-Liste nie mit
//       einer Session-Id oder einer aid verwechselt wird.
//   ts  ist zugleich die Sortierung, streng monoton vergeben (siehe chatSagen):
//       ein Schnellantwort-Chip schreibt Frage und Antwort in derselben
//       Millisekunde, ohne den Bump stuende die Antwort mal ueber der Frage.
//
// DECKEL: die neuesten MK_CHAT_MAX Nachrichten, gezaehlt — ausdruecklich NICHT nach
// Alter. Ein Altersdeckel haengt an Date.now() und ist damit auf zwei Geraeten nie
// derselbe Schnitt: das eine wirft eine Nachricht raus, das andere reicht sie beim
// naechsten Sync zurueck, das erste wirft sie wieder raus — dasselbe Ping-Pong, das
// weiter unten beim Maskottchen schon einmal Roses Ei-Wahl gekostet hat. "Die
// neuesten 50 der Vereinigung" ist dagegen eine reine Funktion der Daten und auf
// jedem Geraet dieselbe Menge, also nach EINEM Merge konvergent.
// Warum 50: der Prompt sieht ohnehin nur die letzten 20 (MAX_NACHRICHTEN im
// geteilten Baustein) — das sind zwei verschiedene Zahlen mit zwei verschiedenen
// Aufgaben, keine davon ist ein Tippfehler der anderen. 50 haelt die paar
// Gespraeche davor noch lesbar. Zur Groesse: die Kreatur antwortet mit max_tokens
// 300, also rund 1200 Zeichen im schlimmsten Fall — 50 Nachrichten sind damit
// ueblicherweise 20 bis 50 kB, die bei jedem Sync mitfahren. Die 4000 Zeichen
// unten sind nur die Notbremse fuer einen hineinkopierten Text, nicht der
// Normalfall; wird die Zeile trotzdem spuerbar, ist diese Zahl die Stellschraube.
const MK_CHAT_MAX = 50;
const MK_CHAT_ZEICHEN = 4000;

// Deterministischer Notnagel fuer eine Nachricht ohne Id (kann eigentlich nicht
// vorkommen, das Feld ist von Anfang an dabei). Muss deterministisch sein: eine
// zufaellige Ersatz-Id waere bei jedem Merge eine andere und der Verlauf wuerde
// sich mit jedem Sync selbst verdoppeln.
const chatHash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36); };

function chatSauber(m) {
  if (!m || (m.role !== "user" && m.role !== "assistant")) return null;
  if (typeof m.content !== "string" || !m.content.trim()) return null;
  const ts = Number(m.ts) || 0;
  const content = m.content.slice(0, MK_CHAT_ZEICHEN);
  const id = typeof m.id === "string" && m.id ? m.id : "c-" + ts + "-" + m.role[0] + chatHash(content);
  return { id, role: m.role, content, ts };
}

// Sortierung mit Tie-Break ueber die Id: bei gleichem ts (zwei Geraete, zwei
// Nachrichten in derselben Millisekunde) muessen beide Geraete dieselbe Reihenfolge
// waehlen, sonst schneidet der Deckel unterschiedliche Nachrichten weg.
const chatVor = (a, b) => (a.ts - b.ts) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// Vereinigen, Weggewischtes fallen lassen, sortieren, deckeln. Idempotent —
// zweimal angewandt kommt dasselbe raus, darauf beruht die Konvergenz.
function chatNormieren(liste, weg) {
  const m = new Map();
  for (const roh of liste || []) {
    const s = chatSauber(roh);
    // Absicht, kein Nebeneffekt: eine Nachricht ohne Zeitstempel (ts = 0) faellt
    // hier durch, weil weg mindestens 0 ist. Ohne ts laesst sie sich weder
    // einsortieren noch gegen die Wasserlinie pruefen — sie kann nur aus einem
    // kaputten Stand stammen.
    if (!s || s.ts <= (weg || 0)) continue;
    m.set(s.id, s);
  }
  return [...m.values()].sort(chatVor).slice(-MK_CHAT_MAX);
}

export const chatVerlauf = () => chatNormieren(state().mkChat, state().mkChatGeloeschtBis);

// Eine Nachricht anhaengen und SOFORT syncen. Das "sofort" ist Jennifers Wort:
// syncBald() waere hier falsch, ein Chat ist der Ort, an dem man das andere Geraet
// unmittelbar erwartet. syncLernstand() bricht nichts ab, es haengt sich hinten an
// die laufende Kette (und schluckt einen zweiten Aufruf, wenn schon einer wartet).
export function chatSagen(role, content) {
  const st = state();
  const liste = chatNormieren(st.mkChat, st.mkChatGeloeschtBis);
  const letzte = liste.length ? liste[liste.length - 1].ts : 0;
  // Monoton: neuer als die letzte Nachricht UND neuer als der Loesch-Stand, sonst
  // wischt der naechste Merge weg, was gerade erst getippt wurde.
  const ts = Math.max(Date.now(), letzte + 1, (st.mkChatGeloeschtBis || 0) + 1);
  const eintrag = chatSauber({ id: "c-" + ts + "-" + Math.random().toString(36).slice(2, 8), role, content, ts });
  if (!eintrag) return null;
  liste.push(eintrag);
  st.mkChat = liste.slice(-MK_CHAT_MAX);
  save();
  syncLernstand();
  return eintrag;
}

// Verlauf wegwischen. Rose koennte hier etwas Persoenliches getippt haben, also
// muss das loeschbar sein — und ohne Grabstein waere es das nur scheinbar: beim
// naechsten Sync brachte das andere Geraet alles zurueck.
//
// Grabstein ist hier KEINE Id-Liste wie bei den Antworten, sondern eine
// Wasserlinie: "alles bis einschliesslich diesem Zeitstempel ist weg". Zwei
// Gruende. Erstens bliebe sonst fuer jede geloeschte Nachricht eine Id in
// geloescht stehen, und diese Liste wird nie wieder kuerzer — 50 Ids pro
// Wegwischen, dauerhaft im Lernstand. Zweitens ist Wegwischen hier immer alles
// auf einmal; einzelne Zeilen zu loeschen gibt es nicht.
// Die Wasserlinie merged per Math.max und erwischt damit auch Nachrichten, die ein
// anderes Geraet offline vor dem Wegwischen geschrieben hat und erst danach
// hochlaedt. Das ist gewollt: "weg" heisst weg, auch das Nachgereichte.
export function chatVerlaufLoeschen() {
  const st = state();
  const juengste = (st.mkChat || []).reduce((m, x) => Math.max(m, Number(x.ts) || 0), 0);
  st.mkChatGeloeschtBis = Math.max(st.mkChatGeloeschtBis || 0, juengste, Date.now());
  st.mkChat = [];
  save();
  syncLernstand();
  return st.mkChatGeloeschtBis;
}

/* ---------- Gespraeche ZUR FRAGE (Jennifer, 13.08.2026) ----------
   Bis hierher waren alle KI-Gespraeche ueber eine Frage fluechtig: llm.js hielt
   sie in einer Map im Speicher, mit dem ausdruecklichen Kommentar "bewusst nicht
   persistiert". Beim Neuladen weg, auf dem zweiten Geraet nie da. Dasselbe galt
   fuer die KI-Rueckmeldung auf Roses Selbsterklaerung: angezeigt und danach
   verloren. Jennifers Auftrag: aufheben und an die beantwortete Einheit haengen.

   WARUM EIN EIGENER SPEICHER UND KEIN FELD AN DER ANTWORT.
   Das waere der naheliegende Weg (ergaenzeAntwort(aid, {...})) und er verliert
   Daten. mergeLernstand vereinigt den antwortLog ueber die aid, aber pro Eintrag
   gewinnt die LOKALE Fassung als Ganzes (`log.set(aid, a)`, remote zuerst). Ein
   Feld, das nur auf dem Handy dazukam, faellt auf dem Tablet beim naechsten Merge
   also einfach heraus — die Antwort ist ja "schon da". Nachrichten dagegen sind
   einzelne Zeilen mit eigener Id, und die lassen sich vereinigen, ohne dass
   irgendjemand etwas verwirft. Genau wie beim mkChat.

   ART trennt zwei Dinge im selben Speicher, weil sie dieselbe Mechanik brauchen:
     "frage"    das Gespraech aus "Ueber diese Frage sprechen" (user + assistant)
     "feedback" die KI-Rueckmeldung auf Roses eigene Erklaerung (nur assistant,
                in aller Regel genau eine Zeile je Antwort)

   GELOESCHT WIRD MIT DER ANTWORT, nicht getrennt. Es gibt darum keine zweite
   Wasserlinie wie beim mkChat: der Grabstein, den loeschSession/loeschEinzel
   ohnehin setzen, raeumt das Gespraech gleich mit weg. Die Zeile traegt dafuer
   sid UND aid mit sich — nach welcher der beiden Ids getilgt wurde, weiss sie
   sonst nicht.

   ZWEI DECKEL, beide deterministisch, damit zwei Geraete nach EINEM Merge
   dieselbe Menge haben: je Frage die letzten 30 (ein Gespraech, kein Archiv),
   ueber alles die letzten 400 (der Lernstand faehrt bei jedem Sync mit). */
const FQ_PRO_FRAGE = 30;
const FQ_MAX = 400;

function fqSauber(m) {
  if (!m || (m.role !== "user" && m.role !== "assistant")) return null;
  if (typeof m.content !== "string" || !m.content.trim()) return null;
  if (typeof m.aid !== "string" || !m.aid) return null;
  const ts = Number(m.ts) || 0;
  const content = m.content.slice(0, MK_CHAT_ZEICHEN);
  const art = m.art === "feedback" ? "feedback" : "frage";
  const id = typeof m.id === "string" && m.id ? m.id : "f-" + ts + "-" + m.role[0] + chatHash(m.aid + content);
  return { id, aid: m.aid, qid: m.qid || null, sid: m.sid || null, art, role: m.role, content, ts };
}

// Vereinigen, Getilgtes fallen lassen, sortieren, beide Deckel anwenden.
// Idempotent — zweimal angewandt kommt dasselbe raus, darauf beruht die Konvergenz.
function fqNormieren(liste, tot) {
  const m = new Map();
  for (const roh of liste || []) {
    const s = fqSauber(roh);
    if (!s || !s.ts) continue;
    if (tot && (tot.has(s.aid) || (s.sid && tot.has(s.sid)))) continue;
    m.set(s.id, s);
  }
  const alle = [...m.values()].sort(chatVor);
  // Deckel je Frage zuerst: sonst frisst ein einzelnes langes Gespraech den
  // globalen Deckel auf und loescht die Gespraeche aller anderen Fragen.
  const proAid = new Map();
  for (const x of alle) {
    const arr = proAid.get(x.aid) || [];
    arr.push(x);
    proAid.set(x.aid, arr);
  }
  const behalten = new Set();
  for (const arr of proAid.values()) for (const x of arr.slice(-FQ_PRO_FRAGE)) behalten.add(x.id);
  return alle.filter((x) => behalten.has(x.id)).slice(-FQ_MAX);
}

// Alle Zeilen zu EINER beantworteten Einheit, in Reihenfolge.
export const frageChat = (aid, art) => (state().frageChat || [])
  .filter((m) => m.aid === aid && (!art || m.art === art))
  .slice().sort(chatVor);

// Gibt es zu dieser Antwort ueberhaupt ein Gespraech? Fuer die Marke im Verlauf,
// damit die Historie nicht fuer jede Zeile die ganze Liste durchsucht.
export const frageChatAids = () => new Set((state().frageChat || []).map((m) => m.aid));

/* An WELCHE Einheit ein Gespraech geht. Antwort: an die zuletzt gegebene Antwort
   auf genau diese Frage — das ist die "beantwortete Einheit", von der Jennifer
   spricht, und sie ist genau die Zeile, die im Verlauf steht.

   WAEHREND EINER LAUFENDEN RUNDE gibt es die aid noch gar nicht: die Antworten
   einer Runde stehen bis zum Abschluss in der Session und wandern erst dann in
   den antwortLog, wo sie ihre aid bekommen. Ein Gespraech mitten in der Runde
   kann also nicht an "diesen Versuch" gehaengt werden — den gibt es als Zeile
   noch nicht. Darum ist die qid der tragende Anker (jede Zeile traegt sie mit)
   und die aid nur der genauere Zusatz, wo es ihn schon gibt.

   sidJetzt ist die laufende Session. Sie muss mit, damit ein spaeteres Loeschen
   der Session das Gespraech mitnimmt — der Grabstein greift ueber die sid, und
   ohne sie bliebe das Gespraech einer geloeschten Runde stehen.

   sidJetzt SCHLAEGT die Session der alten Antwort, und das ist der ganze Witz an
   der Zeile. Uebt Rose eine Frage ein zweites Mal (Fehler-Training, Spaced,
   PK-Wiederholung), dann ist neuste die Antwort aus der ALTEN Runde. Stuende
   deren sid hier, haette das Gespraech von heute den Grabstein von gestern:
   Loeschen der alten Runde raeumte ein Gespraech weg, das in der neuen
   stattfand, und Loeschen der neuen liesse es stehen. Beides falsch herum, und
   es trifft nicht den Rand, sondern den Normalfall — Wiederholen ist das,
   wofuer die App gebaut ist. Wer gerade redet, bestimmt also die Zugehoerigkeit. */
export function frageChatAid(qid, sidJetzt) {
  let neuste = null;
  for (const a of state().antwortLog) {
    if (a.qid !== qid) continue;
    if (!neuste || (a.ts || 0) > (neuste.ts || 0)) neuste = a;
  }
  return neuste
    ? { aid: neuste.aid || antwortId(neuste), sid: sidJetzt || neuste.sid || null }
    : { aid: "q:" + qid, sid: sidJetzt || null };
}

// Alles, was jemals zu DIESER Frage besprochen wurde, versuchsuebergreifend.
// Fuer die Frage-Ansicht; der Verlauf liest dagegen ueber die aid eines Versuchs.
export const frageChatZuFrage = (qid) => (state().frageChat || [])
  .filter((m) => m.qid === qid)
  .slice().sort(chatVor);

// Eine Zeile anhaengen und SOFORT syncen — dieselbe Begruendung wie bei
// chatSagen(): ein Gespraech ist der Ort, an dem man das andere Geraet
// unmittelbar erwartet. Ohne aid wird nichts gespeichert (eine Zeile, die an
// keiner Antwort haengt, findet nie wieder jemand).
export function frageChatSagen({ aid, qid, sid, art, role, content }) {
  if (!aid) return null;
  const st = state();
  const liste = st.frageChat || [];
  const letzte = liste.reduce((mx, x) => Math.max(mx, Number(x.ts) || 0), 0);
  const ts = Math.max(Date.now(), letzte + 1);
  const eintrag = fqSauber({ id: "f-" + ts + "-" + Math.random().toString(36).slice(2, 8), aid, qid, sid, art, role, content, ts });
  if (!eintrag) return null;
  st.frageChat = fqNormieren([...liste, eintrag], new Set(st.geloescht));
  save();
  syncLernstand();
  return eintrag;
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
  // pending/deviceId/settings bleiben lokal — die gehoeren dem Geraet, nicht dem Lernstand.
  // mk (Maskottchen) gehoert dagegen SEHR WOHL dazu: das gewaehlte Ei ist eine
  // Entscheidung ueber den Begleiter, kein Geraete-Kram. Lag frueher faelschlich in
  // settings.mkEi und ist darum nie gesynct — auf einem zweiten Geraet kam die
  // Ankunft dann ein zweites Mal. Container, damit spaeter Stufe/Kleidung reinpassen.
  //
  // heute: der Tagesfortschritt fuer den Querlink im GE-Trainer. Geteilter
  // Vertrag, Begruendung und Format in geteilt-tagesstand.js. Drei Dinge daran
  // sind Absicht:
  //   - ABGELEITET, nicht gespeichert: entsteht hier aus dem antwortLog, das an
  //     dieser Stelle schon vereinigt ist. Darum braucht er keine Merge-Regel.
  //   - NICHT in signatur(): heute.n bewegt sich nur, wenn eine Antwort
  //     dazukommt — und die aendert die Signatur ohnehin. Der Block reist
  //     huckepack. Stuende tag drin, gaebe es pro Geraet und Tag einen Push ins
  //     Leere um Mitternacht.
  //   - Der Plan wird nur genommen, wenn er von HEUTE ist. Sonst traegt der
  //     Block ein heutiges Datum mit gestrigem Ziel, und drueben stuende eine
  //     Zahl, die es nie gab.
  const plan = st.settings.tzPlan;
  const heuteKey = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toDateString(); })();
  const heute = plan && plan.tag === heuteKey
    ? heuteBlock(heuteAntworten(), plan, offenZaehler ? offenZaehler() : null) : null;
  // mkChat: der Chatverlauf faehrt mit (Jennifer, 12.08.). Hier normiert und nicht
  // roh durchgereicht, damit auf dem Server nie mehr steht als der Deckel erlaubt —
  // auch dann nicht, wenn der lokale Stand aus einem alten Backup importiert wurde.
  // frageChat: die Gespraeche zu einzelnen Fragen. Wie mkChat hier normiert und
  // nicht roh durchgereicht — der Deckel gilt auf dem Server wie lokal, auch wenn
  // der lokale Stand aus einem alten Backup kam. Getilgtes faellt dabei gleich mit
  // raus: nach einem Loeschen soll die naechste Zeile nicht das Gespraech einer
  // Antwort hochladen, die es nicht mehr gibt.
  return { sessions: st.sessions, antwortLog: st.antwortLog, offen: st.offen,
    geloescht: st.geloescht, mk: st.mk || {},
    mkChat: chatNormieren(st.mkChat, st.mkChatGeloeschtBis),
    mkChatGeloeschtBis: st.mkChatGeloeschtBis || 0,
    frageChat: fqNormieren(st.frageChat, new Set(st.geloescht)),
    ...(heute ? { heute } : {}) };
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
    // Das Maskottchen MUSS hier mit rein: die Signatur ist der Waechter vor dem
    // Push (`signatur(remote) !== signatur(neu)`). Ohne diese Zeile aendert eine
    // reine Ei-Wahl die Signatur nicht und wird nie hochgeladen. Auf "" normiert,
    // damit eine alte Server-Zeile ohne mk nicht dauerhaft als verschieden gilt.
    // ts gehoert mit rein: waehlt jemand dasselbe Ei erneut, ist das eine neue
    // Wahl und muss den Server erreichen, sonst gewinnt dort der aeltere Stempel.
    // stufeMax gehoert ebenfalls hier rein und NICHT nur in den Snapshot: erreicht
    // Rose auf dem Handy eine neue Stufe, aendert sich sonst die Signatur nicht,
    // es wird nie gepusht, und auf dem Tablet faellt das Tier zurueck.
    // geschluepft gehoert aus demselben Grund hierher wie stufeMax, nur noch
    // dringender: es aendert sich durch einen KNOPFDRUCK, ohne dass eine neue
    // Antwort dazukommt. Es kann also nicht huckepack auf antwortLog reisen wie
    // der heute-Block. Stuende es nur im Snapshot, wuerde es nie gepusht — und
    // Rose saehe das Schluepfen auf dem Tablet ein zweites Mal, obwohl es
    // ausdruecklich genau einmal vorkommen soll (Jennifer, 12.08.).
    // herzenMax/sterneMax stehen aus demselben Grund hier wie stufeMax: sie
    // bewegen sich beim Zeichnen der Blase, ohne dass zwingend eine neue Antwort
    // dazukommt (das Tagesziel kann sich auch ueber Nacht verschoben haben).
    // Auf 0 normiert, damit eine Server-Zeile aus der Zeit davor nicht dauerhaft
    // als verschieden gilt und jeden Start einen Push ausloest.
    ((d.mk && d.mk.ei) || "") + ":" + ((d.mk && d.mk.ts) || 0) + ":" + ((d.mk && d.mk.stufeMax) || 0) +
      ":" + ((d.mk && d.mk.geschluepft) || 0) +
      ":" + ((d.mk && d.mk.herzenMax) || 0) + ":" + ((d.mk && d.mk.sterneMax) || 0),
    // Der Chatverlauf. Er MUSS hier stehen, sonst passiert bei einer neuen
    // Nachricht gar nichts: der Push-Waechter unten vergleicht nur Signaturen, und
    // ein Feld, das nur im Snapshot steht, geht nie hoch. Genau daran haengt
    // Jennifers "immer sofort syncen". Die Ids reichen — Nachrichten werden nie
    // nachtraeglich geaendert, nur angehaengt oder weggewischt.
    ids(d.mkChat, (m) => m.id),
    // Die Loesch-Wasserlinie steht aus demselben Grund hier wie geschluepft: sie
    // kann sich per Knopfdruck bewegen, ohne dass sich eine Id-Liste aendert (zwei
    // Wegwischen hintereinander, das zweite auf einem schon leeren Verlauf). Ohne
    // diese Zeile bliebe das Wegwischen auf dem einen Geraet stehen.
    (d.mkChatGeloeschtBis || 0),
    // Die Gespraeche zu den Fragen, aus demselben Grund wie mkChat: ein Feld, das
    // nur im Snapshot steht, wird nie gepusht, weil der Waechter vor dem Push nur
    // Signaturen vergleicht. Ohne diese Zeile bliebe jedes Gespraech auf dem
    // Geraet, auf dem es getippt wurde. Die Ids reichen — Zeilen werden nie
    // geaendert, nur angehaengt oder mit ihrer Antwort getilgt.
    ids(d.frageChat, (m) => m.id),
  ].join("|");
}

// Nur fuer scripts/test-merge.mjs: der Push-Waechter in einSync haengt an
// signatur(), und ein Fehler dort ist von aussen unsichtbar (es wird einfach nie
// gepusht). Damit laesst sich genau das pruefen.
export const __snapshotFuerTest = () => snapshot();
export const __signaturFuerTest = (d) => signatur(d);

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
    // Einzelantworten (ohne sid — und Spiel-/Begriffe-Antworten mit Pseudo-sid)
    // tragen ihre aid als Grabstein in derselben Liste — alte App-Versionen
    // reichen unbekannte Ids einfach mit weiter (Union)
    if (istEinzelAntwort(a) && tot.has(a.aid || antwortId(a))) continue;
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

  // Maskottchen: die ZULETZT getroffene Wahl gilt.
  //
  // Erste Fassung war "wer einen Wert hat, behaelt ihn". Das schuetzt zwar davor,
  // dass eine Wahl geloescht wird, hat aber kein Konvergenz-Kriterium: zwei
  // Geraete mit verschiedenen Eiern behalten beide ihres und ueberschreiben beim
  // Push das jeweils andere — Ping-Pong ohne Ende. Genau das ist am 12.08.
  // passiert (Roses "karo" wurde zwei Sekunden spaeter von einem zweiten Geraet
  // mit "ringe" ueberschrieben).
  //
  // Anders als bei Antworten und Sessions gibt es hier keine Vereinigung: ein
  // Einzelwert laesst sich nicht zusammenfuehren, man muss sich entscheiden. Das
  // einzig sinnvolle Kriterium ist der Zeitpunkt der Wahl. Altbestand ohne ts
  // zaehlt als 0 und verliert damit gegen jede bewusst getroffene Wahl; bei
  // Gleichstand bleibt der lokale Wert stehen.
  st.mk = st.mk || {};
  const rMk = remote.mk || {};
  if (rMk.ei && (rMk.ts || 0) > (st.mk.ts || 0)) { st.mk.ei = rMk.ei; st.mk.ts = rMk.ts || 0; }
  else if (!st.mk.ei && rMk.ei) { st.mk.ei = rMk.ei; st.mk.ts = rMk.ts || 0; }
  // stufeMax dagegen NICHT nach Zeitstempel: das ist kein Wert, sondern ein
  // Zaehlwerk, das nur steigen darf. Nach ts-Regel koennte ein Geraet mit
  // niedrigerer, aber neuerer Stufe die hoehere ueberschreiben — also genau der
  // Rueckfall, den stufeMax verhindern soll. Darum bedingungslos das Maximum.
  st.mk.stufeMax = Math.max(st.mk.stufeMax || 0, rMk.stufeMax || 0);
  // herzenMax und sterneMax sind Zaehlwerke wie stufeMax und folgen derselben
  // Regel: bedingungslos das Maximum, NIE nach Zeitstempel. Zwei Geraete rechnen
  // am selben Tag verschiedene Herzenzahlen aus (settings.tzPlan ist
  // geraetelokal) — nach ts-Regel wuerde das zuletzt geoeffnete Geraet den
  // hoeheren Stand des anderen ueberschreiben, also genau der Rueckfall, den die
  // Sperrklinke verhindern soll. Grosszuegig ist hier richtig: ein Herz zu viel
  // ist harmlos, eines zu wenig fuehlt sich wie Betrug an.
  st.mk.herzenMax = Math.max(st.mk.herzenMax || 0, rMk.herzenMax || 0);
  st.mk.sterneMax = Math.max(st.mk.sterneMax || 0, rMk.sterneMax || 0);
  // geschluepft ist ein Ereignis-Protokoll, kein Messwert: "hat Rose die
  // Animation gesehen" laesst sich aus der Historie nicht ausrechnen (anders als
  // "ist Stufe 3 erreicht"). Die Regel ist ein ODER — hat es IRGENDEIN Geraet
  // gesehen, gilt es als gesehen. Gespeichert wird der frueheste Zeitpunkt,
  // damit der Wert stabil bleibt und nicht bei jedem Merge hin und her springt.
  const gs = [st.mk.geschluepft, rMk.geschluepft].filter(Boolean);
  if (gs.length) st.mk.geschluepft = Math.min(...gs);

  // Chatverlauf: Vereinigung ueber die Ids, sortiert nach Zeit, dann der Deckel.
  // Kein "der laengere Verlauf gewinnt" und erst recht kein Ersetzen — Rose tippt
  // am Handy weiter, waehrend auf dem Tablet noch das Gespraech von vorhin steht,
  // und danach muessen beide Haelften da sein.
  // Die Wasserlinie wird ZUERST vereinigt (Maximum), damit der Filter in
  // chatNormieren schon den geloeschten Stand kennt und Weggewischtes nicht erst
  // wieder hereinlaeuft. Reihenfolge remote-vor-lokal: bei gleicher Id gewinnt die
  // lokale Fassung, der Inhalt ist bei gleicher Id ohnehin derselbe.
  // Ein alter Stand ohne diese Felder ist kein Loeschbefehl: `|| []` bzw. `|| 0`,
  // der lokale Verlauf bleibt stehen. Umgekehrt kann eine App-Version ohne mkChat
  // die Server-Zeile zwar ohne Verlauf ueberschreiben — das naechste Geraet mit
  // dieser Version bringt ihn durch die Vereinigung von selbst zurueck.
  st.mkChatGeloeschtBis = Math.max(st.mkChatGeloeschtBis || 0, remote.mkChatGeloeschtBis || 0);
  st.mkChat = chatNormieren([...(remote.mkChat || []), ...(st.mkChat || [])], st.mkChatGeloeschtBis);

  // Gespraeche zu einzelnen Fragen: dieselbe Vereinigung ueber die Ids. Kein
  // Ersetzen und kein "der laengere gewinnt" — Rose kann am Handy zu Frage A
  // gechattet haben, waehrend auf dem Tablet das Gespraech zu Frage B steht, und
  // danach muessen beide da sein. Getilgt wird ueber dieselbe geloescht-Liste,
  // die oben schon die Antworten raeumt: `tot` ist an dieser Stelle bereits die
  // vereinigte Fassung beider Geraete, ein Loeschen auf dem einen wirkt also
  // sofort auch auf die Gespraeche, die vom anderen kommen.
  st.frageChat = fqNormieren([...(remote.frageChat || []), ...(st.frageChat || [])], tot);

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
