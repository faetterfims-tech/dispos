import type { MetadataRoute } from "next";
import { tools } from "@/lib/tools";

/**
 * Gør dispos installerbar ("Føj til hjemmeskærm"), så den åbner i fuld skærm
 * uden browserbjælke. Serveres som /manifest.webmanifest uden login (se middleware).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "dispos",
    short_name: "dispos",
    description: "Daniels værktøjer",
    lang: "da",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f5f2",
    theme_color: "#f6f5f2",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Hold fingeren på app-ikonet for at hoppe direkte ind i et værktøj (Android).
    shortcuts: tools.map((t) => ({
      name: t.name,
      url: t.href,
      description: t.description,
      icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    })),
  };
}
