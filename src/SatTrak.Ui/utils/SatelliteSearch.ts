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
    const orbitKeywords = ["LEO", "GEO", "MEO", "HEO", "TUNDRA", "MOLNIYA"];
    const typeKeywords = ["DEBRIS", "ROCKET", "ROCKETS", "TBA"];
    const constellationAliases: Record<string, string[]> = {
        "GPS": ["NAVSTAR", "GPS"],
        "BEIDOU": ["BDS", "COMPASS"],
        "TIANGONG": ["CSS", "TIANHE", "WENTIAN", "MENGTIAN", "TIANGONG"],
        "CSS": ["TIANHE", "WENTIAN", "MENGTIAN"],
        "STATION": ["ISS", "ZARYA", "TIANGONG", "CSS", "SKYLAB", "MIR", "STATION"],
        // Nations & Orgs
        "USA": ["NAVSTAR", "USA-", "USA ", "SPACE FENCE", "ORBCOMM", "GLOBALSTAR", "GOES", "NOAA", "OSCAR", "TRANSIT"],
        "RUSSIA": ["COSMOS", "GLONASS", "GONETS", "MOLNIYA", "EKS", "GORIZONT", "RADUGA", "ZARYA"],
        "CHINA": ["BDS", "CSS", "YAOGAN", "TIANGONG", "CHINASAT", "QIANFAN"],
        "INDIA": ["IRNSS", "INSAT", "CARTOSAT", "GSAT"],
        "JAPAN": ["QZS", "HIMAWARI", "ALOS", "JCSAT"],
        "EUROPE": ["GALILEO", "SENTINEL", "METEOSAT", "ENVISAT", "EUTELSAT"],
        // Commercial
        "TELESAT": ["ANIK", "ELITE", "TELESAT"],
        "GLOBALSTAR": ["GLOBALSTAR"],
        "ONEWEB": ["ONEWEB"],
        "STARLINK": ["STARLINK"],
        "IRIDIUM": ["IRIDIUM"],
        "O3B": ["O3B"],
        "KUIPER": ["KUIPER"],
        "FLOCK": ["FLOCK", "DOVE"],
        "LEMUR": ["LEMUR"],
        "ORBCOMM": ["ORBCOMM"],
        "GALAXY": ["GALAXY"],
        "JCSAT": ["JCSAT"],
        "INTELSAT": ["INTELSAT"],
        "SES": ["SES", "AMC"],
        "EUTELSAT": ["EUTELSAT", "HOTBIRD"],
        "INMARSAT": ["INMARSAT"],
        "HISPASAT": ["HISPASAT"],
        "TURKSAT": ["TURKSAT"],
        // Military & Specialized
        "MILITARY": ["USA-", "USA ", "COSMOS", "YAOGAN", "LACROSSE", "NROL", "SECRET", "EKS", "R/B", "DEB"], // R/B often classified initially
        "NROL": ["NRO", "USA-", "USA "],
        "NAVY": ["TRANSIT", "NNSS", "NOVA", "OSCAR"],
        "TUNDRA": ["EKS", "TUNDRA"],
        "MOLNIYA": ["MOLNIYA"],
        "GORIZONT": ["GORIZONT"],
        "RADUGA": ["RADUGA"],
        "TDRS": ["TDRS", "LDRS"],
        "NEEDLE": ["WESTFORD", "NEEDLE"],
        "QZS": ["QZS", "QZSS"], // Catches QZS-1 and QZSS
        "TBA": ["TBA", "OBJECT A", "OBJECT B", "OBJECT C", "UNKNOWN"],
        // Science & Utility
        "WEATHER": ["NOAA", "GOES", "METEOR", "METEOSAT", "FENGYUN", "HIMAWARI", "ELEKTRO"],
        "SAR": ["SARSAT", "COSPAS"], // Search And Rescue
        "DISASTER": ["DMC", "DISASTER"],
        "EARTH": ["LANDSAT", "SENTINEL", "TERRA", "AQUA", "ENVISAT", "ERS-", "SPOT", "RADARSAT", "JASON"],
        "EXPERIMENTAL": ["EXP", "TECHDEMO", "TEST", "CUBESAT"],
        "TV": ["DIRECTV", "ASTRA", "SIRIUS", "XM", "DISH", "SKY"],
    };
    
    const activeOrbits: string[] = [];
    const activeTypes: string[] = [];
    const activeAliases: string[] = [];

    let cleanQuery = processingQuery;

    // 4. Extract Orbits
    orbitKeywords.forEach(k => {
        const regex = new RegExp(`\\b${k}\\b`, 'i');
        if (regex.test(cleanQuery)) {
            activeOrbits.push(k.toUpperCase());
            cleanQuery = cleanQuery.replace(regex, "").trim();
        }
    });

    // 5. Extract Types
    typeKeywords.forEach(k => {
        const regex = new RegExp(`\\b${k}\\b`, 'i');
        if (regex.test(cleanQuery)) {
            if (k.toUpperCase().startsWith("DEB")) activeTypes.push("DEBRIS");
            if (k.toUpperCase().startsWith("ROCK")) activeTypes.push("ROCKET");
            if (k.toUpperCase() === "TBA") activeTypes.push("TBA");
            cleanQuery = cleanQuery.replace(regex, "").trim();
        }
    });

    // 6. Extract Aliases (Greedy)
    const aliasKeys = Object.keys(constellationAliases);
    aliasKeys.forEach(k => {
        // Look for whole word match of the KEY (e.g. "NAVY")
        const regex = new RegExp(`\\b${k}\\b`, 'i');
        if (regex.test(cleanQuery)) {
            activeAliases.push(k);
            cleanQuery = cleanQuery.replace(regex, "").trim();
        }
    });

    // Strip explicit "AND"
    cleanQuery = cleanQuery.replace(/\bAND\b/gi, " ").replace(/\s+/g, " ").trim();

    if (!cleanQuery && activeOrbits.length === 0 && activeTypes.length === 0 && activeAliases.length === 0 && targetYear === -1) {
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
            if(!yrStr) return false;
            const yrVal = parseInt(yrStr, 10);
            const satYear = yrVal > 50 ? 1900 + yrVal : 2000 + yrVal;
            if (satYear !== targetYear) return false;
        }

        // B. Smart Type Filter
        if (activeTypes.length > 0) {
            const isDebris = name.includes("DEB") || name.includes("DEBRIS") || name.includes("-DEB");
            const isRocket = name.includes("R/B") || name.includes("ROCKET") || name.includes("BREEZE") || name.includes("FREGAT") || name.includes("DELTA") || name.includes("ATLAS") || name.includes("TITAN");
            const isTba = name.includes("TBA") || name.includes("OBJECT") || name.includes("UNKNOWN"); 

            const matchesType = activeTypes.some(t => {
                if (t === "DEBRIS") return isDebris;
                if (t === "ROCKET") return isRocket;
                if (t === "TBA") return isTba;
                return false;
            });
            if (!matchesType) return false;
        }

        // C. Smart Orbit Filter (Includes HEO)
        if (activeOrbits.length > 0) {
            const mm = parseFloat(line2.substring(52, 63).trim());
            // Eccentricity is cols 26-33, assumed decimal .XXXXXXX
            const eccStr = line2.substring(26, 33).trim();
            const ecc = parseFloat("0." + eccStr);

            const matchesOrbit = activeOrbits.some(type => {
                if (isNaN(mm)) return false;
                
                if (type === 'HEO') {
                    // High Eccentricity is the hallmark of HEO/Molniya
                    // Molniya: MM ~2.0, Ecc > 0.6
                    return ecc > 0.4 || (mm > 1.8 && mm < 2.2 && ecc > 0.4); 
                }

                if (type === 'MOLNIYA') {
                    // Molniya / Sirius Orbit (12h period, High Ecc)
                    return (mm > 1.8 && mm < 2.2) && (ecc > 0.5);
                }

                if (type === 'TUNDRA') {
                    // Tundra: Geosynchronous (MM ~1.0) but Elliptical & Inclined
                    // Distinguish from GEO (Ecc < 0.1)
                    return (mm > 0.9 && mm < 1.1) && (ecc > 0.1);
                }

                // Standard definitions
                if (type === 'LEO') return mm > 11.25; 
                if (type === 'GEO') return mm > 0.98 && mm < 1.02 && ecc < 0.1; // Strict GEO
                if (type === 'MEO') return mm > 1.02 && mm <= 11.25;
                return false;
            });
            if (!matchesOrbit) return false;
        }

        // D. Alias Matches (Pre-extracted)
        if (activeAliases.length > 0) {
            const matchesAlias = activeAliases.every(key => {
                const terms = constellationAliases[key];
                return terms.some(term => name.includes(term.toUpperCase()));
            });
            if (!matchesAlias) return false;
        }

        // E. Remaining Text Search
        if (cleanQuery.length === 0) return true;

        return unionGroups.some(group => {
            const terms = group.trim().split(/\s+/).filter(t => t.length > 0);
            return terms.every(term => {
                const upperTerm = term.toUpperCase();
                // 1. Direct match
                if (name.includes(upperTerm) || id.includes(upperTerm)) return true;
                
                // 2. Dash/Space variation
                if (upperTerm.includes("-")) {
                    const spaced = upperTerm.replace("-", " ");
                    if (name.includes(spaced)) return true;
                }
                return false;
            });
        });
    });

    const start = skip > 0 ? skip : 0;
    const end = limit > 0 ? start + limit : undefined;
    return filtered.slice(start, end);
};
