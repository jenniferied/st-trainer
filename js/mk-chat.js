/* ============ Kreaturen-Chat, ST-Seite (Adapter) ============
   Das Sheet, der Verlauf, die Fehlerbehandlung und die Schnellantwort-Mechanik
   liegen im geteilten Baustein (geteilt-maskottchen-chat.js, Quelle:
   rose/geteilte-styles/maskottchen-chat.js). Hier steht nur, was am
   ST-Trainer anders ist als am GE-Trainer: welche Zahlen es gibt, wie die
   Kreatur heisst, welcher Endpunkt antwortet und welches Tagesbudget gilt.

   DER CHAT LIEST NUR. Er schreibt nichts nach state().mk, nichts in den
   Snapshot, nichts in signatur(). Roses Lernstand kann er strukturell nicht
   anfassen — der Verlauf liegt geraetelokal in localStorage.

   ZWEI WEGE, GLEICHRANGIG:
     1. Frei tippen. Das Eingabefeld ist IMMER da (Jennifer, 12.08.: "man soll
        frei tippen können beim chat"). Antwortet die Function nicht, greift
        der stille Fallback — nie ein Fehler, nie eine leere Blase.
     2. Schnellantworten aus dem lokalen Stand. Eine Abkuerzung, kein Ersatz:
        sie kosten nichts und brauchen weder Netz noch Edge Function.

   Den frueheren Schalter ST_CONFIG.mkChatFreitext gibt es nicht mehr. Er
   stammt aus der Zeit vor dem Deploy des art-Zweigs "maskottchen" und hat
   genau den Zustand erzeugt, ueber den Jennifer sich geaergert hat: statt
   eines Eingabefelds stand da "Tipp auf eine Frage." */

import * as C from "./core.js";
import * as Mk from "./maskottchen.js";
import * as Spiele from "./spiele.js";
import * as Chat from "./geteilt-maskottchen-chat.js";

const cfg = () => window.ST_CONFIG || {};
const url = () => (cfg().supabaseUrl ? cfg().supabaseUrl + "/functions/v1/llm" : null);

/* Eigenes, kleines Tagesbudget — NICHT das der Selbsterklaerung (st-llm-tag,
   120). Ein geschwaetziges Maskottchen soll Roses Feedback auf ihre eigenen
   Erklaerungen nie verdraengen; das ist das Feature, das beim Lernen wirklich
   traegt. Geraetelokal, wie das andere auch, und bewusst nicht im Lernstand. */
const MK_TAG_LIMIT = 20;
const MK_TAG_KEY = "st-mk-tag";

function budget() {
  const heute = new Date().toDateString();
  let d;
  try { d = JSON.parse(localStorage.getItem(MK_TAG_KEY) || "{}"); } catch (e) { d = {}; }
  if (!d || d.tag !== heute) d = { tag: heute, n: 0 };
  return d;
}
function budgetVerbrauch() {
  const d = budget();
  d.n++;
  try { localStorage.setItem(MK_TAG_KEY, JSON.stringify(d)); } catch (e) { /* egal */ }
}
const budgetFrei = () => budget().n < MK_TAG_LIMIT;

/* ---------- Der Stand, den die Kreatur kennt ----------
   Reine Durchreiche. Jede Zahl kommt aus der Funktion, die sie in der App
   ohnehin berechnet — herzenStand, stufeJetzt, herzenHeute, herzenBisNaechste,
   tagesStand, offeneDailies. Nichts davon wird hier nachgerechnet: wer die
   Zahl berechnet, muss die App sein, die sie anzeigt (dreimal im Handoff).

   Die zwei Felder, die man leicht verwechselt, heissen deshalb ausgeschrieben:
   tageBisKlausur (Kalendertage bis zum 18.09.) und uebungstage (an wie vielen
   Tagen Rose ueberhaupt geuebt hat). tz.tage und herzenStand().tage heissen
   beide tage und meinen Verschiedenes. */
