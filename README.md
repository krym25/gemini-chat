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

## Démarrer

Installe **Node.js 24**. Sous Windows, ouvre PowerShell :

```powershell
git clone --branch phase-3 https://github.com/krym25/gemini-chat.git nova-phase-3
cd nova-phase-3
npm ci
Copy-Item .env.example .env
```

Si `.env` existe déjà, conserve-le. Dans ton éditeur, renseigne `GEMINI_API_KEY` et laisse `GEMINI_MODEL=auto` pour choisir un modèle compatible dans le catalogue Google. `.env` est ignoré par Git : ne partage pas la clé et ne l’ajoute pas au code.

```powershell
npm start
```

Ouvre **http://127.0.0.1:3000** et laisse le terminal ouvert. Après une modification de `.env`, arrête avec Ctrl+C puis relance. Le délai d’attente est de **60 000 ms**, côté navigateur et serveur, et couvre aussi la lecture de la réponse. Après un échec, le brouillon et le contexte précédent restent disponibles pour réessayer.

## Vérifier

1. Envoie « Je m’appelle Alex », puis demande ton prénom.
2. Demande « Incarne Nova, roi démon dans un isekai » et poursuis la discussion.
3. Demande « Quitte le rôle et explique HTTP simplement ».
4. Clique sur **Nouvelle discussion** : l’ancienne mémoire doit disparaître.

```powershell
npm test
```

Les tests utilisent des réponses simulées de Google et ne nécessitent pas de clé. Ils ne valident pas l’accès réel à Gemini : il faut un échange réussi avec une clé autorisée et un quota disponible pour le vérifier.

## Les quatre branches

| Branche | Contenu |
| --- | --- |
| [main](https://github.com/krym25/gemini-chat/tree/main) | Version complète de Nova. |
| [phase-1](https://github.com/krym25/gemini-chat/tree/phase-1) | Chat simple, sans mémoire. |
| [phase-2](https://github.com/krym25/gemini-chat/tree/phase-2) | Chat avec contexte résumé. |
| [phase-3](https://github.com/krym25/gemini-chat/tree/phase-3) | Contexte résumé et personnalité sur demande. |
