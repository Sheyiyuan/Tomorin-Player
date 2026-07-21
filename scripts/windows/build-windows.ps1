# Windows 构建和打包脚本

param(
    [switch]$Clean,
    [switch]$NSIS,
    [switch]$Help
)

if ($Help) {
    Write-Host "Half Beat Player - Windows 构建脚本"
    Write-Host ""
    Write-Host "用法: .\build-windows.ps1 [-Clean] [-NSIS]"
    Write-Host ""
    Write-Host "参数:"
    Write-Host "  -Clean  清理构建目录"
    Write-Host "  -NSIS   创建 NSIS 安装程序"
    Write-Host "  -Help   显示此帮助"
    exit 0
}

Write-Host "==================================" -ForegroundColor Green
Write-Host "Half Beat Player - Windows 构建" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""

# 检查 Wails
Write-Host "[1/5] 检查 Wails..." -ForegroundColor Yellow
$wails = Get-Command wails -ErrorAction SilentlyContinue
if (-not $wails) {
    Write-Host "错误: 未找到 wails 命令" -ForegroundColor Red
    Write-Host "请访问: https://wails.io/docs/gettingstarted/installation"
    exit 1
}
Write-Host "Wails: $($wails.Source)" -ForegroundColor Green
Write-Host ""

# 检查 Windows 原生 MinGW 工具链（编译 go-sqlite3 需要 CGO）
Write-Host "[2/5] 检查 MinGW-w64 原生工具链..." -ForegroundColor Yellow
$mingwGcc = Get-Command gcc -ErrorAction SilentlyContinue
$mingwGxx = Get-Command g++ -ErrorAction SilentlyContinue
if (-not $mingwGcc -or -not $mingwGxx) {
    Write-Host "错误: 未找到 gcc/g++" -ForegroundColor Red
    Write-Host "请安装 MinGW-w64（例如 MSYS2 UCRT64），并将其 bin 目录加入 PATH" -ForegroundColor Yellow
    exit 1
}
Write-Host "MinGW GCC: $($mingwGcc.Source)" -ForegroundColor Green
Write-Host "MinGW G++: $($mingwGxx.Source)" -ForegroundColor Green
Write-Host ""

# 配置 CGO 环境（必须启用，否则 go-sqlite3 会报 CGO_DISABLED=0 错误）
Write-Host "[3/5] 配置 CGO 环境变量..." -ForegroundColor Yellow
$env:CGO_ENABLED = "1"
$env:CC = $mingwGcc.Source
$env:CXX = $mingwGxx.Source
Write-Host "CGO_ENABLED=$($env:CGO_ENABLED)" -ForegroundColor Green
Write-Host "CC=$($env:CC)" -ForegroundColor Green
Write-Host "CXX=$($env:CXX)" -ForegroundColor Green
Write-Host ""

Write-Host "[4/5] 检查 Wails 标准图标源..." -ForegroundColor Yellow
& go run ./scripts/verify-app-icon
if ($LASTEXITCODE -ne 0) {
    Write-Host "错误: 应用图标检查失败" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 版本注入：优先使用环境变量 APP_VERSION；否则从 frontend/package.json 读取
$version = $env:APP_VERSION
if (-not $version) {
    if (Test-Path -Path "frontend/package.json") {
        $pkg = Get-Content "frontend/package.json" -Raw | ConvertFrom-Json
        $version = $pkg.version
    }
}
if (-not $version) {
    Write-Host "错误: 未提供 APP_VERSION，且无法从 package.json 读取版本" -ForegroundColor Red
    exit 1
}

# 注入到前端（Vite 仅暴露 VITE_ 前缀的环境变量）
$env:VITE_APP_VERSION = $version

$versionBase = ($version -split '-')[0]
if ($versionBase -notmatch '^\d+\.\d+\.\d+$') {
    Write-Host "错误: Windows 产品版本必须以 x.y.z 开头: $version" -ForegroundColor Red
    exit 1
}
# Wails 的 NSIS 模板会自行追加第四段 .0。
$fileVersion = $versionBase

# 临时更新 wails.json 的 productVersion
$backup = "wails.json.bak"
Copy-Item -Path "wails.json" -Destination $backup -Force
$wails = Get-Content "wails.json" -Raw | ConvertFrom-Json
$wails.info.productVersion = $fileVersion
$wails | ConvertTo-Json -Depth 10 | Set-Content "wails.json" -Encoding UTF8

try {
    # Wails only regenerates icon.ico when the previous derivative is absent.
    $derivedIcon = "build/windows/icon.ico"
    if (Test-Path -LiteralPath $derivedIcon) {
        Remove-Item -LiteralPath $derivedIcon -Force
    }

    # 构建参数
    $buildArgs = @("build", "-platform", "windows/amd64")
    if ($Clean) { $buildArgs += "-clean" }
    if ($NSIS) { $buildArgs += "-nsis" }

    # 构建应用
    Write-Host "[5/5] 构建应用... (版本 $version)" -ForegroundColor Yellow
    & wails @buildArgs

    if ($LASTEXITCODE -ne 0) {
        Write-Host "错误: 构建失败" -ForegroundColor Red
        exit 1
    }

    $env:CGO_ENABLED = "0"
    & go run ./scripts/verify-windows-icon "build/bin/half-beat.exe"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "错误: Windows EXE 图标检查失败" -ForegroundColor Red
        exit 1
    }
}
finally {
    # 恢复 wails.json
    if (Test-Path -Path $backup) {
        Move-Item -Path $backup -Destination "wails.json" -Force
    }
}

# 显示结果
Write-Host "[5/5] 构建完成!" -ForegroundColor Green
Write-Host ""
Get-ChildItem -Path "build\bin\*.exe" | ForEach-Object {
    Write-Host "  $($_.Name) - $([math]::Round($_.Length/1MB, 2)) MB"
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Green
Write-Host "下一步:" -ForegroundColor Cyan
Write-Host "1. 将 build/bin/*.exe 复制到 Windows 系统"
Write-Host "2. 确保已安装 WebView2 运行时"
Write-Host "3. 使用 diagnose.bat 诊断启动问题"
Write-Host "==================================" -ForegroundColor Green
