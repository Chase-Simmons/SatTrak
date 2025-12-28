/**
 * VolumetricClouds Component
 * 
 * Renders volumetric clouds around Earth using ray marching.
 * Uses a transparent spherical shell mesh that ray marches through
 * a procedural cloud volume.
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { vertexShader, fragmentShader } from '../shaders/volumetricClouds';

// Earth radius constant (should match Globe.tsx)
const EARTH_RADIUS = 6.371;

interface VolumetricCloudsProps {
  sunDirection: THREE.Vector3;
  opacity?: number;
  innerScale?: number;  // Scale above Earth surface for inner shell
  outerScale?: number;  // Scale above Earth surface for outer shell
}

const VolumetricClouds: React.FC<VolumetricCloudsProps> = ({
  sunDirection,
  opacity = 0.9,
  innerScale = 1.002,
  outerScale = 1.04,
}) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Create shader material
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      uniforms: {
        uSunDirection: { value: sunDirection.clone() },
        uCameraPosition: { value: new THREE.Vector3() },
        uInnerRadius: { value: EARTH_RADIUS * innerScale },
        uOuterRadius: { value: EARTH_RADIUS * outerScale },
        uTime: { value: 0 },
        uOpacity: { value: opacity },
      },
    });
  }, [innerScale, outerScale, opacity]);
  
  // Update uniforms each frame
  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
      materialRef.current.uniforms.uCameraPosition.value.copy(state.camera.position);
      materialRef.current.uniforms.uSunDirection.value.copy(sunDirection);
    }
  });
  
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[EARTH_RADIUS * outerScale, 64, 64]} />
      <primitive object={shaderMaterial} ref={materialRef} attach="material" />
    </mesh>
  );
};

export default VolumetricClouds;
