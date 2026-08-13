# Eigene Bilder fuers Lehrerzimmer

Bilder hier ablegen, dann `python3 scripts/sync-fragen.py` (oder direkt
`./scripts/deploy.sh "..."`, das macht den Sync mit). Das Manifest
`app/data/story-bilder.json` entsteht von allein aus den Dateinamen.

    good/    zeigt die App, wenn Rose voll richtig lag
    part/    bei Teilpunkten
    sanft/   wenn es daneben ging  -> nie haemisch, immer troestend

Formate: .webp .png .jpg .jpeg .gif — quadratisch und klein halten
(die Sticker werden mit 34 px Kantenlaenge angezeigt, 256 px Quelle reicht).

Solange die Ordner leer sind, nimmt `js/story.js` die normalen
Reaktions-Sticker aus `assets/reactions/`. Der Modus funktioniert also
komplett ohne diese Bilder — sie sind Zugabe, keine Voraussetzung.

**Achtung:** `deploy.sh` schiebt `app/` in die oeffentliche Pages-Repo.
Was hier liegt, liegt danach unter jenniferied.github.io/st-trainer/.
