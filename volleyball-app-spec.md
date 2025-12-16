# Volleyball Pickup Game Manager - MVP Specification

## Project Overview

Build a Progressive Web App (PWA) for managing pickup volleyball sessions. The app handles player check-in, automatic team assignment based on skill ratings, game result tracking, and a leaderboard system.

**Scope**: This is a proof-of-concept for testing with a small group (10-30 players). Manual game result entry is acceptable. Focus on core mechanics over polish.

**Target Users**: 
- **Admins**: Run sessions, enter results, manage players
- **Players**: Sign up, check in to sessions, view their stats and leaderboard

---

## Tech Stack

- **Frontend**: React with TypeScript
- **Styling**: Tailwind CSS
- **Backend/Database**: Supabase (PostgreSQL + Auth + API)
- **PWA**: Service worker for offline capability and home screen installation
- **Hosting**: Vercel or Netlify (free tier)

---

## Supabase Setup

### Initial Configuration
1. Create a Supabase project at supabase.com
2. Enable email/password authentication (can add Google OAuth later)
3. Create the database tables below
4. Set up Row Level Security (RLS) policies
5. Get the project URL and anon key for the frontend

### Database Schema

```sql
-- Players table (extends Supabase auth.users)
CREATE TABLE players (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rating INTEGER DEFAULT 1500,
  games_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  win_streak INTEGER DEFAULT 0,
  best_win_streak INTEGER DEFAULT 0,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_played_at TIMESTAMP WITH TIME ZONE
);

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'active', 'completed')),
  court_count INTEGER NOT NULL DEFAULT 2,
  created_by UUID REFERENCES players(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Session check-ins (which players are at which session)
CREATE TABLE session_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, player_id)
);

-- Games table
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  court_number INTEGER NOT NULL,
  score_a INTEGER,
  score_b INTEGER,
  winner TEXT CHECK (winner IN ('A', 'B')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Game participants (which players on which team)
CREATE TABLE game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  team TEXT NOT NULL CHECK (team IN ('A', 'B')),
  rating_before INTEGER NOT NULL,
  rating_after INTEGER,
  rating_change INTEGER,
  UNIQUE(game_id, player_id)
);

-- Rating history for charts/debugging
CREATE TABLE rating_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  previous_rating INTEGER NOT NULL,
  new_rating INTEGER NOT NULL,
  change INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Row Level Security Policies

```sql
-- Players: everyone can read, users can update their own name
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players are viewable by everyone" 
  ON players FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" 
  ON players FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "New users can insert their profile" 
  ON players FOR INSERT WITH CHECK (auth.uid() = id);

-- Sessions: everyone can read, only admins can create/update
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sessions are viewable by everyone" 
  ON sessions FOR SELECT USING (true);

CREATE POLICY "Admins can create sessions" 
  ON sessions FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update sessions" 
  ON sessions FOR UPDATE USING (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND is_admin = true)
  );

-- Session check-ins: everyone can read, authenticated users can check themselves in
ALTER TABLE session_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Check-ins are viewable by everyone" 
  ON session_checkins FOR SELECT USING (true);

CREATE POLICY "Users can check themselves in" 
  ON session_checkins FOR INSERT WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Users can remove their own check-in" 
  ON session_checkins FOR DELETE USING (auth.uid() = player_id);

-- Games: everyone can read, admins can create/update
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Games are viewable by everyone" 
  ON games FOR SELECT USING (true);

CREATE POLICY "Admins can manage games" 
  ON games FOR ALL USING (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND is_admin = true)
  );

-- Game players: everyone can read, admins can manage
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game players viewable by everyone" 
  ON game_players FOR SELECT USING (true);

CREATE POLICY "Admins can manage game players" 
  ON game_players FOR ALL USING (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND is_admin = true)
  );

-- Rating history: everyone can read their own, admins can see all
ALTER TABLE rating_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rating history" 
  ON rating_history FOR SELECT USING (
    auth.uid() = player_id OR 
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND is_admin = true)
  );
