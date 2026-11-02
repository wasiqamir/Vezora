$ErrorActionPreference = "Stop"
$root = [System.IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
if (-not $root.EndsWith("\")) { $root += "\" }

$prefix = "http://127.0.0.1:4173/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Output "LISTENING ${prefix}preview/"

$types = @{
    ".html" = "text/html; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".json" = "application/json"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "text/javascript; charset=utf-8"
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        try {
            $relative = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath).TrimStart("/")
            if ([string]::IsNullOrWhiteSpace($relative)) { $relative = "preview/index.html" }
            if ($relative.EndsWith("/")) { $relative += "index.html" }
            $full = [System.IO.Path]::GetFullPath((Join-Path $root ($relative -replace "/", "\")))
            if (-not $full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $full -PathType Leaf)) {
                $context.Response.StatusCode = 404
                $message = [Text.Encoding]::UTF8.GetBytes("Not found")
                $context.Response.OutputStream.Write($message, 0, $message.Length)
            } else {
                $bytes = [System.IO.File]::ReadAllBytes($full)
                $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
                $context.Response.ContentType = $(if ($types.ContainsKey($ext)) { $types[$ext] } else { "application/octet-stream" })
                $context.Response.ContentLength64 = $bytes.Length
                $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
        } catch {
            $context.Response.StatusCode = 500
        } finally {
            $context.Response.Close()
        }
    }
} finally {
    $listener.Stop()
}
