# Chat Gemini — 3 phases

HTML, CSS et JavaScript simple. Un serveur Node.js, une dépendance : Express.

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

## Les trois phases

| Phase | Fonctionnement | À essayer |
| --- | --- | --- |
| 1 | Une question et une réponse, sans mémoire. | Demander une explication. |
| 2 | Gemini crée un contexte résumé, puis le met à jour après chaque échange. | « Je m'appelle Alex, j'apprends le JS », puis plusieurs questions, puis « Quel est mon prénom et qu'est-ce que j'apprends ? ». |
| 3 | Varkhos, roi démon du royaume des Cendres, utilise ce même mécanisme pour ton aventure isekai. | « Je suis Alex, invoqué depuis la Terre. Je souhaite conclure un pacte ». |

En phases 2 et 3, **seuls le contexte résumé et la nouvelle question sont envoyés**.
Les messages visibles à l'écran ne constituent pas l'historique envoyé à l'API.
Le résumé est limité à 4000 caractères : c'est une mémoire condensée, qui peut omettre des détails.
L'interface affiche uniquement la conversation ; le contexte résumé reste dans la mémoire de la page.
Une seule génération Gemini produit la réponse et le nouveau résumé.

Les modes de la barre latérale correspondent aux trois phases : Chat simple, Conversation suivie et Roi démon.
Changer de mode, cliquer sur Nouvelle discussion ou recharger la page efface la mémoire.
Le serveur reste **stateless** : il ne stocke aucune conversation.

## Les fichiers à comprendre

- **public/index.html** : les éléments de la page.
- **public/style.css** : la présentation.
- **public/app.js** : les boutons, le contexte et l'appel au serveur.
- **server.js** : la clé privée, l'appel à Gemini et la personnalité de Varkhos.

La personnalité se modifie dans le bloc PHASE 3 de server.js.

## Clé et erreurs

La clé reste dans .env, ignoré par Git. Une clé précédemment partagée doit être remplacée dans AI Studio.
L'interface affiche des erreurs formulées pour l'utilisateur et ne montre pas les détails techniques de Google.
La réponse de l'API garde un détail masqué pour le diagnostic dans les outils réseau du navigateur.
HTTP Google 401/403 indique un refus d'accès ; HTTP Google 429 une limite ou un quota.
Le modèle automatique est choisi dans le catalogue Google ; son quota dépend de ton projet.
Un premier message vérifie l'appel réel avec ta clé.

Le projet se lance sur ton ordinateur après téléchargement depuis GitHub.
GitHub Pages ne lance pas le serveur Node.js nécessaire à cette API.
