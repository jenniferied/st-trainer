// ============ Lehrerzimmer — der Story-Modus (Jennifer, 13.08.2026) ============
//
// Eine durchlaufende Geschichte in fuenf Kapiteln, 42 Szenen, streng linear.
// Jede Szene rahmt EINE Frage aus dem normalen Korpus: Text davor, Beat danach,
// Kommentar zur Aufloesung. Die Frage selbst, ihre Optionen und ihre Erklaerungen
// kommen unveraendert aus dem Pool (C.frage) — dieses Modul kennt keine Loesungen.
//
// Drei Dinge, die man beim Aendern wissen muss:
//
// 1. FRAGEN WERDEN NICHT DUPLIZIERT. data/story.json enthaelt nur qid-Zeiger.
//    Wird eine Loesung in fragen/verified/ korrigiert, zieht die Story mit.
//    Das ist auch der Grund, warum die Abdeck-Regel (CLAUDE.md Z. 77) hier nicht
//    verletzt ist: deckt man die Szene ab, ist die Frage unveraendert dieselbe.
//
// 2. DER LEITNER BLEIBT UNBERUEHRT. Die Szenen sind fuer den Erzaehlfluss
//    bewusst leicht gewaehlt. Der Ausschluss sitzt NICHT hier, sondern in
//    core.js (werteAus + rebuildLeitner, beide auf C.STORY_MODUS). Hier wird nur
//    mit modus: "story" geloggt — wer das Wort aendert, muss core.js mitnehmen.
//
// 3. DER FORTSCHRITT IST ABGELEITET. Kein eigenes State-Feld, keine Zeile in
//    snapshot()/signatur(): C.storyStand() liest aus dem antwortLog, welche
//    Szenen schon dran waren. Das synct huckepack mit den Antworten.

import * as C from "./core.js";
import * as Beleg from "./beleg.js";

const app = () => document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const REDUCE_MOTION = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

// Szenentext: Absaetze aus \n\n, Zeilenumbrueche innerhalb bleiben. Erst escapen,
// dann Struktur setzen — nie andersherum, sonst haengt Roher HTML im Text.
const prosa = (s) => esc(s).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");

// Dasselbe, aber mit klickbaren Belegen (§, Art., Folie N). Beleg.render()
// escapet SELBST — der rohe Absatz muss also einzeln durch, und die Absatz-Tags
// kommen erst danach. Wer hier prosa() vorschaltet, bekommt sichtbare <p> im Text
// (genau so ist es beim ersten Durchlauf am 13.08. passiert).
const prosaBeleg = (s, thema) => String(s ?? "").split(/\n{2,}/)
  .map((p) => `<p>${Beleg.render(p, thema).replace(/\n/g, "<br>")}</p>`).join("");

// Reaktions-Sticker wie in main.js/spiele.js — dieselben Assets, dieselbe Regel:
// nie haemisch. Der eigentliche "Reward" des Modus ist der Story-Beat, der
// Sticker ist nur die Randnotiz daneben.
const STICKER = {
  good: ["pepe_drool", "troll_grin", "patrick_happy", "laugh_cam", "happy_dog", "laughcry", "rat_dance", "kitten_lift"],
  part: ["emoji_eye", "seal_blob", "patrick_slime", "monkey_side", "cat_grass", "fish_drink"],
  sanft: ["praying_cat", "pat_pat", "kitten_braces", "kitten_suit", "sad_hamster", "teary_cat"],
};
// Eigene Bilder haben Vorrang, wenn es sie gibt: assets/story/<name>.<ext> wird
// ueber data/story-bilder.json angemeldet (optional). Fehlt die Datei, laufen die
// normalen Reaktions-Sticker — der Modus funktioniert ohne Bilder vollstaendig.
let EIGENE = null;
export async function ladeBilder() {
  try {
    const r = await fetch("data/story-bilder.json");
    EIGENE = r.ok ? await r.json() : null;
  } catch { EIGENE = null; }
  return EIGENE;
}
function sticker(cls) {
  const eigen = EIGENE?.[cls];
  if (eigen?.length) {
    const n = eigen[Math.floor(Math.random() * eigen.length)];
    return `<img class="sticker" src="assets/story/${esc(n)}" alt="" loading="lazy">`;
  }
  const arr = STICKER[cls] || STICKER.part;
  const n = arr[Math.floor(Math.random() * arr.length)];
  return `<img class="sticker" src="assets/reactions/${n}.${REDUCE_MOTION ? "png" : "webp"}" alt="" loading="lazy">`;
}

