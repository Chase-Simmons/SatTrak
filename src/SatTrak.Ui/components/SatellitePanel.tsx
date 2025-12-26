"use client";

import React, { useMemo } from 'react';
import { filterSatellites } from "../utils/SatelliteSearch";
import { useSatelliteStore } from '../hooks/useSatelliteStore';
import styles from './SatellitePanel.module.css';
import { getOrbitClass, getOrbitColor, OrbitClass } from '../utils/OrbitalMath';
import * as satellite from 'satellite.js';

const satLib = satellite as any;

const SatelliteItem = ({ sat, isSelected, isFocused, onToggle, onFocus }: { 
    sat: any, 
    isSelected: boolean, 
    isFocused: boolean,
    onToggle: () => void, 
    onFocus: (e: React.MouseEvent) => void 
}) => {
    const [stats, setStats] = React.useState<{ alt: number, class: OrbitClass } | null>(null);

    React.useEffect(() => {
        const update = () => {
            const rec = satLib.twoline2satrec(sat.line1, sat.line2);
            if (!rec) return;
            const now = new Date();
            const pv = satLib.propagate(rec, now);
            if (pv && pv.position && typeof pv.position !== 'boolean') {
                const p = pv.position;
                const r = Math.sqrt(p.x*p.x + p.y*p.y + p.z*p.z);
                const alt = r - 6371;
                setStats({ alt, class: getOrbitClass(alt) });
            }
        };
        update();
        const timer = setInterval(update, 5000); // Live-ish stats
        return () => clearInterval(timer);
    }, [sat]);

    const displayName = sat.name && sat.name !== "Unknown" ? sat.name : `SAT-${sat.id}`;
    const statusColor = stats ? getOrbitColor(stats.class) : '#475569';

    return (
        <div 
            onClick={onToggle}
            className={`${styles.listItem} ${isSelected ? styles.listItemSelected : ''} ${isFocused ? styles.listItemFocused : ''}`}
        >
            <div 
                className={`${styles.statusDot} ${isSelected ? styles.statusDotPulse : ''}`}
                style={{ backgroundColor: statusColor }} 
            />

            <div style={{ flex: 1, minWidth: 0 }}>
                <span className={styles.itemName} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                    {displayName}
                </span>
                {stats && (
                    <div className={styles.statsRow}>
                        <span>{stats.class}</span>
                        <span>ALT: {Math.round(stats.alt).toLocaleString()} KM</span>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                <span className={styles.itemId} style={{ fontSize: '8px', opacity: 0.4 }}>#{sat.id}</span>
                <button 
                    onClick={onFocus}
                    className={`${styles.focusBtn} ${isFocused ? styles.focusBtnLocked : ''}`}
                >
                    {isFocused ? "LOCKED" : "FOCUS"}
                </button>
            </div>
        </div>
    );
};

const SatellitePanel = () => {
    const { 
        tles, 
        searchQuery, 
        setSearchQuery, 
        selectedIds, 
        toggleSelection, 
        clearSelection,
        selectMultiple,
        showOrbits,
        showLabels,
        showKmMarkers,
        showOrbitRanges,
        showCelestialBodies,
        setShowOrbits,
        setShowLabels,
        setShowKmMarkers,
        setShowOrbitRanges,
        setShowCelestialBodies,
        focusedId,
        setFocusedId
    } = useSatelliteStore();
    
    const [visibleCount, setVisibleCount] = React.useState(100);
    const [pinnedVisibleCount, setPinnedVisibleCount] = React.useState(100);
    const [isOpen, setIsOpen] = React.useState(true);
    const [showSettings, setShowSettings] = React.useState(false);

    // Grouping for a better Browse Experience
    const filterCategories = [
        {
            name: "CONSTELLATIONS",
            filters: [
                { label: "STARLINK", query: "STARLINK" },
                { label: "ONEWEB", query: "ONEWEB" },
                { label: "IRIDIUM", query: "IRIDIUM" },
                { label: "GPS", query: "GPS" },
                { label: "GLONASS", query: "GLONASS" },
                { label: "GALILEO", query: "GALILEO" },
                { label: "BEIDOU", query: "BEIDOU" },
            ]
        },
        {
            name: "ORBITAL ZONES",
            filters: [
                { label: "LEO (Low)", query: "LEO" },
                { label: "MEO (Mid)", query: "MEO" },
                { label: "GEO (Fixed)", query: "GEO" },
            ]
        },
        {
            name: "MISSIONS & TYPES",
            filters: [
                { label: "ISS", query: "ISS" },
                { label: "TIANGONG", query: "CSS" },
                { label: "METEOR", query: "METEOR" },
                { label: "DEBRIS", query: "DEBRIS" },
                { label: "ROCKETS", query: "ROCKET" },
            ]
        }
    ];

    // 1. Separate Selected (Pinned) vs Search Results
    const { selectedSats, filteredSats } = useMemo(() => {
        const selectedSet = new Set(selectedIds);
        
        // A. Identify Selected Objects (Pinned)
        let selected = tles.filter(s => selectedSet.has(s.id));
        selected.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        
        // B. Identify Search Results
        let filtered = tles;
        if (searchQuery.trim().length > 0) {
            filtered = filterSatellites(tles, searchQuery);
        }
        
        let filteredUnselected = filtered.filter(s => !selectedSet.has(s.id));
        filteredUnselected.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        return { selectedSats: selected, filteredSats: filteredUnselected };
    }, [tles, searchQuery, selectedIds]);

    const handleSelectAll = () => {
        const newIds = filteredSats.map(s => s.id);
        const totalToSelect = Array.from(new Set([...selectedIds, ...newIds]));
        
        if (newIds.length > 200) {
            // Staggered Selection to prevent main-thread lockup
            const alreadySelected = new Set(selectedIds);
            const toAdd = newIds.filter(id => !alreadySelected.has(id));
            
            let currentSelection = [...selectedIds];
            // ULTRA-SHARP THROTTLING: Use 20 items if list is massive (>1000)
            const BATCH_SIZE = toAdd.length > 1000 ? 20 : 200; 
            let offset = 0;
            
            const addBatch = () => {
                const batch = toAdd.slice(offset, offset + BATCH_SIZE);
                if (batch.length === 0) return;
                
                currentSelection = [...currentSelection, ...batch];
                selectMultiple(currentSelection);
                
                offset += BATCH_SIZE;
                if (offset < toAdd.length) {
                    setTimeout(addBatch, 64); // More breathing room between batches
                }
            };
            addBatch();
        } else {
            selectMultiple(totalToSelect);
        }
    };

    const paginatedSelected = selectedSats.slice(0, pinnedVisibleCount);
    const paginatedFiltered = filteredSats.slice(0, visibleCount);

    return (
        <div 
            className={styles.panel}
            style={{
                transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
        >
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    position: 'absolute',
                    left: '100%',
                    top: '120px',
                    background: 'rgba(10, 14, 23, 0.8)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderLeft: 'none',
                    borderRadius: '0 4px 4px 0',
                    color: '#22d3ee',
                    padding: '12px 4px',
                    cursor: 'pointer',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '24px',
                    boxShadow: '4px 0 10px rgba(0,0,0,0.2)'
                }}
                title={isOpen ? "Collapse Panel" : "Expand Panel"}
            >
                {isOpen ? '❮' : '❯'}
            </button>
            {/* Header */}
            <div className={styles.header}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className={styles.title}>SAT TRAK // MISSION CONTROL</div>
                    <button 
                        className={styles.settingsBtn}
                        onClick={() => setShowSettings(!showSettings)}
                    >
                        {showSettings ? "CLOSE" : "SETTINGS"}
                    </button>
                </div>
                <div className={styles.subtitle}>
                    CATALOG SIZE: {tles.length.toLocaleString()} OBJECTS
                </div>
                
                {showSettings && (
                    <div className={styles.settingsOverlay}>
                        <div className={styles.settingsTitle}>
                            <span>VISUALIZATION SETTINGS</span>
                        </div>
                        <div className={styles.settingsGrid}>
                            <div className={styles.settingRow}>
                                <span>ORBITAL PATHS</span>
                                <div 
                                    className={`${styles.toggle} ${showOrbits ? styles.toggleActive : ''}`}
                                    onClick={() => setShowOrbits(!showOrbits)}
                                />
                            </div>
                            <div className={styles.settingRow}>
                                <span>OBJECT LABELS</span>
                                <div 
                                    className={`${styles.toggle} ${showLabels ? styles.toggleActive : ''}`}
                                    onClick={() => setShowLabels(!showLabels)}
                                />
                            </div>
                            <div className={styles.settingRow}>
                                <span>DISTANCE GRID (KM)</span>
                                <div 
                                    className={`${styles.toggle} ${showKmMarkers ? styles.toggleActive : ''}`}
                                    onClick={() => setShowKmMarkers(!showKmMarkers)}
                                />
                            </div>
                            <div className={styles.settingRow}>
                                <span>ORBITAL RANGES (LEO/GEO)</span>
                                <div 
                                    className={`${styles.toggle} ${showOrbitRanges ? styles.toggleActive : ''}`}
                                    onClick={() => setShowOrbitRanges(!showOrbitRanges)}
                                />
                            </div>
                            <div className={styles.settingRow}>
                                <span>CELESTIAL BODIES (SUN/MOON)</span>
                                <div 
                                    className={`${styles.toggle} ${showCelestialBodies ? styles.toggleActive : ''}`}
                                    onClick={() => setShowCelestialBodies(!showCelestialBodies)}
                                />
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Search */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '10px', color: '#64748b', letterSpacing: '0.05em' }}>SEARCH FILTER</span>
                    <div style={{ position: 'relative', cursor: 'help' }} className="group">
                        <span style={{ fontSize: '10px', color: '#22d3ee', border: '1px solid #22d3ee', borderRadius: '50%', width:'14px', height:'14px', display:'flex', alignItems:'center', justifyContent:'center' }}>?</span>
                        
                        <div style={{
                            display: 'none',
                            position: 'absolute',
                            right: 0,
                            top: '20px',
                            background: 'rgba(0,0,0,0.95)',
                            border: '1px solid #333',
                            padding: '12px',
                            borderRadius: '4px',
                            width: '240px',
                            zIndex: 3000,
                            fontSize: '11px',
                            color: '#ccc',
                            backdropFilter: 'blur(10px)',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                        }} className="tooltip-content">
                            <strong style={{ color: '#22d3ee' }}>SIMPLE SEARCH GUIDE</strong><br/>
                            <div style={{ marginTop: '8px', lineHeight: '1.6' }}>
                                • <strong>LEO / GEO / MEO</strong> : Orbit zones<br/>
                                • <strong>DEBRIS / ROCKET</strong> : Specific types<br/>
                                • <strong>limit:100</strong> : Result count cap<br/>
                                • <strong>A OR B</strong> : Match either term<br/>
                                <br/>
                                <em style={{color:'#666'}}>Ex: "Starlink OR OneWeb"</em>
                            </div>
                        </div>
                        <style jsx>{`
                            .group:hover .tooltip-content { display: block !important; }
                        `}</style>
                    </div>
                </div>
                <input 
                    type="text" 
                    placeholder="Search by name, ID, or zone (LEO, GEO)..." 
                    className={styles.searchBox}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />

                {/* Quick Filters - Categorized */}
                <div className={styles.browseCategories}>
                    {filterCategories.map(cat => (
                        <div key={cat.name} style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '9px', color: '#475569', marginBottom: '8px', letterSpacing: '0.1em', fontWeight: 600 }}>{cat.name}</div>
                            <div className={styles.filterTags}>
                                {cat.filters.map(f => (
                                    <button 
                                        key={f.label}
                                        onClick={() => setSearchQuery(f.query)}
                                        className={styles.filterBtn}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery("")}
                            className={styles.clearBtn}
                            style={{ width: '100%' }}
                        >
                            CLEAR ALL FILTERS
                        </button>
                    )}
                </div>

                {/* Selection Actions */}
                {(selectedIds.length > 0 || (filteredSats.length > 0 && searchQuery)) && (
                    <div className={styles.actionBar}>
                        {filteredSats.length > 0 && searchQuery && (
                            <button 
                                onClick={handleSelectAll}
                                className={`${styles.utilityBtn} ${styles.utilityBtnPrimary}`}
                            >
                                SELECT ALL ({filteredSats.length})
                            </button>
                        )}
                        {selectedIds.length > 0 && (
                            <button 
                                onClick={() => clearSelection()}
                                className={`${styles.utilityBtn} ${styles.utilityBtnDanger}`}
                            >
                                CLEAR SELECTION ({selectedIds.length})
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* List */}
            <div className={styles.listContainer}>
                {/* Pinned Section */}
                {selectedSats.length > 0 && (
                    <div className={`${styles.sectionHeader} ${styles.sectionHeaderActive}`}>
                        <span>TRACKED OBJECTS</span>
                        <span>{selectedSats.length}</span>
                    </div>
                )}
                {paginatedSelected.map(sat => (
                    <SatelliteItem 
                        key={sat.id} 
                        sat={sat} 
                        isSelected={true} 
                        isFocused={focusedId === sat.id}
                        onToggle={() => toggleSelection(sat.id)}
                        onFocus={(e) => {
                            e.stopPropagation();
                            setFocusedId(focusedId === sat.id ? null : sat.id);
                        }}
                    />
                ))}

                {selectedSats.length > pinnedVisibleCount && (
                    <div className={styles.moreIndicator} onClick={() => setPinnedVisibleCount(c => c + 100)} style={{ cursor: 'pointer', color: '#06b6d4' }}>
                        + {selectedSats.length - pinnedVisibleCount} MORE TRACKED OBJECTS
                    </div>
                )}

                {selectedSats.length > 0 && <div style={{ height: '4px' }} />}
                
                {filteredSats.length === 0 && !selectedSats.length ? (
                    <div className={styles.emptyState}>No satellites found matching "{searchQuery}".</div>
                ) : (
                    <div>
                        {searchQuery && (
                            <div className={styles.sectionHeader}>
                                <span>FILTER RESULTS</span>
                                <span>{filteredSats.length} ITEMS</span>
                            </div>
                        )}
                        {paginatedFiltered.map(sat => (
                            <SatelliteItem 
                                key={sat.id} 
                                sat={sat} 
                                isSelected={false} 
                                isFocused={focusedId === sat.id}
                                onToggle={() => toggleSelection(sat.id)}
                                onFocus={(e) => {
                                    e.stopPropagation();
                                    setFocusedId(focusedId === sat.id ? null : sat.id);
                                }}
                            />
                        ))}
                        
                        {filteredSats.length > visibleCount && (
                            <div className={styles.moreIndicator} onClick={() => setVisibleCount(c => c + 100)} style={{ cursor: 'pointer', color: '#06b6d4' }}>
                                + {filteredSats.length - visibleCount} MORE OBJECTS (CLICK TO LOAD)
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SatellitePanel;
