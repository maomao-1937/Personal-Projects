Add-Type -AssemblyName System.Drawing

$outputDir = Join-Path $PSScriptRoot '..\public\icons'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

function New-RoundedPath([single]$x, [single]$y, [single]$width, [single]$height, [single]$radius) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = 2 * $radius
  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

foreach ($size in @(192, 512)) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.ScaleTransform($size / 512, $size / 512)

  $background = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.Point]::new(0, 0),
    [System.Drawing.Point]::new(512, 512),
    [System.Drawing.ColorTranslator]::FromHtml('#1d4748'),
    [System.Drawing.ColorTranslator]::FromHtml('#10242e')
  )
  $graphics.FillRectangle($background, 0, 0, 512, 512)
  $background.Dispose()

  $tiles = @(
    @{ X = 137; Y = 137; Color = '#e8f6ef' },
    @{ X = 262; Y = 137; Color = '#69c2ac' },
    @{ X = 137; Y = 262; Color = '#a5ded0' },
    @{ X = 262; Y = 262; Color = '#ffbd77' }
  )
  foreach ($tile in $tiles) {
    $path = New-RoundedPath $tile.X $tile.Y 112 112 22
    $brush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($tile.Color))
    $graphics.FillPath($brush, $path)
    $brush.Dispose()
    $path.Dispose()
  }

  $bitmap.Save((Join-Path $outputDir "icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}
