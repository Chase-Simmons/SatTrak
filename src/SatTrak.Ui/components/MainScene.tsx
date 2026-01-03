"use client";

import React, { useMemo, useRef, useState, Suspense } from "react";
import { AltitudeLogic, AltitudeOverlay } from "./AltitudeIndicator";
import SatelliteLabels from "./SatelliteLabels";
import SatelliteHighlights from "./SatelliteHighlights";
import SatelliteInfoPanel from "./SatelliteInfoPanel";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, useTexture } from "@react-three/drei";
import { EffectComposer, Bloom, SelectiveBloom, Selection, Select } from "@react-three/postprocessing";
import { Vector3 } from "three";
import { useSatelliteStore } from "../hooks/useSatelliteStore";
import SatelliteInstanced from "./SatelliteInstanced";
import SatellitePanel from "./SatellitePanel";
import OrbitPath from "./OrbitPath";
import HoverOrbit from "./HoverOrbit";
import ZoomInertia from "./ZoomInertia";
import DistanceGrid from "./DistanceGrid";
import CelestialBodies from "./CelestialBodies";
import SatelliteFocusController from "./SatelliteFocusController";
import * as THREE from "three";
import { perfState } from "../utils/PerformanceState";
import RealisticEarth from "./RealisticEarth";
import StarField from "./StarField";
import Graticule from "./Graticule";
import WorldLines from "./WorldLines";
import EarthGroup from "./EarthGroup";
import FpsTracker from "./FpsTracker";
import RotationStatus from "./RotationStatus";
import SceneReady from "./SceneReady";

const EARTH_RADIUS = 6.371; // Normalized radius for visualization

