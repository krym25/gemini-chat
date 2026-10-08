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
git clone --branch phase-3 https://github.com/krym25/gemini-chat.git gemini-chat-phase-3
cd gemini-chat-phase-3
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
Si tu as déjà le dossier, commence à `cd gemini-chat-phase-3` : inutile de refaire `git clone`.
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
