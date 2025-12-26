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

            // Add momentum (Zoom is "Dolly")
            // Standard: DeltaY > 0 is Scroll Down (Zoom Out usually)
            velocity.current += e.deltaY * MOMENTUM_SCALE;

            // Perf Lock Logic (Immediate)
            if (!perfState.isRotating) {
                perfState.isRotating = true;
                setIsCameraRotating(true);
            }
            // Clear any pending unlock
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
            // Apply Dolly
            // > 0 means Pulling Back (Dolly Out)
            // < 0 means Pushing In (Dolly In)
            // Function dollyIn(scale): scale < 1 zooms in?
            // ThreeJS OrbitControls:
            // dollyOut(scale): object.position /= scale; (Moves out if scale < 1? No.)
            // Actually: dollyIn(doyyScale); dollyOut(dollyScale);
            // Let's use generic approach:
            
            // Standard OrbitControls Zoom logic:
            // scale = Math.pow( 0.95, zoomSpeed );
            // if ( deltaY < 0 ) dollyIn( getZoomScale() );
            // if ( deltaY > 0 ) dollyOut( getZoomScale() );
            
            // We convert linear velocity to multiplicative scale
            const factor = 1 + Math.abs(v);
            
            if (v > 0) {
                 controlsRef.current.dollyIn(factor); // Inverted: Scroll Down pushes IN
            } else {
                 controlsRef.current.dollyOut(factor); // Inverted: Scroll Up pulls OUT
            }
            controlsRef.current.update();

            // Apply Friction
            velocity.current *= FRICTION;

            // Keep Perf Locked while moving
            if (momentumTimeout.current) clearTimeout(momentumTimeout.current);
            momentumTimeout.current = setTimeout(() => {
                 // Only unlock if stopped
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
