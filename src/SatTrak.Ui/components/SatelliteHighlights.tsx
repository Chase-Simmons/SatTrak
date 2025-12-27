"use client";

import React, { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as satellite from "satellite.js";
import { useSatelliteStore } from "../hooks/useSatelliteStore";
import * as THREE from "three";

const satLib = satellite as any;
const SCALE_FACTOR = 1 / 1000;
const MAX_HIGHLIGHTS = 10000;

const SatelliteHighlights = () => {
    const { tleMap, selectedIds, satrecCache } = useSatelliteStore();
    const updateIndex = useRef(0);
    const CHUNK_SIZE = 500;

    const selectedSats = useMemo(() => {
        if (!selectedIds.length) return [];
        return selectedIds.map(id => {
            const tle = tleMap.get(id);
            const rec = satrecCache.get(id);
            return tle && rec ? { ...tle, rec } : null;
        }).filter(Boolean) as any[];
    }, [tleMap, selectedIds, satrecCache]);

    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);

    // Reset buffer visibility when selection clears
    useEffect(() => {
        if (selectedIds.length === 0 && meshRef.current) {
            meshRef.current.count = 0;
            meshRef.current.instanceMatrix.needsUpdate = true;
        }
    }, [selectedIds.length]);

    useFrame(({ clock }) => {
        const mesh = meshRef.current;
        if (!mesh) return;
        
        const total = selectedSats.length;
        mesh.count = total;

        if (total === 0) return;
        
        const start = updateIndex.current;
        const end = Math.min(start + CHUNK_SIZE, total);
        const now = new Date();

        for (let i = 0; i < total; i++) {
             const isNewInStream = i >= start && i < end;
             const isRegularUpdate = i % 10 === (clock.getElapsedTime() * 10 | 0) % 10;

             if (isNewInStream || isRegularUpdate) {
                const sat = selectedSats[i];
                const pv = satLib.propagate(sat.rec, now);
                
                if (pv && pv.position && typeof pv.position !== 'boolean') {
                    const p = pv.position;
                    dummy.position.set(p.x * SCALE_FACTOR, p.z * SCALE_FACTOR, -p.y * SCALE_FACTOR);
                    dummy.scale.setScalar(0.8); 
                    dummy.updateMatrix();
                    mesh.setMatrixAt(i, dummy.matrix);
                }
             }
        }
        mesh.instanceMatrix.needsUpdate = true;
        updateIndex.current = end >= total ? 0 : end;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_HIGHLIGHTS]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshBasicMaterial color="#00B2B2" wireframe transparent opacity={0.6} />
        </instancedMesh>
    );
};

export default SatelliteHighlights;
