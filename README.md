# Diablo — Phase 3 : contexte enrichi et personnalité

## Le concept

Cette phase conserve le contexte résumé de la phase 2 et ajoute des consignes de personnalité côté serveur. Le résumé rappelle les faits de la conversation ; les consignes définissent le ton et le personnage. Le message courant peut demander de commencer ou de quitter un rôle.

Diablo est un assistant ordinaire tant qu’aucun rôle n’est demandé. « Incarne Diablo, roi démon dans un isekai » active la personnalité du personnage. Le contexte conserve ensuite le rôle, les noms, les lieux et les décisions utiles.

```text
Question + résumé précédent + consignes de personnage → Gemini → réponse + nouveau résumé
```

Le résumé est une mémoire condensée limitée à 4 000 caractères ; il peut perdre des détails. Le serveur ne stocke pas les conversations. Le RAG ne fait pas partie de cette phase.

## Le code

- `public/index.html` et `public/style.css` : interface Diablo épurée.
- `public/app.js` : nouvelle question, résumé reçu et affichage des messages.
- `server.js` : validation, appel Gemini, `demonInstructions` et adaptation du rôle.

La requête habituelle reste `{ message, context }`. La réponse contient `{ reply, context, model }`. Les consignes de personnalité sont ajoutées dans `systemInstruction`, tandis que le résumé est transmis comme données. Les modes API `phase: 1`, `phase: 2` et `phase: 3` restent disponibles pour étudier les fonctions séparément ; l’interface utilise le mode automatique complet.

## Lancer cette branche

Avec Node.js 24 :

```bash
git clone --branch phase-3 https://github.com/krym25/gemini-chat.git
cd gemini-chat
npm ci
```

Crée un fichier local `.env` à partir de `.env.example`, sans écraser un fichier existant. Renseigne `GEMINI_API_KEY`, garde `GEMINI_MODEL=auto`, puis lance :

```bash
npm start
```

Sur ton ordinateur, ouvre `http://127.0.0.1:3000`. La clé reste dans `.env`, ignoré par Git, jamais dans le navigateur. Après une modification de `.env`, arrête le serveur avec Ctrl+C et redémarre-le.

Si tu as déjà le dépôt : `git fetch origin`, puis `git switch phase-3` ; conserve tes modifications locales avant de changer de branche.

## Vérifier

1. Demande « Incarne Diablo, roi démon dans un isekai. Je m’appelle Alex et j’arrive devant ton trône. »
2. Poursuis l’aventure, puis demande au personnage ton prénom : les éléments importants doivent venir du résumé.
3. Demande « Quitte le rôle et explique HTTP simplement » : l’assistant doit revenir à une réponse ordinaire.
4. Clique sur **Nouvelle discussion** : la mémoire de la page est effacée.

La fiabilité du rôle et du résumé se vérifie par de vrais échanges avec Gemini. La présence d’un champ `context` ne suffit pas à garantir sa qualité.

## Les branches du projet

- [phase-1 — Chat simple](https://github.com/krym25/gemini-chat/tree/phase-1)
- [phase-2 — Contexte résumé](https://github.com/krym25/gemini-chat/tree/phase-2)
- [phase-3 — Contexte enrichi et personnage](https://github.com/krym25/gemini-chat/tree/phase-3)
