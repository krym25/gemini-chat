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

## Prérequis sur Windows

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

## Utiliser Nova sur le même Wi-Fi

La clé Gemini reste uniquement dans le fichier `.env` du propriétaire. Chaque visiteur lance le site sur son ordinateur ; son serveur Node.js transmet les messages au PC du propriétaire.

Dans PowerShell, télécharge le projet et lance-le :

~~~powershell
git clone --branch phase-2 https://github.com/krym25/gemini-chat.git gemini-chat-phase-2
cd gemini-chat-phase-2
npm.cmd ci
npm.cmd start
~~~

Ouvre **http://localhost:3000** et laisse le terminal ouvert. Aucune clé ni aucun fichier `.env` n'est nécessaire pour les visiteurs.

Le fichier `nova.config.json` contient seulement `serverUrl`, l'adresse de ton PC : **http://192.168.1.18:3000**. Les visiteurs utilisent les commandes ci-dessus sans configuration supplémentaire. Si l'adresse change, mets à jour ce fichier et les visiteurs récupèrent la modification avec `git pull` avant de relancer.

Le PC du propriétaire doit rester allumé, connecté au même réseau Wi-Fi, avec son serveur en marche. Le partage fonctionne sur ce réseau local.

## Lancer le partage depuis le PC propriétaire

Conserve ta clé et `PORT=3000` dans ton fichier `.env` existant, ignoré par Git. Dans PowerShell, depuis le dossier du projet :

~~~powershell
git switch main
git pull
npm.cmd ci
npm.cmd run share
~~~

Si Windows demande une autorisation pour Node.js, autorise-le uniquement sur les **réseaux privés**. Laisse le terminal ouvert pendant les discussions. Tu peux aussi ouvrir **http://localhost:3000** sur ce PC.

L'adresse à mettre dans `serverUrl` est l'IPv4 de la connexion Wi-Fi du propriétaire, donnée par `ipconfig`, avec le protocole `http://` et le port `:3000`. Cette adresse n'est pas une clé et peut figurer dans le dépôt.

Pour arrêter le serveur, appuie sur Ctrl+C. Après une modification de `.env`, arrête et relance le partage. Arrête l'ancien serveur si le port 3000 est occupé.
Si tu as déjà le dossier, commence à `cd gemini-chat-phase-2` : inutile de refaire `git clone`.
`npm.cmd` permet d'utiliser npm dans PowerShell sans modifier sa politique d'exécution.

## Vérifier la mémoire

1. Envoie : « Je m'appelle Alex et je veux apprendre JavaScript. »
2. Envoie : « Quel est mon prénom et quel est mon objectif ? »
3. Vérifie que Nova rappelle les deux informations.
4. Clique sur **Nouvelle discussion** : ces informations ne doivent plus être disponibles.

La [phase 3](https://github.com/krym25/gemini-chat/tree/phase-3) ajoute un contexte enrichi.

## Tests automatiques

```bash
npm test
```

Les tests remplacent Google par des réponses simulées : aucune clé n’est nécessaire.
Le délai est de **60 000 ms** côté navigateur et serveur (`TIMEOUT_MS`).
Il couvre la requête et la lecture de sa réponse. Après une erreur, le brouillon et le contexte précédent sont conservés pour réessayer.
