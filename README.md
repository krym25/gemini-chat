# Chat Gemini — Nova

HTML, CSS et JavaScript simple. Un serveur Node.js, une dépendance : Express.

## Une branche par phase

Le projet contient quatre branches : `main` pour la version complète et une branche pour chacune des trois phases.

| Branche | Contenu |
| --- | --- |
| [main](https://github.com/krym25/gemini-chat/tree/main) | Version complète : chat, contexte et personnalité de Nova. |
| [phase-1](https://github.com/krym25/gemini-chat/tree/phase-1) | Chat simple : seule la nouvelle question est envoyée. |
| [phase-2](https://github.com/krym25/gemini-chat/tree/phase-2) | Chat avec mémoire : un contexte résumé accompagne chaque question. |
| [phase-3](https://github.com/krym25/gemini-chat/tree/phase-3) | Contexte enrichi : le rôle et la personnalité de Nova complètent la mémoire. |

Pour explorer une phase depuis un dépôt existant : `git fetch origin`, puis `git switch phase-1` (ou `phase-2`, `phase-3`, `main`). Conserve tes modifications locales avant de changer de branche.

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
git clone https://github.com/krym25/gemini-chat.git
cd gemini-chat
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
Si tu as déjà le dossier, commence à `cd gemini-chat` : inutile de refaire `git clone`.
`npm.cmd` permet d'utiliser npm dans PowerShell sans modifier sa politique d'exécution.

## Les trois étapes du projet

L'interface réunit les trois étapes dans une seule discussion, sans sélection de mode.
Le contexte résumé est actif automatiquement. Le rôle s'adapte à ce que tu demandes dans ton message.

| Phase | Fonctionnement | À essayer |
| --- | --- | --- |
| 1 | Envoyer une question et afficher la réponse. | Demander une explication. |
| 2 | Gemini crée un contexte résumé, puis le met à jour après chaque échange. | « Je m'appelle Alex, j'apprends le JS », puis plusieurs questions, puis « Quel est mon prénom et qu'est-ce que j'apprends ? ». |
| 3 | La personnalité s'adapte à ta demande, avec Nova comme roi démon pour ton aventure isekai. | « Incarne Nova, un roi démon dans un isekai. Je suis Alex, invoqué depuis la Terre ». |

À chaque message, **seuls le contexte résumé et la nouvelle question sont envoyés**.
Les messages visibles à l'écran ne constituent pas l'historique envoyé à l'API.
Le résumé est limité à 4000 caractères : c'est une mémoire condensée, qui peut omettre des détails.
L'interface affiche uniquement la conversation ; le contexte résumé reste dans la mémoire de la page.
Une seule génération Gemini produit la réponse et le nouveau résumé.

Demande par exemple « Incarne un roi démon dans un isekai » pour commencer une aventure.
« Quitte le rôle et réponds normalement » permet de revenir à une discussion habituelle, sans effacer le contexte.
Cliquer sur Nouvelle discussion ou recharger la page efface la mémoire.
Le serveur reste **stateless** : il ne stocke aucune conversation.

Pour étudier les étapes séparément, l'API accepte encore `phase: 1`, `phase: 2` ou `phase: 3`.
La phase 1 reste sans mémoire. Sans ce champ, l'API utilise la conversation automatique du site.

## Les fichiers à comprendre

- **public/index.html** : les éléments de la page.
- **public/style.css** : la présentation.
- **public/app.js** : les boutons, le contexte et l'appel au serveur.
- **server.js** : le relais vers le propriétaire, l'appel à Gemini et la personnalité de Nova.
- **nova.config.json** : l'adresse réseau du serveur du propriétaire, sans clé.

La personnalité de Nova se modifie dans `demonInstructions` dans server.js.

## Clé et erreurs

La clé reste dans `.env` sur le PC propriétaire, ignoré par Git. Ne distribue pas ce fichier. Une clé précédemment partagée doit être remplacée dans AI Studio.
L'interface affiche des erreurs formulées pour l'utilisateur et ne montre pas les détails techniques de Google.
Sur le PC propriétaire, l'API garde un détail Google masqué pour le diagnostic. Les visiteurs reçoivent un message générique.
HTTP Google 401/403 indique un refus d'accès ; HTTP Google 429 une limite ou un quota.
Le modèle automatique est choisi dans le catalogue Google ; son quota dépend du projet du propriétaire.
Un premier message vérifie l'appel réel avec la clé du propriétaire.

Le projet se lance sur ton ordinateur après téléchargement depuis GitHub.
GitHub Pages ne lance pas le serveur Node.js nécessaire à cette API.

## Tests automatiques

```bash
npm test
```

Les tests remplacent Google par des réponses simulées : aucune clé n’est nécessaire.
Le délai est de **60 000 ms** côté navigateur et serveur (`TIMEOUT_MS`).
Il couvre la requête et la lecture de sa réponse. Après une erreur, le brouillon et le contexte précédent sont conservés pour réessayer.
