/* ==========================================================================
   DER LADEN — Katalog und Zeichenarbeit, geteilt zwischen beiden Trainern
   ==========================================================================
   Verteilt per ../geteilte-styles/verteilen.sh nach app/js/geteilt-laden.js.
   NICHT die Kopie bearbeiten, immer diese Quelle.

   WARUM EIGENE DATEI und nicht unten in maskottchen.js:

   1. Diese Datei importiert NICHTS. Kein core.js, kein state, kein DOM. Sie
      bekommt Ebenen herein und gibt Ebenen zurueck. Dadurch laesst sie sich in
      Node laden und die Figuren als Text ausgeben, ohne Browser und ohne
      Roses Daten anzufassen — genau das braucht die Testseite in
      rose/maskottchen/laden.html, und genau das hat beim Bauen der Kleidung
      jeden Pixel gerettet, den man sonst erst im Browser gesehen haette.
   2. Der Katalog ist in beiden Trainern derselbe. Der Hund traegt denselben
      Hut wie die Katze; die Geometrie wird aus der Figur GERECHNET, nicht
      abgezaehlt. Zwei Kopien waeren zwei Preislisten, die einmal auseinander-
      laufen und danach still verschiedene Dinge kosten.

   Was NICHT hier liegt: das Konto (mk.kaeufe, guthaben, kaufen) — das haengt
   am Zustand und bleibt in maskottchen.js. Hier stehen nur der Katalog und
   die reine Zeichenarbeit.

   ==========================================================================
   DIE WAEHRUNGSREGEL
   ==========================================================================
   Herzen gibt es fuers Auftauchen (bis zu 3 je Uebungstag), Sterne nur fuers
   Streckziel (hoechstens 1 je Tag, oft keinen). Sterne sind damit rund fuenfmal
   seltener, und die Preise sagen das:

     nur ♥          Dinge, die man BESITZT — Pets, Kleidungsstuecke.
                    Kommen vom blossen Dranbleiben.
     nur ★          Dinge, die man AUSSIEHT — Farbtoepfe, Looks.
                    Reine Kosmetik, dafuer die seltene Waehrung.
     ♥ und ★        Die grossen Stuecke — Hintergruende, Make-up, Krone,
                    Fluegel. Sie verlangen beides: Ausdauer UND starke Tage.

   Das ist Jennifers Vorgabe vom 03.09.2026 ("some should cost stars and
   hearts and some a combination, some just stars some just hearts") und
   zugleich die einzige Aufteilung, die sich aus den Verdienstraten begruenden
   laesst statt aus Geschmack.

   ==========================================================================
   DIE PREISE — und warum sie am 03.09.2026 kraeftig gestiegen sind
   ==========================================================================
   Bis dahin kostete der GANZE Katalog 24 ♥ (fuenf Pets). Roses Stand an dem
   Tag, live aus Supabase:

     GE-Trainer   50 ♥ · 10 ★   davon 10 ♥ ausgegeben  ->  40 ♥ / 10 ★ frei
     ST-Trainer   83 ♥ · 22 ★   nichts ausgegeben      ->  83 ♥ / 22 ★ frei

   Sie haette an einem Nachmittag alles gekauft und haette danach Wechselgeld
   gehabt. Ein Laden, der in einer Sitzung leergeraeumt ist, ist keine Senke,
   sondern eine Ausgabestelle — und die Waehrung, die er tragen soll, ist
   danach wieder wertlos.

   DAS KEHRT EINE FRUEHERE ENTSCHEIDUNG UM, absichtlich und benannt: im
   GE-Trainer stand an den Pets "mit 42 ♥ auf Stufe 8 sind alle fuenf zusammen
   (24 ♥) am Tag des Aufgehens bezahlbar". Das war richtig, solange die Pets
   das einzige Regal waren — der Laden musste damals beweisen, dass er
   ueberhaupt etwas hergibt. Mit sechs Regalen ist die Begruendung weg.

   Der Katalog kostet jetzt zusammen rund 205 ♥ und 91 ★. Das ist mit Absicht
   mehr, als bis zu den Klausuren zu verdienen ist: es soll etwas uebrig
   bleiben, das man sich noch aussuchen kann.

   DIE GEGENREGEL, die dabei nicht kippen darf: "eine Auslage, die man nicht
   anfassen kann, ist genau die Bauart, die dieser Shop nicht haben soll."
   Deshalb hat JEDES Regal einen Einstieg, den Rose am Tag des Aufgehens
   bezahlen kann — 3 ♥ fuer die Schleife, 2 ★ fuer einen Farbtopf, 6 ♥ + 1 ★
   fuer die Wolken. Teuer ist die Sammlung, nicht der erste Schritt.

   WER HIER WIEDER DREHT: der billigste Posten je Regal ist das Ergebnis, die
   teuren sind die Stellschraube. Nicht umgekehrt.

   Und noch einmal, weil es die ganze Bauart traegt: Preise duerfen steigen,
   ohne dass etwas rueckwirkend teurer wird. kaufen() schreibt den Preis in
   die Kaufzeile, das Guthaben rechnet aus den ZEILEN. Roses Maus hat 4 ♥
   gekostet und kostet fuer immer 4 ♥, auch wenn sie heute 6 kostet.
   ========================================================================== */
"use strict";

/* ==========================================================================
   1. DIE SLOTS
   ==========================================================================
   Ein Slot ist ein Platz an der Figur, auf dem hoechstens EIN Stueck sitzt.
   Hut und Krone streiten sich um denselben Kopf; Schleife und Brille nicht.

   Damit loest sich die Frage, die im Entwurf der Werkstatt offen war ("alles
   gleichzeitig tragbar") in etwas auf, das man auch zeichnen kann: alles
   gleichzeitig, aber je Platz einmal. Wer Hut UND Krone will, entscheidet
   sich — und sieht es sofort, weil der eine den anderen ersetzt.

   DER BUCHSTABE ist der Schluessel in der Farbmaske. Er muss einstellig sein
   (die Maske ist ein String je Zeile, ein Zeichen je Zelle) und darf mit
   keinem Figur-Schluessel kollidieren: F Fell, M Muster, A Akzent, T Tinte.

   AUF_FELL sagt, ob der Schluessel eine MARKE auf dem Fell ist. Marken sind
   keine Blockzeichen und brauchen darum den Fellhintergrund in ihrer Zelle,
   sonst scheint die Karte durch und es sieht aus wie ein Loch in der Figur.
   Genau derselbe Sonderfall wie beim Akzent A — nur jetzt benannt statt
   dreimal abgefragt. */
var SLOTS = {
  kopf:    { zeichen: "K", name: "Kopf",     regal: "kleidung" },
  gesicht: { zeichen: "G", name: "Gesicht",  regal: "kleidung" },
  hals:    { zeichen: "C", name: "Hals",     regal: "kleidung" },
  links:   { zeichen: "S", name: "Links",    regal: "kleidung" },
  rechts:  { zeichen: "B", name: "Rechts",   regal: "kleidung" },
  ruecken: { zeichen: "R", name: "Rücken",   regal: "kleidung" },
  wange:   { zeichen: "W", name: "Wangen",   regal: "makeup", aufFell: true },
  lid:     { zeichen: "L", name: "Lider",    regal: "makeup", aufFell: true },
  mund:    { zeichen: "P", name: "Mund",     regal: "makeup", aufFell: true },
  glanz:   { zeichen: "X", name: "Glanz",    regal: "makeup", aufFell: true },
};

/* Schluessel -> Slotname, fuer den Maler. Einmal gebaut statt bei jeder Zelle
   durch das Objekt gesucht. */
var SLOT_VON_ZEICHEN = (function () {
  var m = {};
  Object.keys(SLOTS).forEach(function (s) { m[SLOTS[s].zeichen] = s; });
  return m;
})();

/* Die Schluessel, die einen Fellhintergrund brauchen (siehe oben). "A" ist
   der alte Akzent aus der Figur selbst und gehoert mit in dieselbe Menge. */
var AUF_FELL = (function () {
  var s = "A";
  Object.keys(SLOTS).forEach(function (k) { if (SLOTS[k].aufFell) s += SLOTS[k].zeichen; });
  return s;
})();

/* ==========================================================================
   2. PREISE
   ==========================================================================
   Ein Preis ist IMMER ein Objekt { herz, stern }. Fehlt eine Waehrung, ist sie
   0 — "nur Herzen" ist also kein Sonderfall, sondern stern: 0.

   Die alte Form (eine Zahl plus ein Feld waehrung) lebt in Roses gespeicherten
   Kaufzeilen weiter und wird in maskottchen.js beim Lesen umgerechnet. Neu
   geschrieben wird sie nirgends mehr. */
function preis(herz, stern) { return { herz: herz || 0, stern: stern || 0 }; }

/* Der Preis als Text, an genau einer Stelle. Knopf, aria-label und Testseite
   sollen nie verschieden schreiben, was dasselbe kostet. */
function preisText(p) {
  if (!p) return "";
  var teile = [];
  if (p.herz) teile.push(p.herz + " ♥");
  if (p.stern) teile.push(p.stern + " ★");
  return teile.length ? teile.join(" + ") : "geschenkt";
}

/* Derselbe Preis vorgelesen. "4 ♥ + 2 ★" liest ein Screenreader je nach
   Stimme als "vier" und dann gar nichts. */
function preisGesprochen(p) {
  if (!p) return "";
  var teile = [];
  if (p.herz) teile.push(p.herz + (p.herz === 1 ? " Herz" : " Herzen"));
  if (p.stern) teile.push(p.stern + (p.stern === 1 ? " Stern" : " Sterne"));
  return teile.length ? teile.join(" und ") : "nichts";
}

/* Was zum Kauf noch fehlt — null, wenn es reicht. Der Satz ist bewusst der
   einzige Ort, an dem der Laden sagt, dass etwas gerade nicht geht, und er
   sagt es als Weg ("dafuer fehlen noch") und nicht als Urteil. */
function fehltText(p, frei) {
  var dh = Math.max(0, (p.herz || 0) - (frei.herz || 0));
  var ds = Math.max(0, (p.stern || 0) - (frei.stern || 0));
  if (!dh && !ds) return null;
  return "Dafür fehlen noch " + preisText({ herz: dh, stern: ds });
}