let zurueckHome = null;   // Ruecksprung, von main.js gesetzt
let L = null;             // laufendes Kapitel: { kap, i, t0 }

export const verfuegbar = () => !!C.story();

// ---------- Uebersicht ----------

export function oeffne(zurueck) {
  if (zurueck) zurueckHome = zurueck;
  const st = C.storyStand();
  const kapitel = C.story()?.kapitel || [];

  const karten = kapitel.map((k) => {
    const fertig = k.szenen.filter((s) => st.fertig.has(s.qid)).length;
    const zustand = fertig === 0 ? "offen" : fertig < k.szenen.length ? "dran" : "fertig";
    // Kapitel sind der Reihe nach dran: das erste unfertige ist das aktive.
    return { k, fertig, zustand };
  });
  const aktivIdx = Math.max(0, karten.findIndex((x) => x.zustand !== "fertig"));

  app().innerHTML = `<div class="fade-in">
    <div class="topbar"><button class="back" id="back">‹</button><h1>☕ Lehrerzimmer</h1></div>
    <div class="card story-intro">
      <p class="muted" style="margin-top:0">Eine Geschichte in fünf Kapiteln. Jede Szene stellt dir eine echte Klausurfrage — richtig oder falsch, die Geschichte geht weiter. Zählt für deinen Tagesstand, aber nicht für den Lernstand: hier darfst du einfach lesen.</p>
      <div class="story-fort"><span class="bar thin"><i style="width:${st.gesamt ? (100 * st.n) / st.gesamt : 0}%"></i></span><span>${st.n}/${st.gesamt}</span></div>
    </div>
    ${karten.map(({ k, fertig, zustand }, i) => `
      <button class="mode-card wide story-kap ${zustand}${i === aktivIdx ? " aktiv" : ""}" data-kap="${k.nr}">
        <b>${k.nr}. ${esc(k.kapitelTitel)}</b>
        <span>${esc(k.vorspann)}</span>
        <span class="story-meta">${fertig}/${k.szenen.length} Szenen${zustand === "fertig" ? " · durch" : ""}</span>
      </button>`).join("")}
    ${st.n >= st.gesamt && st.gesamt ? `<div class="card"><p style="margin:0">Durch. Alle 42 Szenen. Du kannst jedes Kapitel nochmal lesen — die Antworten zählen dann nicht doppelt.</p></div>` : ""}
  </div>`;

  document.getElementById("back").onclick = () => zurueckHome && zurueckHome();
  app().querySelectorAll("[data-kap]").forEach((b) => b.onclick = () => starteKapitel(+b.dataset.kap));
}

function starteKapitel(nr) {
  const kap = (C.story()?.kapitel || []).find((k) => k.nr === nr);
  if (!kap) return oeffne();
  const st = C.storyStand();
  // Beim Wiedereinstieg dort weitermachen, wo es aufhoerte — aber nur, wenn das
  // Kapitel angefangen und nicht durch ist. Ein durchgelesenes faengt vorn an.
  const offen = kap.szenen.findIndex((s) => !st.fertig.has(s.qid));
  L = { kap, i: offen < 0 ? 0 : offen, t0: 0 };
  zeigSzene();
}

// ---------- Szene ----------

function zeigSzene() {
  const s = L.kap.szenen[L.i];
  const q = C.frage(s.qid);
  if (!q) return naechste();          // Fangnetz: Frage verschwunden -> Szene ueberspringen

  // Optionen jedes Mal frisch mischen, wie in den Uebungsmodi
  const order = C.shuffle(q.optionen.map((_, i) => i));

  app().innerHTML = `<div class="fade-in story-lauf">
    <div class="q-progress">
      <button class="back" id="raus">‹</button>
      <span class="bar thin"><i style="width:${(100 * L.i) / L.kap.szenen.length}%"></i></span>
      <span>${L.i + 1}/${L.kap.szenen.length}</span>
      <span class="story-kaptitel">${L.kap.nr}. ${esc(L.kap.kapitelTitel)}</span>
    </div>
    <div class="card story-szene">${prosa(s.vor)}</div>
    <div class="card">
      <div class="q-head"><span class="q-pts">${q.maxPunkte} P.</span></div>
      <div class="q-text">${esc(q.frage)}</div>
      <div class="answers" id="answers">
        ${order.map((oi) => `<label class="ans"><input type="checkbox" data-oi="${oi}"><span>${esc(q.optionen[oi].text)}</span></label>`).join("")}
      </div>
      <div id="fbzone"></div>
      <div class="btn-row mt">
        <button class="btn" id="pruefen">Antwort prüfen</button>
        <button class="btn secondary hidden" id="weiter">${L.i + 1 === L.kap.szenen.length ? "Kapitel abschließen" : "Weiter"}</button>
      </div>
    </div></div>`;

  L.t0 = Date.now();
  document.getElementById("raus").onclick = () => oeffne();
  const pruefen = document.getElementById("pruefen");
  pruefen.onclick = () => {
    const gewaehlt = [...app().querySelectorAll("#answers input:checked")].map((x) => +x.dataset.oi);
    pruefen.classList.add("hidden");
    loese(s, q, gewaehlt);
    document.getElementById("weiter").classList.remove("hidden");
  };
  document.getElementById("weiter").onclick = naechste;
}

