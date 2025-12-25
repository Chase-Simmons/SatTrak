"use client";

import React, { useEffect, useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Object3D, Vector3, Color } from "three";
import * as satellite from "satellite.js";
import { useSatelliteStore } from "../hooks/useSatelliteStore";

// @ts-ignore
const satLib = satellite as any;

const EARTH_RADIUS_KM = 6371;
const SCALE_FACTOR = 1 / 1000;
const EARTH_RADIUS_VIEW = 6.371;

const SatelliteInstanced = () => {
    const { tles, searchQuery } = useSatelliteStore();
    const meshRef = useRef<InstancedMesh>(null);
    const tempObject = useMemo(() => new Object3D(), []);

    // Parse TLEs into SatRecords (Filtered)
    const satRecords = useMemo(() => {
        let list = tles;
        if (searchQuery.trim().length > 0) {
            const upQ = searchQuery.toUpperCase(); // Optim: most satellite names are UPPERCASE
             // Fallback to simpler check for perf on 27k items
            list = list.filter(t => t.name.includes(upQ) || t.id.toString().includes(upQ));
        }

        return list.map(tle => ({
            id: tle.id,
            rec: satLib.twoline2satrec(tle.line1, tle.line2)
        })).filter(s => s.rec); // Ensure valid records
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

                // Color & Scale by Altitude
                // ECI position vector magnitude in km
                const rKm = Math.sqrt(pos.x*pos.x + pos.y*pos.y + pos.z*pos.z);
                const altKm = rKm - EARTH_RADIUS_KM;

                let scale = 1.0;

                if (altKm < 2000) {
                    color.setHex(0x00ff00); // LEO: Green
                    scale = 1.0;
                } else if (altKm < 30000) {
                    color.setHex(0x00ffff); // MEO: Cyan
                    scale = 1.5; // Make MEO larger
                } else {
                    color.setHex(0xff0000); // GEO: Red
                    scale = 2.0; // Make GEO largest
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
