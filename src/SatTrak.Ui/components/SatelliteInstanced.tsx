"use client";

import React, { useEffect, useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Object3D, Vector3, Color } from "three";
import * as satellite from "satellite.js";
import { filterSatellites } from "../utils/SatelliteSearch";
import { useSatelliteStore, SatelliteTle } from "../hooks/useSatelliteStore";
import { getOrbitClass, getOrbitColor } from "../utils/OrbitalMath";

// @ts-ignore
const satLib = satellite as any;

const EARTH_RADIUS_KM = 6371;
const SCALE_FACTOR = 1 / 1000;
const MAX_INSTANCES = 50000;

const SatelliteInstanced = () => {
    const { tles, searchQuery, selectedIds, satrecCache } = useSatelliteStore();
    const meshRef = useRef<InstancedMesh>(null);
    const tempObject = useMemo(() => new Object3D(), []);
    const color = useMemo(() => new Color(), []);
    
    // Optimized lookup for selection
    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

    // Parse TLEs into SatRecords (Filtered)
    const allMatchingRecords = useMemo(() => {
        const list = filterSatellites(tles, searchQuery);
        
        return list.map(tle => {
            const rec = satrecCache.get(tle.id);
            if (!rec) return null;
            return { id: tle.id, rec };
        }).filter(Boolean) as any[];
    }, [tles, searchQuery, satrecCache]);

    // PROGRESSIVE LOADING REF (Avoids state-driven re-renders)
    const currentVisibleCount = useRef(0);
    const updateIndex = useRef(0);
    const prevRecordsRef = useRef<SatelliteTle[]>([]);
    const CHUNK_SIZE = 500; 

    useEffect(() => {
        const prev = prevRecordsRef.current;
        const current = allMatchingRecords;
        
        // Expansion Check: Is the new list a superset of the old one?
        // Specifically, for "Clear Filter", the old list is usually a subset.
        const isExpanding = prev.length > 0 && current.length > prev.length && 
                           prev[0]?.id === current[0]?.id && 
                           prev[prev.length-1]?.id === current[prev.length-1]?.id;

        if (isExpanding) {
            // Keep currentVisibleCount and updateIndex! Seamless expansion.
        } else {
            // Significant change or shrinking: Reset to show fresh data
            currentVisibleCount.current = 0;
            updateIndex.current = 0;
            
            if (meshRef.current) {
                for (let i = 0; i < MAX_INSTANCES; i++) {
                    tempObject.position.set(0, 0, 0);
                    tempObject.scale.setScalar(0);
                    tempObject.updateMatrix();
                    meshRef.current.setMatrixAt(i, tempObject.matrix);
                }
                meshRef.current.instanceMatrix.needsUpdate = true;
            }
        }
        
        prevRecordsRef.current = allMatchingRecords;
    }, [allMatchingRecords]);

    useFrame(({ clock }) => {
        const mesh = meshRef.current;
        if (!mesh || allMatchingRecords.length === 0) return;

        // 1. Progressively increase visibility (Slower for better interp)
        if (currentVisibleCount.current < allMatchingRecords.length) {
            currentVisibleCount.current = Math.min(currentVisibleCount.current + 100, allMatchingRecords.length);
        }

        const activeTotal = currentVisibleCount.current;
        const start = updateIndex.current;
        const end = Math.min(start + CHUNK_SIZE, activeTotal);

        const now = new Date();
        for (let i = 0; i < activeTotal; i++) {
            // Only update positions for the current chunk to save CPU
            const isNewInStream = i >= start && i < end;
            const isRegularUpdate = i % 10 === (clock.getElapsedTime() * 10 | 0) % 10; 

            if (isNewInStream || isRegularUpdate) {
                const sat = allMatchingRecords[i];
                const pv = satLib.propagate(sat.rec, now);
                
                if (pv && pv.position && typeof pv.position !== 'boolean') {
                    const p = pv.position;
                    tempObject.position.set(p.x * SCALE_FACTOR, p.z * SCALE_FACTOR, -p.y * SCALE_FACTOR);

                    // selection coloring
                    const isSelected = selectedSet.has(sat.id);
                    let scale = 1.0;
                    if (isSelected) {
                        color.setHex(0xffffff);
                        scale = 1.5;
                    } else {
                        const rKm = Math.sqrt(p.x*p.x + p.y*p.y + p.z*p.z);
                        const altKm = rKm - EARTH_RADIUS_KM;
                        const orbClass = getOrbitClass(altKm);
                        color.set(getOrbitColor(orbClass));
                        scale = orbClass === 'LEO' ? 1.0 : orbClass === 'MEO' ? 1.5 : 2.0;
                    }
                    
                    tempObject.scale.setScalar(scale); 
                    tempObject.updateMatrix();
                    mesh.setMatrixAt(i, tempObject.matrix);
                    mesh.setColorAt(i, color);
                }
            }
        }

        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        updateIndex.current = end >= activeTotal ? 0 : end;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_INSTANCES]}>
            <sphereGeometry args={[0.03, 6, 6]} />
            <meshBasicMaterial color="#ffffff" />
        </instancedMesh>
    );
};

export default SatelliteInstanced;
