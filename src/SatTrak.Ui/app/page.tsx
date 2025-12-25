"use client";

import dynamic from "next/dynamic";

// Dynamically import CesiumViewer with SSR disabled because it relies on 'window'
const CesiumViewer = dynamic(() => import("@/components/CesiumViewer"), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between">
      <div className="w-full h-screen">
        <CesiumViewer />
      </div>
    </main>
  );
}
