import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: brand.name,
    description: brand.description,
    start_url: "/",
    display: "standalone",
    background_color: "#111318",
    theme_color: brand.color,
    icons: [
      { src: brand.icon, sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
