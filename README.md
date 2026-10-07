# Phase 2 — Chat Gemini avec contexte

Diablo est un assistant de discussion ordinaire. Cette phase ajoute une mémoire résumée à l'interface de chat.

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

## Lancer le projet

Installe **Node.js 24**, puis ouvre un terminal :

```sh
git clone --branch phase-2 https://github.com/krym25/gemini-chat.git gemini-chat-phase-2
cd gemini-chat-phase-2
npm ci
```

Copie `.env.example` vers `.env` si ce fichier n'existe pas déjà.
Dans `.env`, renseigne `GEMINI_API_KEY` et laisse `GEMINI_MODEL=auto`.
Ne partage pas la clé et ne l'ajoute pas à Git.

```sh
npm start
```

Ouvre **http://127.0.0.1:3000**. Laisse le terminal ouvert pendant l'utilisation.
Après une modification de `.env`, arrête le serveur avec Ctrl+C et relance-le.

## Vérifier la mémoire

1. Envoie : « Je m'appelle Alex et je veux apprendre JavaScript. »
2. Envoie : « Quel est mon prénom et quel est mon objectif ? »
3. Vérifie que Diablo rappelle les deux informations.
4. Clique sur **Nouvelle discussion** : ces informations ne doivent plus être disponibles.

La [phase 3](https://github.com/krym25/gemini-chat/tree/phase-3) ajoutera un contexte enrichi.
