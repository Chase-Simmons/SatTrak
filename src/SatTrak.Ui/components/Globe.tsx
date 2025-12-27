"use client";

import React, { useMemo, useRef, useState, Suspense } from "react";
import { AltitudeLogic, AltitudeOverlay } from "./AltitudeIndicator";
import SatelliteLabels from "./SatelliteLabels";
import SatelliteHighlights from "./SatelliteHighlights";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Vector3 } from "three";
import { useSatelliteStore } from "../hooks/useSatelliteStore";
import SatelliteInstanced from "./SatelliteInstanced";
import SatellitePanel from "./SatellitePanel";
import OrbitPath from "./OrbitPath";
import HoverOrbit from "./HoverOrbit";
import ZoomInertia from "./ZoomInertia";
import DistanceGrid from "./DistanceGrid";
import CelestialBodies from "./CelestialBodies";
import CameraController from "./CameraController";
import * as THREE from "three";
import { perfState } from "../utils/PerformanceState";

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

const FpsTracker = ({ fpsRef }: { fpsRef: React.RefObject<HTMLDivElement | null> }) => {
  useFrame((state: any, delta: number) => {
    if (!fpsRef.current) return;
    const fps = 1 / delta;
    fpsRef.current.innerText = `FPS: ${fps.toFixed(0)}`;
  });
  return null;
};

