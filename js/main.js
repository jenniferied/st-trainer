import * as C from "./core.js";
import * as Beleg from "./beleg.js";
import * as M from "./methoden.js";
import * as Spiele from "./spiele.js";
import * as Llm from "./llm.js";

const app = document.getElementById("app");
const h = (html) => { app.innerHTML = html; window.scrollTo(0, 0); };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// Grafik-Fragen: Bild unter dem Fragetext (Tippen/Klicken = Vollbild-Zoom via CSS :target-frei per Klasse)
const bildHtml = (q) => q.bild ? `<div class="q-bild"><img src="data/img/${esc(q.bild)}" alt="Grafik zur Frage" loading="lazy" onclick="this.classList.toggle('zoom')"></div>` : "";
// Fallvignetten aus der Vorlesung (Sachverhalt) — steht ueber der Frage, wie im Original-PDF
const fallHtml = (q) => q.sachverhalt ? `<div class="q-fall"><b>Sachverhalt</b>${esc(q.sachverhalt)}</div>` : "";
const MODUS_LBL = { klausur: "🎓 Klausur-Simulation", halbe: "🕧 Halbe Klausur", spaced: "🧠 Schlaues Wiederholen", schnell: "⚡ Schnelle 10er", fehler: "🔁 Fehler-Training", eigene: "🧩 Eigene Runde", probeklausur: "🏆 Probeklausur", sprach: "🗣 Sprachverständnis" };
// Probeklausuren tragen ihre Nummer (I-V) im Label; alles andere wie gehabt
const pkLbl = (nr) => `🏆 Probeklausur ${C.PK_ROEM[nr] || nr || ""}`.trim();
const sessLbl = (s) => {
  const m = s.modus || s.cfg?.modus;
  return m === "probeklausur" ? pkLbl(s.cfg?.pk) : MODUS_LBL[m] || m;
};

// Night Mode: settings.theme = "auto" | "hell" | "dunkel" — auto folgt dem System.
// index.html setzt data-theme schon vor dem CSS (kein Aufblitzen beim Laden).
function applyTheme() {
  let t = C.state().settings.theme || "auto";
  if (t === "auto") t = matchMedia("(prefers-color-scheme: dark)").matches ? "dunkel" : "hell";
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = t === "dunkel" ? "#171425" : "#faf5ec";
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if ((C.state().settings.theme || "auto") === "auto") applyTheme();
});
const themeIstDunkel = () => document.documentElement.dataset.theme === "dunkel";
// Schnell-Umschalter in der Topbar: setzt explizit hell/dunkel (verlaesst damit "auto")
function toggleTheme(btn) {
  C.state().settings.theme = themeIstDunkel() ? "hell" : "dunkel";
  C.save(); applyTheme();
  btn.textContent = themeIstDunkel() ? "☀️" : "🌙";
}
const themeBtnHtml = () => `<button class="btn ghost small" id="themeBtn" title="Hell / Dunkel umschalten">${themeIstDunkel() ? "☀️" : "🌙"}</button>`;

// confirm()/alert() werden in manchen Kontexten (iframe, In-App-Browser) stumm
// blockiert und "es passiert nichts" — darum eigener Mini-Dialog als Overlay.
// frag(text) => Promise<boolean>, sag(text) => Hinweis mit nur einem Ok-Knopf.
function frag(text, opts = {}) {
  return new Promise((res) => {
    const ov = document.createElement("div");
    ov.className = "dlg-overlay";
    ov.innerHTML = `<div class="dlg"><p>${esc(text)}</p><div class="btn-row">
      ${opts.nurOk ? "" : `<button class="btn secondary" data-x="0">${esc(opts.nein || "Abbrechen")}</button>`}
      <button class="btn" data-x="1">${esc(opts.ja || "Ja")}</button></div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => {
      const b = e.target.closest("[data-x]");
      if (b) { ov.remove(); res(b.dataset.x === "1"); }
      else if (e.target === ov) { ov.remove(); res(false); }
    });
  });
}
const sag = (text) => frag(text, { nurOk: true, ja: "Ok" });
const datum = (ts) => new Date(ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) + " " + new Date(ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
// Fortschritts-Anzeige in Stufen: kräftig = gemeistert, mittel = auf gutem Weg,
// hell = angefangen. Zahl daneben = Fragen in Arbeit (alles außer "neu") — die
// waechst mit jeder Antwort, statt bis zur ersten Meisterung 0 zu zeigen.
const stufenTitle = (f) => `${f.st.gem} gemeistert · ${f.st.weg} auf gutem Weg · ${f.st.ang} angefangen · ${f.st.neu} noch neu`;
const stufenBar = (f, thin) => {
  const w = (x) => (f.n ? (100 * x) / f.n : 0);
  return `<span class="bar${thin ? " thin" : ""} stufen"><i class="s-gem" style="width:${w(f.st.gem)}%"></i><i class="s-weg" style="width:${w(f.st.weg)}%"></i><i class="s-ang" style="width:${w(f.st.ang)}%"></i></span>`;
};
const fmtMN = (f) => `${f.st.gem + f.st.weg + f.st.ang}/${f.n}`;

// Sticker-Feedback: Roses & Jennifers meistgenutzte WhatsApp-Sticker (animiertes
// WebP), je nach Ergebnis zufällig gewählt — überall, auch im Exam.UP-Klausurlook
// (Jennifer 17.07.: Motivation schlägt Nüchternheit). Bei prefers-reduced-motion
// wird das Standbild (.png, erster Frame) statt der Animation geladen.
const STICKER = {
  good: ["pepe_drool", "troll_grin", "patrick_happy", "laugh_cam", "happy_dog", "laughcry", "rat_dance", "kitten_lift"],
  part: ["emoji_eye", "seal_blob", "patrick_slime", "monkey_side", "cat_grass", "fish_drink"],
  bad: ["nervous_grin", "laptop_bite", "shocked_dog", "bonk_dog"],
  sanft: ["praying_cat", "pat_pat", "kitten_braces", "kitten_suit", "sad_hamster", "teary_cat"], // fürs Nicht-Bestehen: tröstend, nie Bonk
};
const REDUCE_MOTION = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
// Pfad zum Reaktions-Sticker: animiert (.webp), oder Standbild (.png) bei reduzierter Bewegung.
const reactSrc = (name) => `assets/reactions/${name}.${REDUCE_MOTION ? "png" : "webp"}`;
const sticker = (cls, big) => {
  const arr = STICKER[cls] || [];
  if (!arr.length) return "";
  const name = arr[Math.floor(Math.random() * arr.length)];
  return `<img class="sticker${big ? " big" : ""}" src="${reactSrc(name)}" alt="" loading="lazy">`;
};
// Sticker passend zum Leistungsstand (0–100 %): hoch = Freude, mittel = neckisch,
// niedrig = tröstend/aufmunternd (nie hämisch).
const standSticker = (quote) => sticker(quote == null ? "part" : quote >= 70 ? "good" : quote >= 45 ? "part" : "sanft", true);

// ---- Kleine Feier-Effekte: Konfetti-Regen, nicht-blockierend, respektiert reduzierte Bewegung ----
const KONFETTI = ["🎉", "🎊", "💗", "💖", "⭐", "✨", "🌟", "🥳"];
function konfetti({ n = 55, ms = 2800 } = {}) {
  // Bei reduzierter Bewegung nicht ausfallen lassen, sondern sanft: verteilte
  // Emojis blenden nur ein und aus (kein Regen) — belohnt wird trotzdem.
  const ov = document.createElement("div");
  ov.className = "konfetti";
  if (REDUCE_MOTION) {
    ms = 2600;
    ov.innerHTML = Array.from({ length: Math.min(n, 16) }, () => {
      const sym = KONFETTI[Math.floor(Math.random() * KONFETTI.length)];
      return `<span class="herz still" style="left:${(Math.random() * 92).toFixed(1)}%;top:${(6 + Math.random() * 74).toFixed(1)}%;font-size:${(1 + Math.random() * 1.2).toFixed(2)}rem;animation-delay:${(Math.random() * 0.5).toFixed(2)}s">${sym}</span>`;
    }).join("");
  } else {
    ov.innerHTML = Array.from({ length: n }, () => {
      const sym = KONFETTI[Math.floor(Math.random() * KONFETTI.length)];
      const sw = (8 + Math.random() * 22).toFixed(0);
      const spin = (Math.random() * 720 - 360).toFixed(0);
      return `<span class="herz" style="left:${(Math.random() * 100).toFixed(1)}%;font-size:${(0.8 + Math.random() * 1.4).toFixed(2)}rem;--sw:${sw}px;--spin:${spin}deg;animation-duration:${(2.4 + Math.random() * 2).toFixed(2)}s;animation-delay:${(Math.random() * 0.7).toFixed(2)}s">${sym}</span>`;
    }).join("");
  }
  document.body.appendChild(ov);
  setTimeout(() => ov.remove(), ms);
}
// ---- Zahlen zählen sanft hoch (nur reine Zahlen / Prozente) ----
function countUp(el) {
  const m = (el.dataset.to ?? el.textContent).trim().match(/^(\d+)(\s*%?)$/);
  // Im Hintergrund-Tab drosselt der Browser rAF — dann gar nicht animieren, damit
  // die echte Zahl stehen bleibt statt bei 0 zu hängen.
  if (!m || REDUCE_MOTION || document.visibilityState !== "visible") return;
  const end = +m[1], suf = m[2] || "", dur = 650, t0 = performance.now();
  const tick = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))) + suf;
    if (p < 1) requestAnimationFrame(tick);
  };
  el.textContent = "0" + suf;
  requestAnimationFrame(tick);
  setTimeout(() => { el.textContent = end + suf; }, dur + 200); // Sicherheitsnetz
}
// Belebt eine frisch gerenderte Auswertungs-/Statistikseite: Zahlen zählen hoch,
// Balken wachsen, Diagramm-Säulen ploppen gestaffelt rein.
function belebeStats(root) {
  if (!root || REDUCE_MOTION) return;
  root.classList.add("stat-anim");
  root.querySelectorAll(".stat-tile b, .js-count").forEach(countUp);
  root.querySelectorAll(".tr-col > i, .akt-col > i").forEach((el, i) => { el.style.animationDelay = (i * 0.04).toFixed(2) + "s"; });
}

// Hinweis-Badges (unbestätigte Lösung, KI-generiert) — wie die Themen-Chips
// erst NACH der Antwort zeigen, vorher wären sie ein Hinweis (Klausurnähe)
const qBadges = (q) =>
  (q.loesungSicherheit === "unsicher" ? `<span class="badge-src badge-unsicher">Lösung unbestätigt</span>` : "") +
  (q.quelle === "generiert" ? `<span class="badge-src badge-generiert">KI-generiert</span>` : "") +
  (q.persoenlich ? `<span class="badge-src badge-pers">💛 aus deiner Welt</span>` : "");

// ---- Selbsterklaerung bei Fehlern (Block A NextGen, Chi et al.): erst selbst
// ueberlegen, warum es falsch war, DANN die kuratierte Erklaerung — beides wird
// gespeichert (Hypercorrection-Auswertung spaeter). Drei Stufen in den
// Einstellungen: standard (Skip-Link sichtbar) / streng (ohne Skip) / aus.
const seModus = () => C.state().settings.selbstErkl || "standard";
// Gilt in ALLEN Modi mit Sofort-Feedback (Jennifer 21.07.: die fruehere
// Schnelle-10er-Ausnahme ist raus — sie hat nur verwirrt). Klausur-Durchlaeufe
// haben ohnehin kein Sofort-Feedback, Probeklausur-Erstversuch auch nicht.
const seAktiv = () => seModus() !== "aus";

function selbstErklStart(zone, erg, done, frageText) {
  const frage = frageText || (erg.punkte > 0 ? "Ein Teil hat gefehlt — was, glaubst du, war es?" : "Warum, glaubst du, war das falsch?");
  zone.innerHTML = `<div class="selbst-box" id="selbstBox">
    <div class="selbst-kopf"><b>${frage}</b> ${M.infoBtn("selbsterklaerung")}</div>
    <textarea id="selbstTxt" rows="2" placeholder="Deine Vermutung — Stichworte reichen" autocapitalize="sentences"></textarea>
    <div class="btn-row" style="margin-top:8px"><button class="btn small" id="selbstOk">Erklärung ansehen</button></div>
    ${seModus() === "streng" ? "" : `<button class="linkish" id="selbstSkip">Nur die Antwort zeigen</button>`}
  </div>`;
  const fertig = (skip) => {
    const text = zone.querySelector("#selbstTxt").value.trim();
    done({ text: text || null, skip: !!skip && !text });
  };
  zone.querySelector("#selbstOk").onclick = () => fertig(false);
  const sk = zone.querySelector("#selbstSkip");
  if (sk) sk.onclick = () => fertig(true);
}

// Abgleich nach dem Lesen der Erklaerung: "Nein, war was anderes" ist der
// wertvollste Fall (Hypercorrection) — das Echo feiert ihn entsprechend.
const AB_OPT = [["ja", "Ja"], ["teils", "Teilweise"], ["nein", "Nein, war was anderes"]];
const AB_ECHO = {
  ja: "Schön — du wusstest schon, woran es lag. Das sitzt beim nächsten Mal. 💪",
  teils: "Halb erkannt ist viel wert — der fehlende Teil steht oben in der Erklärung.",
  nein: "Solche Überraschungen sind Gold: Was anders kam als gedacht, bleibt am besten hängen. ✨",
};
const abgleichHtml = (sel, qid = "") => `<div class="abgleich" id="abgleich" data-qid="${esc(qid)}"><span class="ab-frage">Entspricht das deiner Erklärung?</span>
  ${AB_OPT.map(([v, l]) => `<button type="button" data-ab="${v}" class="${sel === v ? "on" : ""}">${l}</button>`).join("")}
  ${sel ? `<p class="ab-echo">${AB_ECHO[sel]}</p>` : ""}</div>`;
const bindAbgleich = (wurzel, onWahl) => wurzel.querySelectorAll("[data-ab]").forEach((b) => b.onclick = () => onWahl(b.dataset.ab));

// LLM-Feedback auf die Selbsterklaerung (Block E): kommt asynchron nach dem
// Aufdecken und wird VOR dem Abgleich eingeschoben. Scheitert lautlos —
// der feste Ablauf (kuratierte Erklaerung + Abgleich) braucht kein LLM.
function llmSelbstFeedback(q, text, gewaehlt, erg) {
  if (!text || !Llm.aktiv()) return;
  Llm.selbstFeedback(q, text, gewaehlt, erg).then((fb) => {
    if (!fb) return;
    const anker = document.getElementById("abgleich");
    if (anker && anker.dataset.qid === q.id && !document.querySelector(".llm-fb"))
      anker.insertAdjacentHTML("beforebegin", Llm.feedbackHtml(fb, q.oberthema));
  });
}

// ---- Erklaer-Abfrage in 3 Modi (Jennifer 21.07., je Runde im Builder waehlbar):
//   aus        = einfach richtig/falsch + Erklaerungen zeigen
//   begruenden = Faerbung sofort sichtbar, aber die kuratierten Erklaerungen
//                gibt es erst, nachdem Rose selbst begruendet hat (+ KI-Feedback)
//   raten      = zweistufig: erst steht nur die ANZAHL falscher Kreuze da, Rose
//                tippt, welche es waren und warum (+ KI-Feedback) — nach der
//                Aufloesung haelt sie nicht erkannte Fallen nochmal kurz fest
// KI ist ueberall nur Verstaerkung — ohne Function laeuft der feste Ablauf.
function erklaerFlow(q, r, erg, done) {
  C.syncEvent({ frage_id: q.id, gewaehlt: r.gewaehlt, punkte: erg.punkte, max_punkte: q.maxPunkte, voll: erg.voll, modus: R?.cfg.modus || "explore", ts: new Date().toISOString() });
  const modus = erg.voll ? "aus" : (R?.cfg?.erklaerModus || (seModus() === "aus" ? "aus" : "begruenden"));
  const fz = document.getElementById("fbzone");
  if (modus === "aus" || !fz) { zeigeFeedback(q, r); done(); return; }

  if (modus === "begruenden") {
    faerbeAntworten(q, r, false);
    fz.innerHTML = fbBanner(q, erg);
    const zone = document.createElement("div");
    fz.appendChild(zone);
    selbstErklStart(zone, erg, (selbst) => {
      selbst.modus = "begruenden";
      r.selbst = selbst; C.save();
      zeigeFeedback(q, r);
      if (selbst.text) llmSelbstFeedback(q, selbst.text, r.gewaehlt, erg);
      done();
    }, "Deine falschen Kreuze sind markiert — warum, glaubst du, waren die falsch?");
    return;
  }

  // raten: KEINE Faerbung — nur wie viel danebenlag. Erst tippen, dann sehen.
  const fehlend = q.optionen.filter((o) => o.richtig).length - erg.richtigGesetzt;
  const info = [
    erg.falschGesetzt ? `${erg.falschGesetzt} ${erg.falschGesetzt === 1 ? "Kreuz war" : "Kreuze waren"} falsch` : "",
    fehlend > 0 ? `${fehlend} ${fehlend === 1 ? "richtige Antwort fehlt" : "richtige Antworten fehlen"}` : "",
  ].filter(Boolean).join(" · ");
  fz.innerHTML = `<div class="fb-banner part"><span>🤔 ${info} — aber welche?</span></div>`;
  const zone = document.createElement("div");
  fz.appendChild(zone);
  selbstErklStart(zone, erg, (selbst) => {
    selbst.modus = "raten";
    r.selbst = selbst; C.save();
    zeigeFeedback(q, r);
    if (selbst.text) llmSelbstFeedback(q, selbst.text, r.gewaehlt, erg);
    // Stufe 2: jetzt liegt die Aufloesung offen — nicht Erkanntes kurz festhalten
    if (!selbst.skip) {
      const anker = document.getElementById("abgleich");
      const nb = document.createElement("div");
      if (anker) anker.parentNode.insertBefore(nb, anker); else fz.appendChild(nb);
      nb.innerHTML = `<div class="selbst-box"><div class="selbst-kopf"><b>Jetzt siehst du die Auflösung — was hattest du nicht auf dem Schirm?</b> ${M.infoBtn("selbsterklaerung")}</div>
        <textarea id="selbst2Txt" rows="2" placeholder="Kurz festhalten — genau das bleibt hängen"></textarea>
        <div class="btn-row" style="margin-top:8px"><button class="btn small" id="selbst2Ok">Merken</button></div>
        ${seModus() === "streng" ? "" : `<button class="linkish" id="selbst2Skip">Überspringen</button>`}</div>`;
      const zu = (txt) => {
        r.selbst.text2 = txt || null; C.save();
        nb.innerHTML = txt ? `<div class="llm-fb"><span class="llm-fb-kopf">📝 Notiert — gute Falle erkannt</span><div>${esc(txt)}</div></div>` : "";
        done();
      };
      nb.querySelector("#selbst2Ok").onclick = () => zu(nb.querySelector("#selbst2Txt").value.trim());
      const sk = nb.querySelector("#selbst2Skip");
      if (sk) sk.onclick = () => zu("");
      // Locker: Weiter geht auch ohne Nachkommentar; streng gate't bis "Merken"
      if (seModus() !== "streng") done();
      return;
    }
    done();
  }, "Welche deiner Kreuze waren wohl falsch (a, b, c ...) — und warum? Fehlt eine richtige?");
}

let R = null;      // aktive offene Session (Referenz in state().offen)
let timerInt = null;
let qStart = null; // Start-Timestamp der aktuell angezeigten Frage (Zeit pro Frage)

// Angesammelte Zeit auf der aktuellen Frage verbuchen (idempotent: qStart wird genullt)
function bankZeit() {
  if (!R || qStart == null) return;
  const r = R.runde[R.idx];
  if (r) r.zeitSek = (r.zeitSek || 0) + Math.round((Date.now() - qStart) / 1000);
  qStart = null; C.save();
  // Anzeige sofort auf den gebankten Stand bringen (nicht erst beim nächsten Tick)
  const qz = document.getElementById("q-zeit");
  if (qz && r) qz.textContent = `⏱ ${fmtUhr(r.zeitSek)}`;
}

// ================= HOME =================
// ---- Tagesziel-Bar: Orange -> Gelb -> Gruen. Bewusst nie rot, kein Rueckstands-
// Uebertrag von gestern — jeder Tag startet frisch. Gruen = "genug fuer heute",
// ein erreichbarer Endpunkt statt endlosem Grind.
function tageszielHtml(tz, sich) {
  if (tz.tage != null && tz.tage < 0) return "";
  if (tz.tage === 0) {
    const sicher = sich.filter((t) => t.stars >= 2).length;
    return `<div class="card tagesziel klausurtag">
      <b style="font-size:1.15rem">💛 Du schaffst das.</b>
      <p style="margin:6px 0 0"><b>${C.state().antwortLog.length}</b> Antworten trainiert, ${sicher} von 6 Themen sicher — das Wissen ist da. Ruhig atmen (4 Sek. ein, 6 Sek. aus), erst die sicheren Fragen, dann die kniffligen. 🍀</p>
    </div>`;
  }
  // Drei dynamische Stufen (aus dem echten Restbedarf, taeglich eingefroren):
  // Minimum (Boden fuer zaehe Tage) -> Tagespensum (der Plan) -> Streckziel (Gold).
  // Die Bar endet am Streckziel; Zonengrenzen wandern mit den Tageswerten.
  const minP = Math.round((100 * tz.minimum) / tz.stretch);
  const zielP = Math.round((100 * tz.ziel) / tz.stretch);
  const pct = Math.min(100, Math.round((100 * tz.n) / tz.stretch));
  const zone = tz.n >= tz.stretch ? "gold" : tz.n >= tz.ziel ? "g" : tz.n >= tz.minimum ? "y" : "o";
  const msg = zone === "gold" ? "Streckziel! 🌟 Du bist dem Plan voraus — Pause ist mehr als verdient."
    : zone === "g" ? "Tagespensum geschafft 🎉 Alles ab hier ist Vorsprung für morgen."
    : tz.n === 0 ? "Frischer Tag, frische Bar. Die erste Karte ist der ganze Trick — eine ⚡ 10er reicht zum Ankommen."
    : zone === "y" ? `Minimum steht ✓ — ab hier geht's Richtung Tagespensum (${tz.ziel}).`
    : `Warmlaufen — erstes Etappenziel: ${tz.minimum}. Jede Karte zählt, Begriffe-Blitz auch.`;
  const note = tz.tage == null ? ""
    : tz.tage === 1 ? `<p class="muted tz-note">Morgen früh ist es so weit. Heute reichen lockere ${tz.ziel} zum Festigen — und dann Feierabend und früh schlafen. 💛</p>`
    : `<p class="muted tz-note">Minimum <b>${tz.minimum}</b> · Tagespensum <b>${tz.ziel}</b> · Streckziel <b>${tz.stretch}</b> — täglich neu aus deinem echten Reststoff gerechnet (noch ~${tz.restBedarf} Antworten, ${tz.tage} Übungstage). Begriffe-Blitz zählt mit. ${M.infoBtn("relearning")}</p>`;
  const grad = `linear-gradient(to right, var(--zone-o) 0 ${minP}%, var(--zone-y) ${minP}% ${zielP}%, var(--zone-g) ${zielP}% 100%)`;
  return `<div class="card tagesziel">
    <div class="tz-head"><b>Heute</b><span class="tz-count"><b>${tz.n}</b> / ${tz.ziel} Karten</span></div>
    <div class="zonen-bar" role="img" aria-label="${tz.n} von ${tz.ziel} Karten heute, Streckziel ${tz.stretch}" style="background:${grad}">
      <i class="fill ${zone}" style="width:${pct}%"></i>
      <span class="mark" style="left:${minP}%"></span><span class="mark" style="left:${zielP}%"></span>
    </div>
    <p class="muted tz-msg">${msg}</p>${note}
  </div>`;
}

// ---- Sicherheits-Sterne je Thema. Sprachregel: nie "schwach" — Stufen heissen
// "im Aufbau / auf dem Weg / sicher / pruefungsreif" (Wachstums-Framing).
const sterneHtml = (n, mini) => `<span class="sterne${mini ? " mini" : ""}">${[0, 1, 2].map((i) => `<span class="${i < n ? "an" : ""}">${i < n ? "★" : "☆"}</span>`).join("")}</span>`;
const STERN_STATUS = ["im Aufbau", "auf dem Weg", "sicher", "prüfungsreif ✨"];
// Ein konkreter kleinster Schritt statt sechs Baustellen: das Thema, dem am
// wenigsten zum naechsten Stern fehlt (Entscheidungslast rausnehmen).
function sternSchrittHtml(sich) {
  const offen = sich.filter((t) => t.stars < 3);
  if (!offen.length) return `<p class="tz-msg" style="margin:10px 0 0"><b>Alle 6 Themen prüfungsreif ⭐⭐⭐</b> — du bist bereit. Ab hier nur noch frisch halten.</p>`;
  const kandidat = offen.filter((t) => t.fehlt?.karten).sort((a, b) => a.fehlt.karten - b.fehlt.karten)[0] || offen[0];
  return `<div class="stern-schritt"><span>Nächster Stern: <b>${C.THEMEN[kandidat.slug].name}</b>${kandidat.fehlt?.karten ? ` — noch ~${kandidat.fehlt.karten} Karten` : " — Wiederholen hebt die Quote"}</span>
    <button class="btn small" data-uebe="${kandidat.slug}">10 Karten üben</button></div>`;
}
// Direkt-Ueben-Buttons (Naechster Stern, Schwaechen-Chips in der Statistik):
// ein Tipp startet 10 smarte Karten nur aus dem passenden Thema.
// Empfehlungs-Runden arbeiten mit den Verstehens-Methoden (Jennifer 21.07.):
// Paraphrasieren ("Was will die Frage von mir?") ist an, und bei Fehlern folgt
// die Selbsterklaerung ("Warum, glaubst du, war das falsch?") wie eingestellt —
// locker mit Skip-Link (Standard) oder streng ohne (Einstellungen).
function bindUebe() {
  app.querySelectorAll("[data-uebe]").forEach((b) => b.onclick = () => starte({
    modus: "eigene", anzahl: 10, auswahl: "smart", themen: [b.dataset.uebe],
    timerModus: "aus", pausierbar: true, feedback: "sofort", examLook: false,
    sprache: C.state().settings.sprache || "schwer",
    paraphrase: true,
  }));
  // Wackel-Runde: schnelle 10er nur aus roten Unterthemen, Schwerstes zuerst
  // (fokus-Auswahl); Selbsterklaerung bei Fehlern greift wie eingestellt.
  app.querySelectorAll("[data-rot]").forEach((b) => b.onclick = () => starte({
    modus: "eigene", anzahl: 10, auswahl: "fokus", unterthemen: JSON.parse(b.dataset.rot),
    timerModus: "aus", pausierbar: true, feedback: "sofort", examLook: false,
    sprache: C.state().settings.sprache || "schwer",
  }));
  // Unterthema-Runde (Jennifer 22.07.): der kleine Blitz an jeder Zeile der
  // Beherrschungs-Liste — 10 smarte Karten aus genau diesem Unterthema.
  app.querySelectorAll("[data-uebe-unter]").forEach((b) => b.onclick = () => starte({
    modus: "eigene", anzahl: 10, auswahl: "smart", unterthemen: JSON.parse(b.dataset.uebeUnter),
    timerModus: "aus", pausierbar: true, feedback: "sofort", examLook: false,
    sprache: C.state().settings.sprache || "schwer",
    paraphrase: true,
  }));
}

// ---- Uebungs-Kalender + Trend (Block C NextGen, ueberarbeitet nach Jennifers
// Feedback 21.07.): echter Kalender (7 Spalten Mo-So, volle Breite, Zellen
// resizen dynamisch) vom ersten Trainingstag bis zur Klausur. Vergangene Tage
// zeigen die Karten-Zahl, kuenftige das Datum, 🎓 = Klausurtag. Leere Tage
// bleiben neutral (nie rot). Darunter der Doppel-Trend: geuebte Karten/Tag und
// davon voll richtige — je naeher die Linien zusammenlaufen, desto hoeher die
// Quote — plus gestrichelte Prognose mit dem aktuellen 7-Tage-Schnitt bis 18.09.
const fmtDatumKurz = (d) => d.getDate() + "." + (d.getMonth() + 1) + ".";
function heatmapHtml(tz) {
  const cfg = window.ST_CONFIG;
  if (!cfg.klausurTag || tz.tage == null || tz.tage < 0) return "";
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  const ende = new Date(cfg.klausurTag + "T00:00:00");
  const akt = C.aktivitaetProTag();
  const aktTage = Object.keys(akt).map(Number);
  // Start: Montag der Woche des ersten Trainingstags (Fallback: vorige Woche)
  const erster = aktTage.length ? Math.min(...aktTage) : heute.getTime() - 7 * 86400000;
  const start = new Date(Math.min(erster, heute.getTime()));
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  // Zellfarbe = dieselben Zonen wie die Tagesziel-Bar (orange unter Minimum,
  // gelb bis Tagespensum, gruen ab Pensum, gold ab Streckziel); 0 Karten = grau.
  const stufe = (n) => !n ? 0 : n < tz.minimum ? 1 : n < tz.ziel ? 2 : n < tz.stretch ? 3 : 4;

  const kopfzeile = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => `<span class="hm-wtag">${w}</span>`).join("");
  const zellen = [];
  for (let d = new Date(start); d <= ende; d.setDate(d.getDate() + 1)) {
    const ts = d.getTime();
    const istHeute = ts === heute.getTime();
    const istKlausur = ts === ende.getTime();
    const zukunft = ts > heute.getTime();
    const e = akt[ts] || { n: 0, voll: 0 };
    const datum = fmtDatumKurz(d);
    const wtag = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][d.getDay()];
    let cls, inhalt, tip;
    if (istKlausur) {
      cls = "hm-exam"; inhalt = "🎓"; tip = `${wtag} ${datum} — Klausurtag`;
    } else if (zukunft) {
      cls = "hm-fut"; inhalt = datum; tip = `${wtag} ${datum}`;
    } else {
      const s = stufe(e.n);
      cls = `hm-s${s}`;
      // Vergangene Tage: Anzahl geuebter Karten statt Datum; heute ohne Karten
      // zeigt noch das Datum (der Tag laeuft ja noch). Ruhetage kriegen einen
      // freundlichen Smiley statt einer leeren Zelle (Jennifer 22.07.) — Pause
      // ist Teil des Plans, nicht ein Loch im Kalender.
      inhalt = e.n ? (s === 4 ? `${e.n}<b class="hm-stern">⭐</b>` : String(e.n))
        : (istHeute ? datum : `<span class="hm-ruhe">😴</span>`);
      tip = e.n
        ? `${wtag} ${datum}: ${e.n} Karten · ${Math.round((100 * e.voll) / e.n)} % voll richtig${s === 4 ? " — Streckziel geknackt!" : ""}`
        : `${wtag} ${datum} — Ruhetag`;
    }
    zellen.push(`<span class="hm-zelle ${cls}${istHeute ? " hm-heute" : ""}" title="${tip}">${inhalt}</span>`);
  }

  // ---- Zwei getrennte Charts mit gemeinsamer Zeitachse (Jennifer 22.07.):
  //   1. MENGE  — Karten/Tag als 3- und 7-Tage-Schnitt im Zielband
  //   2. QUALITAET — Punktequote ueber die letzten 5 Uebungstage
  // Bewusst nicht mehr in EINEM Bild: "geuebte Karten" und "Prozent richtig"
  // haben verschiedene Einheiten, und zwei Linien in Terracotta/Gruen sind bei
  // Rotblindheit kaum zu trennen. Getrennte Charts mit je einer Farbe und
  // eigener Beschriftung loesen beides.
  const tage = [];
  for (let d = new Date(Math.min(erster, heute.getTime())); d.getTime() <= heute.getTime(); d.setDate(d.getDate() + 1)) {
    const e = akt[d.getTime()] || { n: 0, voll: 0 };
    tage.push({ ts: d.getTime(), n: e.n, voll: e.voll });
  }
  const glatt = (feld, fenster) => tage.map((_, i) => {
    const s = tage.slice(Math.max(0, i - (fenster - 1)), i + 1);
    return s.reduce((a, t) => a + t[feld], 0) / s.length;
  });
  const g3 = glatt("n", 3), g7 = glatt("n", 7);
  const W = 340;
  // Geknickte Zeitachse: das Geuebte bekommt mindestens 45 % der Breite, auch wenn
  // erst ein paar Tage hinter Rose liegen und 8 Wochen vor ihr. Sonst waere ihre
  // Linie ein unlesbarer Zacken ganz links. Der Knick sitzt genau auf der
  // Heute-Linie und ist damit sichtbar; links steht Gemessenes, rechts die Prognose.
  const gestern = Math.max(1, heute.getTime() - tage[0].ts);
  const gesamt = Math.max(1, ende.getTime() - tage[0].ts);
  const anteil = Math.max(0.45, gestern / gesamt);
  const xStart = 26, xEnd = W - 8, breite = xEnd - xStart;
  const xHeute = xStart + breite * anteil;
  const px = (ts) => ts <= heute.getTime()
    ? xStart + ((ts - tage[0].ts) / gestern) * (xHeute - xStart)
    : xHeute + ((ts - heute.getTime()) / Math.max(1, ende.getTime() - heute.getTime())) * (xEnd - xHeute);
  const hx = xHeute.toFixed(1), ex = xEnd.toFixed(1);

  // ---- Chart 1: Menge (Karten/Tag) ----
  const H1 = 116;
  const maxY = Math.max(tz.stretch + 20, ...g3, ...g7);
  const py = (v) => H1 - 20 - (v / maxY) * (H1 - 30);
  const pfad = (reihe) => tage.map((t, i) => `${px(t.ts).toFixed(1)},${py(reihe[i]).toFixed(1)}`).join(" ");
  // Prognose (Jennifer 22.07.): flach mit dem aktuellen 7-Tage-Schnitt weiter —
  // "wenn du so weitermachst". Die alte lineare Steigungs-Extrapolation vom 21.07.
  // hat "du musst immer mehr schaffen" erzaehlt; die Botschaft ist aber Konstanz.
  const nJetzt = g7[g7.length - 1];
  // Zielband = Tagespensum bis Streckziel, dieselben Zonen wie die Tagesziel-Bar
  const bandOben = py(Math.min(maxY, tz.stretch)), bandUnten = py(tz.ziel);
  // Zukunfts-Schleier rechts von heute: erklaert die leere Flaeche, ohne dort
  // etwas zu behaupten. Beide Charts benutzen ihn — gleiche Zeitachse, gleiche Optik.
  const zukunftFeld = (hoehe, y0 = 0) =>
    `<rect x="${hx}" y="${y0}" width="${Math.max(0, W - 8 - +hx).toFixed(1)}" height="${hoehe}" fill="var(--ink-soft)" opacity=".05"/>`;
  const raster = `${zukunftFeld(H1 - 18 - 6, 6)}
    <rect x="26" y="${bandOben.toFixed(1)}" width="${W - 34}" height="${(bandUnten - bandOben).toFixed(1)}"
      fill="var(--ok)" opacity=".18"/>
    <line x1="26" y1="${bandOben.toFixed(1)}" x2="${W - 8}" y2="${bandOben.toFixed(1)}" stroke="var(--ok)" stroke-width="1" opacity=".4"/>
    <line x1="26" y1="${py(tz.ziel).toFixed(1)}" x2="${W - 8}" y2="${py(tz.ziel).toFixed(1)}" stroke="var(--ok)" stroke-width="1.2" opacity=".7"/>
    <line x1="26" y1="${py(tz.minimum).toFixed(1)}" x2="${W - 8}" y2="${py(tz.minimum).toFixed(1)}" stroke="var(--line)" stroke-width="1" stroke-dasharray="4 4"/>
    <text x="22" y="${(py(tz.ziel) + 3).toFixed(1)}" text-anchor="end" class="kt-tick" font-weight="700">${tz.ziel}</text>
    <text x="22" y="${(py(tz.minimum) + 3).toFixed(1)}" text-anchor="end" class="kt-tick">${tz.minimum}</text>`;
  const mengeSvg = `<svg viewBox="0 0 ${W} ${H1}" class="hm-trend" role="img" aria-label="Geuebte Karten pro Tag im 3- und 7-Tage-Schnitt, mit dem Zielband">
      ${raster}
      <line x1="${hx}" y1="6" x2="${hx}" y2="${H1 - 18}" stroke="var(--line)" stroke-width="1"/>
      <polyline points="${pfad(g3)}" fill="none" stroke="var(--accent)" stroke-width="1" opacity=".4" stroke-linejoin="round" stroke-linecap="round"/>
      <polyline points="${pfad(g7)}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <line x1="${hx}" y1="${py(nJetzt).toFixed(1)}" x2="${ex}" y2="${py(nJetzt).toFixed(1)}" stroke="var(--accent)" stroke-dasharray="5 4" stroke-width="1.4" opacity=".55"/>
      <circle cx="${hx}" cy="${py(nJetzt).toFixed(1)}" r="3" fill="var(--accent)" stroke="var(--card)" stroke-width="1.5"/>
      <text x="${W - 8}" y="${(py(nJetzt) - 7).toFixed(1)}" text-anchor="end" class="kt-wert">${Math.round(nJetzt)} Karten/Tag</text>
      <text x="26" y="${H1 - 5}" class="kt-tick">${fmtDatumKurz(new Date(tage[0].ts))}</text>
      <text x="${hx}" y="${H1 - 5}" text-anchor="middle" class="kt-tick">heute</text>
      <text x="${W - 8}" y="${H1 - 5}" text-anchor="end" class="kt-tick">18.9. 🎓</text>
    </svg>`;

  // ---- Chart 2: Qualitaet (Punktequote je Uebungstag, 5-Tage-Schnitt) ----
  const qTage = C.qualProTag();
  const qVerlauf = C.qualVerlauf(qTage);
  let qualiSvg = "", qualiText = "";
  if (qVerlauf.length >= 2) {
    const H2 = 78;
    // Achse startet bei 40 (oder tiefer, wenn noetig) statt bei 0: die spannende
    // Zone ist 50-100, und darunter wuerde die Linie zum flachen Strich gequetscht.
    const qMin = Math.min(40, ...qVerlauf.map((p) => Math.floor(p.quote / 10) * 10 - 5));
    const qy = (v) => H2 - 16 - ((v - qMin) / (100 - qMin)) * (H2 - 26);
    const qPunkte = qVerlauf.map((p) => `${px(p.ts).toFixed(1)},${qy(p.quote).toFixed(1)}`).join(" ");
    const letzte = qVerlauf[qVerlauf.length - 1];
    const lx = px(letzte.ts);
    qualiSvg = `<svg viewBox="0 0 ${W} ${H2}" class="hm-trend" role="img" aria-label="Punktequote im Schnitt der letzten ${C.QUAL_FENSTER} Uebungstage">
      ${zukunftFeld(H2 - 14 - 4, 4)}
      <rect x="26" y="${qy(100).toFixed(1)}" width="${W - 34}" height="${(qy(75) - qy(100)).toFixed(1)}" fill="var(--ok)" opacity=".12"/>
      <line x1="26" y1="${qy(50).toFixed(1)}" x2="${W - 8}" y2="${qy(50).toFixed(1)}" stroke="var(--line)" stroke-width="1" stroke-dasharray="4 4"/>
      <line x1="26" y1="${qy(75).toFixed(1)}" x2="${W - 8}" y2="${qy(75).toFixed(1)}" stroke="var(--ok)" stroke-width="1.2" opacity=".6"/>
      <text x="22" y="${(qy(50) + 3).toFixed(1)}" text-anchor="end" class="kt-tick">50</text>
      <text x="22" y="${(qy(75) + 3).toFixed(1)}" text-anchor="end" class="kt-tick" font-weight="700">75</text>
      <line x1="${hx}" y1="4" x2="${hx}" y2="${H2 - 14}" stroke="var(--line)" stroke-width="1"/>
      <polyline points="${qPunkte}" fill="none" stroke="var(--ok)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${lx.toFixed(1)}" cy="${qy(letzte.quote).toFixed(1)}" r="3" fill="var(--ok)" stroke="var(--card)" stroke-width="1.5"/>
      <text x="${W - 8}" y="${(qy(letzte.quote) - 7).toFixed(1)}" text-anchor="end" class="kt-wert" fill="var(--ok)">${letzte.quote} %</text>
    </svg>`;
    qualiText = `<p class="muted tz-note"><b>Wie sicher es sitzt:</b> Punktequote im Schnitt deiner letzten ${C.QUAL_FENSTER} Übungstage — aktuell <b>${letzte.quote} %</b>. Ruhetage zählen nicht mit, eine Pause drückt die Linie also nie. <b>50</b> ist die Bestehensgrenze, ab <b>75</b> bist du im sicheren Bereich.</p>`;
  }

  return `<div class="card hm-card">
    <div class="hm-head"><h3>📅 Dein Weg zur Klausur</h3>${M.infoBtn("relearning")}
      <span class="muted hm-rest">noch ${tz.tage} ${tz.tage === 1 ? "Tag" : "Tage"} bis 18.09.</span></div>
    <div class="hm-kal">${kopfzeile}${zellen.join("")}</div>
    <p class="muted tz-note">Vergangene Tage zeigen deine geübten Karten in den Tagesziel-Farben (orange → gelb → grün, <b>gold ⭐ = Streckziel</b>), kommende Tage das Datum. 😴 heißt Ruhetag — die sind eingeplant, jeder Tag startet neu.</p>
    <p class="hm-sub">Wie viel du übst</p>
    ${mengeSvg}
    <p class="muted tz-note">Karten pro Tag: <span class="hm-key stark"></span> Schnitt der letzten 7 Tage, <span class="hm-key fein"></span> der letzten 3 Tage. Das grüne Band ist dein Tagespensum (${tz.ziel}–${tz.stretch}), die gestrichelte Linie unten der Boden für zähe Tage (${tz.minimum}). Ab heute gestrichelt: so läuft es weiter, <b>wenn du dein aktuelles Tempo hältst</b> — es geht nicht um immer mehr, sondern um dranbleiben.</p>
    ${qualiSvg ? `<p class="hm-sub">Wie gut es sitzt</p>${qualiSvg}${qualiText}` : ""}
  </div>`;
}

