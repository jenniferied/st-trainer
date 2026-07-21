// ============ LLM-Anbindung (Block E, NextGen-Plan) ============
// Zwei Einsatzorte: (1) warmes Feedback auf Roses Selbsterklaerung, (2) Chat
// "Ueber diese Frage sprechen". Beides laeuft ueber die Supabase Edge Function
// (Proxy vor der Anthropic API) — der Key liegt NUR dort als Secret.
// EISERNE REGEL: Das LLM ist nie Voraussetzung. Jeder Fehler (Function nicht
// deployed, Limit erreicht, offline, Timeout) faellt lautlos auf den festen
// Ablauf zurueck — Feld, Speicherung und kuratierte Erklaerungen bleiben.
// Kein RAG: Die Beleg-Anker der Erklaerungen SIND das Retrieval — die dort
// referenzierten Folientexte (data/folien-text.json) gehen als Ground Truth mit.

import * as Beleg from "./beleg.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const cfg = () => window.ST_CONFIG || {};
const url = () => cfg().supabaseUrl ? cfg().supabaseUrl + "/functions/v1/llm" : null;
export const aktiv = () => !!url();

// Client-seitiges Tageslimit als zweiter Kostenschutz (die Function hat ihr
// eigenes). Geraetelokal, bewusst nicht im Sync-Lernstand.
const TAG_LIMIT = 120;
function tagBudget() {
  const heute = new Date().toDateString();
  let d;
  try { d = JSON.parse(localStorage.getItem("st-llm-tag") || "{}"); } catch { d = {}; }
  if (d.tag !== heute) d = { tag: heute, n: 0 };
  return d;
}
function tagVerbrauch() {
  const d = tagBudget();
  d.n++;
  localStorage.setItem("st-llm-tag", JSON.stringify(d));
}
const tagFrei = () => tagBudget().n < TAG_LIMIT;

// ---- Folientexte (lazy — erst beim ersten LLM-Einsatz laden) ----
let FT = null, ftLadung = null;
function ladeFolienText() {
  if (FT) return Promise.resolve(FT);
  if (!ftLadung) ftLadung = fetch("data/folien-text.json")
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}))
    .then((d) => (FT = d || {}));
  return ftLadung;
}

// Relevante Folien einer Frage als [{nr: aufgedruckte Nummer, text}] — nr ist
// die SITZUNGS-relative Nummer, damit das Modell "Folie N" so zitiert, dass
// beleg.js daraus klickbare Sprungmarken machen kann (Offset je Oberthema).
async function frageFolien(q, max = 4) {
  await ladeFolienText();
  const zaehl = new Map();
  const texte = [q.konzept || "", ...(q.optionen || []).map((o) => o.erklaerung || "")];
  for (const t of texte) {
    for (const m of String(t).matchAll(/(?:Folien?|F\.)\s?(\d{1,3})(?:\s?[–-]\s?(\d{1,3}))?/g)) {
      const von = +m[1], bis = m[2] ? Math.min(+m[2], von + 3) : von;
      for (let f = von; f <= bis; f++) zaehl.set(f, (zaehl.get(f) || 0) + (f === von ? 1 : 0.5));
    }
  }
  return [...zaehl.entries()].sort((a, b) => b[1] - a[1]).slice(0, max)
    .map(([nr]) => {
      const seite = Beleg.folienSeite(q.oberthema, nr);
      const text = seite ? (FT[String(seite)] || "") : "";
      return text ? { nr, text: text.slice(0, 2200) } : null;
    })
    .filter(Boolean);
}

const frageDaten = (q) => ({
  frage: q.frage, fragetyp: q.fragetyp, konzept: q.konzept,
  optionen: (q.optionen || []).map((o) => ({ text: o.text, richtig: !!o.richtig, erklaerung: o.erklaerung || "" })),
});

function kopf() {
  const k = cfg().supabaseAnonKey || "";
  return { "Content-Type": "application/json", apikey: k, Authorization: "Bearer " + k };
}

// ---- Einsatzort 1: Feedback auf die Selbsterklaerung ----
// Liefert { trifftKern, feedback } oder null (Fallback: nichts anzeigen).
export async function selbstFeedback(q, selbstText, gewaehlt, erg) {
  if (!aktiv() || !tagFrei() || !selbstText) return null;
  try {
    const steuerung = new AbortController();
    const wecker = setTimeout(() => steuerung.abort(), 14000);
    tagVerbrauch();
    const r = await fetch(url(), {
      method: "POST", headers: kopf(), signal: steuerung.signal,
      body: JSON.stringify({
        art: "feedback", frage: frageDaten(q), selbstText,
        gewaehlt: gewaehlt || [], punkte: erg?.punkte, max: q.maxPunkte,
        folien: await frageFolien(q),
      }),
    });
    clearTimeout(wecker);
    if (!r.ok) return null;
    const d = await r.json();
    return typeof d.feedback === "string" && d.feedback ? d : null;
  } catch {
    return null;
  }
}

// HTML-Box fuer das Feedback (Anker via beleg.js klickbar)
export const feedbackHtml = (fb, thema) => `<div class="llm-fb">
  <span class="llm-fb-kopf">${fb.trifftKern ? "✨ Deine Erklärung trifft den Kern" : "💡 Kurze Rückmeldung dazu"}</span>
  <div>${Beleg.render(fb.feedback, thema)}</div></div>`;

