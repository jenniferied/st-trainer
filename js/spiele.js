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
  const s = { vp: 0, opu: 0, opz: 0, detektiv: 0, begriffe: 0 };
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
// Was beim letzten Aufbau schon erledigt war. Nur der ECHTE Uebergang leuchtet
// auf — sonst blitzt beim Zurueckkommen auf die Startseite jedes Mal alles auf,
// was heute frueher schon gelaufen ist. null = erster Aufbau dieser Sitzung,
// da leuchtet nichts (beim Oeffnen der App gibt es keinen Uebergang).
let zuletztFertig = null;

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
export function dailies() {
  const heute = spieleHeute();
  return [
    { key: "vp", icon: "🔀", name: "Paare", m: "interleaving", n: heute.vp, aktiv: !!VIG },
    { key: "opu", icon: "🎯", name: "Signalwörter", m: "operatoren", n: heute.opu, aktiv: !!OPS?.uebungen?.length },
    { key: "opz", icon: "↔️", name: "Zuordnen", m: "operatoren", n: heute.opz, aktiv: !!OPS },
    { key: "dt", icon: "🕵️", name: "Detektiv", m: "paraphrasieren", n: heute.detektiv, aktiv: true },
    { key: "bg", icon: "🃏", name: "Begriffe-Blitz", m: "retrieval", n: heute.begriffe, aktiv: C.begriffe().length > 0 },
  ].filter((s) => s.aktiv);
}

/* Welche davon heute noch offen sind, als Liste ihrer Namen. Wandert ueber
   snapshot() in den Lernstand und von dort in den Querlink des GE-Trainers:
   die Laenge wird dort zur Zahl im Abzeichen, die Namen stehen im Tooltip.
   Die LEERE Liste ist ein gueltiges Ergebnis und heisst "heute alles
   erledigt" — sie ist etwas anderes als gar keine Liste. */
export function offeneDailies() {
  return dailies().filter((s) => !s.n).map((s) => s.name);
}

export function hubHtml() {
  const spiele = dailies();
  if (!spiele.length) return "";

  const fertig = new Set(spiele.filter((s) => s.n).map((s) => s.key));
  const frisch = zuletztFertig === null
    ? new Set()
    : new Set([...fertig].filter((k) => !zuletztFertig.has(k)));
  zuletztFertig = fertig;

  const karten = spiele.map((s) => {
    const n = s.n;
    // Exakt dasselbe Bauteil wie im Querlink oben rechts (Muster-Block im CSS):
    // gleiches Wort, gleiche Punktgroesse, gleicher Takt. Nicht nachbauen.
    // .dringend (rot, schneller Puls) seit 12.08. nachmittags: DAS hier sind die
    // Dailies, die Jennifer gemeint hat ("auf jeden Fall Rot ... fuer offene
    // Dailies"). Die Themenkarten im Stoebern bleiben ausdruecklich blau/still —
    // Begruendung und Grenze stehen im CSS, Block 2b.
    /* Das Statuslicht statt der Pille (Jennifer, 12.08. abends: dieselbe Form wie
       die Probeklausur-Reihe). Fuenf rote Pillen nebeneinander waeren eine Wand
       aus Alarm — dieselbe Ueberlegung, aus der die acht Themenkarten nicht
       pulsieren. Der Punkt traegt dieselbe Farbe und denselben Takt, und das Wort
       "offen" steht weiterhin vollstaendig im aria-label und im title.
       Erledigt ist ein Haken und kein gruener Punkt: die zwei Zustaende sollen
       sich nicht nur in der Farbe unterscheiden. */
    const licht = n
      ? `<span class="d-haken" aria-hidden="true">✓</span>`
      : `<span class="d-licht offen puls dringend" aria-hidden="true"></span>`;
    return `<div class="daily-kachel ${n ? "fertig" : "offen"}${frisch.has(s.key) ? " frisch-erledigt" : ""}" data-spiel="${s.key}" role="button" tabindex="0"
         title="${n ? `heute schon ${n}× geübt` : "heute noch offen"}"
         aria-label="${s.name}${n ? " — heute schon geübt" : " — heute noch offen"}">
        <span class="info-btn d-info" data-methode="${s.m}" role="button" title="Warum das hilft">ⓘ</span>
        <span class="d-icon" aria-hidden="true">${s.icon}</span>
        <b>${s.name}</b>
        ${licht}
      </div>`;
  });
  /* EIN Kasten um die Reihe (Jennifer: "koennte man die fuenf Dinge auch in einem
     eigenen Kasten machen, genauso wie die Klausuruebersichten"). Nebeneffekt,
     der die alte Form ohnehin gestoert hat: das Raster brach bei fuenf Kacheln
     auf 4+1 um und liess die letzte allein in einer zweiten Zeile stehen. */
  /* Titel und Erklaerzeile sind seit dem 12.08. abends in beiden Trainern
     gleich. "Heute dran" statt "Tägliches Training": die Ueberschrift benennt
     damit dieselbe Regel, die der rote Punkt darunter meint (heute dran und
     noch offen), und sie ist kuerzer. Die Erklaerzeile stand nur hier und
     wandert mit hinueber — der rote Punkt braucht seine Legende. Das
     Inline-style daran ist jetzt .karten-hinweis im geteilten Paket. */
  return `<div class="card mt glim">
      <h2>Heute dran</h2>
      <p class="karten-hinweis">Kleine Runden, je ~2 Minuten — ein Tipp startet direkt. Der rote Punkt heißt: heute noch nicht dran gewesen. Alles zählt für dein Tagesziel.</p>
      <div class="dailies-reihe">${karten.join("")}</div>
    </div>`;
}
// extra.begriffe: Begriffe-Blitz lebt in main.js — der Hub bekommt den Einstieg gereicht
export function bindHub(zurueck, extra = {}) {
  app().querySelectorAll("[data-spiel]").forEach((b) => {
    const oeffne = () => {
      const k = b.dataset.spiel;
      if (k === "vp") vpSpiel(zurueck);
      else if (k === "opu") opUeben(zurueck);
      else if (k === "opz") opZuordnen(zurueck);
      else if (k === "bg") extra.begriffe?.();
      else dtSpiel(zurueck);
    };
    b.onclick = (e) => { if (e.target.closest(".info-btn")) return; oeffne(); };
    b.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); oeffne(); } };
  });
}

