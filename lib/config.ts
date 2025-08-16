export const POINTS = {
  goal: 50,
  assist: 25,
  save: 25,
  shot: 15,
  score: 1, // RL scoreboard points
}

// Fantasy positions
export type RoleOnField = 'STRIKER' | 'MIDFIELD' | 'DEFENSE'

// Default 2×; can be overridden in .env / Vercel
export const POSITION_BONUS_MULTIPLIER = Number(process.env.FANTASY_POSITION_BONUS || 2)

// Salary cap
export const SALARY_CAP = Number(process.env.FANTASY_SALARY_CAP ?? 10_000_000)
export const INITIAL_BUDGET = SALARY_CAP

