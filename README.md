# Nova — Phase 3 : contexte enrichi

## Le concept

Cette phase reprend la mémoire résumée de la phase 2 et ajoute des consignes de personnalité côté serveur. À chaque question, Gemini reçoit le résumé précédent et le nouveau message, puis produit une réponse et un résumé mis à jour. Les messages affichés ne sont pas envoyés comme un historique complet.

Nova reste un assistant ordinaire tant qu’aucun rôle n’est demandé. « Incarne Nova, roi démon dans un isekai » demande la personnalité du personnage. « Quitte le rôle et réponds normalement » demande de revenir à une discussion habituelle. Le résumé conserve les faits utiles et le rôle demandé, dans une limite de 4 000 caractères ; il peut omettre des détails.

La mémoire reste dans la page : **Nouvelle discussion** ou un rechargement l’efface. Le serveur ne stocke pas les conversations. La clé Gemini reste côté serveur.

## Le code

- [public/index.html](public/index.html) : les éléments de l’interface.
- [public/style.css](public/style.css) : la présentation.
- [public/app.js](public/app.js) : les requêtes HTTP, le résumé et l’affichage avec `textContent`.
- [server.js](server.js) : validation, appel Gemini et consignes `demonInstructions`.

La requête habituelle à `POST /api/chat` contient `{ message, context }`. La réponse contient `{ reply, context, model }`. Les consignes passent dans `systemInstruction` ; le résumé est présenté comme des données.

L’interface utilise le mode automatique. L’API conserve aussi les modes explicites pour comparer les étapes : `phase: 1` envoie seulement la question, `phase: 2` ajoute le résumé et `phase: 3` impose la personnalité de roi démon.

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

## Vérifier

1. Envoie « Je m’appelle Alex », puis demande ton prénom.
2. Demande « Incarne Nova, roi démon dans un isekai » et poursuis la discussion.
3. Demande « Quitte le rôle et explique HTTP simplement ».
4. Clique sur **Nouvelle discussion** : l’ancienne mémoire doit disparaître.

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
| [phase-3](https://github.com/krym25/gemini-chat/tree/phase-3) | Contexte résumé et personnalité sur demande. |