// ---- Klausurtraining-Karte: die 5 Probeklausuren als freischaltbarer Pfad.
// Alle Kaesten sind klickbar (auch gesperrte -> Info, was zum Freischalten fehlt).
function klausurtrainingHtml() {
  const pks = C.pkStatus();
  if (!pks.length) return "";
  const boxen = pks.map((p) => {
    const roem = C.PK_ROEM[p.nr];
    let cls = "zu", icon = "🔒", sub = "gesperrt";
    if (p.bestanden) { cls = "ok"; icon = "✓"; sub = `${p.beste} P.`; }
    else if (p.offen) { cls = "auf"; icon = "▶"; sub = "offen"; }
    else if (p.fertige.length) { cls = "auf"; icon = "🔁"; sub = `${p.beste} P.`; }
    else if (!p.bereit) { cls = "zu"; icon = "🔧"; sub = "bald"; }
    else if (p.frei) { cls = "auf neu"; icon = "★"; sub = "bereit"; }
    else if (p.vorherFertig && p.fehltKarten != null) { sub = `${C.PK_FREI_KARTEN - p.fehltKarten}/${C.PK_FREI_KARTEN}`; }
    return `<button class="pk-box ${cls}" data-pk="${p.nr}" aria-label="Probeklausur ${roem}">
      <b>${roem}</b><i>${icon}</i><span>${sub}</span></button>`;
  }).join("");
  // Eine konkrete naechste-Schritt-Zeile statt fuenf Statusmeldungen
  const naechste = pks.find((p) => !p.bestanden);
  let zeile;
  if (!naechste) zeile = "Alle fünf bestanden — du hast den kompletten Stoff unter Klausurbedingungen geschafft. 👑";
  else if (naechste.offen) zeile = `${pkLbl(naechste.nr)} liegt angefangen bereit — einfach weitermachen.`;
  else if (naechste.fertige.length) zeile = `${pkLbl(naechste.nr)} nochmal? Beim 2. Durchlauf gibt's auf Wunsch Feedback direkt nach jeder Frage.`;
  else if (!naechste.bereit) zeile = `${pkLbl(naechste.nr)} ist in Vorbereitung — bis dahin: weiter üben, jede Karte zählt schon fürs Freischalten.`;
  else if (naechste.frei) zeile = `${pkLbl(naechste.nr)} ist offen: 42 Fragen, die du so noch nie gesehen hast.`;
  else if (!naechste.vorherFertig) zeile = `Erst ${pkLbl(naechste.nr - 1)} abschließen, dann geht's hier weiter.`;
  else zeile = `${pkLbl(naechste.nr)} schaltet sich frei: noch ${naechste.fehltKarten} Karten üben — egal in welchem Modus.`;
  return `<div class="card pk-card">
    <div class="pk-head"><b>🏆 Klausurtraining</b><span class="muted">5 Probeklausuren · zusammen der ganze Stoff</span></div>
    <div class="pk-track">${boxen}</div>
    <p class="pk-zeile">${zeile}</p>
  </div>`;
}

function home() {
  stopTimer(); R = null;
  const s = C.state();
  const offene = s.offen || [];
  const tz = C.tagesStand();
  const sich = C.sicherheit();

  const offenCards = offene.map((o) => {
    const done = o.runde.filter((r) => r.gewaehlt).length;
    const timed = o.cfg.timerModus && o.cfg.timerModus !== "aus";
    return `<div class="card" style="display:flex;align-items:center;gap:12px">
      <div style="flex:1;min-width:0">
        <b>${sessLbl(o)}</b>${o.versuchNr ? ` <span class="badge-src">${o.versuchNr}. Versuch</span>` : ""}
        <div class="muted">erstellt ${datum(o.erstellt)} · ${done}/${o.runde.length} beantwortet${timed ? ` · ⏱ ${o.restSek != null ? Math.ceil(o.restSek / 60) + " min übrig" : C.timerMinuten(o.runde.length, o.cfg.timerModus) + " min"}` : ""}</div>
        <div class="bar thin mt"><i style="width:${(100 * done) / o.runde.length}%"></i></div>
      </div>
      <button class="btn small" data-resume="${o.id}">Weiter</button>
      <button class="btn ghost small" data-discard="${o.id}" title="Verwerfen">✕</button>
    </div>`;
  }).join("");

  const score = C.lernscore();
  const streak = C.pruefungsStreak();
  const sterneMap = Object.fromEntries(sich.map((t) => [t.slug, t]));
  const themenDetail = Object.entries(C.THEMEN).map(([slug, t]) => {
    const f = C.themaFortschritt(slug);
    const stars = (sterneMap[slug] || {}).stars || 0;
    const subs = C.unterthemen(slug).map(([u], ui) => {
      const sf = C.splitFortschritt(C.pool().filter((q) => q.oberthema === slug && q.unterthema === u && q.quizbar && (q.sprache || "schwer") !== "einfach"));
      if (!sf.n) return "";
      return `<div class="progress-row" style="--tc:${C.subColor(slug, ui)}" title="${stufenTitle(sf)}">
        <span class="lbl" style="font-weight:500;font-size:.87rem">${esc(labelU(u))}</span>
        ${stufenBar(sf, true)}
        <span class="val">${fmtMN(sf)}</span></div>`;
    }).join("");
    return `<details style="--tc:${t.color}">
      <summary style="list-style:none;cursor:pointer"><div class="progress-row" data-stern="${slug}" style="--tc:${t.color}" title="${stufenTitle(f)} · Sicherheit: ${STERN_STATUS[stars]}">
        <span class="lbl">${t.name} ${sterneHtml(stars, true)}</span>${stufenBar(f)}<span class="val">${fmtMN(f)}</span></div></summary>
      <div style="margin:2px 0 10px 8px">${subs}</div></details>`;
  }).join("");

  const eintraege = histEintraege();
  // Kompakte Zuletzt-Liste (Jennifer 21.07.): mehr Eintraege sichtbar
  const letzte = eintraege.slice(0, 7).map((x) => x.html).join("");

  h(`<div class="fade-in" id="homeRoot">
    <div class="topbar"><h1>Schultheorie‑Trainer ✏️</h1>${themeBtnHtml()}<button class="btn ghost small" id="gear" title="Einstellungen">⚙️</button></div>

    ${tageszielHtml(tz, sich)}

    ${klausurtrainingHtml()}

    ${Spiele.hubHtml()}

    ${offene.length ? `<h2 class="mt">Offene Sessions</h2>${offenCards}` : ""}

    <h2 class="mt">Neue Session</h2>
    <div class="mode-grid">
      <button class="mode-card wide" data-go="klausur"><b>🎓 Klausur-Simulation</b><span>42 Fragen · Exam.UP-Look · echtes Scoring · 90/120 min</span></button>
      <button class="mode-card" data-go="halbe"><b>🕧 Halbe Klausur</b><span>21 Fragen · Exam.UP-Look · pausierbar</span></button>
      <button class="mode-card" data-go="spaced"><b>🧠 Schlaues Wiederholen</b><span>Spaced Repetition: Fälliges zuerst + Neues</span></button>
      <button class="mode-card" data-go="schnell"><b>⚡ Schnelle 10er</b><span>10 Fragen, sofortiges Feedback</span></button>
      <button class="mode-card" data-go="fehler"><b>🔁 Fehler-Training</b><span>Nur Fragen, die noch wackeln</span></button>
      <button class="mode-card wide" data-go="sprach"><b>🗣 Sprachverständnis</b><span>Fragen knacken: erst paraphrasieren, dann jede Option einzeln beurteilen — entschärft NICHT-Fragen</span></button>
      <button class="mode-card wide" data-go="eigene"><b>🧩 Eigene Runde</b><span>Themen, Timer, Feedback — alles frei wählbar</span></button>
    </div>

    <h2 class="mt">Stöbern</h2>
    <button class="mode-card wide" data-go="explore" style="width:100%"><b>🗂 Alle Fragen browsen</b><span>Nach Thema & Quelle sortiert, aufklappbar, direkt übbar</span></button>

    <h2 class="mt">Wo du stehst</h2>
    <div class="card mt" style="margin-top:8px">
      <div class="progress-row" style="--tc:var(--accent)">
        <span class="lbl">Lernscore</span><span class="bar"><i style="width:${score}%"></i></span><span class="val">${score}%</span>
      </div>
      <p class="muted" style="margin:0 0 6px">${(() => {
        const g = C.gesamtFortschritt(); const inA = g.st.gem + g.st.weg + g.st.ang;
        return `In Arbeit: <b>${inA}</b> von ${g.n} Fragen · ${g.st.weg} auf gutem Weg${g.st.gem ? ` · ${g.st.gem} gemeistert ✓` : ""}`;
      })()}</p>
      <div class="progress-row" style="--tc:var(--ok)">
        <span class="lbl">Prüfungsreife</span>
        <span class="streak inline">${[0,1,2,3,4].map((i) => `<i class="${i < streak ? "hit" : ""}">${i < streak ? "✓" : ""}</i>`).join("")}</span>
        <span class="val">${streak}/5</span>
      </div>
      <p class="muted" style="margin:4px 0 12px">5 bestandene Klausur-Simulationen in Folge = bereit. Du schaffst das.</p>
      ${themenDetail}
      ${sternSchrittHtml(sich)}
      <p class="muted tz-note" style="margin-top:10px">Balken: kräftig = gemeistert · mittel = auf gutem Weg · hell = angefangen; die Zahl = Fragen in Arbeit. ★-Sterne = Sicherheit aus deinen letzten Antworten je Thema (⭐⭐ sicher, ⭐⭐⭐ prüfungsreif) — aktuell <b>${sich.filter((t) => t.stars >= 2).length}/6</b> sicher.</p>
    </div>

    ${heatmapHtml(tz)}

    ${statInhaltHtml()}

    ${letzte ? `<h2 class="mt">Zuletzt</h2><div class="card hist-kompakt">${letzte}
      <button class="btn ghost small mt" data-go="verlauf">Alle ${eintraege.length} Einträge ansehen ›</button></div>` : ""}
  </div>`);

  app.querySelectorAll("[data-go]").forEach((b) => b.onclick = () => route(b.dataset.go));
  Spiele.bindHub(home, { begriffe: begriffeHome });
  app.querySelectorAll("[data-pk]").forEach((b) => b.onclick = () => pkScreen(+b.dataset.pk));
  app.querySelectorAll("[data-resume]").forEach((b) => b.onclick = () => resumeSession(b.dataset.resume));
  app.querySelectorAll("[data-discard]").forEach((b) => b.onclick = async () => {
    if (await frag("Diese offene Session verwerfen? (wird nicht gewertet)", { ja: "Verwerfen", nein: "Behalten" })) { C.verwerfeOffene(b.dataset.discard); home(); }
  });
  bindHist(home);
  const tb = document.getElementById("themeBtn");
  tb.onclick = () => toggleTheme(tb);
  document.getElementById("gear").onclick = einstellungen;

  bindUebe(); // Ein-Tipp-Runde zum naechsten Stern + Statistik-Hebel
  belebeStats(document.getElementById("homeRoot")); // Statistik wohnt jetzt hier

  // Feiern (einmalig, geraetelokal): Tagespensum erreicht -> Konfetti einmal pro Tag,
  // Streckziel -> zweites, groesseres Konfetti; Sternaufstieg -> Konfetti + Puls.
  // Abstiege werden bewusst NIE kommentiert — ehrlich anzeigen, nicht reinreiben.
  const heuteKey = new Date().toDateString();
  let gefeiert = false;
  if ((tz.tage == null || tz.tage > 0) && tz.n >= tz.ziel && s.settings.tzFeier !== heuteKey) {
    s.settings.tzFeier = heuteKey; C.save();
    konfetti(); gefeiert = true;
  }
  if ((tz.tage == null || tz.tage > 0) && tz.n >= tz.stretch && s.settings.tzFeierGold !== heuteKey) {
    s.settings.tzFeierGold = heuteKey; C.save();
    if (!gefeiert) { konfetti({ n: 90, ms: 3600 }); gefeiert = true; }
  }
  const alteSterne = s.settings.sterneStand;
  if (alteSterne) for (const t of sich) if (t.stars > (alteSterne[t.slug] || 0)) {
    document.querySelector(`[data-stern="${t.slug}"]`)?.classList.add("neu");
    if (!gefeiert) { konfetti({ n: 32 }); gefeiert = true; }
  }
  s.settings.sterneStand = Object.fromEntries(sich.map((t) => [t.slug, t.stars]));
  C.save();
}

