$dest = "public/textures"
if (!(Test-Path $dest)) { New-Item -ItemType Directory -Force -Path $dest }

$files = @{
    "8k_earth_daymap.jpg" = "https://upload.wikimedia.org/wikipedia/commons/8/83/Equirectangular_projection_SW.jpg"
    "8k_earth_normal_map.jpg" = "https://upload.wikimedia.org/wikipedia/commons/c/c3/Aurora_as_seen_by_IMAGE.jpg" 
    "8k_earth_specular_map.jpg" = "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Black_white_earth_map.jpg/2560px-Black_white_earth_map.jpg"
}
# Note: These are rough approximations for "Specular" and "Normal" from public wiki sources just to get SOMETHING.
# Real 8k textures are usually hosted on dedicated texture sites which might block automated wget. 
# I will use these basic ones as placeholders.

foreach ($file in $files.Keys) {
    $url = $files[$file]
    $out = Join-Path $dest $file
    Write-Host "Downloading $file..."
    Invoke-WebRequest -Uri $url -OutFile $out
}
Write-Host "Done."
