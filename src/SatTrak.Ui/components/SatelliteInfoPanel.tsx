import React, { useEffect, useMemo, useState } from 'react';
import { useSatelliteStore } from '../hooks/useSatelliteStore';
import * as satellite from 'satellite.js';
import styles from './SatelliteInfoPanel.module.css';

const satLib = satellite as any;

/**
 * Helper to format TLE epoch to date string
 */
const formatEpoch = (sat: any) => {
    // satellite.js doesn't expose raw epoch easily from JSON, usually we parse it from the line1
    // Line 1 chars 19-32 are the epoch. 
    // Example: 21037.55001932 -> 2021, day 37.55
    if (!sat?.line1) return "Unknown";
    const yearPrefix = parseInt(sat.line1.substring(18, 20)); // "21"
    const year = yearPrefix < 57 ? 2000 + yearPrefix : 1900 + yearPrefix;
    const dayOfYear = parseFloat(sat.line1.substring(20, 32));
    
    const date = new Date(Date.UTC(year, 0)); // Jan 1
    date.setUTCDate(dayOfYear); // Add days (handles fractional days too if needed, but setUTCDate takes int usually)
    // Actually setUTCDate sets the day of month if 1-31. To add days to year start:
    const d = new Date(Date.UTC(year, 0, 1));
    d.setTime(d.getTime() + (dayOfYear - 1) * 24 * 60 * 60 * 1000);
    
    return d.toUTCString();
};

