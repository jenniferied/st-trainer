// ============ Taeglicher Trainings-Hub: 3 Games (Block B, NextGen-Plan) ============
// Game 1 "Verwechslungspaare" — Interleaving/Kontrast-Drill (Swipe bei 2 Konzepten,
//   Tap-Chips bei 3-4), Fehlergewichtung aus der Antwort-Historie.
// Game 2 "Operatoren-Wortschatz" — Pruefungs-Wendungen als Karten + Zuordnen +
//   Mini-Entscheidungen an echten Frage-Stems.
// Game 3 "Fragen-Detektiv" — RAP als Spiel: Nur der Stamm, zwei Tipps
//   (Was will die Frage? / Welches Konzept?), dann Aufloesung.
// Alle Antworten landen als normale antwortLog-Eintraege (modus vp/op/detektiv,
// qid-Praefixe vpi-/op-/dt-) -> zaehlen fuers Tagesziel & syncen ueber Geraete;
// in die Fragen-Statistik fliessen sie nicht (frage(qid) kennt sie nicht).

import * as C from "./core.js";
import * as Beleg from "./beleg.js";
import * as M from "./methoden.js";
/* Paar-Zuordnung (hier: Zuordnen, in main.js: Begriffe-Blitz, drueben im
   GE-Trainer: Begriffe-Blitz) — eine Mechanik, ein Baustein. Quelle:
   rose/geteilte-styles/spiel-zuordnen.js, verteilt per verteilen.sh.
   Die Engine loggt und feiert bewusst nicht, das bleibt hier. */
import { baueZuordnen } from "./geteilt-zuordnen.js";
/* Tages-Hub: Kachelreihe "Heute dran", der Vertrag "was ist heute offen" und der
   Rueckweg aus einer Runde. Quelle: rose/geteilte-styles/tages-hub.js, verteilt
   per verteilen.sh — nie die Kopie bearbeiten. Der Baustein loggt nicht, feiert
   nicht und rechnet nicht nach, WELCHE Eintraege offen sind; das bleibt hier. */
import * as Hub from "./geteilt-tages-hub.js";

const app = () => document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const REDUCE_MOTION = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

// Reaktions-Sticker (gleiche Assets wie main.js — Motivation schlaegt Nuechternheit):
// richtig = Freude, falsch = troestend/aufmunternd, nie haemisch.
const STICKER = {
  good: ["pepe_drool", "troll_grin", "patrick_happy", "laugh_cam", "happy_dog", "laughcry", "rat_dance", "kitten_lift"],
  part: ["emoji_eye", "seal_blob", "patrick_slime", "monkey_side", "cat_grass", "fish_drink"],
  sanft: ["praying_cat", "pat_pat", "kitten_braces", "kitten_suit", "sad_hamster", "teary_cat"],
};
const reactSrc = (name) => `assets/reactions/${name}.${REDUCE_MOTION ? "png" : "webp"}`;
function sticker(cls) {
  const arr = STICKER[cls] || STICKER.part;
  return `<img class="sticker" src="${reactSrc(arr[Math.floor(Math.random() * arr.length)])}" alt="" loading="lazy">`;
}

// Kleiner Feier-Regen (lokale Kopie, main.js ist das Entry-Modul — kein Zyklus)
function miniKonfetti(n = 40) {
  const ov = document.createElement("div");
  ov.className = "konfetti";
  const SYM = ["🎉", "🎊", "💗", "⭐", "✨"];
  ov.innerHTML = Array.from({ length: REDUCE_MOTION ? 12 : n }, () => {
    const sym = SYM[Math.floor(Math.random() * SYM.length)];
    return REDUCE_MOTION
      ? `<span class="herz still" style="left:${(Math.random() * 92).toFixed(1)}%;top:${(10 + Math.random() * 70).toFixed(1)}%;font-size:1.1rem">${sym}</span>`
      : `<span class="herz" style="left:${(Math.random() * 100).toFixed(1)}%;font-size:${(0.9 + Math.random() * 1.2).toFixed(2)}rem;--sw:${(8 + Math.random() * 18).toFixed(0)}px;--spin:${(Math.random() * 500 - 250).toFixed(0)}deg;animation-duration:${(2.4 + Math.random() * 1.6).toFixed(2)}s;animation-delay:${(Math.random() * 0.5).toFixed(2)}s">${sym}</span>`;
  }).join("");
  document.body.appendChild(ov);
  setTimeout(() => ov.remove(), 2600);
}

// ---------- Daten ----------
let VIG = null;   // { gruppen: [...] } oder null
let OPS = null;   // { operatoren: [...], uebungen: [...] } oder null
export async function ladeSpiele() {
  const hol = async (pfad) => {
    try { const r = await fetch(pfad); return r.ok ? await r.json() : null; } catch { return null; }
  };
  [VIG, OPS] = await Promise.all([hol("data/vignetten.json"), hol("data/operatoren.json")]);
  if (!VIG?.gruppen?.length) VIG = null;
  if (!OPS?.operatoren?.length) OPS = null;
}
export const hatVignetten = () => !!VIG;
export const hatOperatoren = () => !!OPS;

// ---------- Tages-Status je Game (Karte farbig = heute noch nicht gemacht) ----------
export function spieleHeute() {
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  const s = { vp: 0, opu: 0, opz: 0, detektiv: 0, begriffe: 0, spaced: 0 };
  for (const a of C.state().antwortLog) {
    if (a.ts < heute.getTime()) continue;
    if (a.modus === "op") s[String(a.qid).startsWith("opz-") ? "opz" : "opu"]++;
    else if (s[a.modus] !== undefined) s[a.modus]++;
  }
  return s;
}

// ---------- Hub auf der Startseite ----------
// Vier gleich gebaute Karten nebeneinander: grosses Icon, Name darunter,
// i-Info IMMER oben rechts (frueher sass es im Untertitel und sprang — dazu
// war es ein Button im Button, den der Parser zerlegt hat; Karte ist jetzt
// bewusst ein div[role=button]).
//
// Zustand steht seit dem 12.08. an der Karte statt nur in der Bildunterschrift
// (Jennifer: "die kacheln vom taeglichen training ... offenes soll pulsieren").
// Bewusst DIESELBE Sprache wie im Stoebern: "✦ offen" mit derselben
// stand-badge.neu und "✓ geübt" mit derselben stand-badge.sitzt — wer die eine
// Oberflaeche gelesen hat, kann die andere sofort. Das ✦ pulsiert langsam und
// versetzt; erledigt heisst gruene Kante plus einmaliges Aufleuchten beim
// Uebergang. Kein Zaehler, kein Streak-Druck, kein Konfetti.
//
// Der Zustand fuer das einmalige Aufleuchten (zuletztFertig) ist mit dem Hub in
// den geteilten Baustein gewandert. Er haengt untrennbar an dessen Aufbau — ein
// zweiter Zaehler hier laege beim ersten Seitenaufbau daneben. Die ausgeschriebene
// Invariante steht im Kopf von geteilt-tages-hub.js.

/* DIE Tagesliste dieser App — eine Quelle fuer beides: die Kacheln im Hub und
   die Zahl, die im Querlink des GE-Trainers steht.

   Dass das EINE Funktion ist, ist die Lehre aus dem 12.08. abends: vorher hat
   der GE-Trainer diese Liste aus unserem Snapshot NACHGEBAUT und kam auf eine
   andere Zahl, als hier Kacheln stehen. Wer hier ein Spiel dazunimmt oder die
   aktiv-Bedingung aendert, aendert damit automatisch auch die Zahl drueben —
   und genau so soll es sein. Begruendung ausfuehrlich in
   geteilt-tagesstand.js bei offenText(). */
