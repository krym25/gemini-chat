# Phase 2 — Chat Gemini avec contexte

Nova est un assistant de discussion ordinaire. Cette phase ajoute une mémoire résumée à l'interface de chat.

## Comprendre le contexte

Une requête HTTP est indépendante des précédentes : Gemini ne retrouve pas automatiquement les échanges passés.
Le navigateur envoie donc le nouveau message avec le résumé conservé après la réponse précédente.
Gemini produit une réponse et met ce résumé à jour en gardant les faits utiles, les objectifs et les décisions.

Le trajet est simple : **navigateur → serveur Node.js → API Gemini → serveur → navigateur**.
La clé API reste côté serveur dans `.env`.

Le navigateur appelle `POST /api/chat` avec :

```json
{ "message": "Quel est mon prénom ?", "context": "L'utilisateur s'appelle Alex." }
```

Le serveur renvoie :

```json
{ "reply": "Tu t'appelles Alex.", "context": "L'utilisateur s'appelle Alex.", "model": "nom-du-modele" }
```

Au premier message, `context` vaut `""`. Après chaque réponse, le navigateur remplace son contexte par celui reçu.
Seuls le résumé et le nouveau message sont envoyés : la liste complète des messages affichés n'est pas transmise.
Le résumé est limité à **4000 caractères** et peut omettre des détails.
Le serveur est **stateless** : il ne stocke aucune conversation.
**Nouvelle discussion** ou le rechargement de la page efface la mémoire.

## Les fichiers de code

- `public/index.html` : les éléments du chat.
- `public/style.css` : la présentation.
- `public/app.js` : les messages affichés, le contexte en mémoire et les requêtes HTTP.
- `server.js` : la validation des requêtes, l'appel à Gemini et les consignes du résumé.

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
git clone --branch phase-2 https://github.com/krym25/gemini-chat.git gemini-chat-phase-2
cd gemini-chat-phase-2
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

## Vérifier la mémoire

1. Envoie : « Je m'appelle Alex et je veux apprendre JavaScript. »
2. Envoie : « Quel est mon prénom et quel est mon objectif ? »
3. Vérifie que Nova rappelle les deux informations.
4. Clique sur **Nouvelle discussion** : ces informations ne doivent plus être disponibles.

La [phase 3](https://github.com/krym25/gemini-chat/tree/phase-3) ajoute un contexte enrichi.

## Démarrage par double-clic

Sur Windows, double-clique sur **demarrer.cmd** dans le dossier du projet.
Le lanceur installe les dépendances si nécessaire et ouvre le bon `.env` si la clé manque.
Renseigne la clé, enregistre le fichier et suis le message du terminal.
Le serveur lit toujours `.env` à côté de `server.js`, même s'il est lancé depuis un autre dossier.

## Tests automatiques

```bash
npm test
```

Les tests remplacent Google par des réponses simulées : aucune clé n’est nécessaire.
Le délai est de **60 000 ms** côté navigateur et serveur (`TIMEOUT_MS`).
Il couvre la requête et la lecture de sa réponse. Après une erreur, le brouillon et le contexte précédent sont conservés pour réessayer.
