/**
 * The six vibes offered at itinerary generation — the single source for ids
 * and display labels. Packages store the picked ids in
 * `travel_packages.vibes` (and the season in `season`); `tags` is not used.
 */
export const VIBES = [
  { id: "chill",      label: "Chill",            desc: "Spa days, yoga sessions, and slow-paced downtime",          img: "https://images.unsplash.com/photo-1602002418816-5c0aeef426aa?w=600&h=320&fit=crop" },
  { id: "adventure",  label: "Adventure",        desc: "Active experiences and outdoor activities",                 img: "https://images.unsplash.com/photo-1533240332313-0db49b459ad6?w=600&h=320&fit=crop" },
  { id: "luxury",     label: "Luxury",           desc: "Premium stays and high-end, curated experiences",           img: "https://images.unsplash.com/photo-1551918120-9739cb430c6d?w=600&h=320&fit=crop" },
  { id: "local",      label: "Local Experience", desc: "Walking tours, museums, and hands-on culture classes",      img: "https://images.unsplash.com/photo-1747396108528-682b02327818?w=600&h=320&fit=crop" },
  { id: "foodie",     label: "Foodie",           desc: "Street food tours, cooking classes, and night markets",     img: "https://images.unsplash.com/photo-1777576506689-d28f3b4cb33a?w=600&h=320&fit=crop" },
  { id: "scenic",     label: "Scenic",           desc: "Countryside day trips, river cruises, and scenic viewpoints", img: "https://images.unsplash.com/photo-1626948688703-0136bc0a90da?w=600&h=320&fit=crop" },
] as const;

export type VibeId = (typeof VIBES)[number]["id"];

export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export type SeasonId = (typeof SEASONS)[number];

/** Season the API accepts, or null for anything else. */
export function normalizeSeason(value: string | null | undefined): SeasonId | null {
  const id = value?.trim().toLowerCase();
  return SEASONS.find((season) => season === id) ?? null;
}

/** Vibe ids from display labels or ids ("Local Experience" -> "local"), in VIBES order, deduped. */
export function vibeIdsFromLabels(values: readonly string[] | null | undefined): VibeId[] {
  if (!values?.length) return [];
  const ids = new Set<VibeId>();
  for (const value of values) {
    const key = value.trim().toLowerCase();
    const match = VIBES.find((vibe) => vibe.id === key || vibe.label.toLowerCase() === key);
    if (match) ids.add(match.id);
  }
  return VIBES.filter((vibe) => ids.has(vibe.id)).map((vibe) => vibe.id);
}

/** Display labels for a saved package's `vibes` column, in VIBES order. */
export function packageVibeLabels(pkg: { vibes?: readonly string[] | null }): string[] {
  const ids = vibeIdsFromLabels(pkg.vibes);
  return VIBES.filter((vibe) => ids.includes(vibe.id)).map((vibe) => vibe.label);
}
