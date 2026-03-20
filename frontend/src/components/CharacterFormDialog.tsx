import { useState, useEffect } from 'react'
import { useMutation, gql } from '@apollo/client'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Grid, Typography, Divider, FormControlLabel, Checkbox, Box,
} from '@mui/material'
import { useCampaign } from '../context/campaign'

const CREATE_CHARACTER = gql`
  mutation CreateCharacter($input: CreateCharacterInput!) {
    createCharacter(input: $input) { id name }
  }
`

const UPDATE_CHARACTER = gql`
  mutation UpdateCharacter($id: ID!, $input: UpdateCharacterInput!) {
    updateCharacter(id: $id, input: $input) { id name }
  }
`

const STAT_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
const ROLES = ['NPC', 'PLAYER', 'MONSTER', 'ALLY', 'VILLAIN', 'NEUTRAL']
const STATUSES = ['ACTIVE', 'PENDING', 'DEAD', 'UNKNOWN', 'RESOLVED']

interface CharacterData {
  id?: string
  name?: string
  role?: string
  description?: string | null
  location?: string | null
  status?: string
  hpMax?: number | null
  hpCurrent?: number | null
  armorClass?: number | null
  speed?: number | null
  stats?: Record<string, number> | null
  corruptionStage?: number
  corruptionMax?: number
  narrativeNotes?: string | null
  miniPrinted?: boolean
  miniStlSource?: string | null
  miniSearchHint?: string | null
  tags?: string[]
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  character?: CharacterData | null
}

const defaultStats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }

