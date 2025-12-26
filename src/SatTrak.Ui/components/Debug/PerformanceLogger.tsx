import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useSatelliteStore } from '../../hooks/useSatelliteStore';

const PerformanceLogger = () => {
    const { gl } = useThree();
    const lastLogTime = useRef(0);
    const frameCount = useRef(0);
    const totalFrameTime = useRef(0);
    const satCount = useSatelliteStore((s: any) => s.tles.length);
    const labelCount = useSatelliteStore((s: any) => s.selectedIds.length);

    useFrame((state) => {
        const now = performance.now();
        const delta = now - lastLogTime.current;
        
        frameCount.current++;
        // Rough frame time estimate (delta between frames)
        totalFrameTime.current += (state.clock.getDelta() * 1000);

        if (delta > 2000) { // Log every 2 seconds
            const fps = Math.round((frameCount.current / delta) * 1000);
            const avgFrameTime = (totalFrameTime.current / frameCount.current).toFixed(2);
            
            console.log(`[PERF CHECK]
----------------------------------------
FPS: ${fps}
Avg CPU Frame Time: ${avgFrameTime}ms
Draw Calls: ${gl.info.render.calls}
Triangles: ${gl.info.render.triangles}
Geometries: ${gl.info.memory.geometries}
Textures: ${gl.info.memory.textures}
Active Satellites: ${satCount}
Selected/Labels: ${labelCount}
----------------------------------------`);

            // Reset
            lastLogTime.current = now;
            frameCount.current = 0;
            totalFrameTime.current = 0;
        }
    });

    return null;
};

export default PerformanceLogger;
