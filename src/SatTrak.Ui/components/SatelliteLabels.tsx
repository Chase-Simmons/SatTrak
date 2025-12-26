"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as satellite from "satellite.js";
import { useSatelliteStore } from "../hooks/useSatelliteStore";
import { useShallow } from 'zustand/react/shallow';
import { Vector3 } from "three";
import * as THREE from "three";

const EARTH_RADIUS_OCLUDE = 6.371;

// @ts-ignore
const satLib = satellite as any;

const SCALE_FACTOR = 1 / 1000;

interface LabelProps {
    satellite: any;
    satRec: any;
    initialPos: Vector3; 
}

const LabelUI = ({ name }: { name: string }) => (
    <div style={{
        color: '#22d3ee',
        fontSize: '10px', 
        fontFamily: 'monospace',
        background: 'rgba(5, 10, 20, 0.95)',
        border: '1px solid rgba(34, 211, 238, 0.4)',
        padding: '2px 8px',
        borderRadius: '4px',
        whiteSpace: 'nowrap',
        transform: 'translateY(-26px)',
        boxShadow: '0 4px 8px rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        fontWeight: 'bold'
    }}>
        {name}
    </div>
);

const SingleLabel = ({ satellite, satRec, initialPos }: LabelProps) => {
    const groupRef = useRef<THREE.Group>(null);

    useEffect(() => {
        if (groupRef.current) {
            groupRef.current.position.copy(initialPos);
        }
    }, [initialPos]);

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
            <Html 
                center 
                distanceFactor={15} 
                style={{ pointerEvents: 'none' }}
                zIndexRange={[100, 0]} 
            >
                <div style={{
                    color: '#22d3ee',
                    fontSize: '10px', 
                    fontFamily: 'monospace',
                    background: 'rgba(5, 10, 20, 0.85)',
                    border: '1px solid rgba(34, 211, 238, 0.3)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    transform: 'translateY(-24px)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(2px)'
                }}>
                    {satellite.name || `SAT-${satellite.id}`}
                </div>
            </Html>
        </group>
    );
};

const HoverLabel = () => {
    const hoveredId = useSatelliteStore(s => s.hoveredId);
    const hoverPosition = useSatelliteStore(s => s.hoverPosition);
    const tleMap = useSatelliteStore(s => s.tleMap);
    const showLabels = useSatelliteStore(s => s.showLabels);
    const { camera } = useThree();
    const groupRef = useRef<THREE.Group>(null);
    const labelRef = useRef<HTMLDivElement>(null);

    // Direct DOM update loop for zero-latency text
    useFrame(() => {
        if (!showLabels || !groupRef.current) return;
        
        const state = useSatelliteStore.getState();
        const currentHoverId = state.hoveredId;
        const currentHoverPos = state.hoverPosition;
        
        // 1. Update Text Content Directly (Bypassing React Reconciliation)
        if (labelRef.current) {
            if (currentHoverId) {
                const sat = state.tleMap.get(currentHoverId);
                // Force text update every frame to match store state instantly
                const newText = sat ? (sat.name || `SAT-${sat.id}`) : `SAT-${currentHoverId}`;
                if (labelRef.current.innerText !== newText) {
                    labelRef.current.innerText = newText;
                }
                labelRef.current.style.display = 'block';
            } else {
                 labelRef.current.style.display = 'none';
            }
        }

        // 2. Resolve Satellite Data for Position
        let activeRec = null;
        if (currentHoverId) {
             activeRec = state.satrecCache.get(currentHoverId);
        }

        let x, y, z;

        if (activeRec) {
            // High fidelity propagation
            const now = new Date();
            const pv = satLib.propagate(activeRec, now);
            if (pv.position && typeof pv.position !== 'boolean') {
                const p = pv.position;
                x = p.x * SCALE_FACTOR;
                y = p.z * SCALE_FACTOR;
                z = -p.y * SCALE_FACTOR;
            }
        } else if (currentHoverPos) {
            // Low latency fallback for first frames / loading phase
            [x, y, z] = currentHoverPos;
        }

        if (x !== undefined && y !== undefined && z !== undefined) {
            const v = new Vector3(x, y, z);
            if (isOccludedByEarth(v, camera.position, EARTH_RADIUS_OCLUDE)) {
                groupRef.current.visible = false;
            } else {
                groupRef.current.visible = true;
                groupRef.current.position.set(x, y, z);
            }
        }
    });

    if (!showLabels) return null;

    return (
        <group ref={groupRef}>
            <Html center distanceFactor={15} style={{ pointerEvents: 'none' }} zIndexRange={[1000, 500]}>
                 <div ref={labelRef} style={{
                    color: '#22d3ee',
                    fontSize: '10px', 
                    fontFamily: 'monospace',
                    background: 'rgba(5, 10, 20, 0.95)',
                    border: '1px solid rgba(34, 211, 238, 0.4)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    transform: 'translateY(-26px)',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(4px)',
                    fontWeight: 'bold',
                    display: 'none' // Hidden by default, shown by loop
                }}>
                    INITIALIZING...
                </div>
            </Html>
        </group>
    );
};

