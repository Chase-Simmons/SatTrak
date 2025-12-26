"use client";

import React, { useMemo } from 'react';
import { filterSatellites } from "../utils/SatelliteSearch";
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
        selectMultiple,
        showOrbits,
        showLabels,
        setShowOrbits,
        setShowLabels
    } = useSatelliteStore();
    
    const [visibleCount, setVisibleCount] = React.useState(100);
    const [isOpen, setIsOpen] = React.useState(true);

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
        // A. Identify Selected Objects (Pinned)
        let selected = tles.filter(s => selectedIds.includes(s.id));
        // Sort Selected
        selected.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        
        // B. Identify Search Results
        let filtered = tles;
        if (searchQuery.trim().length > 0) {
            filtered = filterSatellites(tles, searchQuery);
        }
        
        let filteredUnselected = filtered.filter(s => !selectedIds.includes(s.id));
        filteredUnselected.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        return { selectedSats: selected, filteredSats: filteredUnselected };
    }, [tles, searchQuery, selectedIds]);

    // Combined List for Display
    const displayList = useMemo(() => {
        return [...selectedSats, ...filteredSats];
    }, [selectedSats, filteredSats]);

    const handleSelectAll = () => {
        const newIds = filteredSats.map(s => s.id);
        const combined = Array.from(new Set([...selectedIds, ...newIds]));
        selectMultiple(combined);
    };

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
                            style={{ width: '100%', marginTop: '8px', padding: '10px' }}
                        >
                            CLEAR ALL FILTERS
                        </button>
                    )}
                </div>

                {/* View Settings & Selection Actions */}
                <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                            <input 
                                type="checkbox" 
                                checked={showOrbits} 
                                onChange={(e) => setShowOrbits(e.target.checked)} 
                            />
                            SHOW ORBITS
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                            <input 
                                type="checkbox" 
                                checked={showLabels} 
                                onChange={(e) => setShowLabels(e.target.checked)} 
                            />
                            SHOW LABELS
                        </label>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        {filteredSats.length > 0 && searchQuery && (
                            <button 
                                onClick={handleSelectAll}
                                style={{ background: 'none', border: 'none', color: '#22d3ee', cursor: 'pointer', textDecoration: 'underline', fontSize: '10px' }}
                            >
                                SELECT ALL ({filteredSats.length})
                            </button>
                        )}
                        {selectedIds.length > 0 && (
                            <button 
                                onClick={() => clearSelection()}
                                style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', textDecoration: 'underline', fontSize: '10px' }}
                            >
                                CLEAR SELECTION ({selectedIds.length})
                            </button>
                        )}
                    </div>
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
                                        <span className={styles.itemId}> #{sat.id}</span>
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
