<#
.SYNOPSIS
  Isolated DSH 0.2 Web acceptance smoke for dsh-prompt-polish.
.DESCRIPTION
  Uses a disposable DSH_HOME/profile, isolated Web/DevTools ports, and an isolated
  Edge/Chrome user-data directory. Only processes launched by this script are stopped.
#>
[CmdletBinding()]
param(
  [string]$CliPath = 'F:\dsh-desktop-official\resources\runtime\cli\bin\dsh.cmd',
  [string]$Profile = 'dsh-prompt-polish-compat-web',
  [int]$Port = 33180,
  [int]$DebugPort = 9333,
  [string]$TestHome = '',
  [string]$BrowserPath = '',
  [int]$TimeoutSeconds = 90
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$probe = Join-Path $PSScriptRoot 'web-boot-probe.mjs'
if ([string]::IsNullOrWhiteSpace($TestHome)) { $TestHome = Join-Path $repo '.tmp\dsh02-web-home' }
$TestHome = [System.IO.Path]::GetFullPath($TestHome)
if ($Port -eq 3080 -or $DebugPort -eq 3080) { throw 'Refusing to use the active/default 3080 port.' }
if (-not (Test-Path -LiteralPath $CliPath)) { throw "DSH CLI not found: $CliPath" }
if ([string]::IsNullOrWhiteSpace($BrowserPath)) {
  $candidates = @(
    (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
  )
  $BrowserPath = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if ([string]::IsNullOrWhiteSpace($BrowserPath) -or -not (Test-Path -LiteralPath $BrowserPath)) { throw 'No Chrome/Edge found; pass -BrowserPath.' }

$oldHome = $env:DSH_HOME
$server = $null
$browser = $null
$env:DSH_HOME = $TestHome
$logDir = Join-Path $TestHome 'smoke-logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$browserProfile = Join-Path $TestHome 'browser-profile'
$serverOut = Join-Path $logDir 'web.stdout.log'
$serverErr = Join-Path $logDir 'web.stderr.log'
function Stop-Tree([int]$ProcessId) {
  try {
    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$ProcessId" -ErrorAction SilentlyContinue
    foreach ($child in $children) { Stop-Tree -ProcessId $child.ProcessId }
  } catch { }
  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}
try {
  $version = (& $CliPath --version 2>&1 | Out-String).Trim()
  if ($version -ne '0.2.0-rc.2') { throw "Expected DSH 0.2.0-rc.2, found $version" }
  $profileJson = Join-Path $TestHome "profiles\$Profile\package.json"
  if (-not (Test-Path -LiteralPath $profileJson)) {
    & $CliPath --from-default-profile web --profile $Profile --dump-config *> (Join-Path $logDir 'init.log')
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $profileJson)) { throw 'Unable to initialize disposable Web profile.' }
  }
  & $CliPath plugin --profile $Profile add $repo *> (Join-Path $logDir 'plugin-add.log')
  if ($LASTEXITCODE -ne 0) { throw 'Unable to install plugin into disposable Web profile.' }
  $config = & $CliPath --profile $Profile --dump-config 2>&1 | Out-String
  if ($config -notmatch '(?m)^- id: dsh-prompt-polish\s*$') { throw 'Composed profile is missing dsh-prompt-polish.' }

  $server = Start-Process -FilePath $CliPath -ArgumentList @('--profile',$Profile,'--no-open','--port',"$Port") `
    -RedirectStandardOutput $serverOut -RedirectStandardError $serverErr -PassThru -WindowStyle Hidden
  $url = $null
  for ($i=0; $i -lt ($TimeoutSeconds * 2); $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-Path -LiteralPath $serverOut) {
      $match = Select-String -Path $serverOut -Pattern 'dsh web:\s*(\S+)' -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($match) { $url = $match.Matches[0].Groups[1].Value.Trim(); break }
    }
    if ($server.HasExited) { throw "Isolated Web exited early; inspect $serverErr" }
  }
  if ([string]::IsNullOrWhiteSpace($url)) { throw "Isolated Web did not report URL; inspect $serverOut" }
  $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20
  if ($response.StatusCode -ne 200 -or $response.Content -notmatch '__DSH_BOOT__') { throw 'Web did not serve a DSH boot document.' }

  if (Test-Path -LiteralPath $browserProfile) { Remove-Item -LiteralPath $browserProfile -Recurse -Force }
  $browser = Start-Process -FilePath $BrowserPath -ArgumentList @(
    '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
    '--disable-extensions','--disable-background-networking','--mute-audio',
    "--remote-debugging-port=$DebugPort",'--remote-allow-origins=*',
    "--user-data-dir=$browserProfile",'about:blank'
  ) -PassThru -WindowStyle Hidden

  $probeOut = Join-Path $logDir 'web-probe.json'
  & 'F:\env\node-v22.19.0-win-x64\node.exe' $probe $url $DebugPort ($TimeoutSeconds * 1000) *> $probeOut
  if ($LASTEXITCODE -ne 0) { throw "Browser probe failed; inspect $probeOut and renderer logs." }
  $probeResult = Get-Content -LiteralPath $probeOut -Raw | ConvertFrom-Json
  if ($probeResult.verdict -ne 'ok') { throw "Browser verdict was $($probeResult.verdict); inspect $probeOut." }
  if ($probeResult.snapshot.optimizeControl -lt 1) { throw "conversation.input.left contribution was not rendered; inspect $probeOut." }
  if ($probeResult.snapshot.settingsRow -lt 1) { throw "settings.general.item contribution did not render in Settings; inspect $probeOut." }
  Write-Host "PASS: isolated DSH $version Web smoke ($Profile, port $Port)"
  Write-Host ("Probe: " + $probeOut)
}
finally {
  if ($null -ne $browser -and -not $browser.HasExited) { Stop-Tree -ProcessId $browser.Id }
  if ($null -ne $server -and -not $server.HasExited) { Stop-Tree -ProcessId $server.Id }
  if ($null -eq $oldHome) { Remove-Item Env:DSH_HOME -ErrorAction SilentlyContinue }
  else { $env:DSH_HOME = $oldHome }
}
