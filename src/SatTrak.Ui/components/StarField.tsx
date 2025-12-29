import React, { useMemo } from "react";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";

const StarField = () => {
    const [stars, milkyWay] = useTexture([
        '/textures/8k_stars.png',
        '/textures/8k_stars_milky_way.png'
    ]);

    useMemo(() => {
        [stars, milkyWay].forEach(t => {
            t.anisotropy = 16;
            t.minFilter = THREE.LinearFilter;
            t.magFilter = THREE.LinearFilter;
            t.needsUpdate = true;
        });
    }, [stars, milkyWay]);
    
    return (
        <group renderOrder={-100}>
            {/* Background Stars */}
            <mesh scale={[50000, 50000, 50000]}>
                <sphereGeometry args={[1, 128, 128]} />
                <meshBasicMaterial 
                    map={stars} 
                    side={THREE.BackSide} 
                    color="#444444" 
                    depthWrite={false}
                />
            </mesh> 
            
            {/* Milky Way Overlay - HDR Boosted for Bloom */}
            <mesh 
                scale={[49000, 49000, 49000]} 
                rotation={[1.0, 0, 0]}
            >
                <sphereGeometry args={[1, 128, 128]} />
                <meshBasicMaterial 
                    map={milkyWay} 
                    side={THREE.BackSide} 
                    transparent 
                    opacity={0.5}
                    color={[1.5, 1.5, 1.5]} // HDR color to trigger bloom
                    toneMapped={false} // Important for glowing effects
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </mesh>
        </group>
    );
};

export default StarField;
