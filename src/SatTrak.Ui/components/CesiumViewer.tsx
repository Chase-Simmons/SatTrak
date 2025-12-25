"use client";

import React, { useEffect, useState } from "react";
import { Viewer, Entity } from "resium";
import { Cartesian3, Color, Ion } from "cesium";

// NOTE: In a real app, you should use a valid Ion Token from a config/env variable.
// Ion.defaultAccessToken = "YOUR_TOKEN";

const CesiumViewer = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Determine base URL dynamically or set it global
    (window as any).CESIUM_BASE_URL = "/cesium";
    setMounted(true);
  }, []);

  if (!mounted) return <div className="p-10 text-white">Loading Globe...</div>;

  return (
    <Viewer full>
      <Entity
        name="ISS"
        position={Cartesian3.fromDegrees(-74.0707383, 40.7127753, 100000)}
        point={{ pixelSize: 10, color: Color.RED }}
        description="International Space Station"
      />
    </Viewer>
  );
};

export default CesiumViewer;
