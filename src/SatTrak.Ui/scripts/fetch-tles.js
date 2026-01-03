const fs = require('fs');
const path = require('path');
const https = require('https');

// CelesTrak GP Data (Active Satellites)
const CELESTRAK_URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle';
const OUTPUT_FILE = path.join(__dirname, '../public/tles.json');

console.log(`Fetching TLE data from: ${CELESTRAK_URL}`);

https.get(CELESTRAK_URL, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log(`Download complete. Parsing ${data.length} bytes...`);
        
        const lines = data.split('\n');
        const satellites = [];

        // Parse TLEs (3 lines per record: Name, Line1, Line2)
        // Note: CelesTrak GP TLEs sometimes have headers, but usually follow standard 3-line format for "TLE" format request
        // Current format from URL is likely raw TLE.
        
        let i = 0;
        while (i < lines.length) {
            let name = lines[i].trim();
            // Skip empty lines
            if (!name) {
                i++;
                continue;
            }

            // Ensure we have at least 3 lines left
            if (i + 2 >= lines.length) break;

            const line1 = lines[i+1].trim();
            const line2 = lines[i+2].trim();

            // Basic validation
            if (line1.startsWith('1 ') && line2.startsWith('2 ')) {
                // Extract ID from Line 1 (cols 3-7)
                const id = parseInt(line1.substring(2, 7), 10);
                
                satellites.push({
                    id: id,
                    name: name,
                    line1: line1,
                    line2: line2
                });
                i += 3;
            } else {
                // Formatting might be off or it's a header, skip line
                i++;
            }
        }

        console.log(`Parsed ${satellites.length} satellites.`);
        
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(satellites, null, 2));
        console.log(`Saved to: ${OUTPUT_FILE}`);
    });

}).on('error', (err) => {
    console.error('Error fetching TLEs:', err.message);
    process.exit(1);
});