/* Derselbe Satz vorgelesen. fehltText() schreibt "2 ♥ + 1 ★" — dieselbe Falle
   wie beim Preis: ein Screenreader liest je nach Stimme "zwei" und danach gar
   nichts. Ein aria-label, das zur Haelfte ausgeschrieben und zur Haelfte in
   Zeichen steht, ist schlechter als beide Haelften gleich. */
function fehltGesprochen(p, frei) {
  var dh = Math.max(0, (p.herz || 0) - (frei.herz || 0));
  var ds = Math.max(0, (p.stern || 0) - (frei.stern || 0));
  if (!dh && !ds) return null;
  return "Dafür fehlen noch " + preisGesprochen({ herz: dh, stern: ds }) + ".";
}

function bezahlbar(p, frei) {
  return (p.herz || 0) <= (frei.herz || 0) && (p.stern || 0) <= (frei.stern || 0);
}

/* ==========================================================================
   3. REGAL: KLEIDERSCHRANK  — Herzen, zwei Stuecke zusaetzlich Sterne
   ==========================================================================
   Neun Stuecke auf sechs Slots. Die Geometrie steht NICHT in Zahlen an den
   Stuecken, sondern wird in anziehen() aus der Figur gerechnet: sonst sitzt
   der Hut beim Hund im Schlappohr und bei der Katze in der Luft.

   `standard` ist die Farbe, in der das Stueck ohne gekauften Farbtopf kommt.
   Sie ist absichtlich gedeckt — ein Stueck soll erst mit einem Farbtopf laut
   werden, sonst haette der Farbtopf nichts zu tun. */
var KLEIDUNG = [
  { key: "schleife", name: "Schleife", slot: "links", preis: preis(3),
    standard: "#d4708f",
    hinweis: "Zwei kleine Dreiecke oben links am Kopf. Das billigste Stück im Laden — und das erste, das man sich leisten kann." },
  { key: "bluete", name: "Blüte", slot: "rechts", preis: preis(3),
    standard: "#e8a0c0",
    hinweis: "Das Gegenstück zur Schleife, damit auch die andere Seite etwas haben kann. Beide zusammen sehen absichtlich ein bisschen zu viel aus." },
  { key: "brille", name: "Brille", slot: "gesicht", preis: preis(5),
    standard: "#4a4a52",
    hinweis: "Ein Balken quer über die Augenzeile. Die Augen werden danach wieder obendrauf gesetzt — sonst wäre es eine Augenbinde." },
  { key: "schal", name: "Schal", slot: "hals", preis: preis(5),
    standard: "#c0563f",
    hinweis: "Legt sich um die ganze Unterkante. Ändert kein Zeichen, nur die Farbe — die runde Silhouette bleibt dadurch heil." },
  { key: "hut", name: "Hut", slot: "kopf", preis: preis(7),
    standard: "#6b5b8a",
    hinweis: "Sitzt auf einer eigenen Zeile über allem, auch über Ohren und Spitzen. Mit Krempe, die links und rechts übersteht." },
  { key: "kopfhoerer", name: "Kopfhörer", slot: "kopf", preis: preis(8),
    standard: "#3a6fa8",
    hinweis: "Bügel oben, zwei Muscheln an den Kopfseiten. Für die Runden, in denen Musik läuft." },
  { key: "rucksack", name: "Rucksack", slot: "ruecken", preis: preis(8),
    standard: "#7a6a4a",
    hinweis: "Zu sehen sind die Träger über den Schultern — von vorn sieht man von einem Rucksack nun einmal nicht mehr." },
  { key: "krone", name: "Krone", slot: "kopf", preis: preis(9, 2),
    standard: "#e0b040",
    hinweis: "Drei Zacken auf einer eigenen Zeile. Kostet zusätzlich Sterne, und Sterne gibt es nur fürs Streckziel — eine Krone soll man an starken Tagen verdient haben." },
  { key: "fluegel", name: "Flügel", slot: "ruecken", preis: preis(12, 4),
    standard: "#8fc7e8",
    hinweis: "Links und rechts je zwei Zellen breit. Das teuerste Kleidungsstück und das einzige, das die Figur auf beiden Seiten wachsen lässt." },
];

/* ==========================================================================
   4. REGAL: MAKE-UP  — Kombipreise, zwei Posten nur Sterne
   ==========================================================================
   Liegt auf denselben Slots wie die Kleidung, nur im Gesicht. Alles hier sind
   MARKEN auf dem Fell (siehe AUF_FELL): sie ersetzen die Zelle nicht, sie
   faerben sie oder setzen ein kleines Zeichen mit Fellhintergrund hinein.

   Warum Make-up meistens beides kostet: es ist das Sichtbarste am kleinsten
   Platz. Eine Wange ist zwei Zellen gross und faellt trotzdem sofort auf.
   Zwei Posten kosten NUR Sterne (Lidschatten, Lippenstift) — die beiden
   reinen Umfaerbungen, die keine einzige Zelle dazuzeichnen. */
var MAKEUP = [
  { key: "sommersprossen", name: "Sommersprossen", slot: "wange", preis: preis(2, 1),
    standard: "#b5714a",
    hinweis: "Vier kleine Punkte unter den Augen. Das Günstigste im Regal und das, was man am ehesten dauerhaft anlässt." },
  { key: "rouge", name: "Rouge", slot: "wange", preis: preis(3, 1),
    standard: "#e08a9a",
    hinweis: "Zwei weiche Flecken auf den Wangen. Färbt nur, setzt kein Zeichen — deshalb sieht es auch bei Nacht noch weich aus." },
  { key: "lidschatten", name: "Lidschatten", slot: "lid", preis: preis(0, 2),
    standard: "#9a6fc4",
    hinweis: "Die Zeile direkt über den Augen bekommt Farbe. Kostet nur Sterne, weil kein einziges Zeichen dazukommt." },
  { key: "wimpern", name: "Wimpern", slot: "lid", preis: preis(3, 2),
    standard: "#2a2430",
    hinweis: "Ein dünner Strich, der direkt auf den Augen aufliegt. Ersetzt den Lidschatten — beide zusammen wären ein schwarzer Balken." },
  { key: "lippenstift", name: "Lippenstift", slot: "mund", preis: preis(0, 2),
    standard: "#c8324f",
    hinweis: "Färbt das Maul. Eine einzige Zelle, und trotzdem der größte Unterschied im ganzen Gesicht." },
  { key: "glitzer", name: "Glitzer", slot: "glanz", preis: preis(4, 3),
    standard: "#ffd966", schimmert: true,
    hinweis: "Zwei Funkelzeichen neben den Augen, die leise pulsieren. Steht still, wenn im Betriebssystem weniger Bewegung eingestellt ist." },
];

/* ==========================================================================
   5. REGAL: FARBTOEPFE  — nur Sterne
   ==========================================================================
   Ein Farbtopf ist KEIN Kleidungsstueck. Er ist eine Farbe, die danach auf
   JEDES gekaufte Stueck passt, beliebig oft, kostenlos wechselbar.

   Das ist die Antwort auf Jennifers "und coloring them" und zugleich der
   Grund, warum der Kleiderschrank nicht nach dem dritten Kauf langweilig
   wird: neun Stuecke mal neun Farben sind mehr Kombinationen, als eine
   Klausurvorbereitung lang ist.

   Preise klein halten (2 bis 4 ★, Regenbogen 6): ein Farbtopf ist ein
   Nachmittagskauf, keine Anschaffung. Der Regenbogen ist der einzige, der
   nicht aus einer Farbe besteht — er nimmt den Verlauf, den auch die
   Streckziel-Leiste traegt, und ist damit das sichtbare Echo der Sterne, mit
   denen man ihn bezahlt. */
var FARBTOEPFE = [
  { key: "standard", name: "Wie geliefert", preis: preis(0), farbe: null,
    hinweis: "Die Farbe, in der das Stück im Regal liegt. Immer da, kostet nichts." },
  { key: "rosa", name: "Rosa", preis: preis(0, 2), farbe: "#e87ba8" },
  { key: "himmel", name: "Himmelblau", preis: preis(0, 2), farbe: "#5aa9e0" },
  { key: "mint", name: "Mint", preis: preis(0, 2), farbe: "#4fc4a0" },
  { key: "sonne", name: "Sonnengelb", preis: preis(0, 3), farbe: "#f0c040" },
  { key: "flieder", name: "Flieder", preis: preis(0, 3), farbe: "#a98be0" },
  { key: "gold", name: "Gold", preis: preis(0, 4), farbe: "#e0b040" },
  { key: "silber", name: "Silber", preis: preis(0, 4), farbe: "#c8ccd8" },
  { key: "regen", name: "Regenbogen", preis: preis(0, 6), farbe: "var(--laden-regen)", verlauf: true,
    hinweis: "Derselbe Verlauf wie die Leiste am Streckziel. Der einzige Topf, der keine Farbe ist, sondern sieben." },
];

/* ==========================================================================
   6. REGAL: LOOKS  — nur Sterne
   ==========================================================================
   Ein Look tauscht die vier Farben der FIGUR aus (Fell, Muster, Akzent,
   Tinte). Null Zeichenarbeit, gilt sofort fuer jede Stufe und fuer die Pets
   daneben — und ist trotzdem der groesste sichtbare Umbau im ganzen Laden.

   "Natur" ist die Palette aus dem eigenen Ei und kostet nichts. Sie ist kein
   Fuellposten: sie ist die Rueckfahrkarte. Wer einen Look kauft und ihn nicht
   mag, soll nicht das Gefuehl haben, das Tier ist jetzt so. */
