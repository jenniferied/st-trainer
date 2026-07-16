import * as C from "./core.js";
import * as Beleg from "./beleg.js";

const app = document.getElementById("app");
const h = (html) => { app.innerHTML = html; window.scrollTo(0, 0); };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// Grafik-Fragen: Bild unter dem Fragetext (Tippen/Klicken = Vollbild-Zoom via CSS :target-frei per Klasse)
const bildHtml = (q) => q.bild ? `<div class="q-bild"><img src="data/img/${esc(q.bild)}" alt="Grafik zur Frage" loading="lazy" onclick="this.classList.toggle('zoom')"></div>` : "";
// Fallvignetten aus der Vorlesung (Sachverhalt) — steht ueber der Frage, wie im Original-PDF
const fallHtml = (q) => q.sachverhalt ? `<div class="q-fall"><b>Sachverhalt</b>${esc(q.sachverhalt)}</div>` : "";
const MODUS_LBL = { klausur: "🎓 Klausur-Simulation", halbe: "🕧 Halbe Klausur", spaced: "🧠 Schlaues Wiederholen", schnell: "⚡ Schnelle 10er", fehler: "🔁 Fehler-Training", eigene: "🧩 Eigene Runde" };

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
// „gemeistert"-Anzeige: Originalfragen und KI-Fragen getrennt ausweisen
const fmtMN = (f) => f.ki.n
  ? `<span title="Originalfragen">${f.og.m}/${f.og.n}</span><small style="display:block;opacity:.75">KI ${f.ki.m}/${f.ki.n}</small>`
  : `${f.og.m}/${f.og.n}`;

