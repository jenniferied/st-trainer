/* Blick zum GE-Trainer — NUR LESEN (Jennifer, 12.08.).
   Rose schreibt zwei Klausuren und hat zwei Trainer. Der Querlink oben rechts
   soll nicht nur hinueberzeigen, sondern auch sagen, wie es drueben steht:
   "sind noch Mini-Games offen" und "bei welcher Punktzahl sind wir".

   Beide Apps liegen im selben Supabase-Projekt, nur unter verschiedenen
   Sync-Codes — ST unter rose, GE unter rose-ge. Der GE-Trainer hat die
   Gegenrichtung schon gebaut (sync.js, fremdZuletzt); das hier ist das
   Spiegelbild, nur mit etwas mehr Inhalt.

   DREI RIEGEL, damit daraus kein Unfall wird:
   1. Es wird ausschliesslich GET gemacht. In dieser Datei steht kein POST, kein
      method-Feld, kein Prefer-Header — unter rose-ge liegt Roses echter
      GE-Lernstand, und der wird von hier aus nie angefasst.
   2. Der fremde Code steht als Konstante hier und kommt nirgends in die Naehe
      von syncCode(). Die Schreibpfade in core.js kennen diese Datei nicht.
   3. Jeder Fehler endet still im neutralen Zustand. Ein verlaesslicher Link
      schlaegt eine wacklige Statusanzeige.

   DIE EHRLICHKEITS-REGEL, und die ist hier der eigentliche Punkt:
   Roses GE-Arbeit stammt zum grossen Teil aus der Zeit VOR dem Antwort-Log und
   traegt kein Datum — unter rose-ge liegen datierte Antworten nur von wenigen
   Tagen, dazu undatierte Zaehler. Eine naive Anzeige wuerde daraus regelmaessig
   "heute noch nichts geuebt" machen, obwohl sie geuebt hat. Darum:
   - Ueber HEUTE wird nur geredet, wenn der neueste Snapshot von heute ist. Der
     Push drueben haengt an der Signatur (sync.js: gleiche Signatur = kein
     Schreiben), ein blosses Oeffnen der App bewegt den Zeitstempel also nicht.
     Frischer Zeitstempel heisst wirklich: da ist heute etwas dazugekommen.
   - "Offen" wird nur ueber Mini-Games behauptet, die drueben nachweislich
     existieren, weil sie im Log schon einmal vorkommen. Ein umbenanntes oder
     neues Spiel faellt damit still raus, statt faelschlich "offen" zu melden.
   - Reicht es nicht: NEUTRAL. Nur der Link. Nie "alles erledigt" raten.

   Die Quote dagegen braucht keine Frische — sie ist eine Aussage ueber den
   Stand, nicht ueber den Tag, und wird darum immer gezeigt, wenn sie da ist. */

const GE_CODE = "rose-ge";
const CACHE_KEY = "st-nachbar-ge";
// Wie oft ueberhaupt nachgesehen wird. Gefragt wird dabei erst nur nach dem
// Zeitstempel (ein paar Byte); der Snapshot selbst wird nur geholt, wenn es
// wirklich einen neuen gibt — also an Tagen, an denen Rose drueben geuebt hat.
const POLL_MS = 10 * 60000;

const SPIEL_NAMEN = { operatoren: "Signalwörter", begriffe: "Begriffe-Blitz" };

const tagVon = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const heuteTag = () => tagVon(Date.now());

const konfig = () => (typeof window !== "undefined" && window.ST_CONFIG) || {};
const aktiv = () => { const c = konfig(); return !!(c.supabaseUrl && c.supabaseAnonKey); };
const leseKopf = () => ({ apikey: konfig().supabaseAnonKey, Authorization: "Bearer " + konfig().supabaseAnonKey });
const leseUrl = (rest) => konfig().supabaseUrl + "/rest/v1/lernstand?code=eq." + encodeURIComponent(GE_CODE) + rest;

