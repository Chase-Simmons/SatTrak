"use client";

import React, { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3, Color } from "three";
import { Line } from "@react-three/drei";
import * as satellite from "satellite.js";
import { useSatelliteStore } from "../hooks/useSatelliteStore";

// @ts-ignore
const satLib = satellite as any;

const SCALE_FACTOR = 1 / 1000;

const OrbitPath = () => {
    const { tles, selectedSatId } = useSatelliteStore();
    
    // Find selected TLE
    const selectedTle = useMemo(() => {
        if (!selectedSatId) return null;
        return tles.find(t => t.id === selectedSatId);
    }, [tles, selectedSatId]);

    // Calculate Path Points
    const { points, currentSatRec } = useMemo(() => {
        if (!selectedTle) return { points: [], currentSatRec: null };

        const rec = satLib.twoline2satrec(selectedTle.line1, selectedTle.line2);
        const pts: Vector3[] = [];
        
        // Determine orbital period or just do a fixed slice.
        // LEO is ~90 mins. GEO is 24 hours.
        // Mean motion (revs/day) is in the TLE. rec.no (rad/min)
        // period (min) = 2 * pi / n
        // rec.no is in radians/minute.
        const meanMotionRadMin = rec.no; 
        const periodMin = (2 * Math.PI) / meanMotionRadMin;
        
        // Generate points for 1 orbit
        const segments = 200;
        const startTime = new Date();
        
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
    }, [selectedTle]);

    // Current Position Marker (Highlight)
    const markerRef = React.useRef<any>(null);

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

    if (!selectedTle) return null;

    return (
        <group>
            {/* The Trail */}
            {points.length > 0 && (
                <Line 
                    points={points} 
                    color="#00ffff" 
                    lineWidth={2} 
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

export default OrbitPath;
