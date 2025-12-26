"use client";

import React from "react";
import { Html } from "@react-three/drei";
import { DoubleSide } from "three";
import * as THREE from "three";

const EARTH_RADIUS = 6.371;

type Orientation = 'xz' | 'xy' | 'yz';

interface RingConfig {
    altitudeKm: number;
    label: string;
    color?: string;
}

const Ring = ({ altitudeKm, label, color = "#444", earthRef, orientation = 'xz', thickness = 0.05 }: { altitudeKm: number, label: string, color?: string, earthRef?: React.RefObject<THREE.Mesh | null>, orientation?: Orientation, thickness?: number }) => {
    // Calculate radius in view units
    // r = EarthRadius + (Alt / 1000)
    const radius = EARTH_RADIUS + (altitudeKm / 1000);

    let rotation: [number, number, number] = [Math.PI / 2, 0, 0];
    let labelPositions: [number, number, number][] = [];

    switch (orientation) {
        case 'xy': // Vertical 1
            rotation = [0, 0, 0];
            labelPositions = [[0, radius, 0], [0, -radius, 0]];
            break;
        case 'yz': // Vertical 2
            rotation = [0, Math.PI / 2, 0];
            labelPositions = [[0, radius, 0], [0, -radius, 0]];
            break;  
        case 'xz': // Horizontal
        default:
            rotation = [Math.PI / 2, 0, 0];
            labelPositions = [[radius, 0, 0], [-radius, 0, 0], [0, 0, radius], [0, 0, -radius]];
            break;
    }

    return (
        <group>
            {/* Ring Line */}
            <mesh rotation={rotation}>
                <ringGeometry args={[radius, radius + thickness, 128]} />
                <meshBasicMaterial color={color} side={DoubleSide} transparent opacity={0.3} />
            </mesh>
            
            {/* HTML Labels */}
            {labelPositions.map((pos, i) => (
                <mesh key={i} position={pos as [number, number, number]}>
                    <Html 
                        center 
                        distanceFactor={10} 
                        occlude={earthRef ? [earthRef as any] : true} 
                        zIndexRange={[40, 0]} 
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
                            userSelect: 'none',
                            textShadow: '0 0 10px rgba(0,0,0,0.8)'
                        }}>
                            {label}
                        </div>
                    </Html>
                </mesh>
            ))}
        </group>
    );
};

import { useSatelliteStore } from "../hooks/useSatelliteStore";

const DistanceGrid = ({ earthRef }: { earthRef?: React.RefObject<THREE.Mesh | null> }) => {
    const { showKmMarkers, showOrbitRanges } = useSatelliteStore();

    const orbitConfigs = [
        { altitudeKm: 2000, label: "LEO", color: "#00ff00", thickness: 0.06 },
        { altitudeKm: 20000, label: "MEO", color: "#00ffff", thickness: 0.06 },
        { altitudeKm: 35786, label: "GEO", color: "#ff4444", thickness: 0.06 },
    ];

    const kmConfigs = [
        { altitudeKm: 10000, label: "10k" },
        { altitudeKm: 30000, label: "30k" },
        { altitudeKm: 40000, label: "40k" },
        { altitudeKm: 50000, label: "50k" },
        { altitudeKm: 60000, label: "60k" },
        { altitudeKm: 70000, label: "70k" },
        { altitudeKm: 80000, label: "80k" },
        { altitudeKm: 90000, label: "90k" },
        { altitudeKm: 100000, label: "100k" },
    ];

    const orientations: Orientation[] = ['xz', 'xy', 'yz'];

    const activeConfigs: RingConfig[] = [
        ...(showOrbitRanges ? orbitConfigs : []),
        ...(showKmMarkers ? kmConfigs : []),
    ];

    return (
        <group>
            {activeConfigs.map(config => (
                <React.Fragment key={config.altitudeKm}>
                    {orientations.map(orientation => (
                        <Ring 
                            key={`${config.altitudeKm}-${orientation}`}
                            altitudeKm={config.altitudeKm}
                            label={config.label}
                            color={config.color}
                            thickness={(config as any).thickness || 0.05}
                            earthRef={earthRef}
                            orientation={orientation}
                        />
                    ))}
                </React.Fragment>
            ))}
        </group>
    );
};

export default DistanceGrid;
