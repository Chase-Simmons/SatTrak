import React, { useRef, useMemo, Suspense } from "react";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as satellite from 'satellite.js';
import FluffyClouds from "./FluffyClouds";
import Atmosphere from "./Atmosphere";
import { shaderMaterial } from "@react-three/drei";
import { extend } from "@react-three/fiber";

// Create custom shader material
const EarthMaterial = shaderMaterial(
  {
    dayTexture: new THREE.Texture(),
    nightTexture: new THREE.Texture(),
    heightTexture: new THREE.Texture(),
    cloudTexture: new THREE.Texture(),
    sunDirection: new THREE.Vector3(1, 0, 0),
    sunDirectionWorld: new THREE.Vector3(1, 0, 0),
    displacementScale: 0.2,
  },
  // Vertex Shader
  `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vWorldNormal;
    
    uniform sampler2D heightTexture;
    uniform float displacementScale;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      
      // World-space normal for sun shadows
      vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      
      // Vertex Displacement
      // Read height from texture (assuming grayscale)
      float height = texture2D(heightTexture, uv).r;
      
      // Displace along normal
      // We need to displace in Object Space (position), not View Space.
      vec3 displacedPosition = position + normal * height * displacementScale;
      
      vPosition = (modelViewMatrix * vec4(displacedPosition, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
    }
  `,

  // Fragment Shader
  `
    uniform sampler2D dayTexture;
    uniform sampler2D nightTexture;
    uniform sampler2D heightTexture;
    uniform sampler2D cloudTexture;
    uniform vec3 sunDirection;
    uniform vec3 sunDirectionWorld;

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vWorldNormal;

    void main() {
      vec3 vNormalNorm = normalize(vNormal);
      vec3 sunDirNorm = normalize(sunDirection);
      vec3 viewDir = normalize(-vPosition);
      
      // 1. Topographic Normal Perturbation
      float h0 = texture2D(heightTexture, vUv).r;
      float h1 = texture2D(heightTexture, vUv + vec2(0.0005, 0.0)).r;
      float h2 = texture2D(heightTexture, vUv + vec2(0.0, 0.0005)).r;
      vec3 bumpNormal = normalize(vNormalNorm + vec3((h0 - h1), (h0 - h2), 0.0) * 0.4);
      
      float intensity = dot(bumpNormal, sunDirNorm);
      float rawIntensity = dot(vNormalNorm, sunDirNorm); 

      vec4 daySample = texture2D(dayTexture, vUv);
      vec4 nightSample = texture2D(nightTexture, vUv);

      // 2. Cloud Shadows - proper spherical projection using WORLD-SPACE normal
      vec3 sunWorld = normalize(sunDirectionWorld);
      vec3 N = normalize(vWorldNormal);  // World-space normal (not view-space!)

      
      // Project sun direction onto the local tangent plane
      // Remove the component along the normal to get tangent direction
      vec3 sunTangent = sunWorld - N * dot(sunWorld, N);
      float tangentLen = length(sunTangent);
      
      // Normalize and compute shadow offset
      // Longer shadows when sun is at grazing angle (tangentLen closer to 1)
      float shadowDist = 0.004;
      float cloudShadow = 1.0;  // Default: no shadow
      
      if (tangentLen > 0.01) {
        sunTangent = sunTangent / tangentLen;
        
        // Convert tangent direction to UV offset
        // Use spherical coordinates: longitude (U) and latitude (V)
        // The tangent vector's components map to UV changes
        float lat = (vUv.y - 0.5) * 3.14159;  // -PI/2 to PI/2
        float cosLat = max(0.3, cos(lat));    // Avoid division by zero at poles
        
        // dU scales with 1/cos(lat) due to equirectangular projection
        float dU = -sunTangent.x * shadowDist / cosLat;
        float dV = -sunTangent.z * shadowDist;
        
        vec2 shadowUv = vUv + vec2(dU, dV);
        float cloudDensity = texture2D(cloudTexture, shadowUv).r;
        
        // Shadow: darken where clouds are dense
        cloudShadow = 1.0 - cloudDensity * 0.25;
      }

      // Terminator Masks - centered at 0 for true 50/50 split
      float dayMask = smoothstep(-0.1, 0.1, rawIntensity);  // Symmetric around 0
      float nightMask = 1.0 - dayMask;

      // Night Side: Balanced base
      vec3 nightBase = pow(max(vec3(0.0), nightSample.rgb), vec3(1.5)) * 0.75;
      
      // City Glow: VERY strict masking - only show when fully in night zone
      float strictNightMask = smoothstep(0.3, 0.7, nightMask);  // Stricter threshold
      vec3 urbanGlow = pow(max(vec3(0.0), nightSample.rgb - 0.15), vec3(2.5)) * 15.0 * strictNightMask;
      
      vec3 nightFinal = (nightBase + urbanGlow) * nightMask;
      
      // Day Side - Apply cloud shadows
      // Scale shadow intensity by surface brightness so land gets equal visual impact as water
      float surfaceLuminance = dot(daySample.rgb, vec3(0.299, 0.587, 0.114));
      float shadowStrength = (1.0 - cloudShadow);
      
      // Reduce shadow strength in transition zone
      float shadowMask = smoothstep(0.2, 0.8, dayMask);  // Full shadow only in full day
      
      // Brighter surfaces get more absolute darkening
      float adaptiveDarken = shadowStrength * (0.25 + surfaceLuminance * 2.65) * shadowMask;

      vec3 dayFinal = daySample.rgb * dayMask - vec3(adaptiveDarken);
      dayFinal = max(vec3(0.0), dayFinal);  // Clamp to prevent negative

      
      vec3 finalColor = dayFinal + nightFinal;

      
      // 3. Specular Glint
      if (h0 < 0.1) {
          vec3 halfVector = normalize(sunDirNorm + viewDir);
          float NdotH = max(dot(bumpNormal, halfVector), 0.0);
          float specular = pow(NdotH, 128.0) * 1.5; 
          finalColor += vec3(0.6, 0.7, 1.0) * specular * dayMask * cloudShadow;
      }

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
);

// Create custom cloud shader material with Subsurface Scattering
const CloudMaterial = shaderMaterial(
  {
    alphaMap: new THREE.Texture(),
    sunDirection: new THREE.Vector3(1, 0, 0),
    cameraPosition: new THREE.Vector3(0, 0, 50),
    opacity: 0.8,
  },
  // Vertex Shader
  `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vViewDir = normalize(cameraPosition - worldPos.xyz);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment Shader
  `
    uniform sampler2D alphaMap;
    uniform vec3 sunDirection;
    uniform float opacity;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    
    void main() {
      vec3 normal = normalize(vNormal);
      vec3 sunDir = normalize(sunDirection);
      vec3 viewDir = normalize(vViewDir);
      
      // Cloud density from texture
      float cloudDensity = texture2D(alphaMap, vUv).r;
      float cloudAlpha = cloudDensity * opacity;
      
      // === SOFT CLOUD LIGHTING ===
      
      // Basic front lighting (sun facing clouds are brighter)
      float frontLight = max(0.0, dot(normal, sunDir));
      
      // Subsurface scattering - light passing through thin clouds
      // When sun is behind cloud (relative to viewer), thin areas glow
      float backLight = max(0.0, dot(-normal, sunDir));
      float scatterAmount = backLight * (1.0 - cloudDensity) * 0.5;
      
      // Ambient term - clouds always have some brightness
      float ambient = 0.6;
      
      // Day/night mask
      float dayMask = smoothstep(-0.2, 0.2, dot(normal, sunDir));
      
      // Combine lighting
      // Thick clouds: mainly front-lit
      // Thin clouds: show subsurface glow
      float brightness = ambient + frontLight * 0.5 + scatterAmount * 0.4;
      brightness = brightness * dayMask + 0.12 * (1.0 - dayMask);
      
      // Clamp to prevent overexposure
      brightness = min(brightness, 1.1);
      
      vec3 cloudColor = vec3(brightness);
      
      // Reduce alpha on night side
      float finalAlpha = cloudAlpha * max(0.15, dayMask);
      
      gl_FragColor = vec4(cloudColor, finalAlpha);
    }
  `
);

