Add-Type -AssemblyName System.Drawing

function New-Color([string]$hex, [int]$alpha = 255) {
  $clean = $hex.TrimStart('#')
  return [System.Drawing.Color]::FromArgb(
    $alpha,
    [Convert]::ToInt32($clean.Substring(0, 2), 16),
    [Convert]::ToInt32($clean.Substring(2, 2), 16),
    [Convert]::ToInt32($clean.Substring(4, 2), 16)
  )
}

function New-RoundedRectPath([float]$x, [float]$y, [float]$width, [float]$height, [float]$radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $radius * 2

  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Add-GlowCircle($graphics, [float]$x, [float]$y, [float]$size, [string]$hex, [int]$alpha) {
  $brush = New-Object System.Drawing.SolidBrush (New-Color $hex $alpha)
  $graphics.FillEllipse($brush, $x, $y, $size, $size)
  $brush.Dispose()
}

function Draw-LinkGlyph($graphics, [float]$cx, [float]$cy, [float]$scale, [bool]$lightMode = $false) {
  $penAColor = if ($lightMode) { New-Color '#0E7490' } else { New-Color '#7DD3FC' }
  $penBColor = if ($lightMode) { New-Color '#1D4ED8' } else { New-Color '#38BDF8' }
  $strokeWidth = [float](28 * $scale)

  $state = $graphics.Save()
  $graphics.TranslateTransform($cx, $cy)

  $penA = [System.Drawing.Pen]::new($penAColor, $strokeWidth)
  $penA.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $penA.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.RotateTransform(-33)
  $graphics.DrawRoundedRectangle($penA, -185 * $scale, -84 * $scale, 210 * $scale, 168 * $scale, 72 * $scale)

  $graphics.ResetTransform()
  $graphics.TranslateTransform($cx, $cy)
  $penB = [System.Drawing.Pen]::new($penBColor, $strokeWidth)
  $penB.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $penB.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.RotateTransform(33)
  $graphics.DrawRoundedRectangle($penB, -25 * $scale, -84 * $scale, 210 * $scale, 168 * $scale, 72 * $scale)

  $penA.Dispose()
  $penB.Dispose()
  $graphics.Restore($state)
}

Update-TypeData -TypeName System.Drawing.Graphics -MemberType ScriptMethod -MemberName DrawRoundedRectangle -Value {
  param($pen, [float]$x, [float]$y, [float]$width, [float]$height, [float]$radius)
  $path = New-RoundedRectPath $x $y $width $height $radius
  $this.DrawPath($pen, $path)
  $path.Dispose()
} -Force

function Draw-BubbleLogo($graphics, [float]$x, [float]$y, [float]$size, [bool]$transparentBubble = $false) {
  $shadowBrush = New-Object System.Drawing.SolidBrush (New-Color '#020817' 42)
  $bubbleColor = if ($transparentBubble) { New-Color '#F8FAFC' 232 } else { New-Color '#F8FAFC' }
  $bubbleBrush = New-Object System.Drawing.SolidBrush $bubbleColor
  $tailBrush = New-Object System.Drawing.SolidBrush $bubbleColor
  $badgeBrush = New-Object System.Drawing.SolidBrush (New-Color '#22D3EE')

  $shadowPath = New-RoundedRectPath ($x + 18) ($y + 28) $size ($size * 0.68) ($size * 0.19)
  $graphics.FillPath($shadowBrush, $shadowPath)

  $bubblePath = New-RoundedRectPath $x $y $size ($size * 0.68) ($size * 0.19)
  $graphics.FillPath($bubbleBrush, $bubblePath)

  $tail = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new([float]($x + $size * 0.28), [float]($y + $size * 0.68)),
    [System.Drawing.PointF]::new([float]($x + $size * 0.40), [float]($y + $size * 0.89)),
    [System.Drawing.PointF]::new([float]($x + $size * 0.48), [float]($y + $size * 0.68))
  )
  $graphics.FillPolygon($tailBrush, $tail)

  Draw-LinkGlyph $graphics ($x + $size * 0.50) ($y + $size * 0.34) ($size / 512) $false

  $graphics.FillEllipse($badgeBrush, $x + $size * 0.73, $y + $size * 0.08, $size * 0.14, $size * 0.14)

  $shadowPath.Dispose()
  $bubblePath.Dispose()
  $shadowBrush.Dispose()
  $bubbleBrush.Dispose()
  $tailBrush.Dispose()
  $badgeBrush.Dispose()
}

function New-Canvas([int]$size) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  return @{ Bitmap = $bitmap; Graphics = $graphics }
}

function Save-Png($bitmap, [string]$path) {
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

$assetsDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# App icon
$icon = New-Canvas 1024
$g = $icon.Graphics
$rect = New-Object System.Drawing.Rectangle 0, 0, 1024, 1024
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  $rect,
  (New-Color '#0B1736'),
  (New-Color '#0E5CAD'),
  45
)
$g.FillRectangle($bgBrush, $rect)
Add-GlowCircle $g 68 84 360 '#22D3EE' 48
Add-GlowCircle $g 670 670 260 '#60A5FA' 52
Add-GlowCircle $g 800 140 140 '#A5F3FC' 38

$linePen = New-Object System.Drawing.Pen((New-Color '#E0F2FE' 26), 12)
$linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$g.DrawLine($linePen, 170, 250, 855, 250)
$g.DrawLine($linePen, 210, 392, 820, 392)
$g.DrawLine($linePen, 145, 740, 632, 230)
$g.DrawLine($linePen, 405, 860, 860, 410)

$panelBrush = New-Object System.Drawing.SolidBrush (New-Color '#F8FAFC' 18)
$panelPath = New-RoundedRectPath 140 140 744 744 168
$g.FillPath($panelBrush, $panelPath)

Draw-BubbleLogo $g 222 246 580 $false

Save-Png $icon.Bitmap (Join-Path $assetsDir 'icon.png')

$panelPath.Dispose()
$panelBrush.Dispose()
$linePen.Dispose()
$bgBrush.Dispose()
$g.Dispose()
$icon.Bitmap.Dispose()

# Adaptive icon foreground
$adaptive = New-Canvas 1024
$ga = $adaptive.Graphics
Draw-BubbleLogo $ga 220 232 584 $true
Save-Png $adaptive.Bitmap (Join-Path $assetsDir 'adaptive-icon.png')
$ga.Dispose()
$adaptive.Bitmap.Dispose()

# Splash icon for centered placement
$splash = New-Canvas 1024
$gs = $splash.Graphics
Draw-BubbleLogo $gs 212 224 600 $true
Save-Png $splash.Bitmap (Join-Path $assetsDir 'splash-icon.png')
$gs.Dispose()
$splash.Bitmap.Dispose()

# Web favicon
$favicon = New-Canvas 256
$gf = $favicon.Graphics
$fRect = New-Object System.Drawing.Rectangle 0, 0, 256, 256
$fBg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  $fRect,
  (New-Color '#0B1736'),
  (New-Color '#0E5CAD'),
  45
)
$gf.FillRectangle($fBg, $fRect)
Add-GlowCircle $gf 8 14 92 '#22D3EE' 42
Add-GlowCircle $gf 176 172 56 '#60A5FA' 42
Draw-BubbleLogo $gf 44 60 148 $false
Save-Png $favicon.Bitmap (Join-Path $assetsDir 'favicon.png')
$fBg.Dispose()
$gf.Dispose()
$favicon.Bitmap.Dispose()
