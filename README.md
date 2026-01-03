# SatTrak 🛰️

**SatTrak** is a high-fidelity, real-time 3D visualization of Earth's orbital traffic. It renders thousands of active satellites and debris objects in the browser using live data.

*Visualizing the scale of human activity in space.*

## Key Features

- **Large Scale Rendering**: Utilizes GPU instancing to render the full public satellite catalog at 60 FPS.
- **Real-Time Propagation**: Client-side SGP4 propagation using `satellite.js` for accurate, live positioning.
- **Interactive Globe**:
  - Filter by orbit type (LEO, MEO, GEO).
  - Search specific satellites.
  - Live telemetry dashboard.
  - Visual distinction for selected orbits and hover states.
- **Advanced Rendering**:
  - Custom atmosphere shaders (Rayleigh & Mie Scattering).
  - HDR Bloom & Emissive background.
  - Accurate starfield positioning.
  - Volumetric-style orbit lines.
- **Performance Optimized**:
  - Adaptive render loops.
  - Efficient batched geometry.
  - Selective post-processing.

## Tech Stack

- **Frontend**: 
  - [React](https://react.dev/) (Next.js)
  - [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) (Three.js provider)
  - [Drei](https://github.com/pmndrs/drei) (Abstractions)
  - [Post-processing](https://github.com/pmndrs/react-postprocessing)
- **Backend**:
  - [.NET 10](https://dotnet.microsoft.com/) (API & Worker Service)
  - **MemoryCache** for TLE data management.
  - Background services for automatic TLE synchronization with CelesTrak.

## Getting Started

### Prerequisites
- Node.js (v18+)
- .NET 10 SDK

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

## Controls

- **Left Click + Drag**: Rotate Camera
- **Right Click + Drag**: Zoom / Pan
- **Click Satellite**: Select & View Orbit
- **Hover**: Quick Info
- **Search**: Find specific objects via the left panel
