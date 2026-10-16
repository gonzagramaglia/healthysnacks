"use client";

import { useEffect } from "react";
import { setupMockApi } from "@/lib/mock-api";

export function MockApiProvider() {
  useEffect(() => {
    setupMockApi();
  }, []);

  return null;
}
