import { useState } from 'react'
import { useQuery, useMutation, gql } from '@apollo/client'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { staggerContainer } from '../utils/motion'
import {
  Box,
  Typography,
  Grid,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  InputAdornment,
  IconButton,
  Tooltip,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { useCampaign } from '../context/campaign'
import CharacterCard from '../components/CharacterCard'
import CharacterFormDialog from '../components/CharacterFormDialog'
import ConfirmDeleteDialog from '../components/ConfirmDeleteDialog'

const CHARACTERS = gql`
  query Characters($campaignId: ID!, $role: CharacterRole, $status: CharacterStatus, $search: String) {
    characters(campaignId: $campaignId, role: $role, status: $status, search: $search) {
      id name role description location status hpMax hpCurrent armorClass speed
      corruptionStage corruptionMax miniPrinted miniStlSource miniSearchHint
      narrativeNotes tags
      stats
    }
  }
`

const DELETE_CHARACTER = gql`
  mutation DeleteCharacter($id: ID!) {
    deleteCharacter(id: $id)
  }
`

const ROLES = ['', 'NPC', 'PLAYER', 'MONSTER', 'ALLY', 'VILLAIN', 'NEUTRAL']
const STATUSES = ['', 'ACTIVE', 'PENDING', 'DEAD', 'UNKNOWN', 'RESOLVED']

type CharType = {
  id: string; name: string; role: string; description?: string | null; location?: string | null
  status: string; hpMax?: number | null; hpCurrent?: number | null; armorClass?: number | null
  speed?: number | null; corruptionStage: number; corruptionMax: number; miniPrinted: boolean
  miniStlSource?: string | null; miniSearchHint?: string | null; narrativeNotes?: string | null
  tags: string[]; stats?: Record<string, number> | null
}

export default function Characters() {
  const { campaignId } = useCampaign()
  const navigate = useNavigate()
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editChar, setEditChar] = useState<CharType | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteName, setDeleteName] = useState('')

  const { data, loading, error, refetch } = useQuery(CHARACTERS, {
    variables: { campaignId, role: role || undefined, status: status || undefined, search: search || undefined },
    skip: !campaignId,
  })

  const [deleteCharacter, { loading: deleting }] = useMutation(DELETE_CHARACTER)

  const handleDelete = async () => {
    if (!deleteId) return
    await deleteCharacter({ variables: { id: deleteId } })
    setDeleteId(null)
    refetch()
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
        <Typography variant="h4">Characters</Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />}
          onClick={() => { setEditChar(null); setFormOpen(true) }}>
          New Character
        </Button>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search characters..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ minWidth: 220 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: '#786c5c' }} />
              </InputAdornment>
            ),
          }}
        />
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Role</InputLabel>
          <Select value={role} onChange={(e) => setRole(e.target.value)} label="Role">
            {ROLES.map((r) => <MenuItem key={r} value={r}>{r || 'All Roles'}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Status</InputLabel>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} label="Status">
            {STATUSES.map((s) => <MenuItem key={s} value={s}>{s || 'All Statuses'}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
          <CircularProgress sx={{ color: '#c8a44a' }} />
        </Box>
      )}
      {error && <Alert severity="error">{error.message}</Alert>}

      <Grid container spacing={1.5} component={motion.div} variants={staggerContainer} initial="hidden" animate="visible">
        {data?.characters?.map((c: CharType) => (
          <Grid item xs={12} sm={6} md={4} key={c.id}>
            <Box sx={{ '&:hover .char-actions': { opacity: 1 } }}>
              <CharacterCard
                character={c}
                onClick={() => navigate(`/characters/${c.id}`)}
                actions={
                  <>
                    <Tooltip title="Edit">
                      <IconButton size="small" className="char-actions"
                        onClick={(e) => { e.stopPropagation(); setEditChar(c); setFormOpen(true) }}
                        sx={{ color: '#786c5c', opacity: 0, transition: 'opacity 0.15s', '&:hover': { color: '#c8a44a' }, width: 22, height: 22 }}>
                        <EditIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" className="char-actions"
                        onClick={(e) => { e.stopPropagation(); setDeleteId(c.id); setDeleteName(c.name) }}
                        sx={{ color: '#786c5c', opacity: 0, transition: 'opacity 0.15s', '&:hover': { color: '#b84848' }, width: 22, height: 22 }}>
                        <DeleteIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Tooltip>
                  </>
                }
              />
            </Box>
          </Grid>
        ))}
        {data?.characters?.length === 0 && (
          <Grid item xs={12}>
            <Typography sx={{ color: '#786c5c', textAlign: 'center', py: 4 }}>No characters found.</Typography>
          </Grid>
        )}
      </Grid>

      <CharacterFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditChar(null) }}
        onSaved={() => refetch()}
        character={editChar}
      />

      <ConfirmDeleteDialog
        open={!!deleteId}
        title={`Delete "${deleteName}"?`}
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
        loading={deleting}
      />
    </Box>
  )
}
