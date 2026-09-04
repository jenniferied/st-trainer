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
/* Der Laden: Katalog, Preise, Zeichenarbeit und das Blatt. Kennt weder Zustand
   noch die Tierart (Quelle: rose/geteilte-styles/laden.js, verteilt per
   verteilen.sh). Das KONTO bleibt hier — es haengt am Zustand.
   Wortgleich dieselbe Zeile im GE-Trainer; beide Kopien zusammen halten. */
import * as Laden from "./geteilt-laden.js";

const REDUCE_MOTION = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Herzen aus der echten Uebungshistorie ----------
   Jeder Tag wird an den Schwellen SEINES Tages gemessen (C.schwellenFuerTag:
   tzHist-Eintrag, sonst Rekonstruktion ueber den Fokus-Faktor). Bis zum 21.08.
   rechnete hier das heutige Tagesziel die ganze Historie um — die halbierte
   Fokus-Woche machte so rueckwirkend aus 10 Sternen 17, und die Sperrklinke
   loggte den Sprung ein. Grosszuegig gerundet bleibt es trotzdem: bei einer
   Belohnungswaehrung ist ein Herz zu viel harmlos, eines zu wenig fuehlt sich
   wie Betrug an. */
/* aktOverride ist NUR fuer die Testseite (playground/rose/maskottchen/viewer/):
   damit laesst sich ein statischer Abzug von Roses Historie einspeisen, ohne
   ihre echten Daten anzufassen. Die App ruft die Funktion immer ohne auf. */
export function herzenStand(tz, aktOverride) {
  const akt = aktOverride || C.aktivitaetProTag();
  let herzen = 0, sterne = 0, tage = 0;
  for (const key of Object.keys(akt)) {
    const n = akt[key].n || 0;
    if (!n) continue;
    const z = tz ? C.schwellenFuerTag(+key, tz) : { minimum: 15, ziel: 35, stretch: 55 };
    tage++;
    herzen += 1 + (n >= z.minimum ? 1 : 0) + (n >= z.ziel ? 1 : 0);
    if (n >= z.stretch) sterne++;
  }
  return { herzen, sterne, tage };
}

/* Gruss nach Tageszeit. Nachts bewusst leise — das Ei soll abends nicht an
   offene Karten erinnern. */
const grussVon = (h) => h < 5 ? "Nanu, so spät noch" : h < 11 ? "Guten Morgen" : h < 14 ? "Hallo" : h < 18 ? "Hey" : h < 22 ? "Guten Abend" : "Psst";

/* Was das Ei heute schon bekommen hat: eins fuers Anfangen, eins fuers
   Minimum, eins fuers Tagespensum — dieselbe Rechnung wie fuer die Historie. */
/* Seit dem 12.08. abends exportiert: der Kreaturen-Chat (mk-chat.js) muss
   "Herzen heute" nennen koennen, und die Rechnung darf es NICHT ein zweites
   Mal geben. Zwei Stellen, die dieselbe Frage beantworten, beantworten sie
   irgendwann verschieden — dieselbe Falle wie bei Bild und Text am 12.08. */
