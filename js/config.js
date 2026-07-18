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
  // Endspurt: Klausurtag (Freitag morgens) + Tagesziel fuer die Zonen-Bar auf der Startseite.
  // Am Vortag faehrt die App das Ziel automatisch runter (locker wiederholen statt pauken).
  klausurTag: "2026-07-24",
  tagesziel: 200, // hochgesetzt 18.07. — Rose zieht locker durch ("she got this")
};
