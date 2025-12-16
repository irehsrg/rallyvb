# Supabase Setup Guide

Complete step-by-step guide to set up your Supabase backend for the Volleyball Pickup Manager.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign in or create an account
3. Click "New Project"
4. Fill in:
   - **Name**: volleyball-pickup (or your choice)
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose closest to your users
5. Click "Create new project"
6. Wait 2-3 minutes for setup to complete

## 2. Get Your API Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")
3. Add them to your `.env` file in the project root:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## 3. Create Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy and paste the following SQL (in order):

### Step 1: Create Tables

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

4. Click **Run** or press `Ctrl+Enter`

### Step 2: Enable Row Level Security (RLS)

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

4. Click **Run** again

### Step 3: Create Auto-Signup Trigger

This automatically creates a player profile when someone signs up:

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

4. Click **Run** one more time

## 4. Enable Email Authentication

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Make sure **Email** is enabled (it should be by default)
3. Optional: Configure email templates under **Authentication** → **Email Templates**

## 5. Test the Setup

1. Start your development server: `npm run dev`
2. Open `http://localhost:5173`
3. Click "Sign Up" and create a test account
4. Go back to Supabase → **Table Editor** → **players**
5. You should see your new player profile with rating 1500

## 6. Create Your First Admin

1. In Supabase → **Table Editor** → **players**
2. Find your user row
3. Click on the row to edit
4. Change `is_admin` from `false` to `true`
5. Click **Save**
6. Refresh your app - you should now see the "Admin" tab!

## 7. Optional: Configure Email Settings

For production, you'll want to set up a custom SMTP server:

1. Go to **Settings** → **Auth**
2. Scroll to **SMTP Settings**
3. Add your email provider details (SendGrid, Mailgun, etc.)

## Troubleshooting

### "Missing Supabase environment variables" Error
- Make sure you created a `.env` file (not `.env.example`)
- Check that your URL and key are correct
- Restart your dev server after changing `.env`

### Can't Sign Up / Sign In
- Check the browser console for errors
- Verify email auth is enabled in Supabase dashboard
- Make sure the `handle_new_user()` trigger was created successfully

### Players Table is Empty After Signup
- The trigger might not have been created correctly
- Re-run the Step 3 SQL in the SQL Editor
- Try signing up with a new email

### Admin Features Not Showing
- Make sure you set `is_admin = true` for your user in the players table
- Refresh the app after changing the database
- Check browser console for auth errors

## Next Steps

Once setup is complete:
1. Create a session as admin
2. Check in some players
3. Generate teams
4. Record game results
5. Watch the ratings update!

Need help? Check the [main README](./README.md) or open an issue on GitHub.
