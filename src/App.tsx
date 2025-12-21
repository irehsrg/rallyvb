import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import SessionHistory from './pages/SessionHistory';
import GuestCheckin from './pages/GuestCheckin';
import Teams from './pages/Teams';
import TeamProfile from './pages/TeamProfile';
import Tournaments from './pages/Tournaments';
import TournamentView from './pages/TournamentView';
import PlayerProfile from './pages/PlayerProfile';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/signup" element={user ? <Navigate to="/" /> : <Signup />} />
      <Route path="/guest-checkin/:sessionId" element={<GuestCheckin />} />

      <Route
        path="/"
        element={
          <Layout>
            <Home />
          </Layout>
        }
      />

      <Route
        path="/leaderboard"
        element={
          <Layout>
            <Leaderboard />
          </Layout>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout>
              <Profile />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <Layout>
              <Admin />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/history"
        element={
          <Layout>
            <SessionHistory />
          </Layout>
        }
      />

      <Route
        path="/teams"
        element={
          <Layout>
            <Teams />
          </Layout>
        }
      />

      <Route
        path="/teams/:teamId"
        element={
          <Layout>
            <TeamProfile />
          </Layout>
        }
      />

      <Route
        path="/tournaments"
        element={
          <Layout>
            <Tournaments />
          </Layout>
        }
      />

      <Route
        path="/tournaments/:tournamentId"
        element={
          <Layout>
            <TournamentView />
          </Layout>
        }
      />

      <Route
        path="/player/:playerId"
        element={
          <Layout>
            <PlayerProfile />
          </Layout>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
