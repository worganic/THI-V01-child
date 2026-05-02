❯ comment on lance les tests ?

● 1. Récupérer ton token — ouvre la console du navigateur sur http://localhost:4200 et tape :
  localStorage.getItem('frankenstein_token')
  Copie le résultat.

  2. Lancer le script (depuis la racine du projet) :

  # PowerShell
  $env:WORG_TOKEN="colle-ton-token-ici"
  node tests/test-zone-projet.js

  Ou en une ligne :
  $env:WORG_TOKEN="<token>"; node tests/test-zone-projet.js

  Le serveur server-data.js doit être démarré (port 3001). Le script crée un projet temporaire __test-zone-projet__,
  exécute tous les tests, puis le supprime automatiquement.