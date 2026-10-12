<#
.SYNOPSIS
  Isolated DSH 0.2 Headless activation smoke for dsh-prompt-polish.
.DESCRIPTION
  Uses a disposable DSH_HOME/profile and starts only the process created by this script.
  It does not require an LLM credential: --help mounts the Host plugin and exits before
  a model request. It verifies the composed bundle, host mount output, and strict Typert
  registration through the real DSH 0.2.0-rc.2 CLI.
#>
[CmdletBinding()]
param(
  [string]$CliPath = 'F:\dsh-desktop-official\resources\runtime\cli\bin\dsh.cmd',
  [string]$Profile = 'dsh-prompt-polish-compat-headless',
  [string]$TestHome = '',
  [int]$TimeoutSeconds = 60
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ([string]::IsNullOrWhiteSpace($TestHome)) { $TestHome = Join-Path $repo '.tmp\dsh02-headless-home' }
$TestHome = [System.IO.Path]::GetFullPath($TestHome)
if (-not (Test-Path -LiteralPath $CliPath)) { throw "DSH CLI not found: $CliPath" }

$oldHome = $env:DSH_HOME
$env:DSH_HOME = $TestHome
$logDir = Join-Path $TestHome 'smoke-logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$profileJson = Join-Path $TestHome "profiles\$Profile\package.json"
$failures = @()

try {
  $version = (& $CliPath --version 2>&1 | Out-String).Trim()
  if ($version -ne '0.2.0-rc.2') { throw "Expected DSH 0.2.0-rc.2, found $version" }

  if (-not (Test-Path -LiteralPath $profileJson)) {
    & $CliPath --from-default-profile headless --profile $Profile --dump-config *> (Join-Path $logDir 'init.log')
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $profileJson)) { throw 'Unable to initialize disposable Headless profile.' }
  }

  & $CliPath plugin --profile $Profile add $repo *> (Join-Path $logDir 'plugin-add.log')
  if ($LASTEXITCODE -ne 0) { throw 'Unable to install plugin into disposable Headless profile.' }

  $config = & $CliPath --profile $Profile --dump-config 2>&1 | Out-String
  if ($config -notmatch '(?m)^- id: dsh-prompt-polish\s*$') { $failures += 'composed profile is missing dsh-prompt-polish' }
  if ($config -notmatch '(?m)^- id: typert-loader\s*$') { $failures += 'composed profile is missing typert-loader' }

  # DSH Cordis plugin apply occurs before the CLI returns command help. The
  # host-mounted marker proves real loader activation without contacting an LLM.
  $helpOut = Join-Path $logDir 'headless.stdout.log'
  $helpErr = Join-Path $logDir 'headless.stderr.log'
  & $CliPath --profile $Profile --help *> $helpOut
  if ($LASTEXITCODE -ne 0) { $failures += 'Headless help command failed' }
  $stdout = if (Test-Path -LiteralPath $helpOut) { Get-Content -LiteralPath $helpOut -Raw } else { '' }
  $stderr = if (Test-Path -LiteralPath $helpErr) { Get-Content -LiteralPath $helpErr -Raw } else { '' }
  if ($stdout -notmatch '\[dsh-prompt-polish\] host mounted') { $failures += 'Host plugin did not report mount' }
  if ($stdout -match 'did not activate|strict codec has no create\(\)|has no create\(\) factory') { $failures += 'Host/Typert activation reported a failure' }
  if ($stderr -match 'typert-loader:|did not activate|failed to activate') { $failures += 'Typert loader reported activation failure' }

  if ($failures.Count -gt 0) { throw ('Headless smoke failed:' + [Environment]::NewLine + ($failures -join [Environment]::NewLine)) }
  Write-Host "PASS: isolated DSH $version Headless activation ($Profile, $TestHome)"
}
finally {
  if ($null -eq $oldHome) { Remove-Item Env:DSH_HOME -ErrorAction SilentlyContinue }
  else { $env:DSH_HOME = $oldHome }
}
