/* Maskottchen — Stufe 1: das Ei.
   Sitzt oben in der Tagesziel-Karte. Es sammelt Herzen aus dem, was Rose
   ohnehin uebt, und kommt dem Schluepfen naeher. Was drin ist, sagt es nicht.

   Waehrung sind HERZEN, nicht richtige Antworten: pro Uebungstag eins fuers
   Anfangen, eins fuers Minimum, eins fuers Tagespensum. Das belohnt Auftauchen
   statt Koennen — ein zaeher Tag mit drei Karten zahlt trotzdem. Das Streckziel
   gibt stattdessen einen Stern.

   Die Historie wird rueckwirkend gerechnet: Rose faengt nicht bei null an,
   sondern bekommt gutgeschrieben, was sie seit Juli geleistet hat.

   Ablauf beim ersten Mal:
     1. "Da war jemand am Nest"  — es ist nur klar, dass etwas da ist
     2. Auswahl wie beim Starter — drei Eier, eins nach dem anderen, mit einem
        Hinweis, der etwas ueber den Charakter andeutet und nichts verraet
     3. danach die kompakte Ansicht mit Herzen

   WICHTIG: Ob die Ankunft laeuft, haengt allein daran, ob schon ein Ei gewaehlt
   wurde (state.mk.ei — synct mit, siehe core.js snapshot). Solange keins
   gewaehlt ist, kommt sie bei jedem
   Oeffnen wieder. Beim Testen mit Roses Sync-Code also NICHT auswaehlen — sonst
   ist der Moment fuer sie weg, bevor sie ihn hatte.

   Entwurf, Archiv und Werkstatt: playground/rose/maskottchen/ */
import * as C from "./core.js";

const REDUCE_MOTION = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Herzen aus der echten Uebungshistorie ----------
   Fuer vergangene Tage ist der damalige Tagesplan nicht gespeichert; wir
   rechnen sie mit den heutigen Schwellen. Grosszuegig gerundet und bewusst so:
   bei einer Belohnungswaehrung ist ein Herz zu viel harmlos, eines zu wenig
   fuehlt sich wie Betrug an. */
/* aktOverride ist NUR fuer die Testseite (playground/rose/maskottchen/viewer/):
   damit laesst sich ein statischer Abzug von Roses Historie einspeisen, ohne
   ihre echten Daten anzufassen. Die App ruft die Funktion immer ohne auf. */
export function herzenStand(tz, aktOverride) {
  const min = tz && tz.minimum ? tz.minimum : 15;
  const ziel = tz && tz.ziel ? tz.ziel : 35;
  const stretch = tz && tz.stretch ? tz.stretch : 55;
  const akt = aktOverride || C.aktivitaetProTag();
  let herzen = 0, sterne = 0, tage = 0;
  for (const key of Object.keys(akt)) {
    const n = akt[key].n || 0;
    if (!n) continue;
    tage++;
    herzen += 1 + (n >= min ? 1 : 0) + (n >= ziel ? 1 : 0);
    if (n >= stretch) sterne++;
  }
  return { herzen, sterne, tage };
}

/* Gruss nach Tageszeit. Nachts bewusst leise — das Ei soll abends nicht an
   offene Karten erinnern. */
const grussVon = (h) => h < 5 ? "Nanu, so spät noch" : h < 11 ? "Guten Morgen" : h < 14 ? "Hallo" : h < 18 ? "Hey" : h < 22 ? "Guten Abend" : "Psst";

/* Was das Ei heute schon bekommen hat: eins fuers Anfangen, eins fuers
   Minimum, eins fuers Tagespensum — dieselbe Rechnung wie fuer die Historie. */
function herzenHeute(tz) {
  if (!tz) return 0;
  const n = tz.n || 0;
  return (n > 0 ? 1 : 0) + (n >= tz.minimum ? 1 : 0) + (n >= tz.ziel ? 1 : 0);
}

/* ---------- Was das Ei sagt ----------
   Das Ei SPRICHT, es wird nicht beschrieben: "Ich hab mich bewegt" statt "Das
   Ei hat sich bewegt". So war es von Anfang an in der Werkstatt gedacht
   (figuren.js), im Trainer stand aber die beschreibende Fassung.

   Der Satz reagiert zuerst auf HEUTE und erst dann auf die Stufe — was gerade
   passiert ist, interessiert mehr als der Gesamtstand. Mehrere Saetze je Lage,
   damit es sich nicht abnutzt; ausgewaehlt wird nach Kalendertag statt zufaellig,
   sonst springt der Text bei jedem Neuzeichnen.

   Ton: nie Druck, nie Schuld. "Noch nichts heute" ist eine Feststellung, kein
   Vorwurf — das Ei wartet einfach und findet das in Ordnung. */
/* Schwellen am 12.08. halbiert (Jennifer): vorher 0/20/45, jetzt 0/10/22.
   Mit 45 Herzen bis zum Riss waere Rose Wochen unterwegs gewesen, ohne dass
   sich sichtbar etwas tut — bei einer Belohnungswaehrung ist das zu lang.
   Ihr Stand von 26 Herzen liegt damit bereits auf der letzten Stufe. */
