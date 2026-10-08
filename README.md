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
git clone --branch phase-1 https://github.com/krym25/gemini-chat.git gemini-chat-phase-1
cd gemini-chat-phase-1
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
Si tu as déjà le dossier, commence à `cd gemini-chat-phase-1` : inutile de refaire `git clone`.
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
