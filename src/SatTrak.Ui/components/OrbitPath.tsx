"use client";

import React, { useMemo, useRef, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, BufferAttribute, BufferGeometry } from "three";
import * as satellite from "satellite.js";
import { useSatelliteStore, SatelliteTle } from "../hooks/useSatelliteStore";

// @ts-ignore
const satLib = satellite as any;

const SCALE_FACTOR = 1 / 1000;
const SEGMENTS = 64; // Reduce segments slightly for speed
const POINTS_PER_SAT = (SEGMENTS - 1) * 2;
const BATCH_SIZE = 50; 
const MAX_VISIBLE_ORBITS = 150; // Cap for visual clarity

const OrbitPath = () => {
    const { tles, selectedIds, showOrbits } = useSatelliteStore();
    const { camera } = useThree();
    
    // Derived selected list
    const selectedSats = useMemo(() => {
        if (!selectedIds || !selectedIds.length) return [];
        return tles.filter(t => selectedIds.includes(t.id));
    }, [tles, selectedIds]);

    const geometryRef = useRef<BufferGeometry>(null);
    
    // Queue now stores the active subset
    const queueRef = useRef<{sat: SatelliteTle, index: number}[]>([]);
    const processingRef = useRef(false);
    
    // Track active satellites for drawing
    const [activeSats, setActiveSats] = useState<SatelliteTle[]>([]);

    // Initialize Buffer for MAX_VISIBLE_ORBITS
    const bufferAttributes = useMemo(() => {
        const totalVertices = MAX_VISIBLE_ORBITS * POINTS_PER_SAT;
        const positions = new Float32Array(totalVertices * 3);
        return { positions, totalVertices };
    }, []);

    // Periodic Sort & Update
    const lastSort = useRef(0);
    const lastRefreshTime = useRef(0);
    
    useFrame(({ clock }) => {
        if (!showOrbits || selectedSats.length === 0) return;

        const now = clock.getElapsedTime();
        // Check every 0.5s if we need to update the visible set
        if (now - lastSort.current < 0.5) {
            // Processing logic for current queue
            if (processingRef.current && geometryRef.current && queueRef.current.length > 0) {
                 const batch = queueRef.current.splice(0, BATCH_SIZE);
                 const positions = bufferAttributes.positions;
                 const startTime = new Date();
                 
                 batch.forEach(({ sat, index }) => {
                    const rec = satLib.twoline2satrec(sat.line1, sat.line2);
                    if (!rec) return;

                    const meanMotionRadMin = rec.no; 
                    const periodMin = (2 * Math.PI) / meanMotionRadMin;
                    
                    let prevX = 0, prevY = 0, prevZ = 0;
                    let firstPass = true;
                    let offset = index * POINTS_PER_SAT * 3;

                    for (let i = 0; i < SEGMENTS; i++) {
                        const timeOffset = (i / (SEGMENTS - 1)) * periodMin; 
                        const time = new Date(startTime.getTime() + timeOffset * 60000);
                        const pv = satLib.propagate(rec, time);
                        if (pv.position && typeof pv.position !== 'boolean') {
                            const p = pv.position;
                            const x = p.x * SCALE_FACTOR;
                            const y = p.z * SCALE_FACTOR; 
                            const z = -p.y * SCALE_FACTOR;

                            if (!firstPass) {
                                positions[offset++] = prevX;
                                positions[offset++] = prevY;
                                positions[offset++] = prevZ;
                                positions[offset++] = x;
                                positions[offset++] = y;
                                positions[offset++] = z;
                            }
                            prevX = x; prevY = y; prevZ = z;
                            firstPass = false;
                        }
                    }
                 });
                 geometryRef.current.attributes.position.needsUpdate = true;
                 
                 // How many valid orbits do we have?
                 // If activeSats < MAX, only draw that many
                 const drawnCount = activeSats.length - queueRef.current.length; // Approximate
                 // Actually we just draw ALL activeSats
                 // But queue logic is clearing it.
                 // We need to set draw range to (activeSats.length * POINTS)
                 // But only after they are calculated?
                 // For now, let's just set Max Draw Range always, 0s will be hidden (at origin)
                 // Or we set it to activeSats.length * POINTS
                 geometryRef.current.setDrawRange(0, activeSats.length * POINTS_PER_SAT);

                 if (queueRef.current.length === 0) processingRef.current = false;
            }
            return;
        }

        // --- Sorting Pass ---
        lastSort.current = now;
        const camPos = camera.position;
        const date = new Date();

        // Sort ALL selected sats by distance
        const candidates = [];
        for (let i = 0; i < selectedSats.length; i++) {
            const sat = selectedSats[i];
            const rec = satLib.twoline2satrec(sat.line1, sat.line2);
            if (!rec) continue;
            // Quick prop
            const pv = satLib.propagate(rec, date);
            if (pv.position && typeof pv.position !== 'boolean') {
                 const p = pv.position;
                 const dx = (p.x*SCALE_FACTOR) - camPos.x;
                 const dy = (p.z*SCALE_FACTOR) - camPos.y; 
                 const dz = (-p.y*SCALE_FACTOR) - camPos.z;
                 const distSq = dx*dx + dy*dy + dz*dz;
                 candidates.push({ sat, distSq });
            }
        }
        
        candidates.sort((a,b) => a.distSq - b.distSq);
        const topN = candidates.slice(0, MAX_VISIBLE_ORBITS).map(c => c.sat);
        
        // --- Refresh Logic ---
        const timeSinceRefresh = now - lastRefreshTime.current;
        const isSingleSat = topN.length === 1;
        const refreshThreshold = isSingleSat ? 10 : 60; // 10s for single, 60s for group
        
        const setChanged = topN.length !== activeSats.length || topN[0]?.id !== activeSats[0]?.id;
        const timeTrigger = timeSinceRefresh > refreshThreshold;

        if (setChanged || timeTrigger) {
            lastRefreshTime.current = now;
            setActiveSats(topN);
            queueRef.current = topN.map((sat, i) => ({ sat, index: i }));
            processingRef.current = true;
        }
    });

    if (!showOrbits || selectedSats.length === 0) return null;

    return (
        <group>
            <lineSegments>
                <bufferGeometry ref={geometryRef}>
                    <bufferAttribute
                        attach="attributes-position"
                        count={bufferAttributes.positions.length / 3}
                        args={[bufferAttributes.positions, 3]}
                    />
                </bufferGeometry>
                <lineBasicMaterial color="#00ffff" opacity={0.3} transparent linewidth={1} />
            </lineSegments>
            
        </group>
    );
};



import * as THREE from "three";

export default OrbitPath;
