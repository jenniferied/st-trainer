import * as C from "./core.js";

const app = document.getElementById("app");
const h = (html) => { app.innerHTML = html; app.scrollTop = 0; window.scrollTo(0, 0); };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

let R = null;      // aktive Runde
let timerInt = null;

// ================= HOME =================
function home() {
  stopTimer();
  const s = C.state();
  const score = C.lernscore();
  const streak = C.pruefungsStreak();
  const aktiv = s.active;
  const ring = ringSVG(score);
  const themenRows = Object.entries(C.THEMEN).map(([slug, t]) => {
    const f = C.themaFortschritt(slug);
    return `<div class="progress-row" style="--tc:${t.color}">
      <span class="lbl">${t.name}</span>
      <span class="bar"><i style="width:${f.pct}%"></i></span>
      <span class="val">${f.m}/${f.n}</span></div>`;
  }).join("");

  h(`<div class="fade-in">
    <div class="card hero">
      <h1>Hey${s.settings.name ? ", " + esc(s.settings.name) : ""}! ✏️</h1>
      <div class="score-ring">${ring}<div class="num">${score}%</div></div>
      <div class="muted">Lernscore — wächst mit jeder Runde</div>
      <div class="streak">${[0,1,2,3,4].map(i => `<i class="${i < streak ? "hit" : ""}">${i < streak ? "✓" : ""}</i>`).join("")}</div>
      <div class="muted">Prüfungsreife: ${streak}/5 Simulationen in Folge bestanden</div>
    </div>
    ${aktiv ? `<button class="btn mt" id="resume">▶︎ Pausierte Runde fortsetzen (${aktiv.runde.filter(r=>r.gewaehlt).length}/${aktiv.runde.length})</button>` : ""}
    <div class="mode-grid mt">
      <button class="mode-card wide" data-go="klausur"><b>🎓 Klausur-Simulation</b><span>42 Fragen · Moodle-Look · echtes Scoring</span></button>
      <button class="mode-card" data-go="schnell"><b>⚡ Schnelle 10er</b><span>10 Fragen, sofortiges Feedback</span></button>
      <button class="mode-card" data-go="fehler"><b>🔁 Fehler-Training</b><span>Nur Fragen, die noch wackeln</span></button>
      <button class="mode-card" data-go="eigene"><b>🧩 Eigene Runde</b><span>Themen frei zusammenstellen</span></button>
      <button class="mode-card" data-go="explore"><b>🗂 Explore</b><span>Alle Fragen browsen & üben</span></button>
      <button class="mode-card wide" data-go="verlauf"><b>📊 Verlauf</b><span>${s.sessions.length} abgeschlossene Runden</span></button>
    </div>
    <div class="card">${themenRows}</div>
    <details class="card"><summary style="font-weight:700;cursor:pointer">⚙️ Einstellungen</summary>
      <div class="field mt"><label class="flabel">Dein Name</label>
        <input id="set-name" value="${esc(s.settings.name)}" style="width:100%;padding:10px;border:1.5px solid var(--line);border-radius:10px;font:inherit" placeholder="z.B. Rose"></div>
      <div class="field"><label class="flabel">Scoring-Variante</label>
        <div class="seg" id="set-scoring">
          <button data-v="streng" class="${s.settings.scoring !== "milde" ? "on" : ""}">Streng (offiziell)</button>
          <button data-v="milde" class="${s.settings.scoring === "milde" ? "on" : ""}">Milde (Roses Version)</button>
        </div></div>
      <div class="btn-row"><button class="btn secondary small" id="exportBtn">Backup exportieren</button>
      <label class="btn secondary small" style="text-align:center">Import<input type="file" id="importBtn" class="hidden" accept=".json"></label></div>
      <p class="muted mt">Sync: ${C.supaAktiv() ? "✅ aktiv" : "⏸ noch nicht konfiguriert"} · ${C.state().pending.length} Events in Warteschlange</p>
    </details>
  </div>`);

  app.querySelectorAll("[data-go]").forEach((b) => b.onclick = () => route(b.dataset.go));
  const rs = document.getElementById("resume"); if (rs) rs.onclick = resumeActive;
  document.getElementById("set-name").onchange = (e) => { C.state().settings.name = e.target.value.trim(); C.save(); };
  document.getElementById("set-scoring").querySelectorAll("button").forEach((b) => b.onclick = () => { C.state().settings.scoring = b.dataset.v; C.save(); home(); });
  document.getElementById("exportBtn").onclick = C.exportState;
  document.getElementById("importBtn").onchange = async (e) => { if (e.target.files[0]) { await C.importState(e.target.files[0]); home(); } };
}