// Sticker-Feedback: Roses & Jennifers meistgenutzte WhatsApp-Sticker (animiertes
// WebP), je nach Ergebnis zufällig gewählt. Nur im Trainer-Look — der Exam.UP-
// Klausurmodus bleibt bewusst nüchtern. Bei prefers-reduced-motion wird das
// Standbild (.png, erster Frame) statt der Animation geladen.
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
  if (REDUCE_MOTION) return;
  const ov = document.createElement("div");
  ov.className = "konfetti";
  ov.innerHTML = Array.from({ length: n }, () => {
    const sym = KONFETTI[Math.floor(Math.random() * KONFETTI.length)];
    const sw = (8 + Math.random() * 22).toFixed(0);
    const spin = (Math.random() * 720 - 360).toFixed(0);
    return `<span class="herz" style="left:${(Math.random() * 100).toFixed(1)}%;font-size:${(0.8 + Math.random() * 1.4).toFixed(2)}rem;--sw:${sw}px;--spin:${spin}deg;animation-duration:${(2.4 + Math.random() * 2).toFixed(2)}s;animation-delay:${(Math.random() * 0.7).toFixed(2)}s">${sym}</span>`;
  }).join("");
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
  (q.quelle === "generiert" ? `<span class="badge-src badge-generiert">KI-generiert</span>` : "");

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
function home() {
  stopTimer(); R = null;
  const s = C.state();
  const offene = s.offen || [];

  const offenCards = offene.map((o) => {
    const done = o.runde.filter((r) => r.gewaehlt).length;
    const timed = o.cfg.timerModus && o.cfg.timerModus !== "aus";
    return `<div class="card" style="display:flex;align-items:center;gap:12px">
      <div style="flex:1;min-width:0">
        <b>${MODUS_LBL[o.cfg.modus] || o.cfg.modus}</b>
        <div class="muted">erstellt ${datum(o.erstellt)} · ${done}/${o.runde.length} beantwortet${timed ? ` · ⏱ ${o.restSek != null ? Math.ceil(o.restSek / 60) + " min übrig" : C.timerMinuten(o.runde.length, o.cfg.timerModus) + " min"}` : ""}</div>
        <div class="bar thin mt"><i style="width:${(100 * done) / o.runde.length}%"></i></div>
      </div>
      <button class="btn small" data-resume="${o.id}">Weiter</button>
      <button class="btn ghost small" data-discard="${o.id}" title="Verwerfen">✕</button>
    </div>`;
  }).join("");

  const score = C.lernscore();
  const streak = C.pruefungsStreak();
  const themenDetail = Object.entries(C.THEMEN).map(([slug, t]) => {
    const f = C.themaFortschritt(slug);
    const subs = C.unterthemen(slug).map(([u], ui) => {
      const sf = C.splitFortschritt(C.pool().filter((q) => q.oberthema === slug && q.unterthema === u && q.quizbar && (q.sprache || "schwer") !== "einfach"));
      if (!sf.n) return "";
      return `<div class="progress-row" style="--tc:${C.subColor(slug, ui)}">
        <span class="lbl" style="font-weight:500;font-size:.87rem">${esc(labelU(u))}</span>
        <span class="bar thin"><i style="width:${sf.pct}%"></i></span>
        <span class="val">${fmtMN(sf)}</span></div>`;
    }).join("");
    return `<details style="--tc:${t.color}">
      <summary style="list-style:none;cursor:pointer"><div class="progress-row" style="--tc:${t.color}">
        <span class="lbl">${t.name}</span><span class="bar"><i style="width:${f.pct}%"></i></span><span class="val">${fmtMN(f)}</span></div></summary>
      <div style="margin:2px 0 10px 8px">${subs}</div></details>`;
  }).join("");

  const eintraege = histEintraege();
  const letzte = eintraege.slice(0, 4).map((x) => x.html).join("");

  h(`<div class="fade-in" id="homeRoot">
    <div class="topbar"><h1>Schultheorie‑Trainer ✏️</h1>${themeBtnHtml()}<button class="btn ghost small" id="gear" title="Einstellungen">⚙️</button></div>

    ${offene.length ? `<h2>Offene Sessions</h2>${offenCards}` : ""}

    ${letzte ? `<h2 class="${offene.length ? "mt" : ""}">Zuletzt</h2><div class="card">${letzte}
      <button class="btn ghost small mt" data-go="verlauf">Alle ${eintraege.length} Einträge ansehen ›</button></div>` : ""}

    <h2 class="${offene.length || letzte ? "mt" : ""}">Neue Session</h2>
    <div class="mode-grid">
      <button class="mode-card wide" data-go="klausur"><b>🎓 Klausur-Simulation</b><span>42 Fragen · Exam.UP-Look · echtes Scoring · 90/120 min</span></button>
      <button class="mode-card" data-go="halbe"><b>🕧 Halbe Klausur</b><span>21 Fragen · Exam.UP-Look · pausierbar</span></button>
      <button class="mode-card" data-go="spaced"><b>🧠 Schlaues Wiederholen</b><span>Spaced Repetition: Fälliges zuerst + Neues</span></button>
      <button class="mode-card" data-go="schnell"><b>⚡ Schnelle 10er</b><span>10 Fragen, sofortiges Feedback</span></button>
      <button class="mode-card" data-go="fehler"><b>🔁 Fehler-Training</b><span>Nur Fragen, die noch wackeln</span></button>
      <button class="mode-card wide" data-go="eigene"><b>🧩 Eigene Runde</b><span>Themen, Timer, Feedback — alles frei wählbar</span></button>
    </div>

    <h2 class="mt">Stöbern</h2>
    <button class="mode-card wide" data-go="explore" style="width:100%"><b>🗂 Alle Fragen browsen</b><span>Nach Thema & Quelle sortiert, aufklappbar, direkt übbar</span></button>

    <div style="display:flex;align-items:baseline;gap:10px" class="mt"><h2 style="margin:0">Dein Fortschritt</h2>
      <button class="btn ghost small" data-go="statistik" style="margin-left:auto">📊 Statistik ›</button></div>
    <div class="card mt" style="margin-top:8px">
      <div class="progress-row" style="--tc:var(--accent)">
        <span class="lbl">Lernscore</span><span class="bar"><i style="width:${score}%"></i></span><span class="val">${score}%</span>
      </div>
      <p class="muted" style="margin:0 0 6px">Gemeistert: ${(() => { const g = C.gesamtFortschritt(); return `${g.og.m}/${g.og.n} Originalfragen` + (g.ki.n ? ` · ${g.ki.m}/${g.ki.n} KI-Fragen` : ""); })()}</p>
      <div class="progress-row" style="--tc:var(--ok)">
        <span class="lbl">Prüfungsreife</span>
        <span class="streak inline">${[0,1,2,3,4].map((i) => `<i class="${i < streak ? "hit" : ""}">${i < streak ? "✓" : ""}</i>`).join("")}</span>
        <span class="val">${streak}/5</span>
      </div>
      <p class="muted" style="margin:4px 0 12px">5 bestandene Klausur-Simulationen in Folge = bereit. Du schaffst das.</p>
      ${themenDetail}
    </div>
  </div>`);

  app.querySelectorAll("[data-go]").forEach((b) => b.onclick = () => route(b.dataset.go));
  app.querySelectorAll("[data-resume]").forEach((b) => b.onclick = () => resumeSession(b.dataset.resume));
  app.querySelectorAll("[data-discard]").forEach((b) => b.onclick = async () => {
    if (await frag("Diese offene Session verwerfen? (wird nicht gewertet)", { ja: "Verwerfen", nein: "Behalten" })) { C.verwerfeOffene(b.dataset.discard); home(); }
  });
  bindHist(home);
  const tb = document.getElementById("themeBtn");
  tb.onclick = () => toggleTheme(tb);
  document.getElementById("gear").onclick = einstellungen;
}

