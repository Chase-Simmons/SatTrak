"use client";

import React, { useEffect, useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Object3D, Vector3, Color } from "three";
import * as satellite from "satellite.js";
import { filterSatellites } from "../utils/SatelliteSearch";
import { useSatelliteStore } from "../hooks/useSatelliteStore";

// @ts-ignore
const satLib = satellite as any;

const EARTH_RADIUS_KM = 6371;
const SCALE_FACTOR = 1 / 1000;
const EARTH_RADIUS_VIEW = 6.371;

const SatelliteInstanced = () => {
    const { tles, searchQuery, selectedIds } = useSatelliteStore();
    const meshRef = useRef<InstancedMesh>(null);
    const tempObject = useMemo(() => new Object3D(), []);

    // Optimized lookup for selection
    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

    // Parse TLEs into SatRecords (Filtered)
    const satRecords = useMemo(() => {
        const list = filterSatellites(tles, searchQuery);

        return list.map(tle => ({
            id: tle.id,
            rec: satLib.twoline2satrec(tle.line1, tle.line2)
        })).filter(s => s.rec); 
    }, [tles, searchQuery]);

    const color = useMemo(() => new Color(), []);

    const lastUpdate = useRef(0);

    useFrame(({ clock }) => {
        const t = clock.getElapsedTime();
        if (t - lastUpdate.current < 0.1) return; // Limit to 10 FPS
        lastUpdate.current = t;

        const mesh = meshRef.current;
        if (!mesh || satRecords.length === 0) return;

        const now = new Date();
        satRecords.forEach((sat, i) => {
            const positionAndVelocity = satLib.propagate(sat.rec, now);
            
            if (positionAndVelocity && positionAndVelocity.position && typeof positionAndVelocity.position !== 'boolean') {
                const pos = positionAndVelocity.position;
                
                // Scale math
                const x = pos.x * SCALE_FACTOR;
                const y = pos.z * SCALE_FACTOR; 
                const z = -pos.y * SCALE_FACTOR; 

                tempObject.position.set(x, y, z);

                const isSelected = selectedSet.has(sat.id);

                // Color & Scale
                let scale = 1.0;
                
                if (isSelected) {
                    color.setHex(0xffffff); // Selected: Bright White
                    // Smart Scaling: If too many selected, keep them smaller to prevent "hairball"
                    scale = 1.5; // Standardized size for all selections
                } else {
                    const rKm = Math.sqrt(pos.x*pos.x + pos.y*pos.y + pos.z*pos.z);
                    const altKm = rKm - EARTH_RADIUS_KM;

                    if (altKm < 2000) {
                        color.setHex(0x00B200); // LEO: Green
                        scale = 1.0;
                    } else if (altKm < 30000) {
                        color.setHex(0x00B2B2); // MEO: Cyan
                        scale = 1.5; 
                    } else {
                        color.setHex(0xFF0000); // GEO: Red
                        scale = 2.0; 
                    }
                }
                
                tempObject.scale.setScalar(scale); 
                tempObject.updateMatrix();
                mesh.setMatrixAt(i, tempObject.matrix);
                mesh.setColorAt(i, color);

            } else {
                // Hide if invalid
                tempObject.position.set(0, 0, 0);
                tempObject.scale.setScalar(0);
                tempObject.updateMatrix();
                mesh.setMatrixAt(i, tempObject.matrix);
            }
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });

    if (satRecords.length === 0) return null;

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, satRecords.length]}>
            <sphereGeometry args={[0.03, 6, 6]} />
            <meshBasicMaterial color="#ffffff" />
        </instancedMesh>
    );
};

export default SatelliteInstanced;
