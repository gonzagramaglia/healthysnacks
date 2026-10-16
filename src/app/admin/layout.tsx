"use client";

import React from "react";
import { assetUrl } from "@/lib/assets";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen relative overflow-x-hidden transition-colors">
      {/* Background Wallpaper - Lower Opacity as requested */}
      <div
        className="fixed inset-0 z-[-1] opacity-10 dark:opacity-5 pointer-events-none bg-cover bg-center bg-no-repeat grayscale-[20%] brightness-110"
        style={{ backgroundImage: `url("${assetUrl("/wallpaper.png")}")` }}
      />

      {/* Content wrapper */}
      <div className="relative z-0">
        {children}
      </div>
    </div>
  );
}
