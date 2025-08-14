```
.
├─ app/
│  ├─ layout.tsx
│  ├─ globals.css
│  ├─ page.tsx                      # Landing (IS)
│  ├─ how-to-play/page.tsx          # Leiðbeiningar + reglur
│  ├─ dashboard/page.tsx            # Liðið mitt (requires auth)
│  ├─ market/page.tsx               # Kaupa/Selja leikmenn
│  ├─ leaderboard/page.tsx          # Stigatafla
│  ├─ admin/
│  │  ├─ page.tsx                   # Admin heim
│  │  ├─ players/page.tsx           # Stjórna leikmönnum
│  │  ├─ weeks/page.tsx             # Stjórna vikum & læsingum
│  │  └─ ingest/page.tsx            # Hlaða inn tölfræði (CSV/JSON)
│  └─ api/
│     ├─ auth/[...nextauth]/route.ts
│     ├─ market/buy/route.ts
│     ├─ market/sell/route.ts
│     ├─ team/reorder/route.ts
│     ├─ admin/ingest/route.ts
│     └─ compute/rebuild-week/route.ts
├─ components/
│  ├─ nav.tsx
│  ├─ auth-button.tsx
│  ├─ team-editor.tsx
│  ├─ lineup-card.tsx
│  ├─ player-card.tsx
│  ├─ leaderboard-table.tsx
│  └─ forms/
│     └─ select.tsx
├─ lib/
│  ├─ auth.ts
│  ├─ prisma.ts
│  ├─ config.ts
│  ├─ scoring.ts
│  ├─ substitutions.ts
│  ├─ fantasy.ts
│  └─ utils.ts
├─ prisma/
│  ├─ schema.prisma
│  └─ seed.ts
├─ public/
│  └─ logo.svg
├─ middleware.ts
├─ next.config.ts
├─ package.json
├─ tsconfig.json
├─ vercel.json
└─ README.md
```


README (ops notes)

Database: Azure SQL (MSSQL) tested with Prisma provider sqlserver. Ensure your firewall allows Vercel’s egress IPs or use Azure Private Link.

Auth: Add Discord app (redirect URI → https://<your-domain>/api/auth/callback/discord). Email requires a real SMTP.

Market lock: Flip Week.isLocked and set firstBroadcastAt/unlockedAt. You can add a tiny check on market routes to ensure now < firstBroadcastAt - 60m or now > unlockedAt.

One transfer per week: Track in a new model Transfer with unique constraint @@unique([teamId, weekId]).

Admin: Gate pages with session.user.role === 'ADMIN'.

Security: Enforce server actions on the server only, validate inputs with zod.

Pricing: Prices (Player.price) are admin‑controlled and can be adjusted weekly.

Icelandic copy: The app ships with Icelandic labels; adjust in app/ as needed.