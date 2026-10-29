$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$extensionRoot = Join-Path $projectRoot 'extension'
$distRoot = Join-Path $projectRoot 'dist'
New-Item -ItemType Directory -Force -Path $distRoot | Out-Null
$manifest = Get-Content -LiteralPath (Join-Path $extensionRoot 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$destination = Join-Path $distRoot ("apply-assistant-" + $manifest.version + '.zip')
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archiveStream = [System.IO.File]::Open($destination, [System.IO.FileMode]::Create)
$archive = [System.IO.Compression.ZipArchive]::new($archiveStream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in Get-ChildItem -LiteralPath $extensionRoot -Recurse -File) {
    $relative = $file.FullName.Substring($extensionRoot.Length + 1).Replace('\', '/')
    if ($relative -eq 'local-profile-preset.js') { continue }
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, ('extension/' + $relative)) | Out-Null
  }
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $projectRoot 'LICENSE'), 'LICENSE') | Out-Null
} finally { $archive.Dispose() }
$sha = [System.Security.Cryptography.SHA256]::Create()
$stream = [System.IO.File]::OpenRead($destination)
try { $hash = [System.BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
finally { $stream.Dispose(); $sha.Dispose() }
Write-Output "Package: $destination"
Write-Output "SHA256: $hash"
