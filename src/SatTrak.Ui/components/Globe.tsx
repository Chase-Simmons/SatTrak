"use client";

import React, { useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { Vector3 } from "three";
import { useSatelliteStore } from "../hooks/useSatelliteStore";
import SatelliteInstanced from "./SatelliteInstanced";
import SatellitePanel from "./SatellitePanel";
import OrbitPath from "./OrbitPath";
import DistanceGrid from "./DistanceGrid";
import { AltitudeLogic, AltitudeOverlay } from "./AltitudeIndicator";
import * as THREE from "three";

// Helper to bridge camera control to outside button
const CameraController = ({ resetRef, onReady }: { resetRef: React.MutableRefObject<() => void>, onReady?: () => void }) => {
    const { camera, controls } = useThree();
    
    React.useEffect(() => {
        resetRef.current = () => {
            camera.position.set(20, 35, 55);
            camera.lookAt(0, 0, 0);
            const ctrl = (controls as any);
            if (ctrl) {
                ctrl.target.set(0, 0, 0);
                ctrl.update();
            }
        };

        // Initial setup
        resetRef.current();
        
        // Signal ready after a delay to ensure matrices update
        if (onReady) {
            setTimeout(() => onReady(), 50); 
        }

    }, [camera, controls, resetRef, onReady]);

    return null;
};

const ResetButton = ({ resetCallback }: { resetCallback: React.RefObject<() => void> }) => {
    return (
        <div style={{
            position: 'absolute',
            bottom: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 40,
            pointerEvents: 'auto'
        }}>
            <button 
                onClick={() => resetCallback.current && resetCallback.current()}
                style={{
                    background: 'rgba(22, 78, 99, 0.8)', 
                    color: '#cffafe', 
                    padding: '8px 24px', 
                    borderRadius: '4px', 
                    border: '1px solid rgba(6, 182, 212, 0.5)', 
                    fontFamily: 'monospace',
                    letterSpacing: '0.05em',
                    boxShadow: '0 0 15px rgba(8,145,178,0.4)',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    backdropFilter: 'blur(4px)'
                }}
            >
                RESET VIEW
            </button>
        </div>
    );
};

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

const Globe = () => {
    // const { satellites, connectionStatus } = useSatelliteStream(); // Legacy SignalR
    const { fetchTles, tles, loading } = useSatelliteStore();
    const earthRef = React.useRef<THREE.Mesh>(null);
    const resetRef = useRef<() => void>(() => {});
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
            <ResetButton resetCallback={resetRef} />
            <AltitudeOverlay barRef={altBarRef} textRef={altTextRef} />

            <Canvas camera={{ position: [20, 35, 55], fov: 45 }}>
                <color attach="background" args={["#000000"]} />
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} />
                
                {/* Solid Black Earth to occlude stars */}
                <mesh ref={earthRef}>
                    <sphereGeometry args={[EARTH_RADIUS * 0.98, 32, 32]} />
                    <meshBasicMaterial color="#000" />
                </mesh>

                {/* Lat/Lon Grid (Graticule) */}
                <Graticule />

                {/* Continent Outlines */}
                <WorldLines />
                
                {/* Stars Background */}
                <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

                {/* Distance Grid - Only render after camera is positioned */}
                {sceneReady && <DistanceGrid earthRef={earthRef} />}

                {/* Instanced Satellites */}
                <SatelliteInstanced />

                {/* Selected Orbit Path */}
                <OrbitPath />

                {/* Logic Components */}
                <CameraController resetRef={resetRef} onReady={() => setSceneReady(true)} />
                <AltitudeLogic barRef={altBarRef} textRef={altTextRef} />

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
