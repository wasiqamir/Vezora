$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot "files"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function New-Canvas([int]$Width, [int]$Height, [bool]$Transparent) {
    $format = [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    $bitmap = New-Object System.Drawing.Bitmap $Width, $Height, $format
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    if ($Transparent) {
        $graphics.Clear([System.Drawing.Color]::Transparent)
    } else {
        $graphics.Clear([System.Drawing.Color]::White)
    }
    return [pscustomobject]@{ Bitmap = $bitmap; Graphics = $graphics }
}

function Convert-HexColor([string]$Hex) {
    return [System.Drawing.ColorTranslator]::FromHtml($Hex)
}

function Draw-Label($Graphics, [string]$Text, [single]$X, [single]$Y, [single]$Size, [System.Drawing.FontStyle]$Style, [System.Drawing.Color]$Color) {
    $font = New-Object System.Drawing.Font "Segoe UI", $Size, $Style, ([System.Drawing.GraphicsUnit]::Pixel)
    $brush = New-Object System.Drawing.SolidBrush $Color
    try {
        $Graphics.DrawString($Text, $font, $brush, $X, $Y)
    } finally {
        $font.Dispose()
        $brush.Dispose()
    }
}

function Save-Png($Bitmap, [string]$Name) {
    $path = Join-Path $outDir $Name
    $Bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Save-Jpeg($Bitmap, [string]$Name, [long]$Quality) {
    $path = Join-Path $outDir $Name
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
    $encoder = [System.Drawing.Imaging.Encoder]::Quality
    $parameters = New-Object System.Drawing.Imaging.EncoderParameters 1
    $parameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter $encoder, $Quality
    $Bitmap.Save($path, $codec, $parameters)
    $parameters.Dispose()
}

function Draw-Multicolor($Graphics) {
    $green = New-Object System.Drawing.SolidBrush (Convert-HexColor "#1F7A4D")
    $orange = New-Object System.Drawing.SolidBrush (Convert-HexColor "#E07A3D")
    $yellow = New-Object System.Drawing.SolidBrush (Convert-HexColor "#F2C14E")
    try {
        $Graphics.FillEllipse($green, 90, 300, 260, 260)
        $Graphics.FillEllipse($yellow, 244, 324, 72, 72)
        $Graphics.FillRectangle($orange, 140, 500, 160, 36)
    } finally {
        $green.Dispose()
        $orange.Dispose()
        $yellow.Dispose()
    }
    $ink = Convert-HexColor "#1B3A4B"
    $accent = Convert-HexColor "#E07A3D"
    Draw-Label $Graphics "PINE" 430 360 120 ([System.Drawing.FontStyle]::Bold) $ink
    Draw-Label $Graphics "GOODS" 436 500 36 ([System.Drawing.FontStyle]::Regular) $accent
}

function New-MulticolorBitmap {
    $canvas = New-Canvas 1000 1000 $false
    try {
        Draw-Multicolor $canvas.Graphics
        return $canvas.Bitmap
    } finally {
        $canvas.Graphics.Dispose()
    }
}

$mono = New-Canvas 1000 1000 $false
try {
    $black = New-Object System.Drawing.SolidBrush (Convert-HexColor "#111111")
    try {
        $mono.Graphics.FillEllipse($black, 110, 360, 280, 280)
    } finally {
        $black.Dispose()
    }
    $ink = Convert-HexColor "#111111"
    Draw-Label $mono.Graphics "NORTH" 440 410 92 ([System.Drawing.FontStyle]::Bold) $ink
    Draw-Label $mono.Graphics "STUDIO" 446 520 28 ([System.Drawing.FontStyle]::Regular) $ink
    Save-Png $mono.Bitmap "01-monochrome.png"
} finally {
    $mono.Graphics.Dispose()
    $mono.Bitmap.Dispose()
}

$multi = New-MulticolorBitmap
try {
    Save-Png $multi "02-multicolor.png"
} finally {
    $multi.Dispose()
}

$textHeavy = New-Canvas 1600 800 $false
try {
    $navy = Convert-HexColor "#14213D"
    $gold = Convert-HexColor "#C5A46E"
    $muted = Convert-HexColor "#5C6B73"
    Draw-Label $textHeavy.Graphics "HARBOR" 120 180 140 ([System.Drawing.FontStyle]::Bold) $navy
    Draw-Label $textHeavy.Graphics "LEGAL GROUP" 124 340 48 ([System.Drawing.FontStyle]::Regular) $navy
    $pen = New-Object System.Drawing.Pen $gold, 4
    try {
        $textHeavy.Graphics.DrawLine($pen, 120, 430, 980, 430)
    } finally {
        $pen.Dispose()
    }
    Draw-Label $textHeavy.Graphics "ADVISORY    CONTRACTS    DISPUTES" 120 470 28 ([System.Drawing.FontStyle]::Regular) $muted
    Save-Png $textHeavy.Bitmap "03-text-heavy.png"
} finally {
    $textHeavy.Graphics.Dispose()
    $textHeavy.Bitmap.Dispose()
}

$transparent = New-Canvas 1000 1000 $true
try {
    $kite = @(
        (New-Object System.Drawing.Point 500, 180),
        (New-Object System.Drawing.Point 760, 460),
        (New-Object System.Drawing.Point 500, 820),
        (New-Object System.Drawing.Point 240, 460)
    )
    $blue = New-Object System.Drawing.SolidBrush (Convert-HexColor "#0F62FE")
    try {
        $transparent.Graphics.FillPolygon($blue, $kite)
    } finally {
        $blue.Dispose()
    }
    Draw-Label $transparent.Graphics "KITE" 400 430 72 ([System.Drawing.FontStyle]::Bold) ([System.Drawing.Color]::White)
    Save-Png $transparent.Bitmap "04-transparent.png"
} finally {
    $transparent.Graphics.Dispose()
    $transparent.Bitmap.Dispose()
}

$gradient = New-Canvas 1000 1000 $false
try {
    $bounds = New-Object System.Drawing.Rectangle 200, 150, 600, 600
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $bounds, (Convert-HexColor "#5B4BFF"), (Convert-HexColor "#2EC5FF"), 45
    try {
        $gradient.Graphics.FillEllipse($brush, $bounds)
    } finally {
        $brush.Dispose()
    }
    Draw-Label $gradient.Graphics "AURORA" 330 390 72 ([System.Drawing.FontStyle]::Bold) ([System.Drawing.Color]::White)
    Save-Png $gradient.Bitmap "05-gradient.png"
} finally {
    $gradient.Graphics.Dispose()
    $gradient.Bitmap.Dispose()
}

$source = New-MulticolorBitmap
$small = New-Object System.Drawing.Bitmap 96, 96
$smallGraphics = [System.Drawing.Graphics]::FromImage($small)
try {
    $smallGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $smallGraphics.Clear([System.Drawing.Color]::White)
    $smallGraphics.DrawImage($source, 0, 0, 96, 96)
    Save-Jpeg $small "06-low-resolution.jpg" 35
} finally {
    $smallGraphics.Dispose()
    $small.Dispose()
    $source.Dispose()
}

Write-Output "Wrote raster fixtures to $outDir"
