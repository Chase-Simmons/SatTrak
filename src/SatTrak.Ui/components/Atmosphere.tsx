import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const EARTH_RADIUS = 6.371;
const ATMOSPHERE_RADIUS = 6.371 * 0.98432; // User tuned radius to account for 1.025 scale mesh

const ScatteringShader = {
    uniforms: {
        uSunPosition: { value: new THREE.Vector3(0, 0, 0) }, 
        uViewPosition: { value: new THREE.Vector3(0, 0, 0) },
        uAtmosphereRadius: { value: ATMOSPHERE_RADIUS },
        uEarthRadius: { value: EARTH_RADIUS },
        uDayColor: { value: new THREE.Color("#b3d9ff") },    // Soft sky blue (less harsh white)
        uRimColor: { value: new THREE.Color("#1a75ff") },    // Deep Azure
        uSunsetColor: { value: new THREE.Color("#ffaa66") }, 
        uDensityFalloff: { value: 8.0 },                     // Smooth falloff for volumetric look
        uIntensity: { value: 4.0 }                           // Lower intensity for better blending
    },
    vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vWorldPosition;

        void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPos.xyz;
            vPosition = worldPos.xyz; 
            gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
    `,
    fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vWorldPosition;

        uniform vec3 uSunPosition;
        uniform vec3 uViewPosition; 
        uniform float uAtmosphereRadius;
        uniform float uEarthRadius;
        uniform vec3 uDayColor;
        uniform vec3 uRimColor;
        uniform vec3 uSunsetColor;
        uniform float uDensityFalloff;
        uniform float uIntensity;

        void main() {
            vec3 viewDir = normalize(uViewPosition - vPosition);
            vec3 normal = normalize(vNormal);
            vec3 sunDir = normalize(uSunPosition);

            // 1. View Angle & Geometry
            float viewDot = abs(dot(normal, viewDir)); 
            
            // 2. Rim Calculation
            float rim = pow(1.0 - viewDot, uDensityFalloff);

            // 3. Day/Night Light Intensity
            float sunOrientation = dot(normal, sunDir);
            float lightIntensity = smoothstep(-0.1, 0.1, sunOrientation);

            // 4. Color Gradient
            // Linear mix for the smoothest natural transition
            vec3 baseColor = mix(uRimColor, uDayColor, viewDot); 

            // 5. Sunset Tint (Subtle)
            float terminatorFactor = 1.0 - abs(sunOrientation); 
            terminatorFactor = pow(terminatorFactor, 3.0); 
            vec3 finalColor = mix(baseColor, uSunsetColor, terminatorFactor * 0.4);

            // 6. Final Alpha
            float finalAlpha = rim * lightIntensity * uIntensity;

            if (finalAlpha < 0.005) discard;

            gl_FragColor = vec4(finalColor, finalAlpha);
        }
    `
};

const COMPATIBLE_SHADER = {
    ...ScatteringShader,
    uniforms: {
        ...ScatteringShader.uniforms,
        sunDirection: { value: new THREE.Vector3(1, 0, 0) } 
    },
    fragmentShader: ScatteringShader.fragmentShader.replace('uniform vec3 uSunPosition;', 'uniform vec3 sunDirection;').replace('uSunPosition', 'sunDirection')
};

const Atmosphere = () => {
    const meshRef = useRef<THREE.Mesh>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);

    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uViewPosition.value.copy(state.camera.position);
            // Updating 'sunDirection' is handled by parent traversal in RealisticEarth
        }
    });

    return (
        <mesh ref={meshRef} scale={[1.025, 1.025, 1.025]}>
            <sphereGeometry args={[ATMOSPHERE_RADIUS, 128, 128]} />
            <shaderMaterial
                ref={materialRef}
                args={[COMPATIBLE_SHADER]}
                blending={THREE.AdditiveBlending}
                side={THREE.BackSide} 
                transparent
                depthWrite={false}
            />
        </mesh>
    );
};

export default Atmosphere;
