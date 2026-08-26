# Compila el APK de release firmado.
# Uso:  powershell -ExecutionPolicy Bypass -File android\build-apk.ps1
$ErrorActionPreference = "Stop"

$env:JAVA_HOME   = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

Set-Location $PSScriptRoot
$ks = Join-Path $PSScriptRoot "aurum.keystore"
if (-not (Test-Path $ks)) { throw "Falta aurum.keystore. Genera uno con keytool (ver README)." }

& "$env:JAVA_HOME\bin\java.exe" -classpath "gradle\wrapper\gradle-wrapper.jar" org.gradle.wrapper.GradleWrapperMain `
  assembleRelease `
  "-PstoreFile=$ks" "-PstorePassword=$env:AURUM_KEYSTORE_PASS" `
  "-PkeyAlias=aurum" "-PkeyPassword=$env:AURUM_KEYSTORE_PASS" `
  --no-daemon --console=plain

New-Item -ItemType Directory -Force -Path "dist" | Out-Null
Copy-Item "app\build\outputs\apk\release\app-release.apk" "dist\Aurum-CRM-1.0.0.apk" -Force
Write-Output "`nListo: android\dist\Aurum-CRM-1.0.0.apk"
