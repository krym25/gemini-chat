@echo off
setlocal
cd /d "%~dp0"
title Nova - Chat Gemini

if not exist "server.js" goto incomplet
if not exist "public\index.html" goto incomplet
if not exist "package-lock.json" goto incomplet
if not exist ".env.example" goto incomplet

where node >nul 2>nul
if errorlevel 1 (
  echo Installe Node.js LTS depuis https://nodejs.org puis relance demarrer.cmd.
  goto fin
)
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm est absent. Reinstalle Node.js LTS puis relance demarrer.cmd.
  goto fin
)
node -e "const [major,minor]=process.versions.node.split('.').map(Number); process.exit(major>22 || (major===22 && minor>=12) ? 0 : 1)"
if errorlevel 1 (
  echo Node.js 22.12 minimum est necessaire. Installe la version LTS actuelle.
  goto fin
)
node --check server.js
if errorlevel 1 (
  echo Le fichier server.js est abime. Reextrais la version complete du ZIP.
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
  echo Enregistre puis ferme le Bloc-notes.
  start "" /wait notepad.exe ".env"
  echo Appuie sur une touche apres avoir enregistre ton fichier.
  pause >nul
)
node --env-file=.env -e "process.exit(process.env.GEMINI_API_KEY?.trim() ? 0 : 1)"
if errorlevel 1 (
  echo La cle manque ou .env est invalide. Corrige .env puis relance demarrer.cmd.
  goto fin
)

if not exist "node_modules\express\package.json" (
  echo Installation des dependances. Internet est necessaire au premier lancement.
  call npm.cmd ci
  if errorlevel 1 (
    echo Installation impossible. Verifie ta connexion puis relance demarrer.cmd.
    goto fin
  )
)
echo Apres le message Site pret, ouvre http://127.0.0.1:3000/
echo Garde cette fenetre ouverte. Ctrl+C pour arreter.
call npm.cmd start
goto fin

:incomplet
echo Le dossier est incomplet. Extrais TOUT le ZIP avant de lancer demarrer.cmd.

:fin
pause
endlocal
