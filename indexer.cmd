@echo off
setlocal
cd /d "%~dp0"
title Nova - Indexation des documents

if not exist "indexer.js" goto incomplet
if not exist "rag.js" goto incomplet
if not exist "documents" goto incomplet
if not exist "package-lock.json" goto incomplet
if not exist ".env.example" goto incomplet

where node >nul 2>nul
if errorlevel 1 (
  echo Installe Node.js LTS depuis https://nodejs.org puis relance indexer.cmd.
  goto fin
)
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm est absent. Reinstalle Node.js LTS puis relance indexer.cmd.
  goto fin
)
node -e "const [major,minor]=process.versions.node.split('.').map(Number); process.exit(major>22 || (major===22 && minor>=12) ? 0 : 1)"
if errorlevel 1 (
  echo Node.js 22.12 minimum est necessaire. Installe la version LTS actuelle.
  goto fin
)
node --check indexer.js
if errorlevel 1 (
  echo Le fichier indexer.js est abime. Reextrais la version complete du ZIP.
  goto fin
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
  if errorlevel 1 (
    echo Impossible de creer .env. Extrais le ZIP dans un dossier accessible.
    goto fin
  )
)
node --env-file=.env -e "process.exit(process.env.GEMINI_API_KEY?.trim() ? 0 : 1)"
if errorlevel 1 (
  echo Renseigne ta cle apres GEMINI_API_KEY= dans le fichier qui s'ouvre.
  echo Enregistre puis ferme le fichier ou l'onglet de l'editeur.
  where code >nul 2>nul
  if errorlevel 1 (
    start "" /wait notepad.exe ".env"
  ) else (
    call code --wait ".env"
  )
  echo Appuie sur une touche apres avoir enregistre ton fichier.
  pause >nul
)
node --env-file=.env -e "process.exit(process.env.GEMINI_API_KEY?.trim() ? 0 : 1)"
if errorlevel 1 (
  echo La cle manque ou .env est invalide. Corrige .env puis relance indexer.cmd.
  goto fin
)

set "NOVA_INSTALL=0"
if not exist "node_modules\express\package.json" set "NOVA_INSTALL=1"
if not exist "node_modules\@google\genai\package.json" set "NOVA_INSTALL=1"
if "%NOVA_INSTALL%"=="1" (
  echo Installation des dependances. Internet est necessaire au premier lancement.
  call npm.cmd ci
  if errorlevel 1 (
    echo Installation impossible. Verifie ta connexion puis relance indexer.cmd.
    goto fin
  )
)
echo Creation des embeddings pour les documents .txt et .md.
echo Cette operation appelle Google et consomme du quota.
call npm.cmd run index
if errorlevel 1 (
  echo Indexation echouee. Corrige l'erreur ci-dessus puis relance ce fichier.
) else (
  echo Tu peux maintenant utiliser le mode Documents - RAG dans Nova.
)
goto fin

:incomplet
echo Le dossier est incomplet. Extrais TOUT le ZIP avant de lancer indexer.cmd.

:fin
pause
endlocal
