import type { MetadataRoute } from "next";
import { INFO_PAGES, SITE_URL } from "@/lib/legal";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    ...INFO_PAGES.map((p) => ({ url: `${SITE_URL}${p.href}`, changeFrequency: "monthly" as const, priority: p.href === "/faq" ? 0.7 : 0.3 })),
  ];
}
