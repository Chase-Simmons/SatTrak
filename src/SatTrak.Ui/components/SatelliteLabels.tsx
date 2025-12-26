"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as satellite from "satellite.js";
import { useSatelliteStore } from "../hooks/useSatelliteStore";
import { Vector3 } from "three";
import * as THREE from "three";

// @ts-ignore
const satLib = satellite as any;

const SCALE_FACTOR = 1 / 1000;
const EARTH_RADIUS_OCLUDE = 6.36; // Slightly less than 6.371 for grazing visibility

interface LabelProps {
    satellite: any;
    initialPos: Vector3; 
}

const SingleLabel = ({ satellite, initialPos }: LabelProps) => {
    const groupRef = useRef<THREE.Group>(null);
    const satRec = useMemo(() => {
        if (!satellite) return null;
        return satLib.twoline2satrec(satellite.line1, satellite.line2);
    }, [satellite]);

    // Set initial position
    useEffect(() => {
        if (groupRef.current) {
            groupRef.current.position.copy(initialPos);
        }
    }, [initialPos]);

    useFrame(() => {
        if (!satRec || !groupRef.current) return;
        const now = new Date();
        const pv = satLib.propagate(satRec, now);
        if (pv.position && typeof pv.position !== 'boolean') {
            const p = pv.position;
            const x = p.x * SCALE_FACTOR;
            const y = p.z * SCALE_FACTOR; // ECI Z -> Three Y
            const z = -p.y * SCALE_FACTOR;
            groupRef.current.position.set(x, y, z);
        }
    });
    
    if (!satRec) return null;

    return (
        <group ref={groupRef}>
            <Html 
                center 
                distanceFactor={15} 
                style={{ pointerEvents: 'none' }}
                zIndexRange={[100, 0]} 
            >
                <div style={{
                    color: '#22d3ee',
                    fontSize: '10px', 
                    fontFamily: 'monospace',
                    background: 'rgba(5, 10, 20, 0.85)',
                    border: '1px solid rgba(34, 211, 238, 0.3)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    transform: 'translateY(-24px)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(2px)'
                }}>
                    {satellite.name || `SAT-${satellite.id}`}
                </div>
            </Html>
        </group>
    );
};

// Geometric occlusion check: Segment CP vs Sphere at origin with radius R
const isOccludedByEarth = (P: Vector3, C: Vector3, R: number) => {
    const L = new Vector3().subVectors(P, C);
    const a = L.dot(L);
    const b = 2 * C.dot(L);
    const c = C.dot(C) - R * R;
    
    const D = b * b - 4 * a * c;
    if (D < 0) return false;
    if (b >= 0) return false;
    
    const t = (-b - Math.sqrt(D)) / (2 * a);
    return t >= 0 && t <= 1;
};

const SatelliteLabels = () => {
    const { tles, selectedIds, showLabels } = useSatelliteStore();
    const { camera } = useThree();
    
    const [visibleLabels, setVisibleLabels] = useState<{sat: any, pos: Vector3}[]>([]);
    const lastUpdate = useRef(0);

    // Map selected IDs to TLE objects
    const selectedSats = useMemo(() => {
        if (!selectedIds.length) return [];
        return tles.filter(t => selectedIds.includes(t.id));
    }, [tles, selectedIds]);

    useFrame((state) => {
        if (!showLabels || selectedSats.length === 0) return;

        // Throttle sorting and occlusion to every 200ms
        const now = state.clock.getElapsedTime();
        if (now - lastUpdate.current < 0.2) return;
        lastUpdate.current = now;

        const date = new Date();
        const camPos = camera.position;

        const candidates = [];
        const R = EARTH_RADIUS_OCLUDE;
        
        for (let i = 0; i < selectedSats.length; i++) {
            const sat = selectedSats[i];
            const rec = satLib.twoline2satrec(sat.line1, sat.line2);
            if (!rec) continue;
            
            const pv = satLib.propagate(rec, date);
            if (pv.position && typeof pv.position !== 'boolean') {
                const p = pv.position;
                const v = new Vector3(p.x * SCALE_FACTOR, p.z * SCALE_FACTOR, -p.y * SCALE_FACTOR);
                
                // 1. Occlusion Check (Geometric)
                if (isOccludedByEarth(v, camPos, R)) continue;
                
                // 2. Distance Check
                const dist = v.distanceTo(camPos);
                candidates.push({ sat, pos: v, dist });
            }
        }

        // Sort by distance (ASC)
        candidates.sort((a, b) => a.dist - b.dist);

        // Take top N (Dynamic limit for performance/readability)
        const maxLabels = selectedSats.length > 200 ? 15 : 40; 
        const topN = candidates.slice(0, maxLabels);
        setVisibleLabels(topN);
    });

    if (!showLabels || selectedSats.length === 0) return null;

    return (
        <group>
            {visibleLabels.map(item => (
                <SingleLabel 
                    key={item.sat.id} 
                    satellite={item.sat} 
                    initialPos={item.pos}
                />
            ))}
        </group>
    );
};

export default SatelliteLabels;
