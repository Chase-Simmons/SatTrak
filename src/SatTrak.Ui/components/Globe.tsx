"use client";

import React, { useMemo, useRef, useState, Suspense } from "react";
import { AltitudeLogic, AltitudeOverlay } from "./AltitudeIndicator";
import SatelliteLabels from "./SatelliteLabels";
import SatelliteHighlights from "./SatelliteHighlights";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Vector3 } from "three";
import { useSatelliteStore } from "../hooks/useSatelliteStore";
import SatelliteInstanced from "./SatelliteInstanced";
import SatellitePanel from "./SatellitePanel";
import OrbitPath from "./OrbitPath";
import DistanceGrid from "./DistanceGrid";
import CelestialBodies from "./CelestialBodies";
import * as THREE from "three";

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
          
          const processLine = (coordinates: number[][]) => {
              const pts: number[] = [];
              coordinates.forEach(c => {
                 const v = toCartesian(c[1], c[0], 0);
                 pts.push(v.x, v.y, v.z);
              });
              return new Float32Array(pts);
          };

          if (feature.geometry.type === "LineString") {
             lineSegments.push(processLine(coords));
          } else if (feature.geometry.type === "MultiLineString") {
             coords.forEach((line: number[][]) => lineSegments.push(processLine(line)));
          } else if (feature.geometry.type === "Polygon") {
             coords.forEach((ring: number[][]) => lineSegments.push(processLine(ring)));
          }
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
        
        // Latitudes (Parallels) -80 to 80
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

// Helper to signal when Canvas children are mounted
const SceneReady = ({ onReady }: { onReady: (r: boolean) => void }) => {
    React.useLayoutEffect(() => {
        onReady(true);
    }, [onReady]);
    return null;
}

const Globe = () => {
    // const { satellites, connectionStatus } = useSatelliteStream(); // Legacy SignalR
    const fetchTles = useSatelliteStore(state => state.fetchTles);
    const tles = useSatelliteStore(state => state.tles);
    const loading = useSatelliteStore(state => state.loading);
    
    const [earthMesh, setEarthMesh] = useState<THREE.Mesh | null>(null);
    const [sceneReady, setSceneReady] = useState(false);
    
    // Altitude HUD Refs
    const altBarRef = useRef<HTMLDivElement>(null);
    const altTextRef = useRef<HTMLDivElement>(null);

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

            {/* UI Overlays (Outside Canvas) */}
            <SatellitePanel />
            <AltitudeOverlay barRef={altBarRef} textRef={altTextRef} />

            <Canvas camera={{ position: [20, 35, 55], fov: 45, near: 0.1, far: 10000 }}>
                <color attach="background" args={["#000000"]} />
                
                {/* Celestial System (Sun, Moon, Lighting) */}
                <CelestialBodies />
                
                {/* Solid Black Earth to occlude stars */}
                <mesh ref={setEarthMesh}>
                    <sphereGeometry args={[EARTH_RADIUS * 0.98, 32, 32]} />
                    <meshBasicMaterial color="#000" />
                </mesh>

                {/* Lat/Lon Grid (Graticule) */}
                <Graticule />

                {/* Continent Outlines */}
                <WorldLines />
                
                {/* Stars Background - Pushed out past the Sun */}
                <Stars radius={3000} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

                {/* Distance Grid - Only render after camera is positioned */}
                {sceneReady && <DistanceGrid earthRef={{ current: earthMesh }} />}
                <SceneReady onReady={setSceneReady} />

                {/* Instanced Satellites */}
                <SatelliteInstanced />

                {/* Selected Orbit Path */}
                <OrbitPath />
                <SatelliteHighlights />
                <SatelliteLabels />

                {/* Logic Components */}
                <AltitudeLogic barRef={altBarRef} textRef={altTextRef} />

                {/* Post-processing effects */}
                <EffectComposer enableNormalPass={false}>
                    <Bloom 
                        luminanceThreshold={0.2} 
                        mipmapBlur 
                        intensity={0.5} 
                        radius={0.5}
                    />
                </EffectComposer>

                <OrbitControls 
                    enablePan={false} 
                    minDistance={6.5} 
                    maxDistance={110} 
                    enableDamping={true}
                    dampingFactor={0.1}
                    zoomSpeed={1.2}
                    mouseButtons={{
                        LEFT: THREE.MOUSE.ROTATE,
                        MIDDLE: THREE.MOUSE.PAN,
                        RIGHT: THREE.MOUSE.DOLLY
                    }}
                />
            </Canvas>
        </div>
    );
};

export default Globe;