/* ---------- Die Leiter, neun Stufen ----------
   Kalibriert auf Roses echten Stand am 12.08. (27 Herzen) und darauf, dass ein
   Uebungstag fast immer genau 3 Herzen bringt — das ist die harte Groesse,
   deshalb wird in UEBUNGSTAGEN gerechnet und nicht in Kalendertagen. Sie uebt
   im Schnitt alle 2,5 Tage, Klausur ist der 18.09.

     Stufe 3 (schlueft)   31 = 1,5 Uebungstage ab jetzt
     Stufe 8 (erwachsen)  48 = 7 Uebungstage   ab jetzt, also etwa der 30.08.

   Erwachsen liegt bewusst knapp drei Wochen vor der Klausur und nicht kurz
   davor (der erste Entwurf hatte 60 = 09.09.): ab Stufe 8 oeffnet der Shop,
   und Kleidung auszuprobieren soll noch Zeit haben, solange Ueben leicht ist
   (Jennifer, 12.08.). Nach dem Schluepfen passiert dann etwa jeden Uebungstag
   etwas — die Abstaende sind mit Absicht 3 und 4 Herzen, nicht mehr.

   ANHAENGEN IST SICHER, UMSORTIEREN NICHT. mk.stufeMax speichert die hoechste
   je erreichte Stufe als INDEX und synct. Wird die Liste umsortiert, zeigt ein
   gespeicherter Wert auf ein anderes Bild — der Wert ueberlebt, seine Bedeutung
   nicht. Die Stufen 0/1/2 muessen darum die Ei-Stufen bleiben. */
const STUFEN = [
  { ab: 0,  art: "ei",   sub: 0, satz: "Ich bin einfach hier hingeploppt. Mal sehen, was aus mir wird." },
  { ab: 10, art: "ei",   sub: 1, satz: "Ich hab mich bewegt. Nur ein bisschen, aber ich hab." },
  { ab: 22, art: "ei",   sub: 2, satz: "Es knackt. Nicht erschrecken — ich glaub, es geht bald los." },
  { ab: 31, art: "blob", sub: 0, satz: "Oh. Hallo. Ich bin … irgendwas." },
  { ab: 34, art: "blob", sub: 1, satz: "Zwei Augen! Die waren gestern noch nicht da." },
  { ab: 38, art: "blob", sub: 2, satz: "Da wachsen Ohren. Ich glaub, ich werd was Bestimmtes." },
  { ab: 41, art: "jung", sub: 0, satz: "Jetzt sieht man's. Ich bin eine Katze." },
  { ab: 45, art: "jung", sub: 1, satz: "Ich wachse noch. Aber ich weiß schon, wie du lernst." },
  { ab: 48, art: "erwachsen", sub: 0, satz: "Ausgewachsen. Ab jetzt sammeln wir zusammen." },
];
/* Die Stufe, bei der aus dem Ei ein Tier wird. Als Konstante, weil drei Stellen
   sie brauchen (Moment ausloesen, Bild waehlen, Test) und eine 3 im Code an der
   dritten Stelle niemand mehr zuordnet. */
export const SCHLUEPF_STUFE = 3;

const SPRUCH = {
  // Nachts leise. Kein Wort ueber offene Karten — abends soll das Ei nicht mahnen.
  nacht: [
    "Ich mach die Augen zu. Bis morgen.",
    "Schlaf gut. Ich bin morgen noch da.",
    "So spaet noch? Ich leg mich hin.",
  ],
  // Noch nichts heute: warten, ohne zu draengeln.
  ruhig: [
    "Ich lieg hier und warte. Kein Stress.",
    "Noch nichts passiert heute. Ist okay, ich hab Zeit.",
    "Ich bin da, wenn du magst. Eine Karte reicht mir schon.",
    "Heute noch gar nichts. Macht nichts, ich mag auch kurze Tage.",
  ],
  // Angefangen — das ist der wichtigste Moment, den feiert das Ei am meisten.
  start: [
    "Du hast angefangen. Genau das zaehlt bei mir am meisten.",
    "Da ist mein erstes Herz heute. Angefangen ist das Schwerste.",
    "Oh, du bist da. Das reicht mir schon fuer heute.",
  ],
  // Minimum geschafft.
  mitte: [
    "Zwei Herzen heute. Das war schon ein richtiger Tag.",
    "Ich hab zwei bekommen. Von mir aus kannst du jetzt aufhoeren.",
    "Zwei. Und ich hab nicht mal was dafuer tun muessen.",
  ],
  // Tagespensum voll.
  voll: [
    "Drei Herzen. Mehr kriege ich an einem Tag gar nicht.",
    "Das war alles, was heute ging. Ich bin satt.",
    "Voll. Ab jetzt uebst du nur noch fuer dich, nicht fuer mich.",
  ],
};
/* Nach Kalendertag statt zufaellig: innerhalb eines Tages bleibt der Satz
   stehen, auch wenn die Karte zwischendurch neu gezeichnet wird. */
function spruchVon(liste, tag) { return liste[tag % liste.length]; }

function satzVon(stufe, hh, nacht) {
  const tag = new Date().getDate();
  if (nacht) return spruchVon(SPRUCH.nacht, tag);
  if (hh >= 3) return spruchVon(SPRUCH.voll, tag);
  if (hh === 2) return spruchVon(SPRUCH.mitte, tag);
  if (hh === 1) return spruchVon(SPRUCH.start, tag);
  // Noch nichts heute: abwechselnd der Stufensatz und ein Wartesatz, damit die
  // Stufe nicht untergeht, der Text aber auch nicht jeden Morgen gleich ist.
  return tag % 2 === 0 ? STUFEN[stufe].satz : spruchVon(SPRUCH.ruhig, tag);
}
export const stufeVon = (herzen) => { let i = 0; STUFEN.forEach((s, k) => { if (herzen >= s.ab) i = k; }); return i; };