function stand() {
  const tz = C.tagesStand();
  const hs = Mk.herzenStand(tz);
  const stufe = Mk.stufeJetzt(hs.herzen);
  const mk = C.state().mk || {};
  return {
    appName: "ST-Trainer",
    fach: "Schultheorie und Bildungsforschung",
    tageBisKlausur: tz.tage,
    stufe,
    geschluepft: !!mk.geschluepft,
    // Was es IST, sagt es erst ab Stufe 6 (Mk.TIER_STUFE). Vorher waere es ein
    // Spoiler auf genau den Moment, auf den das Wachsen hinauslaeuft.
    tierart: stufe >= Mk.TIER_STUFE ? "Katze" : "",
    herzen: hs.herzen,
    sterne: hs.sterne,
    uebungstage: hs.tage,
    herzenHeute: Mk.herzenHeute(tz),
    herzenBisNaechste: Mk.herzenBisNaechste(hs.herzen, stufe),
    heute: { n: tz.n, ziel: tz.ziel, minimum: tz.minimum, stretch: tz.stretch },
    // Leere Liste heisst "heute alles durch", null hiesse "weiss ich nicht".
    // offeneDailies() liefert immer eine Liste — dieselbe, aus der der Hub
    // seine Kacheln baut.
    offen: Spiele.offeneDailies(),
    stunde: new Date().getHours(),
  };
}

/* ---------- Die Schnellantworten ----------
   Deterministisch aus dem Stand, immer in der Rolle, nie eine Wertung. Sie
   sind die erste Ebene und gleichzeitig das Netz: sie funktionieren ohne
   Function, ohne Netz und ohne Budget.

   Was hier NICHT vorkommt: ein Vergleich mit gestern, eine Prozentbewertung,
   ein Datum und eine Anzahl Tage bis zur naechsten Stufe. Das Letzte ist keine
   Stilfrage — herzenStand() rechnet die Historie mit dem HEUTIGEN Tagesziel,
   und das schwankt (gemessen 30/27/25 Herzen bei Ziel 60/80/100). "Noch 3 ♥"
   ist wahr, "noch zwei Uebungstage" waere eine Luege, die auffliegt. */
function schnellFragen(st) {
  const nacht = Chat.istNacht(st);
  const h = st.heute || {};
  const liste = [];

  liste.push({
    text: "Wie steht es heute?",
    antwort: !h.ziel ? "Ich hab heute keinen richtigen Überblick. Ist auch mal okay."
      : !h.n ? "Heute noch nichts. Ist okay, ich hab Zeit."
      : "Heute sind schon " + h.n + " von " + h.ziel + " durch. Mehr weiß ich dazu nicht, und mehr brauch ich auch nicht."
  });

  // Nachts kein Wort ueber offene Aufgaben. Abends soll hier nichts mahnen —
  // dieselbe Grenze, die blaseText() in maskottchen.js schon zieht.
  if (!nacht) {
    liste.push({
      text: "Was ist heute noch offen?",
      antwort: !Array.isArray(st.offen) ? "Weiß ich gerade nicht."
        : st.offen.length === 0 ? "Heute ist alles durch. Ich bin beeindruckt und leicht satt."
        : st.offen.length === 1 ? "Offen ist noch " + st.offen[0] + ". Nur falls du magst."
        : "Offen sind noch: " + st.offen.join(", ") + ". Nur falls du magst."
    });
    liste.push({
      text: "Was soll ich als Nächstes machen?",
      antwort: !Array.isArray(st.offen) || st.offen.length === 0
        ? "Gar nichts müssen. Wenn du magst, eine kurze Runde, wenn nicht, auch gut."
        : st.offen[0] + " wär noch da. Wenn dir heute nicht danach ist, ist das auch eine Antwort."
    });
  }

  liste.push({
    text: "Wie weit bist du?",
    antwort: stufenSatz(st)
  });

  if (st.tierart) {
    liste.push({
      text: "Was bist du eigentlich?",
      antwort: "Eine " + st.tierart + ". Hat eine Weile gedauert, bis ich das selbst wusste."
    });
  }

  // Der Ausgang fuer Fachliches. Die Kreatur erfindet keine Klausurinhalte und
  // nennt keine Folien — den Chat mit den Folien gibt es an der Uebungsfrage,
  // und genau dorthin verweist sie.
  liste.push({
    text: "Ich hab eine Frage zum Stoff",
    antwort: "Dazu bin ich die falsche Adresse, ich kenn nur deinen Tag. Frag mich direkt in einer Übungsfrage, über den Knopf unter den Antworten - da liegen die Folien vor mir."
  });

  return liste;
}

