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
 * - "year:2024" -> Filters by launch year (from TLE Line 1)
 * - "country:USA" -> Maps to common owner prefixes
 * - "A OR B" -> Multiple groups
 */
export const filterSatellites = (tles: SatelliteTle[], query: string): SatelliteTle[] => {
    if (!query || query.trim() === "") return tles;

    let processingQuery = query.trim();
    let limit = -1;
    let skip = 0;
    let targetYear = -1;

    // 1. Extract limit:N
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

    // 3. Extract Year/Launch:YYYY
    const yearMatch = processingQuery.match(/(?:year|launch):(\d{2,4})/i);
    if (yearMatch) {
        const val = parseInt(yearMatch[1], 10);
        targetYear = val > 100 ? val : (val > 50 ? 1900 + val : 2000 + val);
        processingQuery = processingQuery.replace(yearMatch[0], "").trim();
    }

    // 4. Extract Smart Keywords
    const orbitKeywords = ["LEO", "GEO", "MEO"];
    const typeKeywords = ["DEBRIS", "ROCKET", "ROCKETS"];
    const constellationAliases: Record<string, string[]> = {
        "GPS": ["NAVSTAR"],
        "BEIDOU": ["BDS", "COMPASS"],
        "TIANGONG": ["CSS", "TIANHE", "WENTIAN", "MENGTIAN"],
        "CSS": ["TIANGONG"],
        // Nations & Orgs
        "USA": ["NAVSTAR", "USA-", "USA ", "SPACE FENCE", "ORBCOMM", "GLOBALSTAR", "GOES", "NOAA"],
        "RUSSIA": ["COSMOS", "GLONASS", "GONETS", "MOLNIYA", "EKS"],
        "CHINA": ["BDS", "CSS", "YAOGAN", "TIANGONG", "CHINASAT"],
        "INDIA": ["IRNSS", "INSAT", "CARTOSAT", "GSAT"],
        "JAPAN": ["QZSS", "HIMAWARI", "ALOS"],
        "EUROPE": ["GALILEO", "SENTINEL", "METEOSAT", "ENVISAT"],
        // Commercial
        "TELESAT": ["ANIK", "ELITE"],
        "GLOBALSTAR": ["GLOBALSTAR"],
        "ONEWEB": ["ONEWEB"],
        "STARLINK": ["STARLINK"],
        "IRIDIUM": ["IRIDIUM"],
        // Military & Specialized
        "MILITARY": ["USA-", "USA ", "COSMOS", "YAOGAN", "LACROSSE", "NROL", "SECRET", "EKS"],
        "NROL": ["NRO", "USA-", "USA "],
        "TUNDRA": ["EKS"],
        "MOLNIYA": ["MOLNIYA"],
    };
    
    const activeOrbits: string[] = [];
    const activeTypes: string[] = [];

    let cleanQuery = processingQuery;

    orbitKeywords.forEach(k => {
        const regex = new RegExp(`\\b${k}\\b`, 'i');
        if (regex.test(cleanQuery)) {
            activeOrbits.push(k.toUpperCase());
            cleanQuery = cleanQuery.replace(regex, "").trim();
        }
    });

    typeKeywords.forEach(k => {
        const regex = new RegExp(`\\b${k}\\b`, 'i');
        if (regex.test(cleanQuery)) {
            if (k.toUpperCase().startsWith("DEB")) activeTypes.push("DEBRIS");
            if (k.toUpperCase().startsWith("ROCK")) activeTypes.push("ROCKET");
            cleanQuery = cleanQuery.replace(regex, "").trim();
        }
    });

    // Strip explicit "AND"
    cleanQuery = cleanQuery.replace(/\bAND\b/gi, " ").replace(/\s+/g, " ").trim();

    if (!cleanQuery && activeOrbits.length === 0 && activeTypes.length === 0 && targetYear === -1) {
        const start = skip > 0 ? skip : 0;
        const end = limit > 0 ? start + limit : undefined;
        return tles.slice(start, end);
    }

    const unionGroups = cleanQuery.split(/\s+OR\s+/i);

    const filtered = tles.filter(sat => {
        const name = (sat.name || "").toUpperCase();
        const id = sat.id.toString();
        const line1 = sat.line1 || "";
        const line2 = sat.line2 || "";

        // A. Year Filter
        if (targetYear !== -1) {
            const yrStr = line1.substring(9, 11).trim();
            if (!yrStr) return false;
            const yrVal = parseInt(yrStr, 10);
            const satYear = yrVal > 50 ? 1900 + yrVal : 2000 + yrVal;
            if (satYear !== targetYear) return false;
        }

        // B. Smart Type Filter (Loosened for dataset reliability)
        if (activeTypes.length > 0) {
            const isDebris = name.includes("DEB") || name.includes("DEBRIS") || name.includes("-DEB");
            const isRocket = name.includes("R/B") || name.includes("ROCKET") || name.includes("BREEZE") || name.includes("FREGAT") || name.includes("DELTA") || name.includes("ATLAS") || name.includes("TITAN");
            
            const matchesType = activeTypes.some(t => {
                if (t === "DEBRIS") return isDebris;
                if (t === "ROCKET") return isRocket;
                return false;
            });
            if (!matchesType) return false;
        }

        // C. Smart Orbit Filter
        if (activeOrbits.length > 0) {
            const mm = parseFloat(line2.substring(52, 63).trim());
            const matchesOrbit = activeOrbits.some(type => {
                if (isNaN(mm)) return false;
                if (type === 'LEO') return mm > 11.25; 
                if (type === 'GEO') return mm > 0.98 && mm < 1.02;
                if (type === 'MEO') return mm > 1.02 && mm <= 11.25;
                return false;
            });
            if (!matchesOrbit) return false;
        }

        // D. Text/Alias Search
        if (cleanQuery.length === 0) return true;

        return unionGroups.some(group => {
            const terms = group.trim().split(/\s+/).filter(t => t.length > 0);
            return terms.every(term => {
                const upperTerm = term.toUpperCase();
                // 1. Direct match
                if (name.includes(upperTerm) || id.includes(upperTerm)) return true;
                
                // 2. Dash/Space variation for USA/COSMOS
                if (upperTerm.includes("-")) {
                    const spaced = upperTerm.replace("-", " ");
                    if (name.includes(spaced)) return true;
                }
                if (upperTerm === "USA-") {
                     if (name.includes("USA ")) return true;
                }

                // 3. Alias match
                const aliases = constellationAliases[upperTerm];
                if (aliases) return aliases.some(alias => name.includes(alias.toUpperCase()));
                return false;
            });
        });
    });

    const start = skip > 0 ? skip : 0;
    const end = limit > 0 ? start + limit : undefined;
    return filtered.slice(start, end);
};