/* ---------- Die Sperrklinke: einmal erreicht, bleibt erreicht ----------
   herzenStand() rechnet die GANZE Historie mit dem HEUTIGEN Tagesziel, und das
   schwankt taeglich (Zielband 60-100). Gemessen an Roses echtem Stand am 12.08.:
   bei Ziel 60/80/100 kommen 30/27/25 Herzen heraus — fuenf Herzen Unterschied
   allein durch die Planaenderung, ohne dass sie irgendetwas anders gemacht hat.

   Solange die Stufen 20 Herzen auseinander lagen, fiel das nicht auf. Je enger
   die Leiter wird, desto sicherer ueberspringt so ein Rutsch eine Grenze — und
   dann ist das Tier am naechsten Tag wieder ein Ei. Eine Zahl, die sinkt, ist
   aergerlich; ein Tier, das ent-schluepft, ist ein Wortbruch.

   Darum merkt sich mk.stufeMax die hoechste je erreichte Stufe. Sie wird nur
   groesser, synct mit (core.js: snapshot, signatur UND eine eigene Max-Regel im
   Merge) und gilt geraeteuebergreifend — auch weil settings.tzPlan geraetelokal
   ist und zwei Geraete am selben Tag verschiedene Herzenzahlen ausrechnen. */
export function stufeJetzt(herzen) {
  const mk = C.state().mk || (C.state().mk = {});
  const stufe = Math.min(Math.max(stufeVon(herzen), mk.stufeMax || 0), STUFEN.length - 1);
  // save() schreibt NUR nach localStorage — der Push haengt an syncLernstand(),
  // und das laeuft sonst erst beim naechsten Anlass (Sitzung, Tabwechsel, Neustart).
  // Eine neu erreichte Stufe soll aber sofort auf dem anderen Geraet stehen, so wie
  // die zuletzt geuebten Sachen auch. syncBald buendelt das mit einer halben
  // Sekunde Verzoegerung, damit nicht jede Neuzeichnung einen Request ausloest.
  if (stufe > (mk.stufeMax || 0)) { mk.stufeMax = stufe; C.save(); C.syncBald(500); }
  return stufe;
}

/* ---------- Das Ei, Blockgrafik ----------
   Volle Flaeche statt Umriss: ein Ei ist ein Gegenstand, da traegt die
   Fuellung. Die Musterung ist keine andere Zeichenart, sondern nur eine zweite
   Farbe auf denselben Bloecken — dadurch kann nichts verrutschen. */
const EI_FORM = [
  "   ▄▄▄▄▄   ",
  "  ▟█████▙  ",
  " ▐███████▌ ",
  " ▐███████▌ ",
  " ▝███████▘ ",
  "   ▀▀▀▀▀   ",
];
const VOLL = "█▟▙▐▌▝▘▄▀";

/* Die drei Eier dieses Trainers. Im GE-Trainer liegen DREI ANDERE — zusammen
   sind es sechs individuelle, keins doppelt.
   Jedes hat eigene Farben, ein eigenes Muster und einen
   Hinweis, der Temperament andeutet und nichts verraet. Musterung laeuft ueber
   eine zweite Farbe auf denselben Bloecken; die Sonderzeichen (Herz, Stern,
   Ring) sitzen als eigene Marken obendrauf. */
export const EIER = [
  { key: "herzchen", name: "Herzchen", fell: "#cf8fa0", muster: "#a4677a", akzent: "#f6e3ea",
    regel: () => false, marken: [[2, 3, "♥"], [3, 7, "♥"], [4, 5, "♥"]],
    teaser: "Es ist leicht warm und klopft. Ganz leise, aber regelmäßig." },
  { key: "sternchen", name: "Sternchen", fell: "#ceae5e", muster: "#9c8240", akzent: "#fdf3d4",
    regel: (z, sp) => (z + sp) % 5 === 0, marken: [[2, 6, "✦"], [4, 3, "✦"]],
    teaser: "Kühl wie ein Kieselstein, aber im Dunkeln sieht man es trotzdem." },
  { key: "gestreift", name: "Gestreift", fell: "#c3b596", muster: "#8b7f66",
    regel: (z, sp) => sp % 3 === 1,
    teaser: "Warm. Und es hat sich schon zweimal gedreht, als du weggeschaut hast." },
];
/* Die Ei-Keys sind seit der ersten Fassung umbenannt worden:
     1. streifen · tupfen · zickzack
     2. gestreift · herzchen · sternchen · gesprenkelt · gewellt · marmoriert
     3. herzchen · sternchen · gestreift   (heute)
   Wer in der ersten Runde ausgesucht hat, haette danach eine tote Wahl im
   Stand: die Ankunft kaeme neu, obwohl laengst gewaehlt wurde. Im GE-Trainer
   ist genau das passiert.

   Zuordnung auf das jeweils naechstliegende heutige Ei. Wem das nicht
   gefaellt, wechselt ueber "anderes Ei aussuchen".

   LEHRE: einen gespeicherten Schluessel umzubenennen entwertet still jede
   bereits getroffene Wahl. Wenn es sein muss, gehoert die Zuordnung im
   selben Commit dazu. */