function histRow(s) {
  const status = s.status === "abgebrochen" ? `<span class="badge-src badge-unsicher">abgebrochen</span>` : s.bestanden ? `<span class="badge-src" style="background:var(--ok-bg);color:var(--ok)">bestanden</span>` : `<span class="badge-src">fertig</span>`;
  const versuch = s.versuchNr > 1 ? `<span class="badge-src badge-versuch">${s.versuchNr}. Versuch</span> ` : "";
  return `<div class="hist-item click" data-open="${s.id}"><div><b>${sessLbl(s)}</b> ${versuch}${status}
    <div class="when">erstellt ${datum(s.erstellt || s.ts)} · abgeschlossen ${datum(s.ts)} · ${s.beantwortet}/${s.anzahl} Fragen · ${Math.round(s.dauerSek / 60)} min</div></div>
    <span class="sc">${s.punkte}/${s.max}</span>
    ${s.runde && !s.bestanden && s.beantwortet < s.anzahl ? `<button class="btn small" data-reopen="${s.id}" title="Offene Fragen weitermachen">Fortsetzen</button>` : ""}
    ${(s.runde?.length || s.proFrage?.length) ? `<button class="btn ghost small" data-retry="${s.id}" title="Gleiche Fragen nochmal üben — als neuer Versuch, der alte Eintrag bleibt">🔁</button>` : ""}
    <button class="btn ghost small" data-del="${s.id}" title="Session löschen">🗑</button></div>`;
}
// Einzeln geübte Fragen (Stöbern) und Spiel-/Begriffe-Runden als Tages-Eintrag
// im Verlauf — vollwertige Übung, sichtbar und löschbar (aid-Grabsteine), damit
// z. B. Test-Antworten wieder rausfliegen können.
function histRowEinzel(e) {
  return `<div class="hist-item click" data-einzel="${e.id}"><div><b>${e.icon} ${e.label}</b> <span class="badge-src">${e.badge}</span>
    <div class="when">${datum(e.erstellt)} · ${e.n} ${e.n === 1 ? "Karte" : "Karten"} geübt</div></div>
    ${e.max ? `<span class="sc">${e.punkte}/${e.max}</span>` : ""}
    <button class="btn ghost small" data-del-einzel="${e.id}" title="Diese Antworten löschen">🗑</button></div>`;
}
// Sessions + Einzelfragen-Tage gemischt, Neuestes zuerst
function histEintraege() {
  return [
    ...C.state().sessions.map((s) => ({ ts: s.ts, html: histRow(s) })),
    ...C.einzelGruppen().map((e) => ({ ts: e.ts, html: histRowEinzel(e) })),
  ].sort((a, b) => b.ts - a.ts);
}
// Verlaufs-Zeilen: antippen öffnet die Detail-Auswertung, 🗑 löscht,
// „Fortsetzen" holt eine Session mit offenen Fragen zurück (jeweils mit Neuberechnung)
function bindHist(rerender) {
  app.querySelectorAll("[data-open]").forEach((el) => el.onclick = (ev) => {
    if (ev.target.closest("[data-del],[data-reopen],[data-retry]")) return;
    sessionDetail(el.dataset.open, rerender);
  });
  app.querySelectorAll("[data-retry]").forEach((b) => b.onclick = (ev) => {
    ev.stopPropagation();
    retrySession(b.dataset.retry);
  });
  app.querySelectorAll("[data-einzel]").forEach((el) => el.onclick = (ev) => {
    if (ev.target.closest("[data-del-einzel]")) return;
    einzelDetail(el.dataset.einzel, rerender);
  });
  app.querySelectorAll("[data-del-einzel]").forEach((b) => b.onclick = async (ev) => {
    ev.stopPropagation();
    const g = C.einzelGruppen().find((x) => x.id === b.dataset.delEinzel);
    if (!g) return;
    if (await frag(`${g.n} Antworten (${g.label}) vom ${datum(g.erstellt).split(" ")[0]} löschen? Dein Lernstand wird ohne sie neu berechnet — auf allen Geräten.`, { ja: "Löschen", nein: "Behalten" })) {
      C.loescheEinzel(g.antworten.map((a) => a.aid));
      rerender();
    }
  });
  app.querySelectorAll("[data-del]").forEach((b) => b.onclick = async (ev) => {
    ev.stopPropagation();
    if (await frag("Diese Session aus dem Verlauf löschen? Dein Lernstand (Dots & Fortschritt) wird dann ohne sie neu berechnet.", { ja: "Löschen", nein: "Behalten" })) {
      C.loescheSession(b.dataset.del); rerender();
    }
  });
  app.querySelectorAll("[data-reopen]").forEach((b) => b.onclick = (ev) => {
    ev.stopPropagation();
    reopenSession(b.dataset.reopen);
  });
}
// Gleiche Fragen als NEUER Versuch: alter Eintrag bleibt stehen, der neue
// Durchgang wird als 2./3./4. Versuch gezählt und in der Auswertung verglichen.
async function retrySession(id) {
  if (!await frag("Diese Runde mit denselben Fragen nochmal üben? Die Fragen kommen neu gemischt, der alte Eintrag bleibt — dein neuer Durchgang zählt als weiterer Versuch mit Vergleich.", { ja: "Nochmal üben", nein: "Lieber nicht" })) return;
  const sess = C.wiederholeSession(id);
  if (sess) resumeSession(sess.id);
  else sag("Zu dieser Session gibt es keinen Fragen-Snapshot mehr (ältere App-Version).");
}
async function reopenSession(id) {
  // Bestandene Runden nicht fortsetzen: das Fortsetzen würde die Wertung
  // zurückrechnen und das bestandene Ergebnis bei Nicht-Abgabe verlieren.
  // Für einen neuen Anlauf gibt es „Wiederholen".
  const s = C.state().sessions.find((x) => x.id === id);
  if (s?.bestanden) { sag("Diese Runde ist schon bestanden 🎉 - fuer einen neuen Anlauf nimm 'Wiederholen'."); return; }
  if (!await frag("Session fortsetzen? Sie wandert zurück zu den offenen Sessions, die bisherige Wertung wird zurückgerechnet und beim Abschluss neu gemacht.", { ja: "Fortsetzen", nein: "Lieber nicht" })) return;
  const sess = C.reaktiviereSession(id);
  if (sess) resumeSession(sess.id);
  else sag("Diese Session ist aus einer älteren Version und hat keinen Fragen-Snapshot — Fortsetzen geht hier leider nicht.");
}
function sessionDetail(id, zurueck = home) {
  const s = C.state().sessions.find((x) => x.id === id);
  if (!s) return home();
  const pseudo = (s.proFrage || []).filter((x) => C.frage(x.qid)).map((x) => ({ qid: x.qid, optOrder: [...C.frage(x.qid).optionen.keys()], gewaehlt: x.gewaehlt }));
  ergebnis(s, pseudo, { ausVerlauf: true, zurueck });
}
// Detail eines Einzelfragen-Tags: Summen-Karte + dieselben Review-Blöcke wie
// in der Session-Auswertung (neueste Antwort zuerst)
function einzelDetail(id, zurueck = home) {
  const e = C.einzelGruppen().find((x) => x.id === id);
  if (!e) return zurueck();
  const rows = [...e.antworten].reverse().map((a) =>
    a.gewaehlt && C.frage(a.qid) ? reviewQ({ qid: a.qid, optOrder: [...(C.frage(a.qid)?.optionen.keys() || [])], gewaehlt: a.gewaehlt }, a) : ""
  ).join("");
  h(`<div class="fade-in">
    <div class="topbar"><button class="back" id="back">‹</button><h1>${e.icon} ${e.label}</h1></div>
    <div class="card">
      <p style="margin:0"><b>${e.n} ${e.n === 1 ? "Karte" : "Karten"}</b> geübt am ${datum(e.erstellt).split(" ")[0]}${e.max ? ` — <b>${e.punkte}/${e.max} P.</b>` : ""}</p>
      <p class="muted" style="margin:4px 0 0">Zählt fürs Tagesziel${e.art === "explore" ? " und voll in Lernstand & Statistik" : ""} — löschbar über den Verlauf (🗑).</p>
    </div>
    ${rows ? `<div class="card mt"><h3>Alle Fragen im Detail</h3>${rows}</div>` : ""}
  </div>`);
  document.getElementById("back").onclick = zurueck;
}
const fmtSek = (sek) => sek >= 90 ? `${Math.round(sek / 60)} min` : `${sek} s`;

function route(ziel) {
  if (ziel === "explore") explore();
  else if (ziel === "verlauf") verlauf();
  else if (ziel === "statistik") statistik();
  else if (ziel === "begriffe") begriffeHome();
  else builder({ preset: ziel });
}

// ================= EINSTELLUNGEN =================
function syncText() {
  const st = C.syncStatus;
  if (!C.syncAktiv()) return "⏸ Sync aus — ohne Code bleibt der Stand nur auf diesem Gerät.";
  if (st.laeuft) return "⏳ synchronisiert …";
  if (st.fehler) return `⚠️ Letzter Versuch hat nicht geklappt (${esc(st.fehler)}). Wird automatisch nachgeholt.`;
  if (!st.ts) return "Noch nicht synchronisiert.";
  const min = Math.round((Date.now() - st.ts) / 60000);
  return `✅ Zuletzt synchronisiert ${min < 1 ? "gerade eben" : `vor ${min} Min.`}`;
}
function einstellungen() {
  const s = C.state();
  h(`<div class="fade-in">
    <div class="topbar"><button class="back" id="back">‹</button><h1>Einstellungen</h1></div>
    <div class="card">
      <span class="flabel" style="font-weight:700;font-size:.92rem;display:block;margin-bottom:7px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.05em">Aussehen</span>
      <div class="seg" id="themeSeg">
        ${[["auto", "Automatisch"], ["hell", "☀️ Hell"], ["dunkel", "🌙 Dunkel"]].map(([v, l]) =>
          `<button data-v="${v}" class="${(s.settings.theme || "auto") === v ? "on" : ""}">${l}</button>`).join("")}
      </div>
      <p class="muted" style="margin:8px 0 0">Automatisch folgt der Einstellung deines Geräts.</p>
    </div>
    <div class="card">
      <span class="flabel" style="font-weight:700;font-size:.92rem;display:block;margin-bottom:7px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.05em">Lernmethoden</span>
      <p style="margin:0 0 8px">Selbsterklärung bei Fehlern ${M.infoBtn("selbsterklaerung")}<br><span class="muted" style="font-size:.85rem">Erst kurz selbst überlegen, warum es falsch war — dann kommt die Erklärung.</span></p>
      <div class="seg" id="seSeg">
        ${[["standard", "Standard"], ["streng", "Streng"], ["aus", "Aus"]].map(([v, l]) =>
          `<button data-v="${v}" class="${seModus() === v ? "on" : ""}">${l}</button>`).join("")}
      </div>
      <p class="muted" style="margin:8px 0 0">Standard: mit ‚Nur die Antwort zeigen'-Link. Streng: ohne Link — erst erklären, dann weiter. Gilt in allen Modi mit Sofort-Feedback; Klausur-Durchläufe (Feedback erst am Ende) bleiben ohne.</p>
      <div class="pillzeile" id="methodenPills"></div>
    </div>
    <div class="card">
      <p class="muted">Gewertet wird wie in der echten Klausur: +1 Punkt je richtigem Kreuz, −0,5 je falschem, pro Frage minimal 0.</p>
      <div class="btn-row"><button class="btn secondary small" id="exportBtn">Backup exportieren</button>
      <label class="btn secondary small" style="text-align:center">Import<input type="file" id="importBtn" class="hidden" accept=".json"></label></div>
    </div>
    <div class="card">
      <span class="flabel" style="font-weight:700;font-size:.92rem;display:block;margin-bottom:7px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.05em">Geräte-Sync</span>
      <p class="muted" style="margin-top:0">Dein Lernstand liegt online. Alle Geräte mit demselben Sync-Code zeigen denselben Fortschritt — Handy, Laptop, egal.</p>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="text" id="syncCode" class="pw-input" value="${esc(C.syncCode())}" placeholder="Sync-Code" autocomplete="off" autocapitalize="off" spellcheck="false" style="flex:1">
        <button class="btn small" id="syncNow">Jetzt syncen</button>
      </div>
      <p class="muted mt" id="syncInfo">${syncText()}</p>
    </div>
    <div class="card">
      <p class="muted" style="margin-top:0">Hier passiert etwas, aber erst zu einem bestimmten Anlass. 🔮</p>
      <div id="mystZone"><button class="btn secondary small" id="testBestandenBtn">✨ ???</button></div>
    </div></div>`);
  document.getElementById("back").onclick = home;
  document.querySelectorAll("#themeSeg button").forEach((b) => b.onclick = () => {
    C.state().settings.theme = b.dataset.v; C.save(); applyTheme();
    document.querySelectorAll("#themeSeg button").forEach((x) => x.classList.toggle("on", x === b));
  });
  // Pill-Uebersicht (Block F): welche Lernmethoden gerade aktiv sind — auf einen Blick
  const malPills = () => {
    const pills = [
      ["🧠 Abrufübung", true, "retrieval"],
      ["📅 Verteiltes Üben", true, "relearning"],
      [`💬 Selbsterklärung${seModus() === "streng" ? " (streng)" : ""}`, seModus() !== "aus", "selbsterklaerung"],
      ["🗣 Einfache Sprache", s.settings.sprache === "einfach", null],
    ];
    document.getElementById("methodenPills").innerHTML = pills.map(([l, an, key]) =>
      `<span class="pill ${an ? "an" : ""}">${l}${an ? "" : " · aus"}${key ? " " + M.infoBtn(key) : ""}</span>`).join("");
  };
  malPills();
  document.querySelectorAll("#seSeg button").forEach((b) => b.onclick = () => {
    C.state().settings.selbstErkl = b.dataset.v; C.save();
    document.querySelectorAll("#seSeg button").forEach((x) => x.classList.toggle("on", x === b));
    malPills();
  });
  document.getElementById("exportBtn").onclick = C.exportState;
  document.getElementById("importBtn").onchange = async (e) => { if (e.target.files[0]) { await C.importState(e.target.files[0]); await C.syncLernstand(); home(); } };

  // Status-Zeile lebt nur solange dieser Screen sichtbar ist — danach meldet sie sich ab
  const ab = C.onSync(() => {
    const el = document.getElementById("syncInfo");
    if (el) el.innerHTML = syncText(); else ab();
  });
  document.getElementById("syncCode").onchange = (e) => {
    C.state().settings.syncCode = e.target.value.trim().toLowerCase();
    C.save(); C.syncLernstand();
  };
  document.getElementById("syncNow").onclick = () => C.syncLernstand();
  // Kein prompt()/alert() hier — die werden in manchen Kontexten (iframe, Embed)
  // stumm blockiert und es "passiert nichts". Inline-Eingabe ist überall robust.
  document.getElementById("testBestandenBtn").onclick = () => {
    const zone = document.getElementById("mystZone");
    zone.innerHTML = `<div style="display:flex;gap:8px">
        <input type="password" id="mystPw" class="pw-input" placeholder="Passwort" autocomplete="off" autocapitalize="off">
        <button class="btn small" id="mystGo">›</button></div>
      <p class="muted" id="mystFb" style="margin:6px 0 0"></p>`;
    const check = () => {
      if (document.getElementById("mystPw").value.trim().toLowerCase() !== "bestanden") {
        document.getElementById("mystFb").textContent = "Hm, das ist es nicht. 🤫"; return;
      }
      zone.innerHTML = `<p class="muted" style="margin:0 0 8px">Jubel-Vorschau — Stufe wählen (zählt nicht, verändert nichts):</p>
        <div class="seg" id="mystStufen">${[1, 2, 3, 4, 5].map((n) => `<button data-s="${n}">${n === 5 ? "5 👑" : n}</button>`).join("")}</div>`;
      zone.querySelectorAll("#mystStufen button").forEach((b) => b.onclick = () => testBestanden(+b.dataset.s));
    };
    document.getElementById("mystGo").onclick = check;
    document.getElementById("mystPw").onkeydown = (e) => { if (e.key === "Enter") check(); };
    document.getElementById("mystPw").focus();
  };
}

// Fake-Session nur für die Jubel-Vorschau — wird nirgends gespeichert oder gewertet
function testBestanden(stufe) {
  ergebnis({
    id: "test-bestanden", modus: "klausur", status: "fertig", bestanden: true,
    punkte: 61, max: 84, bestehenBei: 42, beantwortet: 42, anzahl: 42,
    dauerSek: 4920, proFrage: [],
  }, [], { zurueck: einstellungen, testStufe: stufe });
}

