"use client";

import React, { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { Vector3 } from "three";
import { useSatelliteStream } from "../hooks/useSatelliteStream";

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

const WorldLines = () => {
  const [lines, setLines] = React.useState<Float32Array[]>([]);

  React.useEffect(() => {
    fetch("/data/world.json")
      .then((res) => res.json())
      .then((data) => {
        const lineSegments: Float32Array[] = [];
        data.features.forEach((feature: any) => {
          const coords = feature.geometry.coordinates;
          const points: number[] = [];
          
          coords.forEach(([lon, lat]: [number, number]) => {
            const vec = toCartesian(lat, lon, 0); // 0 altitude for surface lines
            points.push(vec.x, vec.y, vec.z);
          });
          
          lineSegments.push(new Float32Array(points));
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
          <lineBasicMaterial color="#444" linewidth={1} transparent opacity={0.6} />
        </line>
      ))}
    </group>
  );
};

const Satellite = ({ lat, lon, alt }: { lat: number; lon: number; alt: number }) => {
  const position = useMemo(() => toCartesian(lat, lon, alt), [lat, lon, alt]);

  return (
    <mesh position={position}>
      <sphereGeometry args={[0.05, 8, 8]} />
      <meshBasicMaterial color="#00ffff" />
    </mesh>
  );
};

const Globe = () => {
    const { satellites, connectionStatus } = useSatelliteStream();

    return (
        <div className="relative w-full h-full bg-black">
             <div className="absolute top-4 left-4 z-10 bg-black/50 p-2 rounded text-white font-mono pointer-events-none border border-white/20">
                <div>SignalR: <span className={connectionStatus === "Connected" ? "text-green-400" : "text-red-400"}>{connectionStatus}</span></div>
                <div>Satellites: {satellites.length}</div>
            </div>

            <Canvas camera={{ position: [0, 0, 18], fov: 45 }}>
                <color attach="background" args={["#000000"]} />
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} />
                
                {/* Wireframe Earth */}
                <mesh>
                    <sphereGeometry args={[EARTH_RADIUS * 0.99, 32, 32]} />
                    <meshBasicMaterial color="#222" wireframe transparent opacity={0.2} />
                </mesh>

                {/* Continent Outlines */}
                <WorldLines />

                {/* Stars Background */}
                <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

                {/* Satellites */}
                {satellites.map((sat) => (
                    <Satellite key={sat.id} lat={sat.lat} lon={sat.lon} alt={sat.alt} />
                ))}

                <OrbitControls enablePan={false} minDistance={8} maxDistance={40} />
            </Canvas>
        </div>
    );
};

export default Globe;