const ALT_KEYS = {
  streifen: "gestreift", gewellt: "gestreift", marmoriert: "gestreift",
  tupfen: "herzchen",
  zickzack: "sternchen", gesprenkelt: "sternchen",
};
(function migriereAltenEiKey() {
  const k = C.state().mk?.ei;
  if (!k || EIER.some((e) => e.key === k)) return; // leer oder gueltig
  const neu = ALT_KEYS[k];
  if (!neu) return; // unbekannt: lieber die Ankunft neu zeigen als raten
  C.state().mk.ei = neu;
  C.save();
})();

export const eiIndex = () => {
  const k = C.state().mk?.ei;
  const i = EIER.findIndex((e) => e.key === k);
  return i < 0 ? 0 : i;
};

function eiEbenen(variante, stufe) {
  const zeilen = EI_FORM.slice();
  const maske = EI_FORM.map((zeile, z) =>
    zeile.split("").map((ch, sp) => (VOLL.indexOf(ch) < 0 ? " " : variante.regel(z, sp) ? "M" : "F")).join(""));
  const setz = (z, sp, text, m) => {
    const a = zeilen[z].split(""), b = maske[z].split("");
    for (let i = 0; i < text.length; i++) { a[sp + i] = text[i]; b[sp + i] = m; }
    zeilen[z] = a.join(""); maske[z] = b.join("");
  };
  (variante.marken || []).forEach((m) => setz(m[0], m[1], m[2], "A"));
  if (stufe >= 1) setz(2, 5, "╷", "R");
  if (stufe >= 2) { setz(2, 4, "╲╱", "R"); setz(3, 5, "╱", "R"); }
  return { zeilen, maske };
}
export function eiHtml(variante, stufe) {
  const FARBE = { F: variante.fell, M: variante.muster, A: variante.akzent || variante.muster, R: "var(--mk-riss)" };
  const { zeilen, maske } = eiEbenen(variante, stufe);
  return zeilen.map((zeile, i) => {
    let out = "", puffer = "", k = null;
    const spuelen = () => {
      if (!puffer) return;
      // Marken (Herz, Stern) brauchen die Eifarbe als Zellhintergrund, sonst
      // scheint die Seite durch und es sieht aus wie ein Loch im Ei.
      const stil = k === "A" ? `color:${FARBE.A};background:${FARBE.F}` : `color:${FARBE[k]}`;
      out += k === " " ? puffer : `<span style="${stil}">${puffer}</span>`;
      puffer = "";
    };
    for (let j = 0; j < zeile.length; j++) {
      const kk = maske[i][j] || " ";
      if (kk !== k) { spuelen(); k = kk; }
      puffer += zeile[j];
    }
    spuelen();
    return out;
  }).join("\n");
}

/* ---------- Das Tier, ab Stufe 3 ----------
   Uebernommen aus der Werkstatt (playground/rose/maskottchen/figuren.js), damit
   Entwurf und App dieselbe Figur zeigen. Dort ist ST die Katze und GE der Hund.

   BEWUSSTER STILBRUCH: das Ei ist aus Halbbloecken gebaut (█▟▙), das Tier aus
   Strichzeichen (╭─╮│). Nebeneinander waere das ein Fehler — nacheinander ist es
   die Verwandlung. Das Schluepfen ist genau der Moment, an dem ein Stilwechsel
   erzaehlt wird statt auffaellt: die Schale bricht, und was herauskommt, ist
   anders gezeichnet, weil es etwas anderes ist. Darum darf die Leiter auch nie
   ohne die Figuren live gehen.

   Gefaerbt wird wie beim Ei ueber eine Maske: Umriss und Ohren in der Fellfarbe,
   Augen und Maul in der Musterfarbe. Zwei Farben, dieselben zwei wie am Ei —
   so bleibt das Tier erkennbar dasselbe Wesen wie das Ei davor. */
const GESICHT = "◉◡▬ᵕᗢ‿▼✦"; // alles, was Musterfarbe bekommt

function blobZeilen(sub, auge, maul) {
  const ohren = sub >= 2 ? "   ▲     ▲   " : "             ";
  return [
    ohren,
    "  ╭───────╮  ",
    "  │       │  ",
    "  │ " + (sub >= 1 ? auge : "◦") + "   " + (sub >= 1 ? auge : "◦") + " │  ",
    "  │   " + maul + "   │  ",
    "  ╰───────╯  ",
  ];
}

function katzeZeilen(jung, auge, maul) {
  if (jung) return [
    "   ▲     ▲   ",
    "  ╭───────╮  ",
    "  │  \\ /  │  ",
    "  │ " + auge + "   " + auge + " │  ",
    "  │   ▼   │  ",
    "  │  ╰" + maul + "╯  │  ",
    "  ╰───────╯  ",
  ];
  return [
    "   ▲         ▲   ",
    "  ╭───────────╮  ",
    "  │  \\  |  /  │  ",
    "  │           │  ",
    "  │ " + auge + "       " + auge + " │  ",
    "  │╴    ▼    ╴│  ",
    "  │   ╰─" + maul + "─╯   │  ",
    "  ╰───────────╯  ",
    "    ╵       ╵    ",
  ];
}