/* Namen und Icons der Spiele, die es in BEIDEN Trainern gibt, sind seit dem
   12.08. abends abgestimmt: Signalwoerter traegt 🎯, Begriffe heisst ueberall
   Begriffe-Blitz (so hiess der eigene Screen hier schon immer, nur die Kachel
   sagte kurz "Begriffe"). Die Namen wandern ueber offeneDailies() in den
   Snapshot und stehen drueben im Tooltip des Querlinks — wer sie aendert,
   aendert die Beschriftung in der anderen App mit. */
/* zurueck/extra sind der Einstieg in die Runden. Sie MUESSEN schon beim Bauen
   der Kacheln dabei sein und nicht erst beim Verdrahten: der Baustein liest
   typeof a.geh === "function" und entscheidet daran, ob die Kachel ein
   div[role=button] mit tabindex wird oder nur Anzeige (.nur-anzeige). Wer die
   Liste hier ohne Callbacks baut, bekommt eine Kachelreihe, die pixelgleich
   aussieht, aber weder Tastatur noch Knopf-Rolle hat und im Tooltip "nichts
   offen" behauptet. Genau so ist es beim ersten Umbau passiert und nur im
   Vorher-/Nachher-Vergleich aufgefallen — sichtbar war es nicht.

   Ohne zurueck (offeneDailies) traegt jeder Eintrag geh: null. Das ist dort
   folgenlos: offeneNamen() liest nur erledigt und kurz.

   Zweimal bauen ist unbedenklich — spieleHeute() liest nur, und baueHub() wird
   trotzdem genau einmal je Seitenaufbau gerufen (siehe die Invariante im Kopf
   des Bausteins). Beide Aufrufe kommen aus DIESER Funktion, damit die
   Schluessel nicht auseinanderlaufen koennen: der Baustein findet die Kacheln
   ueber data-daily wieder. */
/* Die Warmhalte-Runde: EIN laengeres Ding vor den kurzen Spielen, genau wie
   das Themen-Lernen drueben im GE-Trainer (Jennifer, 04.09.2026: "wie bei
   themen lernen bei ge darauf verlinken und daraus 1x 15 fragen zum spiel
   machen ... und dann breit ueber den spielen").

   Sie startet keinen neuen Modus, sondern den vorhandenen "Schlaues
   Wiederholen" (spaced) mit 15 Fragen. Der Modus ist seit dem 21.07. gebaut und
   wurde in 2647 Antworten 30-mal benutzt - er war nie schlecht, er war nur
   nicht zu finden. Diese Kachel IST die Reparatur.

   erledigt erst bei einer VOLLEN Runde und nicht bei der ersten Antwort: der
   GE-Trainer hat dieselbe Lektion als ABSCHLUSS_MIN gelernt, nachdem Rose einen
   Modus einmal angetippt hatte, um ihn anzusehen, und er danach als durch
   dastand.

   ---- Warum die Laenge am Datum haengt (Jennifer, 04.09.2026) ----
   Bis zur GE-Klausur zwoelf Fragen, danach vierundzwanzig. Nicht wegen der Zeit:
   der Unterschied macht bei ihren rund 65 s je Frage wenige Minuten am Tag aus,
   und die entscheiden nichts. Es geht um die EINSTIEGSHUERDE - in der GE-Woche
   soll ST das Kleinste sein, was man anfangen kann (12 x 65 s sind rund 13
   Minuten), danach darf es wieder eine richtige Runde sein (24 sind rund 25).

   Nach dem 10.09. dreht sich das Argument um, und zwar belegt: Roses Quote nach
   Position in der Runde liegt bei Frage 1-5 auf 64,6 %, bei 6-10 auf 62,2 %,
   bei 11-15 auf 66,7 %, bei 16-21 auf 67,6 % und ab 22 noch auf 65,6 % - sie
   wird hinten BESSER, und mit 71 auf 63 s je Frage auch schneller. Eine kurze
   Runde besteht damit zu grossen Teilen aus Aufwaermen; ab Frage 11 uebt sie in
   ihrer guten Zone. Gemessen am 04.09.2026 ueber alle Runden ab zehn Fragen
   (n=265/265/169/114/146).

   Die 24 nach der GE-Klausur sind kein Sprung ins Blaue: Rose hat 12 Runden mit
   21 Fragen und 6 volle 42er-Klausuren zu Ende gebracht, und keine Runde liegt
   halbfertig herum. Ab dem 11.09. laeuft ausserdem die Senkung des Tagesziels
   aus (core.js SENKUNG_BIS) - das Pensum geht von 30 zurueck auf 60-100, 24
   Fragen sind dann gut ein Drittel des Tages statt fast der ganze.

   Dieselbe Bauform wie die Senkung des Tagesziels in core.js (SENKUNG_VON/BIS):
   ein Datumsfenster, das von selbst auslaeuft. Die Konstante bleibt danach
   stehen, damit man spaeter noch nachlesen kann, was wann galt. */
const WH_GE_KLAUSUR = "2026-09-10";
const WH_VOR_GE = 12, WH_NACH_GE = 24;
const isoHeute = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
/* EINE Quelle fuer beides: die Rundengroesse in main.js und die Schwelle, ab der
   die Kachel abgehakt ist. Liefen die auseinander, waere die Runde bestellt und
   der Haken kaeme nie - oder umgekehrt. */
export const whRunde = () => (isoHeute() <= WH_GE_KLAUSUR ? WH_VOR_GE : WH_NACH_GE);

function bauDailies(zurueck, extra) {
  const gehFuer = !zurueck ? null : (key) => {
    if (key === "wh") return () => { extra?.warmhalten?.(); };
    if (key === "vp") return () => vpSpiel(zurueck);
    if (key === "opu") return () => opUeben(zurueck);
    if (key === "opz") return () => opZuordnen(zurueck);
    if (key === "bg") return () => { extra?.begriffe?.(); };
    return () => dtSpiel(zurueck);
  };
  const heute = spieleHeute();
  const whN = whRunde();
  const whFertig = heute.spaced >= whN;
  return [
    {
      key: "wh", icon: "🧠", name: "Warmhalten", m: "relearning", n: heute.spaced, aktiv: true,
      klein: whFertig
        ? "heute durch — noch eine Runde geht immer"
        : heute.spaced
          ? `${heute.spaced} von ${whN} Fragen heute · Fälliges und Wackliges zuerst`
          : `${whN} Fragen · nur Fälliges und Wackliges — hält Schultheorie warm, ohne den Tag zu füllen`,
      erledigt: whFertig,
    },
    { key: "vp", icon: "🔀", name: "Paare", m: "interleaving", n: heute.vp, aktiv: !!VIG },
    { key: "opu", icon: "🎯", name: "Signalwörter", m: "operatoren", n: heute.opu, aktiv: !!OPS?.uebungen?.length },
    { key: "opz", icon: "↔️", name: "Zuordnen", m: "operatoren", n: heute.opz, aktiv: !!OPS },
    { key: "dt", icon: "🕵️", name: "Detektiv", m: "paraphrasieren", n: heute.detektiv, aktiv: true },
    { key: "bg", icon: "🃏", name: "Begriffe-Blitz", m: "retrieval", n: heute.begriffe, aktiv: C.begriffe().length > 0 },
  ].filter((s) => s.aktiv).map((s) => ({
    key: s.key,
    icon: s.icon,
    // titel und kurz sind hier dasselbe: die Namen sind ohnehin kurz. Getrennt
    // sind die Felder wegen des GE-Trainers, dessen Wiederholen-Eintrag seine
    // Anzahl im Titel traegt und auf der Kachel nur das kurze Wort zeigt.
    titel: s.name,
    kurz: s.name,
    // Nur die breite Warmhalte-Zeile traegt eine Erklaerzeile; die kurzen
    // Kacheln haben keinen Platz dafuer und behalten den leeren String.
    klein: s.klein || "",
    methode: s.m,
    erledigt: s.erledigt !== undefined ? s.erledigt : !!s.n,
    blase: 0,           // hier zaehlt der Haken, keine Blase (das ist GE-eigen)
    n: s.n,
    geh: gehFuer ? gehFuer(s.key) : null,
  }));
}

