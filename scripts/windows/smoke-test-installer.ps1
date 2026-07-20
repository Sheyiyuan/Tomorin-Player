param(
    [Parameter(Mandatory = $true)]
    [string]$ArtifactRoot,
    [Parameter(Mandatory = $true)]
    [string]$ExpectedVersion
)

$ErrorActionPreference = "Stop"
$expectedWindowsVersion = ($ExpectedVersion -split '-')[0]
if ($expectedWindowsVersion -notmatch '^\d+\.\d+\.\d+$') {
    throw "Expected version must start with x.y.z: $ExpectedVersion"
}

$installer = Get-ChildItem -Path $ArtifactRoot -Filter 'half-beat-amd64-installer.exe' -Recurse | Select-Object -First 1
if (-not $installer) {
    throw "NSIS installer not found below $ArtifactRoot"
}

$installDir = Join-Path $env:ProgramFiles 'Sheyiyuan\half-beat'
$appPath = Join-Path $installDir 'half-beat.exe'
$uninstallerPath = Join-Path $installDir 'uninstall.exe'
$uninstallKey = 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Sheyiyuanhalf-beat'

try {
    $install = Start-Process -FilePath $installer.FullName -ArgumentList '/S' -Wait -PassThru
    if ($install.ExitCode -ne 0) {
        throw "NSIS install failed with exit code $($install.ExitCode)"
    }
    if (-not (Test-Path $appPath) -or -not (Test-Path $uninstallerPath)) {
        throw "Installed files are missing from $installDir"
    }
    if (-not (Test-Path $uninstallKey)) {
        throw "Uninstall registry key was not created"
    }

    $displayVersion = (Get-ItemProperty -Path $uninstallKey).DisplayVersion
    if ($displayVersion -ne $expectedWindowsVersion) {
        throw "DisplayVersion is $displayVersion, expected $expectedWindowsVersion"
    }

    $productVersion = (Get-Item $appPath).VersionInfo.ProductVersion
    if (-not $productVersion.StartsWith($expectedWindowsVersion)) {
        throw "Executable ProductVersion is $productVersion, expected $expectedWindowsVersion"
    }

    $uninstall = Start-Process -FilePath $uninstallerPath -ArgumentList '/S' -Wait -PassThru
    if ($uninstall.ExitCode -ne 0) {
        throw "NSIS uninstall failed with exit code $($uninstall.ExitCode)"
    }
    Start-Sleep -Seconds 2
    if ((Test-Path $appPath) -or (Test-Path $uninstallKey)) {
        throw "NSIS uninstall left application files or registry metadata behind"
    }
}
finally {
    if (Test-Path $uninstallerPath) {
        Start-Process -FilePath $uninstallerPath -ArgumentList '/S' -Wait | Out-Null
    }
}

Write-Host "NSIS install, version, and uninstall smoke test passed."
