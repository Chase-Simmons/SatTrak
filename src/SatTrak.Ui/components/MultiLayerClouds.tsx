/**
 * MultiLayerClouds Component
 * 
 * Renders clouds using multiple textured spheres at different altitudes.
 * The layering creates parallax depth as the camera moves - a performant
 * alternative to volumetric ray marching.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

// Earth radius constant (should match Globe.tsx)
const EARTH_RADIUS = 6.371;

// Cloud layer configuration
const CLOUD_LAYERS = [
  { scale: 1.004, opacity: 0.5, uvOffset: 0.0 },      // Lower layer - more opaque
  { scale: 1.008, opacity: 0.35, uvOffset: 0.02 },    // Middle layer
  { scale: 1.012, opacity: 0.25, uvOffset: 0.04 },    // Upper layer - more transparent
];

interface MultiLayerCloudsProps {
  sunDirection: THREE.Vector3;
}

// Single cloud layer component
const CloudLayerMesh: React.FC<{
  cloudTexture: THREE.Texture;
  scale: number;
  opacity: number;
  uvOffset: number;
  sunDirection: THREE.Vector3;
}> = ({ cloudTexture, scale, opacity, uvOffset, sunDirection }) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      uniforms: {
        cloudMap: { value: cloudTexture },
        sunDirection: { value: sunDirection.clone() },
        opacity: { value: opacity },
        uvOffset: { value: uvOffset },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vNormal;
        uniform float uvOffset;
        
        void main() {
          vUv = uv + vec2(uvOffset, 0.0);
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D cloudMap;
        uniform vec3 sunDirection;
        uniform float opacity;
        varying vec2 vUv;
        varying vec3 vNormal;
        
        void main() {
          vec3 normal = normalize(vNormal);
          vec3 sunDir = normalize(sunDirection);
          float cloudAlpha = texture2D(cloudMap, vUv).r;
          
          // Day/night lighting
          float intensity = dot(normal, sunDir);
          float dayMask = smoothstep(-0.15, 0.15, intensity);
          
          // Cloud brightness varies with lighting
          float brightness = 0.7 + 0.5 * dayMask;
          vec3 cloudColor = vec3(brightness);
          
          // Night-side dim visibility
          float finalAlpha = cloudAlpha * opacity * max(0.3, dayMask);
          
          gl_FragColor = vec4(cloudColor, finalAlpha);
        }
      `,
    });
  }, [cloudTexture, opacity, uvOffset]);
  
  // Update sun direction each frame
  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.sunDirection.value.copy(sunDirection);
    }
  });
  
  return (
    <mesh scale={[scale, scale, scale]}>
      <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
      <primitive object={material} ref={materialRef} attach="material" />
    </mesh>
  );
};

const MultiLayerClouds: React.FC<MultiLayerCloudsProps> = ({ sunDirection }) => {
  const cloudTexture = useTexture('/textures/8k_earth_clouds.png');
  
  useMemo(() => {
    cloudTexture.wrapS = THREE.RepeatWrapping;
    cloudTexture.wrapT = THREE.ClampToEdgeWrapping;
    cloudTexture.needsUpdate = true;
  }, [cloudTexture]);
  
  return (
    <group>
      {CLOUD_LAYERS.map((layer, index) => (
        <CloudLayerMesh
          key={index}
          cloudTexture={cloudTexture}
          scale={layer.scale}
          opacity={layer.opacity}
          uvOffset={layer.uvOffset}
          sunDirection={sunDirection}
        />
      ))}
    </group>
  );
};

export default MultiLayerClouds;