export function dailies() {
  return bauDailies(null, null);
}

/* Welche davon heute noch offen sind, als Liste ihrer Namen. Wandert ueber
   snapshot() in den Lernstand und von dort in den Querlink des GE-Trainers:
   die Laenge wird dort zur Zahl im Abzeichen, die Namen stehen im Tooltip.
   Die LEERE Liste ist ein gueltiges Ergebnis und heisst "heute alles
   erledigt" — sie ist etwas anderes als gar keine Liste.
   >>> Der Exportname bleibt. <<< main.js reicht die FUNKTION SELBST an
   C.setzeOffenZaehler weiter und mk-chat.js ruft sie auf; ein Umbenennen setzte
   den Querlink des GE-Trainers still auf "nichts offen". */
export function offeneDailies() {
  return Hub.offeneNamen(dailies());
}

/* Der Kasten "Heute dran". Nimmt dieselben zwei Argumente wie bindHub() und
   MUSS sie bekommen — siehe bauDailies(). Gebaut wird er im geteilten Baustein;
   hier bleibt
   nur, was diese App entscheidet: ihre Kastenklassen (.card gegen GEs .karte)
   und ihre Legende zum roten Punkt. Der Text ist mit Absicht ein anderer als
   drueben — GEs Wiederholen-Kachel pulst auch dann noch, wenn Rose heute schon
   gespielt hat, und dort waere dieser Satz falsch. */
export function hubHtml(zurueck, extra = {}) {
  const aufgaben = bauDailies(zurueck, extra);
  if (!aufgaben.length) return "";
  return Hub.hubHtml(aufgaben, {
    karteKlasse: "card mt glim",
    hinweis: "Kleine Runden, je ~2 Minuten — ein Tipp startet direkt. Der rote Punkt heißt: heute noch nicht dran gewesen. Alles zählt für dein Tagesziel.",
  });
}

// zurueck ist der Rueckweg, den die Kacheln in die Runde hinein durchreichen —
// wer von der Startseite kommt, landet beim Zurueckgehen auch dort.
// extra.begriffe: Begriffe-Blitz lebt in main.js, der Hub bekommt den Einstieg gereicht.
export function bindHub(zurueck, extra = {}) {
  const aufgaben = bauDailies(zurueck, extra);
  Hub.binde(app(), aufgaben);
  breiteZeile(aufgaben);
}

/* Die Warmhalte-Kachel spannt ueber die ganze Reihe und traegt ihren Untertitel
   sichtbar - Bauform woertlich vom GE-Trainer uebernommen (main.js, daily-breit).

   Warum hier und nicht im geteilten Baustein: dass eine App eine laengere Runde
   vor den kurzen Spielen hat, ist kein geteilter Gedanke - drueben steht dort
   das Themen-Lernen, hier das Warmhalten, und geteilt-tages-hub.js gehoert
   beiden. Und warum nach dem Rendern statt beim Bauen: hubHtml() gibt ST nur
   outerHTML zurueck, die Knoten des Aufbaus landen nie im Dokument. Der
   Baustein zeichnet klein ausserdem ausschliesslich in den title-Tooltip, und
   ein Tooltip ist auf 360 px unsichtbar. */
function breiteZeile(aufgaben) {
  const kachel = app().querySelector('.dailies-reihe [data-daily="wh"]');
  const eintrag = aufgaben.find((a) => a.key === "wh");
  if (!kachel || !eintrag || !eintrag.klein) return;
  if (kachel.querySelector(".d-klein")) return;   // zweimal binden waere doppelt
  kachel.classList.add("daily-breit");
  const z = document.createElement("span");
  z.className = "d-klein";
  z.textContent = eintrag.klein;
  kachel.appendChild(z);
}

// ---------- Gemeinsames ----------
/* Der Kopf einer Spielrunde kommt aus dem geteilten Baustein. Der Gewinn steckt
   in der Argumentliste: zurueck steht dort neben titel und wird SOFORT geprueft
   — fehlt es, wirft der Baustein beim Aufbau des Screens statt still einen
   Knopf ohne Wirkung zu bauen. Verdrahten kann ein String nichts, deshalb folgt
   bei jedem Aufrufer Hub.bindeZurueck(app(), zurueckFn); auch das wirft, wenn
   der Knopf fehlt. extra ist App-eigenes Markup (der Wendungen-Knopf). */
const kopf = (titel, zurueckFn, extra = "") => Hub.kopfHtml({ titel, zurueck: zurueckFn, extra });
const logSpiel = (modus, qid, punkte, max, voll, zeit) => {
  C.logAntwort({ qid, sid: "spiel", modus, punkte, max, voll, zeit });
  C.syncEvent({ frage_id: qid, gewaehlt: null, punkte, max_punkte: max, voll, modus, ts: new Date().toISOString() });
};
// Fehlergewichtung: Unterthemen mit schwacher Historie geben ihren Gruppen/Fragen
// mehr Gewicht (Interleaving dort, wo es wehtut).
function themenGewichte() {
  const agg = {};
  for (const a of C.state().antwortLog) {
    if (a.zeit != null && a.zeit < 3) continue;
    const q = C.frage(a.qid); if (!q || !a.max) continue;
    const k = q.oberthema + "/" + q.unterthema;
    const s = agg[k] || (agg[k] = { n: 0, p: 0 });
    s.n++; s.p += a.punkte / a.max;
  }
  const w = {};
  for (const [k, s] of Object.entries(agg)) {
    if (s.n < 3) continue;
    const quote = s.p / s.n;
    if (quote < 0.5) w[k] = 3; else if (quote < 0.7) w[k] = 2;
  }
  return w;
}
const zieh = (arr, n, gewFn) => arr.map((x) => ({ x, s: (gewFn ? gewFn(x) : 1) * (0.4 + Math.random()) }))
  .sort((a, b) => b.s - a.s).slice(0, n).map((y) => y.x);

