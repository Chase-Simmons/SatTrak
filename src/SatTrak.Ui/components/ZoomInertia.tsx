"use client";

import React, { useRef, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useSatelliteStore } from "../hooks/useSatelliteStore";
import { perfState } from "../utils/PerformanceState";

const FRICTION = 0.90; // Balanced Glide (0.90 = Smooth, 0.85 = Heavy)
const MOMENTUM_SCALE = 0.000085; // Tuned Sweet Spot (Between 2e-6 and 5e-6)
const STOP_THRESHOLD = 0.001;

interface Props {
    controlsRef: React.RefObject<OrbitControlsImpl | null>;
}

const ZoomInertia = ({ controlsRef }: Props) => {
    const { gl } = useThree();
    const velocity = useRef(0);
    const momentumTimeout = useRef<NodeJS.Timeout | null>(null);
    const setIsCameraRotating = useSatelliteStore(s => s.setIsCameraRotating);

    // 1. Capture Wheel Events & Add Momentum
    useEffect(() => {
        const canvas = gl.domElement;
        
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault(); 
            e.stopPropagation();

            velocity.current += e.deltaY * MOMENTUM_SCALE;

            if (!perfState.isRotating) {
                perfState.isRotating = true;
                setIsCameraRotating(true);
            }
            if (momentumTimeout.current) clearTimeout(momentumTimeout.current);
        };

        canvas.addEventListener('wheel', handleWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', handleWheel);
    }, [gl, setIsCameraRotating]);

    // 2. Physics Loop (Apply Velocity)
    useFrame(() => {
        if (!controlsRef.current) return;
        
        const v = velocity.current;

        if (Math.abs(v) > STOP_THRESHOLD) {
            const factor = 1 + Math.abs(v);
            
            if (v > 0) {
                 controlsRef.current.dollyIn(factor); 
            } else {
                 controlsRef.current.dollyOut(factor);
            }
            controlsRef.current.update();

            velocity.current *= FRICTION;

            if (momentumTimeout.current) clearTimeout(momentumTimeout.current);
            momentumTimeout.current = setTimeout(() => {
                 if (Math.abs(velocity.current) < STOP_THRESHOLD) {
                     perfState.isRotating = false;
                     setIsCameraRotating(false);
                 }
            }, 100);

        } else if (Math.abs(v) > 0) {
            // Snap to zero to stop micro-calcs
            velocity.current = 0;
            // Final Unlock
             perfState.isRotating = false;
             setIsCameraRotating(false);
        }
    });

    return null;
};

export default ZoomInertia;
