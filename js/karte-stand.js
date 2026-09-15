/* ==========================================================================
   Lern-Ereignisse der Schultheorie-Karte (karte.html) — NUR GELESEN  (15.09.2026)
   ==========================================================================
   Die Karte loggt jede Mini-Uebung als Ereignis: lokal in
   localStorage["karte.ereignisse"] (gleicher Origin wie der Trainer) und in der
   Supabase-Tabelle karten_events (raum "rose"). Der Trainer zeigt daraus zwei
   Dinge: eine Zeile je Kapitel und Tag in der "Zuletzt"-Liste und die
   geloesten Einheiten des Tages im Tagesziel.

   Was hier NICHT passiert, und zwar absichtlich: nichts davon wandert in
   state(), in den Lernstand, in snapshot() oder signatur(). Die Ereignisse
   bleiben Sache der Karte; der Trainer liest sie und rechnet sie beim Anzeigen
   dazu. heuteAntworten() in core.js bleibt die reine antwortLog-Zahl, weil
   snapshot() sie in den Querlink-Block des GE-Trainers schreibt.

   Einheiten (eine Einheit = eine abgeschlossene Mini-Uebung):
     hoeren    Kapitel zu Ende gehoert, ziel = Track          immer geloest
     quiz      Aeste in die Mind-Map, ziel = Thema | gesamt   geloest ab punkte >= von
     begriffe  eine Begriffe-Gruppe, ziel = "<track>:<gi>"   geloest ab punkte >= von
     gquiz     eine Grafik, ziel = "<thema>:<i>"             geloest ab 70 Prozent
   Die Sammel-Ereignisse (begriffe/gquiz mit ziel OHNE Doppelpunkt) melden nur
   "alle Gruppen dieses Tracks durch" und zaehlen NICHT noch einmal. fragen
   (die Trainer-Runde, im Trainer laengst als Session geloggt) und reset werden
   ignoriert. Die Bestanden-Regel ist woertlich die aus karte/shell.html.

   Dieselbe Einheit mehrmals am Tag (Begriffe-Gruppe erst 3/5, dann 5/5) ist
   EINE Einheit, geloest, sobald ein Versuch des Tages sitzt. So liest sich
   "4 von 5 Einheiten" als Inventar und nicht als Versuchszaehler, und ein
   dreimal gehoertes Kapitel blaest das Tagesziel nicht auf.

   Datenquelle: lokal plus einmal pro Seitenaufbau ein GET auf karten_events
   der letzten 14 Tage (nur wenn der Sync an ist, also nie auf localhost);
   Fehler werden still geschluckt, dann gibt es nur die lokalen. Dedupe per id.
   Das 14-Tage-Fenster gilt auch lokal, damit Handy und Laptop dieselben
   Zeilen zeigen. */
import * as C from "./core.js";

const FENSTER_MS = 14 * 86400000;
let remote = [];        // Server-Zeilen, einmal geholt
let titel = {};         // track -> Kapiteltitel (hoeren/manifest.json)
let grafikTrack = {};   // "<thema>:<i>" -> track, aus den grafiken-Listen des Manifests
let ladePromise = null;

function lokal() {
  try {
    const v = localStorage.getItem("karte.ereignisse");
    const a = v ? JSON.parse(v) : [];
    return Array.isArray(a) ? a : [];
  } catch { return []; }
}

// Lokal steht ts in Millisekunden, vom Server kommt ein timestamptz-String.
function tsMs(e) {
  const t = e && e.ts;
  if (typeof t === "number") return t;
  const p = Date.parse(t);
  return Number.isFinite(p) ? p : 0;
}

/* Manifest und Server-Ereignisse holen. Liefert true, wenn sich dadurch an
   der Anzeige etwas aendert (Server-Zeilen, oder Kapiteltitel fuer schon
   lokal vorhandene Zeilen) — dann lohnt ein Neuzeichnen der Startseite.
   Mehrfach aufgerufen laeuft es nur einmal. */
export function lade() {
  if (ladePromise) return ladePromise;
  ladePromise = (async () => {
    let neu = false;
    try {
      const r = await fetch("hoeren/manifest.json");
      if (r.ok) { manifestEinlesen(await r.json()); neu = tagesZeilen().length > 0; }
    } catch { /* ohne Manifest bleiben Track-Ids als Titel */ }
    if (C.syncAktiv()) {
      try {
        const cfg = window.ST_CONFIG;
        const seit = new Date(Date.now() - FENSTER_MS).toISOString();
        const url = `${cfg.supabaseUrl}/rest/v1/karten_events?raum=eq.rose&select=id,art,ziel,punkte,von,ts&ts=gte.${encodeURIComponent(seit)}&order=ts.desc&limit=1000`;
        const r = await fetch(url, { headers: { apikey: cfg.supabaseAnonKey, Authorization: "Bearer " + cfg.supabaseAnonKey } });
        if (r.ok) {
          const rows = await r.json();
          if (Array.isArray(rows)) { remote = rows; neu = neu || rows.length > 0; }
        }
      } catch { /* still: dann nur lokal */ }
    }
    return neu;
  })();
  return ladePromise;
}