/* ---------- Beherrschung je Item: die Grundlage der Final-Boss-Stufen ----------
   Jennifer, 04.09.2026: "vllt sollte man es wieder an die beherrschung der
   einzelnen fragen/bereiche knuepfen ... und dann ihr eben jetzt die final boss
   version praesentieren."

   Gezaehlt wird AUSSCHLIESSLICH aus dem antwortLog, nie ueber C.lvl().
   Der Grund ist eine Asymmetrie, die man sonst erst im Schadensfall sieht:
   logSpiel() schreibt KEINE Leitner-Stufe (es ruft nur C.logAntwort), aber
   C.rebuildLeitner() spielt beim Loeschen einer Session das GANZE Log ein und
   vergibt dabei nachtraeglich Stufen an genau diese Spiel-qids. Wer hier den
   Leitner liest, laesst Roses Schwierigkeitsgrad also von einem voellig
   unabhaengigen Loeschvorgang abhaengen. Das Log ist die eine ehrliche Quelle,
   es synct vollstaendig und braucht kein neues Feld in snapshot()/signatur().

   Die qids sind ueber Runden hinweg stabil und je Spiel geprueft:
   vp -> it.id (vpi-*), op -> u.id (opu-*), opz -> "opz-" + Operator-Id,
   dt -> "dt-" + Frage-Id, bg -> Paar-Id. */
const BOSS_SERIE = 3;   // dreimal hintereinander voll richtig = Final Boss
const SITZT_SERIE = 2;  // zweimal hintereinander = sitzt (erste Verschaerfung)

/* EIN Durchlauf durchs Log je Runde, nicht einer je Item. Chronologisch
   sortiert, weil der Merge die Reihenfolge nicht garantiert (Vereinigung per
   aid) und die Serie sonst von der Zufallsreihenfolge abhinge. */
export function beherrschungAlle() {
  const m = new Map();
  for (const a of [...C.state().antwortLog].sort((x, y) => x.ts - y.ts)) {
    const e = m.get(a.qid) || { n: 0, ok: 0, serie: 0 };
    e.n++;
    if (a.voll) { e.ok++; e.serie++; } else e.serie = 0;
    m.set(a.qid, e);
  }
  return m;
}
// 0 = nie gesehen, 1 = geuebt, 2 = sitzt, 3 = Final Boss
export const stufeVon = (e) => !e || !e.n ? 0 : e.serie >= BOSS_SERIE ? 3 : e.serie >= SITZT_SERIE ? 2 : 1;

/* Die Stufe eines BEREICHS (Paar-Gruppe, Begriffs-Kategorie, Wendungs-Satz):
   Mehrheit der schon gesehenen Items entscheidet. MIN_GESEHEN verhindert, dass
   zwei gluecklich getroffene Karten eine ganze Gruppe auf Boss heben. */
const MIN_GESEHEN = 4;
export function stufeFuerIds(ids, bk) {
  const k = bk || beherrschungAlle();
  const gesehen = ids.filter((id) => (k.get(id) || {}).n);
  if (gesehen.length < MIN_GESEHEN) return 0;
  const anteil = (min) => gesehen.filter((id) => stufeVon(k.get(id)) >= min).length / gesehen.length;
  if (anteil(3) >= 0.6) return 3;
  if (anteil(2) >= 0.6) return 2;
  return 1;
}

/* Das Abzeichen im Rundenkopf. Es steht NUR bei Stufe 2 und 3 da - eine
   normale Runde soll nicht so aussehen, als fehle ihr etwas. Ton: Auszeichnung,
   nie Warnung (das ist die Belohnung dafuer, dass es sitzt). */
function stufenAbzeichen(stufe) {
  if (stufe >= 3) return `<span class="boss-chip" title="Du hattest das dreimal hintereinander richtig - jetzt ohne Stuetzraeder">&#128081; Final Boss</span>`;
  if (stufe >= 2) return `<span class="boss-chip sitzt" title="Sitzt bei dir - eine Stufe schwerer">&#11088; Schwerer</span>`;
  return "";
}

// Fazit-Screen aller drei Spiele: Stand, Feier bei fehlerfrei, Nochmal/Zurueck
function fazit(el, ok, n, nochmal, zurueckFn, extraHtml = "") {
  const cls = ok === n ? "good" : ok >= n * 0.6 ? "part" : "bad";
  const msg = ok === n ? `Alle ${n} richtig — stark! 🎉` : `${ok} von ${n} — jede Runde schärft den Blick.`;
  el.innerHTML = `<div class="fb-banner ${cls}" style="margin-top:14px">${sticker(ok === n ? "good" : ok >= n * 0.6 ? "part" : "sanft")}<span>${msg}</span></div>${extraHtml}
    <div class="btn-row mt"><button class="btn" id="spNochmal">Nächste Runde ›</button>
    <button class="btn secondary" id="spFertig">Fertig für jetzt</button></div>`;
  document.getElementById("spNochmal").onclick = nochmal;
  document.getElementById("spFertig").onclick = zurueckFn;
  if (ok === n) miniKonfetti();
}

/* Die Aufloesung NACH der Runde (Jennifer, 03.09.2026: "erlaeuterungen warum.
   was die unterschiede und gemeinsamkeiten sind jeweils. bevor es weitergeht.
   also nach der uebung als aufloesung").

   Optional: Gruppen ohne kontrast-Feld verhalten sich unveraendert. gemeinsam
   darf fehlen - es gibt Paare, die wirklich nichts teilen, und dann soll dort
   nichts Erfundenes stehen. */
function kontrastHtml(gruppe) {
  const k = gruppe.kontrast;
  if (!k) return "";
  const zeile = (titel, text) => text
    ? `<div class="kontrast-zeile"><b>${esc(titel)}</b><span>${Beleg.render(text, gruppe.oberthema)}</span></div>` : "";
  return `<div class="card mt"><b>&#128270;&nbsp; Wo der Unterschied wirklich liegt</b>
    <div class="kontrast">
      ${zeile("Gemeinsam", k.gemeinsam)}
      ${(k.unterschiede || []).map((u) => zeile(u.label, u.text)).join("")}
      ${zeile("Woran du es erkennst", k.signal)}
    </div></div>`;
}

const konzepteHabenBeide = (gruppe) => gruppe.konzepte.some((k) => k.key === "beide");

// ============ GAME 1: Verwechslungspaare ============
/* 8 -> 10 am 04.09.2026 (Jennifer: "ganz subtil die Zahl der Antworten
   erhoehen"). Die Verschaerfung sitzt bewusst HIER und nicht am Tagesziel:
   schwellenFuerTag() und die FOKUS_*-Konstanten in core.js rekonstruieren die
   Schwellen vom 20.-26.08. und duerfen nicht angefasst werden. */
