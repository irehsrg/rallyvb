# Quick Start Guide

Get your Volleyball Pickup Manager running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier is fine)

## Step 1: Set Up Supabase (5 minutes)

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Copy your project URL and anon key from Settings → API
3. In the SQL Editor, run all the SQL from `SUPABASE_SETUP.md` (3 code blocks)

## Step 2: Configure the App (1 minute)

1. Create a `.env` file in the project root:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://yourproject.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

## Step 3: Install Dependencies (2 minutes)

```bash
npm install
```

## Step 4: Start the Dev Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser!

## Step 5: Create Your Admin Account

1. Click "Sign Up" and create an account
2. Go to your Supabase dashboard → Table Editor → `players` table
3. Find your row and set `is_admin` to `true`
4. Refresh the app - you'll now see the Admin tab!

## Next Steps

### Create Your First Session

1. Go to the Admin tab
2. Click "Create Session"
3. Set number of courts (default is 2)

### Get Players to Check In

- Share the app URL with players
- They can sign up and check in to the active session

### Generate Teams

1. Wait for at least 4 players to check in
2. Click "Generate Teams" in the Admin dashboard
3. Teams will be automatically balanced by rating

### Record Game Results

1. Enter scores for each court
2. Click "Record Result"
3. Ratings will automatically update using the ELO system!

## Troubleshooting

### "Missing Supabase environment variables"
- Check that your `.env` file exists and has the correct values
- Restart the dev server after creating/editing `.env`

### Can't see Admin features
- Make sure `is_admin = true` for your user in Supabase
- Try signing out and back in

### Build errors
- Run `npm install` again
- Delete `node_modules` and `package-lock.json`, then run `npm install`

## Production Deployment

### Deploy to Vercel (Recommended)

1. Install Vercel CLI: `npm install -g vercel`
2. Run: `vercel`
3. Add environment variables in Vercel dashboard
4. Done! Your app is live

### Deploy to Netlify

1. Build the app: `npm run build`
2. Drag the `dist` folder to [Netlify Drop](https://app.netlify.com/drop)
3. Add environment variables in Netlify dashboard

## Features Overview

### For Players
- ✅ Sign up and create profile
- ✅ Check in to sessions
- ✅ View personal stats and rating
- ✅ Browse leaderboard
- ✅ Track win/loss record and streaks

### For Admins
- ✅ Create and manage sessions
- ✅ Generate balanced teams automatically
- ✅ Record game results
- ✅ View all player stats
- ✅ Manage player permissions

## App Icons

The app uses placeholder SVG icons. To create proper PWA icons:

1. Convert `public/volleyball-icon.svg` to PNG at:
   - 192x192 pixels → save as `public/icon-192.png`
   - 512x512 pixels → save as `public/icon-512.png`

2. Use an online converter like [CloudConvert](https://cloudconvert.com/svg-to-png)

## Need More Help?

- 📖 Full setup guide: `SUPABASE_SETUP.md`
- 📘 Complete documentation: `README.md`
- 📋 Detailed spec: `volleyball-app-spec.md`

---

**Ready to play volleyball!** 🏐
