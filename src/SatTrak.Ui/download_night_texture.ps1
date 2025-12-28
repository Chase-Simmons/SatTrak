$dest = "public/textures/8k_earth_nightmap.jpg"
$url = "https://upload.wikimedia.org/wikipedia/commons/b/ba/The_earth_at_night.jpg"

if (!(Test-Path $dest)) {
    Write-Host "Downloading Night Map..."
    Invoke-WebRequest -Uri $url -OutFile $dest
    Write-Host "Done."
}
else {
    Write-Host "File exists."
}