var LOOKS = [
  { key: "natur", name: "Natur", preis: preis(0), pal: null,
    hinweis: "Die Farben aus deinem eigenen Ei. Kostenlos, immer da, und immer der Weg zurück." },
  { key: "pixel", name: "Pixel", preis: preis(0, 5),
    pal: { fell: "#8bac0f", muster: "#306230", akzent: "#c6de6b", tinte: "#0f380f" },
    hinweis: "Vier Grüntöne wie auf einem alten Handheld. Der billigste Look, weil er am wenigsten mit dem Rest streitet." },
  { key: "dreamy", name: "Dreamy", preis: preis(0, 6),
    pal: { fell: "#e3d3f2", muster: "#c2a3e6", akzent: "#fff7fc", tinte: "#6a4a92" },
    hinweis: "Pastell, alles ein bisschen verträumt. Sehr hell — mit dunklem Hintergrund am schönsten." },
  { key: "cyber", name: "Cyber", preis: preis(0, 7),
    pal: { fell: "#1f2740", muster: "#00e0ff", akzent: "#7df6ff", tinte: "#ff3d9a" },
    hinweis: "Neon auf Nachtblau. Funktioniert in hell und dunkel, und schluckt jede Kleidungsfarbe außer Gold." },
  { key: "regen", name: "Regenbogen", preis: preis(0, 10),
    pal: { fell: "#f26d6d", muster: "#4ecdc4", akzent: "#ffe66d", tinte: "#4a3070" },
    hinweis: "Jede Rolle eine andere Farbe. Laut, teuer, und der einzige Look, den man an den Sternen ablesen kann." },
];

/* ==========================================================================
   7. REGAL: HINTERGRUENDE  — immer Herzen UND Sterne
   ==========================================================================
   Jennifers Idee vom 03.09.2026 ("smth like sun background"). Das einzige
   Regal, in dem JEDER Posten beides kostet — ein Hintergrund ist das Grosse
   im Bild, er faerbt alles andere mit, und er soll sich nach beiden Sorten
   guter Tage anfuehlen.

   TECHNISCH SIND DAS KEINE ZEICHEN, SONDERN CSS. Die Figur ist ein <pre> mit
   Blockgrafik; ein gezeichneter Hintergrund muesste in dieselben Zellen und
   wuerde jede Silhouette auffressen. Als Ebene DAHINTER kostet er null Zellen
   und skaliert mit jeder Schriftgroesse.

   Beide Modi mitdenken: `stil` ist der helle Modus, `nacht` der dunkle. Wo
   `nacht` fehlt, taugt derselbe Verlauf fuer beides. Ein Hintergrund, der nur
   in einem Modus funktioniert, ist ein Hintergrund, den Rose abends nicht
   anmachen kann. */
var HINTERGRUENDE = [
  { key: "keiner", name: "Keiner", preis: preis(0), stil: null,
    hinweis: "Die Karte, wie sie ist. Kostet nichts und ist immer da." },
  { key: "wolken", name: "Wolken", preis: preis(6, 1),
    stil: "radial-gradient(circle at 22% 68%, #ffffff 0 9%, transparent 9.5%)," +
          "radial-gradient(circle at 34% 72%, #ffffff 0 12%, transparent 12.5%)," +
          "radial-gradient(circle at 74% 60%, #f4f8ff 0 10%, transparent 10.5%)," +
          "linear-gradient(180deg, #bfe0f5 0%, #e8f4fb 100%)",
    nacht: "radial-gradient(circle at 22% 68%, #37416b 0 9%, transparent 9.5%)," +
           "radial-gradient(circle at 34% 72%, #37416b 0 12%, transparent 12.5%)," +
           "radial-gradient(circle at 74% 60%, #2f3a60 0 10%, transparent 10.5%)," +
           "linear-gradient(180deg, #1b2447 0%, #2b3560 100%)",
    hinweis: "Heller Tageshimmel mit drei Wolkenbäuschen. Der günstigste Hintergrund und der, der der Figur am wenigsten in die Farben redet." },
  { key: "sonne", name: "Sonne", preis: preis(8, 2),
    stil: "radial-gradient(circle at 76% 24%, #fff3b0 0 11%, #ffd76b 11% 15%, transparent 15.5%)," +
          "linear-gradient(180deg, #ffe9b8 0%, #ffd39a 55%, #ffc98c 100%)",
    nacht: "radial-gradient(circle at 76% 24%, #ffe089 0 11%, #f0b44a 11% 15%, transparent 15.5%)," +
           "linear-gradient(180deg, #4a3520 0%, #6b4a26 55%, #7d5628 100%)",
    hinweis: "Warmer Himmel mit einer Sonne oben rechts. Genau das, was du dir gewünscht hast — und der einzige Hintergrund mit einem runden Ding drin." },
  { key: "wiese", name: "Wiese", preis: preis(8, 2),
    stil: "linear-gradient(180deg, #cfeaf8 0%, #cfeaf8 52%, #8fc96a 52%, #6fae52 100%)",
    nacht: "linear-gradient(180deg, #1e2a4a 0%, #1e2a4a 52%, #2c4a2c 52%, #1f381f 100%)",
    hinweis: "Horizont auf halber Höhe: Himmel oben, Gras unten. Die Figur steht dadurch auf etwas statt zu schweben." },
  { key: "schnee", name: "Schnee", preis: preis(10, 3),
    stil: "radial-gradient(circle at 18% 22%, #ffffff 0 3%, transparent 3.5%)," +
          "radial-gradient(circle at 62% 14%, #ffffff 0 2.5%, transparent 3%)," +
          "radial-gradient(circle at 84% 40%, #ffffff 0 3%, transparent 3.5%)," +
          "radial-gradient(circle at 40% 46%, #ffffff 0 2%, transparent 2.5%)," +
          "linear-gradient(180deg, #c3d9ea 0%, #eaf3fa 62%, #ffffff 100%)",
    nacht: "radial-gradient(circle at 18% 22%, #dce8f5 0 3%, transparent 3.5%)," +
           "radial-gradient(circle at 62% 14%, #dce8f5 0 2.5%, transparent 3%)," +
           "radial-gradient(circle at 84% 40%, #dce8f5 0 3%, transparent 3.5%)," +
           "radial-gradient(circle at 40% 46%, #dce8f5 0 2%, transparent 2.5%)," +
           "linear-gradient(180deg, #1a2740 0%, #27374f 62%, #35485f 100%)",
    hinweis: "Vier Flocken und ein Boden, der nach unten hin weiß wird. Steht auch im Sommer da, wenn du willst." },
  { key: "sterne", name: "Sternenhimmel", preis: preis(10, 3),
    stil: "radial-gradient(circle at 20% 26%, #ffffff 0 2%, transparent 2.5%)," +
          "radial-gradient(circle at 70% 18%, #ffffff 0 2.5%, transparent 3%)," +
          "radial-gradient(circle at 86% 52%, #ffffff 0 2%, transparent 2.5%)," +
          "radial-gradient(circle at 44% 62%, #ffffff 0 1.6%, transparent 2%)," +
          "linear-gradient(180deg, #2a2f66 0%, #3d3a7a 55%, #55407e 100%)",
    hinweis: "Dunkel in beiden Modi, mit Absicht. Der Hintergrund für die späten Runden — und der, auf dem Glitzer am besten aussieht." },
  { key: "abendrot", name: "Abendrot", preis: preis(12, 4),
    stil: "linear-gradient(180deg, #4a3a76 0%, #a45a8a 34%, #e8815e 66%, #ffc06a 100%)",
    hinweis: "Der Verlauf, den ein Abend über der Havel macht. Teuer, weil er als einziger die ganze Karte umfärbt." },
  { key: "regen", name: "Regenbogen", preis: preis(15, 6),
    stil: "linear-gradient(160deg, #ff9aa2 0%, #ffd59a 18%, #fff3a0 34%, #a8e6a1 52%, #9ad5f0 70%, #c3a8ee 86%, #f0a8d8 100%)",
    hinweis: "Der teuerste Posten im ganzen Laden. 15 ♥ und 6 ★ heißt: rund fünf volle Übungstage und sechs Streckziele. Es soll sich nach etwas anfühlen." },
];

/* Das Bild zu einem Hintergrund — hell oder dunkel. Eine Stelle, damit Laden,
   Karte und Testseite nie verschiedene Verlaeufe zeigen. */
function hintergrundStil(key, nacht) {
  var h = null;
  HINTERGRUENDE.forEach(function (x) { if (x.key === key) h = x; });
  if (!h || !h.stil) return null;
  return (nacht && h.nacht) ? h.nacht : h.stil;
}

/* ==========================================================================
   7b. REGAL: MINI-PETS  — nur Herzen
   ==========================================================================
   Standen bis zum 03.09.2026 in ge-trainer/app/js/maskottchen.js, Zeichen fuer
   Zeichen genauso wie in der Werkstatt (rose/maskottchen/figuren.js,
   Abschnitt 11). Sie sind hierher gezogen, weil der ST-Trainer denselben Laden
   bekommt: zwei Kopien derselben fuenf Tiere waeren zwei Preislisten, und die
   Schluessel stehen im Sync — ein umbenannter Schluessel entwertet still einen
   getaetigten Kauf.

   Sie brauchen die Figur-Geometrie NICHT: eigenes kleines Raster (7 breit,
   hoechstens 4 hoch), sitzen neben der Figur statt auf ihr. Kleiner als jedes
   Jungtier, damit im Bild klar bleibt, wer hier das Haustier ist.

   PREISE AM 03.09.2026 VON 4–6 ♥ AUF 6–10 ♥ ANGEHOBEN. Begruendung oben unter
   "DIE PREISE"; Roses beide gekaufte Pets bleiben bei ihren alten 4 und 6, weil
   der Preis in der Kaufzeile steht und nicht im Regal.

   Eigene Zeichenliste statt der Figur-Liste: die Pets benutzen Viertelbloecke
   (▖ ▗ ▛), die in keiner Tierfigur vorkommen. Wer hier ein Zeichen vergisst,
   macht es unsichtbar-FALSCH statt sichtbar kaputt — die Zelle bekommt keinen
   span und erbt die Textfarbe der Seite. Genau daran war in der Werkstatt die
   Schwanzflosse des Fischs weiss statt orange. */
var VOLL_PET = "█▟▙▛▜▐▌▝▘▖▗▄▀";

