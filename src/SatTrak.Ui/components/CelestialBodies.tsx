"use client";
import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, useTexture } from "@react-three/drei";
import * as satellite from "satellite.js";
import * as THREE from "three";

import { useSatelliteStore } from "../hooks/useSatelliteStore";
const satLib = satellite as any;

const SCALE_FACTOR = 1 / 1000;
const MOON_RADIUS = 1.737; // 1,737 km
const MOON_CORE_RADIUS = 1.6; // Slightly smaller for the solid core
const SUN_DISTANCE_VISUAL = 8000;
const SUN_RADIUS_VISUAL = 35;

const GlowShader = {
    uniforms: {
        uColor: { value: new THREE.Color("#ffcc33") },
        uOpacity: { value: 0.6 },
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        varying vec2 vUv;
        uniform vec3 uColor;
        uniform float uOpacity;
        
        void main() {
            float dist = distance(vUv, vec2(0.5));
            // Power falloff for an ultra-smooth, professional glow
            float strength = pow(clamp(1.0 - dist * 2.0, 0.0, 1.0), 3.0);
            if (strength <= 0.0) discard; // Hard-kill anything outside the circle
            
            gl_FragColor = vec4(uColor, strength * uOpacity);
        }
    `
};

const getMoonPosition = (date: Date) => {
    const T = (date.getTime() / 1000 / 86400 + 2440587.5 - 2451545.0) / 36525;
    
    // Mean longitude (L')
    let LP = 218.316 + 481267.881 * T;
    // Mean anomaly (M')
    let MP = 134.963 + 477198.867 * T;
    // Mean elongated longitude (D)
    let D = 297.850 + 445267.111 * T;
    // Mean distance of the Moon from its ascending node (F)
    let F = 93.272 + 483202.018 * T;

    const toRad = Math.PI / 180;
    LP *= toRad; MP *= toRad; D *= toRad; F *= toRad;

    // Major periodic terms
    let lon = LP + (6.289 * Math.sin(MP) + 1.274 * Math.sin(2 * D - MP) + 0.658 * Math.sin(2 * D) + 0.214 * Math.sin(2 * MP)) * toRad;
    let lat = (5.128 * Math.sin(F) + 0.280 * Math.sin(MP + F) + 0.277 * Math.sin(MP - F) + 0.173 * Math.sin(2 * D - F)) * toRad;
    let rho = (385001 - 20905 * Math.cos(MP) - 3699 * Math.cos(2 * D - MP) - 2956 * Math.cos(2 * D)) * SCALE_FACTOR;

    // Convert Ecliptic to Equatorial (Obliquity of Ecliptic ~23.44 deg)
    const eps = 23.439 * toRad;
    const x_ecl = rho * Math.cos(lon) * Math.cos(lat);
    const y_ecl = rho * Math.sin(lon) * Math.cos(lat);
    const z_ecl = rho * Math.sin(lat);

    const x = x_ecl;
    const y = y_ecl * Math.cos(eps) - z_ecl * Math.sin(eps);
    const z = y_ecl * Math.sin(eps) + z_ecl * Math.cos(eps);

    // Three.js Coordinate Swap (ECI Z -> Three Y, ECI Y -> -Three Z)
    return new THREE.Vector3(x, z, -y);
};


const CelestialBodies = () => {
    const { showCelestialBodies } = useSatelliteStore();
    const sunRef = useRef<THREE.Group>(null);
    const sunGlowRef = useRef<THREE.Group>(null);
    const innerGlowMat = useRef<THREE.ShaderMaterial>(null);
    const outerGlowMat = useRef<THREE.ShaderMaterial>(null);
    const moonRef = useRef<THREE.Group>(null);
    const lightRef = useRef<THREE.DirectionalLight>(null);

    const moonMap = useTexture('/textures/8k_moon.png');

    // If disabled, we still need the lights for the Earth, but we hide the bodies
    const isVisible = showCelestialBodies;

    // 1. Initial Position (Static calculation for frame 1 stability)
    const initialPos = useMemo(() => {
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
            const dir = new THREE.Vector3(r[0], r[2], -r[1]).normalize();
            return dir.multiplyScalar(SUN_DISTANCE_VISUAL);
        }
        return new THREE.Vector3(SUN_DISTANCE_VISUAL, 0, 0); // Fallback
    }, []);

    const initialMoonPos = useMemo(() => getMoonPosition(new Date()), []);

    // Set initial positions BEFORE first render to prevent "snap-from-center"
    React.useLayoutEffect(() => {
        if (sunRef.current) sunRef.current.position.copy(initialPos);
        if (moonRef.current) moonRef.current.position.copy(initialMoonPos);
    }, [initialPos, initialMoonPos]);

    useFrame(() => {
        const now = new Date();

        // 1. Update Sun Position
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
            const sunDirFull = new THREE.Vector3(r[0], r[2], -r[1]).normalize();
            const sunPosVisual = sunDirFull.clone().multiplyScalar(SUN_DISTANCE_VISUAL);
            
            if (sunRef.current) {
                sunRef.current.position.copy(sunPosVisual);
            }
            if (lightRef.current) {
                lightRef.current.position.copy(sunPosVisual);
            }
        }

        // 2. Update Moon Position
        const moonPos = getMoonPosition(now);
        if (moonRef.current) {
            moonRef.current.position.copy(moonPos);
        }
    });

    return (
        <group>
            {/* The Sun: Glowing System - Toggleable and No Culling */}
            <group ref={sunRef} visible={showCelestialBodies}>
                {/* Core Sphere (Selective Bloom Target) - HDR Brightness */}
                <mesh frustumCulled={false}>
                    <sphereGeometry args={[SUN_RADIUS_VISUAL, 32, 32]} />
                    <meshBasicMaterial color={new THREE.Color("#ffffff").multiplyScalar(3)} />
                </mesh>
                
                {/* Dynamic Billboarded Glow / Corona (Shader Powered) */}
                <group ref={sunGlowRef}>
                    <Billboard>
                        {/* Inner High-Intensity Glow */}
                        <mesh frustumCulled={false}>
                            <planeGeometry args={[SUN_RADIUS_VISUAL * 5, SUN_RADIUS_VISUAL * 5]} />
                            <shaderMaterial 
                                ref={innerGlowMat}
                                {...GlowShader}
                                uniforms={{
                                    uColor: { value: new THREE.Color("#ffcc33").multiplyScalar(2) },
                                    uOpacity: { value: 0.8 }
                                }}
                                transparent={true}
                                blending={THREE.AdditiveBlending}
                                depthWrite={false}
                            />
                        </mesh>
                        {/* Outer Soft Atmosphere Halo */}
                        <mesh scale={2.0} frustumCulled={false}>
                            <planeGeometry args={[SUN_RADIUS_VISUAL * 5, SUN_RADIUS_VISUAL * 5]} />
                            <shaderMaterial 
                                ref={outerGlowMat}
                                {...GlowShader}
                                uniforms={{
                                    uColor: { value: new THREE.Color("#ff8800").multiplyScalar(1.5) },
                                    uOpacity: { value: 0.4 }
                                }}
                                transparent={true}
                                blending={THREE.AdditiveBlending}
                                depthWrite={false}
                            />
                        </mesh>
                    </Billboard>
                </group>

                <pointLight intensity={50} distance={15000} decay={1} color="#ffaa44" />
            </group>

            {/* Sun Light Source (Lights Earth/Moon) */}
            <directionalLight 
                ref={lightRef} 
                intensity={1.5} 
                castShadow={false} // Performance
            />

            {/* The Moon: Double-Sphere - Toggleable and No Culling */}
            <group ref={moonRef} visible={showCelestialBodies}>
                {/* Outer Wireframe Shell */}
                <mesh frustumCulled={false}>
                    <sphereGeometry args={[MOON_RADIUS, 4, 4]} />
                    <meshBasicMaterial 
                        color="#99f6e4" 
                        wireframe 
                        transparent={true}
                        opacity={0.0} 
                    />
                </mesh>
                {/* Inner Solid Core - StandardMaterial to react to Sun light and avoid bloom */}
                <mesh frustumCulled={false} rotation={[0, -Math.PI / 2, 0]}>
                    <sphereGeometry args={[MOON_CORE_RADIUS, 32, 32]} />
                    <meshStandardMaterial 
                        map={moonMap}
                        color="#ffffff" 
                        roughness={0.9}
                        metalness={0.0}
                    />
                </mesh>
            </group>
            
            {/* Ambient light for subtle shadow detail */}
            <ambientLight intensity={0.05} />
        </group>
    );
};

export default CelestialBodies;
