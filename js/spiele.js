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

const app = () => document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const REDUCE_MOTION = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

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

// ---------- Tages-Status je Game (farbiger Punkt = heute noch nicht gemacht) ----------
export function spieleHeute() {
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  const s = { vp: 0, op: 0, detektiv: 0 };
  for (const a of C.state().antwortLog)
    if (a.ts >= heute.getTime() && s[a.modus] !== undefined) s[a.modus]++;
  return s;
}

// ---------- Hub auf der Startseite ----------
export function hubHtml() {
  const heute = spieleHeute();
  const dot = (n) => `<span class="spiel-dot ${n ? "done" : "offen"}" title="${n ? `heute schon ${n}× geübt` : "heute noch offen"}"></span>`;
  const kachel = (key, icon, titel, sub, mKey, aktiv) => aktiv
    ? `<button class="spiel-card" data-spiel="${key}">${dot(heute[key === "dt" ? "detektiv" : key])}<b>${icon} ${titel}</b><span>${sub} ${M.infoBtn(mKey)}</span></button>`
    : "";
  const karten = [
    kachel("vp", "🔀", "Verwechslungspaare", "Wischen & zuordnen — die feinen Unterschiede", "interleaving", !!VIG),
    kachel("op", "🔎", "Operatoren", "Die Sprache der Prüfungsfragen knacken", "operatoren", !!OPS),
    kachel("dt", "🕵️", "Fragen-Detektiv", "Was will die Frage? Zwei Tipps, 10 Sekunden", "paraphrasieren", true),
  ].filter(Boolean);
  if (!karten.length) return "";
  return `<h2 class="mt">Tägliches Training</h2>
    <p class="muted" style="margin:-2px 2px 8px;font-size:.82rem">Drei kleine Spiele, je ~2 Minuten. Punkt oben rechts: farbig = heute noch offen. Alles zählt für dein Tagesziel.</p>
    <div class="spiel-grid">${karten.join("")}</div>`;
}
export function bindHub(zurueck) {
  app().querySelectorAll("[data-spiel]").forEach((b) => b.onclick = () => {
    const k = b.dataset.spiel;
    if (k === "vp") vpSpiel(zurueck);
    else if (k === "op") opHome(zurueck);
    else dtSpiel(zurueck);
  });
}