var PETS = [
  { key: "kaefer", name: "Käfer", preis: preis(6),
    pal: { fell: "#c0563f", muster: "#2f2a28", akzent: "#f0d8c8", tinte: "#1c1a18" },
    zeilen: [" ▘   ▝ ", " ▟███▙ ", " ▐███▌ ", " ▝▀▀▀▘ "],
    augen: [[1, 1], [1, 5]], extra: [],
    hinweis: "Augen ganz außen, direkt unter den Fühlern. Sagt nichts, ist aber da." },
  { key: "maus", name: "Maus", preis: preis(6),
    pal: { fell: "#a89a8c", muster: "#7d7166", akzent: "#f2ece4", tinte: "#1c1a18" },
    zeilen: ["▟█▙ ▟█▙", "▐█████▌", "▐█████▌", " ▀▀▀▀▀▖"],
    augen: [[1, 2], [1, 4]], extra: [[2, 3, null, "M"]],
    hinweis: "Runde Ohren, ein Schwanz hinten rechts. Nimmt wenig Platz weg." },
  { key: "vogel", name: "Vögelchen", preis: preis(8),
    pal: { fell: "#5b8ec4", muster: "#3a6fa8", akzent: "#eaf3fb", tinte: "#1b2b3a" },
    zeilen: ["  ▄▄▄  ", " ▟███▙▖", " ▐███▌ ", "  ▀ ▀  "],
    augen: [[1, 3]], extra: [[1, 6, "▖", "A"]],
    hinweis: "Oben glatt, dafür Schnabel und zwei Füße." },
  { key: "fisch", name: "Fisch", preis: preis(8),
    pal: { fell: "#e08a3c", muster: "#c05a1f", akzent: "#fbe6c8", tinte: "#3a2410" },
    zeilen: ["  ▄▄▄▄ ", "▙▟█████", "▛▐█████", "  ▀▀▀▀ "],
    augen: [[1, 4]], extra: [],
    hinweis: "Schwanzflosse links, zwei Keile übereinander. Schwimmt in der Luft." },
  { key: "schildkroete", name: "Schildkröte", preis: preis(10),
    pal: { fell: "#7fa86a", muster: "#4c6b3d", akzent: "#eef5e2", tinte: "#22301a" },
    zeilen: ["  ▄▄▄  ", " ▟███▙ ", "▄▐███▌█", " ▀   ▀ "],
    augen: [[2, 6]], extra: [[1, 3, null, "M"]],
    hinweis: "Panzerkuppel mit Kopf rechts. Das teuerste, das langsamste." },
];

function petVon(key) {
  for (var i = 0; i < PETS.length; i++) if (PETS[i].key === key) return PETS[i];
  return null;
}

/* lookKey ist optional und faerbt das Pet mit — es sitzt in derselben Karte
   neben der Figur. */
function petHtml(key, lookKey) {
  var p = petVon(key);
  if (!p) return "";
  var e = {
    zeilen: p.zeilen.slice(),
    maske: p.zeilen.map(function (zeile) {
      return zeile.split("").map(function (ch) { return VOLL_PET.indexOf(ch) < 0 ? " " : "F"; }).join("");
    }),
  };
  (p.extra || []).forEach(function (x) { setz(e, x[0], x[1], x[2], x[3]); });
  (p.augen || []).forEach(function (a) { setz(e, a[0], a[1], "█", "T"); });
  var f = farbenFuer(p.pal, lookKey);
  return malen(e, { F: f.fell, M: f.muster, A: f.akzent, T: f.tinte });
}

/* ==========================================================================
   8. NACHSCHLAGEN
   ==========================================================================
   Alle Regale unter einem Dach. `art` ist das, was in die Kauf-Id wandert
   ("kf:kleidung:hut") — sie muss stabil bleiben, ein umbenannter Schluessel
   entwertet still einen bereits getaetigten Kauf. Das ist mit den Ei-Keys
   zweimal passiert; hier soll es nicht ein drittes Mal passieren. */
var REGALE = [
  { art: "pet", titel: "Mini-Pets", liste: PETS,
    text: "Sitzt neben dir in der Karte. Immer nur eins auf einmal, wechseln kostet nichts." },
  { art: "kleidung", titel: "Kleiderschrank", liste: KLEIDUNG,
    text: "Neun Stücke auf sechs Plätzen. Alles gleichzeitig tragbar, aber je Platz eins — Hut und Krone teilen sich den Kopf." },
  { art: "farbe", titel: "Farbtöpfe", liste: FARBTOEPFE,
    text: "Eine Farbe, die danach auf jedes gekaufte Stück passt. Beliebig oft umfärben, das kostet nie wieder etwas." },
  { art: "makeup", titel: "Make-up", liste: MAKEUP,
    text: "Vier Plätze im Gesicht. Wimpern ersetzen den Lidschatten, alles andere geht nebeneinander." },
  { art: "look", titel: "Looks", liste: LOOKS,
    text: "Tauscht die Farben der Figur selbst. Gilt sofort auf jeder Stufe und auch für dein Mini-Pet." },
  { art: "hintergrund", titel: "Hintergründe", liste: HINTERGRUENDE,
    text: "Liegt hinter der Figur in der Tageskarte. Kostet immer Herzen und Sterne — das Große im Bild soll beides verlangen." },
];

function stueckVon(art, key) {
  var treffer = null;
  REGALE.forEach(function (r) {
    if (r.art !== art) return;
    r.liste.forEach(function (s) { if (s.key === key) treffer = s; });
  });
  return treffer;
}

/* Was in die Kaufzeile geschrieben wird. Abgeleitet und nie zufaellig: zwei
   Geraete, die offline dasselbe Stueck kaufen, muessen beim Merge auf EINE
   Zeile zusammenfallen, sonst zahlt Rose zweimal fuer einen Hut. */
function stueckId(art, key) { return art + ":" + key; }

/* ==========================================================================
   9. DIE FARBE EINES GETRAGENEN STUECKS
   ==========================================================================
   getragen ist EIN Objekt: { slot: { stueck, farbe }, ... }. Stueck und Farbe
   stehen zusammen, weil sie zusammen eine einzige Entscheidung sind ("wie ich
   heute aussehe"). Das hat einen handfesten Grund im Sync:

   mk.getragen wird wie mk.ei und mk.pet als WAHL gemerged — die zuletzt
   getroffene gewinnt, das ganze Objekt auf einmal. Zwei getrennte Felder fuer
   Stueck und Farbe koennten auseinanderlaufen und Rose einen goldenen Hut
   anziehen, den sie nie so kombiniert hat.

   WAS DAS KOSTET, offen: zieht Rose auf dem Handy einen Hut an und auf dem
   Laptop einen Schal, gewinnt das spaetere Outfit KOMPLETT — der Hut ist dann
   weg. Die Vereinigung waere hier falsch: sie koennte nichts mehr ausziehen,
   weil jedes Ablegen beim naechsten Sync zurueckkaeme. Ein Outfit ist eine
   Wahl, keine Sammlung. Besitz geht dabei nie verloren, nur das Angezogene —
   und das ist zwei Antipper wieder da. */
function farbeVon(eintrag, stueck) {
  if (!stueck) return null;
  var topfKey = eintrag && eintrag.farbe;
  if (!topfKey || topfKey === "standard") return { farbe: stueck.standard, verlauf: false };
  var topf = null;
  FARBTOEPFE.forEach(function (t) { if (t.key === topfKey) topf = t; });
  if (!topf || !topf.farbe) return { farbe: stueck.standard, verlauf: false };
  return { farbe: topf.farbe, verlauf: !!topf.verlauf };
}

/* Die Farbtabelle fuer den Maler: Figur-Schluessel plus je ein Eintrag fuer
   jeden belegten Slot. Was nicht getragen wird, taucht hier nicht auf — und
   kann darum auch nicht versehentlich gezeichnet werden. */
function farbTabelle(farben, getragen) {
  var T = { F: farben.fell, M: farben.muster,
            A: farben.akzent || farben.muster, T: farben.tinte || farben.muster };
  Object.keys(getragen || {}).forEach(function (slot) {
    var slotDef = SLOTS[slot];
    var eintrag = getragen[slot];
    if (!slotDef || !eintrag || !eintrag.stueck) return;
    var stueck = stueckVon(slotDef.regal, eintrag.stueck);
    var f = farbeVon(eintrag, stueck);
    if (!f) return;
    T[slotDef.zeichen] = { farbe: f.farbe, verlauf: f.verlauf, schimmert: !!(stueck && stueck.schimmert) };
  });
  return T;
}

/* Ein Look ueberschreibt die vier Figurfarben und laesst alles andere stehen. */
function farbenFuer(variante, lookKey) {
  var basis = { fell: variante.fell, muster: variante.muster,
                akzent: variante.akzent, tinte: variante.tinte };
  var look = null;
  LOOKS.forEach(function (l) { if (l.key === lookKey) look = l; });
  if (!look || !look.pal) return basis;
  return { fell: look.pal.fell, muster: look.pal.muster,
           akzent: look.pal.akzent, tinte: look.pal.tinte };
}

/* ==========================================================================
   10. ANZIEHEN — die Zeichenarbeit
   ==========================================================================
   Herein kommen Ebenen, wie figurEbenen() sie liefert:

     { zeilen, maske, breite, ohrHoehe, augen, unten }

     zeilen    Zeichen je Zelle
     maske     Farbschluessel je Zelle, gleiche Groesse
     breite    Zellen je Zeile
     ohrHoehe  Zeilen, die UEBER dem Koerperraster liegen (Hund 0, Katze 1)
     augen     [[zeile, spalte, breite], ...] in ENDGUELTIGEN Koordinaten
     unten     Index der letzten Koerperzeile

   Heraus kommt dasselbe, nur angezogen. Rein funktional: keine Seiteneffekte,
   kein Zustand, kein DOM. Genau deshalb laesst sich das in Node pruefen.

   REIHENFOLGE IST ENTSCHEIDUNG, nicht Zufall:
     1. verbreitern (Ruecken)  — aendert alle Spalten, muss zuerst
     2. Kopfzeile anlegen      — aendert alle Zeilen, muss vor allem Vertikalen
     3. Koerperstuecke          — Brille, Schal, Schleife, Bluete, Ruecken
     4. Make-up                 — zuletzt, damit es AUF der Brille liegt und
                                  nicht darunter verschwindet */

/* Eine Zelle setzen — Zeichen UND Schluessel zugleich, damit die beiden Ebenen
   nie auseinanderlaufen koennen. ch === null laesst das Zeichen stehen und
   faerbt nur um. */
function setz(e, z, sp, ch, k) {
  if (z < 0 || z >= e.zeilen.length) return;
  var a = e.zeilen[z].split(""), b = e.maske[z].split("");
  if (sp < 0 || sp >= a.length) return;
  if (ch !== null) a[sp] = ch;
  b[sp] = k;
  e.zeilen[z] = a.join(""); e.maske[z] = b.join("");
}