/* Wie weit die Kreatur ist. Nie ein Datum, nie eine Anzahl Tage. */
function stufenSatz(st) {
  const kern = st.herzen + " ♥ hab ich gesammelt"
    + (st.sterne ? ", dazu " + st.sterne + " ★" : "")
    + ", aus " + st.uebungstage + " Tagen, an denen du da warst.";
  const weiter = st.herzenBisNaechste == null
    ? " Weiter geht es bei mir nicht mehr, ich bin fertig gewachsen."
    : st.herzenBisNaechste === 0
      ? " Es ist gleich soweit, ich spuer das."
      : " Noch " + st.herzenBisNaechste + " ♥, dann passiert wieder was.";
  return kern + weiter;
}

/* ---------- Der Fallback ----------
   Nie ein Fehler, nie eine leere Blase, nie eine Entschuldigung fuer Technik.
   Die Kreatur ist verschlafen, nicht kaputt — und sagt danach trotzdem etwas
   Wahres aus dem lokalen Stand. */
function fallback(st) {
  if (Chat.istNacht(st)) return "Ich bin schon halb eingeschlafen und krieg keinen Satz mehr zusammen. Morgen wieder.";
  return "Ich bin gerade ein bisschen verschlafen und finde die Worte nicht. Was ich aber sehe: " + Chat.heuteSatz(st) + ".";
}

/* ---------- Freier Text ----------
   Nicht streamend, mit Absicht: fuer zwei bis drei Saetze lohnt sich SSE
   nicht, und EIN Codepfad fuer beide Apps ist mehr wert als das Tippgefuehl.
   Jeder Fehler wird zu null — der geteilte Baustein macht daraus den
   Fallback-Satz, nie eine Fehlermeldung. */

function kopf() {
  const k = cfg().supabaseAnonKey || "";
  return { "Content-Type": "application/json", apikey: k, Authorization: "Bearer " + k };
}

async function senden(messages, st) {
  // Nur noch die Transportfrage: gibt es ueberhaupt einen Endpunkt, und ist
  // heute noch Budget da? Kein Feature-Schalter mehr.
  if (!url() || !budgetFrei()) return null;
  try {
    const steuerung = new AbortController();
    const wecker = setTimeout(() => steuerung.abort(), 14000);
    const r = await fetch(url(), {
      method: "POST", headers: kopf(), signal: steuerung.signal,
      body: JSON.stringify({ art: "maskottchen", stand: st, messages }),
    });
    clearTimeout(wecker);
    // Erst zaehlen, wenn wirklich ein Status zurueckkam. Der Zaehler stand
    // frueher VOR dem fetch: ist die Function tot oder falsch konfiguriert,
    // lief er trotzdem hoch, Rose bekam zwanzig freundliche Fallbacks und
    // danach "Fuer heute hab ich genug geredet" — was nicht stimmte und sich
    // anfuehlt, als wuerde die App sie anluegen. Ein abgebrochener Socket
    // wirft und kommt hier nie an, kostet also auch nichts.
    // Auch ein 4xx/5xx zaehlt: der Server wurde erreicht, und ein nicht
    // zaehlender Fehlerpfad waere eine Schleife ohne Kostenbremse.
    // Dieselbe Reihenfolge steht in ge-trainer/app/js/llm.js (maskottchen).
    budgetVerbrauch();
    if (!r.ok) return null;
    const d = await r.json();
    // Der Zweig antwortet mit { antwort }. Alles andere (auch das
    // {trifftKern, feedback} einer nicht nachgezogenen Function) faellt hier
    // durch und wird zum Fallback statt zu einer sinnlosen Blase.
    return typeof d.antwort === "string" && d.antwort.trim() ? d.antwort : null;
  } catch (e) {
    return null;
  }
}

/* ---------- Das Bild der Kreatur ----------
   Dasselbe, das auf der Startseite sitzt — der Chat zeichnet nichts Eigenes.
   Damit waechst der Avatar automatisch mit und kann strukturell nicht in
   einer anderen Stufe stehen als die Karte darueber. */
function avatarHtml(s) {
  return Mk.bildHtml(Mk.EIER[Mk.eiIndex()], s.stufe, Chat.istNacht(s));
}

/* ---------- Oeffnen ----------
   Keinen titel mehr: der Name der Kreatur steht im Sheet an ihrer Blase und
   heisst schlicht "Ei", solange sie eins ist (kreaturName() im Baustein). */
export function oeffnen() {
  return Chat.chatOeffnen({
    verlaufKey: "st-mk-chat",
    hinweis: "Ich weiß, wie dein Tag läuft. Vom Stoff versteh ich nichts - dafür gibt es den Chat an der Übungsfrage.",
    stand,
    avatarHtml,
    schnellFragen,
    budgetFrei,
    senden,
    fallback,
  });
}
