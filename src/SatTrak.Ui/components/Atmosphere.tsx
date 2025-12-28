import { useMemo, useRef } from "react";
import * as THREE from "three";

const EARTH_RADIUS = 6.371;

const Atmosphere = () => {
    const meshRef = useRef<THREE.Mesh>(null);

    const vertexShader = `
        varying vec3 vNormal;
        void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const fragmentShader = `
        varying vec3 vNormal;
        uniform vec3 sunDirection;

        void main() {
            vec3 normal = normalize(vNormal);
            float sunIntensity = dot(normal, normalize(sunDirection));
            
            // Fresnel Rim
            float viewDot = clamp(dot(normal, vec3(0, 0, 1.0)), 0.0, 1.0);
            float rimIntensity = pow(max(0.0, 1.0 - viewDot), 6.0);
            
            // Wide mask to allow natural scattering/bleeding into night side
            float sunMask = smoothstep(-0.5, 0.5, sunIntensity);
            
            float finalAlpha = rimIntensity * sunMask;
            
            vec3 atmosphereColor = vec3(0.15, 0.45, 1.0);
            gl_FragColor = vec4(atmosphereColor, 1.0) * finalAlpha;
        }
    `;

    const uniforms = useMemo(() => ({
        sunDirection: { value: new THREE.Vector3(1, 0, 0) }
    }), []);

    return (
        <mesh ref={meshRef} scale={[1.04, 1.04, 1.04]}>
            <sphereGeometry args={[EARTH_RADIUS, 128, 128]} />
            <shaderMaterial
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                uniforms={uniforms}
                blending={THREE.AdditiveBlending}
                side={THREE.FrontSide}
                transparent
                depthWrite={false}
            />
        </mesh>
    );
};

export default Atmosphere;
