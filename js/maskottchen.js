/* Maskottchen — Stufe 1: das Ei.
   Sitzt oben in der Tagesziel-Karte. Es sammelt Herzen aus dem, was Rose
   ohnehin schon uebt, und kommt dem Schluepfen naeher. Was drin ist, sagt es
   nicht — das ist der Punkt.

   Waehrung sind HERZEN, nicht richtige Antworten: pro Uebungstag eins fuers
   Anfangen, eins fuers Minimum, eins fuers Tagespensum. Das belohnt
   Auftauchen statt Koennen — ein zaeher Tag mit drei Karten zahlt trotzdem.
   Das Streckziel gibt stattdessen einen Stern.

   Die Historie wird rueckwirkend gerechnet: Rose faengt nicht bei null an,
   sondern bekommt gutgeschrieben, was sie seit Juli geleistet hat. Alles
   andere waere eine Bestrafung fuers Frueh-Anfangen.

   Entwurf und Varianten: playground/rose/maskottchen/ */
import * as C from "./core.js";

const REDUCE_MOTION = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Herzen aus der echten Uebungshistorie ----------
   Fuer vergangene Tage ist der damalige Tagesplan nicht gespeichert; wir
   rechnen sie mit den heutigen Schwellen. Das ist grosszuegig gerundet und
   bewusst so: lieber ein Herz zu viel als eines zu wenig. */
export function herzenStand(tz) {
  const min = tz && tz.minimum ? tz.minimum : 15;
  const ziel = tz && tz.ziel ? tz.ziel : 35;
  const stretch = tz && tz.stretch ? tz.stretch : 55;
  const akt = C.aktivitaetProTag();
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

/* ---------- Die Stufen des Eis ----------
   Bewusst weit gesteckt: mit der rueckwirkenden Gutschrift steht Rose schon
   im dritten Bild, und das Schluepfen ist das naechste, was kommt. */
const STUFEN = [
  { ab: 0,  name: "liegt da",      satz: "Da liegt ein Ei im Nest. Keine Ahnung, wo das herkommt." },
  { ab: 20, name: "rührt sich",    satz: "Das Ei hat sich bewegt. Nur ein bisschen, aber es hat." },
  { ab: 45, name: "es knackt",     satz: "Es knackt. Da will jemand raus — bald ist es so weit." },
];
export const stufeVon = (herzen) => { let i = 0; STUFEN.forEach((s, k) => { if (herzen >= s.ab) i = k; }); return i; };

/* ---------- Das Ei ----------
   Strichzeichnung: nur der Umriss, innen die Zeichnung des Katzen-Eis
   (senkrechte Striche wie das Streifenfell, das spaeter daraus wird). */
const EI = [
  "   ╭───╮   ",
  "  ╭╯   ╰╮  ",
  "  │ | | │  ",
  "  │ | | │  ",
  "  ╰─────╯  ",
];
function eiZeilen(stufe) {
  const z = EI.slice();
  const setz = (zeile, spalte, text) => {
    const a = z[zeile].split("");
    for (let i = 0; i < text.length; i++) a[spalte + i] = text[i];
    z[zeile] = a.join("");
  };
  if (stufe >= 1) setz(2, 5, "╷");
  if (stufe >= 2) { setz(2, 4, "╲╱"); setz(3, 5, "╱"); }
  return z;
}

/* Farbe haengt am einzelnen Zeichen: Umriss in Fellfarbe, die Zeichnung
   innen dunkler, der Riss hell — so bleibt es lesbar in beiden Themes. */
const FARBE = { rand: "var(--mk-rand)", innen: "var(--mk-innen)", riss: "var(--mk-riss)" };
const rolle = (ch) => ("╲╱╷".indexOf(ch) >= 0 ? "riss" : "|".indexOf(ch) >= 0 ? "innen" : "rand");

function eiHtml(stufe) {
  return eiZeilen(stufe).map((zeile) => {
    let out = "", puffer = "", r = null;
    const spuelen = () => {
      if (!puffer) return;
      out += r === "leer" ? puffer : `<span style="color:${FARBE[r]}">${puffer}</span>`;
      puffer = "";
    };
    for (const ch of zeile) {
      const rr = ch === " " ? "leer" : rolle(ch);
      if (rr !== r) { spuelen(); r = rr; }
      puffer += ch;
    }
    spuelen();
    return out;
  }).join("\n");
}

/* ---------- Die Karte ----------
   Wird oben in die Tagesziel-Karte gehaengt. Nachts sagt das Ei nichts ueber
   offene Karten — kein Mahnmal am Abend. */
export function html(tz) {
  const st = herzenStand(tz);
  const stufe = stufeVon(st.herzen);
  const naechste = STUFEN[stufe + 1];
  const stunde = new Date().getHours();
  const nacht = stunde >= 22 || stunde < 6;
  const satz = nacht
    ? "Das Ei ist still. Morgen früh sind wir wieder da."
    : STUFEN[stufe].satz;
  const rest = naechste
    ? `noch ${naechste.ab - st.herzen} ♥ bis es weitergeht`
    : "gleich passiert was";
  const sterne = st.sterne ? ` · <b>${st.sterne}</b> ★` : "";
  return `<div class="mk-zeile">
    <pre class="mk-ei${REDUCE_MOTION || stufe === 0 ? "" : stufe === 1 ? " mk-atmet" : " mk-wackelt"}" aria-hidden="true">${eiHtml(stufe)}</pre>
    <div class="mk-text">
      <p class="mk-satz">${satz}</p>
      <p class="mk-meta"><b>${st.herzen}</b> ♥${sterne} aus ${st.tage} Übungstagen — ${rest}</p>
    </div>
  </div>`;
}