// ================= BUILDER =================
// Jeder Modus startet mit Einstellungs-Screen; Presets belegen sinnvoll vor.
const PRESETS = {
  klausur: { titel: "🎓 Klausur-Simulation", modus: "klausur", auswahl: "klausur" },
  halbe: { titel: "🕧 Halbe Klausur", modus: "halbe", anzahl: 21, fb: "ende", auswahl: "klausur", ansicht: "exam", hinweis: "Voreingestellt: 21 Fragen im Exam.UP-Look mit halber Zeit, pausierbar. Bestehen ab der Hälfte der Punkte — alles unten frei anpassbar." },
  spaced: { titel: "🧠 Schlaues Wiederholen", modus: "spaced", anzahl: 15, fb: "sofort", spaced: true, auswahl: "smart", hinweis: "Spaced Repetition: Fragen kommen genau dann wieder, wenn sie zu entfallen drohen. Fälliges und Wackliges zuerst, dazu ein paar neue — die effizienteste Art zu üben." },
  schnell: { titel: "⚡ Schnelle 10er", modus: "schnell", anzahl: 10, fb: "sofort", auswahl: "smart", hinweis: "10 Fragen, Feedback direkt nach jeder Antwort. Anpassen, was du magst — oder einfach starten." },
  fehler: { titel: "🔁 Fehler-Training", modus: "fehler", anzahl: 15, fb: "sofort", nurFehler: true, auswahl: "fokus", hinweis: "Nur Fragen, die noch wackeln (Level unter 3). Anpassen oder direkt starten." },
  eigene: { titel: "🧩 Eigene Runde", modus: "eigene", anzahl: 10, fb: "sofort", auswahl: "smart" },
  sprach: { titel: "🗣 Sprachverständnis", modus: "sprach", anzahl: 10, fb: "sofort", auswahl: "sprach", hinweis: "Der Modus für Fragen, die sich sperrig lesen: Erst siehst du NUR die Frage und sagst in eigenen Worten, was sie will (Paraphrasieren). Dann erscheinen die Optionen einzeln und du beurteilst jede für sich mit ‚trifft zu / trifft nicht zu' — aus einer NICHT-Frage werden so einfache Ja/Nein-Urteile. Zum Schluss die normale Auflösung. Ausgewählt werden bevorzugt Fragen, die dir bisher schwerfielen, NICHT-Fragen und lange Stämme." },
};
// Auswahl-Strategien: Label + Erklärung (wird im Builder als Hint gezeigt)
// Drei klar unterscheidbare Strategien (statt vier, die sich paarweise überlappten):
// „schlau" (Spaced Repetition, zeitlich klug) vs. „fokus" (nur Schweres, ohne Timing)
// sind der Schwierigkeits-Zweig; „klausur" ist der repräsentative Zweig. Reines
// „zufall" wurde entfernt — Klausur-Mix deckt „querbeet" besser ab. (core.js
// versteht „zufall" weiterhin, falls in alten Sessions gespeichert.)
const AUSWAHL_OPT = [
  ["smart", "Schlau", "Schlau: wiederholt zum richtigen Zeitpunkt (Spaced Repetition) und mischt Neues dazu — der Standard fürs tägliche Üben bis zur Klausur. (empfohlen)"],
  ["fokus", "Schwächen", "Schwächen: nur Ungelerntes und was noch wackelt, das Schwerste zuerst. Zum gezielten Aufholen eines Themas."],
  ["klausur", "Klausur-Mix", "Klausur-Mix: querbeet über alle Themen verteilt wie in der echten Prüfung, ohne Rücksicht auf schwer oder leicht."],
  ["sprach", "Verstehen", "Verstehen: bevorzugt Fragen, die sich sperrig lesen — NICHT-Fragen, lange Stämme und was dir bisher schwerfiel."],
];
// Seit 21.07. (Jennifers Wunsch): ALLE Optionen sind in JEDEM Modus da — die
// Presets sind nur Voreinstellungen. Einzige Ausnahme: die volle Klausur-
// Simulation bleibt fix (42 Fragen, Exam-Look, Feedback am Ende — ihr Quirk
// IST der Ernstfall). Modus-Eigenheiten (Verstehens-Ablauf, Exam-Flow) leben
// im Fragen-Ablauf, nicht im Builder.
function builder({ preset }) {
  const P = PRESETS[preset] || PRESETS.eigene;
  const istKlausur = preset === "klausur";
  const istSprach = preset === "sprach";              // Paraphrase + Abstempeln fest eingebaut
  const timerAn = istKlausur || preset === "halbe";   // Voreinstellung: Timer laeuft
  const fixAnzahl = istKlausur ? 42 : null;
  const nta = C.state().settings.nta;
  const themenBoxen = Object.entries(C.THEMEN).map(([slug, t]) => {
    const subs = C.unterthemen(slug);
    return `<label class="check" style="--tc:${t.color}">
      <input type="checkbox" class="th" value="${slug}" checked>
      <span><span class="chip" style="--tc:${t.color}">${t.kurz}</span> <b>${t.name}</b></span></label>
      ${subs.map(([u, n], i) => `<label class="check sub"><input type="checkbox" class="uth" data-th="${slug}" value="${slug}/${u}" checked> ${esc(labelU(u))} <span class="muted">(${n})</span></label>`).join("")}`;
  }).join("");

  h(`<div class="fade-in">
    <div class="topbar"><button class="back" id="back">‹</button><h1>${P.titel}</h1></div>
    ${istKlausur ? `<div class="card"><p>42 Fragen quer durch alle Themen, im Look von <b>Exam.UP</b> (der Prüfungsplattform der Uni) wie in der echten Klausur. Feedback gibt's erst am Ende — genau wie im Ernstfall. Das 📕-Skript (alle Folien als PDF) liegt dabei offen, wie in der echten Klausur.</p>
      <p class="muted" style="margin:8px 0 0"><b>Taktik fürs Scoring:</b> Keine Frage leer lassen (unter 0 P. geht eine Frage nie). Erst sicher falsche Optionen streichen, dann kreuzen, sobald du dir besser als 1-zu-3 sicher bist. Zwei Durchgänge: erst die sicheren Fragen, dann die kniffligen.</p></div>` : ""}
    ${P.hinweis ? `<div class="card"><p style="margin:0">${P.hinweis}</p></div>` : ""}
    ${!fixAnzahl ? `<div class="field"><span class="flabel">Fragenzahl</span><div class="seg" id="anz">
      ${[10, 15, 21, 30, 42].map((n) => `<button data-v="${n}" class="${n === (P.anzahl || 10) ? "on" : ""}">${n}</button>`).join("")}</div></div>` : ""}
    <div class="field"><span class="flabel">Timer</span><div class="seg" id="timer">
      <button data-v="aus" class="${timerAn ? "" : "on"}">Ohne</button>
      <button data-v="normal" class="${timerAn && !nta ? "on" : ""}">Normal</button>
      <button data-v="nta" class="${timerAn && nta ? "on" : ""}">+ Nachteilsausgleich</button></div>
      <p class="muted" id="timerHint"></p></div>
    <div class="field"><span class="flabel">Auswahl der Fragen</span><div class="seg" id="auswahl">
      ${AUSWAHL_OPT.map(([v, lbl]) => `<button data-v="${v}" class="${v === (P.auswahl || "smart") ? "on" : ""}">${lbl}</button>`).join("")}</div>
      <p class="muted" id="auswahlHint"></p></div>
    <div class="field"><span class="flabel">Pausierbar</span><div class="seg" id="pause">
      <button data-v="ja" class="${istKlausur ? "" : "on"}">Ja</button><button data-v="nein" class="${istKlausur ? "on" : ""}">Nein (wie echt)</button></div></div>
    ${!istKlausur ? `<div class="field"><span class="flabel">Erklär-Abfrage bei Fehlern ${M.infoBtn("selbsterklaerung")}</span><div class="seg" id="erklaer">
      ${[["aus", "Aus"], ["begruenden", "Begründen"], ["raten", "Erst raten"]].map(([v, l]) =>
        `<button data-v="${v}" class="${v === (seModus() === "aus" ? "aus" : "begruenden") ? "on" : ""}">${l}</button>`).join("")}</div>
      <p class="muted">Begründen: richtig/falsch ist markiert, du sagst kurz warum — dann Erklärungen + KI-Feedback. Erst raten: du siehst nur, WIE VIELE Kreuze falsch waren, tippst welche und warum — nach der Auflösung hältst du nicht erkannte Fallen kurz fest. (Streng/locker stellst du in den Einstellungen.)</p></div>` : ""}
    ${!istKlausur && !istSprach ? `<div class="field"><span class="flabel">Paraphrasieren vor den Antworten ${M.infoBtn("paraphrasieren")}</span><div class="seg" id="para">
      <button data-v="aus" class="on">Aus</button><button data-v="an">An</button></div>
      <p class="muted">An: Vor den Antwortoptionen siehst du erst nur die Frage und sagst kurz, was sie will — dann geht es normal weiter.</p></div>
    <div class="field"><span class="flabel">Optionen einzeln beurteilen ${M.infoBtn("abstempeln")}</span><div class="seg" id="stempeln">
      <button data-v="aus" class="on">Aus</button><button data-v="an">An</button></div>
      <p class="muted">An: Jede Antwort erscheint einzeln mit ‚trifft zu / trifft nicht zu' — die Kreuze setzt die App danach automatisch richtig herum, auch bei NICHT-Fragen. Feedback kommt dabei immer direkt nach jeder Frage.</p></div>` : ""}
    ${!istKlausur && !istSprach ? `<div class="field"><span class="flabel">Feedback</span><div class="seg" id="fb">
      <button data-v="sofort" class="${P.fb === "sofort" ? "on" : ""}">Sofort je Frage</button><button data-v="ende" class="${P.fb === "ende" ? "on" : ""}">Erst am Ende${preset === "halbe" ? " (wie echt)" : ""}</button></div>
      ${`<p class="muted">In der Klausuransicht heißt Sofort: Überprüfen-Button unter jeder Frage — danach ist sie festgelegt.</p>`}</div>` : ""}
    ${!istKlausur && !istSprach ? `<div class="field"><span class="flabel">Ansicht</span><div class="seg" id="ansicht">
      <button data-v="uebung" class="${P.ansicht === "exam" ? "" : "on"}">Übungs-Ansicht</button><button data-v="exam" class="${P.ansicht === "exam" ? "on" : ""}">Klausuransicht</button></div>
      <p class="muted">Klausuransicht = Exam.UP-Look wie in der echten Klausur, mit Fragen-Navigation — läuft immer mit Original-Sprache.</p></div>` : ""}
    ${!istKlausur && C.pool().some((q) => q.sprache === "einfach") ? `<div class="field"><span class="flabel">Sprache</span><div class="seg" id="sprache">
      <button data-v="schwer" class="${(C.state().settings.sprache || "schwer") === "schwer" ? "on" : ""}">Original (Klausur)</button>
      <button data-v="einfach" class="${C.state().settings.sprache === "einfach" ? "on" : ""}">Einfache Sprache</button></div>
      <p class="muted">Einfache Varianten, wo vorhanden — sonst die Original-Frage. Deine Wahl wird gemerkt. Klausur-Simulationen laufen immer mit Original-Sprache (wie im Ernstfall).</p></div>` : ""}
    <div class="field"><span class="flabel">Themen & Unterthemen</span><div class="opt-list">${themenBoxen}</div></div>
    <button class="btn" id="los">Session erstellen & starten</button>
  </div>`);

  document.getElementById("back").onclick = home;
  app.querySelectorAll(".seg").forEach((seg) => seg.querySelectorAll("button").forEach((b) => b.onclick = () => {
    seg.querySelectorAll("button").forEach((x) => x.classList.remove("on")); b.classList.add("on"); updateHint();
  }));
  app.querySelectorAll(".th").forEach((cb) => cb.onchange = () => {
    app.querySelectorAll(`.uth[data-th="${cb.value}"]`).forEach((u) => { u.checked = cb.checked; u.disabled = !cb.checked; });
  });
  const segVal = (id) => app.querySelector(`#${id} button.on`)?.dataset.v;
  const updateHint = () => {
    const n = fixAnzahl || +(segVal("anz") || 10);
    const t = segVal("timer");
    document.getElementById("timerHint").textContent = t === "aus" ? "Ohne Zeitdruck üben." : `≈ ${C.timerMinuten(n, t)} Minuten für ${n} Fragen (${t === "nta" ? "mit" : "ohne"} Nachteilsausgleich, relativ zur echten Klausur).`;
    const ah = document.getElementById("auswahlHint");
    if (ah) ah.textContent = (AUSWAHL_OPT.find(([v]) => v === segVal("auswahl")) || [])[2] || "";
  };
  updateHint();
  document.getElementById("los").onclick = () => {
    const unterthemen = [...app.querySelectorAll(".uth:checked")].map((x) => x.value);
    if (!unterthemen.length) { sag("Mindestens ein Thema auswählen 🙂"); return; }
    // Klausur-/Exam-Modi immer in Original-Sprache (wie im Ernstfall); Übungswahl wird gemerkt
    const examLook = istKlausur || segVal("ansicht") === "exam";
    // Invariante: Exam-Ansichten laufen immer mit Original-Sprache (wie im Ernstfall)
    const sprache = examLook ? "schwer" : (segVal("sprache") || C.state().settings.sprache || "schwer");
    if (!examLook && segVal("sprache")) { C.state().settings.sprache = segVal("sprache"); C.save(); }
    starte({
      modus: P.modus, nurFehler: P.nurFehler || false, spaced: P.spaced || false,
      auswahl: segVal("auswahl") || P.auswahl || "smart",
      anzahl: fixAnzahl || +(segVal("anz") || 10),
      timerModus: segVal("timer"), pausierbar: segVal("pause") === "ja",
      feedback: istKlausur ? "ende" : istSprach || segVal("stempeln") === "an" ? "sofort" : segVal("fb") || "ende",
      examLook, unterthemen,
      sprache,
      paraphrase: !examLook && !istSprach && segVal("para") === "an",
      stempeln: !examLook && !istSprach && segVal("stempeln") === "an",
      erklaerModus: istKlausur ? "aus" : segVal("erklaer") || (seModus() === "aus" ? "aus" : "begruenden"),
    });
  };
}
// Unterthema-Slugs → richtige deutsche Labels (Umlaute, ß, Bindestriche).
// Fallback: aus dem Slug generiert (für neue Unterthemen die Tabelle ergänzen).
const U_LABELS = {
  "allgemein": "Allgemein",
  // Schultheorie I–III
  "bildungsungleichheit": "Bildungsungleichheit", "bourdieu": "Bourdieu", "fend": "Fend",
  "institution-schule": "Institution Schule", "parsons": "Parsons",
  "foucault": "Foucault", "mead": "Mead", "theorienvergleich": "Theorienvergleich", "von-hentig": "von Hentig",
  "comenius": "Comenius", "herbart": "Herbart", "humboldt": "Humboldt", "rousseau": "Rousseau",
  // Schulqualität
  "bildungsstandards-kmk": "Bildungsstandards & KMK", "effektive-schulen": "Effektive Schulen",
  "evaluation": "Evaluation", "five-factor-model": "Five-Factor-Modell", "helmke": "Helmke",
  "kompositionseffekte": "Kompositionseffekte", "lehrerprofessionalitaet": "Lehrerprofessionalität",
  "outputorientierung": "Outputorientierung", "qualitaetsbereiche": "Qualitätsbereiche",
  "schulentwicklung": "Schulentwicklung", "schulleistungsstudien": "Schulleistungsstudien",
  // Schulrecht
  "erziehungs-ordnungsmassnahmen": "Erziehungs- & Ordnungsmaßnahmen", "fortbildungspflicht": "Fortbildungspflicht",
  "grundgesetz": "Grundgesetz", "mitwirkung": "Mitwirkung",
  "informations-beteiligungsrechte": "Informations- & Beteiligungsrechte",
  "rechte-pflichten-lehrkraefte": "Rechte & Pflichten der Lehrkräfte", "rechte-pflichten-sus": "Rechte & Pflichten der SuS",
  "schulaufsicht": "Schulaufsicht", "schulpflicht": "Schulpflicht", "selbststaendigkeit": "Selbstständigkeit der Schule",
  "schulstruktur": "Schulstruktur & Abschlüsse", "zeugnisse": "Zeugnisse & Leistungsbewertung",
  // Motivation
  "attribution": "Attribution", "motivationsfoerderliche-merkmale": "Motivationsförderliche Merkmale",
  "selbstbestimmungstheorie": "Selbstbestimmungstheorie", "zieltheorien": "Zieltheorien",
};
const labelU = (u) => U_LABELS[u] || u.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// ================= PROBEKLAUSUR (Klausurtraining) =================
// Ein Screen fuer jeden Zustand: in Vorbereitung / gesperrt (mit Fortschritt zum
// Freischalten) / bereit (Start wie echt) / gemacht (Wiederholen, beim 2. Durchlauf
// mit Sofort-Feedback-Option). Die Fragen der Probeklausur sind bis zum Bestehen
// im Training gesperrt — sie messen echtes Themenwissen an unbekannten Fragen.
function pkScreen(nr) {
  const p = C.pkStatus().find((x) => x.nr === nr);
  if (!p) return home();
  const roem = C.PK_ROEM[nr];
  const nta = C.state().settings.nta;
  const wiederholung = p.fertige.length > 0;

  let body;
  if (!p.bereit) {
    body = `<div class="card"><p style="margin:0"><b>Diese Probeklausur wird gerade zusammengestellt.</b> 🔧</p>
      <p class="muted" style="margin:8px 0 0">Jede der fünf Probeklausuren bekommt 42 eigene Fragen — keine doppelt, zusammen decken sie den ganzen Stoff ab. Bis es so weit ist: einfach weiter üben, alles zählt schon fürs Freischalten.</p></div>`;
  } else if (!p.frei) {
    const grund = !p.vorherFertig
      ? `<p style="margin:0"><b>🔒 Noch gesperrt.</b> Erst ${pkLbl(nr - 1)} abschließen — dann öffnet sich diese hier Stück für Stück.</p>`
      : `<p style="margin:0"><b>🔒 Fast offen!</b> Noch <b>${p.fehltKarten}</b> Karten üben (egal in welchem Modus), dann schaltet sich ${pkLbl(nr)} frei.</p>
        <div class="bar mt"><i style="width:${Math.round((100 * (C.PK_FREI_KARTEN - p.fehltKarten)) / C.PK_FREI_KARTEN)}%"></i></div>
        <p class="muted" style="margin:8px 0 0">${C.PK_FREI_KARTEN - p.fehltKarten}/${C.PK_FREI_KARTEN} seit ${pkLbl(nr - 1)} — der Sinn dahinter: zwischen zwei Probeklausuren einmal frisch üben, damit die nächste wirklich zeigt, was sitzt.</p>`;
    body = `<div class="card">${grund}</div>
      <button class="btn" id="uebeJetzt" style="width:100%">⚡ 10 Karten üben — bringt dich näher ran</button>`;
  } else {
    const versuche = p.fertige.map((s, i) => `<div class="hist-item click" data-open="${s.id}">
      <div><b>${i + 1}. Versuch</b> ${s.bestanden ? `<span class="badge-src" style="background:var(--ok-bg);color:var(--ok)">bestanden</span>` : `<span class="badge-src">${s.punkte} P.</span>`}
      <div class="when">${datum(s.ts)} · ${Math.round(s.dauerSek / 60)} min</div></div>
      <span class="sc">${s.punkte}/${s.max}</span></div>`).join("");
    body = `
    <div class="card">
      <p style="margin:0">42 Fragen, die du in der App noch nie beantwortet hast — im Exam.UP-Look, mit echtem Scoring und dem 📕-Skript daneben, genau wie im Ernstfall. ${p.bestanden ? "Schon bestanden 🎉 — jeder weitere Durchlauf festigt." : "Bestehst du sie, wandern die Fragen danach in dein Training."}</p>
      <p class="muted" style="margin:8px 0 0"><b>Taktik:</b> Keine Frage leer lassen (unter 0 P. geht keine Frage). Erst sicher falsche Optionen streichen, dann kreuzen, sobald du dir besser als 1-zu-3 sicher bist. Zwei Durchgänge: erst die sicheren, dann die kniffligen.</p>
    </div>
    ${p.offen ? `<div class="card" style="display:flex;align-items:center;gap:12px"><div style="flex:1"><b>Angefangener Durchlauf</b><div class="muted">${p.offen.runde.filter((r) => r.gewaehlt).length}/${p.offen.runde.length} beantwortet</div></div><button class="btn small" id="pkWeiter">Weiter</button></div>` : `
    <div class="field"><span class="flabel">Timer</span><div class="seg" id="pkTimer">
      <button data-v="nta" class="${nta ? "on" : ""}">120 min (dein Nachteilsausgleich)</button>
      <button data-v="normal" class="${nta ? "" : "on"}">90 min</button>
      <button data-v="aus">Ohne</button></div></div>
    ${wiederholung ? `<div class="field"><span class="flabel">Feedback</span><div class="seg" id="pkFb">
      <button data-v="sofort" class="on">Sofort je Frage</button>
      <button data-v="ende">Erst am Ende (wie echt)</button></div>
      <p class="muted">2. Durchlauf: Mit Sofort-Feedback gibt's unter jeder Frage einen Überprüfen-Button mit Erklärungen — zum Lernen aus dem ersten Anlauf.</p></div>` : ""}
    <div class="field"><span class="flabel">Pausierbar</span><div class="seg" id="pkPause">
      <button data-v="ja" class="${wiederholung ? "on" : ""}">Ja</button>
      <button data-v="nein" class="${wiederholung ? "" : "on"}">Nein (wie echt)</button></div></div>
    <button class="btn" id="pkLos">${p.bestanden ? "Nochmal antreten — Score verbessern" : wiederholung ? "Nochmal antreten — diesmal über die Grenze" : "Probeklausur starten"} ›</button>`}
    ${versuche ? `<div class="card mt"><h3>Deine Versuche</h3><p class="muted" style="margin:2px 0 8px;font-size:.84rem">Beste bisher: <b>${p.beste} P.</b> — jeder neue Durchgang zählt als eigener Versuch und wird in der Auswertung verglichen.</p>${versuche}</div>` : ""}`;
  }

  h(`<div class="fade-in">
    <div class="topbar"><button class="back" id="back">‹</button><h1>🏆 Probeklausur ${roem}</h1></div>
    ${body}
  </div>`);
  document.getElementById("back").onclick = home;
  app.querySelectorAll(".seg").forEach((seg) => seg.querySelectorAll("button").forEach((b) => b.onclick = () => {
    seg.querySelectorAll("button").forEach((x) => x.classList.remove("on")); b.classList.add("on");
  }));
  app.querySelectorAll("[data-open]").forEach((el) => el.onclick = () => sessionDetail(el.dataset.open, () => pkScreen(nr)));
  const uj = document.getElementById("uebeJetzt");
  if (uj) uj.onclick = () => starte({ modus: "schnell", anzahl: 10, auswahl: "smart", timerModus: "aus", pausierbar: true, feedback: "sofort", examLook: false, sprache: C.state().settings.sprache || "schwer" });
  const pw = document.getElementById("pkWeiter");
  if (pw) pw.onclick = () => resumeSession(p.offen.id);
  const los = document.getElementById("pkLos");
  if (los) los.onclick = () => {
    const segVal = (id) => app.querySelector(`#${id} button.on`)?.dataset.v;
    const sess = C.erstelleProbeklausur(p, {
      timerModus: segVal("pkTimer") || "nta",
      pausierbar: segVal("pkPause") === "ja",
      feedback: wiederholung ? (segVal("pkFb") || "sofort") : "ende",
    });
    if (!sess) { sag("Die Probeklausur konnte nicht geladen werden — einmal neu laden versuchen."); return; }
    laufLos(sess);
  };
}

// ================= RUNDE =================
function starte(cfg) {
  const sess = C.erstelleSession(cfg);
  if (!sess || sess.runde.length < Math.min(cfg.anzahl, 5)) {
    if (sess) C.verwerfeOffene(sess.id);
    sag("Zu wenig passende Fragen gefunden. Wähle mehr Themen."); return;
  }
  laufLos(sess);
}
// Frisch erstellte Session (Preset, Baukasten oder Probeklausur) sofort loslegen
function laufLos(sess) {
  R = sess;
  R.startTs = Date.now();
  const min = C.timerMinuten(R.runde.length, R.cfg.timerModus);
  if (min) R.deadline = Date.now() + min * 60000;
  C.save();
  zeigFrage();
}
function resumeSession(id) {
  R = C.state().offen.find((o) => o.id === id);
  if (!R) return home();
  R.startTs = Date.now();
  if (R.restSek != null && R.cfg.timerModus !== "aus") R.deadline = Date.now() + R.restSek * 1000;
  // Ohne Timer: erst fragen, ob's losgehen soll — die Fragezeit läuft sonst sofort
  if (R.cfg.timerModus === "aus" && R.cfg.modus !== "klausur" && !R.cfg.examLook) bereit();
  else zeigFrage();
}
function pausiere() {
  Beleg.schliesseSkript();
  bankZeit();
  if (R.deadline) R.restSek = Math.max(0, Math.round((R.deadline - Date.now()) / 1000));
  R.dauerSek = (R.dauerSek || 0) + Math.round((Date.now() - R.startTs) / 1000);
  delete R.deadline; C.save(); home();
}
async function abbrechen() {
  const timed = R.cfg.timerModus && R.cfg.timerModus !== "aus";
  if (timed && !R.cfg.pausierbar) {
    if (await frag("Zeitbegrenzte Session abbrechen? Sie wird als 'abgebrochen' gewertet.", { ja: "Abbrechen & werten", nein: "Weitermachen" })) beende("abgebrochen");
  } else if (await frag("Session beenden und bisherige Antworten werten?", { ja: "Beenden & werten", nein: "Weitermachen" })) beende("fertig");
}
function stopTimer() { if (timerInt) { clearInterval(timerInt); timerInt = null; } }
const fmtUhr = (sek) => `${String(Math.floor(sek / 60)).padStart(2, "0")}:${String(sek % 60).padStart(2, "0")}`;
// Sekündlicher Tick: Header (Countdown bei Timer, sonst Gesamtzeit / ∞) + Zeit auf der aktuellen Frage
function tickTimer() {
  if (!R) return;
  const el = document.getElementById("t-anzeige");
  if (el) {
    if (R.deadline) {
      const rest = Math.max(0, Math.round((R.deadline - Date.now()) / 1000));
      el.textContent = fmtUhr(rest);
      el.classList.toggle("low", rest < 300);
      if (rest <= 0) { stopTimer(); beende("fertig"); return; }
    } else {
      const gesamt = (R.dauerSek || 0) + Math.round((Date.now() - (R.startTs || Date.now())) / 1000);
      el.textContent = `${fmtUhr(gesamt)} / ∞`;
    }
  }
  const qz = document.getElementById("q-zeit");
  if (qz) {
    const r = R.runde[R.idx];
    const sek = (r?.zeitSek || 0) + (qStart != null ? Math.round((Date.now() - qStart) / 1000) : 0);
    qz.textContent = `⏱ ${fmtUhr(sek)}`;
  }
}
function startTick() { tickTimer(); timerInt = setInterval(tickTimer, 1000); }
function beende(status = "fertig") {
  if (!R) return; // z.B. Timer lief ab, während der Abbrechen-Dialog noch offen war
  stopTimer();
  bankZeit();
  Beleg.schliesseSkript();
  const dauerSek = (R.dauerSek || 0) + Math.round((Date.now() - (R.startTs || Date.now())) / 1000);
  const meta = { modus: R.cfg.modus, timerModus: R.cfg.timerModus, dauerSek, sprache: R.cfg.sprache, sessionId: R.id, erstellt: R.erstellt, status, cfg: R.cfg, versuchVon: R.versuchVon, versuchNr: R.versuchNr };
  const rundeKopie = R.runde;
  C.verwerfeOffene(R.id, false); // kein Grabstein: gleich kommt die gewertete Session mit derselben Id
  const session = C.werteAus(rundeKopie, meta);
  R = null;
  ergebnis(session, rundeKopie);
}

function zeigFrage() {
  stopTimer();
  if (R.cfg.modus === "klausur" || R.cfg.examLook) return zeigMoodle();
  // Stempel-Option (Jennifer 21.07.): der Sprachverstaendnis-Ablauf ist in jedem
  // Uebungsmodus zuschaltbar — dann laeuft jede Frage durch Einzel-Urteile.
  if (R.cfg.modus === "sprach" || R.cfg.stempeln) return zeigSprach();
  const r = R.runde[R.idx];
  const q = C.frage(r.qid);
  // Paraphrasieren als zuschaltbare Option in jedem Uebungsmodus (Block D):
  // erst nur der Stamm + "Was will die Frage?", dann die normale Ansicht
  if (R.cfg.paraphrase && !r.paraDone && !r.gewaehlt?.length) return zeigParaphrase();
  // Antworten bei jedem Anzeigen frisch mischen (nur solange unbeantwortet)
  if (!r.gewaehlt?.length) C.shuffle(r.optOrder);
  h(`<div class="fade-in">
    <div class="q-progress">
      <button class="back" id="abbruch">‹</button>
      <span class="bar thin"><i style="width:${(100 * R.idx) / R.runde.length}%"></i></span>
      <span>${R.idx + 1}/${R.runde.length}</span>
      <span class="timer" id="t-anzeige"></span>
      ${R.cfg.pausierbar || R.cfg.timerModus === "aus" ? `<button class="btn ghost small" id="pauseBtn" title="Pausieren">⏸</button>` : ""}
    </div>
    <div class="card">
      <div class="q-head"><span id="qmeta" style="display:contents"></span>
        <span class="q-zeit" id="q-zeit" style="margin-left:auto"></span>
        <span class="q-pts">${q.maxPunkte} P.</span></div>
      ${fallHtml(q)}
      <div class="q-text">${esc(q.frage)}</div>
      ${bildHtml(q)}
      <div class="answers" id="answers">
        ${r.optOrder.map((oi) => `<label class="ans"><input type="checkbox" data-oi="${oi}"><span>${esc(q.optionen[oi].text)}</span></label>`).join("")}
      </div>
      <div id="fbzone"></div>
      <div class="btn-row mt">
        ${R.cfg.feedback === "sofort" ? `<button class="btn" id="pruefen">Antwort prüfen</button>` : ""}
        <button class="btn ${R.cfg.feedback === "sofort" ? "secondary hidden" : ""}" id="weiter">${R.idx + 1 === R.runde.length ? "Abschließen" : "Weiter"}</button>
      </div>
    </div></div>`);
  qStart = Date.now();
  startTick();
  document.getElementById("abbruch").onclick = abbrechen;
  const pb = document.getElementById("pauseBtn"); if (pb) pb.onclick = pausiere;
  const gewaehlt = () => [...app.querySelectorAll("#answers input:checked")].map((x) => +x.dataset.oi);
  const pruefen = document.getElementById("pruefen");
  if (pruefen) pruefen.onclick = () => {
    r.gewaehlt = gewaehlt(); bankZeit();
    pruefen.classList.add("hidden");
    erklaerFlow(q, r, C.scoreFrage(q, r.gewaehlt), () => document.getElementById("weiter")?.classList.remove("hidden"));
  };
  document.getElementById("weiter").onclick = () => {
    if (!r.gewaehlt) r.gewaehlt = gewaehlt();
    bankZeit();
    naechste();
  };
}
// Antwort-Faerbung getrennt von den Erklaerungstexten — die Erklaer-Modi
// zeigen unterschiedlich viel, bevor Rose selbst denkt.
function faerbeAntworten(q, r, mitErklaerungen) {
  app.querySelectorAll("#answers label.ans").forEach((el) => {
    const oi = +el.querySelector("input").dataset.oi;
    const o = q.optionen[oi]; const gw = r.gewaehlt.includes(oi);
    el.querySelector("input").disabled = true;
    if (gw && o.richtig) el.classList.add("correct");
    else if (gw && !o.richtig) el.classList.add("wrong");
    else if (!gw && o.richtig) el.classList.add("missed");
    if (mitErklaerungen && o.erklaerung && (gw || o.richtig) && !el.nextElementSibling?.classList?.contains("explain")) {
      el.insertAdjacentHTML("afterend", `<div class="explain ${o.richtig ? "good" : "bad"}">${Beleg.render(o.erklaerung, q.oberthema)}</div>`);
    }
  });
}
function zeigeFeedback(q, r) {
  const erg = C.scoreFrage(q, r.gewaehlt);
  // Thema erst JETZT verraten — während der Beantwortung wäre es ein Hinweis (Klausurnähe)
  const t = C.THEMEN[q.oberthema] || {};
  const qmeta = document.getElementById("qmeta");
  if (qmeta) qmeta.innerHTML = `<span class="chip" style="--tc:${t.color}">${t.kurz}</span>
    <span class="chip outline" style="--tc:${t.color}">${esc(labelU(q.unterthema))}</span>${qBadges(q)}`;
  faerbeAntworten(q, r, true);
  const fz = document.getElementById("fbzone");
  fz.innerHTML = fbBanner(q, erg) + (r.selbst?.text ? abgleichHtml(r.selbst.abgleich, q.id) : "") + Llm.chatBtnHtml(q);
  const setzAb = (v) => {
    r.selbst.abgleich = v; C.save();
    fz.querySelector("#abgleich").outerHTML = abgleichHtml(v, q.id);
    bindAbgleich(fz, setzAb); // Umentscheiden bleibt erlaubt
  };
  if (r.selbst?.text) bindAbgleich(fz, setzAb);
}
function fbBanner(q, erg) {
  const cls = erg.voll ? "good" : erg.punkte > 0 ? "part" : "bad";
  const txt = erg.voll ? `Voll richtig! +${erg.punkte} P. 🎉` : erg.punkte > 0 ? `Teilweise: ${erg.punkte} von ${q.maxPunkte} P.` : `Diesmal 0 Punkte — die Erklärungen sollten helfen.`;
  return `<div class="fb-banner ${cls}">${sticker(cls)}<span>${txt}</span></div>`;
}
function naechste() {
  if (R.idx + 1 < R.runde.length) {
    R.idx++; C.save();
    // Ohne Timer & ohne Sofort-Feedback: kurz fragen, ob's weitergehen soll —
    // so misst die Zeit pro Frage nur echtes Nachdenken. (Bei Sofort-Feedback
    // ist der Weiter-Klick nach dem Lesen der Erklärungen schon dieses Gate.)
    if (R.cfg.timerModus === "aus" && R.cfg.feedback !== "sofort") bereit();
    else zeigFrage();
  } else beende("fertig");
}
function bereit() {
  stopTimer();
  h(`<div class="fade-in">
    <div class="q-progress">
      <button class="back" id="abbruch">‹</button>
      <span class="bar thin"><i style="width:${(100 * R.idx) / R.runde.length}%"></i></span>
      <span>${R.idx + 1}/${R.runde.length}</span>
      <button class="btn ghost small" id="pauseBtn" title="Pausieren">⏸</button>
    </div>
    <div class="card center">
      <h2>Kurz durchatmen 🍃</h2>
      <p class="muted">Die Zeit pro Frage läuft erst, wenn du bereit bist.</p>
      <button class="btn" id="los">Bereit — Frage ${R.idx + 1} ›</button>
    </div></div>`);
  document.getElementById("abbruch").onclick = abbrechen;
  document.getElementById("pauseBtn").onclick = pausiere;
  document.getElementById("los").onclick = zeigFrage;
}

// ================= SPRACHVERSTAENDNIS-MODUS (Block D NextGen) =================
// Drei Schritte je Frage: (1) Paraphrasieren — nur der Stamm sichtbar, "Was will
// diese Frage von dir?" (Eingabe wird gespeichert & spaeter auswertbar);
// (2) Optionen einzeln abstempeln (trifft zu / trifft nicht zu) — entschaerft
// Negationsfragen zu einfachen Ja/Nein-Urteilen; (3) Aufloesung: die Kreuze
// ergeben sich aus den Urteilen (bei NICHT-Fragen automatisch umgedreht — genau
// das ist der Lerneffekt), danach normales Feedback inkl. Selbsterklaerung.
const sprachKopf = () => `<div class="q-progress">
    <button class="back" id="abbruch">‹</button>
    <span class="bar thin"><i style="width:${(100 * R.idx) / R.runde.length}%"></i></span>
    <span>${R.idx + 1}/${R.runde.length}</span>
    <span class="timer" id="t-anzeige"></span>
    ${R.cfg.pausierbar || R.cfg.timerModus === "aus" ? `<button class="btn ghost small" id="pauseBtn" title="Pausieren">⏸</button>` : ""}
  </div>`;
const sprachDraehte = () => {
  document.getElementById("abbruch").onclick = abbrechen;
  const pb = document.getElementById("pauseBtn"); if (pb) pb.onclick = pausiere;
};
function zeigParaphrase() {
  const r = R.runde[R.idx];
  const q = C.frage(r.qid);
  h(`<div class="fade-in">${sprachKopf()}
    <div class="card">
      <div class="q-head"><span class="muted" style="font-size:.82rem">Erst die Frage knacken — die Antworten kommen gleich ${M.infoBtn("paraphrasieren")}</span><span class="q-zeit" id="q-zeit" style="margin-left:auto"></span></div>
      ${fallHtml(q)}<div class="q-text">${esc(q.frage)}</div>${bildHtml(q)}
      <div class="selbst-box">
        <div class="selbst-kopf"><b>Was will diese Frage von dir?</b></div>
        <textarea id="paraTxt" rows="2" placeholder="In deinen Worten — Stichworte reichen"></textarea>
        <div class="btn-row" style="margin-top:8px"><button class="btn small" id="paraOk">Weiter zu den Antworten ›</button></div>
      </div>
    </div></div>`);
  qStart = Date.now(); startTick(); sprachDraehte();
  document.getElementById("paraOk").onclick = () => {
    r.para = document.getElementById("paraTxt").value.trim() || null;
    r.paraDone = true; bankZeit(); C.save();
    zeigFrage();
  };
}
function zeigSprach() {
  const r = R.runde[R.idx];
  const q = C.frage(r.qid);
  if (!r.urteile && !r.gewaehlt?.length) C.shuffle(r.optOrder);

  // ---- Schritt 1: Paraphrasieren (im Sprach-Modus immer; als Stempel-Option
  // in anderen Modi nur, wenn Paraphrasieren zusaetzlich eingeschaltet ist)
  if ((R.cfg.modus === "sprach" || R.cfg.paraphrase) && !r.paraDone) {
    h(`<div class="fade-in">${sprachKopf()}
      <div class="card">
        <div class="q-head"><span class="muted" style="font-size:.82rem">Schritt 1 von 3 · nur die Frage ${M.infoBtn("paraphrasieren")}</span><span class="q-zeit" id="q-zeit" style="margin-left:auto"></span></div>
        ${fallHtml(q)}<div class="q-text">${esc(q.frage)}</div>${bildHtml(q)}
        <div class="selbst-box">
          <div class="selbst-kopf"><b>Was will diese Frage von dir?</b></div>
          <textarea id="paraTxt" rows="2" placeholder="In deinen Worten — Stichworte reichen"></textarea>
          <div class="btn-row" style="margin-top:8px"><button class="btn small" id="paraOk">Weiter ›</button></div>
        </div>
      </div></div>`);
    qStart = Date.now(); startTick(); sprachDraehte();
    document.getElementById("paraOk").onclick = () => {
      r.para = document.getElementById("paraTxt").value.trim() || null;
      r.paraDone = true; bankZeit(); C.save();
      zeigSprach();
    };
    return;
  }

  // ---- Schritt 2: Optionen einzeln abstempeln
  r.urteile = r.urteile || {};
  const offenOpt = r.optOrder.filter((oi) => r.urteile[oi] === undefined);
  if (offenOpt.length && !r.sprachFertig) {
    const oi = offenOpt[0];
    const nr = r.optOrder.length - offenOpt.length + 1;
    h(`<div class="fade-in">${sprachKopf()}
      <div class="card">
        <div class="q-head"><span class="muted" style="font-size:.82rem">Schritt 2 von 3 · Aussage ${nr}/${r.optOrder.length} ${M.infoBtn("abstempeln")}</span><span class="q-zeit" id="q-zeit" style="margin-left:auto"></span></div>
        <div class="q-fall" style="font-size:.86rem">${esc(q.frage)}</div>
        <div class="sprach-opt"><p>${esc(q.optionen[oi].text)}</p></div>
        <div class="btn-row">
          <button class="btn secondary" id="stimmtNicht">✗ trifft nicht zu</button>
          <button class="btn" id="stimmt">✓ trifft zu</button>
        </div>
        <p class="muted" style="margin:10px 0 0;font-size:.8rem">Beurteile nur diese eine Aussage für sich. Ob am Ende die zutreffenden oder die nicht-zutreffenden gekreuzt werden, dreht die App danach richtig — das übernimmt der Fragen-Stamm.</p>
      </div></div>`);
    qStart = Date.now(); startTick(); sprachDraehte();
    const stempel = (wert) => { r.urteile[oi] = wert; bankZeit(); C.save(); zeigSprach(); };
    document.getElementById("stimmt").onclick = () => stempel(true);
    document.getElementById("stimmtNicht").onclick = () => stempel(false);
    return;
  }

  // ---- Schritt 3: Aufloesung — Kreuze ergeben sich aus den Urteilen
  const dreht = q.fragetyp === "negation";
  if (!r.sprachFertig) {
    r.gewaehlt = r.optOrder.filter((oi) => r.urteile[oi] === (dreht ? false : true));
    r.sprachFertig = true; C.save();
  }
  h(`<div class="fade-in">${sprachKopf()}
    <div class="card">
      <div class="q-head"><span id="qmeta" style="display:contents"></span><span class="q-zeit" id="q-zeit" style="margin-left:auto"></span><span class="q-pts">${q.maxPunkte} P.</span></div>
      ${fallHtml(q)}<div class="q-text">${esc(q.frage)}</div>${bildHtml(q)}
      <div class="explain good" style="margin:8px 0"><span class="bt">${dreht
        ? "Diese Frage will die NICHT-zutreffenden — gekreuzt wurden also automatisch deine ✗-Urteile."
        : "Diese Frage will die zutreffenden — gekreuzt wurden deine ✓-Urteile."}${r.para ? ` Deine Paraphrase: ‚${esc(r.para)}'` : ""}</span></div>
      <div class="answers" id="answers">
        ${r.optOrder.map((oi) => `<label class="ans"><input type="checkbox" data-oi="${oi}" disabled ${r.gewaehlt.includes(oi) ? "checked" : ""}><span>${esc(q.optionen[oi].text)}</span></label>`).join("")}
      </div>
      <div id="fbzone"></div>
      <div class="btn-row mt"><button class="btn hidden" id="weiter">${R.idx + 1 === R.runde.length ? "Abschließen" : "Weiter"}</button></div>
    </div></div>`);
  startTick(); sprachDraehte();
  qStart = null; // Nachdenkzeit stand mit dem letzten Stempel fest — Lesen zaehlt nicht
  const erg = C.scoreFrage(q, r.gewaehlt);
  document.getElementById("weiter").onclick = () => naechste();
  if (!r.selbst) {
    erklaerFlow(q, r, erg, () => document.getElementById("weiter")?.classList.remove("hidden"));
  } else {
    // Wiederaufbau (z. B. nach Pause): Aufloesung direkt, ohne doppeltes Logging
    zeigeFeedback(q, r);
    document.getElementById("weiter").classList.remove("hidden");
  }
}

// ================= EXAM.UP-KLAUSURMODUS =================
// (Exam.UP = Moodle-basierte Prüfungsplattform der Uni Potsdam — Look bewusst nah dran)
// Confidence-Zeile in der Probeklausur: ehrlich, nie Panik. Rechnet das eigene
// Tempo gegen die Restzeit — "du hast Zeit" ist fast immer die wahre Botschaft.
function pkPaceHtml() {
  if (R.cfg.modus !== "probeklausur") return "";
  const beantwortet = R.runde.filter((x) => x.gewaehlt?.length).length;
  let txt;
  if (beantwortet < 5) txt = "💛 Ruhig ankommen: erst die sicheren Fragen, die kniffligen im zweiten Durchgang. Du hast Zeit.";
  else if (!R.deadline) txt = `💪 ${beantwortet} von ${R.runde.length} beantwortet — Stück für Stück.`;
  else {
    const budget = C.timerMinuten(R.runde.length, R.cfg.timerModus) * 60;
    const rest = Math.max(0, Math.round((R.deadline - Date.now()) / 1000));
    const proFrage = (budget - rest) / beantwortet;
    const brauchtNoch = (R.runde.length - beantwortet) * proFrage;
    txt = brauchtNoch < rest * 0.7
      ? `⏱ Du hast Zeit: In deinem Tempo (~${Math.round(proFrage)} s pro Frage) bist du klar vor Schluss durch — ${beantwortet}/${R.runde.length} geschafft.`
      : brauchtNoch < rest
        ? `⏱ Dein Tempo passt genau — ${beantwortet}/${R.runde.length}, einfach so weiter.`
        : "💛 Lieber gründlich als hastig: Unbeantwortet kostet nie Minuspunkte. Erst alle sicheren Punkte holen.";
  }
  return `<div class="pk-pace">${txt}</div>`;
}
function zeigMoodle() {
  stopTimer();
  const r = R.runde[R.idx];
  const q = C.frage(r.qid);
  // Antworten bei jedem Anzeigen frisch mischen — aber nur solange unbeantwortet,
  // sonst springen gespeicherte Kreuze beim Vor/Zurück-Blättern herum
  if (!r.gewaehlt?.length && !r.geprueft) C.shuffle(r.optOrder);
  const single = q.optionen.filter((o) => o.richtig).length === 1;
  // Sofort-Feedback im Exam.UP-Look: Überprüfen-Button je Frage (wie Moodles
  // Übungsmodus). Geprüfte Fragen sind festgelegt und zeigen ihre Erklärungen.
  const locked = !!r.geprueft;
  const erg = locked ? C.scoreFrage(q, r.gewaehlt || []) : null;
  // Folien-Ansicht: In der ECHTEN Klausur liegt die komplette Folien-PDF offen
  // (scrollen/suchen), nicht die passende Folie. Darum ist in der vollen
  // Klausur-Simulation das 📕-Skript der Standard; in Übungs-Klausuransichten
  // startet alles zu (ohne Hilfen), beides bleibt aber jederzeit zuschaltbar —
  // auch die 📄-Folie zur Frage (aus den Beleg-Ankern der Erklärungen).
  if (R.folienSicht === undefined) R.folienSicht = R.folienAuf ? "folie" : ["klausur", "probeklausur"].includes(R.cfg.modus) ? "pdf" : "aus";
  const folSeiten = Beleg.relevanteFolien(q);
  const folienPanel = R.folienSicht !== "folie" ? "" : folSeiten.length ? `
        <div class="moodle-folien" id="mfPanel">
          <div class="mf-bar">
            <button class="fv-btn" id="mfPrev" title="Vorige Folie" aria-label="Vorige Folie">‹</button>
            <span class="mf-cap" id="mfCap">…</span>
            <button class="fv-btn" id="mfNext" title="Nächste Folie" aria-label="Nächste Folie">›</button>
            <span class="fv-sp"></span>
            <button class="fv-btn" id="mfBig" title="Groß ansehen" aria-label="Groß ansehen">⤢</button>
          </div>
          <img id="mfImg" alt="Vorlesungsfolie" loading="lazy">
          <div class="mf-hint">Folie zur Frage · antippen zum Vergrößern${folSeiten.length > 1 ? ` · Belege auf ${folSeiten.length} Folien` : ""}</div>
        </div>` : `
        <div class="moodle-folien" id="mfPanel"><div class="mf-hint">Zu dieser Frage gibt es keinen Folien-Beleg (z.&nbsp;B. Gesetzestext) — nach dem Überprüfen führen die 📖-Chips direkt zur Quelle.</div></div>`;
  h(`<div class="fade-in">
    <div class="moodle">
      <div class="moodle-bar"><span class="brand">exam.UP</span><span>Testversuch</span>
        <button class="mf-toggle${R.folienSicht === "pdf" ? " on" : ""}" id="skriptBtn" title="Ganze Folien-PDF wie in der echten Klausur (scrollen & suchen)">📕 Skript</button>
        <button class="mf-toggle${R.folienSicht === "folie" ? " on" : ""}" id="folienBtn" title="Passende Vorlesungsfolie zur Frage ein-/ausblenden">📄 Folie</button>
        <span class="timer" id="t-anzeige"></span></div>
      <div class="moodle-body">
        <div class="qinfo"><b>Frage ${R.idx + 1}</b>${locked ? "Antwort überprüft" : r.gewaehlt?.length ? "Antwort gespeichert" : "Bisher nicht beantwortet"}<br>Erreichbare Punkte: ${q.maxPunkte.toFixed(2).replace(".", ",")}<br><span class="q-zeit" id="q-zeit"></span></div>
        ${folienPanel}
        ${fallHtml(q)}
        <div class="qtext">${esc(q.frage)}</div>
        <div style="clear:both"></div>
        ${bildHtml(q)}
        <div class="prompt">${single ? "Wählen Sie eine Antwort:" : "Wählen Sie eine oder mehrere Antworten:"}</div>
        ${r.optOrder.map((oi, i) => {
          const o = q.optionen[oi]; const gw = r.gewaehlt?.includes(oi);
          const cls = !locked ? "" : gw && o.richtig ? "correct" : gw ? "wrong" : o.richtig ? "missed" : "";
          const erk = locked && o.erklaerung && (gw || o.richtig) ? `<div class="explain ${o.richtig ? "good" : "bad"}">${Beleg.render(o.erklaerung, q.oberthema)}</div>` : "";
          return `<label class="mans ${cls}"><input type="checkbox" data-oi="${oi}" ${gw ? "checked" : ""} ${locked ? "disabled" : ""}><span>${"abcdefghijkl"[i]}. ${esc(o.text)}</span></label>${erk}`;
        }).join("")}
        ${locked ? (() => {
          // Erst nach dem Überprüfen: Thema + Lernstand-Dots zeigen (wie beim
          // Stöbern) — vorher wäre das Thema ein Hinweis auf die Antwort
          const t = C.THEMEN[q.oberthema] || {};
          return `<div class="q-head" style="margin-top:12px"><span class="chip" style="--tc:${t.color}">${t.kurz}</span>
            <span class="chip outline" style="--tc:${t.color}">${esc(labelU(q.unterthema))}</span>${qBadges(q)}
            <span class="lvl-dots" style="--tc:${t.color}">${lvlDots(q.id)}</span></div>` + fbBanner(q, erg)
            + (r.selbst?.text ? abgleichHtml(r.selbst.abgleich, q.id) : "") + Llm.chatBtnHtml(q);
        })() : ""}
        ${!locked && R.cfg.feedback === "sofort" ? `<button class="btn small" id="check" style="margin-top:10px">Überprüfen</button>` : ""}
      </div>
      <div class="moodle-nav">
        ${R.idx > 0 ? `<button id="prev">Vorherige Seite</button>` : "<span></span>"}
        <button id="next" style="margin-left:auto">${R.idx + 1 === R.runde.length ? "Test beenden …" : "Nächste Seite"}</button>
      </div>
      <div class="moodle-grid" id="grid">
        ${R.runde.map((x, i) => `<button data-i="${i}" class="${x.gewaehlt?.length ? "answered" : ""} ${i === R.idx ? "now" : ""}">${i + 1}</button>`).join("")}
      </div>
      ${pkPaceHtml()}
    </div>
    <div class="btn-row mt">
      ${R.cfg.pausierbar || R.cfg.timerModus === "aus" ? `<button class="btn secondary" id="pauseBtn">⏸ Pausieren</button>` : ""}
      <button class="btn ghost" id="abbruch">Abbrechen</button>
    </div></div>`);
  qStart = locked ? null : Date.now(); // geprüfte Frage: Zeit steht, nur noch lesen
  startTick();
  const setzSicht = (s) => { bankZeit(); R.folienSicht = R.folienSicht === s ? "aus" : s; delete R.folienAuf; C.save(); zeigMoodle(); };
  document.getElementById("skriptBtn").onclick = () => setzSicht("pdf");
  document.getElementById("folienBtn").onclick = () => setzSicht("folie");
  // Skript-Panel lebt im <body> und wird beim Fragenblättern NICHT neu gebaut —
  // Scrollposition/PDF-Suche bleiben stehen (wie das offene PDF im Ernstfall).
  if (R.folienSicht === "pdf") {
    Beleg.oeffneSkript({ onClose: () => { if (R) { R.folienSicht = "aus"; C.save(); document.getElementById("skriptBtn")?.classList.remove("on"); } } });
  } else Beleg.schliesseSkript();
  if (R.folienSicht === "folie" && folSeiten.length) {
    // Blättern nur lokal für diese Frage — beim Weiterblättern zur nächsten Frage
    // startet die Sicht wieder auf deren relevanter Folie.
    let mfSeite = folSeiten[0];
    const img = document.getElementById("mfImg"), cap = document.getElementById("mfCap");
    const mal = () => { img.src = Beleg.bildUrl(mfSeite); cap.textContent = `Folie ${mfSeite} / ${Beleg.TOTAL}`; };
    document.getElementById("mfPrev").onclick = () => { mfSeite = Math.max(1, mfSeite - 1); mal(); };
    document.getElementById("mfNext").onclick = () => { mfSeite = Math.min(Beleg.TOTAL, mfSeite + 1); mal(); };
    document.getElementById("mfBig").onclick = () => Beleg.oeffneFolie(mfSeite);
    img.onclick = () => Beleg.oeffneFolie(mfSeite);
    mal();
  }
  const merke = () => { R.runde[R.idx].gewaehlt = [...app.querySelectorAll(".moodle input:checked")].map((x) => +x.dataset.oi); C.save(); };
  app.querySelectorAll(".moodle input").forEach((i) => i.onchange = merke);
  if (locked && r.selbst?.text) bindAbgleich(app.querySelector(".moodle-body"), (v) => { r.selbst.abgleich = v; C.save(); zeigMoodle(); });
  const prev = document.getElementById("prev"); if (prev) prev.onclick = () => { bankZeit(); R.idx--; zeigMoodle(); };
  document.getElementById("next").onclick = async () => {
    if (R.idx + 1 === R.runde.length) {
      const offen = R.runde.filter((x) => !x.gewaehlt?.length).length;
      if (await frag(offen ? `Noch ${offen} Frage(n) unbeantwortet. Trotzdem abgeben?` : "Test wirklich abgeben?", { ja: "Abgeben", nein: "Zurück" })) beende("fertig");
    } else { bankZeit(); R.idx++; C.save(); zeigMoodle(); }
  };
  document.getElementById("grid").querySelectorAll("button").forEach((b) => b.onclick = () => { bankZeit(); R.idx = +b.dataset.i; zeigMoodle(); });
  const check = document.getElementById("check");
  if (check) check.onclick = () => {
    merke();
    if (!r.gewaehlt?.length) { sag("Erst eine Antwort ankreuzen 🙂"); return; }
    bankZeit(); // Erklärungen lesen zählt nicht als Nachdenkzeit auf der Frage
    const e = C.scoreFrage(q, r.gewaehlt);
    const abschluss = () => {
      r.geprueft = true;
      C.syncEvent({ frage_id: q.id, gewaehlt: r.gewaehlt, punkte: e.punkte, max_punkte: q.maxPunkte, voll: e.voll, modus: R.cfg.modus, ts: new Date().toISOString() });
      C.save();
      zeigMoodle();
    };
    // Selbsterklaerung (auch im 2. Probeklausur-Durchlauf mit Sofort-Feedback):
    // erst selbst ueberlegen, dann loest die Seite mit Erklaerungen auf.
    if (!e.voll && seAktiv(R.cfg.modus)) {
      check.classList.add("hidden");
      const zone = document.createElement("div");
      check.parentNode.insertBefore(zone, check);
      selbstErklStart(zone, e, (selbst) => {
        r.selbst = selbst; abschluss();
        llmSelbstFeedback(q, selbst.text, r.gewaehlt, e);
      });
    } else abschluss();
  };
  const pb = document.getElementById("pauseBtn"); if (pb) pb.onclick = pausiere;
  document.getElementById("abbruch").onclick = abbrechen;
}

// ================= ERGEBNIS =================
// Große Feier bei bestandener Klausur-Simulation: Flork dreht sich rein, zoomt
// ran, dann Regen aus Herzen & Co. Eskaliert mit der Bestanden-Serie (Stufe 1–5):
// jede Stufe mehr Regen, neue Symbole, mehr tanzende Sticker. Stufe 5 = Finale
// (prüfungsreif): alle Happy-Sticker tanzen, goldener Glow, größter Regen.
// Tippen schließt das Overlay (Ergebnis liegt darunter).
const JUBEL_TAENZER = ["rat_dance", "kitten_lift", "patrick_happy", "happy_dog", "laugh_cam", "laughcry", "troll_grin"];
const JUBEL_PLAETZE = [
  "left:4%;top:10%", "right:4%;top:16%", "left:6%;bottom:16%", "right:6%;bottom:12%",
  "left:36%;top:4%", "right:32%;bottom:5%", "left:2%;top:44%", "right:2%;top:40%",
];
const JUBEL_TEXT = ["BESTANDEN! 🎉", "2 IN FOLGE! 🎉🎉", "3 IN FOLGE! 🔥", "4 IN FOLGE — FAST DA! 🔥🔥", "ALLE FÜNF — PRÜFUNGSREIF! 👑"];
function klausurJubel(stufe = 1) {
  stufe = Math.max(1, Math.min(5, Math.round(stufe) || 1));
  const symbole = [
    ["💗", "💖", "💕", "💘", "❤️"],
    ["🏆", "⭐"],
    ["🎉", "🎊"],
    ["👑", "💎"],
    ["🌟", "🥇", "🎓"],
  ].slice(0, stufe).flat();
  // Regen frueh starten (0.5-0.9s) — vorher kam er erst nach 2.4s und wer schnell
  // tippte (Handy!), hat nie Emojis fallen sehen. Bei reduzierter Bewegung gibt es
  // statt Regen sanft einblendende, verteilte Emojis (statisch, aber festlich).
  const regenStart = stufe === 5 ? 0.5 : 0.9;
  const regen = REDUCE_MOTION
    ? Array.from({ length: 18 }, () => {
      const sym = symbole[Math.floor(Math.random() * symbole.length)];
      return `<span class="herz still" style="left:${(Math.random() * 92).toFixed(1)}%;top:${(4 + Math.random() * 80).toFixed(1)}%;font-size:${(1 + Math.random() * 1.5).toFixed(2)}rem;animation-delay:${(0.4 + Math.random() * 0.8).toFixed(2)}s">${sym}</span>`;
    }).join("")
    : Array.from({ length: 28 + stufe * 22 }, () => {
      const sym = symbole[Math.floor(Math.random() * symbole.length)];
      const sw = (6 + stufe * 5 + Math.random() * 12).toFixed(0);
      const spin = (stufe * 110 + Math.random() * 140).toFixed(0);
      return `<span class="herz" style="left:${(Math.random() * 100).toFixed(1)}%;font-size:${(0.9 + Math.random() * 1.7).toFixed(2)}rem;--sw:${sw}px;--spin:${spin}deg;animation-duration:${(2.4 + Math.random() * 2.6).toFixed(2)}s;animation-delay:${(regenStart + Math.random() * 3).toFixed(2)}s">${sym}</span>`;
    }).join("");
  // Tänzer: Sprunghöhe (--amp) wächst mit der Stufe, ab Stufe 3 drehen sich
  // einzelne komplett um sich selbst, im Finale die Hälfte — und alle schneller
  const nTaenzer = stufe === 5 ? 8 : stufe - 1;
  const amp = (1 + Math.max(0, stufe - 2) * 0.22).toFixed(2);
  const taenzer = Array.from({ length: nTaenzer }, (_, i) => {
    const dreht = stufe >= 3 && i % 2 === 1;
    return `<img class="jubel-taenzer${dreht ? " dreht" : ""}" src="${reactSrc(JUBEL_TAENZER[i % JUBEL_TAENZER.length])}" style="${JUBEL_PLAETZE[i % JUBEL_PLAETZE.length]};--amp:${amp};--dl:${(1.6 + i * 0.2).toFixed(2)}s;--d:${(1.3 + Math.random() * 0.8 - stufe * 0.08).toFixed(2)}s" alt="">`;
  }).join("");
  const ov = document.createElement("div");
  ov.className = "jubel" + (stufe === 5 ? " s5" : "");
  ov.innerHTML = `${regen}${taenzer}<img class="jubel-figur" src="${reactSrc("pepe_drool")}" alt="">
    <div class="jubel-text">${JUBEL_TEXT[stufe - 1]}</div>
    <div class="jubel-hint">tippen zum Schließen</div>`;
  document.body.appendChild(ov);
  ov.onclick = () => ov.remove();
}

// Ergebnis-Review: dieselben Tags wie im Stöbern — Quelle samt Fundstelle
// (z.B. Pingo, Folie/Frage-Nr.), Fragetyp, unbestätigt, KI-generiert + Lernstand-Dots
const reviewTags = (q, t) =>
  `<span class="badge-src${q.quelle === "generiert" ? " badge-generiert" : ""}">${esc(C.quelleLabel(q.quelle))}${q.quelleDetail ? " · " + esc(q.quelleDetail) : ""}</span>` +
  (q.fragetyp === "negation" ? `<span class="badge-src">NICHT-Frage</span>` : "") +
  (q.fragetyp === "anwendung" ? `<span class="badge-src">Anwendung</span>` : "") +
  (q.loesungSicherheit === "unsicher" ? `<span class="badge-src badge-unsicher">Lösung unbestätigt</span>` : "") +
  `<span class="lvl-dots" style="--tc:${t.color}">${lvlDots(q.id)}</span>`;

// Ein Frage-Block im Detail-Review (Auswertung & Einzelfragen-Verlauf):
// r = { qid, optOrder, gewaehlt }, erg = { punkte, max, zeit }
function reviewQ(r, erg) {
  const q = C.frage(r.qid); if (!q) return "";
  const t = C.THEMEN[q.oberthema] || {};
  return `<div class="review-q">
    <div class="q-head"><span class="chip" style="--tc:${t.color}">${t.kurz}</span>
      <span class="chip outline" style="--tc:${t.color}">${esc(labelU(q.unterthema))}</span>
      ${reviewTags(q, t)}
      ${erg.zeit != null ? `<span class="badge-src">⏱ ${fmtSek(erg.zeit)}</span>` : ""}
      <span class="q-pts">${erg.punkte}/${erg.max} P.</span></div>
    ${fallHtml(q)}
    <div class="q-text" style="font-size:1rem">${esc(q.frage)}</div>
    ${bildHtml(q)}
    <div class="answers">${r.optOrder.map((oi) => {
      const o = q.optionen[oi]; const gw = r.gewaehlt.includes(oi);
      const cls = gw && o.richtig ? "correct" : gw ? "wrong" : o.richtig ? "missed" : "";
      return `<label class="ans ${cls}"><input type="checkbox" disabled ${gw ? "checked" : ""}><span>${esc(o.text)}</span></label>
        ${o.erklaerung && (gw || o.richtig) ? `<div class="explain ${o.richtig ? "good" : "bad"}">${Beleg.render(o.erklaerung, q.oberthema)}</div>` : ""}`;
    }).join("")}</div>${Llm.chatBtnHtml(q)}</div>`;
}

// Versuchs-Vergleich: frühere Versuche derselben Fragen-Kette als Verlauf mit
// Punktezuwachs — der alte Eintrag bleibt, jeder Versuch ist sichtbar.
function versuchsHtml(session) {
  const vorher = C.vorVersuche(session);
  if (!vorher.length) return "";
  const kette = [...vorher, session];
  const zeilen = kette.map((s, i) => {
    const dies = s.id === session.id;
    const dPrev = i > 0 ? Math.round((s.punkte - kette[i - 1].punkte) * 2) / 2 : null;
    const delta = dPrev == null ? "" : dPrev > 0 ? `<span class="delta up">+${dPrev} P. 📈</span>` : dPrev < 0 ? `<span class="delta down">${dPrev} P.</span>` : `<span class="delta">±0</span>`;
    return `<div class="versuch-row${dies ? " dies" : ""}"><span>${i + 1}. Versuch${dies ? " (dieser)" : ""}</span>
      <span class="muted">${datum(s.ts)}</span><span class="sc">${s.punkte}/${s.max}</span>${delta}</div>`;
  }).join("");
  const letzter = vorher[vorher.length - 1];
  const d = Math.round((session.punkte - letzter.punkte) * 2) / 2;
  const satz = d > 0 ? `<b>+${d} Punkte besser als beim letzten Versuch!</b> Genau so sieht Lernen aus. 🎉`
    : d === 0 ? `Gleich viele Punkte wie beim letzten Versuch — das Wissen hält.`
    : `Diesmal ${Math.abs(d)} P. weniger — Tagesform. Die Erklärungen unten sind der schnellste Weg zurück.`;
  return `<div class="card"><h3>🔁 Deine Versuche im Vergleich</h3>${zeilen}<p class="an-zeile" style="margin-bottom:0">${satz}</p></div>`;
}

// Special-Karte in der Probeklausur-Auswertung: was das Ergebnis WIRKLICH heisst
// (unbekannte Fragen = echtes Themenwissen), Zeit-Realitaet, und der eine
// konkrete Hebel mit realistischer Rechnung — Confidence, aber ehrlich.
function pkErgebnisHtml(session) {
  if (session.modus !== "probeklausur" || !session.cfg?.pk) return "";
  const nr = session.cfg.pk;
  const teile = [];
  teile.push(`<p class="an-zeile">Diese 42 Fragen hattest du vorher <b>nie gesehen</b> — hier zählt Themenwissen, kein Wiedererkennen. Genau das misst auch die echte Klausur. Was du hier holst, holst du auch dort.</p>`);
  if (session.timerModus && session.timerModus !== "aus" && session.beantwortet >= session.anzahl * 0.8) {
    const budget = C.timerMinuten(session.anzahl, session.timerModus);
    const min = Math.round(session.dauerSek / 60);
    if (min <= budget * 0.85) teile.push(`<p class="an-zeile">⏱ <b>${min} von ${budget} Minuten</b> gebraucht — die Zeit ist auf deiner Seite. Im Ernstfall bleibt dir sogar Luft für einen zweiten Durchgang.</p>`);
    else teile.push(`<p class="an-zeile">⏱ ${min} von ${budget} Minuten — gut eingeteilt.</p>`);
  }
  if (session.bestanden) {
    teile.push(`<p class="an-zeile">🎉 <b>Die ${session.anzahl} Fragen sind jetzt für dein Training freigeschaltet</b> — sie tauchen ab sofort beim Üben & Stöbern auf.</p>`);
    const next = C.pkStatus().find((x) => x.nr === nr + 1);
    if (next && !next.bereit) teile.push(`<p class="an-zeile muted">${pkLbl(nr + 1)} ist in Vorbereitung — bis dahin zählt jede geübte Karte schon fürs Freischalten.</p>`);
    else if (next && !next.frei) teile.push(`<p class="an-zeile muted">${pkLbl(nr + 1)} schaltet sich frei, sobald du noch ~${next.fehltKarten} Karten geübt hast.</p>`);
  } else {
    const fehlt = Math.max(0.5, Math.round((session.bestehenBei - session.punkte) * 2) / 2);
    const themen = C.gruppiere(session.proFrage || [], (x) => x.thema);
    const hebel = Object.entries(themen)
      .map(([slug, arr]) => ({ slug, verloren: arr.reduce((a, x) => a + (x.max - x.punkte), 0) }))
      .sort((a, b) => b.verloren - a.verloren)[0];
    const nah = fehlt <= 6;
    teile.push(`<p class="an-zeile">${nah ? `<b>Du warst nah dran:</b> nur ${fehlt} P. unter der Grenze — das ist eine Handvoll Kreuze.` : `Noch <b>${fehlt} P.</b> bis zur Grenze — machbar, und du weißt jetzt genau wo.`}${hebel && hebel.verloren >= fehlt ? ` Allein in <b>${(C.THEMEN[hebel.slug] || {}).name || hebel.slug}</b> lagen ${hebel.verloren} P. — dieses eine Thema kann den Unterschied machen:` : ""}</p>`);
    if (hebel) teile.push(`<div style="margin:4px 0 2px"><button class="btn small" data-uebe="${hebel.slug}">⚡ 10 Karten ${(C.THEMEN[hebel.slug] || {}).name || hebel.slug} üben</button></div>`);
    teile.push(`<p class="an-zeile muted">Tipp für den nächsten Anlauf: Beim 2. Durchlauf kannst du <b>Sofort-Feedback</b> einschalten und aus jeder Frage direkt lernen. Bestehen schaltet die Fragen fürs Training frei.</p>`);
  }
  return `<div class="card pk-card"><h3>🏆 ${pkLbl(nr).replace("🏆 ", "")} — was das heißt</h3>${teile.join("")}</div>`;
}

function ergebnis(session, runde, opts = {}) {
  const pass = session.bestanden;
  const abgebrochen = session.status === "abgebrochen";
  const insights = C.insights(session);
  const rundeAnalyse = C.bewerteRows(session.proFrage || []);
  const zeiten = (session.proFrage || []).map((x) => x.zeit).filter((z) => z != null);
  const avgZeit = zeiten.length ? Math.round(zeiten.reduce((a, b) => a + b, 0) / zeiten.length) : null;
  const themen = C.gruppiere(session.proFrage, (x) => x.thema);
  const themenRows = Object.entries(themen).map(([slug, arr]) => {
    const t = C.THEMEN[slug] || { name: slug };
    const p = arr.reduce((a, x) => a + x.punkte, 0), m = arr.reduce((a, x) => a + x.max, 0);
    // Breakdown je Unterthema (offen, damit man's direkt sieht; antippen klappt zu).
    // Fallback über frage(): alte Sessions haben kein unterthema in proFrage.
    const subs = Object.entries(C.gruppiere(arr, (x) => x.unterthema || C.frage(x.qid)?.unterthema || "allgemein"))
      .sort((a, b) => b[1].length - a[1].length)
      .map(([u, ua], ui) => {
        const up = ua.reduce((a, x) => a + x.punkte, 0), um = ua.reduce((a, x) => a + x.max, 0);
        return `<div class="progress-row" style="--tc:${C.subColor(slug, ui)}">
          <span class="lbl" style="font-weight:500;font-size:.87rem">${esc(labelU(u))} <span class="muted">(${ua.length})</span></span>
          <span class="bar thin"><i style="width:${Math.round((100 * up) / um)}%"></i></span>
          <span class="val">${up}/${um}</span></div>`;
      }).join("");
    return `<details open style="--tc:${t.color}">
      <summary style="list-style:none;cursor:pointer"><div class="progress-row" style="--tc:${t.color}"><span class="lbl">${t.name}</span>
        <span class="bar"><i style="width:${Math.round((100 * p) / m)}%"></i></span><span class="val">${p}/${m}</span></div></summary>
      <div style="margin:2px 0 10px 8px">${subs}</div></details>`;
  }).join("");
  const review = (runde || []).filter((r) => r.gewaehlt).map((r) => {
    const erg = session.proFrage.find((x) => x.qid === r.qid);
    return erg ? reviewQ(r, erg) : "";
  }).join("");

  // "Werde ich besser?": diese Runde gegen den Schnitt der frueheren Runden
  let trendZeile = "";
  if (!abgebrochen && session.max) {
    const fr = C.state().sessions.filter((s) => s.id !== session.id && s.status !== "abgebrochen" && s.max && (s.ts || 0) < (session.ts || Infinity));
    if (fr.length >= 2) {
      const mittel = Math.round(fr.reduce((a, s) => a + (100 * s.punkte) / s.max, 0) / fr.length);
      const dq = Math.round((100 * session.punkte) / session.max) - mittel;
      trendZeile = dq >= 5 ? `<p class="trend-zeile up">📈 ${dq} Punkte über deinem bisherigen Schnitt (${mittel} %) — du wirst besser!</p>`
        : dq <= -5 ? `<p class="trend-zeile">Dein Schnitt liegt bei ${mittel} % — eine Runde sagt wenig, der Trend zählt.</p>`
        : `<p class="trend-zeile">Stabil auf deinem Niveau (Schnitt ${mittel} %).</p>`;
    }
  }
  h(`<div class="fade-in">
    <div class="topbar"><button class="back" id="back">‹</button><h1>Auswertung${session.versuchNr > 1 ? ` <span class="badge-src badge-versuch">${session.versuchNr}. Versuch</span>` : ""}</h1>
      <span style="margin-left:auto;display:inline-flex;gap:4px">
        ${session.runde && !session.bestanden && session.beantwortet < session.anzahl ? `<button class="btn small" id="reopenBtn">Fortsetzen</button>` : ""}
        ${(session.runde?.length || session.proFrage?.length) && session.id !== "test-bestanden" ? `<button class="btn ghost small" id="retryBtn" title="Gleiche Fragen nochmal üben (neuer Versuch)">🔁</button>` : ""}
        <button class="btn ghost small" id="delBtn" title="Session löschen">🗑</button></span></div>
    <div class="card result-big">
      ${abgebrochen ? `<img class="sticker big" src="${reactSrc("monkey_side")}" alt="">` : sticker(pass ? "good" : "sanft", true)}
      <h2>${abgebrochen ? "Abgebrochen — trotzdem gewertet, was da war." : pass ? "Bestanden! 🎉" : "Noch nicht — aber jede Runde zählt."}</h2>
      <div class="pts"><span class="js-count" data-to="${session.punkte}">${session.punkte}</span><span style="font-size:1.3rem;color:var(--ink-soft)"> / ${session.max}</span></div>
      <span class="verdict ${pass ? "pass" : "fail"}">${pass ? "✓ über der Bestehensgrenze" : `Bestehensgrenze: ${session.bestehenBei} P.`}</span>
      <p class="muted mt">${session.beantwortet}/${session.anzahl} beantwortet · ${Math.round(session.dauerSek / 60)} min gesamt${avgZeit != null ? ` · Ø ${fmtSek(avgZeit)} pro Frage` : ""}</p>
      ${trendZeile}
    </div>
    ${pkErgebnisHtml(session)}
    ${versuchsHtml(session)}
    <div class="card an-card"><h3>💡 Wo du stehst</h3>${analyseHtml(rundeAnalyse, "runde")}
      ${insights.length ? `<div class="insight-list">${insights.map((i) => `<div class="insight">${esc(i)}</div>`).join("")}</div>` : ""}</div>
    <div class="card"><h3>Nach Thema & Unterthema</h3>${themenRows}</div>
    ${opts.ausVerlauf ? "" : `<div class="btn-row"><button class="btn" id="nochmal">Neue Session</button><button class="btn secondary" id="homeBtn">Übersicht</button></div>`}
    <div class="card mt"><h3>Alle Fragen im Detail</h3>${review || "<p class='muted'>Keine beantworteten Fragen.</p>"}</div>
  </div>`);
  const zurueck = opts.zurueck || home;
  document.getElementById("back").onclick = zurueck;
  document.getElementById("delBtn").onclick = async () => {
    if (await frag("Diese Session aus dem Verlauf löschen? Dein Lernstand (Dots & Fortschritt) wird dann ohne sie neu berechnet.", { ja: "Löschen", nein: "Behalten" })) { C.loescheSession(session.id); zurueck(); }
  };
  const rb = document.getElementById("reopenBtn"); if (rb) rb.onclick = () => reopenSession(session.id);
  const ry = document.getElementById("retryBtn"); if (ry) ry.onclick = () => retrySession(session.id);
  if (!opts.ausVerlauf) {
    document.getElementById("homeBtn").onclick = home;
    document.getElementById("nochmal").onclick = home;
  }
  bindUebe(); // "Wo du stehst"-Hebel direkt aus der Auswertung ueben
  // Auswertung beleben: Punktzahl zählt hoch, Themen-Balken wachsen rein.
  belebeStats(app.querySelector(".fade-in"));
  // Nur beim frischen Bestehen einer Klausur-Simulation, nicht beim Stöbern im Verlauf.
  // Stufe = aktuelle Bestanden-Serie (die frische Session zählt schon mit).
  if (pass && !abgebrochen && ["klausur", "probeklausur"].includes(session.modus) && !opts.ausVerlauf)
    klausurJubel(opts.testStufe || C.pruefungsStreak());
  // Bestandene Übungsrunde (nicht Klausur — die hat ihr eigenes großes Finale):
  // ein kurzer, gut sichtbarer Konfetti-Regen. Im Verlauf-Blättern nicht.
  else if (pass && !abgebrochen && !opts.ausVerlauf)
    konfetti({ n: 70 });
}

// ================= EXPLORE =================
// 3 Dots je Frage: grün gefüllt bei positivem Level, rot bei negativem
const lvlDots = (qid) => {
  const l = C.lvl(qid);
  return [0, 1, 2].map((i) => `<i class="${l > i ? "on" : -l > i ? "neg" : ""}"></i>`).join("");
};
// Explore-Filter (bleibt beim Hin- und Herwechseln erhalten)
const EXF = { ansicht: "themen", quelle: "alle", typ: "alle", status: "alle" };
// Drei Ansichten im Stoebern: klassischer Themen-Browser, flache Nach-Stand-Liste
// (rot -> gruen), und die Lernlandkarte (Scatter mit Themen-Blasen).
const ANSICHTEN = [["themen", "Themen"], ["stand", "Nach Stand"], ["karte", "🗺 Karte"]];
const ansichtSegHtml = () => `<div class="seg" data-exf="ansicht" style="margin-bottom:10px">${ANSICHTEN.map(([v, l]) =>
  `<button data-v="${v}" class="${EXF.ansicht === v ? "on" : ""}">${l}</button>`).join("")}</div>`;
const bindAnsicht = () => app.querySelectorAll('[data-exf="ansicht"] button').forEach((b) => b.onclick = () => {
  EXF.ansicht = b.dataset.v; explore();
});
const exFilter = (q) => {
  if (EXF.quelle === "og" && q.quelle === "generiert") return false;
  if (EXF.quelle === "ki" && q.quelle !== "generiert") return false;
  if (EXF.quelle === "unsicher" && q.loesungSicherheit !== "unsicher") return false;
  if (EXF.typ !== "alle" && q.fragetyp !== EXF.typ) return false;
  if (EXF.status !== "alle") {
    const l = C.lvl(q.id);
    const seen = C.frageStats(q.id);
    if (EXF.status === "neu" && seen) return false;
    if (EXF.status === "wackelt" && !(seen && l < 3)) return false;
    if (EXF.status === "sitzt" && l < 3) return false;
  }
  return true;
};
function explore() {
  // Fragen aus noch nicht bestandenen Probeklausuren sind hier unsichtbar —
  // wer sie stoebern koennte, wuerde die Probeklausur spoilern.
  const sperr = C.pkGesperrt();
  if (EXF.ansicht === "stand") return exploreStand(sperr);
  if (EXF.ansicht === "karte") return lernkarte(sperr);
  const seg = (id, opts) => `<div class="seg" data-exf="${id}">${opts.map(([v, l]) =>
    `<button data-v="${v}" class="${EXF[id] === v ? "on" : ""}">${l}</button>`).join("")}</div>`;
  const filterRow = `<div class="card" style="padding:10px 12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">
    ${seg("quelle", [["alle", "Alle"], ["og", "Original"], ["ki", "KI"], ["unsicher", "unbestätigt"]])}
    ${seg("typ", [["alle", "Alle Typen"], ["negation", "NICHT"], ["anwendung", "Anwendung"]])}
    ${seg("status", [["alle", "Jeder Stand"], ["neu", "Neu"], ["wackelt", "Wackelt"], ["sitzt", "Sitzt"]])}
  </div>`;
  const bloecke = Object.entries(C.THEMEN).map(([slug, t]) => {
    const subs = C.unterthemen(slug);
    const inner = subs.map(([u], ui) => {
      const qs = C.pool().filter((q) => q.oberthema === slug && q.unterthema === u && (q.sprache || "schwer") !== "einfach" && !sperr.has(q.id) && exFilter(q))
        .sort((a, b) => C.quelleRank(a.quelle) - C.quelleRank(b.quelle));
      if (!qs.length) return "";
      const items = qs.map((q) => `<div class="q-item" data-qid="${q.id}">
        <div class="qq">${esc(q.frage)}</div>
        <div class="meta">
          <span class="badge-src">${esc(C.quelleLabel(q.quelle))}${q.quelleDetail ? " · " + esc(q.quelleDetail) : ""}</span>
          ${q.fragetyp === "negation" ? `<span class="badge-src">NICHT-Frage</span>` : ""}
          ${q.fragetyp === "anwendung" ? `<span class="badge-src">Anwendung</span>` : ""}
          ${q.loesungSicherheit === "unsicher" ? `<span class="badge-src badge-unsicher">unbestätigt</span>` : ""}
          ${q.relevanz === "laut-rose-nicht-relevant" ? `<span class="badge-src">lt. Rose nicht relevant</span>` : ""}
          <span class="lvl-dots" style="--tc:${t.color}">${lvlDots(q.id)}</span>
          <button class="btn ghost small" style="margin-left:auto" data-info="${q.id}" title="Statistik zu dieser Frage">ℹ️</button>
          ${q.quizbar ? `<button class="btn ghost small" data-try="${q.id}">Üben ›</button>` : `<span class="muted" style="font-size:.75rem">keine Lösung</span>`}
        </div><div class="info-zone"></div><div class="try-zone"></div></div>`).join("");
      return `<details class="sub"><summary><span class="chip" style="--tc:${C.subColor(slug, ui)}">${qs.length}</span> ${esc(labelU(u))}</summary>${items}</details>`;
    }).join("");
    if (!inner) return "";
    const f = C.themaFortschritt(slug);
    return `<details class="topic" style="--tc:${t.color}"><summary>${t.name} <span class="muted" style="font-family:Karla;font-size:.85rem">· OG ${f.og.m}/${f.og.n}${f.ki.n ? ` · KI ${f.ki.m}/${f.ki.n}` : ""} gemeistert</span></summary>${inner}</details>`;
  }).join("");
  const sperrOrig = sperr.size ? C.pool().filter((q) => sperr.has(q.id) && (q.sprache || "schwer") !== "einfach").length : 0;
  const sperrHinweis = sperrOrig ? `<p class="muted" style="margin:4px 2px 10px;font-size:.82rem">🏆 ${sperrOrig} Fragen sind gerade für deine Probeklausuren reserviert — nach dem Bestehen tauchen sie hier auf.</p>` : "";
  h(`<div class="fade-in"><div class="topbar"><button class="back" id="back">‹</button><h1>Explore</h1></div>${ansichtSegHtml()}${filterRow}${sperrHinweis}${bloecke || `<p class="muted" style="text-align:center">Kein Treffer mit diesen Filtern.</p>`}</div>`);
  document.getElementById("back").onclick = home;
  app.querySelectorAll("[data-exf]").forEach((seg) => seg.querySelectorAll("button").forEach((b) => b.onclick = () => {
    EXF[seg.dataset.exf] = b.dataset.v; explore();
  }));
  app.querySelectorAll("[data-try]").forEach((b) => b.onclick = () => tryInline(b.dataset.try, b));
  app.querySelectorAll("[data-info]").forEach((b) => b.onclick = () => toggleInfo(b.dataset.info, b));
}

// ---- Nach Stand: flache Liste aller schon geuebten Fragen, gruppiert rot/gelb/gruen,
// Schwaechstes zuoberst — direkt uebbar. (Nie Geuebtes steht im Themen-Browser.)
function exploreStand(sperr) {
  const daten = C.karteDaten().filter((d) => !sperr.has(d.qid)).sort((a, b) => a.quote - b.quote || b.n - a.n);
  const buckets = [
    { key: "rot", titel: "🔴 Wackelt noch", hint: "unter 50 % der Punkte — hier ist am meisten drin", test: (d) => d.quote < 50 },
    { key: "gelb", titel: "🟡 Auf dem Weg", hint: "50–79 %", test: (d) => d.quote < 80 },
    { key: "gruen", titel: "🟢 Sitzt", hint: "ab 80 %", test: () => true },
  ];
  const inBucket = { rot: [], gelb: [], gruen: [] };
  for (const d of daten) inBucket[buckets.find((b) => b.test(d)).key].push(d);
  const row = (d) => {
    const q = C.frage(d.qid); if (!q) return "";
    const t = C.THEMEN[d.thema] || {};
    return `<div class="q-item" data-qid="${d.qid}">
      <div class="qq">${esc(q.frage)}</div>
      <div class="meta">
        <span class="chip" style="--tc:${t.color}">${t.kurz}</span>
        <span class="chip outline" style="--tc:${t.color}">${esc(labelU(d.unter))}</span>
        <span class="q-quote" style="background:color-mix(in srgb, var(--ok) ${d.quote}%, var(--bad))">${d.quote} %</span>
        <span class="badge-src">${d.n}× geübt</span>
        <span class="lvl-dots" style="--tc:${t.color}">${lvlDots(d.qid)}</span>
        <button class="btn ghost small" style="margin-left:auto" data-info="${d.qid}" title="Statistik & Lösung">ℹ️</button>
        <button class="btn ghost small" data-try="${d.qid}">Üben ›</button>
      </div><div class="info-zone"></div><div class="try-zone"></div></div>`;
  };
  const bloecke = buckets.map((b) => inBucket[b.key].length
    ? `<details class="topic" open><summary>${b.titel} <span class="muted" style="font-family:Karla;font-size:.85rem">· ${inBucket[b.key].length} Fragen (${b.hint})</span></summary>${inBucket[b.key].map(row).join("")}</details>`
    : "").join("");
  h(`<div class="fade-in"><div class="topbar"><button class="back" id="back">‹</button><h1>Explore</h1></div>${ansichtSegHtml()}
    ${daten.length ? `<p class="muted" style="margin:0 2px 10px;font-size:.82rem">Alle ${daten.length} Fragen, die du schon geübt hast — sortiert nach Punktequote (echte Versuche, Schnelltipps gefiltert).</p>${bloecke}`
      : `<div class="card"><p class="muted" style="margin:0">Hier landet alles, was du schon geübt hast — nach der ersten Runde wird's bunt. 💪</p></div>`}
  </div>`);
  document.getElementById("back").onclick = home;
  bindAnsicht();
  app.querySelectorAll("[data-try]").forEach((b) => b.onclick = () => tryInline(b.dataset.try, b));
  app.querySelectorAll("[data-info]").forEach((b) => b.onclick = () => toggleInfo(b.dataset.info, b));
}

// ---- Lernlandkarte: jede geuebte Frage als Punkt (x = wie oft geuebt, y = Punktequote,
// Farbe = Thema). Punkt antippen -> Unterthema & Thema als halbtransparente Blasen,
// Detail-Panel mit Ein-Tipp-Runde. Bestehens-Linie bei 50 % zeigt die Ziel-Zone.
function lernkarte(sperr) {
  const daten = C.karteDaten().filter((d) => !sperr.has(d.qid));
  const W = 720, H = 400, padL = 40, padR = 14, padT = 14, padB = 34;
  const maxN = Math.max(4, ...daten.map((d) => d.n));
  const px = (n) => padL + ((Math.min(n, maxN) - 1) / (maxN - 1)) * (W - padL - padR);
  const py = (q) => padT + (1 - q / 100) * (H - padT - padB);
  // Deterministischer Jitter, damit gleiche (n, quote)-Punkte nicht exakt uebereinander liegen
  const jit = (s, r) => { let hsh = 0; for (const c of s) hsh = (hsh * 31 + c.charCodeAt(0)) % 997; return (hsh / 997 - 0.5) * r; };
  for (const d of daten) { d.cx = px(d.n) + jit(d.qid, 16); d.cy = py(d.quote) + jit(d.qid + "y", 12); }
  const dots = daten.map((d) => `<circle data-dot="${d.qid}" data-sub="${d.thema}/${d.unter}" data-th="${d.thema}"
    cx="${d.cx.toFixed(1)}" cy="${d.cy.toFixed(1)}" r="6.5" fill="${(C.THEMEN[d.thema] || {}).hex || "#777"}"/>`).join("");
  const xTicks = [1, Math.round((maxN + 1) / 2), maxN].filter((v, i, a) => a.indexOf(v) === i)
    .map((n) => `<text x="${px(n)}" y="${H - padB + 16}" text-anchor="middle" class="kt-tick">${n}${n === maxN ? "+" : ""}</text>`).join("");
  const chips = Object.entries(C.THEMEN).map(([slug, t]) =>
    `<button class="chip" style="--tc:${t.color}" data-hl="${slug}">${t.kurz}</button>`).join(" ");
  h(`<div class="fade-in"><div class="topbar"><button class="back" id="back">‹</button><h1>Explore</h1></div>${ansichtSegHtml()}
    ${!daten.length ? `<div class="card"><p class="muted" style="margin:0">Die Karte füllt sich mit allem, was du übst — nach der ersten Runde tauchen hier Punkte auf. 💪</p></div>` : `
    <div class="card karte-wrap">
      <p class="muted" style="margin:0 0 8px;font-size:.82rem">Jeder Punkt = eine geübte Frage. Rechts = oft geübt, oben = sitzt. <b>Punkt antippen</b> zeigt seine Themen-Blase — alles über der Linie ist Bestehens-Gebiet.</p>
      <div style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:6px">${chips}</div>
      <svg id="karteSvg" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
        <rect x="${padL}" y="${padT}" width="${W - padL - padR}" height="${py(50) - padT}" fill="var(--ok)" opacity="0.06"/>
        <g id="blobs"></g>
        <line x1="${padL}" y1="${py(50)}" x2="${W - padR}" y2="${py(50)}" stroke="var(--ok)" stroke-dasharray="6 5" stroke-width="1.5" opacity=".7"/>
        <text x="${W - padR - 4}" y="${py(50) - 6}" text-anchor="end" class="kt-tick" fill="var(--ok)">Bestehens-Linie (50 %)</text>
        ${[0, 50, 100].map((q) => `<text x="${padL - 6}" y="${py(q) + 4}" text-anchor="end" class="kt-tick">${q}</text>`).join("")}
        ${xTicks}
        <text x="${W - padR}" y="${H - 4}" text-anchor="end" class="kt-tick">wie oft geübt →</text>
        <text x="${padL - 28}" y="${padT + 10}" class="kt-tick" transform="rotate(-90 ${padL - 28} ${padT + 10})" text-anchor="end">↑ Punktequote</text>
        ${dots}
      </svg>
      <div id="kartePanel"><p class="muted" style="margin:8px 0 0;font-size:.85rem">Tippe einen Punkt oder einen Themen-Chip an.</p></div>
    </div>`}
  </div>`);
  document.getElementById("back").onclick = home;
  bindAnsicht();
  if (!daten.length) return;
  const svg = document.getElementById("karteSvg");
  const blobs = document.getElementById("blobs");
  const panel = document.getElementById("kartePanel");
  const kreise = [...svg.querySelectorAll("circle[data-dot]")];
  const wisch = () => { blobs.innerHTML = ""; kreise.forEach((c) => c.classList.remove("dim", "mid", "sel")); };
  // Halbtransparente Blase (Ellipse) um eine Punktmenge — visualisiert, welcher
  // Bereich als Ganzes Richtung Bestehens-Zone wandern soll
  const blob = (arr, farbe, op, pad) => {
    if (!arr.length) return;
    const xs = arr.map((d) => d.cx), ys = arr.map((d) => d.cy);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    blobs.insertAdjacentHTML("beforeend",
      `<ellipse cx="${(x0 + x1) / 2}" cy="${(y0 + y1) / 2}" rx="${(x1 - x0) / 2 + pad}" ry="${(y1 - y0) / 2 + pad}" fill="${farbe}" opacity="${op}"/>`);
  };
  const uebenBtn = (unterthemen, label) => `<button class="btn small" data-kt-uebe='${JSON.stringify(unterthemen)}'>⚡ 10 Karten ${esc(label)} üben</button>`;
  const bindKtUebe = () => panel.querySelectorAll("[data-kt-uebe]").forEach((b) => b.onclick = () => starte({
    modus: "schnell", anzahl: 10, auswahl: "smart", unterthemen: JSON.parse(b.dataset.ktUebe),
    timerModus: "aus", pausierbar: true, feedback: "sofort", examLook: false, sprache: C.state().settings.sprache || "schwer",
  }));
  const statZeile = (arr) => {
    const q = Math.round(arr.reduce((s, d) => s + d.quote, 0) / arr.length);
    return `${arr.length} geübte ${arr.length === 1 ? "Frage" : "Fragen"} · Ø <b>${q} %</b>${q >= 50 ? " — über der Linie 🎉" : " — die Blase will nach oben"}`;
  };
  const waehlePunkt = (c) => {
    wisch();
    const qid = c.dataset.dot, sub = c.dataset.sub, th = c.dataset.th;
    const d = daten.find((x) => x.qid === qid);
    const hex = (C.THEMEN[th] || {}).hex || "#777";
    const themaPts = daten.filter((x) => x.thema === th);
    const subPts = daten.filter((x) => x.thema + "/" + x.unter === sub);
    blob(themaPts, hex, 0.07, 26);
    blob(subPts, hex, 0.15, 14);
    kreise.forEach((k) => {
      if (k.dataset.sub === sub) k.classList.add("sel");
      else if (k.dataset.th === th) k.classList.add("mid");
      else k.classList.add("dim");
    });
    const t = C.THEMEN[th] || {};
    panel.innerHTML = `<div class="kt-detail">
      <div class="meta" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
        <span class="chip" style="--tc:${t.color}">${t.kurz}</span>
        <span class="chip outline" style="--tc:${t.color}">${esc(labelU(d.unter))}</span>
        <span class="q-quote" style="background:color-mix(in srgb, var(--ok) ${d.quote}%, var(--bad))">${d.quote} %</span>
        <span class="badge-src">${d.n}× geübt</span>
        <span class="lvl-dots" style="--tc:${t.color}">${lvlDots(qid)}</span>
      </div>
      <p style="margin:8px 0;font-size:.92rem">${esc(d.frage)}</p>
      <p class="muted" style="margin:0 0 8px;font-size:.82rem">${esc(labelU(d.unter))} gesamt: ${statZeile(subPts)}</p>
      ${uebenBtn([sub], labelU(d.unter))}
    </div>`;
    bindKtUebe();
  };
  const waehleThema = (slug) => {
    wisch();
    const t = C.THEMEN[slug] || {};
    const pts = daten.filter((x) => x.thema === slug);
    if (!pts.length) { panel.innerHTML = `<p class="muted" style="margin:8px 0 0;font-size:.85rem">Zu ${t.name} ist noch nichts geübt.</p>`; return; }
    blob(pts, t.hex, 0.1, 24);
    kreise.forEach((k) => k.classList.add(k.dataset.th === slug ? "sel" : "dim"));
    const subs = [...new Set(pts.map((x) => x.unter))];
    panel.innerHTML = `<div class="kt-detail">
      <p style="margin:4px 0 8px"><b>${t.name}</b> — ${statZeile(pts)}</p>
      ${uebenBtn(subs.map((u) => slug + "/" + u), t.name)}
    </div>`;
    bindKtUebe();
  };
  svg.addEventListener("click", (e) => {
    const c = e.target.closest("circle[data-dot]");
    if (c) waehlePunkt(c);
    else { wisch(); panel.innerHTML = `<p class="muted" style="margin:8px 0 0;font-size:.85rem">Tippe einen Punkt oder einen Themen-Chip an.</p>`; }
  });
  app.querySelectorAll("[data-hl]").forEach((b) => b.onclick = () => waehleThema(b.dataset.hl));
}
// ℹ️ je Frage: Versuche, Punktequote, Ø Zeit + die letzten Antworten im Detail
// Beleg-Anker (Folien, §§, GG-Artikel) aus Konzept + allen Erklärungen sammeln —
// als klickbare Chips, OHNE die Erklärungstexte (die würden die Lösung spoilern)
function belegAnker(q) {
  const texte = [q.konzept || "", ...q.optionen.map((o) => o.erklaerung || "")];
  const set = new Set();
  for (const t of texte) {
    for (const m of t.match(/Art\.?\s?\d+[a-z]?\s?GG/g) || []) set.add(m.replace(/\s+/g, " "));
    // Berliner SchulG != BbgSchulG — die §§ daraus nicht anbieten (falsches Gesetz)
    if (!/Berlin/.test(t)) for (const m of t.match(/§\s?\d+[a-z]?/g) || []) set.add(m.replace(/§\s*/, "§ "));
    for (const m of t.match(/Folien?\s?\d{1,3}(\s?[–-]\s?\d{1,3})?/g) || []) set.add(m.replace(/\s+/g, " "));
  }
  if (!set.size) return "";
  const rank = (s) => s.startsWith("Folie") ? 0 : s.includes("GG") ? 2 : 1;
  return Beleg.render([...set].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "de", { numeric: true })).join("  ·  "), q.oberthema);
}
function toggleInfo(qid, btn) {
  const zone = btn.closest(".q-item").querySelector(".info-zone");
  if (zone.innerHTML) { zone.innerHTML = ""; return; }
  const q = C.frage(qid);
  const belege = belegAnker(q);
  const kopf = (q.konzept ? `<div><b>Konzept:</b> ${Beleg.render(q.konzept, q.oberthema)}</div>` : "")
    + (belege ? `<div style="margin-top:4px"><b>Nachlesen:</b> ${belege}</div>` : "");
  // Lösung samt Erklärungen — ℹ️ ist bewusstes Nachschlagen, kein Versehen.
  // Wer nicht spicken will, drückt einfach nicht drauf.
  const loesung = q.quizbar ? `<div class="stat-head">Lösung & Erklärungen:</div><div class="answers">
    ${q.optionen.map((o) => `<label class="ans ${o.richtig ? "correct" : ""}"><input type="checkbox" disabled ${o.richtig ? "checked" : ""}><span>${esc(o.text)}</span></label>
      ${o.erklaerung ? `<div class="explain ${o.richtig ? "good" : "bad"}">${Beleg.render(o.erklaerung, q.oberthema)}</div>` : ""}`).join("")}</div>` : "";
  const st = C.frageStats(qid);
  const stats = st
    ? `<div style="margin-top:8px"><b>${st.n}× geübt</b> · ${st.voll}× voll richtig${st.quote != null ? ` · Ø ${st.quote} % der Punkte` : ""}${st.zeit != null ? ` · Ø ${fmtSek(st.zeit)} pro Versuch` : ""}</div>
      <div class="stat-head">Letzte Versuche:</div>${st.letzte.map((a) => `<div class="stat-row"><span>${datum(a.ts)}</span><span>${MODUS_LBL[a.modus] || "🗂 Explore"}</span>
        <span>${a.max ? `${a.punkte}/${a.max} P.` : a.voll ? "voll richtig" : "nicht voll"}</span><span>${a.zeit != null ? fmtSek(a.zeit) : "–"}</span></div>`).join("")}`
    : `<div class="muted" style="margin-top:8px">Noch nie geübt — gute Gelegenheit 🙂</div>`;
  zone.innerHTML = `<div class="q-stats">${kopf}${loesung}${stats}${Llm.chatBtnHtml(q)}</div>`;
}
function tryInline(qid, btn) {
  const q = C.frage(qid);
  const item = btn.closest(".q-item");
  const wrap = item.querySelector(".try-zone");
  const order = [...q.optionen.keys()]; // im Stöbern: Original-Reihenfolge behalten (gemischt wird nur in Sessions)
  wrap.innerHTML = `${fallHtml(q)}${bildHtml(q)}<div class="answers mt" id="try-${qid}">
    ${order.map((oi) => `<label class="ans"><input type="checkbox" data-oi="${oi}"><span>${esc(q.optionen[oi].text)}</span></label>`).join("")}
    </div><button class="btn small mt" id="chk-${qid}">Prüfen (${q.maxPunkte} P.)</button><div class="fbz"></div>`;
  btn.classList.add("hidden");
  const t0 = Date.now();
  document.getElementById(`chk-${qid}`).onclick = () => {
    // Guard gegen Tasten-Repeat/Event-Stuerme: eine gedrueckt gehaltene Enter-Taste
    // hat einmal 113 identische Antworten in 14 s geloggt (8/s = Key-Repeat-Rate)
    if (wrap.dataset.locked) return;
    wrap.dataset.locked = "1";
    const gewaehlt = [...wrap.querySelectorAll("input:checked")].map((x) => +x.dataset.oi);
    const erg = C.scoreFrage(q, gewaehlt);
    const zeit = Math.round((Date.now() - t0) / 1000);
    C.leitnerUpdate(q.id, erg);
    // Antwort sofort loggen (echte Nachdenkzeit) — Selbsterklaerung & Abgleich
    // werden danach an denselben Eintrag gehaengt (ergaenzeAntwort).
    const eintrag = C.logAntwort({ qid: q.id, modus: "explore", gewaehlt, punkte: erg.punkte, max: q.maxPunkte, voll: erg.voll, zeit });
    C.syncEvent({ frage_id: q.id, gewaehlt, punkte: erg.punkte, max_punkte: q.maxPunkte, voll: erg.voll, modus: "explore", ts: new Date().toISOString() });
    document.getElementById(`chk-${qid}`).classList.add("hidden");
    const reveal = (selbst) => {
      wrap.querySelectorAll("label.ans").forEach((el) => {
        const oi = +el.querySelector("input").dataset.oi; const o = q.optionen[oi]; const gw = gewaehlt.includes(oi);
        el.querySelector("input").disabled = true;
        if (gw && o.richtig) el.classList.add("correct"); else if (gw) el.classList.add("wrong"); else if (o.richtig) el.classList.add("missed");
        if (o.erklaerung && (gw || o.richtig)) el.insertAdjacentHTML("afterend", `<div class="explain ${o.richtig ? "good" : "bad"}">${Beleg.render(o.erklaerung, q.oberthema)}</div>`);
      });
      const cls = erg.voll ? "good" : erg.punkte > 0 ? "part" : "bad";
      // Nochmal üben setzt die Zone frisch auf — jeder Versuch zählt einzeln
      const fbz = wrap.querySelector(".fbz");
      fbz.innerHTML = `<div class="fb-banner ${cls}">${sticker(cls)}<span>${erg.voll ? "Voll richtig! 🎉" : `${erg.punkte}/${q.maxPunkte} P.`}</span></div>
        ${selbst?.text ? abgleichHtml(null, q.id) : ""}
        ${Llm.chatBtnHtml(q)}
        <button class="btn small" id="re-${qid}">🔁 Nochmal üben</button>`;
      const setzAb = (v) => {
        C.ergaenzeAntwort(eintrag.aid, { selbstAbgleich: v });
        fbz.querySelector("#abgleich").outerHTML = abgleichHtml(v, q.id);
        bindAbgleich(fbz, setzAb);
      };
      if (selbst?.text) bindAbgleich(fbz, setzAb);
      const dots = item.querySelector(".lvl-dots"); if (dots) dots.innerHTML = lvlDots(q.id);
      document.getElementById(`re-${qid}`).onclick = () => tryInline(qid, btn);
    };
    if (!erg.voll && seAktiv("explore")) {
      selbstErklStart(wrap.querySelector(".fbz"), erg, (selbst) => {
        C.ergaenzeAntwort(eintrag.aid, { selbstErkl: selbst.text, selbstSkip: !!selbst.skip });
        reveal(selbst);
        llmSelbstFeedback(q, selbst.text, gewaehlt, erg);
      });
    } else reveal(null);
  };
}

