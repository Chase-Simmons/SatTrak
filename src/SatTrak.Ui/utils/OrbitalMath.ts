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

export function getOrbitColor(orbitClass: OrbitClass): string {
    switch (orbitClass) {
        case OrbitClass.LEO: return '#00B200';
        case OrbitClass.MEO: return '#00B2B2';
        case OrbitClass.GEO: return '#FF0000';
        default: return '#94a3b8';
    }
}
