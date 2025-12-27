"use client";

import React, { useMemo } from 'react';
import { filterSatellites } from "../utils/SatelliteSearch";
import { useSatelliteStore } from '../hooks/useSatelliteStore';
import { useShallow } from 'zustand/react/shallow'; 
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
    const statusColor = stats ? '#' + getOrbitColor(stats.class).toString(16).padStart(6, '0') : '#475569';

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
    } = useSatelliteStore(useShallow(state => ({
        tles: state.tles, 
        searchQuery: state.searchQuery, 
        setSearchQuery: state.setSearchQuery, 
        selectedIds: state.selectedIds, 
        toggleSelection: state.toggleSelection, 
        clearSelection: state.clearSelection,
        selectMultiple: state.selectMultiple,
        showOrbits: state.showOrbits,
        showLabels: state.showLabels,
        showKmMarkers: state.showKmMarkers,
        showOrbitRanges: state.showOrbitRanges,
        showCelestialBodies: state.showCelestialBodies,
        setShowOrbits: state.setShowOrbits,
        setShowLabels: state.setShowLabels,
        setShowKmMarkers: state.setShowKmMarkers,
        setShowOrbitRanges: state.setShowOrbitRanges,
        setShowCelestialBodies: state.setShowCelestialBodies,
        focusedId: state.focusedId,
        setFocusedId: state.setFocusedId
    })));
    
    const [visibleCount, setVisibleCount] = React.useState(100);
    const [pinnedVisibleCount, setPinnedVisibleCount] = React.useState(100);
    const [isOpen, setIsOpen] = React.useState(true);
    const [showSettings, setShowSettings] = React.useState(false);
    const [showHelp, setShowHelp] = React.useState(false);
    
    // UX: Track which browse categories are expanded
    const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(new Set([
        "CONSTELLATIONS", 
        "ORBITAL ZONES",
        "OBJECT TYPES"
    ]));

    const toggleCategory = (name: string) => {
        const next = new Set(expandedCategories);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        setExpandedCategories(next);
    };

    // Grouping for a better Browse Experience
    // Grouping for a better Browse Experience
    // Grouping for a better Browse Experience
    const filterCategories = [
        {
            name: "CONSTELLATIONS",
            filters: [
                { label: "STARLINK", query: "STARLINK" },
                { label: "ONEWEB", query: "ONEWEB" },
                { label: "IRIDIUM", query: "IRIDIUM" },
                { label: "GLOBALSTAR", query: "GLOBALSTAR" },
                { label: "KUIPER", query: "KUIPER" },
                { label: "QIANFAN", query: "QIANFAN" },
                { label: "FLOCK", query: "FLOCK" },
                { label: "LEMUR", query: "LEMUR" },
                { label: "O3B", query: "O3B" },
            ]
        },
        {
            name: "GNSS & NAVIGATION",
            filters: [
                { label: "GPS", query: "GPS" },
                { label: "GLONASS", query: "GLONASS" },
                { label: "GALILEO", query: "GALILEO" },
                { label: "BEIDOU", query: "BEIDOU" },
                { label: "QZS", query: "QZS" },
                { label: "NAVY NAV", query: "NAVY" },
            ]
        },
        {
            name: "COMMUNICATIONS",
            filters: [
                { label: "INTELSAT", query: "INTELSAT" },
                { label: "SES", query: "SES" },
                { label: "EUTELSAT", query: "EUTELSAT" },
                { label: "INMARSAT", query: "INMARSAT" },
                { label: "TELESAT", query: "TELESAT" },
                { label: "ORBCOMM", query: "ORBCOMM" },
                { label: "HISPASAT", query: "HISPASAT" },
                { label: "JCSAT", query: "JCSAT" },
                { label: "TURKSAT", query: "TURKSAT" },
                { label: "GALAXY", query: "GALAXY" },
                { label: "TDRS", query: "TDRS" },
                { label: "GORIZONT", query: "GORIZONT" },
                { label: "RADUGA", query: "RADUGA" },
            ]
        },
        {
            name: "SCIENCE & WEATHER",
            filters: [
                { label: "NOAA", query: "NOAA" },
                { label: "GOES", query: "GOES" },
                { label: "METEOR", query: "METEOR" },
                { label: "WEATHER", query: "WEATHER" },
                { label: "EARTH MON", query: "EARTH" },
                { label: "DISASTER", query: "DISASTER" },
                { label: "S & R", query: "SAR" },
                { label: "YAOGAN", query: "YAOGAN" }, 
            ]
        },
        {
            name: "MILITARY & GOV",
            filters: [
                { label: "USA MIL", query: "USA-" },
                { label: "COSMOS", query: "COSMOS" },
                { label: "NROL", query: "NROL" },
                { label: "STATION", query: "STATION" },
            ]
        },
        {
            name: "MISC / OTHER",
            filters: [
                { label: "EXP/TEST", query: "EXPERIMENTAL" },
                { label: "TV SAT", query: "TV" },
                { label: "NEEDLE", query: "NEEDLE" },
                { label: "TBA", query: "TBA" },
            ]
        },
        {
            name: "ORBITAL ZONES",
            filters: [
                { label: "LEO (Low)", query: "LEO" },
                { label: "MEO (Mid)", query: "MEO" },
                { label: "GEO (Fixed)", query: "GEO" },
                { label: "HEO (High)", query: "HEO" },
                { label: "MOLNIYA", query: "MOLNIYA" },
                { label: "TUNDRA", query: "TUNDRA" },
            ]
        },
        {
            name: "OBJECT TYPES",
            filters: [
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
            const BATCH_SIZE = 200; 
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <div className={styles.title}>
                        <span style={{ color: '#06b6d4' }}>SAT TRAK</span>
                        <span style={{ color: '#64748b', fontSize: '11px', fontWeight: 500, marginLeft: '4px' }}> // MISSION CONTROL</span>
                    </div>
                    <button 
                        className={styles.settingsBtn}
                        onClick={() => {
                            setShowSettings(!showSettings);
                            setShowHelp(false);
                        }}
                    >
                        {showSettings ? "CLOSE" : "SETTINGS"}
                    </button>
                </div>
                <div className={styles.subtitle}>
                    CATALOG SIZE: {tles.length.toLocaleString()} OBJECTS
                </div>
                
                <div style={{ position: 'relative', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontSize: '10px', color: '#64748b', letterSpacing: '0.1em', fontWeight: 'bold' }}>SEARCH FILTER</div>
                        <button 
                            className={styles.settingsBtn}
                            style={{ padding: '0px 5px', fontSize: '12px', borderRadius: '50%' }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowHelp(!showHelp);
                                setShowSettings(false);
                            }}
                        >
                            ?
                        </button>
                    </div>
                
                <div style={{ position: 'relative' }}>
                    <input 
                        type="text" 
                        className={styles.searchBox}
                        placeholder="Search by name, ID or orbit..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button 
                            className={styles.searchClear}
                            onClick={() => setSearchQuery("")}
                            title="Clear search"
                        >
                            ✕
                        </button>
                    )}
                </div>
                </div>

                {showHelp && (
                    <div className={styles.settingsOverlay}>
                        <div className={styles.settingsTitle}>
                            <span>SIMPLE SEARCH GUIDE</span>
                            <button className={styles.utilityBtn} onClick={() => setShowHelp(false)}>CLOSE</button>
                        </div>
                        <div className={styles.helpGrid}>
                            <div className={styles.helpGroup}>
                                <div className={styles.helpLabel}>Basic Syntax</div>
                                <div className={styles.syntaxItem}>
                                    <span className={styles.syntaxCode}>LEO / GEO / MEO</span>
                                    <span className={styles.syntaxDesc}>Orbit zones (Low/Medium/Geostationary)</span>
                                </div>
                                <div className={styles.syntaxItem}>
                                    <span className={styles.syntaxCode}>DEBRIS / ROCKET</span>
                                    <span className={styles.syntaxDesc}>Filter by specific object types</span>
                                </div>
                                <div className={styles.syntaxItem}>
                                    <span className={styles.syntaxCode}>limit:100</span>
                                    <span className={styles.syntaxDesc}>Cap results to a specific number</span>
                                </div>
                            </div>

                            <div className={styles.helpGroup}>
                                <div className={styles.helpLabel}>Deep Search Tags</div>
                                <div className={styles.syntaxItem}>
                                    <span className={styles.syntaxCode}>year:2024</span>
                                    <span className={styles.syntaxDesc}>Filter by launch year</span>
                                </div>
                                <div className={styles.syntaxItem}>
                                    <span className={styles.syntaxCode}>country:USA</span>
                                    <span className={styles.syntaxDesc}>Search by nation (USA, RUSSIA, etc.)</span>
                                </div>
                                <div className={styles.syntaxItem}>
                                    <span className={styles.syntaxCode}>MILITARY</span>
                                    <span className={styles.syntaxDesc}>Alias for common classification prefixes</span>
                                </div>
                            </div>

                            <div className={styles.helpGroup}>
                                <div className={styles.helpLabel}>Advanced Logic</div>
                                <div className={styles.syntaxItem}>
                                    <span className={styles.syntaxCode}>A OR B</span>
                                    <span className={styles.syntaxDesc}>Find satellites matching either term</span>
                                </div>
                                <div className={styles.syntaxItem}>
                                    <span className={styles.syntaxCode}>A and B</span>
                                    <span className={styles.syntaxDesc}>Match both terms (Default behavior)</span>
                                </div>
                            </div>

                            <div className={styles.helpGroup}>
                                <div className={styles.helpLabel}>Examples</div>
                                <div className={styles.syntaxItem}>
                                    <span className={styles.syntaxCode}>"year:1998 ISS"</span>
                                    <span className={styles.syntaxDesc}>Find the ISS (Launched 1998)</span>
                                </div>
                                <div className={styles.syntaxItem}>
                                    <span className={styles.syntaxCode}>"USA and MEO"</span>
                                    <span className={styles.syntaxDesc}>Find US constellation in Medium Orbit</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
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
                

                {/* Quick Filters - Categorized */}
                <div className={styles.browseCategories}>
                    {filterCategories.map((group) => {
                const isExpanded = expandedCategories.has(group.name);
                return (
                    <div key={group.name} style={{ marginBottom: isExpanded ? '16px' : '4px' }}>
                        <div 
                            className={styles.categoryHeader} 
                            onClick={() => toggleCategory(group.name)}
                        >
                            <span>{group.name}</span>
                            <span className={styles.chevron} style={{ 
                                transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                                opacity: 0.5 
                            }}>
                                ▼
                            </span>
                        </div>
                        
                        {isExpanded && (
                            <div className={styles.filterTags}>
                                {group.filters.map((f) => (
                                    <button
                                        key={f.label}
                                        className={`${styles.filterBtn} ${searchQuery.toUpperCase().includes(f.query.toUpperCase()) ? styles.active : ""}`}
                                        onClick={() => {
                                            const upperQuery = searchQuery.toUpperCase();
                                            const filterQuery = f.query.toUpperCase();

                                            if (upperQuery === filterQuery) {
                                                setSearchQuery("");
                                            } else {
                                                setSearchQuery(f.query);
                                            }
                                        }}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery("")}
                            className={styles.resetSearchBtn}
                            style={{ width: '100%' }}
                        >
                            RESET SEARCH
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
                                UNSELECT ALL ({selectedIds.length})
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
