$port = 4202
$timeout = 120
$elapsed = 0

Write-Host "[Electron] Attente d'Angular sur le port $port..."

while ($elapsed -lt $timeout) {
    $result = Test-NetConnection -ComputerName 'localhost' -Port $port -WarningAction SilentlyContinue -InformationLevel Quiet
    if ($result) {
        Write-Host "[Electron] Angular pret - demarrage Electron..."
        break
    }
    Start-Sleep -Seconds 1
    $elapsed++
}

if ($elapsed -ge $timeout) {
    Write-Host "[Electron] Timeout : Angular non disponible apres $timeout secondes."
    exit 1
}

Set-Location -Path "$PSScriptRoot\electron"
npm start