function histRow(s) {
  const status = s.status === "abgebrochen" ? `<span class="badge-src badge-unsicher">abgebrochen</span>` : s.bestanden ? `<span class="badge-src" style="background:var(--ok-bg);color:var(--ok)">bestanden</span>` : `<span class="badge-src">fertig</span>`;
  return `<div class="hist-item click" data-open="${s.id}"><div><b>${MODUS_LBL[s.modus] || s.modus}</b> ${status}
    <div class="when">erstellt ${datum(s.erstellt || s.ts)} · abgeschlossen ${datum(s.ts)} · ${s.beantwortet}/${s.anzahl} Fragen · ${Math.round(s.dauerSek / 60)} min</div></div>
    <span class="sc">${s.punkte}/${s.max}</span>
    ${s.runde && s.beantwortet < s.anzahl ? `<button class="btn small" data-reopen="${s.id}" title="Offene Fragen weitermachen">Fortsetzen</button>` : ""}
    <button class="btn ghost small" data-del="${s.id}" title="Session löschen">🗑</button></div>`;
}
// Einzeln geübte Fragen (Stöbern) als Tages-Eintrag im Verlauf — vollwertige
// Übung, gehört sichtbar dazu. 🗑 löscht den ganzen Tag (aid-Grabsteine).
function histRowEinzel(e) {
  return `<div class="hist-item click" data-einzel="${e.id}"><div><b>🗂 Einzelfragen</b> <span class="badge-src">Stöbern</span>
    <div class="when">${datum(e.erstellt)} · ${e.n} ${e.n === 1 ? "Frage" : "Fragen"} einzeln geübt</div></div>
    ${e.max ? `<span class="sc">${e.punkte}/${e.max}</span>` : ""}
    <button class="btn ghost small" data-del-einzel="${e.id}" title="Diese Einzelantworten löschen">🗑</button></div>`;
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
    if (ev.target.closest("[data-del],[data-reopen]")) return;
    sessionDetail(el.dataset.open, rerender);
  });
  app.querySelectorAll("[data-einzel]").forEach((el) => el.onclick = (ev) => {
    if (ev.target.closest("[data-del-einzel]")) return;
    einzelDetail(el.dataset.einzel, rerender);
  });
  app.querySelectorAll("[data-del-einzel]").forEach((b) => b.onclick = async (ev) => {
    ev.stopPropagation();
    const g = C.einzelGruppen().find((x) => x.id === b.dataset.delEinzel);
    if (!g) return;
    if (await frag(`${g.n} Einzelantworten vom ${datum(g.erstellt).split(" ")[0]} löschen? Dein Lernstand (Dots & Fortschritt) wird ohne sie neu berechnet — auf allen Geräten.`, { ja: "Löschen", nein: "Behalten" })) {
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
async function reopenSession(id) {
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
    a.gewaehlt ? reviewQ({ qid: a.qid, optOrder: [...(C.frage(a.qid)?.optionen.keys() || [])], gewaehlt: a.gewaehlt }, a) : ""
  ).join("");
  h(`<div class="fade-in">
    <div class="topbar"><button class="back" id="back">‹</button><h1>Einzelfragen</h1></div>
    <div class="card">
      <p style="margin:0"><b>${e.n} ${e.n === 1 ? "Frage" : "Fragen"}</b> beim Stöbern geübt am ${datum(e.erstellt).split(" ")[0]}${e.max ? ` — <b>${e.punkte}/${e.max} P.</b>` : ""}</p>
      <p class="muted" style="margin:4px 0 0">Zählt voll in Lernstand & Statistik, wie jede Session.</p>
    </div>
    <div class="card mt"><h3>Alle Fragen im Detail</h3>${rows || "<p class='muted'>Zu diesen Antworten gibt es keine Details mehr (ältere App-Version).</p>"}</div>
  </div>`);
  document.getElementById("back").onclick = zurueck;
}
const fmtSek = (sek) => sek >= 90 ? `${Math.round(sek / 60)} min` : `${sek} s`;

function route(ziel) {
  if (ziel === "explore") explore();
  else if (ziel === "verlauf") verlauf();
  else if (ziel === "statistik") statistik();
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
  halbe: { titel: "🕧 Halbe Klausur", modus: "halbe", fb: "ende", auswahl: "klausur", hinweis: "21 Fragen im Exam.UP-Look mit halber Zeit — und pausierbar, wenn zwischendurch das Leben ruft. Bestehen ab der Hälfte der Punkte, wie im Original." },
  spaced: { titel: "🧠 Schlaues Wiederholen", modus: "spaced", anzahl: 15, fb: "sofort", spaced: true, auswahl: "smart", hinweis: "Spaced Repetition: Fragen kommen genau dann wieder, wenn sie zu entfallen drohen. Fälliges und Wackliges zuerst, dazu ein paar neue — die effizienteste Art zu üben." },
  schnell: { titel: "⚡ Schnelle 10er", modus: "schnell", anzahl: 10, fb: "sofort", auswahl: "smart", hinweis: "10 Fragen, Feedback direkt nach jeder Antwort. Anpassen, was du magst — oder einfach starten." },
  fehler: { titel: "🔁 Fehler-Training", modus: "fehler", anzahl: 15, fb: "sofort", nurFehler: true, auswahl: "fokus", hinweis: "Nur Fragen, die noch wackeln (Level unter 3). Anpassen oder direkt starten." },
  eigene: { titel: "🧩 Eigene Runde", modus: "eigene", anzahl: 10, fb: "sofort", auswahl: "smart" },
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
];
function builder({ preset }) {
  const P = PRESETS[preset] || PRESETS.eigene;
  const istKlausur = preset === "klausur";
  const istExam = istKlausur || preset === "halbe";   // Exam.UP-Look, Feedback erst am Ende
  const fixAnzahl = istKlausur ? 42 : preset === "halbe" ? 21 : null;
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
    ${istKlausur ? `<div class="card"><p>42 Fragen quer durch alle Themen, im Look von <b>Exam.UP</b> (der Prüfungsplattform der Uni) wie in der echten Klausur. Feedback gibt's erst am Ende — genau wie im Ernstfall.</p></div>` : ""}
    ${P.hinweis ? `<div class="card"><p style="margin:0">${P.hinweis}</p></div>` : ""}
    ${!fixAnzahl ? `<div class="field"><span class="flabel">Fragenzahl</span><div class="seg" id="anz">
      ${[10, 15, 21, 30, 42].map((n) => `<button data-v="${n}" class="${n === (P.anzahl || 10) ? "on" : ""}">${n}</button>`).join("")}</div></div>` : ""}
    <div class="field"><span class="flabel">Timer</span><div class="seg" id="timer">
      <button data-v="aus" class="${istExam ? "" : "on"}">Ohne</button>
      <button data-v="normal" class="${istExam && !nta ? "on" : ""}">Normal</button>
      <button data-v="nta" class="${istExam && nta ? "on" : ""}">+ Nachteilsausgleich</button></div>
      <p class="muted" id="timerHint"></p></div>
    <div class="field"><span class="flabel">Auswahl der Fragen</span><div class="seg" id="auswahl">
      ${AUSWAHL_OPT.map(([v, lbl]) => `<button data-v="${v}" class="${v === (P.auswahl || "smart") ? "on" : ""}">${lbl}</button>`).join("")}</div>
      <p class="muted" id="auswahlHint"></p></div>
    <div class="field"><span class="flabel">Pausierbar</span><div class="seg" id="pause">
      <button data-v="ja" class="${istKlausur ? "" : "on"}">Ja</button><button data-v="nein" class="${istKlausur ? "on" : ""}">Nein (wie echt)</button></div></div>
    ${!istKlausur ? `<div class="field"><span class="flabel">Feedback</span><div class="seg" id="fb">
      <button data-v="sofort" class="${P.fb === "sofort" ? "on" : ""}">Sofort je Frage</button><button data-v="ende" class="${P.fb === "ende" ? "on" : ""}">Erst am Ende${istExam ? " (wie echt)" : ""}</button></div>
      ${istExam ? `<p class="muted">Bei Sofort gibt's unter jeder Frage einen Überprüfen-Button mit Erklärungen — die Frage ist danach festgelegt.</p>` : ""}</div>` : ""}
    ${preset === "eigene" ? `<div class="field"><span class="flabel">Ansicht</span><div class="seg" id="ansicht">
      <button data-v="uebung" class="on">Übungs-Ansicht</button><button data-v="exam">Klausuransicht</button></div>
      <p class="muted">Klausuransicht = Exam.UP-Look wie in der echten Klausur, mit Fragen-Navigation zum Vor- und Zurückblättern.</p></div>` : ""}
    ${!istExam && C.pool().some((q) => q.sprache === "einfach") ? `<div class="field"><span class="flabel">Sprache</span><div class="seg" id="sprache">
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
    const aw = segVal("auswahl");
    document.getElementById("auswahlHint").textContent = (AUSWAHL_OPT.find(([v]) => v === aw) || [])[2] || "";
  };
  updateHint();
  document.getElementById("los").onclick = () => {
    const unterthemen = [...app.querySelectorAll(".uth:checked")].map((x) => x.value);
    if (!unterthemen.length) { sag("Mindestens ein Thema auswählen 🙂"); return; }
    // Klausur-/Exam-Modi immer in Original-Sprache (wie im Ernstfall); Übungswahl wird gemerkt
    const sprache = istExam ? "schwer" : (segVal("sprache") || C.state().settings.sprache || "schwer");
    if (!istExam && segVal("sprache")) { C.state().settings.sprache = segVal("sprache"); C.save(); }
    starte({
      modus: P.modus, nurFehler: P.nurFehler || false, spaced: P.spaced || false,
      auswahl: segVal("auswahl") || P.auswahl || "smart",
      anzahl: fixAnzahl || +(segVal("anz") || 10),
      timerModus: segVal("timer"), pausierbar: segVal("pause") === "ja",
      feedback: istKlausur ? "ende" : segVal("fb") || "ende",
      examLook: istExam || segVal("ansicht") === "exam", unterthemen,
      sprache,
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
  // Motivation
  "attribution": "Attribution", "motivationsfoerderliche-merkmale": "Motivationsförderliche Merkmale",
  "selbstbestimmungstheorie": "Selbstbestimmungstheorie", "zieltheorien": "Zieltheorien",
};
const labelU = (u) => U_LABELS[u] || u.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// ================= RUNDE =================
function starte(cfg) {
  const sess = C.erstelleSession(cfg);
  if (!sess || sess.runde.length < Math.min(cfg.anzahl, 5)) {
    if (sess) C.verwerfeOffene(sess.id);
    sag("Zu wenig passende Fragen gefunden. Wähle mehr Themen."); return;
  }
  R = sess;
  R.startTs = Date.now();
  const min = C.timerMinuten(R.runde.length, cfg.timerModus);
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
  const dauerSek = (R.dauerSek || 0) + Math.round((Date.now() - (R.startTs || Date.now())) / 1000);
  const meta = { modus: R.cfg.modus, timerModus: R.cfg.timerModus, dauerSek, sprache: R.cfg.sprache, sessionId: R.id, erstellt: R.erstellt, status, cfg: R.cfg };
  const rundeKopie = R.runde;
  C.verwerfeOffene(R.id, false); // kein Grabstein: gleich kommt die gewertete Session mit derselben Id
  const session = C.werteAus(rundeKopie, meta);
  R = null;
  ergebnis(session, rundeKopie);
}

function zeigFrage() {
  stopTimer();
  if (R.cfg.modus === "klausur" || R.cfg.examLook) return zeigMoodle();
  const r = R.runde[R.idx];
  const q = C.frage(r.qid);
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
    zeigeFeedback(q, r);
    pruefen.classList.add("hidden");
    document.getElementById("weiter").classList.remove("hidden");
  };
  document.getElementById("weiter").onclick = () => {
    if (!r.gewaehlt) r.gewaehlt = gewaehlt();
    bankZeit();
    naechste();
  };
}
function zeigeFeedback(q, r) {
  const erg = C.scoreFrage(q, r.gewaehlt);
  C.syncEvent({ frage_id: q.id, gewaehlt: r.gewaehlt, punkte: erg.punkte, max_punkte: q.maxPunkte, voll: erg.voll, modus: R?.cfg.modus || "explore", ts: new Date().toISOString() });
  // Thema erst JETZT verraten — während der Beantwortung wäre es ein Hinweis (Klausurnähe)
  const t = C.THEMEN[q.oberthema] || {};
  const qmeta = document.getElementById("qmeta");
  if (qmeta) qmeta.innerHTML = `<span class="chip" style="--tc:${t.color}">${t.kurz}</span>
    <span class="chip outline" style="--tc:${t.color}">${esc(labelU(q.unterthema))}</span>${qBadges(q)}`;
  app.querySelectorAll("#answers label.ans").forEach((el) => {
    const oi = +el.querySelector("input").dataset.oi;
    const o = q.optionen[oi]; const gw = r.gewaehlt.includes(oi);
    el.querySelector("input").disabled = true;
    if (gw && o.richtig) el.classList.add("correct");
    else if (gw && !o.richtig) el.classList.add("wrong");
    else if (!gw && o.richtig) el.classList.add("missed");
    if (o.erklaerung && (gw || o.richtig)) {
      el.insertAdjacentHTML("afterend", `<div class="explain ${o.richtig ? "good" : "bad"}">${Beleg.render(o.erklaerung, q.oberthema)}</div>`);
    }
  });
  document.getElementById("fbzone").innerHTML = fbBanner(q, erg);
}
function fbBanner(q, erg, mitSticker = true) {
  const cls = erg.voll ? "good" : erg.punkte > 0 ? "part" : "bad";
  const txt = erg.voll ? `Voll richtig! +${erg.punkte} P. 🎉` : erg.punkte > 0 ? `Teilweise: ${erg.punkte} von ${q.maxPunkte} P.` : `Diesmal 0 Punkte — die Erklärungen sollten helfen.`;
  return `<div class="fb-banner ${cls}">${mitSticker ? sticker(cls) : ""}<span>${txt}</span></div>`;
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

// ================= EXAM.UP-KLAUSURMODUS =================
// (Exam.UP = Moodle-basierte Prüfungsplattform der Uni Potsdam — Look bewusst nah dran)
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
  // Foliensicht (wie in der echten Klausur, dort liegen die Vorlesungsfolien neben
  // dem Test): Toggle in der Kopfleiste, zeigt immer nur die zur Frage relevante
  // Folie (aus den Beleg-Ankern der Erklärungen), blätter- und zoombar.
  const folSeiten = Beleg.relevanteFolien(q);
  const folienPanel = !R.folienAuf ? "" : folSeiten.length ? `
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
        <button class="mf-toggle${R.folienAuf ? " on" : ""}" id="folienBtn" title="Vorlesungsfolie zur Frage ein-/ausblenden">📄 Folien</button>
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
            <span class="lvl-dots" style="--tc:${t.color}">${lvlDots(q.id)}</span></div>` + fbBanner(q, erg, false); // Exam.UP bleibt nüchtern: kein Sticker
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
    </div>
    <div class="btn-row mt">
      ${R.cfg.pausierbar || R.cfg.timerModus === "aus" ? `<button class="btn secondary" id="pauseBtn">⏸ Pausieren</button>` : ""}
      <button class="btn ghost" id="abbruch">Abbrechen</button>
    </div></div>`);
  qStart = locked ? null : Date.now(); // geprüfte Frage: Zeit steht, nur noch lesen
  startTick();
  document.getElementById("folienBtn").onclick = () => { bankZeit(); R.folienAuf = !R.folienAuf; zeigMoodle(); };
  if (R.folienAuf && folSeiten.length) {
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
    r.geprueft = true;
    bankZeit(); // Erklärungen lesen zählt nicht als Nachdenkzeit auf der Frage
    const e = C.scoreFrage(q, r.gewaehlt);
    C.syncEvent({ frage_id: q.id, gewaehlt: r.gewaehlt, punkte: e.punkte, max_punkte: q.maxPunkte, voll: e.voll, modus: R.cfg.modus, ts: new Date().toISOString() });
    C.save();
    zeigMoodle();
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
  const regenStart = stufe === 5 ? 1.4 : 2.4; // im Finale geht's früher los
  // Mehr Bewegung je Stufe: stärkeres Pendeln (--sw) und mehr Eigendrehung (--spin)
  const regen = Array.from({ length: 28 + stufe * 22 }, () => {
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
    }).join("")}</div></div>`;
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

  h(`<div class="fade-in">
    <div class="topbar"><button class="back" id="back">‹</button><h1>Auswertung</h1>
      <span style="margin-left:auto;display:inline-flex;gap:4px">
        ${session.runde && session.beantwortet < session.anzahl ? `<button class="btn small" id="reopenBtn">Fortsetzen</button>` : ""}
        <button class="btn ghost small" id="delBtn" title="Session löschen">🗑</button></span></div>
    <div class="card result-big">
      ${abgebrochen ? `<img class="sticker big" src="${reactSrc("monkey_side")}" alt="">` : sticker(pass ? "good" : "sanft", true)}
      <h2>${abgebrochen ? "Abgebrochen — trotzdem gewertet, was da war." : pass ? "Bestanden! 🎉" : "Noch nicht — aber jede Runde zählt."}</h2>
      <div class="pts"><span class="js-count" data-to="${session.punkte}">${session.punkte}</span><span style="font-size:1.3rem;color:var(--ink-soft)"> / ${session.max}</span></div>
      <span class="verdict ${pass ? "pass" : "fail"}">${pass ? "✓ über der Bestehensgrenze" : `Bestehensgrenze: ${session.bestehenBei} P.`}</span>
      <p class="muted mt">${session.beantwortet}/${session.anzahl} beantwortet · ${Math.round(session.dauerSek / 60)} min gesamt${avgZeit != null ? ` · Ø ${fmtSek(avgZeit)} pro Frage` : ""}</p>
    </div>
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
  if (!opts.ausVerlauf) {
    document.getElementById("homeBtn").onclick = home;
    document.getElementById("nochmal").onclick = home;
  }
  // Auswertung beleben: Punktzahl zählt hoch, Themen-Balken wachsen rein.
  belebeStats(app.querySelector(".fade-in"));
  // Nur beim frischen Bestehen einer Klausur-Simulation, nicht beim Stöbern im Verlauf.
  // Stufe = aktuelle Bestanden-Serie (die frische Session zählt schon mit).
  if (pass && !abgebrochen && session.modus === "klausur" && !opts.ausVerlauf)
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
const EXF = { quelle: "alle", typ: "alle", status: "alle" };
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
      const qs = C.pool().filter((q) => q.oberthema === slug && q.unterthema === u && (q.sprache || "schwer") !== "einfach" && exFilter(q))
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
  h(`<div class="fade-in"><div class="topbar"><button class="back" id="back">‹</button><h1>Explore</h1></div>${filterRow}${bloecke || `<p class="muted" style="text-align:center">Kein Treffer mit diesen Filtern.</p>`}</div>`);
  document.getElementById("back").onclick = home;
  app.querySelectorAll("[data-exf]").forEach((seg) => seg.querySelectorAll("button").forEach((b) => b.onclick = () => {
    EXF[seg.dataset.exf] = b.dataset.v; explore();
  }));
  app.querySelectorAll("[data-try]").forEach((b) => b.onclick = () => tryInline(b.dataset.try, b));
  app.querySelectorAll("[data-info]").forEach((b) => b.onclick = () => toggleInfo(b.dataset.info, b));
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
  zone.innerHTML = `<div class="q-stats">${kopf}${loesung}${stats}</div>`;
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
    const gewaehlt = [...wrap.querySelectorAll("input:checked")].map((x) => +x.dataset.oi);
    const erg = C.scoreFrage(q, gewaehlt);
    const zeit = Math.round((Date.now() - t0) / 1000);
    C.leitnerUpdate(q.id, erg);
    C.logAntwort({ qid: q.id, modus: "explore", gewaehlt, punkte: erg.punkte, max: q.maxPunkte, voll: erg.voll, zeit });
    C.syncEvent({ frage_id: q.id, gewaehlt, punkte: erg.punkte, max_punkte: q.maxPunkte, voll: erg.voll, modus: "explore", ts: new Date().toISOString() });
    wrap.querySelectorAll("label.ans").forEach((el) => {
      const oi = +el.querySelector("input").dataset.oi; const o = q.optionen[oi]; const gw = gewaehlt.includes(oi);
      el.querySelector("input").disabled = true;
      if (gw && o.richtig) el.classList.add("correct"); else if (gw) el.classList.add("wrong"); else if (o.richtig) el.classList.add("missed");
      if (o.erklaerung && (gw || o.richtig)) el.insertAdjacentHTML("afterend", `<div class="explain ${o.richtig ? "good" : "bad"}">${Beleg.render(o.erklaerung, q.oberthema)}</div>`);
    });
    const cls = erg.voll ? "good" : erg.punkte > 0 ? "part" : "bad";
    // Nochmal üben setzt die Zone frisch auf — jeder Versuch zählt einzeln
    wrap.querySelector(".fbz").innerHTML = `<div class="fb-banner ${cls}">${sticker(cls)}<span>${erg.voll ? "Voll richtig! 🎉" : `${erg.punkte}/${q.maxPunkte} P.`}</span></div>
      <button class="btn small" id="re-${qid}">🔁 Nochmal üben</button>`;
    const dots = item.querySelector(".lvl-dots"); if (dots) dots.innerHTML = lvlDots(q.id);
    document.getElementById(`chk-${qid}`).classList.add("hidden");
    document.getElementById(`re-${qid}`).onclick = () => tryInline(qid, btn);
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
    s += scope === "runde"
      ? `Nimm dir als Nächstes eine kurze Runde nur dazu und geh die Erklärungen mit den 📄-Folien durch.`
      : `Kleinster Schritt: eine 10er-Runde nur zu ${esc(tn(w.thema))} — beim Nachlesen führen die 📄-Sprungmarken direkt zur Folie.`;
    if (w.tempo) s += ` Du gehst da oft schnell ran; einmal bewusst langsamer lesen bringt hier am meisten.`;
    p.push(`<div class="fokus">${s}</div>`);
  }
  if (a.staerken.length)
    p.push(`<p class="an-zeile"><b>Das sitzt schon:</b> ${a.staerken.map((x) => `<span class="tag-gut">${esc(tn(x.thema))} ${x.quote}%</span>`).join(" ")} — deine Basis, da kannst du dir sicher sein. 💪</p>`);
  if (a.schwaechen.length)
    p.push(`<p class="an-zeile"><b>Hier ist am meisten drin:</b> ${a.schwaechen.map((x) => `<span class="tag-hebel">${esc(tn(x.thema))} ${x.quote}%</span>`).join(" ")}</p>`);
  if (a.verwechslung?.length)
    p.push(`<p class="muted an-zeile">Leicht zu verwechseln: ${a.verwechslung.slice(0, 3).map((v) => esc(v.paar)).join(" · ")}.</p>`);
  return p.join("");
}

// ================= STATISTIK =================
function statistik() {
  const st = C.statistik();
  const kachel = (wert, lbl) => `<div class="stat-tile"><b>${wert}</b><span>${lbl}</span></div>`;
  const pkt = (v) => `${v.pkt}/${v.maxSchnitt} P.`;
  // Pro Thema: aufklappbar bis auf die Unterthemen (Beherrschung + Ø Punkte + Ø Zeit)
  const themenRows = st.proThema.map((tt) => {
    const t = C.THEMEN[tt.slug] || { name: tt.slug, color: "var(--ink-soft)" };
    const subRows = tt.unterthemen.map((s, ui) => {
      const beherrsch = s.tot ? Math.round((100 * s.m) / s.tot) : 0;
      return `<div class="progress-row sub" style="--tc:${C.subColor(tt.slug, ui)}">
        <span class="lbl">${esc(labelU(s.u))} <small class="muted">${s.n}×</small></span>
        <span class="bar thin"><i style="width:${beherrsch}%"></i></span>
        <span class="val">${s.quote}%<small>${pkt(s)}${s.zeit != null ? " · " + fmtSek(s.zeit) : ""}</small></span></div>`;
    }).join("");
    return `<details class="topic" style="--tc:${t.color}">
      <summary><span class="lbl">${t.name}</span>
        <span class="bar"><i style="width:${tt.quote ?? 0}%"></i></span>
        <span class="val">${tt.quote != null ? tt.quote + " %" : "–"}<small>${tt.n}× · ${pkt(tt)}${tt.zeit != null ? " · " + fmtSek(tt.zeit) : ""}</small></span></summary>
      <div class="sub-wrap"><p class="muted sub-head">Balken = beherrschte Fragen (Level ≥ 3) · Zahl = Ø Punktequote · dann Ø Punkte & Ø Zeit</p>${subRows}</div>
    </details>`;
  }).join("");
  // Trend: Punktequote der letzten Sitzungen als Mini-Verlauf
  const tr = st.trend;
  let trendHtml = "";
  if (tr.genug) {
    const qs = tr.proSession.map((s) => s.quote);
    const mx = Math.max(60, ...qs), mn = Math.min(40, ...qs);
    const bars = tr.proSession.map((s) => {
      const hoehe = Math.round((100 * (s.quote - mn)) / Math.max(1, mx - mn));
      return `<div class="tr-col" title="${MODUS_LBL[s.modus] || s.modus}: ${s.punkte}/${s.max} (${s.quote} %)">
        <span class="tr-q">${s.quote}%</span><i style="height:${Math.max(6, hoehe)}%;--tc:${s.bestanden ? "var(--ok)" : "var(--bad)"}"></i>
        <span class="tr-lbl">${(MODUS_LBL[s.modus] || s.modus).replace(/^\S+\s/, "").slice(0, 8)}</span></div>`;
    }).join("");
    const satz = tr.richtung === "hoch" ? `Aufwärts — zuletzt +${tr.delta} Punkte gegenüber vorher. Weiter so! 🎉`
      : tr.richtung === "runter" ? `Zuletzt ${tr.delta} Punkte unter dem Schnitt davor — erst ${tr.proSession.length} Runden, das schwankt noch. Kein Grund zur Sorge.`
      : `Stabil um die ${Math.round(tr.proSession.reduce((a, s) => a + s.quote, 0) / tr.proSession.length)} %.`;
    trendHtml = `<div class="card"><h3>Trend 📈</h3><div class="trend-chart">${bars}</div><p class="muted" style="margin-bottom:0">${satz}</p></div>`;
  } else if (st.sessions >= 1) {
    trendHtml = `<div class="card"><h3>Trend 📈</h3><p class="muted" style="margin:0">Nach der zweiten abgeschlossenen Runde zeigt sich hier dein Verlauf.</p></div>`;
  }
  const maxTag = Math.max(1, ...st.tage14.map((d) => d.n));
  const aktivitaet = st.tage14.map((d) => `<div class="akt-col" title="${new Date(d.ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}: ${d.n} Antworten">
    <i style="height:${Math.round((100 * d.n) / maxTag)}%"></i><span>${new Date(d.ts).getDate()}</span></div>`).join("");
  h(`<div class="fade-in">
    <div class="topbar"><button class="back" id="back">‹</button><h1>Statistik 📊</h1></div>
    ${st.beantwortet ? `
    <div class="card"><div class="stat-grid">
      ${kachel(st.beantwortet, "Antworten gesamt")}
      ${kachel(st.punkteQuote != null ? st.punkteQuote + " %" : "–", "Ø Punktequote")}
      ${kachel(st.vollQuote != null ? st.vollQuote + " %" : "–", "voll richtig")}
      ${kachel(st.avgZeit != null ? fmtSek(st.avgZeit) : "–", "Ø Zeit pro Frage")}
      ${kachel(st.uebungsTage, st.uebungsTage === 1 ? "Übungstag" : "Übungstage")}
      ${kachel(st.sessions, "Sessions")}
    </div></div>
    <div class="card an-card"><div class="an-head"><h3>💡 Wo du stehst</h3>${standSticker(st.punkteQuote)}</div>${analyseHtml(st.analyse, "global")}</div>
    <div class="card"><h3>Nach Thema</h3><p class="muted" style="margin-top:-4px">Antippen zum Aufklappen — Ø Punktequote, Anzahl, Ø Zeit; innen die Unterthemen mit Beherrschung.</p>${themenRows}</div>
    ${trendHtml}
    <div class="card"><h3>Aktivität — letzte 14 Tage</h3><div class="akt-chart">${aktivitaet}</div></div>`
    : `<div class="card"><p class="muted">Noch keine Antworten geloggt — nach der ersten Runde gibt's hier Zahlen. 💪</p></div>`}
  </div>`);
  belebeStats(app.querySelector(".fade-in"));
  document.getElementById("back").onclick = home;
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