const isOccludedByEarth = (P: Vector3, C: Vector3, R: number) => {
    const L = new Vector3().subVectors(P, C);
    const a = L.dot(L);
    const b = 2 * C.dot(L);
    const c = C.dot(C) - R * R;
    
    const D = b * b - 4 * a * c;
    if (D < 0) return false;
    if (b >= 0) return false;
    
    const t = (-b - Math.sqrt(D)) / (2 * a);
    return t >= 0 && t <= 1;
};

const SatelliteLabels = () => {
    const { tleMap, selectedIds, showLabels } = useSatelliteStore(useShallow(state => ({
        tleMap: state.tleMap,
        selectedIds: state.selectedIds,
        showLabels: state.showLabels
    })));
    const { camera } = useThree();
    
    const [visibleLabels, setVisibleLabels] = useState<{sat: any, rec: any, pos: Vector3}[]>([]);
    const lastUpdate = useRef(0);

    const selectedSats = useMemo(() => {
        if (!selectedIds || !selectedIds.length) return [];
        return selectedIds.map(id => tleMap.get(id)).filter(Boolean) as any[];
    }, [tleMap, selectedIds]);

    useFrame((state) => {
        if (!showLabels || selectedSats.length === 0) {
            if (visibleLabels.length > 0) setVisibleLabels([]);
            return;
        }

        const now = state.clock.getElapsedTime();
        if (now - lastUpdate.current < 0.25) return;
        
        lastUpdate.current = now;

        const date = new Date();
        const camPos = camera.position;
        const R = EARTH_RADIUS_OCLUDE;
        const currentHoverId = useSatelliteStore.getState().hoveredId;

        const candidates: any[] = [];
        
        for (let i = 0; i < selectedSats.length; i++) {
            const sat = selectedSats[i];
            if (sat.id === currentHoverId) continue;
            
            const rec = useSatelliteStore.getState().satrecCache.get(sat.id);
            if (!rec) continue;
            
            const pv = satLib.propagate(rec, date);
            if (pv && pv.position && typeof pv.position !== 'boolean') {
                const p = pv.position;
                const v = new Vector3(p.x * SCALE_FACTOR, p.z * SCALE_FACTOR, -p.y * SCALE_FACTOR);
                
                if (isOccludedByEarth(v, camPos, R)) continue;
                
                const dist = v.distanceTo(camPos);
                candidates.push({ sat, rec, pos: v, dist });
            }
        }

        if (candidates.length === 0) {
            if (visibleLabels.length > 0) setVisibleLabels([]);
            return;
        }

        candidates.sort((a, b) => a.dist - b.dist);
        const maxLabels = selectedSats.length > 200 ? 15 : 40; 
        setVisibleLabels(candidates.slice(0, maxLabels));
    });

    if (!showLabels) return null;

    return (
        <group>
            {/* Force component remount on ID change to prevent stale text */}
            <HoverLabel />

            {visibleLabels.map(item => (
                <SingleLabel 
                    key={item.sat.id} 
                    satellite={item.sat} 
                    satRec={item.rec}
                    initialPos={item.pos}
                />
            ))}
        </group>
    );
};

export default SatelliteLabels;
