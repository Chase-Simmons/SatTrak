import React from "react";
import { useSatelliteStore } from "../hooks/useSatelliteStore";

const RotationStatus = () => {
    const isRotating = useSatelliteStore(state => state.isCameraRotating);
    return (
        <div style={{ color: isRotating ? 'red' : 'lime' }}>
            Rotating: {isRotating ? "YES" : "NO"}
        </div>
    );
};

export default RotationStatus;
