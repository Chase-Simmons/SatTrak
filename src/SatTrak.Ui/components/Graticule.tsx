import React, { useMemo } from "react";
import * as THREE from "three";

const EARTH_RADIUS = 6.371;

// Helper to convert Lat/Lon/Alt to 3D Cartesian
const toCartesian = (lat: number, lon: number, alt: number) => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const r = EARTH_RADIUS + (alt / 6371) * EARTH_RADIUS; 

  const x = -(r * Math.sin(phi) * Math.cos(theta));
  const z = r * Math.sin(phi) * Math.sin(theta);
  const y = r * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
};

const Graticule = () => {
    const lines = useMemo(() => {
        const lineSegments: Float32Array[] = [];
        const segments = 64; 
        for (let lat = -80; lat <= 80; lat += 10) {
            if (lat === 0) continue; 
            const points: number[] = [];
            for (let i = 0; i <= segments; i++) {
                const lon = (i / segments) * 360 - 180;
                
                const vec = toCartesian(lat, lon, 0);
                points.push(vec.x, vec.y, vec.z);
            }
            lineSegments.push(new Float32Array(points));
        }
        for (let lon = -180; lon < 180; lon += 10) {
            const points: number[] = [];
            for (let i = 0; i <= segments; i++) {
                const lat = (i / segments) * 180 - 90;
                const vec = toCartesian(lat, lon, 0);
                points.push(vec.x, vec.y, vec.z);
            }
            lineSegments.push(new Float32Array(points));
        }
        return lineSegments;
    }, []);

    // Rotate Graticule PI to match the Mesh Rotation compensation if needed, 
    // but based on WorldLines, we used 0. Let's keep consistent with extracted code.
    return (
        <group rotation={[0, Math.PI, 0]}>
            {lines.map((line, i) => (
                <line key={i}>
                    <bufferGeometry>
                        <bufferAttribute
                            attach="attributes-position"
                            args={[line, 3]}
                        />
                    </bufferGeometry>
                    <lineBasicMaterial color="#444" linewidth={1} transparent opacity={0.4} />
                </line>
            ))}
        </group>
    );
};

export default Graticule;