// Klartext-Auswertung: WAS ist der Hebel (praezise benennen), WIE ermutigend
// rahmen (Optionen statt Befehle, immer ein Staerken-Anker, ein kleinster Schritt).
// Nur belastbare Aussagen — die Schwellen stecken in core.bewerteRows.
function analyseHtml(a, scope = "global") {
  const tn = (slug) => (C.THEMEN[slug] || {}).name || slug;
  if (!a || a.nQual < 3 || (!a.staerken.length && !a.schwaechen.length)) {
    return `<p class="muted">${scope === "runde" ? "Für klare Muster war die Runde noch zu kurz" : "Noch zu wenig echte Antworten für eine klare Auswertung"} — je mehr Runden, desto konkreter wird's hier. 💪</p>`;
  }
  const p = [];
  if (a.schwaechen.length) {
    const w = a.schwaechen[0];
    const bp = w.brennpunkt ? `, vor allem bei ${esc(labelU(w.brennpunkt.u))}` : "";
    let s = `<b>Dein größter Hebel gerade:</b> ${esc(tn(w.thema))}${bp} — im Schnitt ${w.quote}% bei ${w.n} ${w.n === 1 ? "Frage" : "Fragen"}. `;
    s += `Beim Nachlesen führen die 📄-Sprungmarken direkt zur Folie.`;
    if (w.tempo) s += ` Du gehst da oft schnell ran; einmal bewusst langsamer lesen bringt hier am meisten.`;
    s += `<div style="margin-top:8px"><button class="btn small" data-uebe="${w.thema}">⚡ 10 Karten ${esc(tn(w.thema))} üben</button></div>`;
    p.push(`<div class="fokus">${s}</div>`);
  }
  if (a.staerken.length)
    p.push(`<p class="an-zeile"><b>Das sitzt schon:</b> ${a.staerken.map((x) => `<span class="tag-gut">${esc(tn(x.thema))} ${x.quote}%</span>`).join(" ")} — deine Basis, da kannst du dir sicher sein. 💪</p>`);
  if (a.schwaechen.length)
    p.push(`<p class="an-zeile"><b>Hier ist am meisten drin</b> (antippen = direkt üben): ${a.schwaechen.map((x) => `<button class="tag-hebel" data-uebe="${x.thema}" title="10 Karten ${esc(tn(x.thema))} üben">${esc(tn(x.thema))} ${x.quote}% ›</button>`).join(" ")}</p>`);
  if (a.verwechslung?.length)
    p.push(`<p class="muted an-zeile">Leicht zu verwechseln: ${a.verwechslung.slice(0, 3).map((v) => esc(v.paar)).join(" · ")}.</p>`);
  p.push(`<p class="muted an-zeile" style="font-size:.78rem">Basis: deine echten Versuche${scope === "runde" ? " dieser Runde" : ""} (min. 3 s Lesezeit, keine Sofort-Wiederholung), gruppiert nach Thema — Aussagen erst ab 4 Antworten pro Thema.</p>`);
  return p.join("");
}

