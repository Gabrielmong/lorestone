import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { pageVariants } from '../utils/motion'
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  IconButton,
  Tooltip,
  useMediaQuery,
  useTheme,
  AppBar,
  Toolbar,
} from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import PeopleIcon from '@mui/icons-material/People'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import GroupsIcon from '@mui/icons-material/Groups'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import LogoutIcon from '@mui/icons-material/Logout'
import CasinoIcon from '@mui/icons-material/Casino'
import MenuIcon from '@mui/icons-material/Menu'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import LayersIcon from '@mui/icons-material/Layers'
import MapIcon from '@mui/icons-material/Map'
import HistoryIcon from '@mui/icons-material/History'
import BarChartIcon from '@mui/icons-material/BarChart'
import { useEffect } from 'react'
import { useQuery, gql } from '@apollo/client'
import { useAuthStore } from '../store/auth'
import { useCampaign } from '../context/campaign'
import { useDiceStore, type DiceSet } from '../store/dice'
import { version } from '../../package.json'
import { AccountCircle } from '@mui/icons-material'
import DiceFab from './DiceFab'
import SessionBar from './SessionBar'
import { useRecordingStore } from '../store/recording'

const MY_DICE_SETS = gql`
  query MyDiceSetsLayout { myDiceSets { id name colorset customBg customFg material surface texture } }
`

const ACTIVE_SESSION = gql`
  query ActiveSessionMeta($campaignId: ID!) {
    campaign(id: $campaignId) {
      currentSession { id sessionNumber title status }
    }
  }
`

const SESSION_START_TIME = gql`
  query SessionStartTime($id: ID!) {
    session(id: $id) { id startedAt }
  }
`

const ME_AVATAR = gql`
  query MeAvatar { me { id avatarUrl } }
`

const DRAWER_WIDTH = 220

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: <DashboardIcon fontSize="small" /> },
  { to: '/chapters', label: 'Chapters', icon: <LayersIcon fontSize="small" /> },
  { to: '/characters', label: 'Characters', icon: <PeopleIcon fontSize="small" /> },
  { to: '/decisions', label: 'Decisions', icon: <AccountTreeIcon fontSize="small" /> },
  { to: '/encounters', label: 'Encounters', icon: <LocalFireDepartmentIcon fontSize="small" /> },
  { to: '/factions', label: 'Factions', icon: <GroupsIcon fontSize="small" /> },
  { to: '/items', label: 'Items', icon: <AutoAwesomeIcon fontSize="small" /> },
  { to: '/missions', label: 'Missions', icon: <MapIcon fontSize="small" /> },
  { to: '/players', label: 'Players', icon: <CasinoIcon fontSize="small" /> },
  { to: '/sessions', label: 'Sessions', icon: <HistoryIcon fontSize="small" /> },
  { to: '/wiki', label: 'Wiki', icon: <MenuBookIcon fontSize="small" /> },
  { to: '/analytics', label: 'Analytics', icon: <BarChartIcon fontSize="small" /> },
]