function manifestEinlesen(m) {
  if (!m || typeof m !== "object") return;
  titel = {}; grafikTrack = {};
  for (const [track, info] of Object.entries(m)) {
    if (info && info.titel) titel[track] = String(info.titel);
    const thema = track.split("-")[0];
    for (const i of (info && info.grafiken) || []) {
      const key = thema + ":" + i;
      /* Eine Grafik kann in zwei Kapiteln stehen: die Karte zeigt eine vom
         Ueberblick selbst angesagte Grafik dort UND im eigenen Kapitel
         (grafikenVon in karte/shell.html). Hier gewinnt das Kapitel, das nicht
         der Ueberblick ist, weil Rose die Grafik in der Regel dort loest, wo
         sie hingehoert; ohne Treffer faellt es unten auf den Ueberblick zurueck. */
      if (!grafikTrack[key] || grafikTrack[key].endsWith("-ueberblick")) grafikTrack[key] = track;
    }
  }
}

/* Manifest-Titel sind zwei Saetze ("Schulqualitaet, Kapitel sechs: Effektive
   Schulen. Mehr Zuwachs, als ..."); in der Zuletzt-Zeile reicht der erste. */
export function titelVon(track) {
  const t = titel[track];
  if (!t) return track;
  const m = t.match(/^(.*?[^.])\.(\s|$)/);
  return (m ? m[1] : t).trim();
}

// Woertlich die Regel aus karte/shell.html (bestanden).
const bestanden = (art, punkte, von) =>
  art === "hoeren" || (von > 0 && (art === "gquiz" ? punkte / von >= 0.7 : punkte >= von));

// Ereignis -> Einheit { track, key, geloest } oder null (zaehlt nicht)
function einheit(e) {
  const art = e.art, ziel = String(e.ziel == null ? "" : e.ziel);
  if (!ziel) return null;
  const ok = bestanden(art, +e.punkte || 0, +e.von || 0);
  if (art === "hoeren") return { track: ziel, key: "hoeren:" + ziel, geloest: true };
  if (art === "quiz") return { track: ziel === "gesamt" ? "gesamt" : ziel + "-ueberblick", key: "quiz:" + ziel, geloest: ok };
  if (art === "begriffe") {
    if (!ziel.includes(":")) return null;   // Sammel-Ereignis
    return { track: ziel.split(":")[0], key: "begriffe:" + ziel, geloest: ok };
  }
  if (art === "gquiz") {
    if (!ziel.includes(":")) return null;   // Sammel-Ereignis
    const thema = ziel.split(":")[0];
    return { track: grafikTrack[ziel] || thema + "-ueberblick", key: "gquiz:" + ziel, geloest: ok };
  }
  return null;   // fragen, reset, Unbekanntes
}

/* Alle zaehlbaren Einheiten der letzten 14 Tage, lokal + Server, dedupliziert
   per id, ts normalisiert auf Millisekunden. */
export function einheiten() {
  const seit = Date.now() - FENSTER_MS;
  const gesehen = new Set();
  const out = [];
  for (const e of [...lokal(), ...remote]) {
    if (!e || typeof e !== "object") continue;
    const ts = tsMs(e);
    const id = e.id || `${e.art}:${e.ziel}:${ts}`;
    if (gesehen.has(id)) continue;
    gesehen.add(id);
    if (ts < seit) continue;
    const u = einheit(e);
    if (u) out.push({ ...u, ts });
  }
  return out;
}

/* Fuers Tagesziel: wie viele verschiedene Einheiten heute geloest sind.
   Nicht Geloestes ist ein Versuch und zaehlt hier nicht — das Tagesziel misst
   Fortschritt. Wird in core.js als Zaehler angemeldet (setzeKarteZaehler). */
export function heuteGeloest() {
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  const geloest = new Set();
  for (const u of einheiten()) if (u.ts >= heute.getTime() && u.geloest) geloest.add(u.key);
  return geloest.size;
}

/* Fuer die Zuletzt-Liste: eine Zeile je Kapitel (Track) und Kalendertag.
   n = verschiedene Einheiten an dem Tag, geloest = davon gesessen. ts ist das
   letzte Ereignis der Gruppe (so sortiert sich die Zeile wie eine Session),
   erstellt das erste. */
export function tagesZeilen() {
  const gruppen = new Map();
  for (const u of einheiten()) {
    const tag = new Date(u.ts).toDateString();
    const k = u.track + "|" + tag;
    let z = gruppen.get(k);
    if (!z) { z = { track: u.track, tag, ts: u.ts, erstellt: u.ts, stand: new Map() }; gruppen.set(k, z); }
    if (u.ts > z.ts) z.ts = u.ts;
    if (u.ts < z.erstellt) z.erstellt = u.ts;
    z.stand.set(u.key, !!(z.stand.get(u.key) || u.geloest));
  }
  return [...gruppen.values()].map((z) => ({
    track: z.track, titel: titelVon(z.track), tag: z.tag, ts: z.ts, erstellt: z.erstellt,
    n: z.stand.size, geloest: [...z.stand.values()].filter(Boolean).length,
  }));
}
