"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as satellite from "satellite.js";
import { useSatelliteStore } from "../hooks/useSatelliteStore";
import { Vector3 } from "three";

// @ts-ignore
const satLib = satellite as any;

const SCALE_FACTOR = 1 / 1000;

interface LabelProps {
    satellite: any;
}

const SingleLabel = ({ satellite }: LabelProps) => {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);
    
    // Recalculate sat position every frame
    const satRec = useMemo(() => {
        if (!satellite) return null;
        return satLib.twoline2satrec(satellite.line1, satellite.line2);
    }, [satellite]);

    useFrame(() => {
        if (!satRec || !ref.current) return;
        
        const now = new Date();
        const pv = satLib.propagate(satRec, now);
        
        if (pv.position && typeof pv.position !== 'boolean') {
            // Update visibility flag once to show it
            if (!visible) setVisible(true);

            // Update DOM element position if needed? 
            // Actually <Html> does the positioning for us if we wrap it in a group or mesh that moves.
            // But propagating thousands of props to React components is slow.
            // However, useFrame updating a `ref` inside <Html> isn't standard because <Html> tracks a 3D position.
            // We need a wrapper object3d that moves.
        }
    });

    // To move the label with the satellite, we need a ref to a Group that holds the Html,
    // and we update that Group's position in useFrame.
    const groupRef = useRef<any>(null);

    useFrame(() => {
        if (!satRec || !groupRef.current) return;
        const now = new Date();
        const pv = satLib.propagate(satRec, now);
        if (pv.position && typeof pv.position !== 'boolean') {
            const p = pv.position;
            const x = p.x * SCALE_FACTOR;
            const y = p.z * SCALE_FACTOR;
            const z = -p.y * SCALE_FACTOR;
            groupRef.current.position.set(x, y, z);
        }
    });
    
    if (!satRec) return null;

    return (
        <group ref={groupRef}>
            <Html center distanceFactor={15} style={{ pointerEvents: 'none' }}>
                <div style={{
                    color: '#22d3ee',
                    fontSize: '8px', 
                    fontFamily: 'monospace',
                    background: 'rgba(0,0,0,0.7)',
                    padding: '2px 4px',
                    borderRadius: '2px',
                    whiteSpace: 'nowrap',
                    transform: 'translateY(-20px)' // Move above the dot
                }}>
                    {satellite.name || `SAT-${satellite.id}`}
                </div>
            </Html>
        </group>
    );
};

const SatelliteLabels = () => {
    const { tles, selectedIds, showLabels } = useSatelliteStore();

    // Map selected IDs to TLE objects
    const selectedSats = useMemo(() => {
        if (!selectedIds.length) return [];
        return tles.filter(t => selectedIds.includes(t.id));
    }, [tles, selectedIds]);

    if (!showLabels || selectedSats.length === 0) return null;

    // Safety Cap: Don't render more than 100 labels to avoid crashing WebGL/DOM
    const renderList = selectedSats.length > 200 ? selectedSats.slice(0, 200) : selectedSats;

    return (
        <group>
            {renderList.map(sat => (
                <SingleLabel key={sat.id} satellite={sat} />
            ))}
        </group>
    );
};

export default SatelliteLabels;