// ================= STATISTIK =================
// Kompletter Statistik-Inhalt. Wohnt seit 21.07. (Jennifers Wunsch) direkt auf
// der Startseite; die alte Statistik-Route zeigt denselben Inhalt.
function statInhaltHtml() {
  const st = C.statistik();
  const kachel = (wert, lbl) => `<div class="stat-tile"><b>${wert}</b><span>${lbl}</span></div>`;
  const pkt = (v) => `${v.pkt}/${v.maxSchnitt} P.`;
  // Beherrschungs-Schema (Jennifer 21.07., Feinschliff 22.07.): Trenner in JEDEM
  // Balken bei 50 % (Bestehensgrenze), 75 % (sicherer Bereich) und 90 % (besteht
  // auf jeden Fall). Fuellfarbe: rot unter 50, gelb ab 50, GRUEN AB 85 — die
  // Farbe belohnt schon kurz vor der Medaille, die Siegel bleiben strenger
  // (Haken ab 75, Medaille erst ab 90: 90 ist die ehrliche "sicher bestanden"-Marke).
  const GRUEN_AB = 85;
  const quotenFarbe = (q) => q == null ? "var(--line)" : q < 50 ? "var(--bad)" : q < GRUEN_AB ? "#d9b93a" : "var(--ok)";
  const siegel = (q) => q == null ? ""
    : q >= 90 ? `<span class="siegel gold" title="ab 90 % — besteht auf jeden Fall">🏅</span>`
    : q >= 75 ? `<span class="siegel gut" title="ab 75 % — sicherer Bereich">✓</span>`
    : q < 50 ? `<span class="siegel rot" title="unter 50 % — hier ist am meisten drin">!</span>` : "";
  const markenBar = (quote, thin = false) => `<span class="bar mit-marke${thin ? " thin" : ""}">
    <i style="width:${quote ?? 0}%;background:${quotenFarbe(quote)}"></i>
    <em class="bar-marke m50" style="left:50%"></em><em class="bar-marke m75" style="left:75%"></em><em class="bar-marke m90" style="left:90%"></em></span>`;
  // Entwicklung je Thema (Jennifer 22.07.): wandert als kleiner Pfeil direkt in
  // die Themenzeile, statt weiter unten eine eigene Sektion zu belegen.
  const ew = st.entwicklung;
  const ewProThema = {};
  for (const t of ew.proThema) ewProThema[t.thema] = t;
  const ewPfeil = (slug) => {
    const t = ewProThema[slug];
    if (!t) return "";
    const cls = t.delta >= 5 ? "up" : t.delta <= -5 ? "down" : "";
    const pfeil = t.delta >= 5 ? "▲" : t.delta <= -5 ? "▽" : "→";
    return `<span class="delta ${cls}" title="Letzte ${ew.fenster} Übungstage: ${t.vorher} % → ${t.jetzt} %">${pfeil} ${t.delta > 0 ? "+" : ""}${t.delta}</span>`;
  };
  // Wacklige Unterthemen (unter 50 %, mind. 3 echte Versuche) — nicht mehr als
  // eigener Block, sondern dezent an genau der Kategorie, um die es geht.
  const rote = new Map();
  for (const tt of st.proThema)
    for (const s of tt.unterthemen)
      if (s.n >= 3 && s.quote != null && s.quote < 50) rote.set(tt.slug + "/" + s.u, { label: labelU(s.u), quote: s.quote });
  // Pro Thema: aufklappbar bis auf die Unterthemen (Beherrschung + Ø Punkte + Ø Zeit)
  const themenRows = st.proThema.map((tt) => {
    const t = C.THEMEN[tt.slug] || { name: tt.slug, color: "var(--ink-soft)" };
    // Balken = Punktequote, exakt wie die Zahl daneben — mit denselben Trennern
    // auch in jeder Unterkategorie. Je Zeile ein kleiner Uebe-Knopf: wacklige
    // Unterthemen starten die Fokus-Runde (Schwerstes zuerst), alle anderen
    // eine normale 10er-Runde zu genau diesem Unterthema.
    const subRows = tt.unterthemen.map((s) => {
      const key = tt.slug + "/" + s.u;
      const istRot = rote.has(key);
      return `<div class="progress-row sub${istRot ? " ist-wacklig" : ""}">
        <span class="lbl">${esc(labelU(s.u))} ${siegel(s.quote)} <small class="muted">${s.n}×</small></span>
        ${markenBar(s.quote, true)}
        <span class="val">${s.quote}%<small>${pkt(s)}${s.zeit != null ? " · " + fmtSek(s.zeit) : ""}</small></span>
        <button class="ueb-mini${istRot ? " rot" : ""}" ${istRot ? `data-rot='${JSON.stringify([key])}'` : `data-uebe-unter='${JSON.stringify([key])}'`}
          title="10 Karten ${esc(labelU(s.u))} üben" aria-label="10 Karten ${esc(labelU(s.u))} üben">⚡</button></div>`;
    }).join("");
    const roteImThema = [...rote.keys()].filter((k) => k.startsWith(tt.slug + "/"));
    return `<details class="topic" style="--tc:${t.color}">
      <summary><span class="lbl">${t.name} ${siegel(tt.quote)}${roteImThema.length ? `<span class="wackel-punkt" title="${roteImThema.length} wacklige${roteImThema.length === 1 ? "s" : ""} Unterthema">●</span>` : ""}</span>
        ${markenBar(tt.quote)}
        <span class="val">${tt.quote != null ? tt.quote + " %" : "–"}<small>${tt.n}× · ${pkt(tt)}${tt.zeit != null ? " · " + fmtSek(tt.zeit) : ""}</small></span>
        ${ewPfeil(tt.slug)}</summary>
      <div class="sub-wrap"><p class="muted sub-head">Gleiche Logik je Unterthema: Balken & %-Zahl = geholte Punkte mit den 50/75/90-Trennern, n× = Versuche, dann Ø Punkte & Ø Zeit. ⚡ startet 10 Karten zu genau der Zeile. Unterthemen ohne Versuche tauchen noch nicht auf.</p>${subRows}
        <div class="topic-tools">
          <button class="btn small ghost" data-uebe="${tt.slug}">⚡ 10 Karten aus ${esc(t.name)}</button>
          ${roteImThema.length ? `<button class="btn small ghost rot" data-rot='${JSON.stringify(roteImThema)}'>🔴 10 Karten aus den wackligen Stellen</button>` : ""}
        </div></div>
    </details>`;
  }).join("");
  // "Werde ich besser?" hat keine eigene Sektion mehr (Jennifer 22.07.): der
  // Gesamt-Satz steht jetzt ueber den Themen, die Themen-Deltas als Pfeil in der
  // jeweiligen Zeile. Der alte Balken-Trend (eine Saeule je Runde) ist raus — er
  // verglich Runden verschiedener Laenge und Schwierigkeit miteinander.
  let ewSatz = "";
  if (ew.gesamt) {
    const g = ew.gesamt;
    ewSatz = g.delta >= 5 ? `<b>Es wird besser:</b> die ${ew.fenster} Übungstage davor ${g.vorher} %, deine letzten ${ew.fenster} <b>${g.jetzt} %</b> — <span class="delta up">+${g.delta}</span>. Weiter genau so! 🎉`
      : g.delta <= -5 ? `Zuletzt <b>${g.jetzt} %</b> nach ${g.vorher} % an den ${ew.fenster} Übungstagen davor. Meist heißt das: du übst gerade mutig die schweren Sachen — genau richtig jetzt.`
      : `<b>Stabil bei ${g.jetzt} %</b> über deine letzten ${ew.fenster} Übungstage (davor ${g.vorher} %). Sicherheit, auf die du bauen kannst.`;
    ewSatz = `<p class="an-zeile ew-satz">${ewSatz}</p>`;
  }
  const maxTag = Math.max(1, ...st.tage14.map((d) => d.n));
  const karten14 = st.tage14.reduce((a, d) => a + d.n, 0);
  // Zahl UEBER der Saeule = Karten an dem Tag (Jennifers Wunsch: Totale sichtbar,
  // nicht nur im Hover-Tooltip, das es am Handy nicht gibt); Quote nur im Tooltip.
  const aktivitaet = st.tage14.map((d) => `<div class="akt-col" title="${new Date(d.ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}: ${d.n} Karten${d.quote != null ? `, ${d.quote} % Punktequote` : ""}">
    ${d.n ? `<span class="akt-q">${d.n}</span>` : ""}<i style="height:${Math.round((100 * d.n) / maxTag)}%"></i><span>${new Date(d.ts).getDate()}</span></div>`).join("");
  return st.beantwortet ? `
    <h2 class="stat-sek">Überblick</h2>
    <div class="card"><div class="stat-grid">
      ${kachel(st.beantwortet, "Antworten gesamt")}
      ${kachel(st.punkteQuote != null ? st.punkteQuote + " %" : "–", "Ø Punktequote")}
      ${kachel(st.vollQuote != null ? st.vollQuote + " %" : "–", "voll richtig")}
      ${kachel(st.avgZeit != null ? fmtSek(st.avgZeit) : "–", "Ø Zeit pro Frage")}
      ${kachel(st.uebungsTage, st.uebungsTage === 1 ? "Übungstag" : "Übungstage")}
      ${kachel(st.sessions, "Sessions")}
    </div><p class="muted tz-note" style="margin:10px 0 0">„Antworten gesamt" zählt alles. In die Quoten fließen nur echte Versuche (${st.nQual}): mindestens 3 s Lesezeit und keine Sofort-Wiederholung derselben Frage — sonst würden Schnelltipps die Zahlen verzerren.</p></div>
    <div class="card an-card"><div class="an-head"><h3>💡 Wo du stehst</h3>${standSticker(st.punkteQuote)}</div>${analyseHtml(st.analyse, "global")}</div>
    <h2 class="stat-sek">Beherrschung nach Thema</h2>
    <div class="card">${ewSatz}
      ${rote.size ? `<div class="wackel-zeile"><span><b>🔴 ${rote.size} wacklige ${rote.size === 1 ? "Stelle" : "Stellen"}</b> — sie sind unten mit ● markiert.</span>
        <button class="btn small" data-rot='${JSON.stringify([...rote.keys()])}'>⚡ 10 Karten daraus üben</button></div>` : ""}
      <p class="muted" style="margin-top:${ewSatz || rote.size ? "10px" : "0"}">Antippen zum Aufklappen, ⚡ startet 10 Karten dazu. Balken = Ø Punktequote, der Pfeil rechts vergleicht deine letzten ${ew.fenster} Übungstage mit den ${ew.fenster} davor.</p>
      <p class="muted tz-note" style="margin:0 0 10px">Trenner im Balken: <b>50 %</b> Bestehensgrenze · <b>75 %</b> sicherer Bereich · <b>90 %</b> besteht auf jeden Fall. Füllung rot unter 50, gelb ab 50, grün ab 85. Siegel <span class="siegel rot">!</span> unter 50 · <span class="siegel gut">✓</span> ab 75 · <span class="siegel gold">🏅</span> ab 90.</p>${themenRows}</div>
    <h2 class="stat-sek">Aktivität</h2>
    <div class="card"><h3>Letzte 14 Tage</h3><div class="akt-chart">${aktivitaet}</div>
      <p class="muted tz-note" style="margin:8px 0 0">Zahl über der Säule = beantwortete Karten an dem Tag${karten14 ? ` · zusammen <b>${karten14}</b> in 14 Tagen` : ""}. Zählt alle Antworten, auch Stöbern & die Trainings-Spiele.</p></div>`
    : `<div class="card"><p class="muted">Noch keine Antworten geloggt — nach der ersten Runde gibt's hier Zahlen. 💪</p></div>`;
}
// Eigene Statistik-Seite bleibt als Route erreichbar (zeigt denselben Inhalt)
function statistik() {
  h(`<div class="fade-in">
    <div class="topbar"><button class="back" id="back">‹</button><h1>Statistik 📊</h1></div>
    ${statInhaltHtml()}
  </div>`);
  belebeStats(app.querySelector(".fade-in"));
  bindUebe(); // Schwaechen-Chips & Hebel-Button starten direkt eine Themen-Runde
  document.getElementById("back").onclick = home;
}

