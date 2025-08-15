// lib/assets.ts
export function slugifyName(name: string) {
  return name
    .normalize('NFD')                // brýtur broddstafi
    .replace(/\p{Diacritic}/gu, '')  // hendir broddum
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')     // óleyfileg tákn -> -
    .replace(/^-+|-+$/g, '');        // snyrta brúnir
}

export function teamLogoPath(teamName?: string | null) {
  if (!teamName) return null
  return `/teams/${slugifyName(teamName)}.png`
}