const VP_RUNDE = 10, VP_RUNDE_BOSS = 12;
export function vpSpiel(zurueckFn, gruppeId = null) {
  if (!VIG) return zurueckFn();
  const gew = themenGewichte();
  const bk = beherrschungAlle();
  // Fehler in frueheren vp-Runden je Item: falsch beantwortete kommen eher wieder
  const itemFehler = {};
  for (const a of C.state().antwortLog) if (a.modus === "vp" && !a.voll) itemFehler[a.qid] = (itemFehler[a.qid] || 0) + 1;
  // Rotation (Roses Feedback 10.08.): zuletzt gespielte Gruppen stark abwerten,
  // sonst gewinnt die schwaechste Gruppe jeden Tag aufs Neue mit denselben Karten.
  const itemGruppe = {};
  for (const g of VIG.gruppen) for (const i of g.items) itemGruppe[i.id] = g.id;
  const zuletzt = [...new Set(C.state().antwortLog.filter((a) => a.modus === "vp").slice(-3 * VP_RUNDE).map((a) => itemGruppe[a.qid]).filter(Boolean))];
  const malus = (g) => !zuletzt.includes(g.id) ? 1 : (g.id === zuletzt[zuletzt.length - 1] ? 0.1 : 0.35);
  const gruppe = gruppeId
    ? VIG.gruppen.find((g) => g.id === gruppeId)
    : zieh(VIG.gruppen, 1, (g) => malus(g) * (gew[g.oberthema + "/" + g.unterthema] || 1) * (1 + Math.min(2, g.items.reduce((s, i) => s + (itemFehler[i.id] || 0), 0) / 3)))[0];
  if (!gruppe) return zurueckFn();
  /* Die Stufe der GRUPPE, nicht des einzelnen Items: ein Verwechslungspaar ist
     beherrscht, wenn seine Karten es sind - und die Runde zieht ohnehin genau
     eine Gruppe. Das ist die Bereiche-Haelfte von Jennifers "fragen/bereiche". */
  const stufe = stufeFuerIds(gruppe.items.map((i) => i.id), bk);
  const rundenLaenge = stufe >= 3 ? VP_RUNDE_BOSS : VP_RUNDE;
  let items = zieh(gruppe.items, Math.min(rundenLaenge, gruppe.items.length), (i) => 1 + Math.min(3, itemFehler[i.id] || 0));
  /* Mindestens EINE beide-Karte, wenn die Gruppe das dritte Fach hat.
     Nachgerechnet am 04.09.2026 gegen Roses echte Fehlerzahlen: ohne diesen
     Boden haette bei vp-datennutzung jede achte Runde gar keine enthalten
     (12,6 %), bei vp-parsons-funktionen jede zehnte. In so einer Runde traefe
     Rose das dritte Fach als Ueberraschung, und die Kontrast-Karte am Ende
     erklaerte eine Unterscheidung, die in der Runde nie vorkam.
     Getauscht wird die zuletzt gezogene Karte, danach wird neu gemischt, damit
     die beide-Karte nicht immer am selben Platz steht. */
  if (konzepteHabenBeide(gruppe) && !items.some((i) => i.richtig === "beide")) {
    const kandidaten = gruppe.items.filter((i) => i.richtig === "beide" && !items.includes(i));
    if (kandidaten.length) {
      items[items.length - 1] = zieh(kandidaten, 1)[0];
      items = zieh(items, items.length);
    }
  }
  const t = C.THEMEN[gruppe.oberthema] || {};
  let idx = 0, richtig = 0, t0 = Date.now();

  // Swipe in bis zu 4 Richtungen (Jennifer 21.07.): links/rechts/oben/unten,
  // je nachdem wie viele Konzepte die Gruppe hat. Chips bleiben als Tap-Weg.
  /* Seit dem 04.09.2026 einmal je Runde GEMISCHT. Vorher stand bei jedem
     Zwei-Konzept-Paar dasselbe Konzept immer links - bei zehn Karten am Stueck
     lernt man die Richtung und nicht den Inhalt. Die Beschriftung wandert mit,
     es ist also kein Gedaechtnistrick, sondern nur das Ende des Positionslernens.
     Bewusst je RUNDE und nicht je Karte: mitten in der Runde die Seiten zu
     tauschen fuehlt sich am Handy wie ein Fehler an. */
  const konz = zieh(gruppe.konzepte, gruppe.konzepte.length);
  /* Ab Stufe 2 fallen die kurzen Stichworte an den Chips weg ("Leistung",
     "Entscheidung"). Sie sind die eigentliche Kruecke des Spiels: wer sie liest,
     muss das Konzept nicht mehr kennen. */
  const zeigKurz = stufe < 2;
  const K = Math.min(4, konz.length);
  const RICHTUNG_PFEIL = ["←", "→", "↑", "↓"];

  const mal = () => {
    const it = items[idx];
    const chips = konz.map((k, i) => `<button class="vp-chip" data-k="${k.key}" style="--tc:${t.color}">${i < K ? `<small class="vp-pfeil">${RICHTUNG_PFEIL[i]}</small>` : ""}${esc(k.label)}${zeigKurz && k.kurz ? `<small>${esc(k.kurz)}</small>` : ""}</button>`).join("");
    const seite = (i, cls, pfeilVor) => i < K
      ? `<div class="vp-seite ${cls}" id="vpS${i}">${pfeilVor ? `<span>${RICHTUNG_PFEIL[i]}</span>` : ""}${esc(konz[i].label)}${pfeilVor ? "" : `<span>${RICHTUNG_PFEIL[i]}</span>`}</div>` : "";
    app().innerHTML = `<div class="fade-in">
      ${kopf("🔀 Verwechslungspaare", zurueckFn, stufenAbzeichen(stufe))}
      <div class="vp-titel"><span class="chip" style="--tc:${t.color}">${t.kurz || ""}</span> <b>${esc(gruppe.titel)}</b> ${M.infoBtn("interleaving")}</div>
      <div class="q-progress" style="margin:8px 0"><span class="bar thin"><i style="width:${(100 * idx) / items.length}%"></i></span><span>${idx + 1}/${items.length}</span></div>
      ${seite(2, "oben", true)}
      <div class="vp-buehne">
        ${seite(0, "links", true)}
        <div class="vp-card" id="vpCard" style="touch-action:${K > 2 ? "none" : "pan-y"}"><p>${esc(it.text)}</p><div class="vp-hint">wischen (${RICHTUNG_PFEIL.slice(0, K).join(" ")}) oder unten tippen</div></div>
        ${seite(1, "rechts", false)}
      </div>
      ${seite(3, "unten", true)}
      <div class="vp-chips">${chips}</div>
      <div id="vpFb"></div>
    </div>`;
    Hub.bindeZurueck(app(), zurueckFn);
    const antworte = (key, richtungIdx = -1) => {
      const ok = key === it.richtig;
      if (ok) richtig++;
      const zeit = Math.round((Date.now() - t0) / 1000);
      logSpiel("vp", it.id, ok ? 1 : 0, 1, ok, zeit);
      const richtigLbl = (konz.find((k) => k.key === it.richtig) || {}).label || it.richtig;
      const card = document.getElementById("vpCard");
      // Richtig: Karte fliegt in die gewischte Richtung raus. Falsch: Karte
      // schnappt zurueck und schuettelt kurz den Kopf.
      if (!REDUCE_MOTION && ok && richtungIdx >= 0) {
        const [fx, fy] = [[-1.4, 0], [1.4, 0], [0, -1.2], [0, 1.2]][richtungIdx];
        card.style.transition = "transform .3s ease, opacity .3s ease";
        card.style.transform = `translate(${fx * 160}px, ${fy * 140}px) rotate(${fx * 16}deg)`;
        card.style.opacity = ".25";
      } else {
        card.style.transition = "transform .18s ease";
        card.style.transform = "";
      }
      card.classList.add(ok ? "ok" : "nope");
      const fb = document.getElementById("vpFb");
      fb.innerHTML = `<div class="fb-banner ${ok ? "good" : "bad"}">${sticker(ok ? "good" : "sanft")}<span>${ok ? "Richtig! 🎉" : `Das war: <b>${esc(richtigLbl)}</b> — gut, dass es hier passiert und nicht in der Klausur.`}</span></div>
        <div class="explain ${ok ? "good" : "bad"}">${Beleg.render(it.erklaerung || gruppe.merksatz, gruppe.oberthema)}</div>
        <button class="btn" id="vpWeiter" style="width:100%;margin-top:10px">${idx + 1 < items.length ? "Weiter ›" : "Runde abschließen"}</button>`;
      app().querySelectorAll(".vp-chip").forEach((c) => { c.disabled = true; if (c.dataset.k === it.richtig) c.classList.add("richtig"); else if (c.dataset.k === key) c.classList.add("falsch"); });
      app().querySelectorAll(".vp-seite").forEach((s) => s.classList.remove("an"));
      document.getElementById("vpWeiter").onclick = () => {
        idx++;
        if (idx < items.length) { t0 = Date.now(); mal(); }
        else fazit(document.getElementById("vpFb"), richtig, items.length,
          () => vpSpiel(zurueckFn), zurueckFn,
          `<div class="card mt"><b>Merksatz</b><div class="explain good" style="margin-top:6px">${Beleg.render(gruppe.merksatz, gruppe.oberthema)}</div></div>${kontrastHtml(gruppe)}`);
      };
    };
    app().querySelectorAll(".vp-chip").forEach((c) => c.onclick = () => {
      if (c.disabled) return;
      antworte(c.dataset.k, konz.findIndex((k) => k.key === c.dataset.k));
    });

    // Swipe: Karte folgt dem Finger in x UND y, Schwelle 80px auf der
    // dominanten Achse; Seitenlabels leuchten waehrend des Ziehens auf.
    const card = document.getElementById("vpCard");
    let sx = null, sy = null, dx = 0, dy = 0, beantwortet = false;
    const seiteAn = (i, an) => document.getElementById(`vpS${i}`)?.classList.toggle("an", an);
    const move = () => {
      card.style.transform = `translate(${dx}px, ${K > 2 ? dy : 0}px) rotate(${dx / 18}deg)`;
      seiteAn(0, dx < -30 && Math.abs(dx) >= Math.abs(dy));
      seiteAn(1, dx > 30 && Math.abs(dx) >= Math.abs(dy));
      if (K > 2) seiteAn(2, dy < -30 && Math.abs(dy) > Math.abs(dx));
      if (K > 3) seiteAn(3, dy > 30 && Math.abs(dy) > Math.abs(dx));
    };
    const ende = () => {
      if (sx == null || beantwortet) return;
      const hx = Math.abs(dx) >= Math.abs(dy);
      let ri = -1;
      if (hx && dx < -80) ri = 0;
      else if (hx && dx > 80) ri = 1;
      else if (!hx && dy < -80 && K > 2) ri = 2;
      else if (!hx && dy > 80 && K > 3) ri = 3;
      if (ri >= 0) { beantwortet = true; antworte(konz[ri].key, ri); }
      else { card.style.transition = "transform .18s ease"; card.style.transform = ""; setTimeout(() => { card.style.transition = ""; }, 200); }
      sx = sy = null; dx = dy = 0;
      if (!beantwortet) app().querySelectorAll(".vp-seite").forEach((s) => s.classList.remove("an"));
    };
    card.addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; card.setPointerCapture(e.pointerId); });
    card.addEventListener("pointermove", (e) => { if (sx != null && !beantwortet) { dx = e.clientX - sx; dy = e.clientY - sy; move(); } });
    card.addEventListener("pointerup", ende);
    card.addEventListener("pointercancel", ende);
    document.addEventListener("keydown", function tast(e) {
      if (!document.getElementById("vpCard")) { document.removeEventListener("keydown", tast); return; }
      if (beantwortet) return;
      const ri = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].indexOf(e.key);
      if (ri >= 0 && ri < K) { e.preventDefault(); beantwortet = true; antworte(konz[ri].key, ri); }
    });
  };
  mal();
}

