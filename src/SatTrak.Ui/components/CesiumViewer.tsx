"use client";

import React, { useEffect, useState } from "react";
import { Viewer, Entity } from "resium";
import { Cartesian3, Color } from "cesium";
import { useSatelliteStream } from "../hooks/useSatelliteStream";

const CesiumViewer = () => {
  const [mounted, setMounted] = useState(false);
  const { satellites, connectionStatus } = useSatelliteStream();

  useEffect(() => {
    (window as any).CESIUM_BASE_URL = "/cesium";
    setMounted(true);
  }, []);

  if (!mounted) return <div className="p-10 text-white">Loading Globe...</div>;

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-4 left-4 z-10 bg-black/50 p-2 rounded text-white font-mono pointer-events-none">
        <div>SignalR: <span className={connectionStatus === "Connected" ? "text-green-400" : "text-red-400"}>{connectionStatus}</span></div>
        <div>Satellites: {satellites.length}</div>
      </div>
      
      <Viewer full>
        {satellites.map((sat) => (
          <Entity
            key={sat.id}
            name={sat.name}
            // Cesium uses Degrees for Lat/Lon, Meters for Altitude. Backend sends km for Alt.
            position={Cartesian3.fromDegrees(sat.lon, sat.lat, sat.alt * 1000)}
            point={{ pixelSize: 8, color: Color.CYAN }}
            description={`NORAD ID: ${sat.id}\nVelocity: ${Math.sqrt(sat.vel.x**2 + sat.vel.y**2 + sat.vel.z**2).toFixed(2)} km/s`}
          />
        ))}
      </Viewer>
    </div>
  );
};

export default CesiumViewer;
