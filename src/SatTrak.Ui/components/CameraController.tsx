import { useFrame, useThree } from "@react-three/fiber";
import * as React from "react";
import * as THREE from "three";
import { useSatelliteStore } from "../hooks/useSatelliteStore";
import * as satellite from 'satellite.js';

const satLib = satellite as any;
const SCALE_FACTOR = 1 / 1000;

const CameraController = () => {
    const { focusedId, tles, setFocusedId } = useSatelliteStore();
    const { camera, controls } = useThree() as any;
    
    const targetPos = React.useRef(new THREE.Vector3(0, 0, 0));
    const [isTransitioning, setIsTransitioning] = React.useState(false);
    
    React.useEffect(() => {
        if (!controls) return;
        const handleStart = () => {
            setFocusedId(null);
        };
        controls.addEventListener('start', handleStart);
        return () => controls.removeEventListener('start', handleStart);
    }, [controls, setFocusedId]);

    // Reset transition state when focused satellite changes
    React.useEffect(() => {
        if (focusedId) {
            setIsTransitioning(true);
        } else {
            setIsTransitioning(false);
        }
    }, [focusedId]);

    const focusedSat = React.useMemo(() => {
        if (!focusedId) return null;
        return tles.find(s => s.id === focusedId);
    }, [focusedId, tles]);

    useFrame(() => {
        if (focusedSat) {
            const rec = satLib.twoline2satrec(focusedSat.line1, focusedSat.line2);
            if (!rec) return;

            const now = new Date();
            const pv = satLib.propagate(rec, now);
            
            if (pv && pv.position && typeof pv.position !== 'boolean') {
                const p = pv.position;
                targetPos.current.set(
                    p.x * SCALE_FACTOR,
                    p.z * SCALE_FACTOR,
                    -p.y * SCALE_FACTOR
                );

                if (controls) {
                    // 1. ALWAYS look at Earth center
                    const center = new THREE.Vector3(0, 0, 0);
                    controls.target.lerp(center, 0.2);
                    
                    const satVector = targetPos.current.clone();
                    const satDist = satVector.length();
                    const satDir = satVector.normalize();
                    
                    // Determine ideal viewing distance (just outside the satellite)
                    const zoomBuffer = 4; // Distance units away from the satellite
                    const idealDist = satDist + zoomBuffer;

                    if (isTransitioning) {
                        const currentCamDist = camera.position.length();
                        const nextDist = THREE.MathUtils.lerp(currentCamDist, idealDist, 0.2);
                        const nextPos = satDir.multiplyScalar(nextDist);
                        camera.position.lerp(nextPos, 0.2);

                        if (Math.abs(currentCamDist - idealDist) < 0.2) {
                            setIsTransitioning(false);
                        }
                    } else {
                        const currentZoom = camera.position.length();
                        const targetFollowPos = satDir.multiplyScalar(currentZoom);
                        camera.position.lerp(targetFollowPos, 0.3);
                    }
                    
                    controls.update();
                }
            }
        } else if (controls) {
            // Smoothly return target to center if it drifted (though it shouldn't now)
            const center = new THREE.Vector3(0, 0, 0);
            if (controls.target.lengthSq() > 0.001) {
                controls.target.lerp(center, 0.05);
                controls.update();
            }
        }
    });

    return null;
};

export default CameraController;