/* Kopie, damit anziehen() die Ebenen des Aufrufers nicht unter ihm veraendert.
   figurEbenen() baut sie zwar jedes Mal neu — aber die Testseite reicht
   dieselben Ebenen mehrfach durch, und ein stiller Seiteneffekt waere dort
   ein Fehler, den man erst drei Varianten spaeter sieht. */
function kopie(e) {
  return { zeilen: e.zeilen.slice(), maske: e.maske.slice(), breite: e.breite,
           ohrHoehe: e.ohrHoehe, augen: (e.augen || []).map(function (a) { return a.slice(); }),
           unten: e.unten };
}

/* Links und rechts je n Zellen Luft. Die Figur RUECKT dadurch nicht — sie
   bekommt Platz. Alle gemerkten Spalten wandern mit, sonst sitzt die Brille
   nach dem Rucksack eine Zelle daneben. */
function verbreitern(e, n) {
  if (n <= 0) return e;
  var luft = " ".repeat(n);
  e.zeilen = e.zeilen.map(function (z) { return luft + z + luft; });
  e.maske = e.maske.map(function (m) { return luft + m + luft; });
  e.breite += 2 * n;
  e.augen = e.augen.map(function (a) { return [a[0], a[1] + n, a[2]]; });
  return e;
}

/* Eine leere Zeile oben drauf. Alles, was in Zeilen gemerkt ist, wandert mit. */
function zeileOben(e) {
  e.zeilen = [" ".repeat(e.breite)].concat(e.zeilen);
  e.maske = [" ".repeat(e.breite)].concat(e.maske);
  e.augen = e.augen.map(function (a) { return [a[0] + 1, a[1], a[2]]; });
  e.ohrHoehe += 1;
  e.unten += 1;
  return e;
}

/* Wie viel Luft ein Rueckenstueck braucht — je Seite, in Zellen. Steht hier
   und nicht am Stueck, weil verbreitern() vor allem anderen laufen muss und
   die Antwort deshalb schon feststehen muss, bevor irgendetwas gezeichnet ist.

   Der Rucksack steht NICHT mehr in dieser Tabelle. Er hat es zweimal
   versucht: mit einer Zelle Luft sass er direkt am Schlappohr des Hundes und
   las sich als zweites Ohr, mit zwei Zellen schwebte ein duenner Strich
   neben der Figur. Beides ist dasselbe Problem — die Figuren sind von VORN
   gezeichnet, und was auf dem Ruecken sitzt, ist von vorn nun einmal nicht
   zu sehen. Er zeigt jetzt das, was man von vorn wirklich sieht: die
   Traeger. Siehe unten bei "6. Ruecken". */
var RUECKEN_LUFT = { fluegel: 2 };

function anziehen(ebenen, getragen) {
  var g = getragen || {};
  var e = kopie(ebenen);

  function traegt(slot) {
    var x = g[slot];
    return x && x.stueck ? x.stueck : null;
  }
  function zeichenVon(slot) { return SLOTS[slot].zeichen; }

  /* ---- 1. Platz schaffen ---- */
  var ruecken = traegt("ruecken");
  if (ruecken) verbreitern(e, RUECKEN_LUFT[ruecken] || 1);

  var kopf = traegt("kopf");
  if (kopf) zeileOben(e);

  var mitte = Math.floor(e.breite / 2);
  var K = zeichenVon("kopf");

  /* ---- 2. Der Kopf ----
     Alle drei Kopfstuecke sitzen auf DERSELBEN eigenen Zeile (Index 0). Das
     ist Absicht: dadurch springt die Figur beim Wechseln von Hut auf Krone
     nicht in der Hoehe, und die Karte darunter bleibt ruhig. */
  if (kopf === "hut") {
    /* Drei Hoehen in einer Zeile, und das ist der ganze Trick: die Kuppe sind
       VOLLE Zellen (█), die Krempe daneben halbe (▄), die Spitzen aussen
       Viertel (▗ ▖). Der erste Entwurf war durchgehend ▄ und las sich im
       Browser als Strich quer ueber dem Kopf — ein Hut braucht Volumen, und
       Volumen gibt es auf einer Zeile nur ueber den Fuellgrad der Zelle. */
    setz(e, 0, mitte - 3, "▗", K);
    setz(e, 0, mitte - 2, "▄", K);
    setz(e, 0, mitte - 1, "█", K);
    setz(e, 0, mitte, "█", K);
    setz(e, 0, mitte + 1, "█", K);
    setz(e, 0, mitte + 2, "▄", K);
    setz(e, 0, mitte + 3, "▖", K);
  } else if (kopf === "krone") {
    /* Drei Zacken aus dem Wechsel von oberer und unterer Halbzelle: ▀ steht
       oben in der Zeile und liest sich als Spitze, ▄ steht unten und liest
       sich als Tal. Kein Sonderzeichen, das in einen Ersatzfont fallen kann. */
    var zacken = ["▀", "▄", "▀", "▄", "▀"];
    for (var j = 0; j < 5; j++) setz(e, 0, mitte - 2 + j, zacken[j], K);
  } else if (kopf === "kopfhoerer") {
    /* Ein Bogen: aussen halbe Zellen, in der Mitte volle. Ohne die
       Hoehenstaffelung waere er dieselbe Zeile wie der Hut in seiner ersten
       Fassung — und die beiden Kopfstuecke von oben nicht zu unterscheiden.
       Keine Krempe: das ist der zweite Unterschied zum Hut. */
    setz(e, 0, mitte - 2, "▄", K);
    setz(e, 0, mitte - 1, "█", K);
    setz(e, 0, mitte, "█", K);
    setz(e, 0, mitte + 1, "█", K);
    setz(e, 0, mitte + 2, "▄", K);
    /* Die Muscheln sitzen auf der Augenzeile an den Kopfseiten, eine Zelle
       INNERHALB des Randes. Ganz aussen sitzen beim Hund die Schlappohren und
       bei der Katze nichts — eine Zelle weiter innen trifft bei beiden Fell. */
    var augZ = e.augen.length ? e.augen[0][0] : e.ohrHoehe + 2;
    var innen = ruecken ? (RUECKEN_LUFT[ruecken] || 1) : 0;
    setz(e, augZ, innen + 1, null, K);
    setz(e, augZ, e.breite - innen - 2, null, K);
  }

  /* ---- 3. Kleinteile an den Kopfseiten ----
     EINE ZEILE UEBER DEN AUGEN, nicht auf der obersten Koerperzeile. Der
     Unterschied ist nicht Geschmack: die oberste Zeile ist bei beiden Tieren
     die Kopf-Oberkante aus Halbbloecken (▄▄▄▄▄), also nur zur Haelfte
     gefuellt. Ein Zeichen dort haengt in der leeren oberen Zellhaelfte und
     sieht aus, als schwebe es ueber dem Kopf — genau so sass die Bluete im
     ersten Browser-Lauf. Eine Zeile tiefer ist volles Fell, und die Marke
     bekommt ueber AUF_FELL ihren Zellhintergrund.

     An den AUGEN ausgerichtet und nicht an der Mitte: die Augen sind der
     einzige Anker, den beide Tiere auf derselben Hoehe haben, und bei einem
     schmaleren Jungtier waere ein fester Abstand zur Mitte irgendwann
     ausserhalb der Figur. */
  if (e.augen.length) {
    var kzz = Math.max(e.ohrHoehe, e.augen[0][0] - 1);
    var kLinks = Math.min.apply(null, e.augen.map(function (a) { return a[1]; }));
    var kRechts = Math.max.apply(null, e.augen.map(function (a) { return a[1] + a[2] - 1; }));
    if (traegt("links") === "schleife") {
      // Zwei Dreiecke, die sich in der Mitte treffen — eine Schleife von vorn.
      setz(e, kzz, kLinks - 2, "▙", zeichenVon("links"));
      setz(e, kzz, kLinks - 1, "▟", zeichenVon("links"));
    }
    if (traegt("rechts") === "bluete") {
      setz(e, kzz, kRechts + 1, "❀", zeichenVon("rechts"));
    }
  }

  /* ---- 4. Brille ----
     Folgt den ECHTEN Augen, nicht einer festen Zeile: sonst sitzt sie bei
     jeder anderen Figur im Kopf. Danach die Augen wieder obendrauf, sonst
     traegt die Figur eine Augenbinde statt einer Brille. */
  if (traegt("gesicht") === "brille" && e.augen.length) {
    var G = zeichenVon("gesicht");
    var zz = e.augen[0][0];
    var links = Math.min.apply(null, e.augen.map(function (a) { return a[1]; })) - 1;
    var rechts = Math.max.apply(null, e.augen.map(function (a) { return a[1] + a[2] - 1; })) + 1;
    for (var sp = links; sp <= rechts; sp++) setz(e, zz, sp, "▄", G);
    e.augen.forEach(function (a) {
      for (var q = 0; q < a[2]; q++) setz(e, a[0], a[1] + q, "█", "T");
    });
  }

  /* ---- 5. Schal ----
     Faerbt die unterste Koerperzeile um und laesst jedes Zeichen stehen.
     Wuerde er die Zellen ueberschreiben, verloere die Figur dort ihre runden
     Kanten und die Silhouette bekaeme eine Delle. */
  if (traegt("hals") === "schal") {
    var C = zeichenVon("hals");
    for (var s = 0; s < e.breite; s++) {
      if (e.maske[e.unten][s] !== " ") setz(e, e.unten, s, null, C);
    }
  }

  /* ---- 6. Ruecken ----
     Zeichnet in die Luft, die verbreitern() oben geschaffen hat. Ohne diesen
     Platz waere hier nichts zu holen: die Zeilen sind so breit wie die Figur. */
  if (ruecken) {
    var R = zeichenVon("ruecken");
    var re = e.breite - 1;
    var kZeile = e.ohrHoehe;           // oberste Koerperzeile
    if (ruecken === "rucksack") {
      /* ZWEI TRAEGER, KEINE TASCHE. Die Figuren sind von vorn gezeichnet; ein
         Rucksack sitzt hinten und ist von vorn nicht zu sehen — was man sieht,
         sind die Gurte ueber den Schultern. Sie faerben nur um und tasten kein
         Zeichen an, damit die Silhouette heil bleibt.
         Aussen an den Augen ausgerichtet, damit sie zwischen Auge und Rand
         laufen und nicht durch die Schnauze. */
      var gl = Math.min.apply(null, e.augen.map(function (a) { return a[1]; })) - 2;
      var gr = Math.max.apply(null, e.augen.map(function (a) { return a[1] + a[2] - 1; })) + 2;
      for (var gz = (e.augen.length ? e.augen[0][0] : kZeile + 2); gz <= e.unten; gz++) {
        if (e.maske[gz][gl] !== " ") setz(e, gz, gl, null, R);
        if (e.maske[gz][gr] !== " ") setz(e, gz, gr, null, R);
      }
    } else if (ruecken === "fluegel") {
      // Zwei Zellen je Seite, nach aussen hin schmaler — das liest sich als
      // aufgespannte Schwinge statt als zweiter Koerper.
      setz(e, kZeile + 1, 1, "▄", R);
      setz(e, kZeile + 2, 0, "▄", R); setz(e, kZeile + 2, 1, "█", R);
      setz(e, kZeile + 3, 0, "▀", R); setz(e, kZeile + 3, 1, "▀", R);
      setz(e, kZeile + 1, re - 1, "▄", R);
      setz(e, kZeile + 2, re, "▄", R); setz(e, kZeile + 2, re - 1, "█", R);
      setz(e, kZeile + 3, re, "▀", R); setz(e, kZeile + 3, re - 1, "▀", R);
    }
  }

  /* ---- 7. Make-up, ganz zuletzt ----
     Nach der Brille, damit Wimpern und Lidschatten auf ihr liegen statt unter
     ihr zu verschwinden. Alles hier faerbt oder setzt Marken; nichts hier
     reisst ein Blockzeichen heraus. */
  if (e.augen.length) {
    var augZ2 = e.augen[0][0];
    var lid = traegt("lid");
    if (lid === "lidschatten") {
      var L = zeichenVon("lid");
      e.augen.forEach(function (a) {
        for (var q = 0; q < a[2]; q++) setz(e, a[0] - 1, a[1] + q, null, L);
      });
    } else if (lid === "wimpern") {
      var L2 = zeichenVon("lid");
      e.augen.forEach(function (a) {
        // ▄ in der Zeile UEBER dem Auge liegt direkt auf dem Auge auf.
        for (var q = 0; q < a[2]; q++) setz(e, a[0] - 1, a[1] + q, "▄", L2);
      });
    }

    /* Die Wange liegt je Auge unter DIESEM Auge, nicht an einer aus allen
       Augen gerechneten Aussenkante. Der Unterschied ist kein Geschmack: die
       Aussenkante lag eine Zelle neben dem aeussersten Auge und damit genau
       auf ▐ bzw. ▌ — der Silhouettenkante. Sommersprossen haben sie in der
       Textprobe durch ▘ ersetzt und der Figur die Rundung weggebissen. */
    var wange = traegt("wange");
    if (wange) {
      var W = zeichenVon("wange");
      var wz = augZ2 + 1;
      e.augen.forEach(function (a) {
        if (wange === "rouge") {
          // Weicher Fleck direkt unter dem Auge: nur umfaerben, kein Zeichen antasten.
          for (var q = 0; q < a[2]; q++) setz(e, wz, a[1] + q, null, W);
        } else if (wange === "sommersprossen") {
          // Zwei Viertelbloecke je Auge, mit Fellhintergrund (siehe AUF_FELL).
          setz(e, wz, a[1], "▘", W);
          setz(e, wz, a[1] + a[2], "▝", W);
        }
      });
    }

    if (traegt("glanz") === "glitzer") {
      var X = zeichenVon("glanz");
      var gl = Math.min.apply(null, e.augen.map(function (a) { return a[1]; })) - 1;
      var gr = Math.max.apply(null, e.augen.map(function (a) { return a[1] + a[2] - 1; })) + 1;
      setz(e, augZ2 - 1, gl, "✦", X);
      setz(e, augZ2 + 1, gr, "✦", X);
    }
  }

  /* ---- 8. Lippenstift ----
     Faerbt das Maul. Steht ausserhalb des Augen-Blocks, weil es die Augen
     nicht braucht — und weil ein Maul auch dann da ist, wenn die Figur noch
     keine richtigen Augen hat. Gefunden wird es ueber die Maske: die einzige
     Zelle unterhalb der Augen, die Tinte traegt. */
  if (traegt("mund") === "lippenstift") {
    var P = zeichenVon("mund");
    var abZ = e.augen.length ? e.augen[0][0] + 1 : e.ohrHoehe + 2;
    for (var mz = abZ; mz <= e.unten; mz++) {
      for (var msp = 0; msp < e.breite; msp++) {
        if (e.maske[mz][msp] === "T") setz(e, mz, msp, null, P);
      }
    }
  }

  return e;
}

