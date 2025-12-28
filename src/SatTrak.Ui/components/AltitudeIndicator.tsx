"use client";

import React from 'react';
import { useFrame } from '@react-three/fiber';

const EARTH_RADIUS = 6.371;

/**
 * AltitudeLogic: Runs inside the Canvas, hooks into the render loop,
 * and updates the DOM elements directly via Refs.
 */
export const AltitudeLogic = ({ 
    barRef, 
    textRef 
}: { 
    barRef: React.RefObject<HTMLDivElement | null>, 
    textRef: React.RefObject<HTMLDivElement | null> 
}) => {
    useFrame(({ camera }) => {
        const dist = camera.position.length();
        const altKm = (dist - EARTH_RADIUS) * 1000;
        
        const maxAlt = 100000;
        const percent = Math.min(Math.max(altKm / maxAlt, 0), 1) * 100;

        // Color Interpolation (Balanced Neon Horizon)
        // LEO: 0x22d3ee (34, 211, 238) - Lum 0.69
        // MEO: 0xfbbf24 (251, 191, 36) - Lum 0.75
        // GEO: 0xfda4af (253, 164, 175) - Lum 0.72
        // HEO: 0xd8b4fe (216, 180, 254) - Lum 0.72

        let r=34, g=211, b=238;
        if (altKm < 2000) {
            // LEO base
            r=34; g=211; b=238;
        } else if (altKm < 20000) {
            // LEO (Cyan) -> MEO (Amber)
            const t = (altKm - 2000) / (20000 - 2000);
            r = Math.round(34 + t * (251 - 34));
            g = Math.round(211 + t * (191 - 211));
            b = Math.round(238 + t * (36 - 238));
        } else if (altKm < 35786) {
            // MEO (Amber) -> GEO (Light Rose)
            const t = (altKm - 20000) / (35786 - 20000);
            r = Math.round(251 + t * (253 - 251));
            g = Math.round(191 + t * (164 - 191));
            b = Math.round(36 + t * (175 - 36));
        } else if (altKm < 60000) {
            // GEO (Light Rose) -> HEO (Lavender)
            const t = (altKm - 35786) / (60000 - 35786);
            r = Math.round(253 + t * (216 - 253));
            g = Math.round(164 + t * (180 - 164));
            b = Math.round(175 + t * (254 - 175));
        } else {
            // HEO base
            r=216; g=180; b=254;
        }







        
        const color = `rgb(${r},${g},${b})`;
        
        if (barRef.current) {
            barRef.current.style.height = `${percent}%`;
            barRef.current.style.background = color;
            barRef.current.style.boxShadow = `0 0 2px ${color}`;
        }
        
        if (textRef.current) {
            textRef.current.innerText = `${Math.round(altKm).toLocaleString()} km`;
            textRef.current.style.color = color;
            textRef.current.style.textShadow = `0 0 1px ${color}`;
        }
    });

    return null;
};

/**
 * AltitudeOverlay: Standard React component rendered outside the Canvas.
 * It provides the DOM structure that Logic updates.
 */
export const AltitudeOverlay = ({ 
    barRef, 
    textRef 
}: { 
    barRef: React.RefObject<HTMLDivElement | null>, 
    textRef: React.RefObject<HTMLDivElement | null> 
}) => {
    return (
        <div style={{ 
            pointerEvents: 'none', 
            zIndex: 2000,
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%'
        }}>
            <div style={{ 
                position: 'absolute', 
                right: '40px', 
                bottom: '40px',
                height: '300px',
                display: 'flex',
                alignItems: 'flex-end',
                gap: '12px'
            }}>
                {/* Text Readout */}
                <div ref={textRef} style={{ 
                    fontFamily: 'monospace', 
                    color: '#06b6d4', 
                    fontSize: '14px',
                    fontWeight: 'bold',
                    textShadow: '0 0 1px rgba(0,0,0,0.8)',
                    width: '100px',
                    textAlign: 'right',
                    marginBottom: 'var(--height-percent)' 
                }}>
                    0 km
                </div>

                {/* Bar Container */}
                <div style={{ 
                    width: '8px', 
                    height: '100%', 
                    background: 'rgba(10, 14, 23, 0.6)', 
                    backdropFilter: 'blur(4px)',
                    boxShadow: '0 0 10px rgba(0,0,0,0.5)',
                    borderRadius: '4px',
                    position: 'relative',
                    border: '1px solid rgba(255,255,255,0.1)'
                }}>
                    {/* Fill Bar */}
                    <div ref={barRef} style={{
                        position: 'absolute',
                        bottom: 0,
                        width: '100%',
                        background: '#333', 
                        borderRadius: '3px',
                        transition: 'height 0.1s linear'
                    }} />
                    
                    {/* Markers */}
                    <div style={{ position: 'absolute', bottom: '25%', right: '12px', fontSize: '10px', color: '#64748b' }}>25k</div>
                    <div style={{ position: 'absolute', bottom: '50%', right: '12px', fontSize: '10px', color: '#64748b' }}>50k</div>
                    <div style={{ position: 'absolute', bottom: '75%', right: '12px', fontSize: '10px', color: '#64748b' }}>75k</div>
                    <div style={{ position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)', fontSize: '10px', color: '#94a3b8' }}>100k</div>
                </div>
            </div>
        </div>
    );
};
