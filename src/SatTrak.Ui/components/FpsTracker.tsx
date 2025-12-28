import React from "react";
import { useFrame } from "@react-three/fiber";

const FpsTracker = ({ fpsRef }: { fpsRef: React.RefObject<HTMLDivElement | null> }) => {
  useFrame((state: any, delta: number) => {
    if (!fpsRef.current) return;
    const fps = 1 / delta;
    fpsRef.current.innerText = `FPS: ${fps.toFixed(0)}`;
  });
  return null;
};

export default FpsTracker;