extend({ EarthMaterial, CloudMaterial });

// Add type definition for JSX
declare global {
  namespace JSX {
    interface IntrinsicElements {
      earthMaterial: any;
      cloudMaterial: any;
    }
  }
}

const satLib = satellite as any;
const EARTH_RADIUS = 6.371;

const RealisticEarth = ({ meshRef }: { meshRef?: React.Ref<THREE.Mesh> }) => {
    const [colorMap, nightMap, heightMap] = useTexture([
        '/textures/8k_earth_daymap.png',
        '/textures/8k_earth_nightmap.png',
        '/textures/8k_earth_heightmap.png'
    ]);
    const cloudMap = useTexture('/textures/8k_earth_clouds.png');

    const sunDir = useMemo(() => new THREE.Vector3(10, 0, 50).normalize(), []);
    
    const geometry = useMemo(() => new THREE.SphereGeometry(EARTH_RADIUS, 256, 256), []);

    // Fix Texture Wrapping (The "Tear")
    useMemo(() => {
        [colorMap, nightMap, heightMap, cloudMap].forEach(t => {
            t.wrapS = THREE.RepeatWrapping;
            t.wrapT = THREE.ClampToEdgeWrapping;
            t.anisotropy = 16;
            t.offset.x = 0; 
            t.needsUpdate = true;
        });
    }, [colorMap, nightMap, heightMap, cloudMap]);

    const internalRef = useRef<THREE.Mesh>(null);
    
    // Sync external ref
    React.useLayoutEffect(() => {
        if (!meshRef) return;
        if (typeof meshRef === 'function') {
            meshRef(internalRef.current);
        } else {
            (meshRef as React.MutableRefObject<THREE.Mesh | null>).current = internalRef.current;
        }
    });

    const earthRef = internalRef;
    
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const atmosphereGroupRef = useRef<THREE.Group>(null);
    
    // State for world-space sun direction (for VolumetricClouds)
    const sunDirWorldRef = useRef(new THREE.Vector3(1, 0, 0));

    useFrame((state) => {
        if (earthRef.current && materialRef.current) {
            const now = new Date();
            const j = satLib.jday(
                now.getUTCFullYear(),
                now.getUTCMonth() + 1,
                now.getUTCDate(),
                now.getUTCHours(),
                now.getUTCMinutes(),
                now.getUTCSeconds()
            );
            
            const sunPosFn = satLib.sunPos || satLib.sun_position || satLib.sunpos;
            const sunPosEci = sunPosFn ? sunPosFn(j) : null;
            
            if (sunPosEci && sunPosEci.rsun) {
                const r = sunPosEci.rsun;
                const sunDirWorld = new THREE.Vector3(r[0], r[2], -r[1]).normalize();
                const sunDirView = sunDirWorld.clone().transformDirection(state.camera.matrixWorldInverse);
                
                // Store world sun direction for VolumetricClouds
                sunDirWorldRef.current.copy(sunDirWorld);

                // 1. Update Earth Material with both view-space and world-space sun directions
                materialRef.current.uniforms.sunDirection.value.copy(sunDirView);
                materialRef.current.uniforms.sunDirectionWorld.value.copy(sunDirWorld);
                if (atmosphereGroupRef.current) {
                    atmosphereGroupRef.current.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            if (child.material instanceof THREE.ShaderMaterial) {
                                if (child.material.uniforms.sunDirection) {
                                    child.material.uniforms.sunDirection.value.copy(sunDirView);
                                }
                            }
                        }
                    });
                }
            }
        }
    });

    return (
        <group ref={atmosphereGroupRef}>
            <mesh ref={earthRef} rotation={[0, Math.PI, 0]} geometry={geometry}>
                {/* @ts-ignore */}
                <earthMaterial 
                    ref={materialRef}
                    dayTexture={colorMap} 
                    nightTexture={nightMap}
                    heightTexture={heightMap}
                    cloudTexture={cloudMap}
                    sunDirection={sunDir}
                    displacementScale={0.015} 
                />
            </mesh>
            <Suspense fallback={null}>
                <FluffyClouds sunDirection={sunDirWorldRef.current} />
            </Suspense>
            <Atmosphere />
        </group>
    );
};

export default React.memo(RealisticEarth);
