"use client";

import React, { useMemo, useRef, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, BufferAttribute, BufferGeometry } from "three";
import * as satellite from "satellite.js";
import { useSatelliteStore, SatelliteTle } from "../hooks/useSatelliteStore";

// @ts-ignore
const satLib = satellite as any;

const SCALE_FACTOR = 1 / 1000;
const SEGMENTS = 32; // Reduce segments for 10k scaling
const POINTS_PER_SAT = (SEGMENTS - 1) * 2;
const BATCH_SIZE = 100; 
const MAX_ORBITS = 10000; 

const OrbitPath = () => {
    const { tles, tleMap, selectedIds, showOrbits, satrecCache } = useSatelliteStore();
    const { camera } = useThree();
    
    // Derived selected list using tleMap for O(1) lookup
    const selectedSats = useMemo(() => {
        if (!selectedIds || !selectedIds.length) return [];
        return selectedIds.map(id => tleMap.get(id)).filter(Boolean) as SatelliteTle[];
    }, [tleMap, selectedIds]);

    const geometryRef = useRef<BufferGeometry>(null);
    const queueRef = useRef<{sat: SatelliteTle, index: number, rec: any}[]>([]);
    const processingRef = useRef(false);
    const [renderedCount, setRenderedCount] = useState(0);
    const prevSelectedIdsRef = useRef<number[]>([]);
    const processedIdsRef = useRef<Set<number>>(new Set());

    // Pre-allocate massive buffer for 10,000 satellites
    const bufferAttributes = useMemo(() => {
        const totalVertices = MAX_ORBITS * POINTS_PER_SAT;
        const positions = new Float32Array(totalVertices * 3);
        return { positions, totalVertices };
    }, []);

    const lastSort = useRef(0);
    const lastRefreshTime = useRef(0);
    const sortingIndex = useRef(0);
    const candidatesBuffer = useRef<{sat: SatelliteTle, distSq: number, rec: any}[]>([]);
    
    // Manage Orbit Generation
    useEffect(() => {
        const prev = prevSelectedIdsRef.current;
        const curr = selectedIds;
        
        // 1. Check for literal selection changes (Hard Reset or Expansion)
        const hasSelectionChanged = prev.length !== curr.length || !prev.every(id => curr.includes(id));
        
        if (hasSelectionChanged) {
            const isExpanding = prev.length > 0 && curr.length > prev.length && prev.every(id => curr.includes(id));
            
            if (isExpanding) {
                // APPPEND NEW SELECTION
                const newIds = curr.filter(id => !prev.includes(id));
                const newJobs = newIds.map(id => {
                    const sat = tleMap.get(id);
                    const rec = satrecCache.get(id);
                    if (sat && rec) {
                        processedIdsRef.current.add(id);
                        return { sat, rec };
                    }
                    return null;
                }).filter(Boolean) as {sat: SatelliteTle, rec: any}[];

                const currentBaseIndex = renderedCount;
                const appendJobs = newJobs.map((j, i) => ({ 
                    sat: j.sat, 
                    index: currentBaseIndex + i, 
                    rec: j.rec 
                }));
                
                queueRef.current = [...queueRef.current, ...appendJobs];
                processingRef.current = true;
            } else {
                // HARD RESET (Significant change or cleaning)
                processedIdsRef.current.clear();
                const initialJobs = curr.map((id, i) => {
                    const sat = tleMap.get(id);
                    const rec = satrecCache.get(id);
                    if (sat && rec) {
                        processedIdsRef.current.add(id);
                        return { sat, index: i, rec };
                    }
                    return null;
                }).filter(Boolean) as {sat: SatelliteTle, index: number, rec: any}[];

                queueRef.current = initialJobs;
                processingRef.current = true;
                setRenderedCount(0);
            }
            prevSelectedIdsRef.current = [...curr];
        } else {
            // 2. Cache Pickup: Selection is the same, but maybe some satrecs finished loading
            const pendingIds = curr.filter(id => !processedIdsRef.current.has(id));
            if (pendingIds.length > 0) {
                const newAvailable = pendingIds.map(id => {
                    const sat = tleMap.get(id);
                    const rec = satrecCache.get(id);
                    if (sat && rec) {
                        processedIdsRef.current.add(id);
                        return { sat, rec };
                    }
                    return null;
                }).filter(Boolean) as {sat: SatelliteTle, rec: any}[];

                if (newAvailable.length > 0) {
                    const appendJobs = newAvailable.map((j, i) => ({ 
                        sat: j.sat, 
                        index: renderedCount + i, 
                        rec: j.rec 
                    }));
                    queueRef.current = [...queueRef.current, ...appendJobs];
                    processingRef.current = true;
                }
            }
        }
    }, [selectedIds, satrecCache, tleMap]);

    useFrame(({ clock }) => {
        if (!showOrbits) return;

        const now = clock.getElapsedTime();

        // 1. Process Generation Queue (Progressive Reveal)
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
             
             // Update visibility count only if we are in a "fresh" build
             if (renderedCount < selectedSats.length) {
                setRenderedCount(prev => Math.min(prev + batch.length, selectedSats.length));
             }

             if (queueRef.current.length === 0) processingRef.current = false;
        } else if (!processingRef.current && selectedSats.length > 0) {
            // 2. Periodic Refresh: Keep paths synced with moving satellites
            // Check every 20 seconds to shift the start of the lines to "now"
            if (now - lastRefreshTime.current > 20) {
                lastRefreshTime.current = now;
                const results = selectedSats.map(sat => ({ 
                    sat, 
                    rec: satrecCache.get(sat.id) 
                })).filter(r => r.rec);
                
                queueRef.current = results.map((r, i) => ({ sat: r.sat, index: i, rec: r.rec }));
                processingRef.current = true;
                // No setRenderedCount(0) here = No flicker!
            }
        }
        
        if (geometryRef.current) {
            geometryRef.current.setDrawRange(0, renderedCount * POINTS_PER_SAT);
        }
    });

    return (
        <group>
            <lineSegments frustumCulled={false}>
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
