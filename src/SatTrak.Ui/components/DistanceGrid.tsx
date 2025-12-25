"use client";

import React from "react";
import { Html } from "@react-three/drei";
import { DoubleSide } from "three";
import * as THREE from "three";

const EARTH_RADIUS = 6.371;

const Ring = ({ altitudeKm, label, color = "#444", earthRef }: { altitudeKm: number, label: string, color?: string, earthRef?: React.RefObject<THREE.Mesh> }) => {
    // Calculate radius in view units
    // r = EarthRadius + (Alt / 1000)
    const radius = EARTH_RADIUS + (altitudeKm / 1000);

    return (
        <group>
            {/* Ring Line (Flat on XZ plane) */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[radius, radius + 0.02, 128]} />
                <meshBasicMaterial color={color} side={DoubleSide} transparent opacity={0.4} />
            </mesh>
            
            {/* HTML Labels on 4 sides with Occlusion */}
            {[
                [radius, 0, 0],
                [-radius, 0, 0],
                [0, 0, radius],
                [0, 0, -radius]
            ].map((pos, i) => (
                <mesh key={i} position={pos as [number, number, number]}>
                    <Html 
                        center 
                        distanceFactor={10} 
                        occlude={earthRef ? [earthRef] : true} // If ref provided, occlude only by Earth. Else default occlusion.
                        zIndexRange={[40, 0]} // Ensure labels are behind the UI (z-50)
                        style={{ pointerEvents: 'none' }}
                    >
                        <div style={{ 
                            color: color, 
                            fontFamily: 'monospace', 
                            fontSize: '48px',
                            fontWeight: 'bold',
                            padding: '2px 4px',
                            borderRadius: '4px',
                            whiteSpace: 'nowrap',
                            userSelect: 'none'
                        }}>
                            {label}
                        </div>
                    </Html>
                </mesh>
            ))}
        </group>
    );
};

const DistanceGrid = ({ earthRef }: { earthRef?: React.RefObject<THREE.Mesh> }) => {
    return (
        <group>
            <Ring altitudeKm={10000} label="10,000 km" earthRef={earthRef} />
            <Ring altitudeKm={20000} label="20,000 km" earthRef={earthRef} />
            <Ring altitudeKm={30000} label="30,000 km" earthRef={earthRef} />
            <Ring altitudeKm={35786} label="GEO" color="#ff4444" earthRef={earthRef} />
        </group>
    );
};

export default DistanceGrid;
