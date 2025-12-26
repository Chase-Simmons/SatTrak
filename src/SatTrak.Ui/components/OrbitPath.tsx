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
    const { tles, selectedIds, showOrbits, satrecCache } = useSatelliteStore();
    const { camera } = useThree();
    
    // Derived selected list
    const selectedSats = useMemo(() => {
        if (!selectedIds || !selectedIds.length) return [];
        return selectedIds.map(id => tles.find(t => t.id === id)).filter(Boolean) as SatelliteTle[];
    }, [tles, selectedIds]);

    const geometryRef = useRef<BufferGeometry>(null);
    
    // Queue now stores the active subset
    const queueRef = useRef<{sat: SatelliteTle, index: number, rec: any}[]>([]);
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
    
    // --- Progressive Sorting ---
    const sortingIndex = useRef(0);
    const candidatesBuffer = useRef<{sat: SatelliteTle, distSq: number, rec: any}[]>([]);
    
    useFrame(({ clock }) => {
        if (!showOrbits || selectedSats.length === 0) return;

        const now = clock.getElapsedTime();
        
        // 1. Process Generation Queue (Already Batched)
        if (processingRef.current && geometryRef.current && queueRef.current.length > 0) {
             const batch = queueRef.current.splice(0, BATCH_SIZE);
             const positions = bufferAttributes.positions;
             const startTime = new Date();
             
             batch.forEach(({ sat, index, rec }) => {
                const meanMotionRadMin = rec.no; 
                const periodMin = (2 * Math.PI) / meanMotionRadMin;
                
                let prevX = 0, prevY = 0, prevZ = 0;
                let firstPass = true;
                let offset = index * POINTS_PER_SAT * 3;

                for (let i = 0; i < SEGMENTS; i++) {
                    const timeOffset = (i / (SEGMENTS - 1)) * periodMin; 
                    const time = new Date(startTime.getTime() + timeOffset * 60000);
                    const pv = satLib.propagate(rec, time);
                    if (pv && pv.position && typeof pv.position !== 'boolean') {
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
             geometryRef.current.setDrawRange(0, activeSats.length * POINTS_PER_SAT);

             if (queueRef.current.length === 0) processingRef.current = false;
             return;
        }

        // 2. Progressive Sorting (Prevents spike on long lists)
        const date = new Date();
        const camPos = camera.position;
        const SORT_BATCH_SIZE = 500;
        
        if (selectedSats.length > MAX_VISIBLE_ORBITS) {
            const start = sortingIndex.current;
            const end = Math.min(start + SORT_BATCH_SIZE, selectedSats.length);
            
            for (let i = start; i < end; i++) {
                const sat = selectedSats[i];
                const rec = satrecCache.get(sat.id);
                if (!rec) continue;
                const pv = satLib.propagate(rec, date);
                if (pv && pv.position && typeof pv.position !== 'boolean') {
                    const p = pv.position;
                    const dx = (p.x*SCALE_FACTOR) - camPos.x;
                    const dy = (p.z*SCALE_FACTOR) - camPos.y; 
                    const dz = (-p.y*SCALE_FACTOR) - camPos.z;
                    const distSq = dx*dx + dy*dy + dz*dz;
                    candidatesBuffer.current.push({ sat, distSq, rec });
                }
            }
            
            sortingIndex.current = end >= selectedSats.length ? 0 : end;
            
            // Cycle finished or list is processed
            if (sortingIndex.current === 0 && candidatesBuffer.current.length > 0) {
                candidatesBuffer.current.sort((a,b) => a.distSq - b.distSq);
                const results = candidatesBuffer.current.slice(0, MAX_VISIBLE_ORBITS);
                const topN = results.map(c => c.sat);
                
                // Refresh if needed
                const setChanged = topN.length !== activeSats.length || topN[0]?.id !== activeSats[0]?.id;
                if (setChanged || (now - lastRefreshTime.current > 30)) {
                    lastRefreshTime.current = now;
                    setActiveSats(topN);
                    queueRef.current = results.map((r, i) => ({ sat: r.sat, index: i, rec: r.rec }));
                    processingRef.current = true;
                }
                candidatesBuffer.current = []; // Reset for next cycle
            }
        } else {
            // Instant sort for small number of selections
            if (now - lastSort.current < 0.5) return;
            lastSort.current = now;
            
            const candidates = [];
            for (let i = 0; i < selectedSats.length; i++) {
                const sat = selectedSats[i];
                const rec = satrecCache.get(sat.id);
                if (!rec) continue;
                const pv = satLib.propagate(rec, date);
                if (pv && pv.position && typeof pv.position !== 'boolean') {
                    const p = pv.position;
                    const dx = (p.x*SCALE_FACTOR) - camPos.x;
                    const dy = (p.z*SCALE_FACTOR) - camPos.y; 
                    const dz = (-p.y*SCALE_FACTOR) - camPos.z;
                    candidates.push({ sat, distSq: dx*dx + dy*dy + dz*dz, rec });
                }
            }
            candidates.sort((a,b) => a.distSq - b.distSq);
            const topN = candidates.map(c => c.sat);
            
            if (topN.length !== activeSats.length || topN[0]?.id !== activeSats[0]?.id) {
                setActiveSats(topN);
                queueRef.current = candidates.map((c, i) => ({ sat: c.sat, index: i, rec: c.rec }));
                processingRef.current = true;
            }
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