// ================= BEGRIFFE-BLITZ =================
// Kleiner Zuordnungs-Modus für Begriffe, §§ und Zuständigkeiten (Roses größte
// Baustelle: Schulrecht-Begriffe). Bewusst kurze Runden à 5 Paare — schnelle
// Erfolgserlebnisse, mobil mit zwei Tipps bedienbar. Antworten landen als
// normale antwortLog-Einträge (sid "begriffe"), syncen also über alle Geräte.
// Lern-Logik: Runden abwechselnd in beide Abrufrichtungen (Begriff→Antwort und
// Antwort→Begriff) — die Rückrichtung wird sonst nicht mitgelernt.
function begriffeHome() {
  const alle = C.begriffe();
  if (!alle.length) return home();
  const stats = C.begriffStats();
  const sicher = (p) => (stats[p.id]?.ok || 0) >= 2;
  const kats = [...new Map(alle.map((p) => [p.kategorie, p])).values()].map((p) => {
    const paare = alle.filter((x) => x.kategorie === p.kategorie);
    const s = paare.filter(sicher).length;
    const t = C.THEMEN[p.oberthema] || {};
    return { kat: p.kategorie, label: p.kategorieLabel || p.kategorie, n: paare.length, s, color: t.color || "var(--ink-soft)", kurz: t.kurz || "" };
  }).sort((a, b) => a.s / a.n - b.s / b.n);
  const rows = kats.map((k) => `<button class="mode-card wide bg-kat" data-kat="${esc(k.kat)}" style="--tc:${k.color}">
    <b>${k.kurz ? `<span class="chip" style="--tc:${k.color}">${k.kurz}</span> ` : ""}${esc(k.label)}</b>
    <span style="display:flex;align-items:center;gap:8px;width:100%"><span class="bar thin" style="flex:1"><i style="width:${Math.round((100 * k.s) / k.n)}%"></i></span><span class="muted">${k.s}/${k.n} sicher</span></span>
  </button>`).join("");
  h(`<div class="fade-in">
    <div class="topbar"><button class="back" id="back">‹</button><h1>Begriffe-Blitz 🃏</h1></div>
    <div class="card"><p style="margin:0">Tippe links einen Begriff an, dann rechts die passende Antwort. 5 Paare pro Runde — sicher ist ein Paar, wenn du es 2× beim ersten Anlauf triffst. Die wackligsten Kategorien stehen oben.</p></div>
    <button class="btn" id="schwach" style="width:100%;margin-bottom:10px">⚡ Schwächste Runde starten</button>
    ${rows}
  </div>`);
  document.getElementById("back").onclick = home;
  document.getElementById("schwach").onclick = () => begriffeRunde(kats[0].kat);
  app.querySelectorAll("[data-kat]").forEach((b) => b.onclick = () => begriffeRunde(b.dataset.kat));
}

