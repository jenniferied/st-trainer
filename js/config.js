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
  // Kreaturen-Chat: frei tippen geht IMMER, dafuer gibt es keinen Schalter mehr.
  // Der frueherer mkChatFreitext stammt aus der Zeit vor dem Deploy des
  // art-Zweigs "maskottchen" und hat genau den Zustand erzeugt, ueber den
  // Jennifer sich am 12.08. geaergert hat: statt eines Eingabefelds stand da
  // "Tipp auf eine Frage." Faellt die Function aus, greift der stille Fallback
  // in mk-chat.js — Rose sieht nie einen Fehler, nur einen freundlichen Satz.
  // Tagesziel ist seit 18.07. dynamisch (tagesPlan() in core.js rechnet Minimum/
  // Tagespensum/Streckziel taeglich aus dem echten Restbedarf) — kein fester Wert mehr.
};