const RotationStatus = () => {
    const isRotating = useSatelliteStore(state => state.isCameraRotating);
    return (
        <div style={{ color: isRotating ? 'red' : 'lime' }}>
            Rotating: {isRotating ? "YES" : "NO"}
        </div>
    );
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
    const fetchTles = useSatelliteStore(state => state.fetchTles);
    const tles = useSatelliteStore(state => state.tles);
    const loading = useSatelliteStore(state => state.loading);
    const clearSelection = useSatelliteStore(state => state.clearSelection);
    const setFocusedId = useSatelliteStore(state => state.setFocusedId);
    const setIsCameraRotating = useSatelliteStore(state => state.setIsCameraRotating);
    
    const [earthMesh, setEarthMesh] = useState<THREE.Mesh | null>(null);
    const [sceneReady, setSceneReady] = useState(false);
    
    const mouseDownPos = useRef<{ x: number, y: number } | null>(null);

    const altBarRef = useRef<HTMLDivElement>(null);
    const altTextRef = useRef<HTMLDivElement>(null);
    const fpsRef = useRef<HTMLDivElement>(null);
    const controlsRef = useRef<any>(null); // Ref for OrbitControls access
    const rotationTimeout = useRef<NodeJS.Timeout | null>(null);
    const startRotationTimeout = useRef<NodeJS.Timeout | null>(null);
    const dragLockTimeout = useRef<NodeJS.Timeout | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const setDown = () => { 
            // Reset interaction state
            if (rotationTimeout.current) clearTimeout(rotationTimeout.current);
            if (dragLockTimeout.current) {
                clearTimeout(dragLockTimeout.current);
                dragLockTimeout.current = null;
            }
            if (startRotationTimeout.current) {
                clearTimeout(startRotationTimeout.current);
                startRotationTimeout.current = null;
            }
            // Force Raycast sync
            perfState.forceCheck = true;
            perfState.isRotating = false;
            useSatelliteStore.getState().setIsCameraRotating(false);
            
            // Lock raycasting during drag (after initial hit-test frame)
            dragLockTimeout.current = setTimeout(() => {
                perfState.forceCheck = false;
                perfState.isRotating = true; 
            }, 50);
        };
        const setUp = () => { 
            // Unlock
            if (dragLockTimeout.current) {
                clearTimeout(dragLockTimeout.current);
                dragLockTimeout.current = null;
            }
            if (startRotationTimeout.current) {
                clearTimeout(startRotationTimeout.current);
                startRotationTimeout.current = null;
            }
            // Force Raycast for release event
            perfState.forceCheck = true; 
            perfState.isRotating = false;
            useSatelliteStore.getState().setIsCameraRotating(false); 
        };

        
        const container = containerRef.current;
        if (container) {
            // Use Capture Phase on Container
            container.addEventListener('pointerdown', setDown, { capture: true });
            container.addEventListener('pointerup', setUp, { capture: true });
            // Global catch for pointerup to handle drags that end outside window
            window.addEventListener('pointerup', setUp, { capture: true });
        }

        fetchTles();
        return () => {
            if (rotationTimeout.current) clearTimeout(rotationTimeout.current);
            if (container) {
                container.removeEventListener('pointerdown', setDown, { capture: true } as any);
                container.removeEventListener('pointerup', setUp, { capture: true } as any);
            }
             window.removeEventListener('pointerup', setUp, { capture: true } as any);
        };
    }, []);

    return (
        <div ref={containerRef} className="relative w-full h-full bg-black">
             {/* ... Source HUD ... */}
             <div 
                className="absolute top-4 left-4 z-10 bg-black/50 p-2 rounded text-white font-mono pointer-events-none border border-white/20 text-left"
                style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', color: 'white' }}
             >
                <div ref={fpsRef} className="font-bold text-green-400">FPS: --</div>
                <div>Source: Client-Side Propagation</div>
                <div>Satellites: {tles.length} {loading && "(Loading...)"}</div>
                <RotationStatus />
            </div>

            <SatellitePanel />
            <AltitudeOverlay barRef={altBarRef} textRef={altTextRef} />

            <Canvas 
                camera={{ position: [20, 35, 55], fov: 45, near: 0.1, far: 10000 }}
                onPointerDown={(e) => {
                    mouseDownPos.current = { x: e.clientX, y: e.clientY };
                }}
                onPointerMissed={(e) => {
                    if (!mouseDownPos.current) return;
                    const dx = e.clientX - mouseDownPos.current.x;
                    const dy = e.clientY - mouseDownPos.current.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist > 5) {
                        setFocusedId(null);
                    }
                    // Removed clearSelection() to prevent accidental deselection
                    mouseDownPos.current = null;
                }}
            >
                <color attach="background" args={["#000000"]} />
                
                <CelestialBodies />
                
                <mesh 
                    ref={setEarthMesh}
                    onPointerMove={(e) => e.stopPropagation()}
                    onPointerOver={() => useSatelliteStore.getState().setHoveredId(null)}
                    onPointerDown={(e) => {
                        e.stopPropagation();
                        mouseDownPos.current = { x: e.clientX, y: e.clientY };
                    }}
                    onPointerUp={(e) => {
                        e.stopPropagation();
                        if (!mouseDownPos.current) return;
                        const dx = e.clientX - mouseDownPos.current.x;
                        const dy = e.clientY - mouseDownPos.current.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist > 5) {
                            setFocusedId(null);
                        }
                        // Removed clearSelection() to prevent accidental deselection
                        mouseDownPos.current = null;
                    }}
                >
                    <sphereGeometry args={[EARTH_RADIUS, 32, 32]} />
                    <meshBasicMaterial color="#000" />
                </mesh>

                {/* Lat/Lon Grid (Graticule) */}
                <Graticule />

                <WorldLines />
                
                <Stars radius={3000} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

                {sceneReady && <DistanceGrid earthRef={{ current: earthMesh }} />}
                <SceneReady onReady={setSceneReady} />

                <SatelliteInstanced />
                <FpsTracker fpsRef={fpsRef} />

                <OrbitPath />
                <HoverOrbit />
                <SatelliteHighlights />
                <SatelliteLabels />

                <CameraController />
                <AltitudeLogic barRef={altBarRef} textRef={altTextRef} />

                <EffectComposer enableNormalPass={false}>
                    <Bloom 
                        luminanceThreshold={0.18} 
                        mipmapBlur 
                        intensity={0.5} 
                        radius={0.5}
                    />
                </EffectComposer>

                <ZoomInertia controlsRef={controlsRef} />

                <OrbitControls 
                    ref={controlsRef}
                    makeDefault
                    enablePan={false} 
                    enableZoom={false} // Handled by ZoomInertia
                    minDistance={6.5} 
                    maxDistance={110} 
                    enableDamping={true}
                    dampingFactor={0.06} // Slightly longer glide (was 0.05)
                    mouseButtons={{
                        LEFT: THREE.MOUSE.ROTATE,
                        MIDDLE: THREE.MOUSE.PAN,
                        RIGHT: THREE.MOUSE.DOLLY
                    }}
                    onStart={() => {
                        // Optional: can set true here if needed, but onChange handles dragging better
                    }}
                    onChange={() => {
                        // Clear pending stop
                        if (rotationTimeout.current) clearTimeout(rotationTimeout.current);

                        if (!perfState.isRotating && !startRotationTimeout.current) {
                            startRotationTimeout.current = setTimeout(() => {
                                perfState.isRotating = true;
                                setIsCameraRotating(true);
                                startRotationTimeout.current = null;
                            }, 150); 
                        }

                        // Schedule stop (200ms)
                        rotationTimeout.current = setTimeout(() => {
                            if (startRotationTimeout.current) {
                                clearTimeout(startRotationTimeout.current);
                                startRotationTimeout.current = null;
                            }
                            perfState.isRotating = false;
                            setIsCameraRotating(false);
                            rotationTimeout.current = null;
                        }, 200);
                    }}
                    onEnd={() => {
                         // Force stop immediately on explicit end
                         if (startRotationTimeout.current) {
                            clearTimeout(startRotationTimeout.current);
                            startRotationTimeout.current = null;
                         }
                         if (rotationTimeout.current) clearTimeout(rotationTimeout.current);
                         
                         perfState.isRotating = false;
                         setIsCameraRotating(false);
                    }}
                />
            </Canvas>
        </div>
    );
};

export default Globe;