// ---------- Cache ----------
// Bewusst localStorage und ein eigener Schluessel: der Cache soll einen Reload
// ueberleben, gehoert aber dem Geraet und darf in keinen Snapshot geraten.
// state() wird hier nirgends angefasst — was hier liegt, kann nie mitsyncen.
// Version der AUSWERTUNG, nicht der Daten. Der Cache wurde bisher nur ungueltig,
// wenn sich der Snapshot drueben bewegt hat (`c.ts === ts`) — aendert sich dagegen
// die RECHNUNG, blieb die alte Zahl unbegrenzt stehen, weil jeder Abruf nur
// `geholt` auffrischte. Genau das ist am 12.08. passiert: die Prozentzahl kam noch
// aus der alten Formel und war durch nichts zu bewegen, solange Rose drueben nicht
// uebte (ihr Snapshot ruehrt sich ja nur beim Ueben). Ein Cache muss ungueltig
// werden, wenn sich die Frage aendert — nicht nur, wenn sich die Antwort aendert.
// WER DIE RECHNUNG ODER DIE GESPEICHERTEN FELDER AENDERT, ZAEHLT HIER HOCH.
const AUSWERTUNG_V = 2;
function lies() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    return c && c.v === AUSWERTUNG_V ? c : null;
  } catch { return null; }
}
function schreib(o) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(Object.assign({ v: AUSWERTUNG_V }, o))); } catch { /* voll oder gesperrt — dann eben ohne */ }
}

// ---------- Auswertung eines Snapshots ----------
// Gerechnet wird nur mit dem, was im Snapshot wirklich steht: mc/frei sagen,
// welche Aufgaben drueben sitzen, das Log sagt, welche Mini-Games es gibt und
// wann sie zuletzt liefen. Die Gesamtgroesse des GE-Korpus steht NICHT drin —
// darum ist die Quote hier "von den Aufgaben, die Rose angefasst hat", und
// genau so steht es auch im Tooltip.
function werteAus(ts, daten) {
  const mc = (daten && daten.mc) || {};
  const frei = (daten && daten.frei) || {};
  const log = (daten && daten.antwortLog) || [];

  let sitzt = 0, bekannt = 0;
  for (const k of Object.keys(mc)) { bekannt++; if (mc[k] && mc[k].zuletztRichtig) sitzt++; }
  for (const k of Object.keys(frei)) { bekannt++; if (frei[k] === "gut") sitzt++; }

  // Je Mini-Game der letzte Tag, an dem es lief. Der Schluesselsatz ist zugleich
  // die Liste der Spiele, von deren Existenz wir sicher wissen.
  const spiele = {};
  for (const a of log) {
    if (!a || a.modus !== "spiel" || !a.spiel) continue;
    const t = tagVon(a.ts);
    if (!(a.spiel in spiele) || t > spiele[a.spiel]) spiele[a.spiel] = t;
  }

  return { ts, quote: bekannt ? Math.round((100 * sitzt) / bekannt) : null, sitzt, bekannt, spiele };
}

// ---------- Abruf ----------
let laeuft = null;

export function hole() {
  if (!aktiv()) return Promise.resolve(null);
  if (laeuft) return laeuft;
  const c = lies();
  if (c && c.geholt && Date.now() - c.geholt < POLL_MS) return Promise.resolve(c);

  // Schritt 1: nur der Zeitstempel. Winzig, und beantwortet die Frage, ob sich
  // der Snapshot ueberhaupt bewegt hat.
  laeuft = fetch(leseUrl("&select=ts&order=ts.desc&limit=1"), { headers: leseKopf() })
    .then((r) => (r.ok ? r.json() : null))
    .then((zeilen) => {
      const ts = zeilen && zeilen[0] && zeilen[0].ts ? new Date(zeilen[0].ts).getTime() : null;
      if (!ts) return null;
      // Schritt 2: den Snapshot nur holen, wenn es ein neuer ist. An Tagen ohne
      // GE-Uebung faellt damit gar kein grosser Abruf an.
      if (c && c.ts === ts && typeof c.quote !== "undefined") {
        const frisch = Object.assign({}, c, { geholt: Date.now() });
        schreib(frisch);
        return frisch;
      }
      return fetch(leseUrl("&select=daten&order=ts.desc&limit=1"), { headers: leseKopf() })
        .then((r) => (r.ok ? r.json() : null))
        .then((rows) => {
          const daten = rows && rows[0] && rows[0].daten;
          if (!daten) return null;
          const neu = Object.assign(werteAus(ts, daten), { geholt: Date.now() });
          schreib(neu);
          return neu;
        });
    })
    .catch(() => null)
    .then((x) => { laeuft = null; return x; });
  return laeuft;
}