// ---- Einsatzort 2: Chat "Ueber diese Frage sprechen" ----
export const chatBtnHtml = (q) => aktiv() && q
  ? `<button type="button" class="llm-chat-btn" data-chat-qid="${esc(q.id)}">💬 Über diese Frage sprechen</button>` : "";

// Verlauf pro Frage, solange die Seite offen ist (bewusst nicht persistiert)
const verlaeufe = new Map();
let chatFrageFn = null; // von main.js gesetzt: qid -> Frage-Objekt
export function initChat(frageFn) { chatFrageFn = frageFn; }

function chatSheet(q) {
  const alt = document.querySelector(".chat-ov");
  if (alt) alt.remove();
  const ov = document.createElement("div");
  ov.className = "sheet-ov chat-ov";
  ov.innerHTML = `<div class="sheet chat-sheet" role="dialog" aria-label="Über diese Frage sprechen">
    <div class="sheet-grip"></div>
    <h3 style="margin-bottom:2px">💬 Über diese Frage sprechen</h3>
    <p class="muted" style="font-size:.8rem;margin:0 0 8px">Antworten kommen aus den Vorlesungsfolien — Folien-Nummern sind antippbar. Bei Widerspruch gewinnen die Folien.</p>
    <div class="chat-verlauf" id="chatVerlauf"></div>
    <div class="chat-eingabe">
      <textarea id="chatTxt" rows="1" placeholder="Deine Frage — z. B.: Warum ist b falsch?"></textarea>
      <button class="btn small" id="chatSenden">›</button>
    </div>
    <button class="linkish" data-sheet-close style="align-self:center">Schließen</button>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-sheet-close]")) ov.remove(); });

  const box = ov.querySelector("#chatVerlauf");
  const txt = ov.querySelector("#chatTxt");
  const senden = ov.querySelector("#chatSenden");
  const verlauf = verlaeufe.get(q.id) || [];
  verlaeufe.set(q.id, verlauf);

  const mal = () => {
    box.innerHTML = verlauf.map((m) => m.role === "user"
      ? `<div class="chat-msg du">${esc(m.content)}</div>`
      : `<div class="chat-msg ki">${Beleg.render(m.content, q.oberthema)}</div>`).join("")
      || `<p class="muted" style="font-size:.85rem">Frag alles zu dieser Frage — warum eine Option falsch ist, was ein Begriff bedeutet, wie man sich das merkt.</p>`;
    box.scrollTop = box.scrollHeight;
  };
  mal();

  let laeuft = false;
  const frageAb = async () => {
    const frage = txt.value.trim();
    if (!frage || laeuft) return;
    if (!tagFrei()) {
      verlauf.push({ role: "assistant", content: "Das Tages-Kontingent fuer die KI ist aufgebraucht — morgen geht es weiter. Die Erklaerungen unter den Antworten sind weiter fuer dich da." });
      mal(); return;
    }
    laeuft = true; txt.value = ""; senden.disabled = true;
    verlauf.push({ role: "user", content: frage });
    mal();
    box.insertAdjacentHTML("beforeend", `<div class="chat-msg ki" id="chatLive"><span class="chat-tipp">…</span></div>`);
    box.scrollTop = box.scrollHeight;
    let antwort = "";
    try {
      tagVerbrauch();
      const r = await fetch(url(), {
        method: "POST", headers: kopf(),
        body: JSON.stringify({
          art: "chat", frage: frageDaten(q), folien: await frageFolien(q),
          messages: verlauf.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!r.ok || !r.body) throw new Error("http " + r.status);
      // SSE lesen: text_delta-Stuecke einsammeln und live anzeigen
      const leser = r.body.getReader();
      const dec = new TextDecoder();
      let puffer = "";
      const live = () => {
        const el = document.getElementById("chatLive");
        if (el) { el.textContent = antwort; box.scrollTop = box.scrollHeight; }
      };
      for (;;) {
        const { done, value } = await leser.read();
        if (done) break;
        puffer += dec.decode(value, { stream: true });
        const zeilen = puffer.split("\n");
        puffer = zeilen.pop();
        for (const z of zeilen) {
          if (!z.startsWith("data:")) continue;
          try {
            const ev = JSON.parse(z.slice(5));
            if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") { antwort += ev.delta.text; live(); }
          } catch { /* keep-alive o.ae. */ }
        }
      }
    } catch {
      antwort = antwort || "Die KI ist gerade nicht erreichbar — die Erklaerungen unter den Antworten helfen dir trotzdem weiter.";
    }
    document.getElementById("chatLive")?.remove();
    verlauf.push({ role: "assistant", content: antwort || "(keine Antwort)" });
    mal();
    laeuft = false; senden.disabled = false;
  };
  senden.onclick = frageAb;
  txt.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); frageAb(); } };
  txt.focus();
}

// Delegierter Handler — Chat-Knoepfe funktionieren in jedem nachgerenderten HTML
document.addEventListener("click", (e) => {
  const b = e.target.closest(".llm-chat-btn[data-chat-qid]");
  if (!b || !chatFrageFn) return;
  e.preventDefault();
  const q = chatFrageFn(b.dataset.chatQid);
  if (q) chatSheet(q);
});
