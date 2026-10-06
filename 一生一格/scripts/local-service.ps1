param([ValidateSet('api','web')][string]$Service)
$ErrorActionPreference = 'Stop'
$projectPath = Split-Path $PSScriptRoot -Parent
$nodePath = (Get-Command node -ErrorAction Stop).Source
$logPath = Join-Path $env:LOCALAPPDATA 'MonkeyLife\logs'
New-Item -ItemType Directory -Path $logPath -Force | Out-Null
$arguments = if ($Service -eq 'api') { @('--env-file-if-exists=.env','server/index.mjs') } else { @('node_modules/vite/bin/vite.js','--host','127.0.0.1') }
$process = Start-Process -FilePath $nodePath -ArgumentList $arguments -WorkingDirectory $projectPath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logPath "$Service.out.log") -RedirectStandardError (Join-Path $logPath "$Service.err.log") -PassThru
$process.WaitForExit()
exit $process.ExitCode
