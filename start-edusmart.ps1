# EduSmart Local Network Startup Script
# This script starts the system for local network access

Write-Host "Starting EduSmart for Local Network Access..." -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

Write-Host "`n🌐 Your local network URL:" -ForegroundColor Yellow
Write-Host "   http://192.168.10.43:3000" -ForegroundColor Cyan

Write-Host "`n📋 Share this URL with satellite users:" -ForegroundColor Yellow
Write-Host "   They need to be on the same WiFi network" -ForegroundColor White
Write-Host "   They can access: http://192.168.10.43:3000" -ForegroundColor White

Write-Host "`n🚀 Starting applications..." -ForegroundColor Yellow

# Start the applications
npm run dev

Write-Host "`n✅ System is running!" -ForegroundColor Green
Write-Host "   Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "   Backend:  http://localhost:5000" -ForegroundColor Cyan
Write-Host "   Network:  http://192.168.10.43:3000" -ForegroundColor Cyan

Write-Host "`nPress Ctrl+C to stop the system" -ForegroundColor Yellow 