/* ==========================================================================
   11. DER MALER
   ==========================================================================
   Zeichen-Ebene und Schluessel-Ebene werden zu Spans zusammengelegt, Zellen
   mit gleichem Schluessel als EIN Span (Lauflaenge) — sonst stuenden bei jeder
   Figur dreimal so viele Knoten im DOM.

   Ein Eintrag in FARBE ist entweder ein Farbstring (Figur) oder ein Objekt
   { farbe, verlauf, schimmert } (getragenes Stueck).

   DER WICHTIGSTE ZWEIG IST DER LETZTE: ein Schluessel ohne Farbe faellt auf
   das Fell zurueck. Ohne dieses Netz bekaeme die Zelle color:undefined, der
   Browser wuerde die Regel verwerfen und das Zeichen erbte die Textfarbe der
   Seite — unsichtbar FALSCH statt sichtbar kaputt. Genau daran war in der
   Werkstatt die Schwanzflosse des Fischs weiss statt orange. */
function malen(e, FARBE) {
  return e.zeilen.map(function (zeile, i) {
    var out = "", puffer = "", k = null;
    function spuelen() {
      if (!puffer) return;
      if (k === " ") { out += puffer; puffer = ""; return; }
      var eintrag = FARBE[k];
      var farbe = (eintrag && typeof eintrag === "object") ? eintrag.farbe : eintrag;
      var verlauf = !!(eintrag && typeof eintrag === "object" && eintrag.verlauf);
      var schimmert = !!(eintrag && typeof eintrag === "object" && eintrag.schimmert);
      if (!farbe) farbe = FARBE.F;

      var klassen = [];
      if (schimmert) klassen.push("mk-schimmer");
      var aufFell = AUF_FELL.indexOf(k) >= 0;

      if (verlauf) {
        /* Regenbogen auf Text: der Verlauf wird als Hintergrund gemalt und auf
           die Glyphe beschnitten (.mk-verlauf).

           ZWEI SPANS, WENN DIE ZELLE EINE MARKE AUF DEM FELL IST. Das ist kein
           Schmuck, sondern die einzige Bauart, die beides kann: background-clip
           beschneidet ALLE Hintergruende der Zelle, also auch den Fellgrund —
           auf EINEM Span waere die Marke bunt und die Zelle drumherum ein Loch,
           durch das die Karte scheint. Genau die Sorte Loch, gegen die AUF_FELL
           ueberhaupt existiert.

           Also aussen der Fellgrund, innen der beschnittene Verlauf. Betrifft
           Sommersprossen und Glitzer, sobald jemand den Regenbogen-Farbtopf
           darauf antippt — der einzige Weg, auf dem sich Verlauf und Marke
           ueberhaupt treffen. */
        klassen.push("mk-verlauf");
        var innen = "<span class=\"" + klassen.join(" ") + "\" style=\"background-image:" +
                    farbe + "\">" + puffer + "</span>";
        out += aufFell ? '<span style="background:' + FARBE.F + '">' + innen + "</span>" : innen;
        puffer = "";
        return;
      }

      // Marke auf dem Fell: eigener Zellhintergrund, sonst ein Loch im Tier.
      var stil = aufFell ? "color:" + farbe + ";background:" + FARBE.F : "color:" + farbe;
      out += "<span" + (klassen.length ? ' class="' + klassen.join(" ") + '"' : "") +
             ' style="' + stil + '">' + puffer + "</span>";
      puffer = "";
    }
    for (var j = 0; j < zeile.length; j++) {
      var kk = (e.maske[i] && e.maske[i][j]) || " ";
      if (kk !== k) { spuelen(); k = kk; }
      puffer += zeile[j];
    }
    spuelen();
    return out;
  }).join("\n");
}

/* Nur die Zeichen, ohne Farbe — fuer Node und die Textprobe. Was hier schief
   aussieht, sieht auch im Browser schief aus; Farbe kann eine verrutschte
   Zelle nicht geradebiegen. */
function alsText(e) { return e.zeilen.join("\n"); }

/* ==========================================================================
   12. AUSGANG
   ==========================================================================
   Reines ES-Modul, kein globaler Namensraum und kein module.exports. Das ist
   eine bewusste Einschraenkung: eine Datei, die beide Welten bedient, muesste
   ihre eigene Ladeart raten, und in Node waere `export` in einer .js ohne
   package.json schlicht ein Syntaxfehler.

   Wer sie in Node ansehen will (Textprobe der Figuren), kopiert sie nach .mjs
   und importiert die Kopie — so macht es scripts/zeig-laden.mjs. Die Testseite
   laedt sie als <script type="module">, die Trainer per import. */
