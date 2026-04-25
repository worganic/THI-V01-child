@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title Sync base worganic → THI-V01

set BASE_PATH=..\worganic-base
set CHILD_VERSION_FILE=version.json
set BASE_VERSION_FILE=%BASE_PATH%\version.json
set BASE_PROPAGATION_FILE=%BASE_PATH%\data\base-propagation.json

echo.
echo  ================================================
echo    Sync worganic-base  →  child THI-V01
echo  ================================================
echo.

REM -- Vérification que le dossier base existe
if not exist "%BASE_PATH%" (
    echo  [ERREUR] Dossier worganic-base introuvable : %BASE_PATH%
    echo  Verifiez que les deux projets sont dans le meme repertoire parent.
    echo.
    pause & exit /b 1
)

REM -- Lecture des versions via PowerShell
for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-Content '%BASE_VERSION_FILE%' | ConvertFrom-Json).base"') do set BASE_VERSION=%%i
for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-Content '%CHILD_VERSION_FILE%' | ConvertFrom-Json).child"') do set CHILD_VERSION=%%i
for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-Content '%CHILD_VERSION_FILE%' | ConvertFrom-Json).baseSynced"') do set BASE_SYNCED=%%i

echo   Version child     : %CHILD_VERSION%
echo   Base disponible   : %BASE_VERSION%
echo   Base syncee       : %BASE_SYNCED%
echo.

REM -- Déjà à jour
if "%BASE_VERSION%"=="%BASE_SYNCED%" (
    echo  [OK] La base est deja a jour ^(%BASE_SYNCED%^). Rien a faire.
    echo.
    pause & exit /b 0
)

echo  [!] Mise a jour disponible : %BASE_SYNCED%  -^>  %BASE_VERSION%
echo.

REM -- Affichage des propagations en attente
echo  Modifications a integrer depuis la base :
echo  ------------------------------------------
powershell -NoProfile -Command ^
  "$f = '%BASE_PROPAGATION_FILE%';" ^
  "if (Test-Path $f) {" ^
  "  $d = Get-Content $f | ConvertFrom-Json;" ^
  "  $p = $d.entries | Where-Object { $_.propagationRequired -eq $true };" ^
  "  if ($p) { $p | ForEach-Object { Write-Host ('  [' + $_.baseVersion + '] ' + $_.title + ' → ' + ($_.propagationScope -join ', ')) } }" ^
  "  else { Write-Host '  Aucune propagation marquee comme requise.' }" ^
  "} else { Write-Host '  Fichier base-propagation.json introuvable.' }"
echo.

REM -- Confirmation
set /p CONFIRM= Mettre a jour baseSynced vers %BASE_VERSION% ? (O/N) :
if /i not "%CONFIRM%"=="O" (
    echo.
    echo  Annule. Aucune modification effectuee.
    echo.
    pause & exit /b 0
)

REM -- Mise à jour de baseSynced dans version.json
powershell -NoProfile -Command ^
  "$vf = Get-Content 'version.json' | ConvertFrom-Json;" ^
  "$vf.baseSynced = '%BASE_VERSION%';" ^
  "$vf | ConvertTo-Json -Depth 10 | Set-Content 'version.json' -Encoding UTF8"

echo.
echo  [OK] version.json mis a jour — baseSynced : %BASE_SYNCED%  →  %BASE_VERSION%
echo.

REM -- Date du jour au format YYYYMMDD
for /f "delims=" %%d in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd"') do set TODAY=%%d

REM -- Incrément suggéré pour la version child (X.XX + 0.01)
for /f "delims=" %%v in ('powershell -NoProfile -Command ^
  "$v = '%CHILD_VERSION%' -replace '^THI-','';" ^
  "$parts = $v.Split('.');" ^
  "$maj = [int]$parts[0];" ^
  "$min = [int]$parts[1] + 1;" ^
  "if ($min -ge 100) { $maj++; $min = 0 };" ^
  "'THI-' + $maj + '.' + $min.ToString('D2')"') do set NEXT_CHILD=%%v

echo  Commandes a lancer pour finaliser :
echo  ------------------------------------
echo.
echo   git add version.json [fichiers modifies...]
echo   git commit -m "%NEXT_CHILD% - %TODAY% - [MERGE] - Sync base %BASE_VERSION%"
echo   git push
echo   node server/deploy-log.js --version "%NEXT_CHILD%" --commit "%NEXT_CHILD% - %TODAY% - [MERGE] - Sync base %BASE_VERSION%" ...
echo.
echo  N'oubliez pas de marquer la propagation comme traitee dans l'admin base.
echo.
pause
endlocal
