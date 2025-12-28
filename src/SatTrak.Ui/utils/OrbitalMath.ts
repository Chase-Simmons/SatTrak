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
        case OrbitClass.LEO: return 0x06b6d4; // Cyan-500 (Lower Lum)
        case OrbitClass.MEO: return 0xfbbf24; // Amber
        case OrbitClass.GEO: return 0xfda4af; // Rose
        default: return 0xd8b4fe; // Lavender
    }
}





