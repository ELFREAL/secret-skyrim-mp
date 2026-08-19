param(
  [Parameter(Mandatory=$true)]
  [string]$SkyrimExe,

  [Parameter(Mandatory=$true)]
  [string]$OutputPng
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $SkyrimExe -PathType Leaf)) {
  throw "SkyrimSE.exe not found: $SkyrimExe"
}

Add-Type -AssemblyName System.Drawing

$icon = [System.Drawing.Icon]::ExtractAssociatedIcon($SkyrimExe)
if ($null -eq $icon) {
  throw "Windows could not extract icon from SkyrimSE.exe"
}

$src = $icon.ToBitmap()
$dst = New-Object System.Drawing.Bitmap 512, 512
$graphics = [System.Drawing.Graphics]::FromImage($dst)
$graphics.Clear([System.Drawing.Color]::Transparent)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.DrawImage($src, 0, 0, 512, 512)

$outDir = Split-Path -Parent $OutputPng
if ($outDir) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
$dst.Save($OutputPng, [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$dst.Dispose()
$src.Dispose()
$icon.Dispose()

Write-Host "Skyrim icon saved to: $OutputPng" -ForegroundColor Green
