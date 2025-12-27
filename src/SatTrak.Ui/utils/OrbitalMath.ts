export enum OrbitClass {
    LEO = 'LEO',
    MEO = 'MEO',
    GEO = 'GEO',
    HEO = 'HEO' // Highly Elliptical / Other
}

export function getOrbitClass(altitudeKm: number): OrbitClass {
    if (altitudeKm < 2000) return OrbitClass.LEO;
    if (altitudeKm < 30000) return OrbitClass.MEO;
    if (altitudeKm < 40000) return OrbitClass.GEO;
    return OrbitClass.HEO;
}

export function getOrbitColor(orbitClass: OrbitClass): number {
    switch (orbitClass) {
        case OrbitClass.LEO: return 0x00B200; // Green
        case OrbitClass.MEO: return 0x00B2B2; // Cyan
        case OrbitClass.GEO: return 0xFF0000; // Red
        default: return 0x94a3b8; // Grey
    }
}
