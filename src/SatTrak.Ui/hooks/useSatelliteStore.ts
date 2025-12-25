import { create } from 'zustand';

export interface SatelliteTle {
    id: number;
    name: string;
    line1: string;
    line2: string;
}

interface SatelliteStore {
    tles: SatelliteTle[];
    loading: boolean;
    
    // Multi-Selection
    selectedIds: number[];
    toggleSelection: (id: number) => void;
    clearSelection: () => void;
    selectMultiple: (ids: number[]) => void;

    // View Options
    showOrbits: boolean;
    showLabels: boolean;
    setShowOrbits: (show: boolean) => void;
    setShowLabels: (show: boolean) => void;
    
    searchQuery: string;
    setSearchQuery: (q: string) => void;

    fetchTles: () => Promise<void>;
}

export const useSatelliteStore = create<SatelliteStore>((set) => ({
    tles: [],
    loading: false,
    
    selectedIds: [],
    showOrbits: true,
    showLabels: true,
    searchQuery: "",

    toggleSelection: (id) => set((state) => {
        const exists = state.selectedIds.includes(id);
        return {
             selectedIds: exists 
                ? state.selectedIds.filter(sid => sid !== id)
                : [...state.selectedIds, id]
        };
    }),
    clearSelection: () => set({ selectedIds: [] }),
    selectMultiple: (ids) => set({ selectedIds: ids }),

    setShowOrbits: (val) => set({ showOrbits: val }),
    setShowLabels: (val) => set({ showLabels: val }),

    setSearchQuery: (q) => set({ searchQuery: q }),

    fetchTles: async () => {
        set({ loading: true });
        try {
            const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5279";
            const res = await fetch(`${url}/api/satellites`);
            if (!res.ok) throw new Error("Failed to fetch TLEs");
            const data = await res.json();
            set({ tles: data, loading: false });
        } catch (err) {
            console.error(err);
            set({ loading: false });
        }
    },
}));
