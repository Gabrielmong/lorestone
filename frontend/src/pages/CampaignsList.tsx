import { useState } from 'react'
import { useQuery, useMutation, gql } from '@apollo/client'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { slideUp, staggerContainer, fadeIn } from '../utils/motion'
import {
  Box, Typography, Grid, Card, CardContent, CardActionArea,
  Button, CircularProgress, Alert, Chip, IconButton, Tooltip,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import LogoutIcon from '@mui/icons-material/Logout'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import { useAuthStore } from '../store/auth'
import { useCampaign } from '../context/campaign'
import CampaignFormDialog from '../components/CampaignFormDialog'
import ConfirmDeleteDialog from '../components/ConfirmDeleteDialog'

const MY_CAMPAIGNS = gql`
  query MyCampaigns {
    me {
      id name avatarUrl
      campaigns {
        id name system yearInGame playerCount description
        activeChapter { name }
        createdAt
      }
    }
  }
`

const DELETE_CAMPAIGN = gql`
  mutation DeleteCampaign($id: ID!) {
    deleteCampaign(id: $id)
  }
`

export default function CampaignsList() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { setCampaignId, setCampaignName } = useCampaign()
  const [formOpen, setFormOpen] = useState(false)
  const [editCampaign, setEditCampaign] = useState<null | { id: string; name: string; system?: string | null; description?: string | null; yearInGame?: string | null; playerCount?: number | null }>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteName, setDeleteName] = useState('')

  const { data, loading, error, refetch } = useQuery(MY_CAMPAIGNS)
  const [deleteCampaign, { loading: deleting }] = useMutation(DELETE_CAMPAIGN)

  const handleOpen = (id: string, name: string) => {
    setCampaignId(id)
    setCampaignName(name)
    navigate('/dashboard')
  }

  const handleSaved = (newId?: string) => {
    refetch()
    if (newId) {
      setCampaignId(newId)
      navigate('/dashboard')
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await deleteCampaign({ variables: { id: deleteId } })
    setDeleteId(null)
    refetch()
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const campaigns = data?.me?.campaigns ?? []

  return (
    <Box
      component={motion.div}
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      sx={{ minHeight: '100svh', bgcolor: '#0b0906', p: { xs: 2, sm: 4 } }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 5, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography variant="h3" sx={{ fontFamily: '"Cinzel", serif', color: '#c8a44a', mb: 0.5, fontSize: { xs: '1.8rem', sm: '3rem' } }}>
            The Companion
          </Typography>
          {user && (
            <Typography sx={{ color: '#786c5c', fontSize: '0.9rem' }}>
              Welcome back, {user.name}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => { setEditCampaign(null); setFormOpen(true) }}
            size="small"
          >
            New Campaign
          </Button>
          <Tooltip title="Profile">
            <IconButton onClick={() => navigate('/profile')} size="small"
              sx={{ p: 0.25, border: '1px solid rgba(120,108,92,0.3)', borderRadius: 1, '&:hover': { borderColor: 'rgba(200,164,74,0.4)' } }}>
              {data?.me?.avatarUrl ? (
                <Box component="img" src={data.me.avatarUrl} alt=""
                  sx={{ width: 26, height: 26, borderRadius: 0.5, objectFit: 'cover', display: 'block' }} />
              ) : (
                <AccountCircleIcon fontSize="small" sx={{ color: '#786c5c', m: 0.25 }} />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip title="Logout">
            <IconButton onClick={handleLogout} size="small" sx={{ color: '#786c5c', border: '1px solid rgba(120,108,92,0.3)', borderRadius: 1 }}>
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
          <CircularProgress sx={{ color: '#c8a44a' }} />
        </Box>
      )}
      {error && <Alert severity="error">{error.message}</Alert>}

      {!loading && campaigns.length === 0 && (
        <Box sx={{ textAlign: 'center', pt: 8 }}>
          <Typography sx={{ color: '#786c5c', mb: 2 }}>No campaigns yet.</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditCampaign(null); setFormOpen(true) }}>
            Create your first campaign
          </Button>
        </Box>
      )}

      <Grid container spacing={{ xs: 1.5, sm: 2 }} component={motion.div} variants={staggerContainer} initial="hidden" animate="visible">
        {campaigns.map((c: { id: string; name: string; system?: string | null; yearInGame?: string | null; playerCount?: number | null; description?: string | null; activeChapter?: { name: string } | null }) => (
          <Grid item xs={12} sm={6} md={4} key={c.id} component={motion.div} variants={slideUp}>
            <Card sx={{ position: 'relative', border: '1px solid rgba(120,108,92,0.3)', '&:hover': { border: '1px solid rgba(200,164,74,0.4)' } }}>
              {/* Action buttons overlay */}
              <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 0.5, zIndex: 1 }}>
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); setEditCampaign(c); setFormOpen(true) }}
                  sx={{ color: '#786c5c', bgcolor: '#111009', '&:hover': { color: '#c8a44a' }, width: 28, height: 28 }}
                >
                  <EditIcon sx={{ fontSize: 14 }} />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); setDeleteId(c.id); setDeleteName(c.name) }}
                  sx={{ color: '#786c5c', bgcolor: '#111009', '&:hover': { color: '#b84848' }, width: 28, height: 28 }}
                >
                  <DeleteIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>

              <CardActionArea onClick={() => handleOpen(c.id, c.name)} sx={{ p: 0 }}>
                <CardContent sx={{ p: 2.5, pb: '2.5rem !important' }}>
                  <Typography variant="h6" sx={{ fontFamily: '"Cinzel", serif', color: '#e6d8c0', mb: 1, pr: 6, fontSize: '1rem' }}>
                    {c.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                    {c.system && (
                      <Chip label={c.system} size="small" sx={{ bgcolor: '#1a160f', color: '#b4a48a', fontSize: '0.7rem' }} />
                    )}
                    {c.yearInGame && (
                      <Chip label={c.yearInGame} size="small" sx={{ bgcolor: '#1a160f', color: '#786c5c', fontFamily: '"JetBrains Mono"', fontSize: '0.7rem' }} />
                    )}
                    {c.playerCount != null && c.playerCount > 0 && (
                      <Chip label={`${c.playerCount} players`} size="small" sx={{ bgcolor: '#1a160f', color: '#786c5c', fontSize: '0.7rem' }} />
                    )}
                  </Box>
                  {c.description && (
                    <Typography variant="body2" sx={{ color: '#786c5c', fontSize: '0.82rem', lineHeight: 1.5,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {c.description}
                    </Typography>
                  )}
                  {c.activeChapter && (
                    <Typography variant="caption" sx={{ color: '#62a870', fontSize: '0.72rem', mt: 1, display: 'block' }}>
                      Active: {c.activeChapter.name}
                    </Typography>
                  )}
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <CampaignFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditCampaign(null) }}
        onSaved={handleSaved}
        campaign={editCampaign}
      />

      <ConfirmDeleteDialog
        open={!!deleteId}
        title={`Delete "${deleteName}"?`}
        message="All chapters, characters, decisions, items and sessions will be permanently deleted."
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
        loading={deleting}
      />
    </Box>
  )
}