// ---------- Gemeinsames ----------
const kopf = (titel, zurueckFn, extra = "") => `<div class="topbar"><button class="back" id="spielBack">‹</button><h1 style="font-size:1.15rem">${titel}</h1>${extra}</div>`;
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
  el.innerHTML = `<div class="fb-banner ${cls}" style="margin-top:14px"><span>${msg}</span></div>${extraHtml}
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
  const gruppe = gruppeId
    ? VIG.gruppen.find((g) => g.id === gruppeId)
    : zieh(VIG.gruppen, 1, (g) => (gew[g.oberthema + "/" + g.unterthema] || 1) * (1 + Math.min(2, g.items.reduce((s, i) => s + (itemFehler[i.id] || 0), 0) / 3)))[0];
  if (!gruppe) return zurueckFn();
  const items = zieh(gruppe.items, Math.min(VP_RUNDE, gruppe.items.length), (i) => 1 + Math.min(3, itemFehler[i.id] || 0));
  const swipe = gruppe.konzepte.length === 2;
  const t = C.THEMEN[gruppe.oberthema] || {};
  let idx = 0, richtig = 0, t0 = Date.now();
  const fertigListe = [];

  const mal = () => {
    const it = items[idx];
    const chips = gruppe.konzepte.map((k, i) => `<button class="vp-chip" data-k="${k.key}" style="--tc:${t.color}">${esc(k.label)}${k.kurz ? `<small>${esc(k.kurz)}</small>` : ""}</button>`).join("");
    app().innerHTML = `<div class="fade-in">
      ${kopf("🔀 Verwechslungspaare", zurueckFn)}
      <div class="vp-titel"><span class="chip" style="--tc:${t.color}">${t.kurz || ""}</span> <b>${esc(gruppe.titel)}</b> ${M.infoBtn("interleaving")}</div>
      <div class="q-progress" style="margin:8px 0"><span class="bar thin"><i style="width:${(100 * idx) / items.length}%"></i></span><span>${idx + 1}/${items.length}</span></div>
      <div class="vp-buehne">
        ${swipe ? `<div class="vp-seite links" id="vpL"><span>‹</span>${esc(gruppe.konzepte[0].label)}</div>` : ""}
        <div class="vp-card" id="vpCard"><p>${esc(it.text)}</p>${swipe ? `<div class="vp-hint">wischen oder unten tippen</div>` : ""}</div>
        ${swipe ? `<div class="vp-seite rechts" id="vpR">${esc(gruppe.konzepte[1].label)}<span>›</span></div>` : ""}
      </div>
      <div class="vp-chips">${chips}</div>
      <div id="vpFb"></div>
    </div>`;
    document.getElementById("spielBack").onclick = zurueckFn;
    const antworte = (key) => {
      const ok = key === it.richtig;
      if (ok) richtig++;
      const zeit = Math.round((Date.now() - t0) / 1000);
      logSpiel("vp", it.id, ok ? 1 : 0, 1, ok, zeit);
      fertigListe.push({ it, ok });
      const richtigLbl = (gruppe.konzepte.find((k) => k.key === it.richtig) || {}).label || it.richtig;
      const fb = document.getElementById("vpFb");
      fb.innerHTML = `<div class="fb-banner ${ok ? "good" : "bad"}"><span>${ok ? "Richtig!" : `Das war: <b>${esc(richtigLbl)}</b>`}</span></div>
        <div class="explain ${ok ? "good" : "bad"}">${Beleg.render(it.erklaerung || gruppe.merksatz, gruppe.oberthema)}</div>
        <button class="btn" id="vpWeiter" style="width:100%;margin-top:10px">${idx + 1 < items.length ? "Weiter ›" : "Runde abschließen"}</button>`;
      const card = document.getElementById("vpCard");
      card.classList.add(ok ? "ok" : "nope");
      app().querySelectorAll(".vp-chip").forEach((c) => { c.disabled = true; if (c.dataset.k === it.richtig) c.classList.add("richtig"); });
      document.getElementById("vpWeiter").onclick = () => {
        idx++;
        if (idx < items.length) { t0 = Date.now(); mal(); }
        else fazit(document.getElementById("vpFb"), richtig, items.length,
          () => vpSpiel(zurueckFn), zurueckFn,
          `<div class="card mt"><b>Merksatz</b><div class="explain good" style="margin-top:6px">${Beleg.render(gruppe.merksatz, gruppe.oberthema)}</div></div>`);
      };
    };
    app().querySelectorAll(".vp-chip").forEach((c) => c.onclick = () => antworte(c.dataset.k));
    // Swipe (nur bei 2 Konzepten): Karte folgt dem Finger, Schwelle 80px
    if (swipe) {
      const card = document.getElementById("vpCard");
      let startX = null, dx = 0;
      const move = (x) => {
        dx = x - startX;
        card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
        document.getElementById("vpL")?.classList.toggle("an", dx < -30);
        document.getElementById("vpR")?.classList.toggle("an", dx > 30);
      };
      const ende = () => {
        if (startX == null) return;
        if (dx < -80) antworte(gruppe.konzepte[0].key);
        else if (dx > 80) antworte(gruppe.konzepte[1].key);
        else card.style.transform = "";
        startX = null; dx = 0;
        document.getElementById("vpL")?.classList.remove("an");
        document.getElementById("vpR")?.classList.remove("an");
      };
      card.addEventListener("pointerdown", (e) => { startX = e.clientX; card.setPointerCapture(e.pointerId); });
      card.addEventListener("pointermove", (e) => { if (startX != null) move(e.clientX); });
      card.addEventListener("pointerup", ende);
      card.addEventListener("pointercancel", ende);
      document.addEventListener("keydown", function tast(e) {
        if (!document.getElementById("vpCard")) { document.removeEventListener("keydown", tast); return; }
        if (e.key === "ArrowLeft") antworte(gruppe.konzepte[0].key);
        if (e.key === "ArrowRight") antworte(gruppe.konzepte[1].key);
      });
    }
  };
  mal();
}

// ============ GAME 2: Operatoren-Wortschatz ============
export function opHome(zurueckFn) {
  if (!OPS) return zurueckFn();
  const heute = spieleHeute();
  app().innerHTML = `<div class="fade-in">
    ${kopf("🔎 Operatoren", zurueckFn)}
    <div class="card"><p style="margin:0">Prüfungsfragen sprechen ihre eigene Sprache: ‚trifft NICHT zu', ‚kennzeichnet', ‚im Sinne von'. Wer die Wendungen automatisch erkennt, spart Zeit und tappt in weniger Fallen. ${M.infoBtn("operatoren")}</p></div>
    <button class="mode-card wide" data-op="ueben" style="width:100%"><b>⚡ Erkennen üben</b><span>Echte Klausur-Stämme: Was will die Frage? (${OPS.uebungen?.length || 0} Aufgaben)</span></button>
    <button class="mode-card wide mt" data-op="zuordnen" style="width:100%"><b>🃏 Zuordnen</b><span>Wendung ↔ was sie verlangt — wie Begriffe-Blitz</span></button>
    <button class="mode-card wide mt" data-op="karten" style="width:100%"><b>📖 Alle Wendungen ansehen</b><span>${OPS.operatoren.length} Karten mit Tipp & echten Beispielen</span></button>
  </div>`;
  document.getElementById("spielBack").onclick = zurueckFn;
  app().querySelector("[data-op='ueben']").onclick = () => opUeben(zurueckFn);
  app().querySelector("[data-op='zuordnen']").onclick = () => opZuordnen(zurueckFn);
  app().querySelector("[data-op='karten']").onclick = () => opKarten(zurueckFn);
}

function opKarten(zurueckFn) {
  const rows = OPS.operatoren.map((o) => `<details class="sub op-karte"><summary><b>${esc(o.wendung)}</b><span class="muted"> — ${esc(o.verlangt)}</span></summary>
    ${o.tipp ? `<div class="explain good"><span class="bt">💪 ${esc(o.tipp)}</span></div>` : ""}
    ${(o.beispiele || []).map((b) => `<p class="op-beispiel">„${esc(b.text)}"</p>`).join("")}
  </details>`).join("");
  app().innerHTML = `<div class="fade-in">${kopf("📖 Wendungen", () => opHome(zurueckFn))}
    <p class="muted" style="margin:0 0 10px">Antippen zum Aufklappen — mit Strategie-Tipp und echten Beispielen aus deinem Fragen-Korpus.</p>
    <div class="card">${rows}</div></div>`;
  document.getElementById("spielBack").onclick = () => opHome(zurueckFn);
}

const OP_RUNDE = 6;
function opUeben(zurueckFn) {
  const fehler = {};
  for (const a of C.state().antwortLog) if (a.modus === "op" && !a.voll) fehler[a.qid] = (fehler[a.qid] || 0) + 1;
  const aufgaben = zieh(OPS.uebungen, Math.min(OP_RUNDE, OPS.uebungen.length), (u) => 1 + Math.min(3, fehler[u.id] || 0));
  let idx = 0, richtig = 0, t0 = Date.now();
  const mal = () => {
    const u = aufgaben[idx];
    app().innerHTML = `<div class="fade-in">${kopf("⚡ Erkennen üben", () => opHome(zurueckFn))}
      <div class="q-progress" style="margin:8px 0"><span class="bar thin"><i style="width:${(100 * idx) / aufgaben.length}%"></i></span><span>${idx + 1}/${aufgaben.length}</span></div>
      <div class="card">
        <div class="q-fall" style="font-style:italic">„${esc(u.stamm)}"</div>
        <div class="q-text" style="font-size:1rem">${u.frage === "operator" ? "Welches Signalwort steuert hier die Aufgabe?" : "Was verlangt diese Frage von dir?"}</div>
        <div class="answers">${u.optionen.map((o, i) => `<button class="ans op-opt" data-i="${i}"><span>${esc(o)}</span></button>`).join("")}</div>
        <div id="opFb"></div>
      </div></div>`;
    document.getElementById("spielBack").onclick = () => opHome(zurueckFn);
    app().querySelectorAll(".op-opt").forEach((b) => b.onclick = () => {
      const i = +b.dataset.i, ok = i === u.richtig;
      if (ok) richtig++;
      logSpiel("op", u.id, ok ? 1 : 0, 1, ok, Math.round((Date.now() - t0) / 1000));
      app().querySelectorAll(".op-opt").forEach((x) => {
        x.disabled = true;
        if (+x.dataset.i === u.richtig) x.classList.add("correct");
        else if (x === b) x.classList.add("wrong");
      });
      document.getElementById("opFb").innerHTML = `<div class="explain ${ok ? "good" : "bad"}"><span class="bt">${esc(u.erklaerung || "")}</span></div>
        <button class="btn" id="opWeiter" style="width:100%;margin-top:10px">${idx + 1 < aufgaben.length ? "Weiter ›" : "Runde abschließen"}</button>`;
      document.getElementById("opWeiter").onclick = () => {
        idx++;
        if (idx < aufgaben.length) { t0 = Date.now(); mal(); }
        else fazit(document.getElementById("opFb"), richtig, aufgaben.length, () => opUeben(zurueckFn), () => opHome(zurueckFn));
      };
    });
  };
  mal();
}

function opZuordnen(zurueckFn) {
  const paare = zieh(OPS.operatoren.filter((o) => o.verlangt), 5);
  const links = zieh([...paare], paare.length);
  const rechts = zieh([...paare], paare.length);
  const t0 = Date.now();
  const offen = new Set(paare.map((p) => p.id));
  const fehler = new Set(), gewertet = new Set();
  let aktiv = null;
  app().innerHTML = `<div class="fade-in">${kopf("🃏 Zuordnen", () => opHome(zurueckFn))}
    <p class="muted" style="margin:0 0 10px">Links die Wendung antippen, rechts, was sie verlangt.</p>
    <div class="bg-spiel">
      <div class="bg-col">${links.map((p) => `<button class="bg-card links" data-id="${esc(p.id)}">${esc(p.wendung)}</button>`).join("")}</div>
      <div class="bg-col">${rechts.map((p) => `<button class="bg-card rechts" data-id="${esc(p.id)}">${esc(p.verlangt)}</button>`).join("")}</div>
    </div>
    <div id="opzFazit"></div></div>`;
  document.getElementById("spielBack").onclick = () => opHome(zurueckFn);
  const alleL = [...app().querySelectorAll(".bg-card.links")];
  alleL.forEach((b) => b.onclick = () => {
    if (b.classList.contains("done")) return;
    alleL.forEach((x) => x.classList.remove("sel"));
    b.classList.add("sel"); aktiv = b.dataset.id;
  });
  app().querySelectorAll(".bg-card.rechts").forEach((b) => b.onclick = () => {
    if (b.classList.contains("done") || !aktiv) return;
    const erster = !gewertet.has(aktiv);
    if (b.dataset.id === aktiv) {
      if (erster) {
        gewertet.add(aktiv);
        const voll = !fehler.has(aktiv);
        logSpiel("op", "opz-" + aktiv, voll ? 1 : 0, 1, voll, Math.round((Date.now() - t0) / 1000));
      }
      offen.delete(aktiv);
      b.classList.add("done");
      app().querySelector(`.bg-card.links[data-id="${CSS.escape(aktiv)}"]`)?.classList.add("done");
      aktiv = null;
      if (!offen.size) {
        const ok = paare.length - fehler.size;
        const erkl = paare.filter((p) => fehler.has(p.id)).map((p) => `<div class="review-q" style="padding:8px 0"><b>${esc(p.wendung)}</b> → ${esc(p.verlangt)}${p.tipp ? `<div class="explain good"><span class="bt">${esc(p.tipp)}</span></div>` : ""}</div>`).join("");
        fazit(document.getElementById("opzFazit"), ok, paare.length, () => opZuordnen(zurueckFn), () => opHome(zurueckFn),
          erkl ? `<div class="card mt"><h3>Kurz nachlesen</h3>${erkl}</div>` : "");
      }
    } else {
      if (erster) fehler.add(aktiv);
      b.classList.add("shake");
      setTimeout(() => b.classList.remove("shake"), 450);
    }
  });
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
  const gew = themenGewichte();
  // Negationen bewusst haeufiger (Roses teuerster Fragetyp) + schwache Unterthemen
  const fragen = zieh(pool, DT_RUNDE, (q) => (q.fragetyp === "negation" ? 2.5 : q.fragetyp === "anwendung" ? 1.5 : 1) * (gew[q.oberthema + "/" + q.unterthema] || 1));
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
