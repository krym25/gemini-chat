# Nova — Chat Gemini avec RAG vectoriel

Une application locale en HTML, CSS et JavaScript, avec un serveur Node.js. Nova propose quatre modes : chat simple, conversation suivie, jeu avec Varkhos et questions sur tes documents.

Le **RAG** recherche des passages dans tes fichiers avant de les transmettre à Gemini pour rédiger sa réponse. Les passages et leurs vecteurs sont sauvegardés sur ton ordinateur ; il n'est pas nécessaire d'entraîner un modèle.

## Installation rapide sur Windows avec le ZIP

1. Installe [Node.js LTS](https://nodejs.org/) si nécessaire. La version minimale est **22.12**. Git n'est pas nécessaire pour le ZIP.
2. [Télécharge nova-complet.zip](https://github.com/krym25/gemini-chat/raw/refs/heads/main/downloads/nova-complet.zip).
3. Extrais **tout le ZIP**, puis ouvre le dossier `nova`. Ne lance pas les fichiers depuis l'archive.
4. Double-clique sur **`demarrer.cmd`**. Il vérifie les fichiers et Node.js, installe les dépendances si nécessaire et prépare `.env`.
5. Si un éditeur s'ouvre, renseigne ta clé après `GEMINI_API_KEY=`, enregistre et ferme le fichier ou son onglet. Le lanceur utilise VS Code si la commande `code` est disponible, sinon le Bloc-notes. Reviens dans la fenêtre de démarrage et suis ses indications. Tu peux aussi ouvrir `.env` toi-même dans VS Code.
6. Attends **« Site prêt »**, puis ouvre **http://127.0.0.1:3000/**. Garde la fenêtre du serveur ouverte.

Tu peux copier ton ancien `.env` dans ce nouveau dossier `nova` pour conserver ta clé. Internet est nécessaire pour installer les dépendances et appeler Google.

### Activer les questions sur les documents

1. Dans le même dossier `nova`, double-clique sur **`indexer.cmd`**. Le serveur peut rester ouvert dans son autre fenêtre.
2. Attends le message confirmant la sauvegarde de l'index.
3. Dans le site, choisis **Documents · RAG** et demande : **« Qui vend les potions de soin ? »**

Avec le document d'exemple, Nova devrait répondre **Mira** et afficher une référence à `royaume.txt` sous **« Extraits retrouvés »**.

Le ZIP ne contient pas d'index préconstruit : tu le crées avec ta clé. Les trois autres modes fonctionnent sans index.

## Installation depuis Git ou le terminal de VS Code

Ouvre PowerShell ou le terminal intégré de VS Code. Pour installer les outils manquants :

```powershell
winget install --id OpenJS.NodeJS.LTS --exact --source winget
winget install --id Git.Git --exact --source winget
```

Ferme et rouvre le terminal après l'installation. Vérifie :

```powershell
node --version
npm.cmd --version
git --version
```

Télécharge le projet sur la branche `main`, puis installe ses dépendances :

```powershell
cd $HOME
git clone https://github.com/krym25/gemini-chat.git
cd gemini-chat
npm.cmd ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Si tu as déjà téléchargé le ZIP, ouvre son dossier `nova` dans VS Code et commence par `npm.cmd ci` ; inutile de cloner une deuxième copie.

Dans VS Code, ouvre `.env` et renseigne :

```dotenv
GEMINI_API_KEY=ta_cle_google
GEMINI_MODEL=auto
PORT=3000
```

Crée ta clé dans [Google AI Studio](https://aistudio.google.com/apikey). Écris-la uniquement dans `.env`, jamais dans `public/` ou dans un commit. Laisse `GEMINI_MODEL=auto` pour que le serveur choisisse un modèle de génération disponible pour ta clé.

Enregistre `.env`, puis crée l'index et démarre le site :

```powershell
npm.cmd run index
npm.cmd start
```

Ouvre **http://127.0.0.1:3000/** après « Site prêt ». **Ctrl+C** arrête le serveur. Après une modification de `.env`, arrête-le et relance-le.

`npm.cmd` fonctionne dans PowerShell sans modifier sa politique d'exécution. Sur macOS ou Linux, utilise `npm` à la place.

## Les quatre modes

| Phase | Mode | Fonctionnement |
| --- | --- | --- |
| 1 | Chat simple | Seul le nouveau message est envoyé, sans mémoire des échanges précédents. |
| 2 | Conversation suivie | Le nouveau message et un résumé de la conversation sont envoyés à Gemini. |
| 3 | Roi démon | Varkhos poursuit une aventure fictive en s'appuyant sur le résumé. |
| 4 | Documents · RAG | Le serveur recherche des passages dans l'index et Gemini répond à partir de ces passages, avec des références. |

En phases 2, 3 et 4, la réponse contient aussi un résumé mis à jour, conservé dans la mémoire de la page. Il peut omettre des détails. **Nouvelle discussion**, un changement de mode ou un rechargement efface les échanges affichés et leur résumé. Le serveur ne sauvegarde pas les conversations.

L'index documentaire est indépendant de cette mémoire : il reste disponible après un redémarrage.

## Ajouter ou modifier tes documents

Place tes fichiers **`.txt` ou `.md` encodés en UTF-8** dans `documents/`. Le fichier `documents/royaume.txt` sert d'exemple. Cette version accepte jusqu'à **10 documents de 50 000 caractères chacun**, placés directement dans ce dossier. Elle n'importe pas les PDF et ne propose pas de téléversement depuis la page.

Après chaque ajout, modification ou suppression, reconstruis l'index avec **`indexer.cmd`**, ou depuis le dossier du projet :

```powershell
npm.cmd run index
```

Le nouvel index remplace le précédent. Ne le reconstruis pas à chaque question. Tu peux garder le serveur ouvert : les recherches suivantes utiliseront l'index sauvegardé.

Pour vérifier le résultat, pose une question dont la réponse figure dans ton document. Pose aussi une question sur une information absente, par exemple **« Quel est le prénom de la mère de Mira ? »** : Nova doit indiquer que les documents ne donnent pas la réponse.

Les **« Extraits retrouvés »** montrent les passages sélectionnés par la recherche ; leur présence ne garantit pas que chaque passage contient la réponse. Vérifie les références pour les réponses importantes.

### Comment fonctionne la recherche

- `indexer.js` découpe les documents en extraits de **1 000 caractères**, avec un chevauchement de **150 caractères**.
- Le SDK `@google/genai` appelle **`gemini-embedding-001`** avec `RETRIEVAL_DOCUMENT` pour produire des vecteurs de **768 dimensions**, puis les normalise.
- Le texte, sa provenance et son vecteur sont sauvegardés dans **`data/rag-index.json`**.
- `rag.js` vectorise chaque question avec le même modèle et la même dimension, mais avec `RETRIEVAL_QUERY`.
- La similarité cosinus classe les passages. La recherche conserve au maximum **3 extraits** avec un score d'au moins **0,5**.
- Le serveur transmet les extraits à Gemini avec la question et le résumé. Les instructions demandent de citer les sources et de signaler les informations absentes. Si aucun passage ne franchit le seuil, le serveur renvoie un message sans appeler la génération.

Le score mesure une proximité de sens ; ce n'est pas une probabilité que la réponse soit correcte. Le seuil de `0,5` est un réglage initial dans `rag.js`, à ajuster selon les documents. Si tu changes le modèle ou la dimension, adapte l'indexation et la recherche ensemble, puis reconstruis l'index.

## Données, clé et quota Google

L'index est un fichier local, hors de `public/`, et n'est pas inclus dans le ZIP ni suivi par Git. **`.env` et `data/` sont ignorés par Git**. Tes documents dans `documents/` peuvent être suivis par Git : n'y publie pas de fichiers confidentiels.

L'indexation envoie le texte des extraits à Google pour créer les embeddings. Chaque question en mode RAG envoie aussi la question à Google pour créer son vecteur ; si des passages sont retrouvés, leur texte, la question et le résumé sont envoyés au modèle de génération.

Ces appels consomment le quota de ton projet et peuvent être facturés selon ton offre. Consulte les conditions et la tarification de Google avant d'utiliser des documents sensibles ou un grand volume de texte.

La clé reste côté serveur et les messages d'erreur la masquent. Si elle a été exposée, remplace-la dans AI Studio, modifie `.env` et redémarre le serveur.

## Mettre à jour une copie Git

Arrête le serveur avec **Ctrl+C** et conserve tes éventuelles modifications locales avant de mettre à jour. Dans le dossier du dépôt :

```powershell
git fetch origin
git switch main
git pull --ff-only
npm.cmd ci
npm.cmd run index
npm.cmd start
```

Le `.env` et l'index local restent dans ton dossier, puisqu'ils ne sont pas suivis par Git. La reconstruction actualise l'index avec les documents présents. Si Git signale un conflit ou refuse une commande, traite ce message avant de poursuivre ; ne supprime pas tes fichiers pour forcer la mise à jour.

## Résoudre les erreurs courantes

| Message ou problème | Action |
| --- | --- |
| `ERR_CONNECTION_REFUSED` | Démarre le serveur et attends « Site prêt ». Ouvre exactement `http://127.0.0.1:3000/` et garde le terminal ouvert. |
| `Cannot GET /` | Vérifie que tu démarres le bon projet et que `public/index.html` existe. Avec le ZIP, extrais toute l'archive. |
| Port occupé / `EADDRINUSE` | Arrête l'ancien serveur avec Ctrl+C. Tu peux aussi changer `PORT` dans `.env`, puis utiliser cette valeur dans l'adresse du navigateur. |
| Index absent / `rag-index.json` introuvable | Lance `indexer.cmd` ou `npm.cmd run index`, puis réessaie le mode Documents · RAG. |
| `Cannot find package '@google/genai'` | Depuis le dossier du projet, lance `npm.cmd ci`, puis relance l'indexation ou le serveur. |
| Clé absente ou refusée, HTTP Google 401/403 | Vérifie `GEMINI_API_KEY` et les restrictions de la clé dans AI Studio. Redémarre après modification de `.env`. |
| HTTP Google 429 | Vérifie ton quota et les limites de ton projet Google. Attends ou adapte ton offre avant de réessayer. |
| Modèle de génération introuvable, HTTP Google 404 | Remets `GEMINI_MODEL=auto`, puis redémarre. Ce réglage ne change pas le modèle d'embeddings. |
| Aucun passage pertinent | Vérifie le texte du document, reconstruis l'index et essaie une question plus précise. |
| Bouton Documents · RAG absent | Recharge avec **Ctrl+F5** et vérifie que `public/index.html` et `public/app.js` viennent de la même version du projet. |
| `SyntaxError` après une modification | Lance `node --check server.js` et `node --check public/app.js`, puis corrige le fichier et la ligne indiqués. |

GitHub héberge le code et le ZIP. Le site se lance sur ton ordinateur : **GitHub Pages ne lance pas ce serveur Node.js**.

## Fichiers et vérification

| Fichier | Rôle |
| --- | --- |
| `public/index.html`, `public/style.css`, `public/app.js` | Interface, choix du mode et affichage des références. |
| `server.js` | Serveur, appels Gemini et phase 4 RAG. |
| `server-avant-rag.js` | Version du serveur avec les trois modes avant le RAG, conservée comme référence. |
| `indexer.js` | Création et sauvegarde de l'index documentaire. |
| `rag.js` | Recherche vectorielle pour une question. |
| `documents/royaume.txt` | Document d'exemple à remplacer ou compléter. |
| `demarrer.cmd` | Installation et démarrage sur Windows. |
| `indexer.cmd` | Construction de l'index sur Windows. |

Pour lancer les tests :

```powershell
npm.cmd test
```

Les tests remplacent Google par des réponses simulées : aucune clé ni appel payant n'est nécessaire. Une indexation et une question depuis le site vérifient ensuite les appels réels avec ta clé.

Pour reprendre les vérifications du tutoriel, après installation et configuration de `.env` :

```powershell
node --env-file=.env test-embedding.js
node --env-file=.env test-recherche.js "Qui vend les potions de soin ?"
```

Ces deux scripts appellent réellement Google. Le premier doit afficher **768 dimensions** ; le second affiche les passages retrouvés avec leurs scores. Il faut avoir créé l'index avant le second.

Documentation officielle : [embeddings Gemini](https://ai.google.dev/gemini-api/docs/embeddings?hl=fr) et [SDK JavaScript](https://ai.google.dev/gemini-api/docs/libraries?hl=fr).
