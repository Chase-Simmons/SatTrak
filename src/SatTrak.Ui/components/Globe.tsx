"use client";

import React, { useMemo, useRef, useState, Suspense } from "react";
import { AltitudeLogic, AltitudeOverlay } from "./AltitudeIndicator";
import SatelliteLabels from "./SatelliteLabels";
import SatelliteHighlights from "./SatelliteHighlights";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Vector3 } from "three";
import { useSatelliteStore } from "../hooks/useSatelliteStore";
import SatelliteInstanced from "./SatelliteInstanced";
import SatellitePanel from "./SatellitePanel";
import OrbitPath from "./OrbitPath";
import HoverOrbit from "./HoverOrbit";
import ZoomInertia from "./ZoomInertia";
import DistanceGrid from "./DistanceGrid";
import CelestialBodies from "./CelestialBodies";
import CameraController from "./CameraController";
import * as THREE from "three";
import { perfState } from "../utils/PerformanceState";
import * as satellite from 'satellite.js';
import { useTexture } from "@react-three/drei";
import Atmosphere from "./Atmosphere";
import FluffyClouds from "./FluffyClouds";
import { shaderMaterial } from "@react-three/drei";
import { extend, ReactThreeFiber } from "@react-three/fiber";

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

const EARTH_RADIUS = 6.371; // Normalized radius for visualization

// Helper to convert Lat/Lon/Alt to 3D Cartesian
const toCartesian = (lat: number, lon: number, alt: number) => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const r = EARTH_RADIUS + (alt / 6371) * EARTH_RADIUS; // Scaled altitude

  const x = -(r * Math.sin(phi) * Math.cos(theta));
  const z = r * Math.sin(phi) * Math.sin(theta);
  const y = r * Math.cos(phi);

  return new Vector3(x, y, z);
};

const FpsTracker = ({ fpsRef }: { fpsRef: React.RefObject<HTMLDivElement | null> }) => {
  useFrame((state: any, delta: number) => {
    if (!fpsRef.current) return;
    const fps = 1 / delta;
    fpsRef.current.innerText = `FPS: ${fps.toFixed(0)}`;
  });
  return null;
};


const RotationStatus = () => {
    const isRotating = useSatelliteStore(state => state.isCameraRotating);
    return (
        <div style={{ color: isRotating ? 'red' : 'lime' }}>
            Rotating: {isRotating ? "YES" : "NO"}
        </div>
    );
};

const WorldLines = () => {
  const [lines, setLines] = React.useState<Float32Array[]>([]);

  React.useEffect(() => {
    fetch("/data/world.json")
      .then((res) => res.json())
      .then((data) => {
        const lineSegments: Float32Array[] = [];
        data.features.forEach((feature: any) => {
          const coords = feature.geometry.coordinates;
          
          const processLine = (coordinates: number[][]) => {
              const pts: number[] = [];
              coordinates.forEach(c => {
                 const v = toCartesian(c[1], c[0], 0);
                 pts.push(v.x, v.y, v.z);
              });
              return new Float32Array(pts);
          };

          if (feature.geometry.type === "LineString") {
             lineSegments.push(processLine(coords));
          } else if (feature.geometry.type === "MultiLineString") {
             coords.forEach((line: number[][]) => lineSegments.push(processLine(line)));
          } else if (feature.geometry.type === "Polygon") {
             coords.forEach((ring: number[][]) => lineSegments.push(processLine(ring)));
          }
        });
        setLines(lineSegments);
      });
  }, []);

  return (
    <group>
      {lines.map((line, i) => (
        <line key={i}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[line, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#666" linewidth={1} transparent opacity={1} />
        </line>
      ))}
    </group>
  );
};

const CloudLayer = ({ sunDirection }: { sunDirection: THREE.Vector3 }) => {
    const cloudMap = useTexture('/textures/8k_earth_clouds.png');
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    
    useMemo(() => {
        cloudMap.wrapS = THREE.RepeatWrapping;
        cloudMap.wrapT = THREE.ClampToEdgeWrapping;
        cloudMap.needsUpdate = true;
    }, [cloudMap]);
    
    // Update camera position each frame for parallax effect
    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.cameraPosition.value.copy(state.camera.position);
            materialRef.current.uniforms.sunDirection.value.copy(sunDirection);
        }
    });

    return (
        <mesh scale={[1.006, 1.006, 1.006]}>
             <sphereGeometry args={[EARTH_RADIUS, 128, 128]} />
             {/* @ts-ignore */}
             <cloudMaterial 
                ref={materialRef}
                alphaMap={cloudMap}
                sunDirection={sunDirection}
                transparent 
                opacity={0.8}
                depthWrite={false}
             />
        </mesh>
    );
};

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
                    color="#444444" // Restored from #222222
                    depthWrite={false}
                />
            </mesh> 
            
            {/* Milky Way Overlay */}
            <mesh scale={[49000, 49000, 49000]} rotation={[1.0, 0, 0]}>
                <sphereGeometry args={[1, 128, 128]} />
                <meshBasicMaterial 
                    map={milkyWay} 
                    side={THREE.BackSide} 
                    transparent 
                    opacity={0.4} // Restored from 0.2
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </mesh>
        </group>
    );
};