function loese(s, q, gewaehlt) {
  const erg = C.scoreFrage(q, gewaehlt);
  const zeit = Math.round((Date.now() - L.t0) / 1000);

  // Loggen wie ein Spiel: eigene Pseudo-Session, damit es im Verlauf als
  // Einzelantwort auftaucht. modus "story" ist der Marker, an dem core.js den
  // Leitner-Ausschluss festmacht — nicht umbenennen ohne core.js.
  C.logAntwort({ qid: q.id, sid: "story", modus: C.STORY_MODUS, gewaehlt, punkte: erg.punkte, max: q.maxPunkte, voll: erg.voll, zeit });

  // Faerben + kuratierte Erklaerungen, wie im normalen Uebungsmodus
  app().querySelectorAll("#answers label.ans").forEach((el) => {
    const oi = +el.querySelector("input").dataset.oi;
    const o = q.optionen[oi], gw = gewaehlt.includes(oi);
    el.querySelector("input").disabled = true;
    if (gw && o.richtig) el.classList.add("correct");
    else if (gw && !o.richtig) el.classList.add("wrong");
    else if (!gw && o.richtig) el.classList.add("missed");
    if (o.erklaerung && (gw || o.richtig))
      el.insertAdjacentHTML("afterend", `<div class="explain ${o.richtig ? "good" : "bad"}">${Beleg.render(o.erklaerung, q.oberthema)}</div>`);
  });

  // Der eigentliche Reward: der Beat. Voll richtig -> beatRichtig, sonst
  // beatFalsch. Teilpunkte zaehlen bewusst als "nicht ganz" — die Geschichte
  // soll auf ein klares Ereignis reagieren, nicht auf eine Punktzahl.
  const cls = erg.voll ? "good" : erg.punkte > 0 ? "part" : "sanft";
  const beat = erg.voll ? s.beatRichtig : s.beatFalsch;
  document.getElementById("fbzone").innerHTML = `
    <div class="story-beat ${erg.voll ? "gut" : "weich"}">
      <div class="story-beat-kopf">${sticker(cls)}<span>${erg.voll ? `Voll richtig · +${erg.punkte} P.` : erg.punkte > 0 ? `Teilweise · ${erg.punkte} von ${q.maxPunkte} P.` : "Diesmal nicht"}</span></div>
      ${prosaBeleg(beat, q.oberthema)}
    </div>
    ${s.kommentar ? `<div class="story-komm">${prosaBeleg(s.kommentar, q.oberthema)}</div>` : ""}`;
}

function naechste() {
  if (L.i + 1 < L.kap.szenen.length) { L.i++; return zeigSzene(); }
  abschluss();
}

function abschluss() {
  const kap = L.kap;
  const naechstes = (C.story()?.kapitel || []).find((k) => k.nr === kap.nr + 1);
  L = null;
  app().innerHTML = `<div class="fade-in">
    <div class="topbar"><button class="back" id="back">‹</button><h1>Kapitel ${kap.nr} durch</h1></div>
    <div class="card">
      <h2 style="margin-top:0">${esc(kap.kapitelTitel)}</h2>
      <p class="muted">${kap.szenen.length} Szenen gelesen. Deine Antworten sind im Tagesstand — dein Lernstand ist unverändert, hier wird nichts hochgestuft.</p>
      ${naechstes ? `<button class="btn mt" id="weiterKap">Kapitel ${naechstes.nr}: ${esc(naechstes.kapitelTitel)} ›</button>` : `<p style="margin-bottom:0">Das war das letzte Kapitel. Danke fürs Lesen.</p>`}
    </div></div>`;
  document.getElementById("back").onclick = () => oeffne();
  const w = document.getElementById("weiterKap");
  if (w) w.onclick = () => starteKapitel(naechstes.nr);
}
