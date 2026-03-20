import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ApolloProvider } from '@apollo/client'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { client } from './apollo'
import theme from './theme'
import { CampaignProvider } from './context/campaign'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

import Login from './pages/Login'
import Register from './pages/Register'
import CampaignsList from './pages/CampaignsList'
import Dashboard from './pages/Dashboard'
import Characters from './pages/Characters'
import CharacterDetail from './pages/CharacterDetail'
import Decisions from './pages/Decisions'
import Items from './pages/Items'
import Factions from './pages/Factions'
import SessionActive from './pages/SessionActive'
import PlayerView from './pages/PlayerView'
import Encounters from './pages/Encounters'
import EncounterActive from './pages/EncounterActive'
import Players from './pages/Players'
import Profile from './pages/Profile'
import Landing from './pages/Landing'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <CampaignProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/play/:shareToken" element={<PlayerView />} />

              {/* Protected DM routes */}
              <Route element={<ProtectedRoute />}>
                {/* Campaign selection — no sidebar */}
                <Route path="/" element={<CampaignsList />} />
                <Route path="/profile" element={<Profile />} />

                {/* Campaign workspace — with sidebar */}
                <Route element={<Layout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/characters" element={<Characters />} />
                  <Route path="/characters/:id" element={<CharacterDetail />} />
                  <Route path="/decisions" element={<Decisions />} />
                  <Route path="/items" element={<Items />} />
                  <Route path="/factions" element={<Factions />} />
                  <Route path="/session/:id" element={<SessionActive />} />
                  <Route path="/encounters" element={<Encounters />} />
                  <Route path="/encounter/:id" element={<EncounterActive />} />
                  <Route path="/players" element={<Players />} />
                </Route>
              </Route>

              {/* Public landing */}
              <Route path="/landing" element={<Landing />} />

              <Route path="*" element={<Navigate to="/landing" replace />} />
            </Routes>
          </BrowserRouter>
        </CampaignProvider>
      </ThemeProvider>
    </ApolloProvider>
  </React.StrictMode>
)
