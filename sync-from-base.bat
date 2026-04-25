@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title Sync base worganic -^> THI-V01

set "BASE_PATH=%~dp0..\worganic-base"
set "CHILD_JSON=%~dp0version.json"
set "BASE_JSON=%BASE_PATH%\version.json"
set "PROPAG_JSON=%BASE_PATH%\data\base-propagation.json"

echo.
echo  ================================================
echo    Sync worganic-base  ^>  child THI-V01
echo  ================================================
echo.

if not exist "%BASE_PATH%\" (
    echo  [ERREUR] Dossier worganic-base introuvable :
    echo  %BASE_PATH%
    echo.
    pause & exit /b 1
)

for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-Content '%BASE_JSON%' | ConvertFrom-Json).base"`) do set "BASE_VERSION=%%i"
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-Content '%CHILD_JSON%' | ConvertFrom-Json).child"`) do set "CHILD_VERSION=%%i"
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-Content '%CHILD_JSON%' | ConvertFrom-Json).baseSynced"`) do set "BASE_SYNCED=%%i"

echo   Version child   : %CHILD_VERSION%
echo   Base disponible : %BASE_VERSION%
echo   Base syncee     : %BASE_SYNCED%
echo.

if "%BASE_VERSION%"=="%BASE_SYNCED%" (
    echo  [OK] La base est deja a jour ^(%BASE_SYNCED%^). Rien a faire.
    echo.
    pause & exit /b 0
)

echo  [!] Mise a jour disponible : %BASE_SYNCED%  -^>  %BASE_VERSION%
echo.
echo  Modifications a integrer :
echo  --------------------------
powershell -NoProfile -Command "if (Test-Path '%PROPAG_JSON%') { $d = Get-Content '%PROPAG_JSON%' | ConvertFrom-Json; $p = @($d.entries | Where-Object { $_.propagationRequired -eq $true }); if ($p.Count -gt 0) { $p | ForEach-Object { Write-Host ('  [' + $_.baseVersion + '] ' + $_.title) } } else { Write-Host '  Aucune propagation en attente.' } } else { Write-Host '  Fichier base-propagation.json introuvable.' }"
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
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "$v = '%CHILD_VERSION%' -replace '^THI-',''; $p = $v.Split('.'); $maj = [int]$p[0]; $min = [int]$p[1] + 1; if ($min -ge 100) { $maj++; $min = 0 }; 'THI-' + $maj + '.' + $min.ToString('D2')"`) do set "NEXT=%%v"

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
