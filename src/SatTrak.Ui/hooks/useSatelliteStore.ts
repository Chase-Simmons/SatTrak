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
    // Selection & filtering
    selectedSatId: number | null;
    setSelectedSatId: (id: number | null) => void;
    
    searchQuery: string;
    setSearchQuery: (q: string) => void;

    fetchTles: () => Promise<void>;
}

export const useSatelliteStore = create<SatelliteStore>((set) => ({
    tles: [],
    loading: false,
    selectedSatId: null,
    searchQuery: "",
    setSelectedSatId: (id) => set({ selectedSatId: id }),
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
