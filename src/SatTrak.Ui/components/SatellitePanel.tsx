"use client";

import React, { useMemo } from 'react';
import { useSatelliteStore } from '../hooks/useSatelliteStore';
import styles from './SatellitePanel.module.css';

const SatellitePanel = () => {
    const { tles, searchQuery, setSearchQuery, selectedSatId, setSelectedSatId } = useSatelliteStore();
    const [visibleCount, setVisibleCount] = React.useState(100);

    // Filter Logic
    const filteredSats = useMemo(() => {
        let result = tles;
        if (searchQuery.trim().length > 0) {
            const lowQ = searchQuery.toLowerCase();
            result = result.filter(s => {
                const name = s.name ? s.name.toLowerCase() : "";
                const id = s.id.toString();
                return name.includes(lowQ) || id.includes(lowQ);
            });
        }
        return result;
    }, [tles, searchQuery]);

    // Reset visible count when search changes
    React.useEffect(() => {
        setVisibleCount(100);
    }, [searchQuery]);

    // Grouping by Common Constellations
    const quickFilters = ["Starlink", "GPS", "GLONASS", "IRIDIUM", "NOAA", "GOES"];

    return (
        <div className={styles.panel}>
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
            </div>

            {/* List */}
            <div className={styles.listContainer}>
                {filteredSats.length === 0 ? (
                    <div className={styles.emptyState}>
                        No satellites found matching "{searchQuery}".
                    </div>
                ) : (
                    <div>
                        {filteredSats.slice(0, visibleCount).map(sat => {
                            // Fallback name if missing
                            const displayName = sat.name && sat.name !== "Unknown" ? sat.name : `SAT-${sat.id}`;
                            const isSelected = selectedSatId === sat.id;

                            return (
                                <div 
                                    key={sat.id}
                                    onClick={() => setSelectedSatId(sat.id)}
                                    className={`${styles.listItem} ${isSelected ? styles.listItemSelected : ''}`}
                                >
                                    <span className={styles.itemName}>{displayName}</span>
                                    <span className={styles.itemId}>#{sat.id}</span>
                                </div>
                            );
                        })}
                        
                        {filteredSats.length > visibleCount && (
                            <div 
                                className={styles.moreIndicator}
                                onClick={() => setVisibleCount(c => c + 100)}
                                style={{ cursor: 'pointer', color: '#06b6d4' }}
                            >
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
