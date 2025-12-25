"use client";

import React, { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { Vector3 } from "three";
import { useSatelliteStream } from "../hooks/useSatelliteStream";
import { useSatelliteStore } from "../hooks/useSatelliteStore";
import SatelliteInstanced from "./SatelliteInstanced";
import SatellitePanel from "./SatellitePanel";
import OrbitPath from "./OrbitPath";
import * as d3 from "d3-geo";

const EARTH_RADIUS = 6.371; // Normalized radius for visualization

// Helper to convert Lat/Lon/Alt to 3D Cartesian
const toCartesian = (lat: number, lon: number, alt: number) => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const r = EARTH_RADIUS + (alt / 6371) * EARTH_RADIUS; // Scaled altitude

  const x = -(r * Math.sin(phi) * Math.cos(theta));
  const z = r * Math.sin(phi) * Math.sin(theta);
  const y = r * Math.cos(phi);

  return new Vector3(x, y, z);
};

const WorldLines = () => {
  const [lines, setLines] = React.useState<Float32Array[]>([]);

  React.useEffect(() => {
    fetch("/data/world.json")
      .then((res) => res.json())
      .then((data) => {
        const lineSegments: Float32Array[] = [];
        data.features.forEach((feature: any) => {
          const coords = feature.geometry.coordinates;
          const points: number[] = [];
          
          coords.forEach(([lon, lat]: [number, number]) => {
            const vec = toCartesian(lat, lon, 0); // 0 altitude for surface lines
            points.push(vec.x, vec.y, vec.z);
          });
          
          lineSegments.push(new Float32Array(points));
        });
        setLines(lineSegments);
      });
  }, []);

  return (
    <group>
      {lines.map((line, i) => (
        <line key={i}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[line, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#666" linewidth={1} transparent opacity={1} />
        </line>
      ))}
    </group>
  );
};



const Graticule = () => {
    const lines = useMemo(() => {
        const lineSegments: Float32Array[] = [];
        const segments = 64; // Resolution of circles
        const r = EARTH_RADIUS; // * 0.99 for slightly below sat? No, match Outline? 
        // Using radius same as toCartesian (EARTH_RADIUS) which is roughly 6.371.
        // Actually, Outline is maybe slightly larger? No, world lines use toCartesian(0 alt).
        // Let's use alt=0 for grid too.

        // Latitudes (Parallels) -80 to 80
        for (let lat = -80; lat <= 80; lat += 10) {
            if (lat === 0) continue; // Skip equator if desired, or keep. keeping.
            const points: number[] = [];
            for (let i = 0; i <= segments; i++) {
                const lon = (i / segments) * 360 - 180;
                const vec = toCartesian(lat, lon, 0);
                points.push(vec.x, vec.y, vec.z);
            }
            lineSegments.push(new Float32Array(points));
        }

        // Longitudes (Meridians) 0 to 360
        for (let lon = -180; lon < 180; lon += 10) {
            const points: number[] = [];
            // Pole to pole
            for (let i = 0; i <= segments; i++) {
                const lat = (i / segments) * 180 - 90;
                const vec = toCartesian(lat, lon, 0);
                points.push(vec.x, vec.y, vec.z);
            }
            lineSegments.push(new Float32Array(points));
        }
        
        // Equator (Special case if we skipped it above, but we didn't)
        // Ensure seamless wrap for circles by going 0 to 360 (i<=segments covers start/end)

        return lineSegments;
    }, []);

    return (
        <group>
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

const Globe = () => {
    // const { satellites, connectionStatus } = useSatelliteStream(); // Legacy SignalR
    const { fetchTles, tles, loading } = useSatelliteStore();

    React.useEffect(() => {
        fetchTles();
    }, []);

    return (
        <div className="relative w-full h-full bg-black">
             <div 
                className="absolute top-4 right-4 z-10 bg-black/50 p-2 rounded text-white font-mono pointer-events-none border border-white/20 text-right"
                style={{ 
                    position: 'absolute', 
                    top: '1rem', 
                    right: '1rem', 
                    zIndex: 10, 
                    backgroundColor: 'rgba(0,0,0,0.5)', 
                    color: 'white' 
                }}
             >
                <div>Source: Client-Side Propagation</div>
                <div>Satellites: {tles.length} {loading && "(Loading...)"}</div>
            </div>

            <Canvas camera={{ position: [0, 0, 18], fov: 45 }}>
                <color attach="background" args={["#000000"]} />
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} />
                
                {/* Solid Black Earth to occlude stars */}
                <mesh>
                    <sphereGeometry args={[EARTH_RADIUS * 0.98, 32, 32]} />
                    <meshBasicMaterial color="#000" />
                </mesh>

                {/* Lat/Lon Grid (Graticule) */}
                <Graticule />

                {/* Continent Outlines */}
                <WorldLines />
                
                {/* Stars Background */}
                <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

                {/* Instanced Satellites */}
                <SatelliteInstanced />

                {/* Selected Orbit Path */}
                <OrbitPath />

                <OrbitControls enablePan={false} minDistance={8} maxDistance={40} />
            </Canvas>

            {/* Editor Panel moved to end for Z-order safety */}
            <SatellitePanel />
        </div>
    );
};

export default Globe;