/* Nachts schlaeft es, wie das Ei nachts leise ist. Sonst dieselbe Logik wie in
   der Werkstatt: offene Augen, freundliches Maul. */
export function figurHtml(variante, stufe, nacht) {
  const st = STUFEN[stufe];
  const auge = nacht ? "▬" : "◉";
  const maul = nacht ? "‿" : "ᵕ";
  const zeilen = st.art === "blob" ? blobZeilen(st.sub, auge, maul)
    : katzeZeilen(st.art === "jung", auge, maul);
  const FELL = variante.fell, MUSTER = variante.muster;
  return zeilen.map((zeile) => {
    let out = "", puffer = "", k = null;
    const spuelen = () => {
      if (!puffer) return;
      out += k === " " ? puffer : `<span style="color:${k === "G" ? MUSTER : FELL}">${puffer}</span>`;
      puffer = "";
    };
    for (const ch of zeile) {
      const kk = ch === " " ? " " : GESICHT.indexOf(ch) >= 0 ? "G" : "F";
      if (kk !== k) { spuelen(); k = kk; }
      puffer += ch;
    }
    spuelen();
    return out;
  }).join("\n");
}

/* Das Bild zur Stufe — Ei oder Tier, eine Entscheidung an einer Stelle. */
export const bildHtml = (variante, stufe, nacht) =>
  stufe < SCHLUEPF_STUFE ? eiHtml(variante, stufe) : figurHtml(variante, stufe, nacht);

/* ---------- Zustand des Ankunfts-Ablaufs ----------
   Einzige Wahrheit ist, OB ein Ei gewaehlt wurde. Solange keins gewaehlt ist,
   kommt die Ankunft bei jedem Oeffnen wieder — wer nicht aussucht, verliert den
   Moment nicht. Der Schritt "schon nachgesehen" haelt nur bis zum Neuladen,
   damit es nicht bei der Karte haengen bleibt. */
/* Nicht nur "steht da was", sondern "steht da ein Ei, das es noch gibt".
   Sonst zaehlt ein Key aus einer frueheren Fassung als getroffene Wahl: die
   Ankunft wird uebersprungen und eiIndex() faellt still auf Ei 0 zurueck —
   die Ankunft ist dann weg, ohne dass je jemand ausgesucht hat. */
const gewaehlt = () => {
  const k = C.state().mk?.ei;
  return !!k && EIER.some((e) => e.key === k);
};
let angesehen = false;
export function zuruecksetzen() { C.state().mk = {}; C.save(); angesehen = false; }
/* Nur den Schluepf-Moment zurueckgeben, ohne die Ei-Wahl und die Stufe
   mitzunehmen. zuruecksetzen() leert mk KOMPLETT — wer damit einen Testfehler
   reparieren will, loescht Roses ausgesuchtes Ei gleich mit. */
export function momentZurueck() {
  const mk = C.state().mk || {};
  delete mk.geschluepft;
  C.save();
  schluepfPhase = null;
}

/* Welches Ei die Auswahl gerade zeigt (nur waehrend der Auswahl). */
let blaetterIdx = 0;

/* ---------- Ansichten ---------- */
/* ---------- Der Storch ----------
   Bewusst KEINE Textgrafik, anders als das Ei. Blockzeichen wie ▟ ▙ sind
   zellgenau und darum unkritisch, aber der Storch braucht duenne Teile
   (Hals, Beine, Schnur) und die gab es nur mit ◉ ╱ ╲ — genau die Zeichen,
   die auf Android gern in einen Ersatzfont fallen und dann die Zeile
   verschieben. Deshalb dasselbe Zellraster, aber als SVG-Rechtecke gemalt:
   sieht aus wie Blockgrafik, passt zum Ei, rendert aber ueberall gleich
   und skaliert mit.

   Legende:  # Koerper   s Schnabel   a Auge
             l Bein      t Buendel    | Schnur      . nichts

   Das Auge war zuerst nur eine Luecke im Kopf, damit der Kartengrund
   durchscheint. Das traegt aber nur im Nachtmodus: im hellen Modus ist der
   Grund heller als das Gefieder, und das Auge verschwand fast. Es bekommt
   darum die Musterfarbe, die in beiden Modi dunkler ist als das Fell. */
const STORCH = [
  "............#####..........",
  "...........#######.........",
  "..sssssssss##a#####........",
  "...........#######.........",
  "............#####..........",
  "....|........###...........",
  "....|........###...........",
  "...ttttt.....###...........",
  "..ttttttt....###...........",
  "..ttttttt....###...........",
  "..ttttttt....###...........",
  "...ttttt..#########........",
  "........#############......",
  ".......###############.....",
  "......#################....",
  ".......###############.....",
  "........#############......",
  "..........#########........",
  "...........ll...ll.........",
  "...........ll...ll.........",
  "...........ll...ll.........",
  "..........llll.llll........",
];
const STORCH_FARBE = { "#": "var(--mk-fell)", s: "var(--mk-riss)", l: "var(--mk-riss)",
  t: "var(--mk-muster)", "|": "var(--mk-muster)", a: "var(--mk-muster)" };

/* Zellen einer Zeile, die gleich sind, werden zu EINEM Rechteck zusammengefasst
   (Lauflaenge) — sonst stehen ~300 rects im DOM statt ~40. */
