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
  syncCode: "rose",
  klausur: { fragen: 42, minutenNormal: 90, minutenNTA: 120, bestehen: 42 },
};