/* Was der Link zeigen darf — aus dem Cache, ohne Netz. null heisst: wir wissen
   nichts, also behauptet der Link auch nichts. */
export function geStand() {
  const c = lies();
  if (!c || !c.ts) return null;
  const heute = heuteTag();
  const frisch = tagVon(c.ts) === heute;
  const namen = Object.keys(c.spiele || {});
  // Ueber heute nur reden, wenn der Snapshot von heute ist (siehe Kopf).
  const offen = frisch ? namen.filter((n) => c.spiele[n] !== heute) : [];
  return {
    ts: c.ts,
    frisch,
    offen,
    quote: typeof c.quote === "number" ? c.quote : null,
    sitzt: c.sitzt || 0,
    bekannt: c.bekannt || 0,
  };
}

// Dieselbe Leiter wie im Rest der App (qStufe in main.js): unter 50 warm, nie rot.
const stufe = (q) => (q == null ? "q0" : q < 50 ? "q1" : q < 75 ? "q2" : q < 90 ? "q3" : "q4");

const spielName = (k) => SPIEL_NAMEN[k] || k;

function wannText(ts) {
  const d = Math.round((heuteTag() - tagVon(ts)) / 86400000);
  if (d <= 0) return "von heute";
  if (d === 1) return "von gestern";
  return "vom " + new Date(ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

/* Traegt den Zustand in den Querlink ein: erst synchron aus dem Cache (damit
   beim Blaettern nichts flackert), dann noch einmal nach dem Abruf. Der Abruf
   blockiert nichts und meldet keinen Fehler — schlaegt er fehl, bleibt einfach
   der Link stehen, so wie er vorher war. */
export function zeigeGeStand(a) {
  if (!a) return;
  const feld = a.querySelector(".ge-stand");
  if (!feld) return;

  const male = () => {
    if (!a.isConnected) return;
    const s = geStand();
    if (!s) { feld.innerHTML = ""; return; }

    const teile = [];
    const worte = [];
    // Dasselbe Bauteil wie auf den Tageskacheln (Muster-Block im CSS,
    // "offen / erledigt"). Gleiches Wort, gleiche Punktgroesse, gleicher Takt —
    // Rose soll es an beiden Stellen ohne Nachdenken wiedererkennen.
    if (s.offen.length) {
      teile.push(`<span class="stand-badge neu kompakt"><i class="puls">✦</i> offen</span>`);
      worte.push("heute noch offen: " + s.offen.map(spielName).join(", "));
    } else if (s.frisch) {
      teile.push(`<span class="stand-badge sitzt kompakt">✓ heute</span>`);
      worte.push("heute drüben schon geübt");
    }
    if (s.quote != null) {
      teile.push(`<span class="q-pille ${stufe(s.quote)}">${s.quote} %</span>`);
      worte.push(`${s.sitzt} von ${s.bekannt} geübten Aufgaben sitzen (Stand ${wannText(s.ts)})`);
    }
    feld.innerHTML = teile.join("");
    a.title = "Zum GE-Trainer — deine andere Klausur am 10.09." + (worte.length ? " · " + worte.join(" · ") : "");
    a.setAttribute("aria-label", "Zum GE-Trainer wechseln" + (worte.length ? ", " + worte.join(", ") : ""));
  };

  male();
  hole().then(male).catch(() => { /* neutral bleiben */ });
}
