"use client";

import React, { useMemo, useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import { Line } from "@react-three/drei";
import * as satellite from "satellite.js";
import { useSatelliteStore } from "../hooks/useSatelliteStore";

// @ts-ignore
const satLib = satellite as any;

const SCALE_FACTOR = 1 / 1000;

interface SingleOrbitLineProps {
    satellite: any; // TLE object
}

const SingleOrbitLine = ({ satellite }: SingleOrbitLineProps) => {
    // State to trigger re-calculation
    const [refreshKey, setRefreshKey] = useState(0);

    // Refresh orbit path periodically to keep it in sync
    useEffect(() => {
        const interval = setInterval(() => {
            setRefreshKey(k => k + 1);
        }, 5000); // 5 seconds
        return () => clearInterval(interval);
    }, []);

    // Calculate Path Points
    const { points, currentSatRec } = useMemo(() => {
        if (!satellite) return { points: [], currentSatRec: null };
        const rec = satLib.twoline2satrec(satellite.line1, satellite.line2);
        const pts: Vector3[] = [];
        
        // Determine orbital period or just do a fixed slice.
        const meanMotionRadMin = rec.no; 
        const periodMin = (2 * Math.PI) / meanMotionRadMin;
        
        // Generate points for 1 orbit
        const segments = 200;
        const startTime = new Date(); // This now updates when refreshKey changes
        
        for (let i = 0; i <= segments; i++) {
            const timeOffset = (i / segments) * periodMin; // minutes
            const time = new Date(startTime.getTime() + timeOffset * 60000);
            
            const pv = satLib.propagate(rec, time);
            if (pv.position && typeof pv.position !== 'boolean') {
                const p = pv.position;
                const x = p.x * SCALE_FACTOR;
                const y = p.z * SCALE_FACTOR; // ECI Z -> Three Y
                const z = -p.y * SCALE_FACTOR;
                pts.push(new Vector3(x, y, z));
            }
        }

        return { points: pts, currentSatRec: rec };
    }, [satellite, refreshKey]);

    // Current Position Marker (Highlight)
    const markerRef = useRef<any>(null);

    useFrame(() => {
        if (!currentSatRec || !markerRef.current) return;
        const now = new Date();
        const pv = satLib.propagate(currentSatRec, now);
        if (pv.position && typeof pv.position !== 'boolean') {
            const p = pv.position;
            const x = p.x * SCALE_FACTOR;
            const y = p.z * SCALE_FACTOR;
            const z = -p.y * SCALE_FACTOR;
            markerRef.current.position.set(x, y, z);
        }
    });

    if (!satellite) return null;

    return (
        <group>
            {/* The Trail */}
            {points.length > 0 && (
                <Line 
                    points={points} 
                    color="#00ffff" 
                    lineWidth={3} 
                    transparent 
                    opacity={0.5} 
                />
            )}
            
            {/* The Highlight Marker */}
            <mesh ref={markerRef}>
                <sphereGeometry args={[0.08, 16, 16]} />
                <meshBasicMaterial color="#00ffff" wireframe />
            </mesh>
            <mesh ref={markerRef}>
                <sphereGeometry args={[0.04, 16, 16]} />
                <meshBasicMaterial color="#ffffff" />
            </mesh>
        </group>
    );
};

const OrbitPath = () => {
    const { tles, selectedIds, showOrbits } = useSatelliteStore();
    
    // Memoize the list of selected TLE objects
    const selectedSats = useMemo(() => {
        if (!selectedIds || !selectedIds.length) return [];
        return tles.filter(t => selectedIds.includes(t.id));
    }, [tles, selectedIds]);

    if (!showOrbits || selectedSats.length === 0) return null;

    return (
        <group>
            {selectedSats.map(sat => (
                <SingleOrbitLine key={sat.id} satellite={sat} />
            ))}
        </group>
    );
};

export default OrbitPath;
