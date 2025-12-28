"use client";

import dynamic from "next/dynamic";

// Dynamically import CesiumViewer with SSR disabled because it relies on 'window'
const MainScene = dynamic(() => import("@/components/MainScene"), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="w-screen h-screen overflow-hidden bg-black">
      <MainScene />
    </main>
  );
}
