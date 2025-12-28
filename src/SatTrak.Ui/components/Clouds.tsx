/**
 * FluffyClouds Component
 * 
 * Creates 3D-looking clouds using 3 textured layers:
 * - Bottom layer: Base cloud at lower altitude
 * - Middle layer: EXPANDED/blurred for fluffy edges
 * - Top layer: Cloud tops at higher altitude
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

const EARTH_RADIUS = 6.371;

// Shared vertex shader - now includes view direction for rim falloff
const cloudVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Fragment shader with rim falloff
const normalFragmentShader = /* glsl */ `
  uniform sampler2D cloudMap;
  uniform vec3 sunDirection;
  uniform float opacity;
  uniform float layerBrightness;
  
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 sunDir = normalize(sunDirection);
    vec3 viewDir = normalize(vViewDir);
    
    float cloudAlpha = texture2D(cloudMap, vUv).r * opacity;
    
    // Day/night lighting
    float intensity = dot(normal, sunDir);
    float dayMask = smoothstep(-0.15, 0.2, intensity);
    
    float brightness = layerBrightness * dayMask + 0.1 * (1.0 - dayMask);
    vec3 cloudColor = vec3(brightness);
    
    // RIM FALLOFF: Fade out at grazing angles to hide layer separation
    float rimFactor = dot(normal, viewDir);
    float rimFalloff = smoothstep(0.0, 0.35, rimFactor);  // Fade from 0-35 degree viewing angle
    
    float finalAlpha = cloudAlpha * max(0.15, dayMask) * rimFalloff;
    
    gl_FragColor = vec4(cloudColor, finalAlpha);
  }
`;

// Middle layer shader - EXPANDED with soft blur
const expandedFragmentShader = /* glsl */ `
  uniform sampler2D cloudMap;
  uniform vec3 sunDirection;
  uniform float opacity;
  uniform float expansion;
  
  varying vec2 vUv;
  varying vec3 vNormal;
  
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 sunDir = normalize(sunDirection);
    
    // Expand UVs from center (slight zoom in = expansion outward)
    vec2 center = vec2(0.5, 0.5);
    vec2 expandedUv = center + (vUv - center) * (1.0 - expansion);
    
    // Soft blur by sampling multiple points
    float blurSize = 0.004;
    float cloudAlpha = 0.0;
    cloudAlpha += texture2D(cloudMap, expandedUv).r;
    cloudAlpha += texture2D(cloudMap, expandedUv + vec2(blurSize, 0.0)).r;
    cloudAlpha += texture2D(cloudMap, expandedUv - vec2(blurSize, 0.0)).r;
    cloudAlpha += texture2D(cloudMap, expandedUv + vec2(0.0, blurSize)).r;
    cloudAlpha += texture2D(cloudMap, expandedUv - vec2(0.0, blurSize)).r;
    cloudAlpha += texture2D(cloudMap, expandedUv + vec2(blurSize, blurSize) * 0.7).r;
    cloudAlpha += texture2D(cloudMap, expandedUv - vec2(blurSize, blurSize) * 0.7).r;
    cloudAlpha += texture2D(cloudMap, expandedUv + vec2(-blurSize, blurSize) * 0.7).r;
    cloudAlpha += texture2D(cloudMap, expandedUv - vec2(-blurSize, blurSize) * 0.7).r;
    cloudAlpha = cloudAlpha / 9.0 * opacity;
    
    // Day/night lighting - middle layer is slightly darker (shadow side)
    float intensity = dot(normal, sunDir);
    float dayMask = smoothstep(-0.15, 0.2, intensity);
    
    float brightness = 0.75 * dayMask + 0.08 * (1.0 - dayMask);
    vec3 cloudColor = vec3(brightness);
    
    float finalAlpha = cloudAlpha * max(0.1, dayMask);
    
    gl_FragColor = vec4(cloudColor, finalAlpha);
  }
`;

interface CloudsProps {
  sunDirection: THREE.Vector3;
}

// Individual layer component
const CloudLayerMesh: React.FC<{
  cloudTexture: THREE.Texture;
  scale: number;
  fragmentShader: string;
  uniforms: Record<string, { value: any }>;
  sunDirection: THREE.Vector3;
}> = ({ cloudTexture, scale, fragmentShader, uniforms, sunDirection }) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      uniforms: {
        cloudMap: { value: cloudTexture },
        sunDirection: { value: sunDirection.clone() },
        ...uniforms,
      },
      vertexShader: cloudVertexShader,
      fragmentShader,
    });
  }, [cloudTexture, fragmentShader, uniforms]);
  
  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.sunDirection.value.copy(sunDirection);
    }
  });
  
  return (
    <mesh scale={[scale, scale, scale]} rotation={[0, Math.PI, 0]}>
      <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
      <primitive object={material} ref={materialRef} attach="material" />
    </mesh>
  );

};

const Clouds: React.FC<CloudsProps> = ({ sunDirection }) => {
  const cloudTexture = useTexture('/textures/8k_earth_clouds.png');
  
  useMemo(() => {
    cloudTexture.wrapS = THREE.RepeatWrapping;
    cloudTexture.wrapT = THREE.ClampToEdgeWrapping;
    cloudTexture.needsUpdate = true;
  }, [cloudTexture]);
  
  // 10 layers that ADD UP to look like the original 2D texture
  // Each layer gets ~1/10 of the total opacity
  // More layers = smoother 3D sandwich effect
  const layers = [
    { scale: 1.002, opacity: 0.10, brightness: 0.65 },  // Bottom - darkest
    { scale: 1.003, opacity: 0.10, brightness: 0.70 },
    { scale: 1.004, opacity: 0.09, brightness: 0.75 },
    { scale: 1.005, opacity: 0.09, brightness: 0.80 },
    { scale: 1.006, opacity: 0.08, brightness: 0.85 },  // Middle
    { scale: 1.007, opacity: 0.08, brightness: 0.88 },
    { scale: 1.008, opacity: 0.07, brightness: 0.92 },
    { scale: 1.009, opacity: 0.07, brightness: 0.95 },
    { scale: 1.010, opacity: 0.06, brightness: 0.98 },
    { scale: 1.011, opacity: 0.06, brightness: 1.00 },  // Top - brightest
  ];
  
  return (
    <group>
      {layers.map((layer, i) => (
        <CloudLayerMesh
          key={i}
          cloudTexture={cloudTexture}
          scale={layer.scale}
          fragmentShader={normalFragmentShader}
          uniforms={{
            opacity: { value: layer.opacity },
            layerBrightness: { value: layer.brightness },
          }}
          sunDirection={sunDirection}
        />
      ))}
    </group>
  );
};

export default Clouds;