export default function CharacterFormDialog({ open, onClose, onSaved, character }: Props) {
  const { campaignId } = useCampaign()
  const isEdit = !!character?.id

  const [name, setName] = useState('')
  const [role, setRole] = useState('NPC')
  const [status, setStatus] = useState('ACTIVE')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [narrativeNotes, setNarrativeNotes] = useState('')
  const [hpMax, setHpMax] = useState('')
  const [hpCurrent, setHpCurrent] = useState('')
  const [armorClass, setArmorClass] = useState('')
  const [speed, setSpeed] = useState('')
  const [stats, setStats] = useState<Record<string, string>>(
    Object.fromEntries(STAT_KEYS.map((k) => [k, '10']))
  )
  const [corruptionMax, setCorruptionMax] = useState('')
  const [corruptionStage, setCorruptionStage] = useState('')
  const [miniPrinted, setMiniPrinted] = useState(false)
  const [miniStlSource, setMiniStlSource] = useState('')
  const [miniSearchHint, setMiniSearchHint] = useState('')
  const [tags, setTags] = useState('')

  useEffect(() => {
    if (open) {
      setName(character?.name ?? '')
      setRole(character?.role ?? 'NPC')
      setStatus(character?.status ?? 'ACTIVE')
      setDescription(character?.description ?? '')
      setLocation(character?.location ?? '')
      setNarrativeNotes(character?.narrativeNotes ?? '')
      setHpMax(character?.hpMax != null ? String(character.hpMax) : '')
      setHpCurrent(character?.hpCurrent != null ? String(character.hpCurrent) : '')
      setArmorClass(character?.armorClass != null ? String(character.armorClass) : '')
      setSpeed(character?.speed != null ? String(character.speed) : '')
      const existingStats = character?.stats ?? {}
      setStats(Object.fromEntries(STAT_KEYS.map((k) => [k, String(existingStats[k] ?? defaultStats[k])])))
      setCorruptionMax(character?.corruptionMax ? String(character.corruptionMax) : '')
      setCorruptionStage(character?.corruptionStage ? String(character.corruptionStage) : '')
      setMiniPrinted(character?.miniPrinted ?? false)
      setMiniStlSource(character?.miniStlSource ?? '')
      setMiniSearchHint(character?.miniSearchHint ?? '')
      setTags(character?.tags?.join(', ') ?? '')
    }
  }, [open, character])

  const [createCharacter, { loading: creating }] = useMutation(CREATE_CHARACTER)
  const [updateCharacter, { loading: updating }] = useMutation(UPDATE_CHARACTER)
  const loading = creating || updating

  const buildStatsJson = () => {
    const result: Record<string, number> = {}
    for (const k of STAT_KEYS) {
      const v = parseInt(stats[k])
      if (!isNaN(v)) result[k] = v
    }
    return Object.keys(result).length > 0 ? result : undefined
  }

  const handleSave = async () => {
    const statsJson = buildStatsJson()
    const tagsArr = tags.split(',').map((t) => t.trim()).filter(Boolean)

    const input = {
      name,
      role,
      status,
      description: description || undefined,
      location: location || undefined,
      narrativeNotes: narrativeNotes || undefined,
      hpMax: hpMax ? parseInt(hpMax) : undefined,
      hpCurrent: hpCurrent ? parseInt(hpCurrent) : undefined,
      armorClass: armorClass ? parseInt(armorClass) : undefined,
      speed: speed ? parseInt(speed) : undefined,
      stats: statsJson,
      corruptionMax: corruptionMax ? parseInt(corruptionMax) : 0,
      corruptionStage: corruptionStage ? parseInt(corruptionStage) : 0,
      miniPrinted,
      miniStlSource: miniStlSource || undefined,
      miniSearchHint: miniSearchHint || undefined,
      tags: tagsArr,
    }

    if (isEdit) {
      await updateCharacter({ variables: { id: character!.id, input } })
    } else {
      await createCharacter({ variables: { input: { ...input, campaignId } } })
    }
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ color: '#e6d8c0', fontFamily: '"Cinzel", serif', fontSize: '1rem' }}>
        {isEdit ? 'Edit Character' : 'New Character'}
      </DialogTitle>
      <DialogContent dividers sx={{ '& .MuiDivider-root': { borderColor: 'rgba(120,108,92,0.3)' } }}>
        <Grid container spacing={2} sx={{ mt: 0 }}>
          {/* Basic */}
          <Grid item xs={12} sm={6}>
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth size="small" required />
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormControl size="small" fullWidth>
              <InputLabel>Role</InputLabel>
              <Select value={role} onChange={(e) => setRole(e.target.value)} label="Role">
                {ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormControl size="small" fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={status} onChange={(e) => setStatus(e.target.value)} label="Status">
                {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Location" value={location} onChange={(e) => setLocation(e.target.value)} fullWidth size="small" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Tags (comma-separated)" value={tags} onChange={(e) => setTags(e.target.value)} fullWidth size="small" />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth size="small" multiline rows={2} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="DM Notes" value={narrativeNotes} onChange={(e) => setNarrativeNotes(e.target.value)} fullWidth size="small" multiline rows={2} />
          </Grid>

          {/* Combat */}
          <Grid item xs={12}>
            <Divider sx={{ my: 0.5 }}>
              <Typography sx={{ fontSize: '0.75rem', color: '#786c5c', px: 1 }}>COMBAT</Typography>
            </Divider>
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField label="HP Max" type="number" value={hpMax} onChange={(e) => setHpMax(e.target.value)} fullWidth size="small" />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField label="HP Current" type="number" value={hpCurrent} onChange={(e) => setHpCurrent(e.target.value)} fullWidth size="small" />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField label="Armor Class" type="number" value={armorClass} onChange={(e) => setArmorClass(e.target.value)} fullWidth size="small" />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField label="Speed (ft)" type="number" value={speed} onChange={(e) => setSpeed(e.target.value)} fullWidth size="small" />
          </Grid>

          {/* Ability Scores */}
          <Grid item xs={12}>
            <Typography sx={{ fontSize: '0.78rem', color: '#786c5c', mb: 0.5, textTransform: 'uppercase', letterSpacing: 1 }}>
              Ability Scores
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {STAT_KEYS.map((k) => (
                <TextField
                  key={k}
                  label={k.toUpperCase()}
                  type="number"
                  value={stats[k]}
                  onChange={(e) => setStats((prev) => ({ ...prev, [k]: e.target.value }))}
                  size="small"
                  inputProps={{ min: 1, max: 30, style: { textAlign: 'center', fontFamily: '"JetBrains Mono"' } }}
                  sx={{ flex: 1 }}
                />
              ))}
            </Box>
          </Grid>

          {/* Corruption */}
          <Grid item xs={6} sm={3}>
            <TextField label="Corruption Max" type="number" value={corruptionMax} onChange={(e) => setCorruptionMax(e.target.value)} fullWidth size="small" />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField label="Corruption Stage" type="number" value={corruptionStage} onChange={(e) => setCorruptionStage(e.target.value)} fullWidth size="small" />
          </Grid>

          {/* Mini */}
          <Grid item xs={12}>
            <Divider sx={{ my: 0.5 }}>
              <Typography sx={{ fontSize: '0.75rem', color: '#786c5c', px: 1 }}>MINIATURE</Typography>
            </Divider>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControlLabel
              control={<Checkbox checked={miniPrinted} onChange={(e) => setMiniPrinted(e.target.checked)} size="small" />}
              label={<Typography sx={{ fontSize: '0.85rem', color: '#b4a48a' }}>Mini Printed</Typography>}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField label="STL Source" value={miniStlSource} onChange={(e) => setMiniStlSource(e.target.value)} fullWidth size="small" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField label="Search Hint" value={miniSearchHint} onChange={(e) => setMiniSearchHint(e.target.value)} fullWidth size="small" />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading} sx={{ color: '#786c5c' }}>Cancel</Button>
        <Button onClick={handleSave} disabled={loading || !name} variant="contained" size="small">
          {loading ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