// ============ GAME 2: Operatoren-Wortschatz ============
// Beide Minigames haengen direkt im Hub (Jennifer 21.07.: keine Zwischenseite).
// Die Wendungs-Liste (Nachschlagewerk) liegt als 📖-Sheet ueber der Runde —
// aufklappen ohne den Rundenstand zu verlieren.
function wendungenSheet() {
  if (!OPS) return;
  const rows = OPS.operatoren.map((o) => `<details class="sub op-karte"><summary><b>${esc(o.wendung)}</b><span class="muted"> — ${esc(o.verlangt)}</span></summary>
    ${o.tipp ? `<div class="explain good"><span class="bt">💪 ${esc(o.tipp)}</span></div>` : ""}
    ${(o.beispiele || []).map((b) => `<p class="op-beispiel">„${esc(b.text)}"</p>`).join("")}
  </details>`).join("");
  const ov = document.createElement("div");
  ov.className = "sheet-ov";
  ov.innerHTML = `<div class="sheet" role="dialog" aria-label="Alle Wendungen" style="max-height:82vh;display:flex;flex-direction:column">
    <div class="sheet-grip"></div>
    <h3>📖 Alle Wendungen ${M.infoBtn("operatoren")}</h3>
    <p class="muted" style="font-size:.82rem;margin:0 0 8px">Antippen zum Aufklappen — mit Strategie-Tipp und echten Beispielen aus deinem Fragen-Korpus.</p>
    <div style="overflow-y:auto;min-height:0">${rows}</div>
    <button class="btn small" data-sheet-close style="margin-top:10px">Zurück zur Runde</button>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-sheet-close]")) ov.remove(); });
}
const wendungenBtn = `<button class="btn ghost small" id="opWendungen" title="Alle Wendungen nachschlagen" style="margin-left:auto">📖</button>`;
const bindWendungen = () => { const b = document.getElementById("opWendungen"); if (b) b.onclick = wendungenSheet; };

const OP_RUNDE = 8;          // 6 -> 8 am 04.09.2026
const OP_OPTIONEN_BOSS = 6;  // statt der 3-4 aus den Daten

/* Ab Stufe 2 wird die Aufgabe mit echten Ablenkern aufgefuellt: die uebrigen
   Wendungen aus OPS.operatoren. Das ist der ehrliche Weg, eine 1-aus-3-Frage
   schwerer zu machen, ohne neue Daten zu erfinden - die Distraktoren sind alle
   real und alle pruefungsrelevant.
   Fuer "operator"-Fragen sind es andere Wendungen, fuer "was_will"-Fragen andere
   Anforderungen; das Feld entscheidet, welche Spalte gezogen wird. */
function opAufgabe(u, stufe) {
  if (stufe < 2 || !OPS) return { optionen: u.optionen, richtig: u.richtig };
  const feld = u.frage === "operator" ? "wendung" : "verlangt";
  const da = new Set(u.optionen.map((x) => String(x).toLowerCase()));
  const extra = [...new Set(OPS.operatoren.map((o) => o[feld]).filter((x) => x && !da.has(String(x).toLowerCase())))];
  const dazu = zieh(extra, Math.max(0, OP_OPTIONEN_BOSS - u.optionen.length));
  const richtigText = u.optionen[u.richtig];
  const alle = zieh([...u.optionen, ...dazu], u.optionen.length + dazu.length);
  // Fangnetz: findet sich der richtige Text nicht wieder, bleibt alles beim Alten.
  const ri = alle.indexOf(richtigText);
  return ri < 0 ? { optionen: u.optionen, richtig: u.richtig } : { optionen: alle, richtig: ri };
}

