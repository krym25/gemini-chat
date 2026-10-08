@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Installe Node.js LTS, puis relance ce fichier.
  goto fin
)

if not exist ".env" copy ".env.example" ".env" >nul
node --env-file=.env -e "process.exit(process.env.GEMINI_API_KEY?.trim() ? 0 : 1)"
if errorlevel 1 (
  echo Renseigne ta cle apres GEMINI_API_KEY= dans le fichier qui s'ouvre.
  start "" /wait notepad ".env"
  echo Enregistre le fichier, ferme le Bloc-notes, puis appuie sur une touche.
  pause >nul
)

if not exist "node_modules\express\package.json" (
  call npm.cmd ci
  if errorlevel 1 goto fin
)
call npm.cmd start

:fin
pause
