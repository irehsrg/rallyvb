# Volleyball Pickup Manager

A Progressive Web App (PWA) for managing volleyball pickup sessions with automatic team generation, ELO-based ratings, and comprehensive player statistics.

## Features

### Player Features
- 🏐 Check in to active sessions
- 📊 View personal stats and rating history
- 🏆 Browse leaderboard with player rankings
- 📱 Mobile-first responsive design
- 💾 Offline-capable PWA

### Admin Features
- 🎯 Create and manage sessions
- 👥 Generate balanced teams using serpentine draft algorithm
- ⚡ Record game results with automatic ELO rating calculations
- 📈 Track player statistics and performance
- ⚙️ Manage player profiles and admin permissions

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Routing**: React Router DOM
- **PWA**: vite-plugin-pwa with Workbox

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase account (free tier works fine)

### 1. Clone and Install

```bash
npm install
```

### 2. Set Up Supabase

Follow the detailed instructions in [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) to:
- Create a Supabase project
- Run the database schema
- Set up authentication
- Configure Row Level Security (RLS)

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 5. Create Your First Admin User

1. Sign up through the app
2. Go to your Supabase dashboard → Table Editor → players
3. Find your user and set `is_admin` to `true`

## Building for Production

```bash
npm run build
npm run preview
```

## Deployment

The app can be deployed to:
- **Vercel** (recommended)
- **Netlify**
- Any static hosting service

### Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Make sure to add your environment variables in the Vercel dashboard.

## How It Works

### Team Generation Algorithm

Uses a serpentine draft pattern to create balanced teams:
1. Sort players by rating (highest to lowest)
2. Distribute players across courts in a snake pattern
3. Calculate balance scores to ensure fair matchups

### ELO Rating System

- **Starting Rating**: 1500
- **K-Factor**: 32
- Ratings update after each game based on:
  - Team average rating vs opponent team average
  - Expected win probability
  - Actual game outcome

### PWA Features

- Install to home screen on mobile devices
- Offline access to core features
- Fast loading with service worker caching
- Auto-updates when new version is deployed

## Project Structure

```
src/
├── components/      # Reusable UI components
│   └── Layout.tsx  # Main layout with navigation
├── contexts/       # React contexts
│   └── AuthContext.tsx
├── hooks/          # Custom React hooks
├── lib/            # Third-party configurations
│   └── supabase.ts
├── pages/          # Page components
│   ├── Home.tsx
│   ├── Login.tsx
│   ├── Signup.tsx
│   ├── Leaderboard.tsx
│   ├── Profile.tsx
│   └── Admin.tsx
├── types/          # TypeScript type definitions
│   └── index.ts
├── utils/          # Utility functions
│   ├── elo.ts     # ELO rating calculations
│   └── teams.ts   # Team generation algorithm
├── App.tsx         # Main app component with routing
├── main.tsx        # Entry point
└── index.css       # Global styles + Tailwind
```

## Database Schema

See [volleyball-app-spec.md](./volleyball-app-spec.md) for the complete database schema and detailed specifications.

## Contributing

This is a proof-of-concept for a small group. Feel free to fork and adapt for your own use!

## License

MIT
