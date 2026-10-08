# Chat Gemini — Nova

HTML, CSS et JavaScript simple. Un serveur Node.js, une dépendance : Express.

## Une branche par phase

Le projet contient quatre branches : `main` pour la version complète et une branche pour chacune des trois phases.

| Branche | Contenu |
| --- | --- |
| [main](https://github.com/krym25/gemini-chat/tree/main) | Version complète : les trois modes de Nova et Varkhos. |
| [phase-1](https://github.com/krym25/gemini-chat/tree/phase-1) | Chat simple : seule la nouvelle question est envoyée. |
| [phase-2](https://github.com/krym25/gemini-chat/tree/phase-2) | Chat avec mémoire : un contexte résumé accompagne chaque question. |
| [phase-3](https://github.com/krym25/gemini-chat/tree/phase-3) | Contexte enrichi : le rôle et la personnalité de Varkhos complètent la mémoire. |

Pour explorer une phase depuis un dépôt existant : `git fetch origin`, puis `git switch phase-1` (ou `phase-2`, `phase-3`, `main`). Conserve tes modifications locales avant de changer de branche.

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
git clone https://github.com/krym25/gemini-chat.git
cd gemini-chat
npm.cmd ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
~~~

Dans le Bloc-notes, mets ta clé après **GEMINI_API_KEY=**, puis enregistre et ferme le fichier.
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

## Démarrage depuis le ZIP

Extrais le ZIP, puis ouvre PowerShell dans le dossier `nova` :

~~~powershell
npm.cmd ci
notepad .env
npm.cmd start
~~~

Renseigne ta clé dans `.env` avant de lancer `npm.cmd start`, puis ouvre **http://127.0.0.1:3000**.

## Les trois étapes du projet

Choisis un mode dans le menu de Nova :

| Phase | Mode | Fonctionnement |
| --- | --- | --- |
| 1 | Chat simple | Une question et une réponse, sans mémoire. |
| 2 | Conversation suivie | Gemini conserve les faits utiles dans un contexte résumé. |
| 3 | Roi démon | Varkhos, roi démon du royaume des Cendres, poursuit ton aventure grâce au contexte. |

Pour vérifier la mémoire, choisis **Conversation suivie**, donne ton prénom, puis demande-le à Nova.
Pour retrouver le personnage, choisis **Roi démon**, puis écris « Je suis Alex, invoqué devant ton trône ».

En phases 2 et 3, seuls le contexte résumé et la nouvelle question sont envoyés à Gemini.
Une seule génération produit la réponse et le résumé suivant, limité à 4000 caractères.
Le résumé peut omettre des détails. Il reste dans la mémoire de la page.
**Nouvelle discussion**, un changement de mode ou un rechargement efface la conversation et son contexte.
Le serveur ne stocke aucune conversation.

L'API reçoit `{ phase, message, context }` et renvoie `{ reply, context, model }`.
En phase 1, le contexte renvoyé est vide. En phases 2 et 3, il contient le nouveau résumé.

## Les fichiers à comprendre

- **public/index.html** : les éléments de la page.
- **public/style.css** : la présentation.
- **public/app.js** : les boutons, le contexte et l'appel au serveur.
- **server.js** : la clé privée, l'appel à Gemini et la personnalité de Varkhos.

La personnalité de Varkhos se modifie dans `demonInstructions` dans server.js.

## Clé et erreurs

La clé reste dans .env, ignoré par Git. Une clé précédemment partagée doit être remplacée dans AI Studio.
L'interface affiche des erreurs formulées pour l'utilisateur et ne montre pas les détails techniques de Google.
La réponse de l'API garde un détail masqué pour le diagnostic dans les outils réseau du navigateur.
HTTP Google 401/403 indique un refus d'accès ; HTTP Google 429 une limite ou un quota.
Le modèle automatique est choisi dans le catalogue Google ; son quota dépend de ton projet.
Un premier message vérifie l'appel réel avec ta clé.

Le projet se lance sur ton ordinateur après téléchargement depuis GitHub.
GitHub Pages ne lance pas le serveur Node.js nécessaire à cette API.

## Tests automatiques

```bash
npm test
```

Les tests remplacent Google par des réponses simulées : aucune clé n’est nécessaire.
Le délai est de **60 000 ms** côté navigateur et serveur (`TIMEOUT_MS`).
Il couvre la requête et la lecture de sa réponse. Après une erreur, le brouillon et le contexte précédent sont conservés pour réessayer.
