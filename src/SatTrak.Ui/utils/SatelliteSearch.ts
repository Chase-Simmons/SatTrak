import { SatelliteTle } from "../hooks/useSatelliteStore";

/**
 * Filter satellites based on advanced query syntax.
 * Simple Syntax:
 * - "Starlink" -> Simple search
 * - "LEO", "GEO", "MEO" -> Smart orbit filters
 * - "DEBRIS", "ROCKET" -> Metadata filters
 * - "limit:100" -> Caps results
 * 
 * Advanced Syntax:
 * - "A OR B" -> Multiple groups
 */
export const filterSatellites = (tles: SatelliteTle[], query: string): SatelliteTle[] => {
    if (!query || query.trim() === "") return tles;

    let processingQuery = query.trim();
    let limit = -1;
    let skip = 0;

    // 1. Extract limit:N (alias for FIRST)
    const limitMatch = processingQuery.match(/limit:(\d+)/i) || processingQuery.match(/FIRST\s+(\d+)/i);
    if (limitMatch) {
        limit = parseInt(limitMatch[1], 10);
        processingQuery = processingQuery.replace(limitMatch[0], "").trim();
    }

    // 2. Extract SKIP {N}
    const skipMatch = processingQuery.match(/SKIP\s+(\d+)/i);
    if (skipMatch) {
        skip = parseInt(skipMatch[1], 10);
        processingQuery = processingQuery.replace(skipMatch[0], "").trim();
    }

    // 3. Extract Smart Keywords
    const orbitKeywords = ["LEO", "GEO", "MEO"];
    const typeKeywords = ["DEBRIS", "ROCKET"];
    
    const activeOrbits: string[] = [];
    const activeTypes: string[] = [];

    orbitKeywords.forEach(k => {
        if (new RegExp(`\\b${k}\\b`, 'i').test(processingQuery)) {
            activeOrbits.push(k.toUpperCase());
            processingQuery = processingQuery.replace(new RegExp(`\\b${k}\\b`, 'i'), "").trim();
        }
    });

    typeKeywords.forEach(k => {
        if (new RegExp(`\\b${k}\\b`, 'i').test(processingQuery)) {
            activeTypes.push(k.toUpperCase());
            processingQuery = processingQuery.replace(new RegExp(`\\b${k}\\b`, 'i'), "").trim();
        }
    });

    if (!processingQuery && activeOrbits.length === 0 && activeTypes.length === 0) {
        const start = skip > 0 ? skip : 0;
        const end = limit > 0 ? start + limit : undefined;
        return tles.slice(start, end);
    }

    // Split remaining query by OR
    const unionGroups = processingQuery.split(/\s+OR\s+/i);

    const filtered = tles.filter(sat => {
        const name = (sat.name || "").toUpperCase();
        const id = sat.id.toString();
        const line2 = sat.line2 || "";

        // A. Smart Type Filter
        if (activeTypes.length > 0) {
            const isDebris = name.includes("DEB") || name.includes(" DEBRIS");
            const isRocket = name.includes("R/B") || name.includes("ROCKET");
            
            const matchesType = activeTypes.some(t => {
                if (t === "DEBRIS") return isDebris;
                if (t === "ROCKET") return isRocket;
                return false;
            });
            if (!matchesType) return false;
        }

        // B. Smart Orbit Filter (Mean Motion extraction)
        if (activeOrbits.length > 0) {
            const mmStr = line2.substring(52, 63).trim();
            const mm = parseFloat(mmStr);
            const matchesOrbit = activeOrbits.some(type => {
                if (isNaN(mm)) return false;
                if (type === 'LEO') return mm > 11.25; 
                if (type === 'GEO') return mm > 0.98 && mm < 1.02;
                if (type === 'MEO') return mm > 1.02 && mm <= 11.25;
                return false;
            });
            if (!matchesOrbit) return false;
        }

        // C. Substring Search (if any terms left)
        if (processingQuery.trim().length === 0) return true;

        return unionGroups.some(group => {
            const cleanGroup = group.replace(/\s+AND\s+/i, " ");
            const terms = cleanGroup.trim().split(/\s+/).filter(t => t.length > 0);
            return terms.every(term => {
                const upperTerm = term.toUpperCase();
                return name.includes(upperTerm) || id.includes(upperTerm);
            });
        });
    });

    const start = skip > 0 ? skip : 0;
    const end = limit > 0 ? start + limit : undefined;
    return filtered.slice(start, end);
};
