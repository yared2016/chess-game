import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Castle 3D Chess",
    short_name: "Castle",
    description: "Online 3D chess with real-time matchmaking, an AI opponent and custom rooms.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0b0d11",
    theme_color: "#0b0d11",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
