@echo off
REM Lance les tests automatisés Zone 3 / Zone 4.
REM Usage : tests\run-tests.bat
REM
REM Avant de lancer : positionner WORG_TOKEN dans l'environnement, ex :
REM   set WORG_TOKEN=ab12cd34...
REM (récupéré via localStorage.getItem('frankenstein_token') dans la console navigateur)

setlocal
if "%WORG_TOKEN%"=="" (
    echo [ERREUR] Variable WORG_TOKEN absente.
    echo   Ouvrez la console du navigateur sur http://localhost:4200 et tapez :
    echo     copy^(localStorage.getItem^('frankenstein_token'^)^)
    echo   Puis dans cette console :
    echo     set WORG_TOKEN=^<le token collé^>
    echo     tests\run-tests.bat
    exit /b 1
)

node "%~dp0test-zone-projet.js"
endlocal
