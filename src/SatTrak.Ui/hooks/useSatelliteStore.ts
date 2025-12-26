import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as satellite from 'satellite.js';

const satLib = satellite as any;

export interface SatelliteTle {
    id: number;
    name: string;
    line1: string;
    line2: string;
}

interface SatelliteStore {
    tles: SatelliteTle[];
    tleMap: Map<number, SatelliteTle>; // Fast lookup
    satrecCache: Map<number, any>;
    loading: boolean;
    
    // Multi-Selection
    selectedIds: number[];
    toggleSelection: (id: number) => void;
    clearSelection: () => void;
    selectMultiple: (ids: number[]) => void;

    // View Options
    showOrbits: boolean;
    showLabels: boolean;
    showKmMarkers: boolean;
    showOrbitRanges: boolean;
    showCelestialBodies: boolean;

    setShowOrbits: (show: boolean) => void;
    setShowLabels: (show: boolean) => void;
    setShowKmMarkers: (show: boolean) => void;
    setShowOrbitRanges: (show: boolean) => void;
    setShowCelestialBodies: (show: boolean) => void;
    
    searchQuery: string;
    setSearchQuery: (q: string) => void;

    focusedId: number | null;
    setFocusedId: (id: number | null) => void;

    fetchTles: () => Promise<void>;
}

export const useSatelliteStore = create<SatelliteStore>()(
    persist(
        (set) => ({
            tles: [],
            tleMap: new Map(),
            satrecCache: new Map(),
            loading: false,
            
            selectedIds: [],
            focusedId: null,
            showOrbits: true,
            showLabels: true,
            showKmMarkers: true,
            showOrbitRanges: true,
            showCelestialBodies: true,
            searchQuery: "",

            toggleSelection: (id) => set((state) => {
                const exists = state.selectedIds.includes(id);
                return {
                    selectedIds: exists 
                        ? state.selectedIds.filter(sid => sid !== id)
                        : [...state.selectedIds, id]
                };
            }),
            clearSelection: () => set({ selectedIds: [], focusedId: null }),
            selectMultiple: (ids) => set({ selectedIds: ids }),

            setFocusedId: (id) => set({ focusedId: id }),

            setShowOrbits: (val) => set({ showOrbits: val }),
            setShowLabels: (val) => set({ showLabels: val }),
            setShowKmMarkers: (val) => set({ showKmMarkers: val }),
            setShowOrbitRanges: (val) => set({ showOrbitRanges: val }),
            setShowCelestialBodies: (val) => set({ showCelestialBodies: val }),

            setSearchQuery: (q) => set({ searchQuery: q }),

    fetchTles: async () => {
        set({ loading: true });
        try {
            const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5279";
            const res = await fetch(`${url}/api/satellites`);
            if (!res.ok) throw new Error("Failed to fetch TLEs");
            const data = await res.json() as SatelliteTle[];
            
            // 1. Save data initially
            const tMap = new Map<number, SatelliteTle>();
            data.forEach(s => tMap.set(s.id, s));

            set({ tles: data, tleMap: tMap, loading: false });

            // 2. Start Background Processing (Staggered Load)
            const cache = new Map<number, any>();
            let index = 0;
            const BATCH_SIZE = 500;

            const processBatch = () => {
                const start = index;
                const end = Math.min(start + BATCH_SIZE, data.length);
                
                for (let i = start; i < end; i++) {
                    const s = data[i];
                    const rec = satLib.twoline2satrec(s.line1, s.line2);
                    if (rec) cache.set(s.id, rec);
                }

                index = end;
                // Update the cache incrementally
                set({ satrecCache: new Map(cache) });

                if (index < data.length) {
                    setTimeout(processBatch, 16); // Run next batch
                }
            };
            
            processBatch();

        } catch (err) {
            console.error(err);
            set({ loading: false });
        }
    },
        }),
        {
            name: 'sattrak-settings',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ 
                showOrbits: state.showOrbits,
                showLabels: state.showLabels,
                showKmMarkers: state.showKmMarkers,
                showOrbitRanges: state.showOrbitRanges,
                showCelestialBodies: state.showCelestialBodies
            }),
        }
    )
);
