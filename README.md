# Phase 1 — Chat simple avec Gemini

## Le concept

Le navigateur envoie une question au serveur Node.js avec `POST /api/chat`. Le serveur utilise la clé privée pour appeler Gemini et renvoie le texte à afficher. L'interface est en HTML, CSS et JavaScript ; Express est la seule dépendance du serveur.

Chaque question est indépendante : aucun échange précédent n'est envoyé. Les messages restent affichés dans la page, mais ne constituent pas une mémoire du modèle. Diablo est ici un assistant ordinaire.

## Le code fourni

- [public/index.html](public/index.html) : les éléments de l'interface.
- [public/style.css](public/style.css) : la présentation.
- [public/app.js](public/app.js) : le formulaire, l'appel HTTP et l'affichage avec `textContent`.
- [server.js](server.js) : validation, appel Gemini et erreurs HTTP.

La requête contient seulement la question :

```json
{ "message": "Explique HTTP en deux phrases." }
```

Une réponse réussie contient `reply` et `model`. Le navigateur vérifie le statut HTTP avant d'afficher la réponse. En cas d'erreur, il restaure le texte saisi pour permettre un nouvel essai.

## Démarrer sur ton ordinateur

Installe Node.js 24. Pour une installation neuve sous Windows, ouvre PowerShell :

```powershell
git clone --branch phase-1 https://github.com/krym25/gemini-chat.git gemini-chat-phase-1
cd gemini-chat-phase-1
npm ci
Copy-Item .env.example .env
```

Si tu utilises un dossier existant, conserve son `.env`. Dans un éditeur, renseigne une nouvelle clé dans `GEMINI_API_KEY`. Ce fichier est ignoré par Git : ne colle pas la clé dans le code ni dans un commit. Laisse `GEMINI_MODEL=auto` pour que le serveur choisisse un modèle compatible dans le catalogue Google.

```powershell
npm start
```

Ouvre **http://127.0.0.1:3000** et laisse le terminal ouvert. Après une modification de `.env`, arrête avec Ctrl+C puis relance. Un appel à Google peut durer jusqu'à 60 secondes ; la présence d'une clé ne garantit pas qu'elle est valide ou que son quota est disponible.

## Vérifier la phase 1

1. Envoie « Je m'appelle Alex », puis « Quel est mon prénom ? ».
2. Dans l'onglet Réseau du navigateur, vérifie que chaque requête contient uniquement son propre `message`. La première question n'est pas transmise avec la seconde.
3. Essaie une saisie vide puis une erreur de connexion : l'interface doit rester utilisable et permettre de réessayer.

## Les trois branches GitHub

- [phase-1](https://github.com/krym25/gemini-chat/tree/phase-1) : une question, une réponse.
- [phase-2](https://github.com/krym25/gemini-chat/tree/phase-2) : ajout de la mémoire de conversation.
- [phase-3](https://github.com/krym25/gemini-chat/tree/phase-3) : contexte et personnalité enrichis.

La CI, avec GitHub Actions, automatise les contrôles du code après un changement. Ses résultats se consultent dans l'onglet **Actions** ; elle ne remplace pas un essai réel avec ta clé et ne lance pas le serveur chez un hébergeur. Le RAG sera abordé après ces trois phases.
