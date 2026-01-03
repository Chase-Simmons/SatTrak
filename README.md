# SatTrak 🛰️

**SatTrak** is a high-fidelity, real-time 3D visualization of Earth's orbital traffic. It renders over **25,000+ active satellites and debris objects** in the browser with cinematic visual quality.

> *Visualizing the scale of human activity in space.*

## ✨ Key Features

- **Massive Scale Rendering**: Utilizes GPU instancing to render 25k+ orbiting bodies at 60 FPS.
- **Real-Time Propagation**: Client-side SGP4 propagation using `satellite.js` for accurate, live positioning.
- **Cinematic Visuals**:
  - Custom **Rayleigh & Mie Scattering** atmosphere shaders.
  - **HDR Bloom** & Emissive Milky Way background.
  - Accurate starfield positioning.
  - Volumetric-style orbit lines.
- **Interactive Globe**:
  - Filter by orbit type (LEO, MEO, GEO).
  - Search specific satellites (e.g., "Starlink", "ISS").
  - Live telemetry dashboard (Altitude, Velocity, Lat/Lon).
  - Visual distinction for selected orbits and hover states.
- **Performance Optimized**:
  - Adaptive render loops.
  - Efficient batched geometry.
  - Selective post-processing.

## 🛠️ Tech Stack

- **Frontend**: 
  - [React](https://react.dev/) (Next.js)
  - [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) (Three.js provider)
  - [Drei](https://github.com/pmndrs/drei) (Abstractions)
  - [Post-processing](https://github.com/pmndrs/react-postprocessing) (Bloom, Effects)
- **Backend**:
  - [.NET 8](https://dotnet.microsoft.com/) (API & Worker Service)
  - **MemoryCache** for TLE data management.
  - Background services for automatic TLE synchronization with CelesTrak.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- .NET 8 SDK

### 1. Backend (API)
The backend fetches and serves the Two-Line Element (TLE) data.

```bash
cd src/SatTrak.Api
dotnet run
```
*Server will start on `http://localhost:5279`*

### 2. Frontend (UI)
The visualization layer.

```bash
cd src/SatTrak.Ui
npm install
npm run dev
```
*Open `http://localhost:3000` in your browser.*

## 🎮 Controls

- **Left Click + Drag**: Rotate Camera
- **Right Click + Drag**: Zoom / Pan
- **Click Satellite**: Select & View Orbit
- **Hover**: Quick Info
- **Search**: Find specific objects via the left panel

## 📸 visual Style

The aesthetic is inspired by sci-fi interfaces and "cyber-earth" visualizations, prioritizing a dark mode palette (Slate/Zinc/Cyan/Lime) that makes data pop against the void of space.

---
*Built with ❤️ by Chase Simmons*
