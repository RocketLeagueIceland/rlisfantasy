export const POINTS = {
  goal: 50, // Mark
  assist: 35, // Stoðsending
  save: 25, // Varsla
  shot: 15, // Skot
  demo: 15, // Sprengja
}

export const ROLE_BONUS = {
  SHOOTER: { goal: 2 }, // double goals
  CREATOR: { assist: 2 }, // double assists
  WALL: { save: 2 }, // double saves
} as const

export const INITIAL_BUDGET = Number(process.env.FANTASY_INITIAL_BUDGET || 100)