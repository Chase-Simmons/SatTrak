"use client";

import React, { useMemo } from 'react';
import { useSatelliteStore } from '../hooks/useSatelliteStore';
import styles from './SatellitePanel.module.css';

const SatellitePanel = () => {
    const { 
        tles, 
        searchQuery, 
        setSearchQuery, 
        selectedIds, 
        toggleSelection, 
        clearSelection,
        showOrbits,
        showLabels,
        setShowOrbits,
        setShowLabels
    } = useSatelliteStore();
    
    const [visibleCount, setVisibleCount] = React.useState(100);
    const [isOpen, setIsOpen] = React.useState(true);

    // Grouping by Common Constellations
    const quickFilters = ["Starlink", "GPS", "GLONASS", "IRIDIUM", "NOAA", "GOES"];

    // 1. Separate Selected (Pinned) vs Search Results
    const { selectedSats, filteredSats } = useMemo(() => {
        // A. Identify Selected Objects (Pinned)
        const selected = tles.filter(s => selectedIds.includes(s.id));
        
        // B. Identify Search Results (Excluding already selected ones to avoid duplicates?)
        //    User said: "if a user unselects ... it should render as it normal would"
        //    So we should probably dedup in the render list or just keep them separate.
        //    Let's keep them conceptually separate lists but merge for display.
        
        let filtered = tles;
        if (searchQuery.trim().length > 0) {
            const lowQ = searchQuery.toLowerCase();
            filtered = filtered.filter(s => {
                const name = s.name ? s.name.toLowerCase() : "";
                const id = s.id.toString();
                return name.includes(lowQ) || id.includes(lowQ);
            });
        }
        
        // Exclude selected from filtered to prevent duplicates in the list if we just concat
        // actually, standard pattern is to show them at top.
        const filteredUnselected = filtered.filter(s => !selectedIds.includes(s.id));

        return { selectedSats: selected, filteredSats: filteredUnselected };
    }, [tles, searchQuery, selectedIds]);

    // Combined List for Display
    // Order: Selected (Pinned) -> Filtered Results
    const displayList = useMemo(() => {
        return [...selectedSats, ...filteredSats];
    }, [selectedSats, filteredSats]);

    // Reset pagination when search *or selection* changes significantly? 
    // Actually, if we pin 10 items, they should just be at top. Pagination applies to the REST.
    // Ideally we paginate the `displayList`.
    
    const paginatedList = displayList.slice(0, visibleCount);

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
                <div className={styles.title}>SAT TRAK // MISSION CONTROL</div>
                <div className={styles.subtitle}>
                    CATALOG SIZE: {tles.length.toLocaleString()} OBJECTS
                </div>
                
                {/* Search */}
                <input 
                    type="text" 
                    placeholder="SEARCH CATALOG (e.g. 'ISS', 'STARLINK')..." 
                    className={styles.searchBox}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />

                {/* Quick Filters */}
                <div className={styles.filterTags}>
                    {quickFilters.map(Tag => (
                        <button 
                            key={Tag}
                            onClick={() => setSearchQuery(Tag.toUpperCase())}
                            className={styles.filterBtn}
                        >
                            {Tag}
                        </button>
                    ))}
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery("")}
                            className={styles.clearBtn}
                        >
                            CLEAR
                        </button>
                    )}
                </div>

                {/* View Settings & Selection Actions */}
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#94a3b8' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input 
                                type="checkbox" 
                                checked={showOrbits} 
                                onChange={(e) => setShowOrbits(e.target.checked)} 
                            />
                            SHOW ORBITS
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input 
                                type="checkbox" 
                                checked={showLabels} 
                                onChange={(e) => setShowLabels(e.target.checked)} 
                            />
                            SHOW LABELS
                        </label>
                    </div>
                    {selectedIds.length > 0 && (
                        <button 
                            onClick={() => clearSelection()}
                            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                            CLEAR SELECTION ({selectedIds.length})
                        </button>
                    )}
                </div>
            </div>

            {/* List */}
            <div className={styles.listContainer}>
                {displayList.length === 0 ? (
                    <div className={styles.emptyState}>
                        No satellites found matching "{searchQuery}".
                    </div>
                ) : (
                    <div>
                        {paginatedList.map(sat => {
                            const displayName = sat.name && sat.name !== "Unknown" ? sat.name : `SAT-${sat.id}`;
                            const isSelected = selectedIds.includes(sat.id);

                            return (
                                <div 
                                    key={sat.id}
                                    onClick={() => toggleSelection(sat.id)}
                                    className={`${styles.listItem} ${isSelected ? styles.listItemSelected : ''}`}
                                    style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                                >
                                    <div style={{ flex: 1 }}>
                                        <span className={styles.itemName}>{displayName}</span>
                                        <span className={styles.itemId}>#{sat.id}</span>
                                    </div>
                                    {isSelected && <span style={{ fontSize: '10px', color: '#22d3ee' }}>PINNED</span>}
                                </div>
                            );
                        })}
                        
                        {displayList.length > visibleCount && (
                            <div 
                                className={styles.moreIndicator}
                                onClick={() => setVisibleCount(c => c + 100)}
                                style={{ cursor: 'pointer', color: '#06b6d4' }}
                            >
                                + {displayList.length - visibleCount} MORE OBJECTS (CLICK TO LOAD)
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SatellitePanel;
