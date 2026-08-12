// Supabase-Zugang. Der anon key ist als öffentlicher Client-Key konzipiert.
// Leer lassen = App läuft rein lokal (localStorage), Events werden gepuffert
// und nach Konfiguration nachsynchronisiert.
window.ST_CONFIG = {
  supabaseUrl: "https://fkhvtlhfejqollzyzyfi.supabase.co",
  supabaseAnonKey: "sb_publishable_K6Ju14HAjyYVGCECg9rS4Q_Z-F2S-eq",
  // Scoring: "streng" = +1 je richtigem, -0,5 je falschem Kreuz (offizieller Text)
  // "milde"  = Punktzahl - 0,5 je falschem Kreuz, wenn mind. 1 richtig (Roses Erinnerung)
  scoringVariante: "streng",
  // Lernstand-Sync: gleicher Code = gleicher Lernstand auf allen Geraeten.
  // Voreingestellt, damit niemand etwas eintippen muss; in den Einstellungen aenderbar.
  // Schutz gegen Test-Verschmutzung: Auf localhost/127.0.0.1 (= Entwicklung) NICHT
  // mit Roses "rose"-Stand syncen. Nur die Live-Seite (github.io) synct echt.
  syncCode: (location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.hostname === "") ? "" : "rose",
  klausur: { fragen: 42, minutenNormal: 90, minutenNTA: 120, bestehen: 42 },
  // Klausurtag + Tagesziel fuer die Zonen-Bar auf der Startseite.
  // Am Vortag faehrt die App das Ziel automatisch runter (locker wiederholen statt pauken).
  // 18.09.2026 von Rose BESTAETIGT (21.07.). GE-Klausur: 10.09.2026.
  klausurTag: "2026-09-18",
  // Kreaturen-Chat, Stufe 2: freier Text ueber die Edge Function.
  // ACHTUNG, Stand 12.08. abends: der Zweig art "maskottchen" ist in
  // supabase/functions/llm/index.ts NOCH GAR NICHT GESCHRIEBEN — dort steht
  // weiterhin nur `body.art === "chat" ? "chat" : "feedback"`. Stufe 2 heisst
  // hier also "noch schreiben, DANN deployen", nicht "nur noch deployen".
  // Der GE-Trainer hat den Zweig seit dem 12.08. (llm-ge/index.ts), er kann
  // als Vorlage dienen (SYSTEM_MASKOTTCHEN, SCHEMA_MASKOTTCHEN, standBlock).
  // Bis dahin AUS (Login und Anthropic-Key liegen bei Jennifer). Solange baut
  // das Sheet gar kein Eingabefeld — Rose sieht nur die Schnellantworten und
  // nichts, was auf ein fehlendes Feature hindeutet.
  // Ein Schalter und kein Ausprobieren, weil die derzeit deployte Function ein
  // unbekanntes art still in den Feedback-Zweig routet und dann Muell liefert
  // statt eines sauberen Fehlers.
  mkChatFreitext: true,
  // Tagesziel ist seit 18.07. dynamisch (tagesPlan() in core.js rechnet Minimum/
  // Tagespensum/Streckziel taeglich aus dem echten Restbedarf) — kein fester Wert mehr.
};
