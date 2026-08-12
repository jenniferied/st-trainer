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

   WAS DIE ZAHL SEIT DEM 12.08. IST (Jennifer: "es soll nicht total progress
   sein sondern sowohl bei ge als auch st den daily progress. also wv vom ziel
   die karten. und halt wv games noch offen/dailies."):
   Hier stand bis dahin eine Quote ueber den Gesamtstand — und zwar "sitzt von
   den ANGEFASSTEN Aufgaben" (37 von 46 = 80 %), waehrend der Querlink drueben
   den Lernscore ueber den GANZEN Pool zeigte (11 %). Gleiche Pille, gleiche
   Farbleiter, zwei Definitionen; die 80 % waren dabei nicht einmal eine
   Design-Entscheidung, sondern eine Notloesung, weil die Groesse des GE-Korpus
   im Snapshot gar nicht steht.
   Jetzt zeigt der Link den TAGESFORTSCHRITT in Prozent vom Tagespensum — also
   die Groesse, die der GE-Trainer auf seiner eigenen Startseite als
   Zonen-Balken malt, und 100 % heisst "Pensum geschafft", nicht "alles
   gelernt". Die absoluten Karten stehen im Tooltip. Der Wert kommt
   fertig aus dem fremden Snapshot (Feld heute, geteilter Vertrag in
   geteilt-tagesstand.js) und wird hier NICHT nachgerechnet — genau daran ist
   die alte Zahl gescheitert.
   Damit gilt die Frische-Regel jetzt fuer alles, was der Link sagt: ein Block
   von gestern wird verworfen, nicht angezeigt. */

// Geteilt mit dem GE-Trainer. Quelle: rose/geteilte-styles/tagesstand.js —
// diese Datei ist eine verteilte Kopie und wird NIE hier bearbeitet.
import { liesHeute, tagesPilleKlasse, tagesText, tagesWorte, tagesLos, losText, losWorte, offenText } from "./geteilt-tagesstand.js";

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
// v3 (12.08.): quote/sitzt/bekannt sind raus, dafuer der rohe heute-Block.
const AUSWERTUNG_V = 3;
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
// Abgeleitet wird hier nur noch, was sich ehrlich ableiten laesst: welche
// Mini-Games es drueben gibt und wann sie zuletzt liefen. Der Tagesfortschritt
// wird NICHT gerechnet, sondern uebernommen — der GE-Trainer legt ihn fertig in
// sein Feld heute (geteilt-tagesstand.js). Der Block wird roh gespeichert und
// erst beim Anzeigen mit liesHeute() geprueft; so faellt er um Mitternacht von
// selbst weg, auch wenn drueben seither niemand gepusht hat.
function werteAus(ts, daten) {
  const log = (daten && daten.antwortLog) || [];

  // Je Mini-Game der letzte Tag, an dem es lief. Der Schluesselsatz ist zugleich
  // die Liste der Spiele, von deren Existenz wir sicher wissen.
  const spiele = {};
  for (const a of log) {
    if (!a || a.modus !== "spiel" || !a.spiel) continue;
    const t = tagVon(a.ts);
    if (!(a.spiel in spiele) || t > spiele[a.spiel]) spiele[a.spiel] = t;
  }

  return { ts, heute: (daten && daten.heute) || null, spiele };
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
      if (c && c.ts === ts && c.spiele) {
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
    // liesHeute() verwirft alles, was nicht von heute ist — auch einen Block,
    // der noch im Cache liegt, weil drueben seit gestern niemand gepusht hat.
    heute: liesHeute(c),
    // Genau dieser Fall ist der Anstupser: kein frischer Block, weil der letzte
    // Push von gestern oder aelter ist. Begruendung in tagesLos().
    los: tagesLos(c.ts),
  };
}

const spielName = (k) => SPIEL_NAMEN[k] || k;

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
      // .dringend (rot, schneller Puls) und die ZAHL kamen am 12.08. nachmittags
      // dazu — beides, damit dieser Link und der Gegenlink im GE-Trainer dasselbe
      // sagen und gleich aussehen. Wortwahl aus offenText(), damit sie nicht in
      // zwei Dateien getrennt driftet; Farbe und ihre Grenze im CSS, Block 2b.
      teile.push(`<span class="stand-badge neu dringend kompakt"><i class="puls dringend">✦</i> ${offenText(s.offen.length)}</span>`);
      worte.push("heute noch offen: " + s.offen.map(spielName).join(", "));
    } else if (s.frisch) {
      teile.push(`<span class="stand-badge sitzt kompakt">✓ heute</span>`);
      worte.push("heute drüben schon geübt");
    }
    // Der Tagesfortschritt drueben, in Prozent vom Tagespensum (Jennifer,
    // 12.08.: "ne prozent"). 100 % heisst "Pensum geschafft", nicht "alles
    // gelernt", und ueber 100 wird nicht gedeckelt — Begruendung und die
    // verworfene Gegenposition stehen in geteilt-tagesstand.js bei tagesText().
    // Die absoluten Karten stehen im Tooltip. Die Farbe traegt der geteilte
    // Leiterpunkt, nicht die Flaeche (Kontrast-Begruendung im Style-Paket).
    if (s.heute) {
      teile.push(`<span class="tag-pille ${tagesPilleKlasse(s.heute)}">${tagesText(s.heute)}</span>`);
      worte.push(tagesWorte(s.heute, "GE"));
    } else if (s.los) {
      // Kein Zahlenpaar, weil wir das heutige Tagesziel drueben gar nicht
      // kennen — und weil "0 von 40" sich wie ein Rueckstand liest.
      teile.push(`<span class="tag-pille los"><i class="puls dringend los-zeichen">!</i>${losText()}</span>`);
      worte.push(losWorte("GE"));
    }
    feld.innerHTML = teile.join("");
    a.title = "Zum GE-Trainer — deine andere Klausur am 10.09." + (worte.length ? " · " + worte.join(" · ") : "");
    a.setAttribute("aria-label", "Zum GE-Trainer wechseln" + (worte.length ? ", " + worte.join(", ") : ""));
  };

  male();
  hole().then(male).catch(() => { /* neutral bleiben */ });
}