const MainScene = () => {
    const fetchTles = useSatelliteStore(state => state.fetchTles);
    const tles = useSatelliteStore(state => state.tles);
    const loading = useSatelliteStore(state => state.loading);
    const clearSelection = useSatelliteStore(state => state.clearSelection);
    const setFocusedId = useSatelliteStore(state => state.setFocusedId);
    const setIsCameraRotating = useSatelliteStore(state => state.setIsCameraRotating);
    const viewMode = useSatelliteStore(state => state.viewMode);
    const showGraticule = useSatelliteStore(state => state.showGraticule);
    
    const [earthMesh, setEarthMesh] = useState<THREE.Mesh | null>(null);
    const [sceneReady, setSceneReady] = useState(false);
    
    const mouseDownPos = useRef<{ x: number, y: number } | null>(null);

    const altBarRef = useRef<HTMLDivElement>(null);
    const altTextRef = useRef<HTMLDivElement>(null);
    const fpsRef = useRef<HTMLDivElement>(null);
    const controlsRef = useRef<any>(null);
    const rotationTimeout = useRef<NodeJS.Timeout | null>(null);
    const startRotationTimeout = useRef<NodeJS.Timeout | null>(null);
    const dragLockTimeout = useRef<NodeJS.Timeout | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [satMesh, setSatMesh] = useState<THREE.InstancedMesh | null>(null);
    const [earthBloomMesh, setEarthBloomMesh] = useState<THREE.Mesh | null>(null);

    React.useEffect(() => {
        const setDown = () => { 
            if (rotationTimeout.current) clearTimeout(rotationTimeout.current);
            if (dragLockTimeout.current) {
                clearTimeout(dragLockTimeout.current);
                dragLockTimeout.current = null;
            }
            if (startRotationTimeout.current) {
                clearTimeout(startRotationTimeout.current);
                startRotationTimeout.current = null;
            }
            perfState.forceCheck = true;
            perfState.isRotating = false;
            useSatelliteStore.getState().setIsCameraRotating(false);
            
            dragLockTimeout.current = setTimeout(() => {
                perfState.forceCheck = false;
                perfState.isRotating = true; 
            }, 50);
        };
        const setUp = () => { 
            if (dragLockTimeout.current) {
                clearTimeout(dragLockTimeout.current);
                dragLockTimeout.current = null;
            }
            if (startRotationTimeout.current) {
                clearTimeout(startRotationTimeout.current);
                startRotationTimeout.current = null;
            }
            perfState.forceCheck = true; 
            perfState.isRotating = false;
            useSatelliteStore.getState().setIsCameraRotating(false); 
        };
        const container = containerRef.current;
        if (container) {
            container.addEventListener('pointerdown', setDown, { capture: true });
            container.addEventListener('pointerup', setUp, { capture: true });
            window.addEventListener('pointerup', setUp, { capture: true });
        }

        perfState.isRotating = false;
        perfState.forceCheck = false;
        useSatelliteStore.getState().setIsCameraRotating(false);

        const watchdog = setInterval(() => {
            if (perfState.isRotating) {
                 const isStuck = !rotationTimeout.current && !startRotationTimeout.current;
                 if (isStuck) {
                     perfState.isRotating = false;
                     perfState.forceCheck = true;
                     useSatelliteStore.getState().setIsCameraRotating(false);
                 }
            } else {
                 if (useSatelliteStore.getState().isCameraRotating) {
                     useSatelliteStore.getState().setIsCameraRotating(false);
                 }
            }
        }, 500);

        fetchTles();
        return () => {
             clearInterval(watchdog);
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
             <div 
                className="absolute top-4 right-4 z-10 bg-black/50 p-2 rounded text-white font-mono pointer-events-none border border-white/20 text-right"
                style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', display: 'none' }}
             >
                <div ref={fpsRef} className="font-bold text-green-400">FPS: --</div>
                <div>Source: Client-Side Propagation</div>
                <div>Satellites: {tles.length} {loading && "(Loading...)"}</div>
                <RotationStatus />
            </div>

            <SatellitePanel />
            <SatelliteInfoPanel />
            <AltitudeOverlay barRef={altBarRef} textRef={altTextRef} />

            <Canvas 
                camera={{ position: [20, 35, 55], fov: 45, near: 0.1, far: 200000 }}
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
                    if (mouseDownPos.current) mouseDownPos.current = null;
                }}
            >
                <color attach="background" args={["#000000"]} />
                
                <Suspense fallback={null}>
                    <CelestialBodies />
                </Suspense>
                
                <EarthGroup>
                    <group visible={viewMode === 'wireframe'} rotation={[0, Math.PI, 0]}>
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
                                mouseDownPos.current = null;
                            }}
                        >
                            <sphereGeometry args={[EARTH_RADIUS, 32, 32]} />
                            <meshBasicMaterial color="#000" />
                        </mesh>

                        {/* Lat/Lon Grid (Graticule) */}
                        {showGraticule && <Graticule />}
                        <WorldLines />
                    </group>

                    <Suspense fallback={null}>
                         <group visible={viewMode === 'realistic'}>
                             <RealisticEarth meshRef={setEarthBloomMesh} />
                             {/* Realistic Graticule overlay */}
                             {showGraticule && (
                                 <group scale={[1.002, 1.002, 1.002]}>
                                     <Graticule />
                                 </group>
                             )}
                             {/* Keep interaction mesh invisible for picking */}
                              <mesh 
                                ref={viewMode === 'realistic' ? setEarthMesh : null}
                                visible={false} // Invisible proxy for interaction / sizing
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
                                    mouseDownPos.current = null;
                                }}
                            >
                                <sphereGeometry args={[EARTH_RADIUS, 32, 32]} />
                                <meshBasicMaterial color="#000" />
                            </mesh>
                        </group>
                    </Suspense>
                </EarthGroup>
                
                {/* Stars Always Visible & Behind Everything */}
                <Suspense fallback={null}>
                    <StarField />
                </Suspense>

                {/* Lighting is handled inside CelestialBodies.tsx */}

                {sceneReady && <DistanceGrid earthRef={{ current: earthMesh }} />}
                <SceneReady onReady={setSceneReady} />

                <SatelliteInstanced meshRef={setSatMesh} />
                <EffectComposer enableNormalPass={false}>
                    <Bloom 
                        luminanceThreshold={0.5} 
                        mipmapBlur 
                        intensity={0.4} 
                        radius={0.8}
                    />
                     {satMesh ? (
                        <SelectiveBloom 
                            lights={[]} 
                            selection={[satMesh]} 
                            intensity={0.2}
                            radius={0.4} 
                            luminanceThreshold={0.1} 
                            luminanceSmoothing={0.5}
                            mipmapBlur
                        />
                     ) : <></>}
                    {earthBloomMesh ? (
                        <SelectiveBloom 
                            lights={[]} 
                            selection={[earthBloomMesh]} 
                            intensity={0.3}  
                            radius={0.4} 
                            luminanceThreshold={1.0} 
                            luminanceSmoothing={0.4}
                            mipmapBlur
                        />
                    ) : <></>}
                </EffectComposer>

                <FpsTracker fpsRef={fpsRef} />

                <OrbitPath />
                <HoverOrbit />
                <SatelliteHighlights />
                <SatelliteLabels />

                <SatelliteFocusController />
                <AltitudeLogic barRef={altBarRef} textRef={altTextRef} />

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

export default MainScene;