/* ==========================================================================
   13. DAS BLATT — der Laden als Oberflaeche
   ==========================================================================
   Steht hier und nicht in den beiden maskottchen.js, obwohl es DOM baut und
   dieser Baustein sonst ausdruecklich keins anfasst. Der Grund ist derselbe wie
   beim Katalog: die Oberflaeche war in beiden Trainern Wort fuer Wort dieselbe,
   nur einmal in var-Schreibweise und einmal in const. Zwei Kopien von 250 Zeilen
   Kauf-Logik sind zwei Stellen, an denen ein Preis-Waechter fehlen kann.

   Was den Unterschied zwischen den Trainern traegt, ist der ADAPTER — ein
   Objekt mit allem, was am Zustand haengt. Der Baustein weiss dadurch nicht,
   ob er gerade einen Hund oder eine Katze anzieht, und er kann nichts kaufen,
   was der Trainer ihm nicht erlaubt:

     api.stand()                der Herzen-/Sterne-Stand von jetzt
     api.guthaben(stand)        das abgeleitete Guthaben { herz, stern }
     api.besitzt(was)           ob ein Stueck schon gekauft ist
     api.kaufen(was, preis)     kauft; false, wenn es nicht geht
     api.wahl(feld)             eine getroffene Wahl lesen
     api.waehle(feld, wert)     eine Wahl setzen
     api.outfit()               das getragene Outfit als Objekt
     api.anlegen(slot, key)     an- oder ausziehen (key null = aus)
     api.faerben(slot, farbe)   umfaerben
     api.figur(opt)             die eigene Figur als HTML
     api.pet(key, look)         ein Mini-Pet als HTML
     api.nacht()                ob das dunkle Blatt laeuft
     api.schliessen()           das Sheet zumachen
     api.el(tag, klasse, text)  ein Element bauen
     api.knopf(text, kl, fn)    ein Knopf
     api.neu()                  die Karte darunter neu zeichnen (optional)

   el und knopf kommen aus dem Trainer, weil beide sie ohnehin haben und ihre
   Fassungen sich in Kleinigkeiten unterscheiden. Sie hier nachzubauen hiesse,
   eine dritte Fassung in die Welt zu setzen. */
  /* Das Sheet zeichnet sich nach jedem Kauf selbst neu — und danach die Karte
     darunter, weil dort Figur, Pet und Hintergrund sitzen. Reihenfolge ist
     Absicht: erst das Sheet, damit der Knopf, den Rose gerade gedrueckt hat,
     sofort seinen neuen Zustand zeigt; die Karte darunter kann warten. */
/* Der Hinweis an einem Farbtopf, wenn er keinen eigenen hat. Ausgerechnet statt
   achtmal hingeschrieben — die Saetze waeren sonst achtmal fast dasselbe. */
function farbHinweis(topf) {
  return "Färbt jedes getragene Stück in " + topf.name + ". Einmal gekauft, danach beliebig oft.";
}

/* Was auf der Buehne zu sehen ist, als Satz. Die Buehne selbst ist
   aria-hidden — Blockgrafik vorzulesen ergibt Zeichensalat. Dieser Satz ist
   also die einzige Fassung, die ein Screenreader bekommt, und er muss darum
   vollstaendig sein statt huebsch. */
function buehneSatz(getragen, look) {
  var teile = [];
  Object.keys(getragen || {}).forEach(function (slot) {
    var e = getragen[slot];
    var slotDef = SLOTS[slot];
    if (!e || !e.stueck || !slotDef) return;
    var stueck = stueckVon(slotDef.regal, e.stueck);
    if (stueck) teile.push(stueck.name);
  });
  var lookName = "Natur";
  LOOKS.forEach(function (l) { if (l.key === (look || "natur")) lookName = l.name; });
  if (!teile.length) return "So siehst du gerade aus: " + lookName + ", sonst nichts an.";
  return "So siehst du gerade aus: " + lookName + ", dazu " + teile.join(", ") + ".";
}

