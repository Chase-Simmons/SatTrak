const fs = require('fs');
const path = require('path');

const cesiumSource = path.join(__dirname, 'node_modules', 'cesium', 'Build', 'Cesium');
const cesiumDest = path.join(__dirname, 'public', 'cesium');

const directoriesToCopy = ['Workers', 'ThirdParty', 'Assets', 'Widgets'];

console.log('Copying Cesium assets...');

if (!fs.existsSync(cesiumDest)) {
    fs.mkdirSync(cesiumDest, { recursive: true });
}

directoriesToCopy.forEach((dir) => {
    const src = path.join(cesiumSource, dir);
    const dest = path.join(cesiumDest, dir);
    
    if (fs.existsSync(src)) {
        fs.cpSync(src, dest, { recursive: true, force: true });
        console.log(`Copied ${dir} to public/cesium/${dir}`);
    } else {
        console.warn(`Warning: Source directory ${src} not found.`);
    }
});

console.log('Cesium assets copied successfully.');