const SatelliteInfoPanel = () => {
    const focusedId = useSatelliteStore(state => state.focusedId);
    const tleMap = useSatelliteStore(state => state.tleMap);
    
    const sat = useMemo(() => focusedId ? tleMap.get(focusedId) : null, [focusedId, tleMap]);
    const [telemetry, setTelemetry] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'details' | 'debug'>('details');

    // Live Telemetry Loop
    useEffect(() => {
        if (!sat) return;

        const rec = satLib.twoline2satrec(sat.line1, sat.line2);
        
        const update = () => {
            const now = new Date();
            const positionAndVelocity = satLib.propagate(rec, now);
            const positionEci = positionAndVelocity.position;
            const velocityEci = positionAndVelocity.velocity;

            if (positionEci && typeof positionEci !== 'boolean' && velocityEci) {
                const gmst = satLib.gstime(now);
                const positionGd = satLib.eciToGeodetic(positionEci, gmst);
                
                const longitude = satLib.degreesLong(positionGd.longitude);
                const latitude  = satLib.degreesLat(positionGd.latitude);
                const height    = positionGd.height; // km

                const velocityKmS = Math.sqrt(
                    velocityEci.x * velocityEci.x + 
                    velocityEci.y * velocityEci.y + 
                    velocityEci.z * velocityEci.z
                );

                setTelemetry({
                    lat: latitude,
                    lon: longitude,
                    height: height,
                    speed: velocityKmS * 3600, // km/h
                    azimuth: 0, // TODO: calculate relative to observer if needed
                    elevation: 0
                });
            }
        };

        const timer = setInterval(update, 1000);
        update();
        return () => clearInterval(timer);
    }, [sat]);

    if (!sat) return null;

    // Derived Orbital Data (Approximations from TLE/SatRec would be better, but parsing lines for now)
    // L1 C19-32 Epoch
    // L2 C9-16 Inclination
    // L2 C18-25 Eccentricity (decimal point assumed)
    // L2 C27-33 Arg Perigee
    // L2 C35-42 Mean Anomaly
    // L2 C44-51 Mean Motion
    
    const inclination = parseFloat(sat.line2.substring(8, 16));
    const raan = parseFloat(sat.line2.substring(17, 25)); // Right Ascension of Ascending Node
    const eccentricity = parseFloat("0." + sat.line2.substring(26, 33));
    const argPerigee = parseFloat(sat.line2.substring(34, 42));
    const meanAnomaly = parseFloat(sat.line2.substring(43, 51));
    const meanMotion = parseFloat(sat.line2.substring(52, 63));
    
    // Orbital Period (mins) = 1440 / MeanMotion
    const periodMins = 1440.0 / meanMotion;
    const periodHrs = Math.floor(periodMins / 60);
    const periodMinsRem = Math.round(periodMins % 60);

    return (
        <div className={styles.container}>
            {/* Header / Title Card */}
            <div className={styles.headerCard}>
                <div className={styles.satImagePlaceholder}>
                   {/* In real app, fetch from n2yo or similar if permissible, or use generic asset */}
                   <div className={styles.satIcon}>🛰️</div> 
                </div>
                <div className={styles.headerContent}>
                    <h2 className={styles.title}>{sat.name}</h2>
                    <div className={styles.badges}>
                        <span className={styles.badgeId}>#{sat.id}</span>
                        <span className={styles.badgeCospAR}>{sat.line1.substring(9, 17).trim()}</span>
                    </div>
                    {telemetry && (
                        <div className={styles.quickStats}>
                             <div className={styles.statGrid}>
                                <div className={styles.statItem}>
                                    <label>SPEED</label>
                                    <span className={styles.value}>{Math.round(telemetry.speed).toLocaleString()} km/h</span>
                                </div>
                                <div className={styles.statItem}>
                                    <label>HEIGHT</label>
                                    <span className={styles.value}>{Math.round(telemetry.height).toLocaleString()} km</span>
                                </div>
                                <div className={styles.statItem}>
                                    <label>LATITUDE</label>
                                    <span className={styles.value}>{telemetry.lat.toFixed(2)}°</span>
                                </div>
                                <div className={styles.statItem}>
                                    <label>LONGITUDE</label>
                                    <span className={styles.value}>{telemetry.lon.toFixed(2)}°</span>
                                </div>
                             </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className={styles.tabs}>
                <button className={`${styles.tab} ${activeTab === 'details' ? styles.tabActive : ''}`} onClick={() => setActiveTab('details')}>ORBIT DATA</button>
                <button className={`${styles.tab} ${activeTab === 'debug' ? styles.tabActive : ''}`} onClick={() => setActiveTab('debug')}>RAW TLE</button>
            </div>

            {/* Content Scroller */}
            <div className={styles.viewport}>
                {activeTab === 'details' && (
                    <div className={styles.table}>
                        <div className={styles.row}>
                            <span>Epoch</span>
                            <span>{formatEpoch(sat)}</span>
                        </div>
                        <div className={styles.row}>
                            <span>Inclination</span>
                            <span>{inclination.toFixed(4)}°</span>
                        </div>
                         <div className={styles.row}>
                            <span>Eccentricity</span>
                            <span>{eccentricity.toFixed(6)}</span>
                        </div>
                        <div className={styles.row}>
                            <span>RAAN</span>
                            <span>{raan}</span>
                        </div>
                         <div className={styles.row}>
                            <span>Arg of Perigee</span>
                            <span>{argPerigee}°</span>
                        </div>
                        <div className={styles.row}>
                            <span>Mean Motion</span>
                            <span>{meanMotion.toFixed(4)} rev/day</span>
                        </div>
                        <div className={styles.row}>
                            <span>Orbital Period</span>
                            <span>{periodHrs}h {periodMinsRem}m</span>
                        </div>
                         <div className={styles.row}>
                            <span>BSTAR (Drag)</span>
                            <span>{sat.line1.substring(53, 61)}</span>
                        </div>
                    </div>
                )}

                {activeTab === 'debug' && (
                    <div className={styles.tleBox}>
                        <div className={styles.tleHeader}>Two Line Element Set (TLE)</div>
                        <pre className={styles.tleContent}>
                            {sat.name}
                            {'\n'}
                            {sat.line1}
                            {'\n'}
                            {sat.line2}
                        </pre>
                        <button 
                            className={styles.copyBtn}
                            onClick={() => navigator.clipboard.writeText(`${sat.name}\n${sat.line1}\n${sat.line2}`)}
                        >
                            COPY TLE
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SatelliteInfoPanel;
