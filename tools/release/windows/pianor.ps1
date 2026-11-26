# Pianor for Windows, without Node or an installer (the release zip, docs/release.md).
# Serves the built game in the folder "game" next to this script on http://localhost:4173/ and opens it as its own
# window: Edge (or Chrome) in app mode, full screen, with a browser profile of its own, as npm run start:local does
# (tools/start-local/browser.ts). Web MIDI needs a secure context and localhost is one, so no certificate is needed.
# Windows' own HTTP server (HttpListener) may listen on localhost without administrator rights; where it cannot, a plain
# TCP listener on the loopback address serves instead. Neither needs a firewall rule: nothing listens beyond this PC.
# Keep this file ASCII only: Windows PowerShell 5.1 reads a file without a byte order mark as the local code page.
param([string]$Lang = '')

$ErrorActionPreference = 'Stop'
$Port = 4173
$Root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'game'))
$Url = "http://localhost:$Port/"
if ($Lang -ne '') { $Url = $Url + '?lang=' + $Lang }
$BrowserProfile = Join-Path $env:LOCALAPPDATA 'Pianor\browser'

$Types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json'; '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.mp3' = 'audio/mpeg'
  '.wasm' = 'application/wasm'; '.woff2' = 'font/woff2'; '.ico' = 'image/x-icon'; '.txt' = 'text/plain; charset=utf-8'
}

function Open-Game {
  $candidates = @()
  foreach ($app in @('Microsoft\Edge\Application\msedge.exe', 'Google\Chrome\Application\chrome.exe')) {
    foreach ($base in @(${env:ProgramFiles(x86)}, $env:ProgramFiles, $env:LOCALAPPDATA)) {
      if ($base) { $candidates += (Join-Path $base $app) }
    }
  }
  foreach ($exe in $candidates) {
    if (Test-Path -LiteralPath $exe) {
      $flags = @("--app=$Url", '--start-fullscreen', "--user-data-dir=`"$BrowserProfile`"", '--no-first-run', '--no-default-browser-check')
      Start-Process -FilePath $exe -ArgumentList $flags | Out-Null
      return
    }
  }
  Write-Host "Edge or Chrome was not found. Open $Url in one of them and press F11."
}

# The file a request path names inside the game folder, or $null (missing, or outside the folder).
function Resolve-GameFile([string]$rawPath) {
  $path = [System.Uri]::UnescapeDataString(($rawPath -split '\?')[0])
  if ($path.EndsWith('/')) { $path = $path + 'index.html' }
  $file = [System.IO.Path]::GetFullPath((Join-Path $Root ($path.TrimStart('/') -replace '/', '\')))
  if (-not $file.StartsWith($Root + '\') -or -not (Test-Path -LiteralPath $file -PathType Leaf)) { return $null }
  return $file
}

function Get-Type([string]$file) {
  $type = $Types[[System.IO.Path]::GetExtension($file).ToLowerInvariant()]
  if ($type) { return $type }
  return 'application/octet-stream'
}

function Serve-WithHttpListener {
  $listener = [System.Net.HttpListener]::new()
  $listener.Prefixes.Add("http://localhost:$Port/")
  $listener.Start()
  Start-Message
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $response = $context.Response
    try {
      $file = Resolve-GameFile $context.Request.RawUrl
      if ($null -eq $file) {
        $response.StatusCode = 404
      } else {
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $response.ContentType = Get-Type $file
        $response.AddHeader('Cache-Control', 'no-cache')
        $response.ContentLength64 = $bytes.Length
        if ($context.Request.HttpMethod -ne 'HEAD') { $response.OutputStream.Write($bytes, 0, $bytes.Length) }
      }
    } catch {
      # a file that could not be read, or a browser that closed the connection early; the next request goes on
      try { $response.StatusCode = 500 } catch { }
    } finally {
      try { $response.Close() } catch { }
    }
  }
}

function Send-Raw($stream, [int]$code, [string]$reason, [string]$type, [byte[]]$body, [bool]$head) {
  $header = "HTTP/1.1 $code $reason`r`nContent-Type: $type`r`nContent-Length: $($body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
  $bytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $stream.Write($bytes, 0, $bytes.Length)
  if (-not $head -and $body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
}

function Serve-WithTcp {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
  $listener.Start()
  Start-Message
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $client.ReceiveTimeout = 1000
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 4096, $true)
      $requestLine = $reader.ReadLine()
      while ($true) { $line = $reader.ReadLine(); if ($null -eq $line -or $line -eq '') { break } }
      if ($requestLine) {
        $parts = $requestLine.Split(' ')
        $head = $parts[0] -eq 'HEAD'
        $file = Resolve-GameFile $parts[1]
        if ($null -eq $file) {
          Send-Raw $stream 404 'Not Found' 'text/plain' ([System.Text.Encoding]::ASCII.GetBytes('Not found')) $head
        } else {
          Send-Raw $stream 200 'OK' (Get-Type $file) ([System.IO.File]::ReadAllBytes($file)) $head
        }
      }
    } catch {
      # an idle or closed connection; the next request goes on
    } finally {
      $client.Close()
    }
  }
}

function Start-Message {
  $script:Started = $true
  Write-Host 'Pianor is running. Keep this window open while you play; close it to stop Pianor.'
  Write-Host "Address: $Url"
  Open-Game
}

if (-not (Test-Path -LiteralPath (Join-Path $Root 'index.html'))) {
  Write-Host "The game files are missing: expected $Root\index.html. Unpack the whole zip again."
  Read-Host 'Press Enter to close'
  exit 1
}

$probe = [System.Net.Sockets.TcpClient]::new()
$busy = $true
try { $probe.Connect('127.0.0.1', $Port) } catch { $busy = $false }
$probe.Close()
if ($busy) {
  # Pianor already serving (a second double-click): open another window on it. Another program on the port: say so.
  $ours = $false
  try { $ours = (Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 "http://localhost:$Port/").Content -match '<title>Pianor</title>' } catch { }
  if ($ours) { Open-Game; exit 0 }
  Write-Host "Another program uses port $Port, so Pianor cannot start. Close that program, or restart the computer, and try again."
  Read-Host 'Press Enter to close'
  exit 1
}

$script:Started = $false
try { Serve-WithHttpListener } catch { if ($script:Started) { throw }; Serve-WithTcp }