export function storchHtml() {
  const Z = 10;
  const breite = Math.max(...STORCH.map((z) => z.length));
  let teile = "";
  STORCH.forEach((zeile, y) => {
    let x = 0;
    while (x < zeile.length) {
      const c = zeile[x];
      if (!STORCH_FARBE[c]) { x++; continue; } // "." und "a" bleiben Luecke
      let n = 1;
      while (x + n < zeile.length && zeile[x + n] === c) n++;
      teile += `<rect x="${x * Z}" y="${y * Z}" width="${n * Z}" height="${Z}" fill="${STORCH_FARBE[c]}"/>`;
      x += n;
    }
  });
  return `<svg viewBox="0 0 ${breite * Z} ${STORCH.length * Z}" width="${breite * Z}" height="${STORCH.length * Z}" aria-hidden="true" focusable="false">${teile}</svg>`;
}

function ankunftHtml() {
  return `<div class="mk-ankunft">
    <div class="mk-storch${REDUCE_MOTION ? "" : " mk-schwebt"}" aria-hidden="true">${storchHtml()}</div>
    <div class="mk-ank-kopf">Etwas ist angekommen.</div>
    <p class="mk-ank-text">Da war jemand am Nest, während du geübt hast. Es liegen drei da — eins davon darf bei dir bleiben.</p>
    <button class="btn small" data-mk-ankunft="gesehen">Nachsehen</button>
  </div>`;
}

function auswahlHtml() {
  const v = EIER[blaetterIdx];
  const punkte = EIER.map((e, i) => `<span class="${i === blaetterIdx ? "an" : ""}">●</span>`).join("");
  return `<div class="mk-ankunft">
    <div class="mk-ank-kopf">Welches nimmst du mit?</div>
    <div class="mk-karussell" data-mk-swipe>
      <button class="mk-pfeil" data-mk-nav="-1" aria-label="Vorheriges Ei">‹</button>
      <pre class="mk-ei gross${REDUCE_MOTION ? "" : " mk-schwebt"}" aria-hidden="true">${eiHtml(v, 0)}</pre>
      <button class="mk-pfeil" data-mk-nav="1" aria-label="Nächstes Ei">›</button>
    </div>
    <div class="mk-punkte">${punkte}</div>
    <p class="mk-teaser">${v.teaser}</p>
    <button class="btn small" data-mk-nimm="${v.key}">Das nehme ich</button>
  </div>`;
}

/* ---------- Die Herzen als Meilensteine unter der Tagesziel-Bar ----------
   Bisher stand nur in der Blase, wie viele Herzen heute dazukamen — man sah
   nicht, WO die naechste Schwelle liegt. Als Marken unter der Leiste ist beides
   auf einen Blick da: was schon zaehlt (voll) und was als naechstes kommt (blass).

   Die drei Herzen sitzen auf denselben Schwellen wie herzenHeute(): Anfangen,
   Minimum, Tagespensum. Der Stern am Ende ist das Streckziel — dieselbe Regel
   wie in herzenStand(). Die Bar laeuft von 0 bis Streckziel, darum liegt der
   Stern immer bei 100 %.

   Erste und letzte Marke werden nicht zentriert, sonst haengen sie halb ueber
   dem Rand der Karte. */
export function markenHtml(tz, minP, zielP) {
  if (!tz) return "";
  const n = tz.n || 0;
  const marke = (pos, zeichen, erreicht, titel, klasse) =>
    `<span class="tz-marke${erreicht ? " an" : ""}${klasse ? " " + klasse : ""}" style="left:${pos}%" title="${titel}">${zeichen}</span>`;
  return `<div class="tz-marken" aria-hidden="true">
    ${marke(0, "♥", n > 0, "fürs Anfangen", "erste")}
    ${marke(minP, "♥", n >= tz.minimum, `Minimum: ${tz.minimum}`)}
    ${marke(zielP, "♥", n >= tz.ziel, `Tagespensum: ${tz.ziel}`)}
    ${marke(100, "✦", n >= tz.stretch, `Streckziel: ${tz.stretch}`, "stern letzte")}
  </div>`;
}

/* Alles, was die Blase SAGT, an einer Stelle — und zwar genau der Fassung, die
   die App zeigt. Die Testseite (playground/rose/maskottchen/viewer/) ruft
   dieselbe Funktion mit gedrehten Werten auf; damit kann die Vorschau nicht von
   der App wegdriften, was bei einer nachgebauten Kopie sicher passiert waere.
   Reine Funktion: kein Zugriff auf state, Uhr oder Historie. */
export function blaseText({ herzen, sterne, tage, stunde, hh, stufeMax }) {
  // stufeMax ist die Sperrklinke (siehe stufeJetzt): die Stufe faellt nie unter
  // das schon Erreichte zurueck, auch wenn die Herzenzahl sinkt. Geklemmt, damit
  // ein gespeicherter Wert aus einer laengeren Leiter hier nicht ins Leere greift.
  const stufe = Math.min(Math.max(stufeVon(herzen), stufeMax || 0), STUFEN.length - 1);
  const naechste = STUFEN[stufe + 1];
  const nacht = stunde >= 22 || stunde < 6;
  return {
    stufe, nacht,
    gruss: grussVon(stunde),
    satz: satzVon(stufe, hh, nacht),
    meta: `<b>${herzen}</b> ♥${sterne ? ` · <b>${sterne}</b> ★` : ""} aus ${tage} Übungstagen — ` +
      // Auf der letzten Stufe gibt es kein "bis es weitergeht" mehr. Frueher stand
      // hier "gleich passiert was" — das war als Platzhalter gedacht und wurde nie
      // erreicht, weil die Leiter nur drei Stufen hatte. Jetzt wird sie erreicht.
      (naechste ? `noch <b>${Math.max(0, naechste.ab - herzen)}</b> ♥ bis es weitergeht` : "ausgewachsen") + "." +
      // Was heute schon dazukam. Nachts bleibt das weg — kein Abend-Mahnmal.
      (nacht ? ""
        : hh === 0 ? " Heute noch keins — das erste kommt mit der ersten Karte."
        : ` Heute schon <b>${hh}</b> ♥ dazu${hh < 3 ? ", da geht noch was." : " — mehr geht an einem Tag nicht."}`),
  };
}