function begriffeRunde(kat) {
  const alle = C.begriffe().filter((p) => p.kategorie === kat);
  if (!alle.length) return begriffeHome();
  const stats = C.begriffStats();
  // Gewichtete Auswahl: nie geübt und zuletzt gepatzt zuerst, Sicheres seltener
  const gew = (p) => { const s = stats[p.id]; if (!s) return 3; return s.ok >= 2 ? 1 : 4; };
  const paare = alle.map((p) => ({ p, s: gew(p) * (0.4 + Math.random()) }))
    .sort((a, b) => b.s - a.s).slice(0, Math.min(5, alle.length)).map((x) => x.p);
  // Abrufrichtung pro Runde wechseln (Begriff→Antwort / Antwort→Begriff)
  const st = C.state();
  st.bgRichtung = !st.bgRichtung; C.save();
  const drehen = !!st.bgRichtung && paare.every((p) => (p.antwort || "").length < 60);
  const links = C.shuffle([...paare]);
  const rechts = C.shuffle([...paare]);
  const t0 = Date.now();
  const offen = new Set(paare.map((p) => p.id));
  const fehler = new Set();     // Paare mit mindestens einem Fehlgriff
  const gewertet = new Set();   // Paare, deren erster Anlauf schon geloggt ist
  let aktiv = null;
  const lbl = C.begriffe()[0] ? (C.begriffe().find((p) => p.kategorie === kat)?.kategorieLabel || kat) : kat;
  h(`<div class="fade-in">
    <div class="topbar"><button class="back" id="back">‹</button><h1 style="font-size:1.15rem">${esc(lbl)}</h1></div>
    <p class="muted" style="margin:0 0 10px">${drehen ? "Umgekehrte Richtung: links die Beschreibung, rechts der Begriff." : "Links Begriff antippen, rechts die passende Antwort."}</p>
    <div class="bg-spiel">
      <div class="bg-col" id="bgLinks">${links.map((p) => `<button class="bg-card links" data-id="${p.id}">${esc(drehen ? p.antwort : p.begriff)}</button>`).join("")}</div>
      <div class="bg-col" id="bgRechts">${rechts.map((p) => `<button class="bg-card rechts" data-id="${p.id}">${esc(drehen ? p.begriff : p.antwort)}</button>`).join("")}</div>
    </div>
    <div id="bgFazit"></div>
  </div>`);
  document.getElementById("back").onclick = begriffeHome;
  const alleLinks = [...app.querySelectorAll(".bg-card.links")];
  app.querySelectorAll(".bg-card.links").forEach((b) => b.onclick = () => {
    if (b.classList.contains("done")) return;
    alleLinks.forEach((x) => x.classList.remove("sel"));
    b.classList.add("sel"); aktiv = b.dataset.id;
  });
  app.querySelectorAll(".bg-card.rechts").forEach((b) => b.onclick = () => {
    if (b.classList.contains("done") || !aktiv) return;
    const p = paare.find((x) => x.id === aktiv);
    const erster = !gewertet.has(aktiv);
    if (b.dataset.id === aktiv) {
      // Treffer: Paar abhaken; nur der ERSTE Anlauf zählt für den Lernstand
      if (erster) {
        gewertet.add(aktiv);
        const voll = !fehler.has(aktiv);
        C.logAntwort({ qid: aktiv, sid: "begriffe", modus: "begriffe", punkte: voll ? 1 : 0, max: 1, voll, zeit: Math.round((Date.now() - t0) / 1000) });
        C.syncEvent({ frage_id: aktiv, gewaehlt: null, punkte: voll ? 1 : 0, max_punkte: 1, voll, modus: "begriffe", ts: new Date().toISOString() });
      }
      offen.delete(aktiv);
      b.classList.add("done");
      app.querySelector(`.bg-card.links[data-id="${CSS.escape(aktiv)}"]`)?.classList.add("done");
      aktiv = null;
      if (!offen.size) begriffeFazit(kat, paare, fehler, drehen);
    } else {
      // Fehlgriff: merken (macht das Paar "nicht voll"), kurz schütteln
      if (erster && !fehler.has(aktiv)) fehler.add(aktiv);
      b.classList.add("shake");
      setTimeout(() => b.classList.remove("shake"), 450);
    }
  });
}

function begriffeFazit(kat, paare, fehler, drehen) {
  const n = paare.length, ok = n - fehler.size;
  const cls = ok === n ? "good" : ok >= n - 1 ? "part" : "bad";
  const erkl = paare.filter((p) => fehler.has(p.id)).map((p) => `<div class="review-q" style="padding:10px 0">
    <b>${esc(p.begriff)}</b> → ${esc(p.antwort)}
    ${p.erklaerung ? `<div class="explain good">${Beleg.render(p.erklaerung, p.oberthema)}</div>` : ""}</div>`).join("");
  document.getElementById("bgFazit").innerHTML = `
    <div class="fb-banner ${cls}" style="margin-top:12px">${sticker(cls)}<span>${ok}/${n} beim ersten Anlauf${ok === n ? " — alle! 🎉" : ""}</span></div>
    ${erkl ? `<div class="card mt"><h3>Kurz nachlesen</h3>${erkl}</div>` : ""}
    <div class="btn-row mt">
      <button class="btn" id="bgNochmal">Nächste Runde ›</button>
      <button class="btn secondary" id="bgZurueck">Kategorien</button>
    </div>`;
  document.getElementById("bgNochmal").onclick = () => begriffeRunde(kat);
  document.getElementById("bgZurueck").onclick = begriffeHome;
  if (ok === n) konfetti({ n: 40, ms: 2200 });
}

// ================= VERLAUF =================
function verlauf() {
  const items = histEintraege().map((x) => x.html).join("");
  h(`<div class="fade-in"><div class="topbar"><button class="back" id="back">‹</button><h1>Verlauf</h1></div>
    <div class="card">${items || "<p class='muted'>Noch keine abgeschlossenen Sessions — die erste ist die wichtigste! 💪</p>"}</div></div>`);
  document.getElementById("back").onclick = home;
  bindHist(verlauf);
}

// ================= BOOT =================
(async function boot() {
  applyTheme();
  h(`<div class="card center mt"><h2>Lade Fragen …</h2></div>`);
  try {
    await C.ladeFragen();
    await C.ladeBegriffe(); // optional — ohne Datei bleibt der Modus einfach aus
    await C.ladeProbeklausuren(); // optional — ohne Datei fehlt nur die Klausurtraining-Karte
    await Spiele.ladeSpiele(); // optional — Kacheln erscheinen nur mit Daten (Detektiv immer)
    Llm.initChat(C.frage);     // Chat-Knoepfe (Block E) — ohne Function einfach unsichtbar/fallback
    C.flushSync();
    home();
    // Lernstand vom Server holen; wenn dabei Neues dazukommt, Startseite auffrischen
    C.syncLernstand().then((neu) => { if (neu && !R && document.getElementById("homeRoot")) home(); });
    // Beim Zurueckkommen auf den Tab: nachziehen, was auf dem anderen Geraet passiert ist
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible" || R) return;
      C.syncLernstand().then((neu) => { if (neu && !R && document.getElementById("homeRoot")) home(); });
    });
  } catch (e) {
    h(`<div class="card center mt"><h2>Ups.</h2><p class="muted">Fragen konnten nicht geladen werden: ${esc(e.message)}</p></div>`);
  }
})();
