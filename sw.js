// sw.js
// Dieser Service Worker ist absichtlich minimal gehalten.
// Seine Hauptaufgabe hier ist, die Kriterien für eine installierbare PWA zu erfüllen,
// damit die "Zum Home-Bildschirm hinzufügen"-Funktion erscheint.

self.addEventListener('fetch', (event) => {
  // Wir greifen nicht in die Netzwerkanfragen ein,
  // lassen also alles wie gewohnt durch.
});