function DrawerContent({ onNavigate, hasAppBar }: { onNavigate?: () => void; hasAppBar?: boolean }) {
  const { user, logout } = useAuthStore()
  const { campaignName } = useCampaign()
  const navigate = useNavigate()
  const { data: meData } = useQuery(ME_AVATAR, { fetchPolicy: 'cache-first' })
  const avatarUrl: string | null = meData?.me?.avatarUrl ?? null

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <>
      {/* Spacer to clear the mobile AppBar */}
      {hasAppBar && <Toolbar sx={{ minHeight: '52px !important' }} />}
      {/* Logo + Campaign Name */}
      <Box sx={{ p: 2, borderBottom: '1px solid rgba(120,108,92,0.3)' }}>
        <Box
          onClick={() => { navigate('/'); onNavigate?.() }}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer', mb: 1, '&:hover span': { color: '#c8a44a' } }}
        >
          <ArrowBackIcon sx={{ fontSize: 14, color: '#786c5c' }} />
          <Typography component="span" sx={{ fontSize: '0.72rem', color: '#786c5c', transition: 'color 0.15s' }}>
            Campaigns
          </Typography>
        </Box>
        <Typography variant="h6" sx={{ fontFamily: '"Cinzel", serif', color: '#c8a44a', lineHeight: 1.2, fontSize: '0.95rem' }}>
          {campaignName ?? 'The Companion'}
        </Typography>
        {user && (
          <Typography variant="caption" sx={{ color: '#786c5c', fontSize: '0.68rem' }}>
            DM: {user.name}
          </Typography>
        )}
      </Box>

      {/* Nav */}
      <List sx={{ flex: 1, px: 1, py: 1 }}>
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} style={{ textDecoration: 'none' }} onClick={onNavigate}>
            {({ isActive }) => (
              <ListItemButton
                selected={isActive}
                sx={{
                  borderRadius: 1, mb: 0.5,
                  pl: isActive ? 1.5 : 2,
                  borderLeft: isActive ? '3px solid #c8a44a' : '3px solid transparent',
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: isActive ? '#c8a44a' : '#786c5c' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: '0.9rem', fontFamily: '"Cinzel", serif', color: isActive ? '#c8a44a' : '#b4a48a' }}
                />
              </ListItemButton>
            )}
          </NavLink>
        ))}
      </List>

      {/* Bottom */}
      <Box sx={{ p: 1.5, borderTop: '1px solid rgba(120,108,92,0.3)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Tooltip title="Profile">
          <IconButton onClick={() => { navigate('/profile'); onNavigate?.() }} size="small"
            sx={{ p: 0.25, '&:hover': { bgcolor: 'transparent' } }}>
            {avatarUrl ? (
              <Box component="img" src={avatarUrl} alt=""
                sx={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(200,164,74,0.35)', display: 'block' }} />
            ) : (
              <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: '#1a160f', border: '1px solid rgba(120,108,92,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AccountCircle sx={{ fontSize: 18, color: '#786c5c' }} />
              </Box>
            )}
          </IconButton>
        </Tooltip>
        <Tooltip title="Logout">
          <IconButton onClick={handleLogout} size="small" sx={{ color: '#786c5c', '&:hover': { color: '#b84848' } }}>
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography variant="caption" sx={{ color: '#786c5c', fontSize: '0.68rem', ml: 0.5 }}>
          v{version}
        </Typography>
      </Box>
    </>
  )
}

export default function Layout() {
  const location = useLocation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const { campaignName, campaignId } = useCampaign()

  const {
    activeSessionId, startedAt, paused, pausedOffset,
    setElapsed, setActiveSession: setRecordingSession, clearActiveSession: clearRecordingSession,
  } = useRecordingStore()

  // Rehydrate bar on any page load — reads from Apollo cache immediately (same tab)
  // or falls back to network (new tab). Matches exact fields Dashboard fetches so
  // cache-and-network can serve it instantly when Dashboard has already run.
  const { data: activeSessionData } = useQuery(ACTIVE_SESSION, {
    variables: { campaignId },
    skip: !campaignId,
    fetchPolicy: 'cache-and-network',
  })
  const activeFromQuery = activeSessionData?.campaign?.currentSession
  useEffect(() => {
    if (!activeFromQuery || activeFromQuery.status?.toUpperCase() !== 'ACTIVE') {
      if (activeSessionId) clearRecordingSession()
      return
    }
    if (activeSessionId === activeFromQuery.id) return // already registered
    setRecordingSession({
      id: activeFromQuery.id,
      sessionNumber: activeFromQuery.sessionNumber ?? null,
      sessionName: activeFromQuery.title ?? null,
      startedAt: null, // populated separately below
      campaignCharacters: [],
      dmName: '',
      initialSegments: [],
    })
  }, [activeFromQuery?.id, activeFromQuery?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // Once we have the session ID, fetch startedAt so the timer ticks correctly
  const { data: startTimeData } = useQuery(SESSION_START_TIME, {
    variables: { id: activeSessionId },
    skip: !activeSessionId || !!startedAt, // skip if already have startedAt
    fetchPolicy: 'network-only',
  })
  useEffect(() => {
    if (!startTimeData?.session?.startedAt) return
    // Patch startedAt into the store without resetting everything else
    useRecordingStore.setState({ startedAt: startTimeData.session.startedAt })
  }, [startTimeData?.session?.startedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  // Timer ticker — persists across navigation so elapsed stays live in SessionBar
  useEffect(() => {
    if (!activeSessionId || !startedAt || paused) return
    const startedMs = new Date(startedAt).getTime()
    const tick = () => setElapsed(Date.now() - startedMs - pausedOffset)
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [activeSessionId, startedAt, paused, pausedOffset]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch custom dice sets on mount so they're available before opening settings
  const { data: remoteSetsData } = useQuery(MY_DICE_SETS, { fetchPolicy: 'cache-first' })
  useEffect(() => {
    if (!remoteSetsData?.myDiceSets) return
    const remote: DiceSet[] = remoteSetsData.myDiceSets.map((s: DiceSet) => ({ ...s, isPreset: false }))
    const store = useDiceStore.getState()
    remote.forEach((s) => {
      if (store.customSets.find((c) => c.id === s.id)) store.updateCustomSet(s)
      else store.addCustomSet(s)
    })
    store.customSets
      .filter((c) => !remote.find((r) => r.id === c.id))
      .forEach((c) => store.deleteCustomSet(c.id))
  }, [remoteSetsData])

  return (
    <Box sx={{ display: 'flex', minHeight: '100svh', bgcolor: '#0b0906' }}>
      {/* Mobile top bar */}
      {isMobile && (
        <AppBar position="fixed" sx={{
          bgcolor: '#111009', borderBottom: '1px solid rgba(120,108,92,0.3)',
          boxShadow: 'none', zIndex: theme.zIndex.drawer + 1,
        }}>
          <Toolbar sx={{ minHeight: 52, px: 1.5 }}>
            <IconButton onClick={() => setMobileOpen(true)} sx={{ color: '#786c5c', mr: 1 }}>
              <MenuIcon />
            </IconButton>
            <Typography sx={{ fontFamily: '"Cinzel", serif', color: '#c8a44a', fontSize: '0.9rem', flex: 1 }}>
              {campaignName ?? 'The Companion'}
            </Typography>
          </Toolbar>
        </AppBar>
      )}

      {/* Desktop permanent drawer */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH, flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH, boxSizing: 'border-box',
              bgcolor: '#111009', borderRight: '1px solid rgba(120,108,92,0.3)',
              display: 'flex', flexDirection: 'column',
            },
          }}
        >
          <DrawerContent />
        </Drawer>
      )}

      {/* Mobile temporary drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH, boxSizing: 'border-box',
              bgcolor: '#111009', borderRight: '1px solid rgba(120,108,92,0.3)',
              display: 'flex', flexDirection: 'column',
            },
          }}
        >
          <DrawerContent onNavigate={() => setMobileOpen(false)} hasAppBar />
        </Drawer>
      )}

      {/* Draggable dice FAB */}
      <DiceFab />

      {/* Main content */}
      <Box component="main" sx={{
        display: 'flex', 
        flexDirection: 'column',
        flex: 1, overflow: 'auto',
        p: { xs: 2, md: 3 },
        pt: { xs: '52px', md: 3 }, // account for mobile AppBar
        gap: 2, 
      }}>
        <SessionBar />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            variants={pageVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{ height: '100%' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </Box>
    </Box>
  )
}