function ringSVG(pct) {
  const r = 58, c = 2 * Math.PI * r;
  return `<svg width="132" height="132"><circle cx="66" cy="66" r="${r}" fill="none" stroke="var(--paper-2)" stroke-width="12"/>
  <circle cx="66" cy="66" r="${r}" fill="none" stroke="var(--accent)" stroke-width="12" stroke-linecap="round"
   stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}"/></svg>`;
}

function route(ziel) {
  if (ziel === "klausur") builder({ preset: "klausur" });
  else if (ziel === "schnell") starte({ modus: "schnell", anzahl: 10, feedback: "sofort", timerModus: "aus", pausierbar: true });
  else if (ziel === "fehler") starte({ modus: "fehler", anzahl: 15, nurFehler: true, feedback: "sofort", timerModus: "aus", pausierbar: true });
  else if (ziel === "eigene") builder({ preset: "eigene" });
  else if (ziel === "explore") explore();
  else if (ziel === "verlauf") verlauf();
}

// ================= BUILDER =================
function builder({ preset }) {
  const istKlausur = preset === "klausur";
  const nta = C.state().settings.nta;
  const themenBoxen = Object.entries(C.THEMEN).map(([slug, t]) => {
    const subs = C.unterthemen(slug);
    return `<label class="check" style="--tc:${t.color}">
      <input type="checkbox" class="th" value="${slug}" checked>
      <span><span class="chip" style="--tc:${t.color}">${t.kurz}</span> <b>${t.name}</b></span></label>
      ${subs.map(([u, n], i) => `<label class="check sub"><input type="checkbox" class="uth" data-th="${slug}" value="${slug}/${u}" checked> ${esc(labelU(u))} <span class="muted">(${n})</span></label>`).join("")}`;
  }).join("");

  h(`<div class="fade-in">
    <div class="topbar"><button class="back" id="back">‹</button><h1>${istKlausur ? "Klausur-Simulation" : "Eigene Runde"}</h1></div>
    ${istKlausur ? `<div class="card"><p>42 Fragen quer durch alle Themen, im <b>Moodle-Look</b> wie in der echten Klausur. Feedback gibt's erst am Ende — genau wie im Ernstfall.</p></div>` : ""}
    ${!istKlausur ? `<div class="field"><span class="flabel">Fragenzahl</span><div class="seg" id="anz">
      ${[10, 21, 30, 42].map((n, i) => `<button data-v="${n}" class="${i === 0 ? "on" : ""}">${n}</button>`).join("")}</div></div>` : ""}
    <div class="field"><span class="flabel">Timer</span><div class="seg" id="timer">
      <button data-v="aus" class="${istKlausur ? "" : "on"}">Ohne</button>
      <button data-v="normal" class="${istKlausur && !nta ? "on" : ""}">Normal</button>
      <button data-v="nta" class="${istKlausur && nta ? "on" : ""}">+ Nachteilsausgleich</button></div>
      <p class="muted" id="timerHint"></p></div>
    <div class="field"><span class="flabel">Pausierbar</span><div class="seg" id="pause">
      <button data-v="ja" class="${istKlausur ? "" : "on"}">Ja</button><button data-v="nein" class="${istKlausur ? "on" : ""}">Nein (wie echt)</button></div></div>
    ${!istKlausur ? `<div class="field"><span class="flabel">Feedback</span><div class="seg" id="fb">
      <button data-v="sofort" class="on">Sofort je Frage</button><button data-v="ende" class="">Erst am Ende</button></div></div>` : ""}
    <div class="field"><span class="flabel">Themen & Unterthemen</span><div class="opt-list">${themenBoxen}</div></div>
    <button class="btn" id="los">Los geht's</button>
  </div>`);

  document.getElementById("back").onclick = home;
  app.querySelectorAll(".seg").forEach((seg) => seg.querySelectorAll("button").forEach((b) => b.onclick = () => {
    seg.querySelectorAll("button").forEach((x) => x.classList.remove("on")); b.classList.add("on"); updateHint();
  }));
  // Oberthema-Checkbox togglet Unterthemen
  app.querySelectorAll(".th").forEach((cb) => cb.onchange = () => {
    app.querySelectorAll(`.uth[data-th="${cb.value}"]`).forEach((u) => { u.checked = cb.checked; u.disabled = !cb.checked; });
  });
  const segVal = (id) => app.querySelector(`#${id} button.on`)?.dataset.v;
  const updateHint = () => {
    const n = istKlausur ? 42 : +(segVal("anz") || 10);
    const t = segVal("timer");
    document.getElementById("timerHint").textContent = t === "aus" ? "Ohne Zeitdruck üben." : `≈ ${C.timerMinuten(n, t)} Minuten für ${n} Fragen (${t === "nta" ? "mit" : "ohne"} Nachteilsausgleich, relativ zur echten Klausur).`;
  };
  updateHint();
  document.getElementById("los").onclick = () => {
    const unterthemen = [...app.querySelectorAll(".uth:checked")].map((x) => x.value);
    if (!unterthemen.length) { alert("Mindestens ein Thema auswählen 🙂"); return; }
    starte({
      modus: istKlausur ? "klausur" : "eigene",
      anzahl: istKlausur ? 42 : +(segVal("anz") || 10),
      timerModus: segVal("timer"), pausierbar: segVal("pause") === "ja",
      feedback: istKlausur ? "ende" : segVal("fb"), unterthemen,
    });
  };
}
const labelU = (u) => u.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// ================= RUNDE =================
function starte(cfg) {
  const runde = C.baueRunde(cfg);
  if (runde.length < Math.min(cfg.anzahl, 5)) { alert(`Zu wenig passende Fragen gefunden (${runde.length}). Wähle mehr Themen.`); return; }
  R = { cfg, runde, idx: 0, startTs: Date.now(), pausiertSek: 0, deadline: null };
  const min = C.timerMinuten(runde.length, cfg.timerModus);
  if (min) R.deadline = Date.now() + min * 60000;
  zeigFrage();
}
function resumeActive() {
  R = C.state().active; C.state().active = null; C.save();
  if (R.restSek && R.cfg.timerModus !== "aus") R.deadline = Date.now() + R.restSek * 1000;
  zeigFrage();
}
function pausiere() {
  if (R.deadline) R.restSek = Math.max(0, Math.round((R.deadline - Date.now()) / 1000));
  C.state().active = R; C.save(); R = null; home();
}
function stopTimer() { if (timerInt) { clearInterval(timerInt); timerInt = null; } }
function tickTimer() {
  const el = document.getElementById("t-anzeige");
  if (!el || !R?.deadline) return;
  const rest = Math.max(0, Math.round((R.deadline - Date.now()) / 1000));
  el.textContent = `${String(Math.floor(rest / 60)).padStart(2, "0")}:${String(rest % 60).padStart(2, "0")}`;
  el.classList.toggle("low", rest < 300);
  if (rest <= 0) { stopTimer(); beende(); }
}

function zeigFrage() {
  stopTimer();
  if (R.cfg.modus === "klausur") return zeigMoodle();
  const r = R.runde[R.idx];
  const q = C.frage(r.qid);
  const t = C.THEMEN[q.oberthema] || {};
  h(`<div class="fade-in">
    <div class="q-progress">
      <button class="back" id="abbruch">‹</button>
      <span class="bar thin" style="--tc:${t.color}"><i style="width:${(100 * R.idx) / R.runde.length}%"></i></span>
      <span>${R.idx + 1}/${R.runde.length}</span>
      ${R.deadline ? `<span class="timer" id="t-anzeige"></span>` : ""}
      ${R.cfg.pausierbar ? `<button class="btn ghost small" id="pauseBtn">⏸</button>` : ""}
    </div>
    <div class="card">
      <div class="q-head"><span class="chip" style="--tc:${t.color}">${t.kurz}</span>
        <span class="chip outline" style="--tc:${t.color}">${esc(labelU(q.unterthema))}</span>
        ${q.loesungSicherheit === "unsicher" ? `<span class="badge-src badge-unsicher">Lösung unbestätigt</span>` : ""}
        ${q.quelle === "generiert" ? `<span class="badge-src badge-generiert">KI-generiert</span>` : ""}
        <span class="q-pts" style="margin-left:auto">${q.maxPunkte} P.</span></div>
      <div class="q-text">${esc(q.frage)}</div>
      <div class="answers" id="answers">
        ${r.optOrder.map((oi) => `<label class="ans"><input type="checkbox" data-oi="${oi}"><span>${esc(q.optionen[oi].text)}</span></label>`).join("")}
      </div>
      <div id="fbzone"></div>
      <div class="btn-row mt">
        ${R.cfg.feedback === "sofort" ? `<button class="btn" id="pruefen">Antwort prüfen</button>` : ""}
        <button class="btn ${R.cfg.feedback === "sofort" ? "secondary hidden" : ""}" id="weiter">${R.idx + 1 === R.runde.length ? "Abschließen" : "Weiter"}</button>
      </div>
    </div></div>`);
  if (R.deadline) { tickTimer(); timerInt = setInterval(tickTimer, 1000); }
  document.getElementById("abbruch").onclick = () => { if (confirm("Runde wirklich abbrechen? Beantwortete Fragen werden gewertet.")) beende(); };
  const pb = document.getElementById("pauseBtn"); if (pb) pb.onclick = pausiere;
  const gewaehlt = () => [...app.querySelectorAll("#answers input:checked")].map((x) => +x.dataset.oi);
  const pruefen = document.getElementById("pruefen");
  if (pruefen) pruefen.onclick = () => {
    r.gewaehlt = gewaehlt();
    zeigeFeedback(q, r);
    pruefen.classList.add("hidden");
    document.getElementById("weiter").classList.remove("hidden");
  };
  document.getElementById("weiter").onclick = () => {
    if (R.cfg.feedback !== "sofort") r.gewaehlt = gewaehlt();
    if (!r.gewaehlt) r.gewaehlt = gewaehlt();
    naechste();
  };
}
function zeigeFeedback(q, r) {
  const erg = C.scoreFrage(q, r.gewaehlt);
  C.syncEvent({ frage_id: q.id, gewaehlt: r.gewaehlt, punkte: erg.punkte, max_punkte: q.maxPunkte, voll: erg.voll, modus: R?.cfg.modus || "explore", ts: new Date().toISOString() });
  app.querySelectorAll("#answers label.ans").forEach((el) => {
    const oi = +el.querySelector("input").dataset.oi;
    const o = q.optionen[oi]; const gewaehlt = r.gewaehlt.includes(oi);
    el.querySelector("input").disabled = true;
    if (gewaehlt && o.richtig) el.classList.add("correct");
    else if (gewaehlt && !o.richtig) el.classList.add("wrong");
    else if (!gewaehlt && o.richtig) el.classList.add("missed");
    if (o.erklaerung && (gewaehlt || o.richtig)) {
      el.insertAdjacentHTML("afterend", `<div class="explain ${o.richtig ? "good" : "bad"}">${esc(o.erklaerung)}</div>`);
    }
  });
  const cls = erg.voll ? "good" : erg.punkte > 0 ? "part" : "bad";
  const txt = erg.voll ? `Voll richtig! +${erg.punkte} P. 🎉` : erg.punkte > 0 ? `Teilweise: ${erg.punkte} von ${q.maxPunkte} P.` : `Diesmal 0 Punkte — die Erklärungen unten helfen.`;
  document.getElementById("fbzone").innerHTML = `<div class="fb-banner ${cls}">${txt}</div>`;
}
function naechste() {
  if (R.idx + 1 < R.runde.length) { R.idx++; zeigFrage(); } else beende();
}
function beende() {
  stopTimer();
  const dauerSek = Math.round((Date.now() - R.startTs) / 1000);
  const session = C.werteAus(R.runde, { modus: R.cfg.modus, timerModus: R.cfg.timerModus, dauerSek, sprache: R.cfg.sprache });
  const rundeKopie = R.runde; R = null;
  ergebnis(session, rundeKopie);
}

// ================= MOODLE-KLAUSURMODUS =================
function zeigMoodle() {
  stopTimer();
  const r = R.runde[R.idx];
  const q = C.frage(r.qid);
  const single = q.optionen.filter((o) => o.richtig).length === 1;
  h(`<div class="fade-in">
    <div class="moodle">
      <div class="moodle-bar"><span>Testversuch — ${esc((C.state().settings.name || "Teilnehmer/in"))}</span>
        ${R.deadline ? `<span class="timer" id="t-anzeige"></span>` : ""}</div>
      <div class="moodle-body">
        <div class="qinfo"><b>Frage ${R.idx + 1}</b>${r.gewaehlt?.length ? "Antwort gespeichert" : "Bisher nicht beantwortet"}<br>Erreichbare Punkte: ${q.maxPunkte.toFixed(2).replace(".", ",")}</div>
        <div class="qtext">${esc(q.frage)}</div>
        <div style="clear:both"></div>
        <div class="prompt">${single ? "Wählen Sie eine Antwort:" : "Wählen Sie eine oder mehrere Antworten:"}</div>
        ${r.optOrder.map((oi, i) => `<label class="mans"><input type="checkbox" data-oi="${oi}" ${r.gewaehlt?.includes(oi) ? "checked" : ""}><span>${"abcdefghijkl"[i]}. ${esc(q.optionen[oi].text)}</span></label>`).join("")}
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
      ${R.cfg.pausierbar ? `<button class="btn secondary" id="pauseBtn">⏸ Pausieren</button>` : ""}
      <button class="btn ghost" id="abbruch">Abbrechen</button>
    </div></div>`);
  if (R.deadline) { tickTimer(); timerInt = setInterval(tickTimer, 1000); }
  const merke = () => { R.runde[R.idx].gewaehlt = [...app.querySelectorAll(".moodle input:checked")].map((x) => +x.dataset.oi); };
  app.querySelectorAll(".moodle input").forEach((i) => i.onchange = merke);
  const prev = document.getElementById("prev"); if (prev) prev.onclick = () => { merke(); R.idx--; zeigMoodle(); };
  document.getElementById("next").onclick = () => {
    merke();
    if (R.idx + 1 === R.runde.length) {
      const offen = R.runde.filter((x) => !x.gewaehlt?.length).length;
      if (confirm(offen ? `Noch ${offen} Frage(n) unbeantwortet. Trotzdem abgeben?` : "Test wirklich abgeben?")) beende();
    } else { R.idx++; zeigMoodle(); }
  };
  document.getElementById("grid").querySelectorAll("button").forEach((b) => b.onclick = () => { merke(); R.idx = +b.dataset.i; zeigMoodle(); });
  const pb = document.getElementById("pauseBtn"); if (pb) pb.onclick = pausiere;
  document.getElementById("abbruch").onclick = () => { if (confirm("Klausur abbrechen? Beantwortete Fragen werden gewertet.")) beende(); };
}

// ================= ERGEBNIS =================
function ergebnis(session, runde) {
  const pass = session.bestanden;
  const insights = C.insights(session);
  const themen = C.gruppiere(session.proFrage, (x) => x.thema);
  const themenRows = Object.entries(themen).map(([slug, arr]) => {
    const t = C.THEMEN[slug] || { name: slug };
    const p = arr.reduce((a, x) => a + x.punkte, 0), m = arr.reduce((a, x) => a + x.max, 0);
    return `<div class="progress-row" style="--tc:${t.color}"><span class="lbl">${t.name}</span>
      <span class="bar"><i style="width:${Math.round((100 * p) / m)}%"></i></span><span class="val">${p}/${m}</span></div>`;
  }).join("");
  const review = (runde || []).filter((r) => r.gewaehlt).map((r) => {
    const q = C.frage(r.qid); const t = C.THEMEN[q.oberthema] || {};
    const erg = session.proFrage.find((x) => x.qid === r.qid);
    return `<div class="review-q">
      <div class="q-head"><span class="chip" style="--tc:${t.color}">${t.kurz}</span><span class="q-pts">${erg.punkte}/${erg.max} P.</span></div>
      <div class="q-text" style="font-size:1rem">${esc(q.frage)}</div>
      <div class="answers">${r.optOrder.map((oi) => {
        const o = q.optionen[oi]; const gw = r.gewaehlt.includes(oi);
        const cls = gw && o.richtig ? "correct" : gw ? "wrong" : o.richtig ? "missed" : "";
        return `<label class="ans ${cls}"><input type="checkbox" disabled ${gw ? "checked" : ""}><span>${esc(o.text)}</span></label>
          ${o.erklaerung && (gw || o.richtig) ? `<div class="explain ${o.richtig ? "good" : "bad"}">${esc(o.erklaerung)}</div>` : ""}`;
      }).join("")}</div></div>`;
  }).join("");

  h(`<div class="fade-in">
    <div class="card result-big">
      <h2>${pass ? "Bestanden! 🎉" : "Noch nicht — aber jede Runde zählt."}</h2>
      <div class="pts">${session.punkte}<span style="font-size:1.3rem;color:var(--ink-soft)"> / ${session.max}</span></div>
      <span class="verdict ${pass ? "pass" : "fail"}">${pass ? "✓ über der Bestehensgrenze" : `Bestehensgrenze: ${session.bestehenBei} P.`}</span>
      <p class="muted mt">${session.beantwortet}/${session.anzahl} beantwortet · ${Math.round(session.dauerSek / 60)} min · Scoring: ${C.state().settings.scoring === "milde" ? "milde" : "streng"}</p>
    </div>
    ${insights.length ? `<div class="card"><h3>💡 Insights</h3>${insights.map((i) => `<div class="insight">${esc(i)}</div>`).join("")}</div>` : ""}
    <div class="card"><h3>Nach Thema</h3>${themenRows}</div>
    <div class="btn-row"><button class="btn" id="nochmal">Neue Runde</button><button class="btn secondary" id="homeBtn">Übersicht</button></div>
    <div class="card mt"><h3>Alle Fragen im Detail</h3>${review || "<p class='muted'>Keine beantworteten Fragen.</p>"}</div>
  </div>`);
  document.getElementById("homeBtn").onclick = home;
  document.getElementById("nochmal").onclick = () => route(session.modus === "klausur" ? "klausur" : session.modus === "fehler" ? "fehler" : "schnell");
}

// ================= EXPLORE =================
function explore() {
  const bloecke = Object.entries(C.THEMEN).map(([slug, t]) => {
    const subs = C.unterthemen(slug);
    const inner = subs.map(([u], ui) => {
      const qs = C.pool().filter((q) => q.oberthema === slug && q.unterthema === u)
        .sort((a, b) => C.quelleRank(a.quelle) - C.quelleRank(b.quelle));
      const items = qs.map((q) => `<div class="q-item" data-qid="${q.id}">
        <div class="qq">${esc(q.frage)}</div>
        <div class="meta">
          <span class="badge-src">${C.quelleLabel(q.quelle)}</span>
          ${q.fragetyp === "negation" ? `<span class="badge-src">NICHT-Frage</span>` : ""}
          ${q.fragetyp === "anwendung" ? `<span class="badge-src">Anwendung</span>` : ""}
          ${q.loesungSicherheit === "unsicher" ? `<span class="badge-src badge-unsicher">unbestätigt</span>` : ""}
          ${q.relevanz === "laut-rose-nicht-relevant" ? `<span class="badge-src">lt. Rose nicht relevant</span>` : ""}
          <span class="lvl-dots" style="--tc:${t.color}">${[0,1,2].map((i) => `<i class="${C.lvl(q.id) > i ? "on" : ""}"></i>`).join("")}</span>
          ${q.quizbar ? `<button class="btn ghost small" style="margin-left:auto" data-try="${q.id}">Üben ›</button>` : `<span class="muted" style="margin-left:auto;font-size:.75rem">keine Lösung</span>`}
        </div><div class="try-zone"></div></div>`).join("");
      return `<details class="sub"><summary><span class="chip" style="--tc:${C.subColor(slug, ui)}">${qs.length}</span> ${esc(labelU(u))}</summary>${items}</details>`;
    }).join("");
    const f = C.themaFortschritt(slug);
    return `<details class="topic" style="--tc:${t.color}"><summary>${t.name} <span class="muted" style="font-family:Karla;font-size:.85rem">· ${f.m}/${f.n} gemeistert</span></summary>${inner}</details>`;
  }).join("");
  h(`<div class="fade-in"><div class="topbar"><button class="back" id="back">‹</button><h1>Explore</h1></div>${bloecke}</div>`);
  document.getElementById("back").onclick = home;
  app.querySelectorAll("[data-try]").forEach((b) => b.onclick = () => tryInline(b.dataset.try, b));
}
function tryInline(qid, btn) {
  const q = C.frage(qid);
  const wrap = btn.closest(".q-item").querySelector(".try-zone");
  const order = C.shuffle([...q.optionen.keys()]);
  wrap.innerHTML = `<div class="answers mt" id="try-${qid}">
    ${order.map((oi) => `<label class="ans"><input type="checkbox" data-oi="${oi}"><span>${esc(q.optionen[oi].text)}</span></label>`).join("")}
    </div><button class="btn small mt" id="chk-${qid}">Prüfen (${q.maxPunkte} P.)</button><div class="fbz"></div>`;
  btn.classList.add("hidden");
  document.getElementById(`chk-${qid}`).onclick = () => {
    const gewaehlt = [...wrap.querySelectorAll("input:checked")].map((x) => +x.dataset.oi);
    const erg = C.scoreFrage(q, gewaehlt);
    C.leitnerUpdate(q.id, erg);
    C.syncEvent({ frage_id: q.id, gewaehlt, punkte: erg.punkte, max_punkte: q.maxPunkte, voll: erg.voll, modus: "explore", ts: new Date().toISOString() });
    wrap.querySelectorAll("label.ans").forEach((el) => {
      const oi = +el.querySelector("input").dataset.oi; const o = q.optionen[oi]; const gw = gewaehlt.includes(oi);
      el.querySelector("input").disabled = true;
      if (gw && o.richtig) el.classList.add("correct"); else if (gw) el.classList.add("wrong"); else if (o.richtig) el.classList.add("missed");
      if (o.erklaerung && (gw || o.richtig)) el.insertAdjacentHTML("afterend", `<div class="explain ${o.richtig ? "good" : "bad"}">${esc(o.erklaerung)}</div>`);
    });
    const cls = erg.voll ? "good" : erg.punkte > 0 ? "part" : "bad";
    wrap.querySelector(".fbz").innerHTML = `<div class="fb-banner ${cls}">${erg.voll ? "Voll richtig! 🎉" : `${erg.punkte}/${q.maxPunkte} P.`}</div>`;
    document.getElementById(`chk-${qid}`).classList.add("hidden");
  };
}

// ================= VERLAUF =================
function verlauf() {
  const items = [...C.state().sessions].reverse().map((s) => {
    const d = new Date(s.ts);
    const modusLbl = { klausur: "🎓 Klausur", schnell: "⚡ 10er", fehler: "🔁 Fehler", eigene: "🧩 Eigene" }[s.modus] || s.modus;
    return `<div class="hist-item"><div><b>${modusLbl}</b> <span class="${s.bestanden ? "" : ""}">${s.bestanden ? "✅" : "—"}</span>
      <div class="when">${d.toLocaleDateString("de-DE")} ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} · ${s.beantwortet}/${s.anzahl} Fragen · ${Math.round(s.dauerSek / 60)} min</div></div>
      <span class="sc">${s.punkte}/${s.max}</span></div>`;
  }).join("");
  h(`<div class="fade-in"><div class="topbar"><button class="back" id="back">‹</button><h1>Verlauf</h1></div>
    <div class="card">${items || "<p class='muted'>Noch keine abgeschlossenen Runden — die erste ist die wichtigste! 💪</p>"}</div></div>`);
  document.getElementById("back").onclick = home;
}

// ================= BOOT =================
(async function boot() {
  h(`<div class="card center mt"><h2>Lade Fragen …</h2></div>`);
  try {
    await C.ladeFragen();
    C.flushSync();
    home();
  } catch (e) {
    h(`<div class="card center mt"><h2>Ups.</h2><p class="muted">Fragen konnten nicht geladen werden: ${esc(e.message)}</p></div>`);
  }
})();
