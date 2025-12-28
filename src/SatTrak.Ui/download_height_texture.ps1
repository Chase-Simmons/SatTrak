$dest = "public/textures/8k_earth_heightmap.jpg"
# Using a known reliable source for height/bump maps (NASA or wikimedia)
$url = "https://upload.wikimedia.org/wikipedia/commons/1/15/Srtm_ramp2.world.21600x10800.jpg" 
# That file is HUGE. Let's use a standard 4k/8k bump map.
$url = "https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73934/gebco_08_rev_elev_21600x10800.png"
# Still huge.
# Let's try the standard Three.js example bump map or similar.
$url = "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_normal_2048.jpg"
# Normal map is different from height map but we can use it for lighting.
# User asked for "Height". Displacement needs grayscale height.
$url = "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Srtm_ramp2.world.21600x10800.jpg/4096px-Srtm_ramp2.world.21600x10800.jpg"
# This is a color ramp (Topo). Not grayscale height.
# Let's try downloading the "Specular Map" which is often grayscale water mask.
# Actually, for "Depth", a Normal Map is better for lighting "flatness".
# A Displacement Map (Vertex) creates real bumps.
# Let's try to get the 8k_earth_normal_map.jpg properly this time.
$url = "https://www.solarsystemscope.com/textures/download/8k_earth_normal_map.jpg"
# This site might block scripted downloads or be slow.
# Let's try a safe github mirror.
$url = "https://github.com/SimulaVR/Simula/raw/master/addons/godot-openxr/scenes/Earth_Normal.jpg"

if (!(Test-Path $dest)) {
    Write-Host "Downloading Normal/Height Map..."
    Invoke-WebRequest -Uri $url -OutFile $dest
    Write-Host "Done."
}
else {
    Write-Host "File exists."
}