// ---------- Gemeinsames ----------
const kopf = (titel, zurueckFn, extra = "") => `<div class="topbar"><button class="back" id="spielBack">‹</button><h1>${titel}</h1>${extra}</div>`;
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

// ============ GAME 1: Verwechslungspaare ============
const VP_RUNDE = 8;
export function vpSpiel(zurueckFn, gruppeId = null) {
  if (!VIG) return zurueckFn();
  const gew = themenGewichte();
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
  const items = zieh(gruppe.items, Math.min(VP_RUNDE, gruppe.items.length), (i) => 1 + Math.min(3, itemFehler[i.id] || 0));
  const t = C.THEMEN[gruppe.oberthema] || {};
  let idx = 0, richtig = 0, t0 = Date.now();

  // Swipe in bis zu 4 Richtungen (Jennifer 21.07.): links/rechts/oben/unten,
  // je nachdem wie viele Konzepte die Gruppe hat. Chips bleiben als Tap-Weg.
  const K = Math.min(4, gruppe.konzepte.length);
  const RICHTUNG_PFEIL = ["←", "→", "↑", "↓"];

  const mal = () => {
    const it = items[idx];
    const chips = gruppe.konzepte.map((k, i) => `<button class="vp-chip" data-k="${k.key}" style="--tc:${t.color}">${i < K ? `<small class="vp-pfeil">${RICHTUNG_PFEIL[i]}</small>` : ""}${esc(k.label)}${k.kurz ? `<small>${esc(k.kurz)}</small>` : ""}</button>`).join("");
    const seite = (i, cls, pfeilVor) => i < K
      ? `<div class="vp-seite ${cls}" id="vpS${i}">${pfeilVor ? `<span>${RICHTUNG_PFEIL[i]}</span>` : ""}${esc(gruppe.konzepte[i].label)}${pfeilVor ? "" : `<span>${RICHTUNG_PFEIL[i]}</span>`}</div>` : "";
    app().innerHTML = `<div class="fade-in">
      ${kopf("🔀 Verwechslungspaare", zurueckFn)}
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
    document.getElementById("spielBack").onclick = zurueckFn;
    const antworte = (key, richtungIdx = -1) => {
      const ok = key === it.richtig;
      if (ok) richtig++;
      const zeit = Math.round((Date.now() - t0) / 1000);
      logSpiel("vp", it.id, ok ? 1 : 0, 1, ok, zeit);
      const richtigLbl = (gruppe.konzepte.find((k) => k.key === it.richtig) || {}).label || it.richtig;
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
          `<div class="card mt"><b>Merksatz</b><div class="explain good" style="margin-top:6px">${Beleg.render(gruppe.merksatz, gruppe.oberthema)}</div></div>`);
      };
    };
    app().querySelectorAll(".vp-chip").forEach((c) => c.onclick = () => {
      if (c.disabled) return;
      antworte(c.dataset.k, gruppe.konzepte.findIndex((k) => k.key === c.dataset.k));
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
      if (ri >= 0) { beantwortet = true; antworte(gruppe.konzepte[ri].key, ri); }
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
      if (ri >= 0 && ri < K) { e.preventDefault(); beantwortet = true; antworte(gruppe.konzepte[ri].key, ri); }
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

const OP_RUNDE = 6;
export function opUeben(zurueckFn) {
  if (!OPS?.uebungen?.length) return zurueckFn();
  const fehler = {};
  for (const a of C.state().antwortLog) if (a.modus === "op" && !a.voll) fehler[a.qid] = (fehler[a.qid] || 0) + 1;
  const aufgaben = zieh(OPS.uebungen, Math.min(OP_RUNDE, OPS.uebungen.length), (u) => 1 + Math.min(3, fehler[u.id] || 0));
  let idx = 0, richtig = 0, t0 = Date.now();
  const mal = () => {
    const u = aufgaben[idx];
    app().innerHTML = `<div class="fade-in">${kopf("🎯 Signalwörter", zurueckFn, wendungenBtn)}
      <div class="q-progress" style="margin:8px 0"><span class="bar thin"><i style="width:${(100 * idx) / aufgaben.length}%"></i></span><span>${idx + 1}/${aufgaben.length}</span></div>
      <div class="card">
        <div class="q-fall" style="font-style:italic">„${esc(u.stamm)}"</div>
        <div class="q-text" style="font-size:1rem">${u.frage === "operator" ? "Welches Signalwort steuert hier die Aufgabe?" : "Was verlangt diese Frage von dir?"} ${M.infoBtn("operatoren")}</div>
        <div class="answers">${u.optionen.map((o, i) => `<button class="ans op-opt" data-i="${i}"><span>${esc(o)}</span></button>`).join("")}</div>
        <div id="opFb"></div>
      </div></div>`;
    document.getElementById("spielBack").onclick = zurueckFn;
    bindWendungen();
    app().querySelectorAll(".op-opt").forEach((b) => b.onclick = () => {
      const i = +b.dataset.i, ok = i === u.richtig;
      if (ok) richtig++;
      logSpiel("op", u.id, ok ? 1 : 0, 1, ok, Math.round((Date.now() - t0) / 1000));
      app().querySelectorAll(".op-opt").forEach((x) => {
        x.disabled = true;
        if (+x.dataset.i === u.richtig) x.classList.add("correct");
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
export function opZuordnen(zurueckFn) {
  const paare = zieh(OPS.operatoren.filter((o) => o.verlangt), 5);
  const t0 = Date.now();
  app().innerHTML = `<div class="fade-in">${kopf("↔️ Zuordnen", zurueckFn, wendungenBtn)}
    <p class="muted" style="margin:0 0 10px">Links die Wendung antippen, rechts, was sie verlangt.</p>
    <div id="opzSpiel"></div>
    <div id="opzFazit"></div></div>`;
  document.getElementById("spielBack").onclick = zurueckFn;
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
const DT_RUNDE = 6;
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
  const basis = C.nurPingo() ? pool.filter(C.istPingo) : pool;
  if (basis.length < DT_RUNDE) return zurueckFn();
  const gew = themenGewichte();
  // Negationen bewusst haeufiger (Roses teuerster Fragetyp) + schwache Unterthemen
  const fragen = zieh(basis, DT_RUNDE, (q) => (q.fragetyp === "negation" ? 2.5 : q.fragetyp === "anwendung" ? 1.5 : 1) * (gew[q.oberthema + "/" + q.unterthema] || 1));
  let idx = 0, punkte = 0, t0 = Date.now();
  const mal = () => {
    const q = fragen[idx];
    const willRichtig = DT_WILL.find(([, , test]) => test(q))[0];
    // Konzept-Chips: das echte + 3 Decoys aus demselben Oberthema (andere Unterthemen zuerst)
    const andere = [...new Set(pool.filter((x) => x.oberthema === q.oberthema && x.konzept !== q.konzept)
      .sort((a, b) => (a.unterthema === q.unterthema ? 1 : 0) - (b.unterthema === q.unterthema ? 1 : 0))
      .map((x) => x.konzept))].slice(0, 8);
    const konzepte = zieh([q.konzept, ...zieh(andere, 3)], 4);
    let wahlWill = null, wahlKonzept = null;
    app().innerHTML = `<div class="fade-in">${kopf("🕵️ Fragen-Detektiv", zurueckFn)}
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
    document.getElementById("spielBack").onclick = zurueckFn;
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
