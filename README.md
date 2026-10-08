# Diablo — Phase 3 : contexte enrichi

HTML, CSS et JavaScript simple. Un serveur Node.js, une dépendance : Express.

## Une branche par phase

Le projet contient trois branches. `main` correspond à la phase 3 et contient la version complète.

| Branche | Contenu |
| --- | --- |
| [phase-1](https://github.com/krym25/gemini-chat/tree/phase-1) | Chat simple : seule la nouvelle question est envoyée. |
| [phase-2](https://github.com/krym25/gemini-chat/tree/phase-2) | Chat avec mémoire : un contexte résumé accompagne chaque question. |
| [main — phase 3](https://github.com/krym25/gemini-chat/tree/main) | Contexte enrichi : le rôle et la personnalité de Diablo complètent la mémoire. |

Pour explorer une phase depuis un dépôt existant : `git fetch origin`, puis `git switch phase-1` (ou `phase-2`, `main`). Conserve tes modifications locales avant de changer de branche.

## Démarrage sur Windows

Avec Node.js 24 installé, ouvre PowerShell :

~~~powershell
cd $HOME
git clone https://github.com/krym25/gemini-chat.git gemini-chat-roi-demon
cd gemini-chat-roi-demon
npm ci
Copy-Item .env.example .env
code .
~~~

Dans VS Code, ouvre le fichier **.env**, mets ta nouvelle clé après **GEMINI_API_KEY=**, puis enregistre.
Laisse GEMINI_MODEL=auto. Écris la clé dans ce fichier, pas dans PowerShell.

Reviens dans le terminal du dossier du projet :

~~~powershell
npm start
~~~

Attends « Site prêt », puis ouvre **http://127.0.0.1:3000** et envoie un premier message.
Laisse le terminal ouvert. Après une modification de .env, arrête avec Ctrl+C et relance.
Arrête l'ancien serveur si le port 3000 est occupé.
Si tu utilises déjà ce dossier, conserve ton .env au lieu de le recopier.

## Les trois étapes du projet

L'interface réunit les trois étapes dans une seule discussion, sans sélection de mode.
Le contexte résumé est actif automatiquement. Le rôle s'adapte à ce que tu demandes dans ton message.

| Phase | Fonctionnement | À essayer |
| --- | --- | --- |
| 1 | Envoyer une question et afficher la réponse. | Demander une explication. |
| 2 | Gemini crée un contexte résumé, puis le met à jour après chaque échange. | « Je m'appelle Alex, j'apprends le JS », puis plusieurs questions, puis « Quel est mon prénom et qu'est-ce que j'apprends ? ». |
| 3 | La personnalité s'adapte à ta demande, avec Diablo comme roi démon pour ton aventure isekai. | « Incarne Diablo, un roi démon dans un isekai. Je suis Alex, invoqué depuis la Terre ». |

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
- **server.js** : la clé privée, l'appel à Gemini et la personnalité de Diablo.

La personnalité de Diablo se modifie dans `demonInstructions` dans server.js.

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
