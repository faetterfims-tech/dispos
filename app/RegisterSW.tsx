"use client";

import { useEffect } from "react";

/** Registrerer service workeren (public/sw.js), så dispos kan installeres og vise en offline-side. */
export default function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
