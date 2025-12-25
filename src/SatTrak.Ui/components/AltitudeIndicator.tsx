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
    barRef: React.RefObject<HTMLDivElement>, 
    textRef: React.RefObject<HTMLDivElement> 
}) => {
    useFrame(({ camera }) => {
        const dist = camera.position.length();
        const altKm = (dist - EARTH_RADIUS) * 1000;
        
        const maxAlt = 100000;
        const percent = Math.min(Math.max(altKm / maxAlt, 0), 1) * 100;

        // Color Interpolation
        // Green(0) -> Cyan(15k) -> Red(35k) -> Purple(60k+)
        let r=0, g=255, b=0;
        if (altKm < 2000) {
            r=0; g=255; b=0;
        } else if (altKm < 15000) {
            // 2k(Green) -> 15k(Cyan: 0,255,255)
            const t = (altKm - 2000) / (15000 - 2000);
            r=0; g=255; b=Math.round(t * 255);
        } else if (altKm < 35000) {
            // 15k(Cyan) -> 35k(Red: 255,0,0)
            const t = (altKm - 15000) / (35000 - 15000);
            r=Math.round(t * 255); g=Math.round((1-t)*255); b=Math.round((1-t)*255);
        } else if (altKm < 60000) {
            // 35k(Red) -> 60k(Purple: 191,0,255)
            const t = (altKm - 35000) / (60000 - 35000);
            r=Math.round(255 - t*(255-191)); g=0; b=Math.round(t*255);
        } else {
             r=191; g=0; b=255;
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
    barRef: React.RefObject<HTMLDivElement>, 
    textRef: React.RefObject<HTMLDivElement> 
}) => {
    return (
        <div style={{ 
            pointerEvents: 'none', 
            zIndex: 40,
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
