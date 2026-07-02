# Simple PowerShell script to start the backend
# Run from PowerShell

$backendPath = "C:\Users\Alfa\Desktop\USB_DRIVE\discount_hunter_ai\backend"
Set-Location -Path $backendPath

Write-Host "Starting Discount Hunter Backend..." -ForegroundColor Green
Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow

# Show current files
Write-Host "Files in backend directory:" -ForegroundColor Yellow
Get-ChildItem -Path . | Select-Object Name, LastWriteTime

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install 2>&1 | ForEach-Object { Write-Host $_ }

# Wait for installation
Write-Host "Dependencies installed. Starting server..." -ForegroundColor Green

# Start the server
npm run dev 2>&1