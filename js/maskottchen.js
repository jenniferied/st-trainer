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
   wurde (state.settings.mkEi). Solange keins gewaehlt ist, kommt sie bei jedem
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

const STUFEN = [
  { ab: 0,  satz: "Da liegt ein Ei im Nest. Keine Ahnung, wo das herkommt." },
  { ab: 20, satz: "Das Ei hat sich bewegt. Nur ein bisschen, aber es hat." },
  { ab: 45, satz: "Es knackt. Da will jemand raus — bald ist es so weit." },
];
export const stufeVon = (herzen) => { let i = 0; STUFEN.forEach((s, k) => { if (herzen >= s.ab) i = k; }); return i; };

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
export const eiIndex = () => {
  const k = C.state().settings.mkEi;
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
  const k = C.state().settings.mkEi;
  return !!k && EIER.some((e) => e.key === k);
};
let angesehen = false;
export function zuruecksetzen() { C.state().settings.mkEi = null; C.save(); angesehen = false; }

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
function storchHtml() {
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

function standHtml(tz) {
  const st = herzenStand(tz);
  const stufe = stufeVon(st.herzen);
  const naechste = STUFEN[stufe + 1];
  const stunde = new Date().getHours();
  const nacht = stunde >= 22 || stunde < 6;
  const v = EIER[eiIndex()];
  const anim = REDUCE_MOTION ? "" : stufe === 0 ? " mk-schwebt" : stufe === 1 ? " mk-atmet" : " mk-wackelt";
  const satz = nacht ? "Das Ei ist still. Morgen früh sind wir wieder da." : STUFEN[stufe].satz;
  const rest = naechste ? `noch <b>${naechste.ab - st.herzen}</b> ♥ bis es weitergeht` : "gleich passiert was";
  const sterne = st.sterne ? ` · <b>${st.sterne}</b> ★` : "";
  const hh = herzenHeute(tz);
  // Was heute schon dazukam. Nachts bleibt das weg — kein Abend-Mahnmal.
  const heute = nacht ? ""
    : hh === 0 ? " Heute noch keins — das erste kommt mit der ersten Karte."
    : ` Heute schon <b>${hh}</b> ♥ dazu${hh < 3 ? ", da geht noch was." : " — mehr geht an einem Tag nicht."}`;
  return `<div class="mk-zeile">
    <pre class="mk-ei${anim}" aria-hidden="true">${eiHtml(v, stufe)}</pre>
    <div class="mk-text">
      <p class="mk-satz"><b>${grussVon(stunde)}.</b> ${satz}</p>
      <p class="mk-meta"><b>${st.herzen}</b> ♥${sterne} aus ${st.tage} Übungstagen — ${rest}.${heute}
        · <button class="mk-link" data-mk-ankunft="wechseln">anderes Ei</button></p>
    </div>
  </div>`;
}

export function html(tz) {
  if (gewaehlt()) return standHtml(tz);
  return angesehen ? auswahlHtml() : ankunftHtml();
}

/* ---------- Klicks und Wischen ---------- */
export function binde(wurzel, neuZeichnen) {
  wurzel.querySelectorAll("[data-mk-ankunft]").forEach((b) => b.onclick = () => {
    blaetterIdx = eiIndex();
    angesehen = true;
    if (b.dataset.mkAnkunft === "wechseln") C.state().settings.mkEi = null, C.save();
    neuZeichnen();
  });
  wurzel.querySelectorAll("[data-mk-nav]").forEach((b) => b.onclick = () => {
    blaetterIdx = (blaetterIdx + +b.dataset.mkNav + EIER.length) % EIER.length;
    neuZeichnen();
  });
  wurzel.querySelectorAll("[data-mk-nimm]").forEach((b) => b.onclick = () => {
    C.state().settings.mkEi = b.dataset.mkNimm;
    C.save();
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