/* Wechseln geht nur, SOLANGE das Ei noch nichts gesammelt hat (Jennifer 12.08.).
   Direkt nach der Auswahl darf man sich noch umentscheiden — sobald das erste
   Herz da ist, gehoert das Ei dazu und bleibt. Sonst waere die Wahl beliebig,
   und ein Begleiter, den man jederzeit austauschen kann, ist keiner.
   Der Knopf verschwindet dann einfach; ein ausgegrauter Knopf mit Erklaerung
   waere ein Hinweis auf etwas, das man ohnehin nicht mehr will. */
const wechselHtml = (herzen) => herzen > 0 ? "" :
  `<div class="mk-wechsel"><button class="mk-link" data-mk-ankunft="wechseln">anderes Ei aussuchen</button></div>`;

/* ---------- Das Schluepfen als Moment ----------
   Kein stiller Bildwechsel. Jennifer am 12.08. woertlich: "wenn es schluepft
   soll da eine nachricht sein: oh etwas passiert. und dann der button,
   nachschauen. und dann schluepft es, mit einer animation."

   Also dieselbe Dramaturgie wie bei der Ankunft — die ist die Vorlage, nicht
   nur das Vorbild: gleiche .mk-ank-*-Bauteile, gleiche Abfolge Nachricht →
   Knopf → das Eigentliche.

   GENAU EINMAL, ABER GARANTIERT (Jennifer, 12.08.). Daraus folgen zwei Dinge,
   die man leicht andersherum baut:

   1. Der Haken liegt im GESYNCTEN Stand (mk.geschluepft), nicht in localStorage.
      Sonst sieht Rose den Moment auf Handy und Tablet je einmal. Er muss
      deshalb auch in signatur() stehen — er aendert sich beim Knopfdruck, und
      ein Knopfdruck bringt keine neue Antwort mit, an der er huckepack reisen
      koennte. Nur im Snapshot hiesse: wird nie gepusht, und das Tablet zeigt
      den Moment ein zweites Mal.
   2. Gesetzt wird er ERST, wenn die Animation durch ist — nicht schon, wenn die
      Nachricht erscheint. Sonst reicht es, die App in der Bahn zu oeffnen und
      wieder wegzustecken, und der Moment ist verbraucht, ohne dass sie ihn
      hatte.

   Der Fehler, den wir bewusst in Kauf nehmen, ist der harmlose: faellt der Push
   aus (offline), sieht sie es auf dem zweiten Geraet nochmal. Zweimal feiern
   ist harmlos, gar nicht feiern ist unwiederbringlich. */
const geschluepft = () => !!C.state().mk?.geschluepft;
/* Reiner Ansichts-Zustand, wie `angesehen`: liegt im Modul und synct nie. */
let schluepfPhase = null; // null | "bricht"

const MOMENT_MS = 2200;

function schluepfHtml() {
  return `<div class="mk-ankunft">
    <div class="mk-ank-kopf">Oh, etwas passiert.</div>
    <p class="mk-ank-text">Es hat sich bewegt, und diesmal nicht nur ein bisschen.</p>
    <button class="btn small" data-mk-schluepf="los">Nachschauen</button>
  </div>`;
}

/* Zwei Ebenen uebereinander: die Schale bricht und verschwindet, das Tier
   kommt darunter hervor. Beides im selben Kasten, damit nichts springt. */
function bruchHtml(v) {
  return `<div class="mk-ankunft">
    <div class="mk-buehne">
      <pre class="mk-ei mk-schale" aria-hidden="true">${eiHtml(v, 2)}</pre>
      <pre class="mk-ei mk-frisch" aria-hidden="true">${figurHtml(v, SCHLUEPF_STUFE, false)}</pre>
    </div>
  </div>`;
}

/* Die Stufe, die JETZT gilt — inklusive Sperrklinke. Eigene Funktion, weil
   html() und standHtml() sie beide brauchen und zwei Rechnungen zwei Wahrheiten
   waeren (dieselbe Falle wie bei Bild und Text am 12.08.). */
function aktuelleStufe(tz) {
  return stufeJetzt(herzenStand(tz).herzen);
}