const RealisticEarth = () => {
    const [colorMap, nightMap, heightMap] = useTexture([
        '/textures/8k_earth_daymap.png',
        '/textures/8k_earth_nightmap.png',
        '/textures/8k_earth_heightmap.png'
    ]);
    const cloudMap = useTexture('/textures/8k_earth_clouds.png');

    const sunDir = useMemo(() => new THREE.Vector3(10, 0, 50).normalize(), []);
    
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

    const earthRef = useRef<THREE.Mesh>(null);
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
            <mesh ref={earthRef} rotation={[0, Math.PI, 0]}>
                <sphereGeometry args={[EARTH_RADIUS, 256, 256]} /> 
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


const Graticule = () => {
    const lines = useMemo(() => {
        const lineSegments: Float32Array[] = [];
        const segments = 64; 
        for (let lat = -80; lat <= 80; lat += 10) {
            if (lat === 0) continue; 
            const points: number[] = [];
            for (let i = 0; i <= segments; i++) {
                const lon = (i / segments) * 360 - 180;
                // Graticule must match Earth orientation.
                // If Earth Mesh is rotated PI, Graticule must ALSO be rotated PI?
                // Or we generate points rotated?
                // Let's rely on the parent group rotation. 
                // Wait. RealisticEarth has mesh rotation PI. Graticule is sibling.
                // So Graticule needs rotation PI too? YES if it's inside Realistic view.
                // But Graticule is rendered outside RealisticEarth.
                // Let's keep Graticule standard (0 rot).
                // Earth Group rotates by GMST - PI.
                // So Graticule (0 rot) + Group (GMST - PI) = Graticule at GMST - PI.
                // This means Graticule is 180 deg off?
                // YES. 
                // So we need to rotate Graticule PI as well if we are rotating the group PI off.
                
                const vec = toCartesian(lat, lon, 0);
                points.push(vec.x, vec.y, vec.z);
            }
            lineSegments.push(new Float32Array(points));
        }
        for (let lon = -180; lon < 180; lon += 10) {
            const points: number[] = [];
            for (let i = 0; i <= segments; i++) {
                const lat = (i / segments) * 180 - 90;
                const vec = toCartesian(lat, lon, 0);
                points.push(vec.x, vec.y, vec.z);
            }
            lineSegments.push(new Float32Array(points));
        }
        return lineSegments;
    }, []);

    // Rotate Graticule PI to match the Mesh Rotation compensation
    return (
        <group rotation={[0, Math.PI, 0]}>
            {lines.map((line, i) => (
                <line key={i}>
                    <bufferGeometry>
                        <bufferAttribute
                            attach="attributes-position"
                            args={[line, 3]}
                        />
                    </bufferGeometry>
                    <lineBasicMaterial color="#444" linewidth={1} transparent opacity={0.4} />
                </line>
            ))}
        </group>
    );
};

const SceneReady = ({ onReady }: { onReady: (r: boolean) => void }) => {
    React.useLayoutEffect(() => {
        onReady(true);
    }, [onReady]);
    return null;
}

const EarthGroup = ({ children }: { children: React.ReactNode }) => {
    const groupRef = useRef<THREE.Group>(null);
    useFrame(() => {
        if (groupRef.current) {
             const now = new Date();
             const j = satLib.jday(
                now.getUTCFullYear(),
                now.getUTCMonth() + 1,
                now.getUTCDate(),
                now.getUTCHours(),
                now.getUTCMinutes(),
                now.getUTCSeconds()
             );
             const gmst = satLib.gstime(j);
             
             // Total Rotation = GMST.
             // We rotated the child meshes by PI to hide the seam.
             // So: GroupRot + PI = GMST  =>  GroupRot = GMST - PI.
             
             groupRef.current.rotation.y = gmst - Math.PI;
        }
    });
    return <group ref={groupRef}>{children}</group>;
};

const Globe = () => {
    const fetchTles = useSatelliteStore(state => state.fetchTles);
    const tles = useSatelliteStore(state => state.tles);
    const loading = useSatelliteStore(state => state.loading);
    const clearSelection = useSatelliteStore(state => state.clearSelection);
    const setFocusedId = useSatelliteStore(state => state.setFocusedId);
    const setIsCameraRotating = useSatelliteStore(state => state.setIsCameraRotating);
    const viewMode = useSatelliteStore(state => state.viewMode);
    const showGraticule = useSatelliteStore(state => state.showGraticule);
    
    const [earthMesh, setEarthMesh] = useState<THREE.Mesh | null>(null);
    const [sceneReady, setSceneReady] = useState(false);
    
    const mouseDownPos = useRef<{ x: number, y: number } | null>(null);

    const altBarRef = useRef<HTMLDivElement>(null);
    const altTextRef = useRef<HTMLDivElement>(null);
    const fpsRef = useRef<HTMLDivElement>(null);
    const controlsRef = useRef<any>(null);
    const rotationTimeout = useRef<NodeJS.Timeout | null>(null);
    const startRotationTimeout = useRef<NodeJS.Timeout | null>(null);
    const dragLockTimeout = useRef<NodeJS.Timeout | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const setDown = () => { 
            if (rotationTimeout.current) clearTimeout(rotationTimeout.current);
            if (dragLockTimeout.current) {
                clearTimeout(dragLockTimeout.current);
                dragLockTimeout.current = null;
            }
            if (startRotationTimeout.current) {
                clearTimeout(startRotationTimeout.current);
                startRotationTimeout.current = null;
            }
            perfState.forceCheck = true;
            perfState.isRotating = false;
            useSatelliteStore.getState().setIsCameraRotating(false);
            
            dragLockTimeout.current = setTimeout(() => {
                perfState.forceCheck = false;
                perfState.isRotating = true; 
            }, 50);
        };
        const setUp = () => { 
            if (dragLockTimeout.current) {
                clearTimeout(dragLockTimeout.current);
                dragLockTimeout.current = null;
            }
            if (startRotationTimeout.current) {
                clearTimeout(startRotationTimeout.current);
                startRotationTimeout.current = null;
            }
            perfState.forceCheck = true; 
            perfState.isRotating = false;
            useSatelliteStore.getState().setIsCameraRotating(false); 
        };
        const container = containerRef.current;
        if (container) {
            container.addEventListener('pointerdown', setDown, { capture: true });
            container.addEventListener('pointerup', setUp, { capture: true });
            window.addEventListener('pointerup', setUp, { capture: true });
        }

        perfState.isRotating = false;
        perfState.forceCheck = false;
        useSatelliteStore.getState().setIsCameraRotating(false);

        const watchdog = setInterval(() => {
            if (perfState.isRotating) {
                 const isStuck = !rotationTimeout.current && !startRotationTimeout.current;
                 if (isStuck) {
                     perfState.isRotating = false;
                     perfState.forceCheck = true;
                     useSatelliteStore.getState().setIsCameraRotating(false);
                 }
            } else {
                 if (useSatelliteStore.getState().isCameraRotating) {
                     useSatelliteStore.getState().setIsCameraRotating(false);
                 }
            }
        }, 500);

        fetchTles();
        return () => {
             clearInterval(watchdog);
             if (rotationTimeout.current) clearTimeout(rotationTimeout.current);
            if (container) {
                container.removeEventListener('pointerdown', setDown, { capture: true } as any);
                container.removeEventListener('pointerup', setUp, { capture: true } as any);
            }
             window.removeEventListener('pointerup', setUp, { capture: true } as any);
        };
    }, []);

    return (
        <div ref={containerRef} className="relative w-full h-full bg-black">
             <div 
                className="absolute top-4 left-4 z-10 bg-black/50 p-2 rounded text-white font-mono pointer-events-none border border-white/20 text-left"
                style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', color: 'white' }}
             >
                <div ref={fpsRef} className="font-bold text-green-400">FPS: --</div>
                <div>Source: Client-Side Propagation</div>
                <div>Satellites: {tles.length} {loading && "(Loading...)"}</div>
                <RotationStatus />
            </div>

            <SatellitePanel />
            <AltitudeOverlay barRef={altBarRef} textRef={altTextRef} />

            <Canvas 
                camera={{ position: [20, 35, 55], fov: 45, near: 0.1, far: 200000 }}
                onPointerDown={(e) => {
                    mouseDownPos.current = { x: e.clientX, y: e.clientY };
                }}
                onPointerMissed={(e) => {
                    if (!mouseDownPos.current) return;
                    const dx = e.clientX - mouseDownPos.current.x;
                    const dy = e.clientY - mouseDownPos.current.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist > 5) {
                        setFocusedId(null);
                    }
                    if (mouseDownPos.current) mouseDownPos.current = null;
                }}
            >
                <color attach="background" args={["#000000"]} />
                
                <Suspense fallback={null}>
                    <CelestialBodies />
                </Suspense>
                
                <EarthGroup>
                    {viewMode === 'wireframe' ? (
                        <group rotation={[0, Math.PI, 0]}>
                           {/* ... (Wireframe Mesh) ... */}
                            <mesh 
                                ref={setEarthMesh}
                                onPointerMove={(e) => e.stopPropagation()}
                                onPointerOver={() => useSatelliteStore.getState().setHoveredId(null)}
                                onPointerDown={(e) => {
                                    e.stopPropagation();
                                    mouseDownPos.current = { x: e.clientX, y: e.clientY };
                                }}
                                onPointerUp={(e) => {
                                    e.stopPropagation();
                                    if (!mouseDownPos.current) return;
                                    const dx = e.clientX - mouseDownPos.current.x;
                                    const dy = e.clientY - mouseDownPos.current.y;
                                    const dist = Math.sqrt(dx * dx + dy * dy);
                                    if (dist > 5) {
                                        setFocusedId(null);
                                    }
                                    mouseDownPos.current = null;
                                }}
                            >
                                <sphereGeometry args={[EARTH_RADIUS, 32, 32]} />
                                <meshBasicMaterial color="#000" />
                            </mesh>

                            {/* Lat/Lon Grid (Graticule) */}
                            {showGraticule && <Graticule />}
                            <WorldLines />
                        </group>
                    ) : (
                        <Suspense fallback={null}>
                             <RealisticEarth />
                             {/* Realistic Graticule overlay */}
                             {showGraticule && (
                                 <group scale={[1.002, 1.002, 1.002]}>
                                     <Graticule />
                                 </group>
                             )}
                             {/* Keep interaction mesh invisible for picking */}
                              <mesh 
                                ref={setEarthMesh}
                                visible={false} // Invisible proxy for interaction / sizing
                                onPointerMove={(e) => e.stopPropagation()}
                                onPointerOver={() => useSatelliteStore.getState().setHoveredId(null)}
                                onPointerDown={(e) => {
                                    e.stopPropagation();
                                    mouseDownPos.current = { x: e.clientX, y: e.clientY };
                                }}
                                onPointerUp={(e) => {
                                    e.stopPropagation();
                                    if (!mouseDownPos.current) return;
                                    const dx = e.clientX - mouseDownPos.current.x;
                                    const dy = e.clientY - mouseDownPos.current.y;
                                    const dist = Math.sqrt(dx * dx + dy * dy);
                                    if (dist > 5) {
                                        setFocusedId(null);
                                    }
                                    mouseDownPos.current = null;
                                }}
                            >
                                <sphereGeometry args={[EARTH_RADIUS, 32, 32]} />
                                <meshBasicMaterial color="#000" />
                            </mesh>
                        </Suspense>
                    )}
                </EarthGroup>
                
                {/* Stars Always Visible & Behind Everything */}
                <Suspense fallback={null}>
                    <StarField />
                </Suspense>

                {/* Lighting is handled inside CelestialBodies.tsx */}

                {sceneReady && <DistanceGrid earthRef={{ current: earthMesh }} />}
                <SceneReady onReady={setSceneReady} />

                <SatelliteInstanced />
                <FpsTracker fpsRef={fpsRef} />

                <OrbitPath />
                <HoverOrbit />
                <SatelliteHighlights />
                <SatelliteLabels />

                <CameraController />
                <AltitudeLogic barRef={altBarRef} textRef={altTextRef} />

                <EffectComposer enableNormalPass={false}>
                    <Bloom 
                        luminanceThreshold={0.7} 
                        mipmapBlur 
                        intensity={0.6} 
                        radius={0.8}
                    />
                </EffectComposer>

                <ZoomInertia controlsRef={controlsRef} />

                <OrbitControls
                    ref={controlsRef}
                    makeDefault
                    enablePan={false} 
                    enableZoom={false} // Handled by ZoomInertia
                    minDistance={6.5} 
                    maxDistance={110} 
                    enableDamping={true}
                    dampingFactor={0.06} // Slightly longer glide (was 0.05)
                    mouseButtons={{
                        LEFT: THREE.MOUSE.ROTATE,
                        MIDDLE: THREE.MOUSE.PAN,
                        RIGHT: THREE.MOUSE.DOLLY
                    }}
                    onStart={() => {
                        // Optional: can set true here if needed, but onChange handles dragging better
                    }}
                    onChange={() => {
                        // Clear pending stop
                        if (rotationTimeout.current) clearTimeout(rotationTimeout.current);

                        if (!perfState.isRotating && !startRotationTimeout.current) {
                            startRotationTimeout.current = setTimeout(() => {
                                perfState.isRotating = true;
                                setIsCameraRotating(true);
                                startRotationTimeout.current = null;
                            }, 150); 
                        }

                        // Schedule stop (200ms)
                        rotationTimeout.current = setTimeout(() => {
                            if (startRotationTimeout.current) {
                                clearTimeout(startRotationTimeout.current);
                                startRotationTimeout.current = null;
                            }
                            perfState.isRotating = false;
                            setIsCameraRotating(false);
                            rotationTimeout.current = null;
                        }, 200);
                    }}
                    onEnd={() => {
                         // Force stop immediately on explicit end
                         if (startRotationTimeout.current) {
                            clearTimeout(startRotationTimeout.current);
                            startRotationTimeout.current = null;
                         }
                         if (rotationTimeout.current) clearTimeout(rotationTimeout.current);
                         
                         perfState.isRotating = false;
                         setIsCameraRotating(false);
                    }}
                />
            </Canvas>
        </div>
    );
};

export default Globe;
