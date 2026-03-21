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
import { useEffect } from 'react'
import { useQuery, gql } from '@apollo/client'
import { useAuthStore } from '../store/auth'
import { useCampaign } from '../context/campaign'
import { useDiceStore, type DiceSet } from '../store/dice'
import { version } from '../../package.json'
import { AccountCircle } from '@mui/icons-material'
import DiceFab from './DiceFab'

const MY_DICE_SETS = gql`
  query MyDiceSetsLayout { myDiceSets { id name colorset customBg customFg material surface texture } }
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
]

function DrawerContent({ onNavigate, hasAppBar }: { onNavigate?: () => void; hasAppBar?: boolean }) {
  const { user, logout } = useAuthStore()
  const { campaignName } = useCampaign()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <>
      {/* Spacer to clear the mobile AppBar */}
      {hasAppBar && <Toolbar sx={{ minHeight: '64px !important' }} />}
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
      <Box sx={{ p: 1.5, borderTop: '1px solid rgba(120,108,92,0.3)' }}>
        <Tooltip title="Profile">
          <IconButton onClick={() => { navigate('/profile'); onNavigate?.() }} size="small" sx={{ color: '#786c5c', '&:hover': { color: '#c8a44a' } }}>
            <AccountCircle fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Logout">
          <IconButton onClick={handleLogout} size="small" sx={{ color: '#786c5c', '&:hover': { color: '#b84848' } }}>
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography variant="caption" sx={{ color: '#786c5c', fontSize: '0.68rem', ml: 1 }}>
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
  const { campaignName } = useCampaign()

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
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#0b0906' }}>
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
        flex: 1, overflow: 'auto',
        p: { xs: 2, md: 3 },
        pt: { xs: '64px', md: 3 }, // account for mobile AppBar
      }}>
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
