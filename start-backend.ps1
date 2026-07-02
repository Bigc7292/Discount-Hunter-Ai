# Start Discount Hunter Backend
# Navigate to the backend directory and start the server

$backendPath = "C:\Users\Alfa\Desktop\USB_DRIVE\discount_hunter_ai\backend"
Set-Location -Path $backendPath

Write-Host "Starting Discount Hunter Backend..." -ForegroundColor Green
Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow

# List files to verify we're in the right place
Get-ChildItem -Path . | Select-Object Name, LastWriteTime | Write-Host

# Check for .env file
if (Test-Path .env) {
    Write-Host "✓ .env file exists" -ForegroundColor Green
} else {
    Write-Host "✗ .env file not found" -ForegroundColor Red
}

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install 2>&1 | Write-Host

# Start the backend server
Write-Host "Starting backend server on port 3001..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow

# Run the npm script
npm run dev 2>&1