export function opUeben(zurueckFn) {
  if (!OPS?.uebungen?.length) return zurueckFn();
  const fehler = {};
  for (const a of C.state().antwortLog) if (a.modus === "op" && !a.voll) fehler[a.qid] = (fehler[a.qid] || 0) + 1;
  const bk = beherrschungAlle();
  const aufgaben = zieh(OPS.uebungen, Math.min(OP_RUNDE, OPS.uebungen.length), (u) => 1 + Math.min(3, fehler[u.id] || 0));
  // Kopf-Abzeichen nach der RUNDE, Optionen nach dem EINZELNEN Item: der Kopf
  // steht ueber allen acht Aufgaben, die Schwierigkeit gehoert an die Aufgabe.
  const rundenStufe = stufeFuerIds(aufgaben.map((u) => u.id), bk);
  let idx = 0, richtig = 0, t0 = Date.now();
  const mal = () => {
    const u = aufgaben[idx];
    const aufg = opAufgabe(u, stufeVon(bk.get(u.id)));
    app().innerHTML = `<div class="fade-in">${kopf("🎯 Signalwörter", zurueckFn, stufenAbzeichen(rundenStufe) + wendungenBtn)}
      <div class="q-progress" style="margin:8px 0"><span class="bar thin"><i style="width:${(100 * idx) / aufgaben.length}%"></i></span><span>${idx + 1}/${aufgaben.length}</span></div>
      <div class="card">
        <div class="q-fall" style="font-style:italic">„${esc(u.stamm)}"</div>
        <div class="q-text" style="font-size:1rem">${u.frage === "operator" ? "Welches Signalwort steuert hier die Aufgabe?" : "Was verlangt diese Frage von dir?"} ${M.infoBtn("operatoren")}</div>
        <div class="answers">${aufg.optionen.map((o, i) => `<button class="ans op-opt" data-i="${i}"><span>${esc(o)}</span></button>`).join("")}</div>
        <div id="opFb"></div>
      </div></div>`;
    Hub.bindeZurueck(app(), zurueckFn);
    bindWendungen();
    app().querySelectorAll(".op-opt").forEach((b) => b.onclick = () => {
      const i = +b.dataset.i, ok = i === aufg.richtig;
      if (ok) richtig++;
      logSpiel("op", u.id, ok ? 1 : 0, 1, ok, Math.round((Date.now() - t0) / 1000));
      app().querySelectorAll(".op-opt").forEach((x) => {
        x.disabled = true;
        if (+x.dataset.i === aufg.richtig) x.classList.add("correct");
        else if (x === b) x.classList.add("wrong");
      });
      document.getElementById("opFb").innerHTML = `<div class="fb-banner ${ok ? "good" : "part"}">${sticker(ok ? "good" : "sanft")}<span>${ok ? "Erkannt! 🎯" : "Knapp daneben — genau dafür ist das Training da."}</span></div>
        <div class="explain ${ok ? "good" : "bad"}"><span class="bt">${esc(u.erklaerung || "")}</span></div>
        <button class="btn" id="opWeiter" style="width:100%;margin-top:10px">${idx + 1 < aufgaben.length ? "Weiter ›" : "Runde abschließen"}</button>`;
      document.getElementById("opWeiter").onclick = () => {
        idx++;
        if (idx < aufgaben.length) { t0 = Date.now(); mal(); }
        else fazit(document.getElementById("opFb"), richtig, aufgaben.length, () => opUeben(zurueckFn), zurueckFn);
      };
    });
  };
  mal();
}

/* Zwei Spalten, links antippen, rechts zuordnen — dieselbe Mechanik wie der
   Begriffe-Blitz hier und drueben. Sie liegt seit dem 12.08.2026 im geteilten
   Baustein geteilt-zuordnen.js (Quelle: rose/geteilte-styles/spiel-zuordnen.js,
   nie die Kopie bearbeiten). Hier bleibt nur, was dieses Spiel eigen hat: der
   qid-Praefix opz- (daran und NUR daran unterscheidet spieleHeute() Zuordnen
   von Signalwoerter) und das Fazit mit den Wendungen zum Nachlesen.
   Gedreht wird hier nicht — eine Wendung rueckwaerts aus ihrer Anforderung zu
   erraten waere ein anderes Spiel. */
const OPZ_PAARE = 5, OPZ_PAARE_BOSS = 7;
export function opZuordnen(zurueckFn) {
  const moeglich = OPS.operatoren.filter((o) => o.verlangt);
  /* Rundenstufe ueber die opz-qids - der Zuordnen-Log traegt das Praefix opz-,
     und genau daran (und nur daran) unterscheidet spieleHeute() dieses Spiel
     von den Signalwoertern. Wer das Praefix aendert, muss hier mitziehen. */
  const stufe = stufeFuerIds(moeglich.map((o) => "opz-" + o.id));
  const paare = zieh(moeglich, Math.min(stufe >= 2 ? OPZ_PAARE_BOSS : OPZ_PAARE, moeglich.length));
  const t0 = Date.now();
  app().innerHTML = `<div class="fade-in">${kopf("↔️ Zuordnen", zurueckFn, stufenAbzeichen(stufe) + wendungenBtn)}
    <p class="muted" style="margin:0 0 10px">Links die Wendung antippen, rechts, was sie verlangt.</p>
    <div id="opzSpiel"></div>
    <div id="opzFazit"></div></div>`;
  Hub.bindeZurueck(app(), zurueckFn);
  bindWendungen();
  document.getElementById("opzSpiel").appendChild(baueZuordnen({
    paare,
    linksText: (p) => p.wendung,
    rechtsText: (p) => p.verlangt,
    onTreffer: (id, voll) => logSpiel("op", "opz-" + id, voll ? 1 : 0, 1, voll, Math.round((Date.now() - t0) / 1000)),
    onFertig: ({ ok, n, fehler }) => {
      const erkl = paare.filter((p) => fehler.includes(p.id)).map((p) => `<div class="review-q" style="padding:8px 0"><b>${esc(p.wendung)}</b> → ${esc(p.verlangt)}${p.tipp ? `<div class="explain good"><span class="bt">${esc(p.tipp)}</span></div>` : ""}</div>`).join("");
      fazit(document.getElementById("opzFazit"), ok, n, () => opZuordnen(zurueckFn), zurueckFn,
        erkl ? `<div class="card mt"><h3>Kurz nachlesen</h3>${erkl}</div>` : "");
    },
  }));
}

