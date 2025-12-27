"use client";

import React, { useEffect, useRef, useMemo, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Object3D, Color, Points, Vector2 } from "three";
import * as satellite from "satellite.js";
import { filterSatellites } from "../utils/SatelliteSearch";
import { useSatelliteStore } from "../hooks/useSatelliteStore";
import { getOrbitClass, getOrbitColor } from "../utils/OrbitalMath";
import { useShallow } from 'zustand/react/shallow';
import { perfState } from "../utils/PerformanceState";

// @ts-ignore
const satLib = satellite as any;

const EARTH_RADIUS_KM = 6371;
const SCALE_FACTOR = 1 / 1000;
const MAX_INSTANCES = 50000;

const SatelliteInstanced = () => {
    const { tles, searchQuery, selectedIds, satrecCache, setHoveredId, selectSingle, setFocusedId, isCameraRotating } = useSatelliteStore(useShallow(state => ({
        tles: state.tles,
        searchQuery: state.searchQuery,
        selectedIds: state.selectedIds,
        satrecCache: state.satrecCache,
        setHoveredId: state.setHoveredId,
        selectSingle: state.selectSingle,
        setFocusedId: state.setFocusedId,
        isCameraRotating: state.isCameraRotating
    })));
    const meshRef = useRef<InstancedMesh>(null);
    const hitProxyRef = useRef<Points>(null);
    const tempObject = useMemo(() => new Object3D(), []);
    const color = useMemo(() => new Color(), []);
    
    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

    const allMatchingRecords = useMemo(() => {
        return filterSatellites(tles, searchQuery);
    }, [tles, searchQuery]);

    const hitPositions = useMemo(() => new Float32Array(MAX_INSTANCES * 3), []);
    const hitIds = useMemo(() => new Float32Array(MAX_INSTANCES), []);

    const currentVisibleCount = useRef(0);

    const lastRaycastTime = useRef(0);
    const lastPointer = useRef(new Vector2(0, 0));
    const velocitySkip = useRef(false);

    const customRaycast = useCallback((raycaster: any, intersects: any[]) => {
        // Priority: forceCheck (Click) > isRotating (Drag) > Velocity (Fast Move)
        if (!perfState.forceCheck && (perfState.isRotating || velocitySkip.current)) return;

        // Throttle 20Hz
        const now = performance.now();
        if (!perfState.forceCheck && (now - lastRaycastTime.current < 25)) {
            return;
        }
        lastRaycastTime.current = now;

        Points.prototype.raycast.call(hitProxyRef.current as any, raycaster, intersects);
    }, []);

    useFrame(({ clock, raycaster, pointer }) => {
        const distSq = pointer.distanceToSquared(lastPointer.current);
        lastPointer.current.copy(pointer);
        velocitySkip.current = distSq > 0.0001;

        const mesh = meshRef.current;
        const proxy = hitProxyRef.current;
        if (!mesh || !proxy || allMatchingRecords.length === 0) return;

        raycaster.params.Points.threshold = 0.1;

        if (currentVisibleCount.current > allMatchingRecords.length) {
            currentVisibleCount.current = allMatchingRecords.length;
            
            for (let i = allMatchingRecords.length; i < MAX_INSTANCES; i++) {
                tempObject.position.set(0, 0, 0);
                tempObject.scale.setScalar(0);
                tempObject.updateMatrix();
                mesh.setMatrixAt(i, tempObject.matrix);
            }
        }

        // Accelerated ramp-up: 1000 per frame
        if (currentVisibleCount.current < allMatchingRecords.length) {
            currentVisibleCount.current = Math.min(currentVisibleCount.current + 1000, allMatchingRecords.length);
        }

        const activeTotal = currentVisibleCount.current;
        const now = new Date();
        const proxyPos = proxy.geometry.attributes.position as any;
        const proxyId = proxy.geometry.attributes.satId as any;

        for (let i = 0; i < activeTotal; i++) {
            const sat = allMatchingRecords[i];
            if (!sat) continue; 
            
            const rec = satrecCache.get(sat.id);
            
            if (rec) {
                const pv = satLib.propagate(rec, now);
                
                if (pv && pv.position && typeof pv.position !== 'boolean') {
                    const p = pv.position;
                    const x = p.x * SCALE_FACTOR;
                    const y = p.z * SCALE_FACTOR;
                    const z = -p.y * SCALE_FACTOR;

                    tempObject.position.set(x, y, z);
                    proxyPos.setXYZ(i, x, y, z);
                    if (proxyId) proxyId.setX(i, sat.id);

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
            } else {
                tempObject.position.set(0, 0, 0);
                tempObject.scale.setScalar(0);
                tempObject.updateMatrix();
                mesh.setMatrixAt(i, tempObject.matrix);
                proxyPos.setXYZ(i, 0, 0, 0);
                if (proxyId) proxyId.setX(i, -1);
            }
        }

        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        proxyPos.needsUpdate = true;
        if (proxyId) proxyId.needsUpdate = true;

        mesh.count = activeTotal; 
        proxy.geometry.setDrawRange(0, activeTotal);
    });

    const mouseDownPos = useRef<{ x: number, y: number } | null>(null);
    const downSatIdRef = useRef<number | null>(null);

    return (
        <group>
            <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_INSTANCES]} frustumCulled={false}>
                <sphereGeometry args={[0.035, 6, 6]} />
                <meshBasicMaterial transparent opacity={0.9} />
            </instancedMesh>

            <points 
                ref={hitProxyRef}
                raycast={customRaycast} 
                onPointerMove={(e) => {
                    e.stopPropagation();
                    if (e.index !== undefined) {
                        const geometry = (e.object as Points).geometry;
                        const idAttr = geometry.getAttribute('satId');
                        
                        // Strict Attribute Read: If GPU isn't ready, we don't interact.
                        // This prevents stale text from index guessing.
                        let satId = -1;
                        if (idAttr) {
                             satId = idAttr.getX(e.index);
                        } 

                        if (satId > 0) {
                            // Instant resolution with exact position fallback
                            setHoveredId(satId, [e.point.x, e.point.y, e.point.z]);
                        }
                    }
                }}
                onPointerOut={() => setHoveredId(null)}
                onPointerDown={(e) => {
                    e.stopPropagation();
                    mouseDownPos.current = { x: e.clientX, y: e.clientY };
                    
                    if (e.index !== undefined) {
                        const geometry = (e.object as Points).geometry;
                        const idAttr = geometry.getAttribute('satId');
                        if (idAttr) {
                             downSatIdRef.current = idAttr.getX(e.index);
                        }
                    }
                } }
                onPointerUp={(e) => {
                    e.stopPropagation();
                    if (!mouseDownPos.current) return;
                    
                    const dx = e.clientX - mouseDownPos.current.x;
                    const dy = e.clientY - mouseDownPos.current.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    mouseDownPos.current = null;

                    if (dist > 15) {
                        // Dragged
                        setFocusedId(null);
                        downSatIdRef.current = null;
                        return;
                    }

                    if (e.index !== undefined) {
                        const geometry = (e.object as Points).geometry;
                        const idAttr = geometry.getAttribute('satId');

                        let upSatId = -1;
                        if (idAttr) {
                             upSatId = idAttr.getX(e.index);
                        }

                        // Relaxed Check: If we clicked (not dragged) and landed on a sat, select it.
                        // We removed the 'downSatIdRef' strict match because satellites/camera might move slightly,
                        // causing the 'Down' and 'Up' rays to hit different things (or miss) even during a valid click.
                        if (upSatId > 0) {
                            selectSingle(upSatId);
                        }
                    }
                    downSatIdRef.current = null;
                }}
            >
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        args={[hitPositions, 3]}
                    />
                    <bufferAttribute
                        attach="attributes-satId"
                        args={[hitIds, 1]}
                    />
                </bufferGeometry>
                <pointsMaterial size={0.2} transparent opacity={0.0} depthWrite={false} />
            </points>
        </group>
    );
};

export default SatelliteInstanced;
