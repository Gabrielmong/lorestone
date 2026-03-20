# The Companion — TTRPG Campaign Manager

A full-stack web app for Dungeon Masters to manage long-running tabletop RPG campaigns. Built as a personal DM tool with a dark fantasy aesthetic.

## What it does

**Characters** — Track every NPC, player, monster, and ally. HP, armor class, speed, stats, conditions, corruption, narrative notes, and mini printing status.

**Decision Trees** — Map branching player choices as an interactive visual graph. Link decisions across chapters, mark chosen paths, attach encounters, and trace consequences through the whole campaign.

**Sessions** — Log each session with DM notes, player-facing summaries, and a timeline of events (decisions made, items found, reputation changes).

**Encounters** — Run combat with initiative order, per-participant HP tracking, conditions, and kill tracking. Link encounters to decisions for narrative context.

**Factions** — Track player reputation with each faction on a configurable scale. Log reputation changes through session events.

**Items** — Catalogue weapons, artifacts, and key items. Track who holds them, where they were found, and what they unlock.

**Chapters & Missions** — Organise the campaign into chapters and missions. Mark chapters as player-visible to control what the player view reveals.

**Player View** — A read-only shareable link players can open to see resolved decisions, session summaries, faction standings, and characters they've met — without spoilers.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + TypeScript, Vite, MUI, ReactFlow, Framer Motion, Apollo Client |
| Backend | Node.js, Apollo Server (GraphQL), Prisma ORM |
| Database | PostgreSQL |

## Project structure

```
dndcompanion/
├── frontend/        # React SPA
│   └── src/
│       ├── pages/       # Route-level pages
│       ├── components/  # Shared UI components
│       ├── store/       # Zustand auth store
│       ├── context/     # Campaign context
│       └── utils/       # Motion variants, layout helpers
└── backend/         # Apollo GraphQL server
    ├── src/
    │   └── schema/      # GraphQL typeDefs + resolvers
    └── prisma/          # Schema + migrations
```

## Running locally

**Backend**
```bash
cd backend
cp .env.example .env   # set DATABASE_URL
npm install
npx prisma migrate deploy
npm run dev
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```
