import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';

// Pages — Pubbliche
import Homepage from './pages/Homepage';
import Login from './pages/Login';
import NotFound from './pages/NotFound';

// Pages — Protette (post-login)
import CharacterCreation from './pages/CharacterCreation';
import Onboarding from './pages/Onboarding';
import Lobby from './pages/Lobby';
import DeckBuilder from './pages/DeckBuilder';
import Collection from './pages/Collection';
import Shop from './pages/Shop';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';

// Game
import GameBoard from './game/GameBoard';

export default function App() {
  return (
    <Routes>
      {/* ── Rotte Pubbliche ──────────────────────── */}
      <Route path="/" element={<Homepage />} />
      <Route path="/login" element={<Login />} />

      {/* ── Rotte Protette ───────────────────────── */}
      <Route
        path="/character-creation"
        element={
          <ProtectedRoute>
            <CharacterCreation />
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lobby"
        element={
          <ProtectedRoute>
            <Lobby />
          </ProtectedRoute>
        }
      />
      <Route
        path="/play"
        element={
          <ProtectedRoute>
            <GameBoard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/collection"
        element={
          <ProtectedRoute>
            <Collection />
          </ProtectedRoute>
        }
      />
      <Route
        path="/deck-builder"
        element={
          <ProtectedRoute>
            <DeckBuilder />
          </ProtectedRoute>
        }
      />
      <Route
        path="/shop"
        element={
          <ProtectedRoute>
            <Shop />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leaderboard"
        element={
          <ProtectedRoute>
            <Leaderboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />

      {/* ── 404 ──────────────────────────────────── */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
