"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as satellite from "satellite.js";
import { useSatelliteStore } from "../hooks/useSatelliteStore";
import * as THREE from "three";

// @ts-ignore
const satLib = satellite as any;
const SCALE_FACTOR = 1 / 1000;

const SatelliteHighlights = () => {
    const { tles, selectedIds } = useSatelliteStore();

    // Map selected IDs to TLE objects
    const selectedSats = useMemo(() => {
        if (!selectedIds.length) return [];
        return tles.filter(t => selectedIds.includes(t.id));
    }, [tles, selectedIds]);

    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);

    useFrame(() => {
        if (!meshRef.current || selectedSats.length === 0) return;
        const now = new Date();
        let count = 0;

        selectedSats.forEach((sat, i) => {
             const rec = satLib.twoline2satrec(sat.line1, sat.line2);
             if(!rec) return;
             const pv = satLib.propagate(rec, now);
             if (pv.position && typeof pv.position !== 'boolean') {
                const p = pv.position;
                dummy.position.set(p.x * SCALE_FACTOR, p.z * SCALE_FACTOR, -p.y * SCALE_FACTOR);
                
                // Scale larger than the dot (Dot is 4.0 or 1.5)
                // Fixed scale to match standardized dot size (1.5 * 0.03 = 0.045 vs 0.8 * 0.08 = 0.064)
                const scale = 0.8;
                dummy.scale.setScalar(scale); 
                dummy.updateMatrix();
                meshRef.current.setMatrixAt(i, dummy.matrix);
                count++;
             }
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
        meshRef.current.count = count;
    });

    if (selectedSats.length === 0) return null;

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, selectedSats.length]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshBasicMaterial color="#00B2B2" wireframe />
        </instancedMesh>
    );
};

export default SatelliteHighlights;
