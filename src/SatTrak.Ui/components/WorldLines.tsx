import React from "react";
import * as THREE from "three";
import { assetUrl } from "../utils/assetPath";

const EARTH_RADIUS = 6.371;

// Helper to convert Lat/Lon/Alt to 3D Cartesian
const toCartesian = (lat: number, lon: number, alt: number) => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const r = EARTH_RADIUS + (alt / 6371) * EARTH_RADIUS; // Scaled altitude

  const x = -(r * Math.sin(phi) * Math.cos(theta));
  const z = r * Math.sin(phi) * Math.sin(theta);
  const y = r * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
};

const WorldLines = () => {
    const [lines, setLines] = React.useState<Float32Array[]>([]);
  
    React.useEffect(() => {
      fetch(assetUrl("/data/world.json"))
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

export default WorldLines;
