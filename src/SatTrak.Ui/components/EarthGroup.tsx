import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import * as satellite from 'satellite.js';

const satLib = satellite as any;

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

export default EarthGroup;