```

### Supabase Trigger for New User Signup

```sql
-- Automatically create a player profile when someone signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.players (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## Data Types (Frontend TypeScript)

```typescript
interface Player {
  id: string;
  name: string;
  rating: number;
  games_played: number;
  wins: number;
  losses: number;
  win_streak: number;
  best_win_streak: number;
  is_admin: boolean;
  created_at: string;
  last_played_at: string | null;
}

interface Session {
  id: string;
  date: string;
  status: 'setup' | 'active' | 'completed';
  court_count: number;
  created_by: string;
  created_at: string;
  completed_at: string | null;
}

interface SessionCheckin {
  id: string;
  session_id: string;
  player_id: string;
  checked_in_at: string;
  player?: Player; // Joined data
}

interface Game {
  id: string;
  session_id: string;
  court_number: number;
  score_a: number | null;
  score_b: number | null;
  winner: 'A' | 'B' | null;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  completed_at: string | null;
  team_a?: Player[]; // Joined data
  team_b?: Player[]; // Joined data
}

interface GamePlayer {
  id: string;
  game_id: string;
  player_id: string;
  team: 'A' | 'B';
  rating_before: number;
  rating_after: number | null;
  rating_change: number | null;
}
```

---

## Core Features

### 1. Authentication

**Sign Up**
- Email + password (Supabase handles this)
- On signup, user enters their display name
- Trigger auto-creates player profile with default 1500 rating

**Sign In**
- Email + password
- "Remember me" option
- Password reset flow (Supabase handles email)

**Session Persistence**
- Supabase client maintains auth state
- Auto-refresh tokens
- Redirect to login if session expires

---

### 2. Player Features (All Users)

**View Leaderboard**
- See all players ranked by rating
- Public, no login required to view

**View Own Profile**
- Personal stats: rating, W-L, win rate, streaks
- Rating history chart
- Recent games with results

**Check In to Sessions**
- View active session (if one exists in 'setup' status)
- One-tap check-in
- See who else is checked in
- Can un-check-in if plans change

**View Game Assignments**
- See which court and team you're on
- See teammates and opponents with their ratings

---

### 3. Admin Features

**Player Management**
- View all players
- Manually adjust ratings (for calibration)
- Grant/revoke admin status
- Add players manually (for people without accounts)

**Create Session**
- Set date (defaults to today)
- Set number of courts
- Session starts in 'setup' status

**Manage Check-ins**
- See all checked-in players
- Can check in players manually (for walk-ups)
- Can remove check-ins

**Generate Teams**
- Trigger team generation algorithm
- Review proposed teams with balance scores
- Manually swap players if needed
- Confirm and create games

**Record Results**
- Enter scores for each court
- Mark games complete
- System auto-calculates rating changes
- Option to void a game if needed

**Manage Session**
- Generate next round of games
- End session (status → completed)
- View session summary

---

### 4. Team Generation Algorithm

**Input**: List of checked-in players with ratings, number of courts, team size

**Algorithm (Serpentine Draft)**:
```typescript
function generateTeams(
  players: Player[],
  courtCount: number,
  teamSize: number = 6
): { courtNumber: number; teamA: Player[]; teamB: Player[] }[] {
  // Sort players by rating (highest first)
  const sorted = [...players].sort((a, b) => b.rating - a.rating);
  
  const totalNeeded = courtCount * teamSize * 2;
  const activePlayers = sorted.slice(0, totalNeeded);
  const subs = sorted.slice(totalNeeded);
  
  // Initialize courts
  const courts: { teamA: Player[]; teamB: Player[] }[] = [];
  for (let i = 0; i < courtCount; i++) {
    courts.push({ teamA: [], teamB: [] });
  }
  
  // Serpentine assignment
  let courtIndex = 0;
  let teamKey: 'teamA' | 'teamB' = 'teamA';
  let direction = 1;
  
  for (const player of activePlayers) {
    courts[courtIndex][teamKey].push(player);
    
    // Move to next team/court in serpentine pattern
    if (teamKey === 'teamA') {
      teamKey = 'teamB';
    } else {
      teamKey = 'teamA';
      courtIndex += direction;
      
      if (courtIndex >= courtCount || courtIndex < 0) {
        direction *= -1;
        courtIndex += direction;
      }
    }
  }
  
  return courts.map((court, i) => ({
    courtNumber: i + 1,
    teamA: court.teamA,
    teamB: court.teamB,
  }));
}
```

**Balance Score Calculation**:
```typescript
function calculateBalanceScore(
  teamA: Player[],
  teamB: Player[]
): { avgA: number; avgB: number; difference: number; fairnessPercent: number } {
  const avgA = teamA.reduce((sum, p) => sum + p.rating, 0) / teamA.length;
  const avgB = teamB.reduce((sum, p) => sum + p.rating, 0) / teamB.length;
  const difference = Math.abs(avgA - avgB);
  
  // 100% = perfectly balanced, decreases as difference grows
  const fairnessPercent = Math.max(0, 100 - (difference / 10));
  
  return { avgA, avgB, difference, fairnessPercent };
}
```

---

### 5. Rating System (ELO)

**Constants**:
```typescript
const K_FACTOR = 32;
const INITIAL_RATING = 1500;
```

**Calculation**:
```typescript
function calculateEloChange(
  teamAvgRating: number,
  opponentAvgRating: number,
  won: boolean
): number {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentAvgRating - teamAvgRating) / 400));
  const actualScore = won ? 1 : 0;
  return Math.round(K_FACTOR * (actualScore - expectedScore));
}

async function processGameResult(
  supabase: SupabaseClient,
  gameId: string,
  winner: 'A' | 'B'
) {
  // Fetch game with players
  const { data: gamePlayers } = await supabase
    .from('game_players')
    .select('*, player:players(*)')
    .eq('game_id', gameId);
  
  const teamA = gamePlayers.filter(gp => gp.team === 'A');
  const teamB = gamePlayers.filter(gp => gp.team === 'B');
  
  const avgA = teamA.reduce((sum, gp) => sum + gp.rating_before, 0) / teamA.length;
  const avgB = teamB.reduce((sum, gp) => sum + gp.rating_before, 0) / teamB.length;
  
  // Calculate and apply rating changes
  for (const gp of gamePlayers) {
    const isTeamA = gp.team === 'A';
    const won = (winner === 'A' && isTeamA) || (winner === 'B' && !isTeamA);
    const teamAvg = isTeamA ? avgA : avgB;
    const oppAvg = isTeamA ? avgB : avgA;
    
    const change = calculateEloChange(teamAvg, oppAvg, won);
    const newRating = gp.rating_before + change;
    
    // Update game_player record
    await supabase
      .from('game_players')
      .update({ rating_after: newRating, rating_change: change })
      .eq('id', gp.id);
    
    // Update player's current rating and stats
    const newWins = won ? gp.player.wins + 1 : gp.player.wins;
    const newLosses = won ? gp.player.losses : gp.player.losses + 1;
    const newStreak = won ? gp.player.win_streak + 1 : 0;
    const bestStreak = Math.max(newStreak, gp.player.best_win_streak);
    
    await supabase
      .from('players')
      .update({
        rating: newRating,
        games_played: gp.player.games_played + 1,
        wins: newWins,
        losses: newLosses,
        win_streak: newStreak,
        best_win_streak: bestStreak,
        last_played_at: new Date().toISOString(),
      })
      .eq('id', gp.player_id);
    
    // Record rating history
    await supabase.from('rating_history').insert({
      player_id: gp.player_id,
      game_id: gameId,
      previous_rating: gp.rating_before,
      new_rating: newRating,
      change: change,
    });
  }
}
```

---

### 6. Leaderboard

**Main Query**:
```typescript
const { data: leaderboard } = await supabase
  .from('players')
  .select('*')
  .order('rating', { ascending: false });
```

**Display Columns**:
- Rank (calculated from position)
- Name
- Rating
- Games Played
- Win % (wins / games_played * 100)
- Current Streak

---

## UI/UX Guidelines

**Navigation Structure**:
- Bottom tab bar (mobile) or sidebar (desktop)
- Tabs: Home, Leaderboard, Profile, Admin (if admin)

**Key Screens**:

1. **Home/Dashboard**
   - Current session status (if active)
   - Quick check-in button
   - Your upcoming/current game
   - Recent activity feed

2. **Leaderboard**
   - Full player rankings
   - Search/filter
   - Tap player to view profile

3. **Profile (Own)**
   - Stats overview
   - Rating chart over time
   - Game history

4. **Session View (Player)**
   - Check-in status
   - Current teams/courts
   - Game results as they complete

5. **Admin: Session Management**
   - Create session
   - Manage check-ins
   - Generate teams
   - Enter results

6. **Admin: Player Management**
   - Player list
   - Edit ratings
   - Manage admins

**Design Principles**:
- Mobile-first (most use will be on phones at the gym)
- Large tap targets
- High contrast for bright gym lighting
- Rating changes prominently displayed (+15 green, -8 red)
- Minimal clicks to common actions

---

## PWA Configuration

**manifest.json**:
```json
{
  "name": "Volleyball Pickup Manager",
  "short_name": "VB Pickup",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## Environment Variables

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## Recommended MCP Servers for Claude Code

These MCP servers will significantly improve the quality and efficiency of development. Set these up before starting the build.

### Magic MCP (21st.dev) — Modern UI Components

Magic MCP gives Claude access to a curated library of modern, beautiful UI components. Instead of generic-looking interfaces, you'll get contemporary designs with proper animations, hover states, and visual polish.

**Setup**:

1. Get an API key from https://21st.dev
2. Add to Claude Code:

```bash
claude mcp add-json "@21st-dev/magic" '{
  "command": "npx",
  "args": ["-y", "@21st-dev/magic@latest", "API_KEY=\"your-api-key-here\""]
}'
```

**Usage**: When asking Claude to build UI components, mention that it should use Magic MCP for modern styling. For example: "Create the leaderboard component using Magic MCP for a modern, polished look."

---

### Context7 — Up-to-Date Documentation

Context7 provides Claude with current documentation for libraries, preventing hallucinated or outdated API calls. Essential for React, Supabase, and Tailwind.

**Setup**:

```bash
claude mcp add-json "context7" '{
  "command": "npx",
  "args": ["-y", "@context7/mcp@latest"]
}'
```

**Usage**: When Claude needs to use a library API, ask it to "check Context7 for the current Supabase auth API" or similar. This ensures you get working code that matches current library versions.

---

### Supabase MCP (Optional) — Direct Database Access

Lets Claude query and inspect your Supabase database directly during development. Useful for debugging and verifying data.

**Setup**:

```bash
claude mcp add-json "supabase" '{
  "command": "npx",
  "args": ["-y", "@supabase/mcp@latest"],
  "env": {
    "SUPABASE_URL": "your-project-url",
    "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key"
  }
}'
```

**Note**: Use the service role key (not anon key) for full access. Only use this in development—don't commit keys to version control.

---

### Serena (Add Later) — Semantic Code Navigation

Serena provides IDE-like code navigation at the symbol level. Not useful when starting from scratch, but valuable once your codebase grows to 20+ files.

**Setup** (for later):

```bash
claude mcp add serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context claude-code --project "$(pwd)"
```

**When to add**: Once you have a working app and start doing refactoring or adding features that touch multiple files.

---

### Claude Code Skills (Built-in)

Claude Code has built-in "skills" that improve output quality. No setup required—just reference them in your prompts:

- **frontend-design**: Creates polished, production-grade interfaces. Say "use the frontend-design skill" when asking for UI work.
- **web-artifacts-builder**: Helps build more complex React components with proper structure.

---

### Verifying MCP Setup

After adding MCP servers, verify they're working:

```bash
claude mcp list
```

You should see all configured servers. If any show errors, check that:
- Node.js is installed (for npx-based servers)
- API keys are correct
- You've restarted Claude Code after adding servers

---

## Getting Started

1. Set up MCP servers (Magic MCP and Context7 at minimum)
2. Create Supabase project
2. Run SQL schema in Supabase SQL editor
3. Enable email auth in Supabase dashboard
4. Initialize React + TypeScript + Tailwind project
5. Install Supabase client: `npm install @supabase/supabase-js`
6. Set up auth context and protected routes
7. Build features incrementally:
   - Auth (signup/login/logout)
   - Leaderboard (read-only, good first feature)
   - Player profile
   - Session check-in
   - Admin: session creation
   - Admin: team generation
   - Admin: result entry
   - Rating calculations
8. Add PWA configuration
9. Deploy to Vercel

---

## Test Scenarios

1. **New user signup**: Creates account → player profile auto-created with 1500 rating
2. **Self check-in**: Player checks into active session → appears in check-in list
3. **Team generation**: 12 players checked in, 2 courts → balanced 6v6 teams generated
4. **Game result**: Enter scores → ratings update correctly for all 12 players
5. **Upset victory**: Lower-rated team wins → larger rating swings
6. **Admin permissions**: Non-admin cannot create sessions or enter results
7. **Leaderboard updates**: After game, leaderboard reflects new ratings immediately
