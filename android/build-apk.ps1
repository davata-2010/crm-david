# Compila el APK de release firmado, con la aplicación dentro.
#
# Uso:  powershell -ExecutionPolicy Bypass -File android\build-apk.ps1
# Antes hay que haber generado la exportación con "npm run build" en la raíz.

$ErrorActionPreference = "Stop"

$env:JAVA_HOME    = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

Set-Location $PSScriptRoot

$ks = Join-Path $PSScriptRoot "aurum.keystore"
if (-not (Test-Path $ks)) { throw "Falta aurum.keystore. Genera uno con keytool (ver README)." }

# --- la aplicación entra en el APK ---
$out = Join-Path $PSScriptRoot "..\out"
if (-not (Test-Path (Join-Path $out "index.html"))) {
  throw "No encuentro la exportacion en $out. Ejecuta 'npm run build' en la raiz."
}

$assets = Join-Path $PSScriptRoot "app\src\main\assets\web"
Remove-Item -Recurse -Force $assets -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $assets | Out-Null
Copy-Item -Recurse -Force (Join-Path $out "*") $assets

$n = (Get-ChildItem $assets -Recurse -File | Measure-Object).Count
Write-Output "Aplicacion copiada al APK: $n ficheros"

& "$env:JAVA_HOME\bin\java.exe" -classpath "gradle\wrapper\gradle-wrapper.jar" org.gradle.wrapper.GradleWrapperMain `
  assembleRelease `
  "-PstoreFile=$ks" "-PstorePassword=$env:AURUM_KEYSTORE_PASS" `
  "-PkeyAlias=aurum" "-PkeyPassword=$env:AURUM_KEYSTORE_PASS" `
  --no-daemon --console=plain

New-Item -ItemType Directory -Force -Path "dist" | Out-Null
Copy-Item "app\build\outputs\apk\release\app-release.apk" "dist\Aurum-CRM-1.0.0.apk" -Force

$mb = [math]::Round((Get-Item "dist\Aurum-CRM-1.0.0.apk").Length / 1MB, 2)
Write-Output "`nListo: android\dist\Aurum-CRM-1.0.0.apk ($mb MB)"
