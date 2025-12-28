import React, { useRef, useMemo, Suspense } from "react";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import { useFrame, extend } from "@react-three/fiber";
import * as satellite from 'satellite.js';
import Clouds from "./Clouds";
import Atmosphere from "./Atmosphere";
import { EarthMaterial } from "./materials/EarthMaterials";

// Register shader material with R3F
extend({ EarthMaterial });

const satLib = satellite as any;
const EARTH_RADIUS = 6.371;

const RealisticEarth = ({ meshRef }: { meshRef?: React.Ref<THREE.Mesh> }) => {
    const [colorMap, nightMap, heightMap] = useTexture([
        '/textures/8k_earth_daymap.png',
        '/textures/8k_earth_nightmap.png',
        '/textures/8k_earth_heightmap.png'
    ]);
    const cloudMap = useTexture('/textures/8k_earth_clouds.png');

    const sunDir = useMemo(() => new THREE.Vector3(10, 0, 50).normalize(), []);
    
    const geometry = useMemo(() => new THREE.SphereGeometry(EARTH_RADIUS, 256, 256), []);

    // Fix Texture Wrapping (The "Tear")
    useMemo(() => {
        [colorMap, nightMap, heightMap, cloudMap].forEach(t => {
            t.wrapS = THREE.RepeatWrapping;
            t.wrapT = THREE.ClampToEdgeWrapping;
            t.anisotropy = 16;
            t.offset.x = 0; 
            t.needsUpdate = true;
        });
    }, [colorMap, nightMap, heightMap, cloudMap]);

    const internalRef = useRef<THREE.Mesh>(null);
    
    // Sync external ref
    React.useLayoutEffect(() => {
        if (!meshRef) return;
        if (typeof meshRef === 'function') {
            meshRef(internalRef.current);
        } else {
            (meshRef as React.MutableRefObject<THREE.Mesh | null>).current = internalRef.current;
        }
    });

    const earthRef = internalRef;
    
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const atmosphereGroupRef = useRef<THREE.Group>(null);
    
    // State for world-space sun direction (for VolumetricClouds)
    const sunDirWorldRef = useRef(new THREE.Vector3(1, 0, 0));

    useFrame((state) => {
        if (earthRef.current && materialRef.current) {
            const now = new Date();
            const j = satLib.jday(
                now.getUTCFullYear(),
                now.getUTCMonth() + 1,
                now.getUTCDate(),
                now.getUTCHours(),
                now.getUTCMinutes(),
                now.getUTCSeconds()
            );
            
            const sunPosFn = satLib.sunPos || satLib.sun_position || satLib.sunpos;
            const sunPosEci = sunPosFn ? sunPosFn(j) : null;
            
            if (sunPosEci && sunPosEci.rsun) {
                const r = sunPosEci.rsun;
                const sunDirWorld = new THREE.Vector3(r[0], r[2], -r[1]).normalize();
                const sunDirView = sunDirWorld.clone().transformDirection(state.camera.matrixWorldInverse);
                
                // Store world sun direction for VolumetricClouds
                sunDirWorldRef.current.copy(sunDirWorld);

                // 1. Update Earth Material with both view-space and world-space sun directions
                materialRef.current.uniforms.sunDirection.value.copy(sunDirView);
                materialRef.current.uniforms.sunDirectionWorld.value.copy(sunDirWorld);
                if (atmosphereGroupRef.current) {
                    atmosphereGroupRef.current.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            if (child.material instanceof THREE.ShaderMaterial) {
                                if (child.material.uniforms.sunDirection) {
                                    child.material.uniforms.sunDirection.value.copy(sunDirView);
                                }
                            }
                        }
                    });
                }
            }
        }
    });

    return (
        <group ref={atmosphereGroupRef}>
            <mesh ref={earthRef} rotation={[0, Math.PI, 0]} geometry={geometry}>
                {/* @ts-ignore */}
                <earthMaterial 
                    ref={materialRef}
                    dayTexture={colorMap} 
                    nightTexture={nightMap}
                    heightTexture={heightMap}
                    cloudTexture={cloudMap}
                    sunDirection={sunDir}
                    displacementScale={0.015} 
                />
            </mesh>
            <Suspense fallback={null}>
                <Clouds sunDirection={sunDirWorldRef.current} />
            </Suspense>
            <Atmosphere />
        </group>
    );
};

export default React.memo(RealisticEarth);