export function herzenHeute(tz) {
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

   NACHKALIBRIERT AM 19.08.2026 (Jennifer: "waechst ein bisschen schnell").
   Die Rechnung oben unterstellt, dass Rose alle 2,5 Tage uebt. Sie uebt
   inzwischen fast taeglich (7 von 8 Tagen seit dem 12.08.) und sammelt so rund
   2,25 Herzen pro KALENDERtag statt pro anderthalb. Ihr Stand am 19.08.: 45
   Herzen, Stufe 6 — die Leiter waere am 21./22.08. durch gewesen, knapp vier
   Wochen vor der Klausur, und danach passiert nichts mehr.

   Darum sind NUR die beiden letzten Sprossen nach oben gerueckt:
     Stufe 7   48 -> 56   etwa der 24.08.
     Stufe 8   51 -> 68   etwa der 30.08. bis 04.09.

   Die Spanne bei Stufe 8 ist ehrlich und kein Rundungsfehler: herzenStand()
   rechnet die ganze Historie mit dem HEUTIGEN Tagesziel, und das steigt zur
   Klausur hin Richtung 100. Roses 18 Uebungstage sind bei Ziel 60 = 45 Herzen
   wert, bei Ziel 100 nur noch 39. Sie klettert also gegen eine langsam
   absackende Grundlinie an. Wer Stufe 8 verschiebt, muss das mitrechnen.

   0 BIS 6 BLEIBEN UNANGETASTET. Roses gesyncte mk.stufeMax steht auf 6, das
   ist der einzige je gespeicherte Index — an dem darf sich die Bedeutung nicht
   aendern (siehe Absatz unten). 7 und 8 hat noch nie jemand erreicht, deren
   Zahlen sind darum frei.

   WAS DAS KOSTET, offen notiert: zwischen Stufe 6 und 8 liegen jetzt zwei
   Abstaende von 12 statt 3 und 4 Herzen — gegen die Regel eine Zeile weiter
   oben. Ertragbar ist das nur, weil Stufe 7 ohnehin KEIN neues Bild hat:
   figurEbenen() liest von `sub` nur die Ohren und die Blob-Ahnung, "jung sub 0"
   und "jung sub 1" zeichnen dieselbe Katze. Der einzige echte Bild-Moment, der
   noch aussteht, ist erwachsen. Enger takten liesse sich das erst mit neuen
   Figuren (Zwischengroesse oder ein Merkmal fuer jung sub 1) — das ist
   Zeichenarbeit und Jennifers Entscheidung, keine Zahlenfrage.

   ANHAENGEN IST SICHER, UMSORTIEREN NICHT. mk.stufeMax speichert die hoechste
   je erreichte Stufe als INDEX und synct. Wird die Liste umsortiert, zeigt ein
   gespeicherter Wert auf ein anderes Bild — der Wert ueberlebt, seine Bedeutung
   nicht. Die Stufen 0/1/2 muessen darum die Ei-Stufen bleiben. */
const STUFEN = [
  { ab: 0,  art: "ei",   sub: 0, satz: "Ich bin einfach hier hingeploppt. Mal sehen, was aus mir wird." },
  { ab: 10, art: "ei",   sub: 1, satz: "Ich hab mich bewegt. Nur ein bisschen, aber ich hab." },
  { ab: 22, art: "ei",   sub: 2, satz: "Es knackt. Nicht erschrecken — ich glaub, es geht bald los." },
  { ab: 34, art: "blob", sub: 0, satz: "Oh. Hallo. Ich bin … irgendwas." },
  { ab: 37, art: "blob", sub: 1, satz: "Zwei Augen! Die waren gestern noch nicht da." },
  { ab: 41, art: "blob", sub: 2, satz: "Da wachsen Ohren. Ich glaub, ich werd was Bestimmtes." },
  { ab: 44, art: "jung", sub: 0, satz: "Jetzt sieht man's. Ich bin eine Katze." },
  { ab: 56, art: "halbwuechsig", sub: 0, satz: "Ich wachse noch. Aber ich weiß schon, wie du lernst." },
  { ab: 68, art: "erwachsen", sub: 0, satz: "Ausgewachsen. Ab jetzt sammeln wir zusammen." },
];
/* Die Stufe, bei der aus dem Ei ein Tier wird. Als Konstante, weil drei Stellen
   sie brauchen (Moment ausloesen, Bild waehlen, Test) und eine 3 im Code an der
   dritten Stelle niemand mehr zuordnet. */
export const SCHLUEPF_STUFE = 3;

/* Die Stufe, ab der der Laden aufgeht: die letzte. Abgeleitet und nicht als 8
   hingeschrieben, aus demselben Grund wie TIER_STUFE — wer die Leiter umbaut,
   soll das Tor nicht an einer zweiten Stelle nachziehen muessen.

   Dass es UEBERHAUPT die letzte Stufe ist, ist die Entscheidung vom 22.08.2026
   drueben im GE-Trainer, hier am 03.09.2026 uebernommen: STUFEN[8].satz sagt
   seit dem 13.08. "Ausgewachsen. Ab jetzt sammeln wir zusammen." — ein Satz,
   den der Code bis dahin nicht eingeloest hat, weil danach nichts mehr kam.
   Frueher aufzumachen wuerde den Schluepf-Moment ueberstrahlen.

   Rose steht hier am 03.09.2026 bereits auf Stufe 8 (83 ♥, 22 ★, live aus
   Supabase) — der Laden geht bei ihr also sofort auf. */
export const SHOP_STUFE = STUFEN.length - 1;

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
    "Du hast angefangen. Genau das zählt bei mir am meisten.",
    "Da ist mein erstes Herz heute. Angefangen ist das Schwerste.",
    "Oh, du bist da. Das reicht mir schon für heute.",
  ],
  // Minimum geschafft.
  mitte: [
    "Zwei Herzen heute. Das war schon ein richtiger Tag.",
    "Ich hab zwei bekommen. Von mir aus kannst du jetzt aufhören.",
    "Zwei. Und ich hab nicht mal was dafür tun müssen.",
  ],
  // Tagespensum voll.
  voll: [
    "Drei Herzen. Mehr kriege ich an einem Tag gar nicht.",
    "Das war alles, was heute ging. Ich bin satt.",
    "Voll. Ab jetzt übst du nur noch für dich, nicht für mich.",
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

/* Ab dieser Stufe sieht man, WAS es ist (STUFEN[6] ist die erste "jung"-Stufe).
   Als Konstante wie SCHLUEPF_STUFE, weil der Chat sie braucht und eine 6 im
   Code an einer vierten Stelle niemand mehr zuordnet. Vorher verraet die
   Kreatur ihre Tierart nicht — das ist der ganze Reiz des Wachsens. */
export const TIER_STUFE = 6;

/* Wie viele Herzen noch bis zur naechsten Stufe; null heisst ausgewachsen.
   blaseText() benutzt genau diese Funktion, damit die Blase und der Chat
   dieselbe Zahl sagen. Rein, kein Zugriff auf state oder Uhr. */
export function herzenBisNaechste(herzen, stufeMax) {
  const stufe = Math.min(Math.max(stufeVon(herzen), stufeMax || 0), STUFEN.length - 1);
  const naechste = STUFEN[stufe + 1];
  return naechste ? Math.max(0, naechste.ab - herzen) : null;
}

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
/* ---------- Einmal-Korrektur nach der Fokus-Woche (Jennifer, 21.08.2026) ----
   Am 21.08. hat herzenStand() (damals noch: ganze Historie am HEUTIGEN, in der
   Fokus-Woche halbierten Ziel gemessen) die Sperrklinke mit aufgeblaehten
   Werten gefuettert: gespeichert 56 ♥ / 16 ★ / Stufe 7 — der letzte ehrliche
   Stand war 46 ♥ / 5 ★ / Stufe 6 (Supabase-Zeile 1140, Abend des 20.08.).
   Jennifer: "ausnahmsweise auf OG resetten."

   Die gespeicherten Maxima ABSENKEN geht nicht: die Merge-Regel ist bewusst
   ein bedingungsloses Maximum, jede Absenkung kaeme beim naechsten Sync vom
   anderen Geraet zurueck. Darum kappt die ANZEIGE die Sperrklinke auf den
   letzten ehrlichen Stand: alles ueber der Kappung muss ehrlich neu verdient
   werden (dann traegt ohnehin der frisch gerechnete Stand, nicht die Klinke).
   Sobald Roses ehrlicher Stand ueber diesen Werten liegt, ist der Deckel
   wirkungslos und der Block kann ersatzlos weg. Die Werte in mk bleiben
   unangetastet — merge-sicher, kein Ping-Pong. */
const OG_KAPPUNG = { herzen: 46, sterne: 5, stufe: 6 };

export function stufeJetzt(herzen) {
  const mk = C.state().mk || (C.state().mk = {});
  const klinke = Math.min(mk.stufeMax || 0, OG_KAPPUNG.stufe);
  const stufe = Math.min(Math.max(stufeVon(herzen), klinke), STUFEN.length - 1);
  // save() schreibt NUR nach localStorage — der Push haengt an syncLernstand(),
  // und das laeuft sonst erst beim naechsten Anlass (Sitzung, Tabwechsel, Neustart).
  // Eine neu erreichte Stufe soll aber sofort auf dem anderen Geraet stehen, so wie
  // die zuletzt geuebten Sachen auch. syncBald buendelt das mit einer halben
  // Sekunde Verzoegerung, damit nicht jede Neuzeichnung einen Request ausloest.
  if (stufe > (mk.stufeMax || 0)) { mk.stufeMax = stufe; C.save(); C.syncBald(500); }
  return stufe;
}

/* ---------- Die zweite Sperrklinke: auch die ZAHL faellt nicht ----------
   stufeMax rettet das BILD, aber nicht die Zahl daneben. Dieselbe Ursache:
   herzenStand() rechnet die ganze Historie mit dem HEUTIGEN Tagesziel, und das
   steigt zur Klausur hin (ziel = restBedarf/restTage, geklemmt auf 60-100).
   Roses 18 Uebungstage am 19.08.2026, durchgerechnet:

     Ziel  60  ->  45 ♥  ·  8 ★      (minimum 25, Streckziel  80)
     Ziel  80  ->  42 ♥  ·  5 ★      (minimum 30, Streckziel 100)
     Ziel 100  ->  38 ♥  ·  2 ★      (minimum 40, Streckziel 130)

   Die STERNE sind der schlimmere Fall: das Streckziel waechst mit 1,25 schneller
   als das Tagesziel selbst, und aus acht Sternen werden zwei. Beide Zahlen
   stehen unverhandelt in der Blase ("45 ♥ · 8 ★ aus 18 Übungstagen") — sie
   sinken zu sehen, ohne etwas falsch gemacht zu haben, liest sich als Strafe.
   Genau das soll eine Belohnungswaehrung nie tun.

   Also dieselbe Antwort wie bei der Stufe: das einmal Erreichte bleibt. Zwei
   Felder, weil Herzen und Sterne unabhaengig voneinander kippen koennen.

   WAS DAS KOSTET, offen: steigt das Tagesziel, steht die Zahl kurz still,
   waehrend Rose weiteruebt — die neuen Herzen fuellen erst den Rueckstand auf.
   Pro 10 Punkte Tagesziel sind das 1 bis 2 Herzen, bei ~2,25 Herzen pro Tag
   also etwa ein flacher Tag je Stufe, ueber den ganzen Monat verteilt. Eine
   Zahl, die kurz steht, ist deutlich besser als eine, die rueckwaerts laeuft.

   tage wird NICHT gesperrt: die Zahl der Uebungstage kann gar nicht sinken.

   herzenStand() bleibt unangetastet und rein genug fuer die Testseite
   (aktOverride) — nur die App geht ueber standJetzt(). */
export function standJetzt(tz) {
  const st = herzenStand(tz);
  const mk = C.state().mk || (C.state().mk = {});
  // Sperrklinke mit OG-Kappung (siehe Kommentar an OG_KAPPUNG).
  const herzen = Math.max(st.herzen, Math.min(mk.herzenMax || 0, OG_KAPPUNG.herzen));
  const sterne = Math.max(st.sterne, Math.min(mk.sterneMax || 0, OG_KAPPUNG.sterne));
  // Nur schreiben, wenn wirklich etwas dazugekommen ist — sonst loest jede
  // Neuzeichnung einen Sync aus (dieselbe Regel wie bei stufeJetzt).
  if (herzen > (mk.herzenMax || 0) || sterne > (mk.sterneMax || 0)) {
    mk.herzenMax = herzen; mk.sterneMax = sterne; C.save(); C.syncBald(500);
  }
  return { herzen, sterne, tage: st.tage };
}

/* ==========================================================================
   DAS KONTO — und zwar ausdruecklich KEIN KONTOSTAND     (03.09.2026)
   ==========================================================================
   Herzen und Sterne wurden hier bis heute gezaehlt, angezeigt und nie
   ausgegeben: sie hatten keine Senke. Der Laden ist die Senke, und damit
   braucht es ein Konto. Die naheliegende Bauart waere eine Zahl, die beim Kauf
   sinkt. Genau die ist verboten, aus zwei unabhaengigen Gruenden.

   1. DIE REGEL (Archiv, 19.08.): "Sinken zu sehen, ohne etwas falsch gemacht
      zu haben, liest sich als Strafe — genau das darf eine Belohnungswaehrung
      nie." herzenMax und sterneMax sind Sperrklinken; sie duerfen nur steigen,
      sonst ist die ganze Uebung von standJetzt() hin.
   2. DER SYNC (core.js mergeIn): herzenMax und sterneMax werden mit
      bedingungslosem Math.max vereinigt. Wer sie als Waehrung benutzt und beim
      Kauf abzieht, bekommt beim naechsten Sync alles zurueckerstattet — und
      kann auf zwei Geraeten denselben Kauf zweimal machen.

   Also das Hausmuster: LOG = WAHRHEIT, STAND = ABGELEITET.

     C.state().mk.kaeufe = [ { id, was, preis: { herz, stern }, ts }, ... ]

   Ein anhaengendes Register. Es waechst nur, nichts wird je gestrichen.
   Guthaben ist die Differenz und wird NIE gespeichert:

     ♥ frei = herzenMax − Summe der Herz-Anteile
     ★ frei = sterneMax − Summe der Stern-Anteile

   Damit gibt es KEINE dritte Waehrung: herzenMax laeuft nach dem
   Erwachsenwerden einfach weiter hoch (bis zu 3 ♥ je Uebungstag, fuer immer),
   und was vorher die Leiter gefuettert hat, fuettert danach das Regal. Die
   Zahl in der Blase sinkt dadurch nie — nur das abgeleitete Guthaben tut es,
   und zwar genau dann, wenn Rose selbst etwas gekauft hat. Das ist der
   Unterschied zwischen "ausgeben" und "verlieren".

   EIN OFFENER PUNKT, DER HIER SICHTBAR WIRD: OG_KAPPUNG (oben) deckelt die
   ANZEIGE auf 46 ♥ / 5 ★. Roses ehrlicher Stand liegt am 03.09.2026 bei
   83 ♥ / 22 ★, der Deckel ist also laengst wirkungslos — herzenStand() rechnet
   jeden Tag an den Schwellen SEINES Tages und kann darum nicht mehr unter den
   einmal erreichten Wert fallen. Der Block koennte ersatzlos weg. Er bleibt
   trotzdem stehen, weil sein Wegfall Roses angezeigte Zahlen betrifft und das
   eine eigene Entscheidung ist, keine Nebenwirkung des Ladens. Wichtig ist nur:
   er kann das Guthaben allenfalls zu KLEIN machen, nie zu gross.

   DIE ID IST ABGELEITET, NICHT ZUFAELLIG: "kf:pet:kaefer". Eine Chat-Nachricht
   kann zweimal vorkommen, ein gekauftes Stueck nicht. Mit einer Zufalls-Id
   legen zwei Geraete, die offline dasselbe Pet kaufen, ZWEI Zeilen an — die
   Vereinigung behaelt beide, und Rose zahlt doppelt, ohne dass irgendwo ein
   Fehler auftaucht.

   DER UEBERZIEH-FALL, den es trotzdem gibt: zwei Geraete koennen offline
   VERSCHIEDENE Dinge von demselben Guthaben kaufen. Die Vereinigung addiert
   danach beide Preise gegen dieselbe Decke. Die Entscheidung dazu folgt aus
   der Regel oben: DIE VEREINIGUNG GEWINNT, EIN GEKAUFTES STUECK WIRD NIE
   ZURUECKGENOMMEN, UND DAS ANGEZEIGTE GUTHABEN KLEMMT BEI 0.

   Die Preise stehen im Katalog (geteilt-laden.js), nicht hier. kaufen() bekommt
   den Preis herein und schreibt ihn in die Zeile — der Kauf ist dadurch
   historisch: aendert jemand spaeter einen Preis, bleiben alte Kaeufe so teuer,
   wie sie waren. */
export const kaeufe = () => {
  const mk = C.state().mk;
  return (mk && Array.isArray(mk.kaeufe)) ? mk.kaeufe : [];
};

/* Die Id aus dem Stueck. EINE Stelle, damit Client und Merge nie verschiedene
   Schluessel bilden. */
export const kaufId = (was) => "kf:" + was;

/* Ob ein Stueck schon gekauft ist. Ueber `was`, nicht ueber die Id — dasselbe
   Ergebnis, aber lesbarer an der Aufrufstelle. */
export const besitzt = (was) => kaeufe().some((k) => k && k.was === was);

/* Was eine Kaufzeile gekostet hat. Der ST-Trainer hat den Laden erst am
   03.09.2026 bekommen und kennt darum nur die neue Form { herz, stern } — die
   Zahl-plus-waehrung-Form aus dem GE-Trainer wird trotzdem gelesen. Nicht aus
   Symmetrie: die beiden Trainer teilen sich geteilt-laden.js, und wer den
   Laden hier einmal aus einer GE-Kopie befuellt oder eine Zeile von Hand
   nachtraegt, soll nicht still 10 ♥ geschenkt bekommen. */
function kaufPreis(k) {
  if (!k) return { herz: 0, stern: 0 };
  if (typeof k.preis === "number") {
    if (!isFinite(k.preis) || k.preis < 0) return { herz: 0, stern: 0 };
    return k.waehrung === "stern" ? { herz: 0, stern: k.preis } : { herz: k.preis, stern: 0 };
  }
  const p = k.preis || {};
  return {
    herz: isFinite(p.herz) && p.herz > 0 ? p.herz : 0,
    stern: isFinite(p.stern) && p.stern > 0 ? p.stern : 0,
  };
}

const ausgegeben = () => kaeufe().reduce((summe, k) => {
  const p = kaufPreis(k);
  return { herz: summe.herz + p.herz, stern: summe.stern + p.stern };
}, { herz: 0, stern: 0 });

/* Guthaben, abgeleitet. Bei 0 geklemmt — siehe UEBERZIEH-FALL oben. Eine
   negative Zahl waere Strafe fuer etwas, das Rose nicht falsch gemacht hat. */
export function guthaben(stand) {
  const s = stand || { herzen: 0, sterne: 0 };
  const aus = ausgegeben();
  return {
    herz: Math.max(0, (s.herzen || 0) - aus.herz),
    stern: Math.max(0, (s.sterne || 0) - aus.stern),
  };
}

/* Kaufen. Gibt true zurueck, wenn wirklich eine Zeile entstanden ist.
   Bewacht wird HIER und nicht in der Oberflaeche: der Laden ruft es aus einem
   Knopf, und ein zweiter Klick waehrend des Neuzeichnens darf nicht doppelt
   abbuchen. Beide Waechter sind noetig — besitzt() gegen den Doppelklick,
   guthaben() gegen den Kauf ohne Deckung. */
export function kaufen(was, preis, stand) {
  if (!was || !preis) return false;
  const p = { herz: preis.herz || 0, stern: preis.stern || 0 };
  if (!isFinite(p.herz) || !isFinite(p.stern) || p.herz < 0 || p.stern < 0) return false;
  if (besitzt(was)) return false;
  const frei = guthaben(stand);
  // BEIDE Waehrungen muessen reichen. Ein Kombipreis, bei dem nur eine Haelfte
  // gedeckt ist, ist nicht bezahlbar — und darf auch nicht halb abgebucht
  // werden, sonst waeren Herzen weg und das Stueck trotzdem nicht da.
  if (frei.herz < p.herz || frei.stern < p.stern) return false;
  const mk = C.state().mk || (C.state().mk = {});
  if (!Array.isArray(mk.kaeufe)) mk.kaeufe = [];
  mk.kaeufe.push({ id: kaufId(was), was, preis: p, ts: Date.now() });
  // save() schreibt nur nach localStorage. Ein Kauf ist eine Entscheidung und
  // soll auf dem zweiten Geraet stehen, bevor Rose dort das naechste Mal aufmacht.
  C.save(); C.syncBald(500);
  return true;
}

/* ---------- Getragen wird ueber Wahlen ----------
   mk.pet, mk.getragen, mk.look, mk.hintergrund, mk.tier. Das sind keine
   Sammlungen, sondern WAHLEN — sie lassen sich nicht vereinigen, man muss sich
   entscheiden. Das einzig sinnvolle Kriterium ist der Zeitpunkt, genau wie bei
   mk.ei. Einheitliche Form { wert, ts }.

   Die Feldliste steht in core.js und wird von dort geholt: dort liegt die
   Merge-Regel, die sie durchlaeuft. Zwei Listen nebeneinander sind die Sorte
   Dopplung, die genau einmal auseinanderlaeuft und dann still eine Wahl
   verschluckt.

   Wechseln ist immer gratis — gekauft wird ein Stueck einmal, danach ist es
   eine Wahl und keine Ausgabe mehr. */
export const WAHL_FELDER = C.MK_WAHL_FELDER;

export function wahl(feld) {
  const w = C.state().mk && C.state().mk[feld];
  return w && typeof w === "object" ? w.wert : null;
}

export function waehle(feld, wert) {
  if (WAHL_FELDER.indexOf(feld) < 0) return;
  const mk = C.state().mk || (C.state().mk = {});
  mk[feld] = { wert, ts: Date.now() };
  C.save(); C.syncBald(500);
}

/* Das Outfit: { slot: { stueck, farbe }, ... }. Warum EIN Objekt und nicht
   eins je Slot, steht in core.js an MK_WAHL_FELDER — kurz: ein Outfit ist eine
   Wahl, keine Sammlung, und eine Vereinigung koennte nichts mehr ausziehen.

   Immer eine KOPIE schreiben, nie das gespeicherte Objekt veraendern. waehle()
   setzt einen neuen Zeitstempel, und ein an Ort und Stelle veraendertes Objekt
   waere schon vorher still in den alten Eintrag geflossen. */
export function outfit() {
  const o = wahl("getragen");
  return (o && typeof o === "object") ? o : {};
}

/* Ein Stueck an- oder ablegen. key falsy zieht den Slot aus.
   Die FARBE ueberlebt einen Wechsel des Stuecks bewusst NICHT: wer den Hut
   gegen die Krone tauscht, hat eine andere Sache am Kopf, und dass die die
   Farbe des Hutes erbt, waere eine Entscheidung, die niemand getroffen hat. */
export function anlegen(slot, key) {
  const o = { ...outfit() };
  if (!key) delete o[slot];
  else o[slot] = { stueck: key, farbe: (o[slot] && o[slot].stueck === key) ? o[slot].farbe : "standard" };
  waehle("getragen", o);
}

/* Umfaerben. Kostet nie etwas — der Farbtopf war der Kauf, das Auftragen ist
   eine Wahl. Auf einem leeren Slot passiert nichts. */
export function faerben(slot, farbKey) {
  const o = { ...outfit() };
  if (!o[slot]) return;
  o[slot] = { stueck: o[slot].stueck, farbe: farbKey };
  waehle("getragen", o);
}

/* Ob gerade das dunkle Blatt laeuft. NICHT die Uhrzeit: blaseText() nennt
   seine Variable auch "nacht", meint aber "nach 22 Uhr" und laesst davon ein
   Augenlid fallen. Der Hintergrund muss dagegen zum BLATT passen, sonst
   leuchtet mittags um zwei ein Nachthimmel in einer weissen Karte. Zwei
   verschiedene Fragen, die sich zufaellig gleich anhoeren.

   Die Einstellung kennt drei Zustaende (hell, dunkel, auto), das ATTRIBUT nur
   zwei: applyTheme() in main.js loest "auto" schon gegen das Betriebssystem auf
   und schreibt immer "hell" oder "dunkel" an das Wurzelelement. Hier also kein
   dritter Zweig und keine zweite matchMedia-Abfrage — die waere eine zweite
   Wahrheit, die beim naechsten Systemwechsel gegen die erste laeuft.
   Drueben im GE-Trainer steht dasselbe, nur andersherum gefragt: dort wird das
   Attribut bei dunkel ENTFERNT statt gesetzt. */
function nachtJetzt() {
  return document.documentElement.dataset.theme === "dunkel";
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
  { key: "herzchen", name: "Herzchen", fell: "#cf8fa0", muster: "#a4677a", akzent: "#f6e3ea", tinte: "#5b2f3c",
    regel: () => false, marken: [[2, 3, "♥"], [3, 7, "♥"], [4, 5, "♥"]],
    teaser: "Es ist leicht warm und klopft. Ganz leise, aber regelmäßig." },
  { key: "sternchen", name: "Sternchen", fell: "#ceae5e", muster: "#9c8240", akzent: "#fdf3d4", tinte: "#4e3f1c",
    regel: (z, sp) => (z + sp) % 5 === 0, marken: [[2, 6, "✦"], [4, 3, "✦"]],
    teaser: "Kühl wie ein Kieselstein, aber im Dunkeln sieht man es trotzdem." },
  { key: "gestreift", name: "Gestreift", fell: "#c3b596", muster: "#8b7f66", akzent: "#f2ece0", tinte: "#46402f",
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
/* Der Maler steht seit dem 03.09.2026 nicht mehr hier, sondern in
   geteilt-laden.js (Laden.malen) — dieselbe Bauart, nur zusaetzlich faehig,
   getragene Stuecke, Verlaeufe und Marken auf Fell zu faerben.

   Er stand in dieser Datei ZWEIMAL fast wortgleich (Ei und Tier). Mit
   Kleidung, Make-up und Pets waeren es fuenf geworden, und drueben im
   GE-Trainer noch einmal fuenf. Der Sonderfall "Marke braucht Fellhintergrund"
   stimmt jetzt an einer Stelle statt an zehn. */
export function eiHtml(variante, stufe) {
  const FARBE = { F: variante.fell, M: variante.muster, A: variante.akzent || variante.muster, R: "var(--mk-riss)" };
  return Laden.malen(eiEbenen(variante, stufe), FARBE);
}

/* ---------- Das Tier, ab Stufe 3 ----------
   Uebernommen aus der Werkstatt (playground/rose/maskottchen/figuren.js), damit
   Entwurf und App dieselbe Figur zeigen. Dort ist ST die Katze und GE der Hund.

   DURCHGEHEND BLOCKGRAFIK, seit 12.08.2026 nachmittags. Vorher war das Tier
   aus Strichzeichen (╭─╮│) und der Stilbruch zum Ei als Erzaehlung des
   Schluepfens gedacht. Jennifer hat sich fuer die Block-Aesthetik entschieden.
   Zwei Gruende, die dafuer sprechen:
     - Die Mini-Pets im spaeteren Shop sind gefuellte Blockgrafik. Neben einem
       Strich-Tier waere das gebrochen.
     - Die Tiere brauchen jetzt nur noch Blockzeichen. Die alten Gesichtszeichen
       (◉ ᵕ ‿) waren die einzigen, die auf Android in einen Ersatzfont fallen
       und die Zeile verschieben konnten.
   Der Riss im Ei bleibt bewusst Strichzeichen (╷ ╲ ╱), das gefaellt so besser.

   Was der Wechsel kostet: den Schluepf-Moment trug bisher der Stilwechsel.
   Jetzt traegt ihn die SILHOUETTE - aus einem hohen, oben schmalen Ei wird ein
   kleiner, breiter, flacher Blob mit Augen.

   Gefaerbt wie das Ei ueber eine Maske, mit denselben Farben der Variante -
   so bleibt das Tier erkennbar dasselbe Wesen wie das Ei davor. */

/* Alle Zellen, die als gefuellte Flaeche zaehlen. Wer hier ein Zeichen
   vergisst, macht es unsichtbar-FALSCH statt sichtbar kaputt: die Zelle
   bekommt keinen span und erbt die Textfarbe der Seite. */
const VOLL_TIER = "█▟▙▐▌▝▘▄▀";

/* Drei Groessen. Die Figur waechst in der BREITE - 9 Zellen als Blob, 11 als
   Jungtier, 13 erwachsen. Am Handy besser zu sehen als Wachstum in der Hoehe,
   und die Tagesziel-Karte bleibt dabei ruhig.

   Zwei Zahlen darin sind nicht willkuerlich:
     - AUGEN SIND ZWEI ZELLEN BREIT (ausser beim Blob, der ist zu klein dafuer).
       Eine Monospace-Zelle ist etwa doppelt so hoch wie breit; ein einzelnes
       Vollzeichen las sich als Schlitz, nicht als Auge.
     - ES GIBT EINE HELLE SCHNAUZE. Augen und Maul direkt auf der Fellflaeche
       lesen sich als Loecher im Tier statt als Gesicht. */
const KOERPER = {
  /* Der Zwischenschritt, 19.08.2026. Bis dahin zeichnete Stufe 7 dieselbe Katze
     wie Stufe 6 — figurEbenen() liest aus `sub` nur die Ohren und die
     Blob-Ahnung, "jung sub 0" und "jung sub 1" waren Pixel fuer Pixel gleich.
     Zwoelf Herzen lang passierte am Bild also nichts.

     WARUM HOEHER UND NICHT BREITER, obwohl der Absatz drueber die Breite zur
     Wachstumsachse erklaert: die Breite von erwachsen ist 13, und ein
     13-Zellen-Zwischenschritt sieht dem erwachsenen Tier bis auf eine Zeile und
     die zwei Brustmarken gleich. Der Reveal am Ende ist der Sinn der ganzen
     Leiter — der darf nicht eine Stufe zu frueh verraten werden. Erwachsen hat
     ohnehin schon 6 Zeilen; die Hoehe ist also keine neue Achse, sie kommt nur
     einen Schritt frueher. So traegt jeder der beiden letzten Momente genau
     eine sichtbare Aenderung: erst laenger, dann breiter (plus Brustmarke).

     Die Alternative (13x5, Breite zuerst) liegt im Archiv-Eintrag vom
     19.08.2026 — falls die Reihenfolge doch andersherum gewollt ist, sind es
     zwei Tabellen-Zeilen. */
  halbwuechsig: {
    zeilen: ["  ▄▄▄▄▄▄▄  ", " ▟███████▙ ", " ▐███████▌ ",
             " ▐███████▌ ", " ▐███████▌ ", " ▝▀▀▀▀▀▀▀▘ "],
    augen: [[2, 2], [2, 7]], augenBreit: 2,
    schnauze: [[4, 4], [4, 5], [4, 6]], maul: [[4, 5]], brust: [],
  },
  blob: {
    zeilen: ["  ▄▄▄▄▄  ", " ▟█████▙ ", " ▐█████▌ ", " ▐█████▌ ", " ▝▀▀▀▀▀▘ "],
    augen: [[2, 2], [2, 6]], augenBreit: 1, schnauze: [], maul: [[3, 4]], brust: [],
  },
  jung: {
    zeilen: ["  ▄▄▄▄▄▄▄  ", " ▟███████▙ ", " ▐███████▌ ", " ▐███████▌ ", " ▝▀▀▀▀▀▀▀▘ "],
    augen: [[2, 2], [2, 7]], augenBreit: 2, schnauze: [[3, 4], [3, 5], [3, 6]], maul: [[3, 5]], brust: [],
  },
  erwachsen: {
    zeilen: ["  ▄▄▄▄▄▄▄▄▄  ", " ▟█████████▙ ", " ▐█████████▌ ",
             " ▐█████████▌ ", " ▐█████████▌ ", " ▝▀▀▀▀▀▀▀▀▀▘ "],
    augen: [[2, 3], [2, 8]], augenBreit: 2,
    schnauze: [[4, 5], [4, 6], [4, 7]], maul: [[4, 6]], brust: [[3, 2], [3, 10]],
  },
};

/* Die Katze: zwei schmale Spitzen mittig auf dem Kopf. Drueben im GE-Trainer
   sitzt der Hund mit Schlappohren an den Seiten - die OHRENZEILE ist der ganze
   Unterschied zwischen den beiden Tieren, alles andere ist identisch. */
/* JEDE art braucht hier eine Zeile UND eine in KOERPER. Fehlt eine, ist es kein
   Fehler beim Laden, sondern ein undefined, das erst beim Zeichnen zuschlaegt —
   dieselbe Falle wie beim Fragen-Detektiv (siehe CLAUDE.md). halbwuechsig ist
   11 breit wie jung und bekommt darum dessen Ohrenabstand. */
const OHREN = { blob: ["  ▟▙ ▟▙  "], jung: ["  ▟▙   ▟▙  "],
  halbwuechsig: ["  ▟▙   ▟▙  "], erwachsen: ["  ▟▙     ▟▙  "] };

/* Eine Zelle setzen - Zeichen UND Farbschluessel zugleich, damit die beiden
   Ebenen nie auseinanderlaufen koennen. ch === null laesst das Zeichen stehen. */
function setzTier(zeilen, maske, z, sp, ch, k) {
  if (z < 0 || z >= zeilen.length) return;
  const a = zeilen[z].split(""), b = maske[z].split("");
  if (sp < 0 || sp >= a.length) return;
  if (ch !== null) a[sp] = ch;
  b[sp] = k;
  zeilen[z] = a.join(""); maske[z] = b.join("");
}

function figurEbenen(variante, stufe, nacht) {
  const st = STUFEN[stufe];
  const k = KOERPER[st.art];
  /* Erst Stufe 5 laesst die Ohren wachsen. Bis dahin soll offen bleiben, was
     daraus wird - das Raetsel haelt also drei Stufen laenger als bis zum
     Schluepfen. */
  const ohren = (st.art !== "blob" || st.sub >= 2) ? OHREN[st.art] : [];
  const hoch = ohren.length;
  const zeilen = ohren.concat(k.zeilen);

  /* OHRANSATZ SCHLIESSEN: die Kopf-Oberkante ist ein Halbblock und fuellt nur
     die untere Zellhaelfte, die Ohrenzeile darueber fuellt ihre Zelle ganz.
     Ohne das bliebe eine halbe Zelle Luft und die Ohren saehen aus wie
     aufgesetzte Schornsteine. */
  if (hoch) {
    const unten = zeilen[hoch - 1], kopf = zeilen[hoch].split("");
    for (let sp = 0; sp < unten.length; sp++) if (unten[sp] !== " " && kopf[sp] === "▄") kopf[sp] = "█";
    zeilen[hoch] = kopf.join("");
  }

  /* Das Muster der Schale wird zum Fell: dieselbe regel(), die das Ei zeichnet.
     Eier ohne Regel (Herzchen) tragen stattdessen ihre Marke auf der Brust. */
  const maske = zeilen.map((zeile, z) =>
    zeile.split("").map((ch, sp) => (VOLL_TIER.indexOf(ch) < 0 ? " " : variante.regel(z, sp) ? "M" : "F")).join(""));

  /* Frisch geschluepft hat es nur eine Ahnung von Augen: helle Flecken, noch
     keine Pupille, und noch kein Maul. */
  const ahnung = st.art === "blob" && st.sub < 1;
  if (!ahnung) k.schnauze.forEach((s) => setzTier(zeilen, maske, s[0] + hoch, s[1], null, "A"));

  /* Offenes Auge volle Zelle, nachts eine halbe: ein Lid, das faellt - und
     kein Sonderzeichen, das in einen Ersatzfont fallen koennte. */
  const augeCh = nacht ? "▄" : "█";
  k.augen.forEach((a) => {
    for (let i = 0; i < k.augenBreit; i++) {
      setzTier(zeilen, maske, a[0] + hoch, a[1] + i, ahnung ? "▄" : augeCh, ahnung ? "A" : "T");
    }
  });
  if (!ahnung) k.maul.forEach((m) => setzTier(zeilen, maske, m[0] + hoch, m[1], "▄", "T"));

  const marke = (variante.marken || [])[0];
  if (marke && st.art !== "blob") k.brust.forEach((b) => setzTier(zeilen, maske, b[0] + hoch, b[1], marke[2], "A"));

  /* DIE GEOMETRIE WANDERT MIT HERAUS, nicht nur die Zeichen. Kleidung und
     Make-up sitzen im Laden (geteilt-laden.js), und der kennt die
     Koerpertabelle oben nicht — er rechnet jede Position aus diesen vier
     Zahlen:

       breite    Zellen je Zeile
       ohrHoehe  Zeilen UEBER dem Koerperraster
       augen     [[zeile, spalte, breite], ...] in endgueltigen Koordinaten
       unten     Index der letzten Koerperzeile

     ohrHoehe ist hier `hoch`: die Katze traegt ihre Spitzen auf einer eigenen
     Zeile ueber dem Kopf, der Hund im GE-Trainer seine Schlappohren NEBEN dem
     Kopf und liefert darum 0. Genau dieser eine Unterschied ist der Grund,
     warum die Zahl mitkommen muss, statt im Laden zu stehen — sonst sitzt der
     Hut bei einem der beiden Tiere in der Luft. Und `hoch` ist nicht konstant
     1: bis Stufe 4 hat der Blob noch keine Ohren.

     augenBreit wird hier aufgeloest: der Laden soll nicht wissen muessen, dass
     ein Blob einzellige Augen hat und alles andere zweizellige.

     maul und schnauze kamen am 04.09.2026 dazu, wegen genau einem Satz von
     Jennifer: "bei lippen verliert er die nase". Der Lippenstift suchte sich
     das Maul ueber die MASKE (die einzige Tinte-Zelle unter den Augen) und
     faerbte es um — damit war der dunkle Fleck weg, der als Nase gelesen wird.
     Jetzt bekommt der Laden beides benannt und legt die Lippen NEBEN die Nase.

     Ein Blob hat weder Schnauze noch Brustmarke; die Listen sind dann leer. */
  return {
    zeilen, maske,
    breite: zeilen[0].length,
    ohrHoehe: hoch,
    augen: k.augen.map((a) => [a[0] + hoch, a[1], k.augenBreit]),
    maul: (k.maul || []).map((m) => [m[0] + hoch, m[1]]),
    schnauze: (k.schnauze || []).map((x) => [x[0] + hoch, x[1]]),
    unten: zeilen.length - 1,
  };
}

/* opt ist optional und beschreibt, was die Figur traegt:

     { look: "cyber", getragen: { kopf: { stueck: "hut", farbe: "gold" }, ... } }

   OHNE opt zeichnet die Funktion exakt das, was sie vor dem Laden gezeichnet
   hat. Das ist kein Zufall, sondern die Bedingung dafuer, dass dieser Umbau
   niemandem etwas kaputt macht: es gibt Aufrufer (Schluepf-Moment, Ankunft,
   KI-Blase), die von Kleidung nichts wissen und auch nichts wissen sollen. */
export function figurHtml(variante, stufe, nacht, opt) {
  const o = opt || {};
  const farben = Laden.farbenFuer(variante, o.look);
  let e = figurEbenen(variante, stufe, nacht);
  if (o.getragen) e = Laden.anziehen(e, o.getragen);
  return Laden.malen(e, Laden.farbTabelle(farben, o.getragen));
}

/* Das Bild zur Stufe — Ei oder Tier, eine Entscheidung an einer Stelle.
   Das Ei traegt nichts. Nicht aus Bequemlichkeit: der Laden geht erst auf der
   letzten Stufe auf, ein Ei mit Hut kann es also gar nicht geben. Der Zweig
   ist trotzdem hier und nicht beim Aufrufer, damit die Testseite alle neun
   Stufen durchgehen kann, ohne selbst zu unterscheiden. */
export const bildHtml = (variante, stufe, nacht, opt) =>
  stufe < SCHLUEPF_STUFE ? eiHtml(variante, stufe) : figurHtml(variante, stufe, nacht, opt);

/* Die Mini-Pets liegen im geteilten Katalog: sie sind in beiden Trainern
   Zeichen fuer Zeichen dieselben. lookKey faerbt sie mit — ein Neon-Kaetzchen
   neben einer erdfarbenen Maus saehe aus wie ein Fehler statt wie eine
   Entscheidung. */
export const PETS = Laden.PETS;
export const petHtml = (key, lookKey) => Laden.petHtml(key, lookKey);

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
  const bis = herzenBisNaechste(herzen, stufeMax);
  const nacht = stunde >= 22 || stunde < 6;
  return {
    stufe, nacht,
    gruss: grussVon(stunde),
    satz: satzVon(stufe, hh, nacht),
    meta: `<b>${herzen}</b> ♥${sterne ? ` · <b>${sterne}</b> ★` : ""} aus ${tage} Übungstagen — ` +
      // Auf der letzten Stufe gibt es kein "bis es weitergeht" mehr. Frueher stand
      // hier "gleich passiert was" — das war als Platzhalter gedacht und wurde nie
      // erreicht, weil die Leiter nur drei Stufen hatte. Jetzt wird sie erreicht.
      (bis == null ? "ausgewachsen" : `noch <b>${bis}</b> ♥ bis es weitergeht`) + "." +
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

/* ---------- Einstieg in den Kreaturen-Chat ----------
   Rose tippt das Maskottchen an, das Sheet geht auf. Damit man das ueberhaupt
   findet, sitzt eine kleine Sprechblase am Bild (CSS .mk-chat-knopf::after)
   und beim ersten Mal steht ein Satz daneben.

   Der Merker "schon mal geoeffnet" liegt GERAETELOKAL in localStorage und
   ausdruecklich nicht in state().mk. Er ist kein Lernstand, und alles, was in
   den Snapshot wandert, muesste auch durch den Merge — dafuer ist ein Hinweis
   zu klein.

   Warum initChat() statt eines vierten Parameters an binde(): gezeichnet wird
   VOR dem Binden. Haengte der Knopf an binde(), fehlte er beim ersten Aufbau
   der Startseite und erschiene erst beim naechsten Neuzeichnen. Dasselbe
   Muster benutzt llm.js fuer seinen Fragenchat. */
const CHAT_GESEHEN = "st-mk-chat-gesehen";
let chatAufFn = null;
let chatNeu = false;
try { chatNeu = !localStorage.getItem(CHAT_GESEHEN); } catch (e) { chatNeu = false; }

export function initChat(fn) { chatAufFn = typeof fn === "function" ? fn : null; }

/* Wird beim ersten Oeffnen gerufen — danach verschwindet die Einladung, die
   Sprechblase am Bild bleibt. */
export function chatGesehen() {
  chatNeu = false;
  try { localStorage.setItem(CHAT_GESEHEN, "1"); } catch (e) { /* egal */ }
}

/* Ein Wortlaut fuer Knopf-Label und Sheet-Ueberschrift. Was es IST, verraet er
   erst ab TIER_STUFE — vorher waere die Ueberschrift ein Spoiler auf das,
   worauf das ganze Wachsen hinauslaeuft. */
export function chatTitel(stufe) {
  if (stufe < SCHLUEPF_STUFE) return "Mit deinem Ei reden";
  if (stufe < TIER_STUFE) return "Mit deinem Begleiter reden";
  return "Mit deiner Katze reden";
}

/* Die Stufe, die JETZT gilt — inklusive Sperrklinke. Eigene Funktion, weil
   html() und standHtml() sie beide brauchen und zwei Rechnungen zwei Wahrheiten
   waeren (dieselbe Falle wie bei Bild und Text am 12.08.). */
function aktuelleStufe(tz) {
  return stufeJetzt(standJetzt(tz).herzen);
}

function standHtml(tz) {
  const st = standJetzt(tz);
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
  // Das Bild bleibt aria-hidden — Blockgrafik ist fuer einen Screenreader
  // Zeichensalat. Das Label traegt der Knopf drumherum.
  /* Ab hier traegt die Figur, was Rose im Laden ausgesucht hat. Look und Outfit
     NUR ab SHOP_STUFE — nicht als Sperre, sondern als Aufraeumen: wer den Laden
     noch nie offen hatte, kann nichts angezogen haben. Wichtiger ist der
     umgekehrte Fall: liefe ein gesyncter Stand mit unbekannten Schluesseln hier
     durch, bliebe die Figur trotzdem heil — anziehen() zeichnet nur, was es kennt. */
  const traegtWas = stufe >= SHOP_STUFE ? { look: wahl("look"), getragen: outfit() } : null;
  const pre = `<pre class="mk-ei${anim}" aria-hidden="true">${bildHtml(v, stufe, t.nacht, traegtWas)}</pre>`;
  const titel = chatTitel(stufe);
  // NUR hier, in der ruhigen Ansicht. Ankunft und Schluepfen sind Momente, die
  // genau einmal stattfinden; dort darf nichts damit konkurrieren.
  const bild = chatAufFn
    ? `<button type="button" class="mk-chat-knopf${chatNeu ? " neu" : ""}" data-mk-chat aria-label="${titel}" title="${titel}">${pre}</button>`
    : pre;

  /* Das Pet sitzt NEBEN der Figur — und dafuer braucht es einen eigenen kleinen
     Hof, statt einfach ein drittes Kind von .mk-zeile zu sein: die Zeile ist
     flex mit flex-wrap, ein drittes Kind bricht bei 360 px um und das Pet saesse
     allein unter dem Text. Der Hof wird NUR gebaut, wenn wirklich eins da ist —
     solange nicht, ist der DOM Zeichen fuer Zeichen der alte.

     Absichtlich NICHT in den Chat-Knopf hinein: das Pet ist kein Ausloeser, und
     ein Screenreader soll den Knopf nicht als etwas anderes ankuendigen, nur
     weil eine Maus daneben sitzt. */
  const petKey = wahl("pet");
  const petAn = petKey && besitzt("pet:" + petKey) && stufe >= SHOP_STUFE;
  const mitPet = petAn
    ? `<div class="mk-figur-hof">${bild}<pre class="mk-pet${REDUCE_MOTION ? "" : " mk-atmet"}" aria-hidden="true">${petHtml(petKey, wahl("look"))}</pre></div>`
    : bild;

  /* Der Hintergrund ist eine CSS-Ebene DAHINTER, kein gezeichnetes Feld: die
     Figur ist Blockgrafik in einem <pre>, ein gemalter Hintergrund muesste in
     dieselben Zellen und wuerde jede Silhouette auffressen.
     nachtJetzt() und nicht t.nacht — t.nacht heisst "nach 22 Uhr" und laesst
     ein Augenlid fallen. Hier geht es um das BLATT, nicht um die Uhr. */
  const hgKey = stufe >= SHOP_STUFE ? wahl("hintergrund") : null;
  const hgStil = hgKey && besitzt(Laden.stueckId("hintergrund", hgKey))
    ? Laden.hintergrundStil(hgKey, nachtJetzt()) : null;
  // Die Klassen tragen die BEWEGTEN Ebenen (Sterne, Schnee). Sie lassen sich
  // nicht als Farbwert ausdruecken - ein Verlauf funkelt nicht.
  const mitHg = hgStil
    ? `<div class="${("mk-hintergrund " + Laden.hintergrundKlassen(hgKey, nachtJetzt())).trim()}" style="background-image:${hgStil}">${mitPet}</div>`
    : mitPet;

  return `<div class="mk-zeile">
    ${mitHg}
    <div class="mk-text">
      <p class="mk-satz"><b>${t.gruss}.</b> ${t.satz}</p>
      <p class="mk-meta">${t.meta}</p>
      ${chatAufFn && chatNeu ? `<p class="mk-chat-einladung">Tipp mich an, wenn du reden magst.</p>` : ""}
      <!-- Der Einstieg in den Laden, und zwar erst ab der letzten Stufe. DARUNTER
           IST HIER NICHTS: kein Knopf, kein grauer Teaser, kein "bald". Eine
           Auslage, die man noch nicht betreten kann, ist genau die Bauart, die
           dieser Laden nicht haben soll — und sie wuerde den Schluepf-Moment
           ueberstrahlen, auf den die ganze Leiter zulaeuft. -->
      ${stufe >= SHOP_STUFE ? `<div class="mk-wechsel"><button type="button" class="mk-link" data-mk-shop>Was du dir leisten kannst</button></div>` : ""}
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
/* Der zuletzt gezeichnete Tagesplan. binde() bekommt ihn NICHT herein (die
   Signatur ist alt und wird von mehreren Stellen gerufen), der Laden braucht
   ihn aber: standJetzt() rechnet die Herzen gegen den Plan, und der ist
   geraetelokal. Hier gemerkt statt durchgereicht — html() und binde() laufen
   im selben Zug, html() immer zuerst.

   Wenn er ausnahmsweise fehlt, faellt standJetzt() auf die Rechnung ohne Plan
   zurueck; das ist eine kleinere Zahl, nie eine groessere. Ein Laden, der
   kurz aermer aussieht, ist besser als einer, der Guthaben erfindet. */
let letzterTz = null;

export function html(tz) {
  letzterTz = tz;
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
/* ==========================================================================
   DER LADEN — Huelle, Tastatur, Fokus
   ==========================================================================
   Der INHALT kommt aus geteilt-laden.js: die Oberflaeche ist in beiden
   Trainern dieselbe, nur der Zustand darunter nicht. Was hier bleibt, haengt
   am Trainer — die Huelle, die Escape-Taste, der Fokus und der ADAPTER.

   Zwei kleine Helfer statt eines Imports: der ST-Trainer baut seine Ansichten
   als HTML-Strings und hat darum kein el()/knopf() wie der GE-Trainer. Der
   Laden ist ein Overlay an document.body und muss echtes DOM bauen; die beiden
   Zeilen hier sind billiger als ein neuer geteilter Baustein. */
const el = (tag, klasse, text) => {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text != null) e.textContent = text;
  return e;
};
const knopf = (text, klasse, aktion) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = klasse;
  b.textContent = text;
  b.onclick = aktion;
  return b;
};

let offenerShop = null;
let shopTaste = null;

/* Exportiert, damit es von aussen zugemacht werden kann (Ansichtswechsel,
   Neustart einer Runde) — ein Sheet, das ueber einer Seite haengengeblieben
   ist, die es nicht mehr gibt, ist schlimmer als eins, das zu frueh zugeht. */
export function shopSchliessen() {
  if (shopTaste) { document.removeEventListener("keydown", shopTaste); shopTaste = null; }
  if (offenerShop && offenerShop.parentNode) offenerShop.parentNode.removeChild(offenerShop);
  offenerShop = null;
}

export function shopOeffnen(tz, neu) {
  shopSchliessen();

  const ov = el("div", "mk-shop-ov");
  const blatt = el("div", "shop-blatt");
  blatt.setAttribute("role", "dialog");
  blatt.setAttribute("aria-modal", "true");
  blatt.setAttribute("aria-label", "Der Laden");
  blatt.setAttribute("tabindex", "-1");
  ov.appendChild(blatt);

  // Abmelden erledigt shopSchliessen() fuer JEDEN Weg (Knopf, Klick daneben,
  // Escape, Aufruf von aussen) — hier wird nur angemeldet.
  const schliesse = () => shopSchliessen();
  shopTaste = (e) => { if (e.key === "Escape") { e.preventDefault(); schliesse(); } };
  ov.addEventListener("click", (e) => { if (e.target === ov) schliesse(); });
  document.addEventListener("keydown", shopTaste);


  /* ERST anhaengen, DANN fuellen. Die Reihenfolge ist nicht Geschmack:
     blattFuellen() setzt am Ende den Fokus auf das Blatt, und focus() auf einem
     Element, das noch nicht im Dokument haengt, tut schlicht nichts — die
     Tastatur bliebe hinter dem Sheet auf der Seite darunter, und Escape ginge
     ins Leere. */
  document.body.appendChild(ov);
  offenerShop = ov;

  /* Die Stufe wird EINMAL beim Oeffnen gerechnet, nicht je Kachel.
     standJetzt() laeuft ueber herzenStand(), und das geht durch den ganzen
     antwortLog — bei Rose rund 2600 Eintraege. Der Laden zeichnet ~30
     Kacheln, jede mit einer eigenen Figur, und zeichnet sich bei JEDEM
     Antippen neu. Je Kachel gerechnet waeren das 78 000 Eintraege pro
     Farbtipp, auf ihrem Handy.

     Einmal rechnen ist hier nicht nur billiger, sondern auch richtiger: der
     Laden geht erst auf der LETZTEN Stufe auf, sie kann sich also gar nicht
     mehr aendern, solange das Blatt offen ist. Und Antworten entstehen
     waehrenddessen keine. Der KAUF prueft trotzdem gegen den Stand von jetzt
     (siehe kaufen unten) — das Sheet kann lange offen liegen. */
  var stufeImLaden = stufeJetzt(standJetzt(tz).herzen);

  Laden.blattFuellen(blatt, {
    stand: () => standJetzt(tz),
    guthaben,
    besitzt,
    // Der Preis wird gegen den Stand von JETZT geprueft, nicht gegen den vom
    // Oeffnen — das Sheet kann lange offen liegen.
    kaufen: (was, preis) => kaufen(was, preis, standJetzt(tz)),
    wahl, waehle, outfit, anlegen, faerben,
    figur: (opt) => bildHtml(EIER[eiIndex()], stufeImLaden, false, opt),
    pet: petHtml,
    nacht: nachtJetzt,
    schliessen: schliesse,
    el, knopf,
    neu: typeof neu === "function" ? neu : null,
  });
  return ov;
}

export function binde(wurzel, neuZeichnen, feiern) {
  // Kreaturen-Chat. Das Sheet haengt an document.body (siehe
  // geteilt-maskottchen-chat.js) und ueberlebt damit ein Neuzeichnen der Karte.
  // Neu gezeichnet wird trotzdem, aber ERST danach: die Einladung soll beim
  // naechsten Aufbau weg sein, ohne dass sie unter dem offenen Sheet
  // wegzuckt.
  wurzel.querySelectorAll("[data-mk-chat]").forEach((b) => b.onclick = () => {
    if (!chatAufFn) return;
    const warNeu = chatNeu;
    chatGesehen();
    chatAufFn();
    if (warNeu) neuZeichnen();
  });
  // Der Laden. Das Sheet haengt wie das Chat-Sheet an document.body und
  // ueberlebt damit ein Neuzeichnen der Karte; neuZeichnen wird ihm als
  // Rueckruf mitgegeben, weil nach einem Kauf die Karte darunter nicht mehr
  // stimmt (dort sitzen Figur, Pet und Hintergrund).
  wurzel.querySelectorAll("[data-mk-shop]").forEach((b) => b.onclick = () => {
    shopOeffnen(letzterTz, neuZeichnen);
  });
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
