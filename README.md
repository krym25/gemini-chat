# Nova — Phase 3 : contexte enrichi

## Le concept

Cette phase reprend la mémoire résumée de la phase 2 et ajoute des consignes de personnalité côté serveur. À chaque question, Gemini reçoit le résumé précédent et le nouveau message, puis produit une réponse et un résumé mis à jour. Les messages affichés ne sont pas envoyés comme un historique complet.

Les trois bulles de l’accueil et le menu proposent **Chat simple**, **Conversation suivie** et **Roi démon**.
Choisis **Roi démon** pour discuter avec Varkhos, roi démon du royaume des Cendres.
Sa personnalité, son royaume et les consignes de jeu sont définis côté serveur.
Le résumé conserve les noms, lieux, décisions, pactes et la situation du joueur.
Il est limité à 4000 caractères et peut omettre des détails.

**Nouvelle discussion**, un changement de mode ou un rechargement efface la mémoire.
Le serveur ne stocke pas les conversations. La clé Gemini reste dans `.env`.

## Le code

- [public/index.html](public/index.html) : les éléments de l’interface.
- [public/style.css](public/style.css) : la présentation.
- [public/app.js](public/app.js) : les requêtes HTTP, le résumé et l’affichage avec `textContent`.
- [server.js](server.js) : validation, appel Gemini et consignes `demonInstructions`.

La requête à `POST /api/chat` contient `{ phase, message, context }`.
La réponse contient `{ reply, context, model }`.
Les consignes passent dans `systemInstruction` ; le résumé est présenté comme des données.

`phase: 1` envoie seulement la question. `phase: 2` ajoute le résumé.
`phase: 3` ajoute aussi la personnalité de Varkhos.

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
git clone --branch phase-3 https://github.com/krym25/gemini-chat.git gemini-chat-phase-3
cd gemini-chat-phase-3
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

## Démarrage par double-clic

Sur Windows, double-clique sur **demarrer.cmd** dans le dossier du projet.
Le lanceur installe les dépendances si nécessaire et ouvre le bon `.env` si la clé manque.
Renseigne la clé, enregistre le fichier et suis le message du terminal.
Le serveur lit toujours `.env` à côté de `server.js`, même s'il est lancé depuis un autre dossier.

## Vérifier

1. Choisis **Roi démon** et envoie « Je m'appelle Alex, invoqué devant ton trône ».
2. Demande « Quel est mon prénom et où suis-je ? ».
3. Change de mode pour retrouver Nova dans une discussion ordinaire.
4. Clique sur **Nouvelle discussion** : l'ancienne mémoire doit disparaître.

Le délai est de **60 000 ms** côté navigateur et serveur.
Après une erreur, le brouillon et le contexte précédent sont conservés pour réessayer.

```powershell
npm.cmd test
```

Les tests utilisent des réponses simulées de Google et ne nécessitent pas de clé. Ils ne valident pas l’accès réel à Gemini : il faut un échange réussi avec une clé autorisée et un quota disponible pour le vérifier.

## Les quatre branches

| Branche | Contenu |
| --- | --- |
| [main](https://github.com/krym25/gemini-chat/tree/main) | Version complète de Nova. |
| [phase-1](https://github.com/krym25/gemini-chat/tree/phase-1) | Chat simple, sans mémoire. |
| [phase-2](https://github.com/krym25/gemini-chat/tree/phase-2) | Chat avec contexte résumé. |
| [phase-3](https://github.com/krym25/gemini-chat/tree/phase-3) | Contexte résumé et personnage Varkhos. |
