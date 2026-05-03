@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

REM -- Configuration a adapter si le dossier base n'est pas a ce chemin relatif
set "BASE_PATH=%~dp0..\worganic-base"
set "CHILD_JSON=%~dp0version.json"
set "BASE_JSON=%BASE_PATH%\version.json"
set "PROPAG_JSON=%BASE_PATH%\data\base-propagation.json"

REM -- Lecture du childId depuis version.json
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-Content '%CHILD_JSON%' | ConvertFrom-Json).childId"`) do set "CHILD_ID=%%i"

if "%CHILD_ID%"=="" (
    echo.
    echo  [ERREUR] Ce fichier est reserve aux projets child.
    echo  version.json ne contient pas de champ 'childId'.
    echo  Etes-vous bien dans un dossier child ?
    echo.
    pause & exit /b 1
)

title Sync worganic-base -> %CHILD_ID%

echo.
echo  ================================================
echo    Sync worganic-base  ^>  child %CHILD_ID%
echo  ================================================
echo.

if not exist "%BASE_PATH%\" (
    echo  [ERREUR] Dossier worganic-base introuvable :
    echo  %BASE_PATH%
    echo  Verifiez la variable BASE_PATH en haut de ce fichier.
    echo.
    pause & exit /b 1
)

REM -- Git pull sur la base pour recuperer la derniere version distante
echo  [GIT] Mise a jour de worganic-base depuis le depot distant...
pushd "%BASE_PATH%"
git pull --ff-only 2>&1
if errorlevel 1 (
    echo.
    echo  [AVERTISSEMENT] git pull a echoue sur worganic-base.
    echo  La version lue sera celle du depot local ^(peut etre obsolete^).
    echo  Verifiez votre connexion ou l'etat du depot.
    echo.
) else (
    echo  [OK] worganic-base mis a jour.
)
popd
echo.

for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-Content '%BASE_JSON%' | ConvertFrom-Json).base"`) do set "BASE_VERSION=%%i"
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-Content '%CHILD_JSON%' | ConvertFrom-Json).child"`) do set "CHILD_VERSION=%%i"
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-Content '%CHILD_JSON%' | ConvertFrom-Json).baseSynced"`) do set "BASE_SYNCED=%%i"

echo   Child           : %CHILD_ID%
echo   Version child   : %CHILD_VERSION%
echo   Base disponible : %BASE_VERSION%
echo   Base syncee     : %BASE_SYNCED%
echo.

if "%BASE_VERSION%"=="%BASE_SYNCED%" (
    echo  [OK] La base est deja a jour ^(%BASE_SYNCED%^). Rien a faire.
    echo.
    pause & exit /b 0
)

echo  [!] Mise a jour disponible : %BASE_SYNCED%  ->  %BASE_VERSION%
echo.
echo  Modifications a integrer :
echo  --------------------------
powershell -NoProfile -Command "if (Test-Path '%PROPAG_JSON%') { $d = Get-Content '%PROPAG_JSON%' | ConvertFrom-Json; $p = @($d.entries | Where-Object { $_.propagationRequired -eq $true }); if ($p.Count -gt 0) { $p | ForEach-Object { Write-Host ('  [' + $_.baseVersion + '] ' + $_.title) } } else { Write-Host '  Aucune propagation en attente (tous les fichiers core sont a jour).' } } else { Write-Host '  Fichier base-propagation.json introuvable.' }"
echo.

set /p "CONFIRM= Mettre a jour baseSynced vers %BASE_VERSION% ? (O/N) : "
if /i not "%CONFIRM%"=="O" (
    echo.
    echo  Annule. Aucune modification effectuee.
    echo.
    pause & exit /b 0
)

powershell -NoProfile -Command "$vf = Get-Content '%CHILD_JSON%' | ConvertFrom-Json; $vf.baseSynced = '%BASE_VERSION%'; $json = $vf | ConvertTo-Json -Depth 10; [System.IO.File]::WriteAllText('%CHILD_JSON%', $json, [System.Text.UTF8Encoding]::new($false))"

echo.
echo  [OK] version.json mis a jour : baseSynced = %BASE_VERSION%
echo.

for /f "usebackq delims=" %%d in (`powershell -NoProfile -Command "Get-Date -Format yyyyMMdd"`) do set "TODAY=%%d"
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "$v = '%CHILD_VERSION%'; $prefix = $v -replace '\d.*',''; $num = $v -replace ('^' + [regex]::Escape($prefix)),''; $p = $num.Split('.'); $maj = [int]$p[0]; $min = [int]$p[1] + 1; if ($min -ge 100) { $maj++; $min = 0 }; $prefix + $maj + '.' + $min.ToString('D2')"`) do set "NEXT=%%v"

echo  Commandes pour finaliser :
echo  --------------------------
echo.
echo    git add version.json [autres fichiers modifies]
echo    git commit -m "%NEXT% - %TODAY% - [MERGE] - Sync base %BASE_VERSION%"
echo    git push
echo    node server/deploy-log.js --version "%NEXT%" --commit "%NEXT% - %TODAY% - [MERGE] - Sync base %BASE_VERSION%" ...
echo.
echo  N'oubliez pas de marquer la propagation comme traitee dans l'admin base.
echo.
pause
endlocal