function blattFuellen(blatt, api) {
  // el und knopf kommen aus dem Trainer (siehe Adapter oben). Einmal
  // ausgepackt, damit die 250 Zeilen darunter lesbar bleiben.
  var el = api.el, knopf = api.knopf;

  /* Nach jeder Aenderung: erst das Sheet, dann die Karte darunter. Die
     Reihenfolge ist Absicht — der Knopf, den Rose gerade gedrueckt hat, soll
     sofort seinen neuen Zustand zeigen; die Karte darunter kann warten.
     api.neu ist optional: die Testseite reicht keine Karte herein. */
  function nachKauf() { malen(); if (typeof api.neu === "function") api.neu(); }

  /* Nur der ERSTE Aufbau springt an den Anfang, jeder weitere bleibt stehen,
     wo Rose gerade war.

     Bis zum ersten Browser-Lauf am 03.09.2026 setzte jedes Neuzeichnen
     scrollTop auf 0 — gedacht war das fuer den Kauf (die neue Zahl im Konto
     soll zu sehen sein). Getroffen hat es aber auch das Umfaerben: wer weit
     unten am Hut eine Farbe antippt, landet oben am Kopf des Blattes und muss
     sich seinen Platz wiedersuchen. Und der Kauf braucht es gar nicht — die
     Kachel bestaetigt sich selbst (Rahmen und "ist an"), das ist die
     Rueckmeldung, die am Daumen liegt. */
  var ersterAufbau = true;

  function malen() {
    var stand = blatt.scrollTop;
    blatt.textContent = "";
    blatt.appendChild(el("div", "chat-grip"));

    var st = api.stand();
    var frei = api.guthaben(st);
    var look = api.wahl("look");
    var getragen = api.outfit();

    blatt.appendChild(el("div", "shop-kopf", "Der Laden"));
    var konto = el("p", "shop-konto");
    /* Beide Waehrungen immer, auch bei 0 ★. blaseText() laesst die Sterne bei 0
       weg (dort ist es eine Blase, kein Konto) — hier waere das Loeschung: wer
       sein Guthaben ansieht, will wissen, dass es die zweite Waehrung gibt und
       sie gerade leer ist. */
    konto.innerHTML = "<b>" + frei.herz + "</b> ♥ frei · <b>" + frei.stern + "</b> ★ frei";
    blatt.appendChild(konto);
    blatt.appendChild(el("p", "shop-hinweis",
      "Gekauft ist gekauft. Nichts läuft ab, nichts geht kaputt, und wenn du einen Tag nicht kannst, passiert hier gar nichts."));

    /* ---- Die Bühne ----
       Die Figur, wie sie GERADE aussieht — mit Outfit, Look, Make-up und
       Hintergrund. Sie steht ganz oben und nicht unten, weil jeder Kauf und
       jedes Umfaerben hier landet: wer eine Farbe antippt, will die Wirkung
       sehen, ohne zu scrollen. Nach einem Kauf springt blatt.scrollTop auf 0
       und damit genau hierher. */
    var buehne = el("div", "shop-buehne");
    var hg = hintergrundStil(api.wahl("hintergrund"), api.nacht());
    if (hg) buehne.style.backgroundImage = hg;
    var buehneBild = document.createElement("pre");
    buehneBild.className = "shop-buehne-bild";
    buehneBild.setAttribute("aria-hidden", "true");
    buehneBild.innerHTML = api.figur({ look: look, getragen: getragen });
    buehne.appendChild(buehneBild);
    var buehnePet = api.wahl("pet");
    if (buehnePet && api.besitzt("pet:" + buehnePet)) {
      var pv = document.createElement("pre");
      pv.className = "shop-buehne-pet";
      pv.setAttribute("aria-hidden", "true");
      pv.innerHTML = api.pet(buehnePet, look);
      buehne.appendChild(pv);
    }
    blatt.appendChild(buehne);
    // Die Buehne ist ein Bild aus Blockzeichen; ein Screenreader braucht den Satz.
    blatt.appendChild(el("p", "shop-buehne-text", buehneSatz(getragen, look)));

    /* ---- Eine Kachel ----
       Alle sechs Regale bauen dieselbe Kachel: Bild, Name, Hinweis, und darunter
       GENAU EINEN Knopf, dessen Beschriftung den Zustand ist.

         nicht gekauft   der Preis        ("9 ♥ + 2 ★")
         gekauft, aus    "anziehen" / "mitnehmen" / "aufsetzen"
         gekauft, an     "ist an"          — antippen legt es ab

       Kein Haken, kein Badge, keine zweite Zeile: auf 150 px ist jede weitere
       Zeile eine, die umbricht. Was an ist, sieht man an der Buehne oben und am
       Rahmen der Kachel (.shop-stueck.an). */
    function kachel(opt) {
      var karte = el("div", "shop-stueck" + (opt.an ? " an" : ""));

      if (opt.bildHtml != null) {
        var bild = document.createElement("pre");
        bild.className = "shop-bild" + (opt.bildKlasse ? " " + opt.bildKlasse : "");
        bild.setAttribute("aria-hidden", "true");
        bild.innerHTML = opt.bildHtml;
        karte.appendChild(bild);
      } else if (opt.flaeche) {
        var f = el("div", "shop-flaeche");
        f.style.backgroundImage = opt.flaeche;
        f.setAttribute("aria-hidden", "true");
        karte.appendChild(f);
      }

      karte.appendChild(el("div", "shop-name", opt.name));
      if (opt.hinweis) karte.appendChild(el("p", "shop-text", opt.hinweis));

      if (!opt.hat) {
        var kann = bezahlbar(opt.preis, frei);
        var kauf = knopf(preisText(opt.preis), "knopf klein shop-kauf", opt.kaufen);
        kauf.disabled = !kann;
        if (!kann) {
          var fehlt = fehltText(opt.preis, frei);
          kauf.title = fehlt;
          /* Der Screenreader bekommt denselben Satz — ein deaktivierter Knopf
             mit nur einer Zahl sagt sonst nicht, warum er nicht geht. Und die
             Zahl wird ausgeschrieben: "9 ♥ + 2 ★" liest je nach Stimme als
             "neun" und danach gar nichts. */
          kauf.setAttribute("aria-label",
            opt.name + " kostet " + preisGesprochen(opt.preis) + ". " +
            fehltGesprochen(opt.preis, frei));
        }
        karte.appendChild(kauf);
      } else if (opt.an) {
        var ab = knopf(opt.anText || "ist an", "mk-link shop-an", opt.ablegen || null);
        if (!opt.ablegen) ab.disabled = true;
        else ab.setAttribute("aria-label", opt.name + " ist an — antippen, um es abzulegen");
        karte.appendChild(ab);
      } else {
        karte.appendChild(knopf(opt.ausText || "anziehen", "knopf klein sekundaer", opt.anlegen));
      }

      /* Der Farbstreifen sitzt IN der Kachel des Stuecks und nicht in einem
         eigenen Regal. Der Umweg waere: Farbe suchen, Stueck suchen, zuordnen.
         So ist es: Stueck ansehen, Farbe antippen, fertig. Er erscheint nur an
         dem, was gerade AN ist — an einem Stueck im Schrank hat eine Farbe
         nichts zu entscheiden. */
      if (opt.an && opt.slot) karte.appendChild(farbStreifen(opt.slot, opt.farbe));
      return karte;
    }

    /* Die gekauften Farbtoepfe als Reihe kleiner Kreise. "Wie geliefert" ist
       immer dabei und immer der Weg zurueck. */
    function farbStreifen(slot, aktuell) {
      var reihe = el("div", "shop-farben");
      reihe.setAttribute("role", "group");
      reihe.setAttribute("aria-label", "Farbe wählen");
      FARBTOEPFE.forEach(function (t) {
        if (t.key !== "standard" && !api.besitzt(stueckId("farbe", t.key))) return;
        var an = (aktuell || "standard") === t.key;
        var b = knopf("", "shop-farbe" + (an ? " an" : "") + (t.verlauf ? " verlauf" : ""), function () {
          api.faerben(slot, t.key);
          nachKauf();
        });
        // Ein Verlauf gehoert in background-image, eine Farbe in background.
        // Bis zum 03.09.2026 stand hier zweimal derselbe Zweig — der Punkt sah
        // trotzdem richtig aus, weil background auch einen Verlauf schluckt.
        // Die Zeile war damit kein Fehler, aber die Stelle, an der niemand
        // hingesehen hat: der Regenbogen-Topf war der einzige nie gepruefte Pfad.
        if (t.farbe) {
          if (t.verlauf) b.style.backgroundImage = t.farbe;
          else b.style.background = t.farbe;
        }
        b.setAttribute("aria-label", t.name + (an ? " (gewählt)" : ""));
        b.setAttribute("aria-pressed", an ? "true" : "false");
        b.title = t.name;
        reihe.appendChild(b);
      });
      return reihe;
    }

    function regalKopf(titel, text) {
      blatt.appendChild(el("h3", "shop-regal-kopf", titel));
      blatt.appendChild(el("p", "shop-regal-text", text));
      var r = el("div", "shop-regal");
      blatt.appendChild(r);
      return r;
    }

    // ---- Regal 1: die Mini-Pets ----
    var rPets = regalKopf("Mini-Pets",
      "Sitzt neben dir in der Karte. Immer nur eins auf einmal, wechseln kostet nichts.");
    var petAn = api.wahl("pet");
    PETS.forEach(function (p) {
      var was = "pet:" + p.key;
      var hat = api.besitzt(was);
      rPets.appendChild(kachel({
        name: p.name, hinweis: p.hinweis, preis: p.preis,
        bildHtml: api.pet(p.key, look),
        hat: hat, an: hat && petAn === p.key,
        anText: "ist dabei", ausText: "mitnehmen",
        kaufen: function () {
          if (!api.kaufen(was, p.preis)) return;
          // Frisch gekauft wird gleich getragen. Alles andere waere ein zweiter
          // Klick fuer etwas, das ohnehin gewollt ist.
          api.waehle("pet", p.key); nachKauf();
        },
        anlegen: function () { api.waehle("pet", p.key); nachKauf(); },
        ablegen: function () { api.waehle("pet", null); nachKauf(); },
      }));
    });

    // ---- Regal 2 und 4: Kleiderschrank und Make-up ----
    // Dieselbe Mechanik, darum dieselbe Schleife. Der Unterschied ist die
    // Liste und der Text darueber, sonst nichts.
    function tragbaresRegal(art, liste, titel, text, ausText) {
      var r = regalKopf(titel, text);
      liste.forEach(function (stueck) {
        var was = stueckId(art, stueck.key);
        var hat = api.besitzt(was);
        var eintrag = getragen[stueck.slot];
        var an = hat && !!eintrag && eintrag.stueck === stueck.key;
        /* Das Vorschaubild zeigt die Figur mit GENAU DIESEM Stueck und sonst
           nichts. Nicht das ganze Outfit: sonst saehen alle neun Kacheln fast
           gleich aus und man erkennt nicht, was man kauft. Das ganze Outfit
           steht auf der Buehne oben. */
        var nur = {};
        nur[stueck.slot] = { stueck: stueck.key, farbe: an ? eintrag.farbe : "standard" };
        r.appendChild(kachel({
          name: stueck.name, hinweis: stueck.hinweis, preis: stueck.preis,
          bildHtml: api.figur({ look: look, getragen: nur }),
          bildKlasse: "shop-bild-figur",
          hat: hat, an: an, slot: stueck.slot, farbe: an ? eintrag.farbe : null,
          ausText: ausText,
          kaufen: function () {
            if (!api.kaufen(was, stueck.preis)) return;
            api.anlegen(stueck.slot, stueck.key); nachKauf();
          },
          anlegen: function () { api.anlegen(stueck.slot, stueck.key); nachKauf(); },
          ablegen: function () { api.anlegen(stueck.slot, null); nachKauf(); },
        }));
      });
    }

    tragbaresRegal("kleidung", KLEIDUNG, "Kleiderschrank",
      "Neun Stücke auf sechs Plätzen. Alles gleichzeitig tragbar, aber je Platz eins — Hut und Krone teilen sich den Kopf.",
      "anziehen");

    tragbaresRegal("makeup", MAKEUP, "Make-up",
      "Vier Plätze im Gesicht. Wimpern ersetzen den Lidschatten, alles andere geht nebeneinander.",
      "auftragen");

    // ---- Regal 3: Farbtöpfe ----
    var rFarben = regalKopf("Farbtöpfe",
      "Eine Farbe, die danach auf jedes getragene Stück passt. Du wählst sie direkt an der Kachel des Stücks aus, beliebig oft und immer kostenlos.");
    FARBTOEPFE.forEach(function (t) {
      if (t.key === "standard") return;   // gehoert niemandem, ist immer da
      var was = stueckId("farbe", t.key);
      var hat = api.besitzt(was);
      rFarben.appendChild(kachel({
        name: t.name, hinweis: t.hinweis || farbHinweis(t), preis: t.preis,
        flaeche: t.verlauf ? t.farbe : "linear-gradient(" + t.farbe + ", " + t.farbe + ")",
        hat: hat, an: hat,
        // Ein Farbtopf wird nicht getragen — er ist einfach da. Der Knopf sagt
        // das und laesst sich bewusst nicht druecken.
        anText: "im Regal", ablegen: null,
        kaufen: function () {
          if (!api.kaufen(was, t.preis)) return;
          nachKauf();
        },
      }));
    });

    // ---- Regal 5: Looks ----
    var rLooks = regalKopf("Looks",
      "Tauscht die Farben der Figur selbst. Gilt sofort auf jeder Stufe und färbt dein Mini-Pet mit.");
    LOOKS.forEach(function (l) {
      var was = stueckId("look", l.key);
      // "Natur" gehoert niemandem und ist immer da — es ist die Rueckfahrkarte.
      var hat = l.key === "natur" || api.besitzt(was);
      var an = (look || "natur") === l.key;
      rLooks.appendChild(kachel({
        name: l.name, hinweis: l.hinweis, preis: l.preis,
        bildHtml: api.figur({ look: l.key }),
        bildKlasse: "shop-bild-figur",
        hat: hat, an: an, anText: "ist an", ausText: "anziehen",
        ablegen: l.key === "natur" ? null : function () { api.waehle("look", "natur"); nachKauf(); },
        kaufen: function () {
          if (!api.kaufen(was, l.preis)) return;
          api.waehle("look", l.key); nachKauf();
        },
        anlegen: function () { api.waehle("look", l.key); nachKauf(); },
      }));
    });

    // ---- Regal 6: Hintergründe ----
    var rHg = regalKopf("Hintergründe",
      "Liegt hinter dir in der Tageskarte. Kostet immer Herzen UND Sterne — das Große im Bild soll beides verlangen.");
    var hgAn = api.wahl("hintergrund") || "keiner";
    HINTERGRUENDE.forEach(function (h) {
      var was = stueckId("hintergrund", h.key);
      var hat = h.key === "keiner" || api.besitzt(was);
      var an = hgAn === h.key;
      rHg.appendChild(kachel({
        name: h.name, hinweis: h.hinweis, preis: h.preis,
        flaeche: hintergrundStil(h.key, api.nacht()) || "linear-gradient(var(--paper-2), var(--paper-2))",
        hat: hat, an: an, anText: "ist an", ausText: "aufhängen",
        ablegen: h.key === "keiner" ? null : function () { api.waehle("hintergrund", "keiner"); nachKauf(); },
        kaufen: function () {
          if (!api.kaufen(was, h.preis)) return;
          api.waehle("hintergrund", h.key); nachKauf();
        },
        anlegen: function () { api.waehle("hintergrund", h.key); nachKauf(); },
      }));
    });

    var zu = knopf("Schließen", "knopf klein sekundaer shop-zu", api.schliessen);
    blatt.appendChild(zu);

    /* Der Fokus geht auf das BLATT, nicht auf den Schliessen-Knopf. Das
       Chat-Sheet macht es umgekehrt und hat recht damit — dort sitzt der Knopf
       weit oben. Hier steht er ganz unten hinter sechs Regalen: ihn zu
       fokussieren scrollt das Sheet beim Oeffnen an seinem eigenen Kopf vorbei,
       und Rose landet unter dem Guthaben statt darueber. Gemessen am 22.08.2026
       im 360-px-Lauf.
       tabindex -1 macht das Blatt fokussierbar, ohne es in die Tab-Reihenfolge
       aufzunehmen. Der Fokus wird nur EINMAL gesetzt: ihn bei jedem
       Neuzeichnen zu holen risse ihn Rose bei jedem Antippen wieder aus der
       Hand, und ein Screenreader saehe den Dialog als staendig neu. */
    blatt.scrollTop = ersterAufbau ? 0 : stand;
    if (ersterAufbau) { blatt.focus(); ersterAufbau = false; }
  }

  malen();
}

export {
  SLOTS, SLOT_VON_ZEICHEN, AUF_FELL,
  KLEIDUNG, MAKEUP, FARBTOEPFE, LOOKS, HINTERGRUENDE, PETS, REGALE,
  preis, preisText, preisGesprochen, fehltText, bezahlbar,
  stueckVon, stueckId, farbeVon, farbTabelle, farbenFuer, hintergrundStil,
  petVon, petHtml,
  anziehen, malen, alsText, verbreitern, zeileOben, setz, kopie,
  blattFuellen, buehneSatz,
};
