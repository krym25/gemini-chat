# Phase 1 — Chat simple avec Gemini

## Le concept

Le navigateur envoie une question au serveur Node.js avec `POST /api/chat`. Le serveur utilise la clé privée pour appeler Gemini et renvoie le texte à afficher. L'interface est en HTML, CSS et JavaScript ; Express est la seule dépendance du serveur.

Chaque question est indépendante : aucun échange précédent n'est envoyé. Les messages restent affichés dans la page, mais ne constituent pas une mémoire du modèle. Nova est ici un assistant ordinaire.

## Le code

- [public/index.html](public/index.html) : les éléments de l'interface.
- [public/style.css](public/style.css) : la présentation.
- [public/app.js](public/app.js) : le formulaire, l'appel HTTP et l'affichage avec `textContent`.
- [server.js](server.js) : validation, appel Gemini et erreurs HTTP.

La requête contient seulement la question :

```json
{ "message": "Explique HTTP en deux phrases." }
```

Une réponse réussie contient `reply` et `model`. Le navigateur vérifie le statut HTTP avant d'afficher la réponse. En cas d'erreur, il restaure le texte saisi pour permettre un nouvel essai.

## Démarrage sur Windows

Si Git ou Node.js ne sont pas installés, ouvre PowerShell et exécute :

~~~powershell
winget install --id Git.Git --exact --source winget
winget install --id OpenJS.NodeJS.LTS --exact --source winget
~~~

npm est installé avec Node.js. Ferme puis rouvre PowerShell et vérifie les installations :

~~~powershell
git --version
node --version
npm.cmd --version
~~~

Télécharge ensuite le projet et installe ses dépendances :

~~~powershell
cd $HOME
git clone --branch phase-1 https://github.com/krym25/gemini-chat.git gemini-chat-phase-1
cd gemini-chat-phase-1
npm.cmd ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
~~~

Dans le Bloc-notes, mets ta nouvelle clé après **GEMINI_API_KEY=**, puis enregistre et ferme le fichier.
Laisse GEMINI_MODEL=auto. Écris la clé dans ce fichier, pas dans PowerShell.

Reviens dans le terminal du dossier du projet :

~~~powershell
npm.cmd start
~~~

Attends « Site prêt », puis ouvre **http://127.0.0.1:3000** et envoie un premier message.
Laisse le terminal ouvert. Après une modification de .env, arrête avec Ctrl+C et relance.
Arrête l'ancien serveur si le port 3000 est occupé.
Si tu as déjà le dossier, passe directement à `cd` : inutile de refaire `git clone`.
`npm.cmd` permet d'utiliser npm dans PowerShell sans modifier sa politique d'exécution.

## Vérifier la phase 1

1. Envoie « Je m'appelle Alex », puis « Quel est mon prénom ? ».
2. Dans l'onglet Réseau du navigateur, vérifie que chaque requête contient uniquement son propre `message`. La première question n'est pas transmise avec la seconde.
3. Essaie une saisie vide puis une erreur de connexion : l'interface doit rester utilisable et permettre de réessayer.

## Les branches GitHub

- [main](https://github.com/krym25/gemini-chat/tree/main) : version complète.
- [phase-1](https://github.com/krym25/gemini-chat/tree/phase-1) : une question, une réponse.
- [phase-2](https://github.com/krym25/gemini-chat/tree/phase-2) : ajout de la mémoire de conversation.
- [phase-3](https://github.com/krym25/gemini-chat/tree/phase-3) : contexte et personnalité enrichis.

Le RAG n’est pas intégré à ces trois phases.

## Tests automatiques

```bash
npm test
```

Les tests remplacent Google par des réponses simulées : aucune clé n’est nécessaire.
Le délai est de **60 000 ms** côté navigateur et serveur (`TIMEOUT_MS`).
Il couvre la requête et la lecture de sa réponse. Après une erreur, le brouillon est conservé pour réessayer.