function standHtml(tz) {
  const st = herzenStand(tz);
  // stufeJetzt() zieht die Sperrklinke nach; blaseText() bekommt sie herein und
  // rechnet nicht selbst. Sonst haette die Blase eine andere Stufe als das Bild.
  const t = blaseText({ herzen: st.herzen, sterne: st.sterne, tage: st.tage,
    stunde: new Date().getHours(), hh: herzenHeute(tz), stufeMax: stufeJetzt(st.herzen) });
  const stufe = t.stufe;
  const v = EIER[eiIndex()];
  // Das Wackeln gehoert zum Riss kurz vor dem Schluepfen. Danach atmet das Tier
  // nur noch — ein geschluepftes Tier, das weiter zappelt, sieht aus, als waere
  // es noch nicht fertig.
  const anim = REDUCE_MOTION ? ""
    : stufe === 0 ? " mk-schwebt" : stufe === 2 ? " mk-wackelt" : " mk-atmet";
  return `<div class="mk-zeile">
    <pre class="mk-ei${anim}" aria-hidden="true">${bildHtml(v, stufe, t.nacht)}</pre>
    <div class="mk-text">
      <p class="mk-satz"><b>${t.gruss}.</b> ${t.satz}</p>
      <p class="mk-meta">${t.meta}</p>
      <!-- Der Wechsel-Knopf stand frueher am Ende des Fliesstexts hinter einem
           Mittelpunkt und war praktisch unauffindbar. Eigene Zeile — auffindbar,
           aber weiter dezent: das Aussuchen soll ein Moment bleiben, kein Menue. -->
      ${wechselHtml(st.herzen)}
    </div>
  </div>`;
}

/* Reihenfolge wichtig: "schaut gerade die Auswahl an" schlaegt "hat schon eins".
   Frueher wurde beim Wechseln die gespeicherte Wahl auf null gesetzt, damit die
   Auswahl erscheint. Seit die Wahl synct, ist das gefaehrlich: laeuft dazwischen
   ein Sync, holt der Merge das alte Ei zurueck und wirft einen aus der Auswahl.
   Jetzt bleibt der gespeicherte Wert stehen; nur "Das nehme ich" ueberschreibt
   ihn. Nebeneffekt, der ohnehin besser ist: bricht man ab, behaelt man sein Ei. */
export function html(tz) {
  if (angesehen) return auswahlHtml();
  if (!gewaehlt()) return ankunftHtml();
  // Laeuft die Animation, schlaegt sie alles andere — sonst reisst ein Neuzeichnen
  // (Sync-Antwort, Tabwechsel) sie mittendrin weg.
  if (schluepfPhase === "bricht") return bruchHtml(EIER[eiIndex()]);
  if (!geschluepft() && aktuelleStufe(tz) >= SCHLUEPF_STUFE) return schluepfHtml();
  return standHtml(tz);
}

/* Der Abschluss des Moments an EINER Stelle: Haken setzen, sofort hochschieben,
   neu zeichnen, dann feiern. Reihenfolge ist Absicht — das Konfetti soll ueber
   dem geschluepften Tier liegen, nicht ueber der Animation. */
function schluepfFertig(neuZeichnen, feiern) {
  schluepfPhase = null;
  C.state().mk = { ...(C.state().mk || {}), geschluepft: Date.now() };
  C.save();
  C.syncBald(500);
  neuZeichnen();
  if (typeof feiern === "function") feiern();
}

/* ---------- Klicks und Wischen ---------- */
/* feiern() reicht main.js herein (Konfetti). Als Parameter statt Import, weil
   main.js dieses Modul schon importiert und ein Rueckimport ein Kreis waere. */
export function binde(wurzel, neuZeichnen, feiern) {
  wurzel.querySelectorAll("[data-mk-schluepf]").forEach((b) => b.onclick = () => {
    // Wer Bewegung abgestellt hat, bekommt den Moment trotzdem — nur ohne die
    // Animation. Der Knopf fuehrt dann direkt zum fertigen Tier.
    if (REDUCE_MOTION) { schluepfFertig(neuZeichnen, feiern); return; }
    schluepfPhase = "bricht";
    neuZeichnen();
    setTimeout(() => schluepfFertig(neuZeichnen, feiern), MOMENT_MS);
  });
  wurzel.querySelectorAll("[data-mk-ankunft]").forEach((b) => b.onclick = () => {
    blaetterIdx = eiIndex();
    angesehen = true; // reiner Ansichts-Zustand, liegt im Modul und synct nie
    neuZeichnen();
  });
  wurzel.querySelectorAll("[data-mk-nav]").forEach((b) => b.onclick = () => {
    blaetterIdx = (blaetterIdx + +b.dataset.mkNav + EIER.length) % EIER.length;
    neuZeichnen();
  });
  wurzel.querySelectorAll("[data-mk-nimm]").forEach((b) => b.onclick = () => {
    // ts stempelt die Wahl: beim Merge gewinnt die zuletzt getroffene.
    C.state().mk = { ...(C.state().mk || {}), ei: b.dataset.mkNimm, ts: Date.now() };
    C.save();
    // Sofort hochschieben statt auf den naechsten Sync-Anlass zu warten: die Wahl
    // ist ein Moment, und auf dem zweiten Geraet soll dann nicht das alte Ei liegen.
    C.syncBald(500);
    angesehen = false;
    neuZeichnen();
  });
  // Wischen am Handy: Rose übt mobil, Pfeile allein wären zu klein
  wurzel.querySelectorAll("[data-mk-swipe]").forEach((box) => {
    let x0 = null;
    box.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener("touchend", (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) < 30) return;
      blaetterIdx = (blaetterIdx + (dx < 0 ? 1 : -1) + EIER.length) % EIER.length;
      neuZeichnen();
    }, { passive: true });
  });
}