// ============ GAME 3: Fragen-Detektiv ============
const DT_RUNDE = 8;              // 6 -> 8 am 04.09.2026
const DT_CHIPS = 4, DT_CHIPS_BOSS = 6;
const DT_WILL = [
  ["nicht", "Die NICHT-zutreffenden finden", (q) => q.fragetyp === "negation"],
  ["richtig", "Die zutreffenden Aussagen finden", (q) => q.fragetyp !== "negation" && q.fragetyp !== "anwendung"],
  ["fall", "Einen Fall/ein Beispiel einem Konzept zuordnen", (q) => q.fragetyp === "anwendung"],
];
export function dtSpiel(zurueckFn) {
  const sperr = C.pkGesperrt();
  const pool = C.pool().filter((q) => q.quizbar && q.konzept && q.relevanz !== "laut-rose-nicht-relevant"
    && (q.sprache || "schwer") !== "einfach" && !sperr.has(q.id) && q.frage.length > 30);
  if (pool.length < 10) return zurueckFn();
  // Globaler Pingo-Filter gilt fuer die GEUEBTEN Fragen; die Konzept-Decoys kommen
  // weiter aus dem ganzen Bestand — sonst waeren die Chips im kleinen Pingo-Pool
  // schnell aufgebraucht und das Spiel raet sich von allein.
  // Die Tagesspiele haben keine eigene cfg, also gilt hier die GEMERKTE Wahl —
  // genau wie bei den Schnellstarts auf der Startseite. (Hiess bis zum 12.08.
  // C.nurPingo(); der Rename beim Umbau auf Optionen-pro-Runde hat diese eine
  // Stelle uebersehen, und die Kachel ist beim Antippen still gestorben.)
  const basis = C.nurPingoGemerkt() ? pool.filter(C.istPingo) : pool;
  if (basis.length < DT_RUNDE) return zurueckFn();
  const gew = themenGewichte();
  // Negationen bewusst haeufiger (Roses teuerster Fragetyp) + schwache Unterthemen
  const fragen = zieh(basis, DT_RUNDE, (q) => (q.fragetyp === "negation" ? 2.5 : q.fragetyp === "anwendung" ? 1.5 : 1) * (gew[q.oberthema + "/" + q.unterthema] || 1));
  const bk = beherrschungAlle();
  const rundenStufe = stufeFuerIds(fragen.map((q) => "dt-" + q.id), bk);
  let idx = 0, punkte = 0, t0 = Date.now();
  const mal = () => {
    const q = fragen[idx];
    const stufe = stufeVon(bk.get("dt-" + q.id));
    const willRichtig = DT_WILL.find(([, , test]) => test(q))[0];
    /* Konzept-Chips: das echte plus Decoys aus demselben Oberthema.
       Bis zum 04.09.2026 kamen die Decoys bevorzugt aus ANDEREN Unterthemen -
       also aus gut unterscheidbarer Entfernung. Ab Stufe 2 dreht sich die
       Sortierung um: die Ablenker stehen dann im SELBEN Unterthema, und genau
       das ist die Verwechslung, die in der Klausur Punkte kostet. Ab Stufe 3
       kommen zwei Chips dazu. Eine Zeile, kein neuer Datensatz. */
    const nah = stufe >= 2;
    const chips = stufe >= 3 ? DT_CHIPS_BOSS : DT_CHIPS;
    const andere = [...new Set(pool.filter((x) => x.oberthema === q.oberthema && x.konzept !== q.konzept)
      .sort((a, b) => {
        const na = a.unterthema === q.unterthema ? 1 : 0, nb = b.unterthema === q.unterthema ? 1 : 0;
        return nah ? nb - na : na - nb;
      })
      .map((x) => x.konzept))].slice(0, 8);
    const konzepte = zieh([q.konzept, ...zieh(andere, chips - 1)], chips);
    let wahlWill = null, wahlKonzept = null;
    app().innerHTML = `<div class="fade-in">${kopf("🕵️ Fragen-Detektiv", zurueckFn, stufenAbzeichen(rundenStufe))}
      <div class="q-progress" style="margin:8px 0"><span class="bar thin"><i style="width:${(100 * idx) / fragen.length}%"></i></span><span>${idx + 1}/${fragen.length}</span></div>
      <div class="card">
        <p class="muted" style="margin:0 0 6px;font-size:.82rem">Nur der Fragen-Stamm — noch keine Antworten. Lies wie ein Detektiv: ${M.infoBtn("paraphrasieren")}</p>
        <div class="q-text">${esc(q.frage)}</div>
        <div class="dt-block"><b>1 · Was will die Frage?</b>
          <div class="dt-chips">${DT_WILL.map(([k, l]) => `<button class="vp-chip" data-will="${k}">${l}</button>`).join("")}</div></div>
        <div class="dt-block"><b>2 · Welches Konzept steckt drin?</b>
          <div class="dt-chips">${konzepte.map((k) => `<button class="vp-chip" data-konzept="${esc(k)}">${esc(k)}</button>`).join("")}</div></div>
        <div id="dtFb"></div>
      </div></div>`;
    Hub.bindeZurueck(app(), zurueckFn);
    const fertigWennBeide = () => {
      if (wahlWill == null || wahlKonzept == null) return;
      const okWill = wahlWill === willRichtig, okKonzept = wahlKonzept === q.konzept;
      const p = (okWill ? 1 : 0) + (okKonzept ? 1 : 0);
      punkte += p;
      logSpiel("detektiv", "dt-" + q.id, p, 2, p === 2, Math.round((Date.now() - t0) / 1000));
      app().querySelectorAll("[data-will]").forEach((b) => {
        b.disabled = true;
        if (b.dataset.will === willRichtig) b.classList.add("richtig");
        else if (b.dataset.will === wahlWill) b.classList.add("falsch");
      });
      app().querySelectorAll("[data-konzept]").forEach((b) => {
        b.disabled = true;
        if (b.dataset.konzept === q.konzept) b.classList.add("richtig");
        else if (b.dataset.konzept === wahlKonzept) b.classList.add("falsch");
      });
      const t = C.THEMEN[q.oberthema] || {};
      document.getElementById("dtFb").innerHTML = `
        <div class="fb-banner ${p === 2 ? "good" : p === 1 ? "part" : "bad"}"><span>${p === 2 ? "Beides erkannt — genau so liest man Klausurfragen! 🎉" : p === 1 ? "Eins von zwei — schon halb geknackt." : "Jetzt weißt du, worauf du achten kannst."}</span></div>
        <div class="explain good"><span class="bt">Diese Frage ${willRichtig === "nicht" ? "will die NICHT-zutreffenden Aussagen" : willRichtig === "fall" ? "will einen Fall einem Konzept zuordnen" : "will die zutreffenden Aussagen"} — Konzept: <b>${esc(q.konzept)}</b> <span class="chip" style="--tc:${t.color}">${t.kurz || ""}</span></span></div>
        <button class="btn" id="dtWeiter" style="width:100%;margin-top:10px">${idx + 1 < fragen.length ? "Weiter ›" : "Runde abschließen"}</button>`;
      document.getElementById("dtWeiter").onclick = () => {
        idx++;
        if (idx < fragen.length) { t0 = Date.now(); mal(); }
        else fazit(document.getElementById("dtFb"), Math.round(punkte / 2), fragen.length, () => dtSpiel(zurueckFn), zurueckFn,
          `<p class="muted" style="margin:8px 0 0">${punkte}/${fragen.length * 2} Detektiv-Punkte. Der Trick für die Klausur: erst Stamm knacken, dann kreuzen.</p>`);
      };
    };
    app().querySelectorAll("[data-will]").forEach((b) => b.onclick = () => {
      if (wahlWill != null) return;
      wahlWill = b.dataset.will;
      app().querySelectorAll("[data-will]").forEach((x) => x.classList.toggle("sel", x === b));
      fertigWennBeide();
    });
    app().querySelectorAll("[data-konzept]").forEach((b) => b.onclick = () => {
      if (wahlKonzept != null) return;
      wahlKonzept = b.dataset.konzept;
      app().querySelectorAll("[data-konzept]").forEach((x) => x.classList.toggle("sel", x === b));
      fertigWennBeide();
    });
  };
  mal();
}
