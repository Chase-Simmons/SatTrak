"use client";

import React, { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import * as satellite from "satellite.js";
import { useSatelliteStore } from "../hooks/useSatelliteStore";
import { useShallow } from 'zustand/react/shallow';

const satLib = satellite as any;

const SCALE_FACTOR = 1 / 1000;
const SEGMENTS = 256; 

const HoverOrbit = () => {
    const { hoveredId, satrecCache } = useSatelliteStore(useShallow(state => ({
        hoveredId: state.hoveredId,
        satrecCache: state.satrecCache
    })));

    const geometryRef = useRef<THREE.BufferGeometry>(null);
    const lineRef = useRef<THREE.Line>(null);

    // Re-calculate orbit ONLY when hoveredId changes
    useEffect(() => {
        if (!hoveredId || !geometryRef.current || !lineRef.current) {
            if (lineRef.current) lineRef.current.visible = false;
            return;
        }

        const rec = satrecCache.get(hoveredId);
        if (!rec) {
             lineRef.current.visible = false;
             return;
        }

        const points: number[] = [];
        const now = new Date();
        
        // Calculate Period
        const meanMotionRadMin = rec.no; 
        const periodMin = (2 * Math.PI) / meanMotionRadMin;
        
        // Propagate one full orbit
        for (let i = 0; i <= SEGMENTS; i++) {
            const timeOffset = (i / SEGMENTS) * periodMin; 
            const time = new Date(now.getTime() + timeOffset * 60000);
            
            const pv = satLib.propagate(rec, time);
            if (pv && pv.position && typeof pv.position !== 'boolean') {
                const p = pv.position;
                points.push(p.x * SCALE_FACTOR);
                points.push(p.z * SCALE_FACTOR); // Swap Y/Z for Three.js
                points.push(-p.y * SCALE_FACTOR);
            }
        }

        const positions = new Float32Array(points);
        geometryRef.current.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometryRef.current.setDrawRange(0, positions.length / 3);
        geometryRef.current.attributes.position.needsUpdate = true;
        
        lineRef.current.visible = true;

    }, [hoveredId, satrecCache]);

    return (
        <line ref={lineRef as any}>
            <bufferGeometry ref={geometryRef} />
            <lineBasicMaterial 
                color="#e4e4e7" 
                transparent 
                opacity={0.7}
                linewidth={2.5} 
                depthWrite={false}
            />

        </line>
    );
};

export default HoverOrbit;
