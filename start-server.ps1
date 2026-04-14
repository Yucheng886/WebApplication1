# IIS Express 启动脚本
# 使用方法：在 PowerShell 中运行 .\start-server.ps1

$projectPath = "WebApplication1"
$port = 65034
$sslPort = 44364

Write-Host "正在启动 IIS Express..." -ForegroundColor Green
Write-Host "项目路径: $PSScriptRoot\$projectPath" -ForegroundColor Yellow
Write-Host "HTTP 端口: $port" -ForegroundColor Yellow
Write-Host "HTTPS 端口: $sslPort" -ForegroundColor Yellow
Write-Host ""

# 查找 IIS Express
$iisExpressPaths = @(
    "${env:ProgramFiles}\IIS Express\iisexpress.exe",
    "${env:ProgramFiles(x86)}\IIS Express\iisexpress.exe",
    "${env:ProgramW6432}\IIS Express\iisexpress.exe"
)

$iisExpress = $null
foreach ($path in $iisExpressPaths) {
    if (Test-Path $path) {
        $iisExpress = $path
        break
    }
}

if (-not $iisExpress) {
    Write-Host "错误: 未找到 IIS Express" -ForegroundColor Red
    Write-Host "请确保已安装 Visual Studio 或 IIS Express" -ForegroundColor Red
    Write-Host ""
    Write-Host "或者使用 Visual Studio 启动项目:" -ForegroundColor Yellow
    Write-Host "1. 打开 WebApplication1.sln" -ForegroundColor Yellow
    Write-Host "2. 按 F5 启动" -ForegroundColor Yellow
    exit 1
}

$fullPath = Join-Path $PSScriptRoot $projectPath

if (-not (Test-Path $fullPath)) {
    Write-Host "错误: 项目路径不存在: $fullPath" -ForegroundColor Red
    exit 1
}

Write-Host "启动 IIS Express..." -ForegroundColor Green
Write-Host "访问地址: http://localhost:$port/ 或 https://localhost:$sslPort/" -ForegroundColor Cyan
Write-Host "按 Ctrl+C 停止服务器" -ForegroundColor Yellow
Write-Host ""

# 启动 IIS Express
& $iisExpress `
    /path:"$fullPath" `
    /port:$port `
    /clr:v4.0 `
    /apppool:Clr4IntegratedAppPool

