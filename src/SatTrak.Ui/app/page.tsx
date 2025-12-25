"use client";

import dynamic from "next/dynamic";

// Dynamically import CesiumViewer with SSR disabled because it relies on 'window'
const Globe = dynamic(() => import("@/components/Globe"), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="w-screen h-screen overflow-hidden bg-black">
      <Globe />
    </main>
  );
}
