$dest = "public/textures/8k_earth_clouds.jpg"
$url = "https://www.solarsystemscope.com/textures/download/8k_earth_clouds.jpg"

Write-Host "Downloading Cloud Map..."
# Force overwrite, spoof User-Agent to avoid 403
Invoke-WebRequest -Uri $url -OutFile $dest -UserAgent "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
Write-Host "Done."
