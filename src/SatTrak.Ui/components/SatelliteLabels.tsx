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

const satLib = satellite as any;

const SCALE_FACTOR = 1 / 1000;

interface LabelProps {
    satellite: any;
    satRec: any;
    initialPos: Vector3; 
}

const SpeechBubble = ({ text, visible = true }: { text: string, visible?: boolean }) => (
    <div style={{
        color: '#a3e635',
        fontSize: '10px', 
        fontFamily: 'monospace',
        background: 'rgba(5, 10, 20, 1)',
        border: '1px solid rgba(163, 230, 53, 0.6)',
        padding: '2px 8px',
        borderRadius: '4px',
        whiteSpace: 'nowrap',
        transform: 'translateY(-26px)',
        boxShadow: '0 4px 8px rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        fontWeight: 'bold',
        display: visible ? 'block' : 'none'
    }}>
        {text}
        <div style={{
            position: 'absolute',
            left: '50%',
            top: '101%',
            width: '10px',
            height: '10px',
            background: 'rgba(5, 10, 20, 1)',
            borderBottom: '1px solid rgba(163, 230, 53, 0.6)',
            borderRight: '1px solid rgba(163, 230, 53, 0.6)',
            transform: 'translateX(-50%) translateY(-43%) rotate(45deg)',
            zIndex: 10
        }} />
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
            <Html center distanceFactor={15} style={{ pointerEvents: 'none' }} zIndexRange={[100, 0]} occlude={false}>
                <SpeechBubble text={satellite.name || `SAT-${satellite.id}`} />
            </Html>
        </group>
    );
};

const HoverLabel = () => {
    const hoveredId = useSatelliteStore(s => s.hoveredId);
    const hoverPosition = useSatelliteStore(s => s.hoverPosition);
    const showLabels = useSatelliteStore(s => s.showLabels);
    const { camera } = useThree();
    const groupRef = useRef<THREE.Group>(null);
    const labelRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    const lastHoverIdRef = useRef<{ id: number | null, hideFrames: number }>({ id: null, hideFrames: 0 });

    // Direct DOM update loop for zero-latency text
    useFrame(() => {
        if (!showLabels || !groupRef.current) return;
        
        const state = useSatelliteStore.getState();
        const currentHoverId = state.hoveredId;
        const currentHoverPos = state.hoverPosition;
        
        // Anti-Ghosting
        if (currentHoverId !== lastHoverIdRef.current.id) {
             lastHoverIdRef.current.id = currentHoverId;
             lastHoverIdRef.current.hideFrames = 3;
        }

        let activeRec = null;
        if (currentHoverId) {
             activeRec = state.satrecCache.get(currentHoverId);
        }

        let x, y, z;

        if (activeRec) {
            const now = new Date();
            const pv = satLib.propagate(activeRec, now);
            if (pv.position && typeof pv.position !== 'boolean') {
                const p = pv.position;
                x = p.x * SCALE_FACTOR;
                y = p.z * SCALE_FACTOR;
                z = -p.y * SCALE_FACTOR;
            }
        } else if (currentHoverPos) {
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

        // DOM Updates
        if (labelRef.current && textRef.current) {
            if (currentHoverId) {
                const sat = state.tleMap.get(currentHoverId);
                const newText = sat ? (sat.name || `SAT-${sat.id}`) : `SAT-${currentHoverId}`;
                
                if (textRef.current.innerText !== newText) {
                    textRef.current.innerText = newText;
                }

                if (lastHoverIdRef.current.hideFrames > 0) {
                    labelRef.current.style.display = 'none';
                    lastHoverIdRef.current.hideFrames--;
                } else {
                    labelRef.current.style.display = 'block';
                }
            } else {
                 labelRef.current.style.display = 'none';
            }
        }
    });

    if (!showLabels) return null;

    return (
        <group ref={groupRef}>
            <Html center distanceFactor={15} style={{ pointerEvents: 'none' }} zIndexRange={[1000, 500]} occlude={false}>
                <div ref={labelRef} style={{
                    color: '#e4e4e7',
                    fontSize: '10px', 
                    fontFamily: 'monospace',
                    background: 'rgba(5, 10, 20, 1)',
                    border: '1px solid rgba(228, 228, 231, 0.6)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    transform: 'translateY(-26px)',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(4px)',
                    fontWeight: 'bold',
                    display: 'none'
                }}>
                    <div ref={textRef}>INITIALIZING...</div>
                    <div style={{
                        position: 'absolute',
                        left: '50%',
                        top: '101%',
                        width: '10px',
                        height: '10px',
                        background: 'rgba(5, 10, 20, 1)',
                        borderBottom: '1px solid rgba(228, 228, 231, 0.6)',
                        borderRight: '1px solid rgba(228, 228, 231, 0.6)',
                        transform: 'translateX(-50%) translateY(-43%) rotate(45deg)',
                        zIndex: 10
                    }} />
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

    // Force instant update when selection changes
    React.useEffect(() => {
        lastUpdate.current = 0;
    }, [selectedSats]);

    useFrame((state) => {
        if (!showLabels || selectedSats.length === 0) {
            if (visibleLabels.length > 0) setVisibleLabels([]);
            return;
        }

        const now = state.clock.getElapsedTime();

        // ADAPTIVE THROTTLE: Sync exact frame for small selections, throttle for large clouds
        const throttle = selectedSats.length < 5 ? 0.0 : 0.25;

        if (now - lastUpdate.current < throttle) return;
        
        lastUpdate.current = now;

        const date = new Date();
        const camPos = camera.position;
        const R = EARTH_RADIUS_OCLUDE;
        const currentHoverId = useSatelliteStore.getState().hoveredId;

        const candidates: any[] = [];
        
        for (let i = 0; i < selectedSats.length; i++) {
            const sat = selectedSats[i];
            
            
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
        const newSubset = candidates.slice(0, maxLabels);

        // OPTIMIZATION: Only update state if the LIST of satellites changes.
        // Ignore position changes, as SingleLabel handles its own animation via useFrame.
        let hasChanged = newSubset.length !== visibleLabels.length;
        if (!hasChanged) {
            for (let i = 0; i < newSubset.length; i++) {
                if (newSubset[i].sat.id !== visibleLabels[i].sat.id) {
                    hasChanged = true;
                    break;
                }
            }
        }

        if (hasChanged) {
            setVisibleLabels(newSubset);
        }
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
