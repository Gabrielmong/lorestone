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
  useTheme,
  useMediaQuery,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { useCampaign } from '../context/campaign'
import CharacterCard from '../components/CharacterCard'
import CharacterFormDialog from '../components/CharacterFormDialog'
import PlayerFormDialog from '../components/PlayerFormDialog'
import type { PlayerFormValues, PlayerFormWeapon, PlayerFormEquipItem } from '../components/PlayerFormDialog'
import ConfirmDeleteDialog from '../components/ConfirmDeleteDialog'

const CHARACTERS = gql`
  query Characters($campaignId: ID!, $role: CharacterRole, $status: CharacterStatus, $search: String) {
    characters(campaignId: $campaignId, role: $role, status: $status, search: $search) {
      id name role description location status hpMax hpCurrent armorClass speed
      corruptionStage corruptionMax miniPrinted miniStlSource miniSearchHint
      narrativeNotes tags stats extra portraitUrl
    }
  }
`

const UPDATE_CHARACTER = gql`
  mutation UpdateCharacterFromList($id: ID!, $input: UpdateCharacterInput!) {
    updateCharacter(id: $id, input: $input) { id name }
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
  tags: string[]; stats?: Record<string, number> | null; extra?: Record<string, any> | null
  portraitUrl?: string | null
}

function modStr(score: number | string): string {
  const n = typeof score === 'string' ? parseInt(score) : score
  if (isNaN(n)) return ''
  const m = Math.floor((n - 10) / 2)
  return m >= 0 ? `+${m}` : `${m}`
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

    const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const { data, loading, error, refetch } = useQuery(CHARACTERS, {
    variables: { campaignId, role: role || undefined, status: status || undefined, search: search || undefined },
    skip: !campaignId,
  })

  const [deleteCharacter, { loading: deleting }] = useMutation(DELETE_CHARACTER)
  const [updateCharacter] = useMutation(UPDATE_CHARACTER)

  const handleDelete = async () => {
    if (!deleteId) return
    await deleteCharacter({ variables: { id: deleteId } })
    setDeleteId(null)
    refetch()
  }

  const isEditingPlayer = editChar?.role === 'PLAYER'
  const ex = (editChar?.extra ?? {}) as Record<string, any>

  const playerInitial: Partial<PlayerFormValues> = isEditingPlayer ? {
    name: editChar!.name,
    playerName: ex.playerName ?? '',
    race: ex.race ?? '', class: ex.class ?? '',
    level: ex.level != null ? String(ex.level) : '',
    background: ex.background ?? '', alignment: ex.alignment ?? '',
    description: editChar!.description ?? '', hitDice: ex.hitDice ?? '',
    hpMax: editChar!.hpMax != null ? String(editChar!.hpMax) : '',
    armorClass: editChar!.armorClass != null ? String(editChar!.armorClass) : '',
    speed: ex.speed ?? (editChar!.speed != null ? String(editChar!.speed) : ''),
    initiative: ex.initiative ?? '', proficiencyBonus: ex.proficiencyBonus ?? '',
    spellSaveDC: ex.spellSaveDC ?? '',
    passivePerception: ex.passivePerception != null ? String(ex.passivePerception) : '',
    strength: ex.strength != null ? String(ex.strength) : '',
    dexterity: ex.dexterity != null ? String(ex.dexterity) : '',
    constitution: ex.constitution != null ? String(ex.constitution) : '',
    intelligence: ex.intelligence != null ? String(ex.intelligence) : '',
    wisdom: ex.wisdom != null ? String(ex.wisdom) : '',
    charisma: ex.charisma != null ? String(ex.charisma) : '',
    gender: ex.gender ?? '', age: ex.age ?? '', height: ex.height ?? '',
    weight: ex.weight ?? '', eyes: ex.eyes ?? '', hair: ex.hair ?? '', skin: ex.skin ?? '',
    savingThrows: ex.savingThrows ?? {}, skills: ex.skills ?? {},
    weapons: (ex.weapons ?? []).map((w: Record<string, string>) => ({ name: w.name ?? '', attackBonus: w.attackBonus ?? '', damage: w.damage ?? '', notes: w.notes ?? '' })),
    equipment: (ex.equipment ?? []).map((e: Record<string, string>) => ({ name: e.name ?? '', qty: e.qty ?? '' })),
    currencyCp: ex.currency?.cp != null ? String(ex.currency.cp) : '',
    currencySp: ex.currency?.sp != null ? String(ex.currency.sp) : '',
    currencyEp: ex.currency?.ep != null ? String(ex.currency.ep) : '',
    currencyGp: ex.currency?.gp != null ? String(ex.currency.gp) : '',
    currencyPp: ex.currency?.pp != null ? String(ex.currency.pp) : '',
    featuresTraits: ex.featuresTraits ? (ex.featuresTraits as string[]).join('\n\n') : '',
    actions: ex.actions ? (ex.actions as string[]).join('\n\n') : '',
    proficienciesAndLanguages: ex.proficienciesAndLanguages ?? '',
  } : {}

  const handlePlayerSave = async (v: PlayerFormValues) => {
    if (!editChar) return
    const scores: Record<string, number | undefined> = {
      strength: parseInt(v.strength) || undefined, dexterity: parseInt(v.dexterity) || undefined,
      constitution: parseInt(v.constitution) || undefined, intelligence: parseInt(v.intelligence) || undefined,
      wisdom: parseInt(v.wisdom) || undefined, charisma: parseInt(v.charisma) || undefined,
    }
    const statsMap: Record<string, number> = {}
    if (scores.strength) statsMap.STR = scores.strength
    if (scores.dexterity) statsMap.DEX = scores.dexterity
    if (scores.constitution) statsMap.CON = scores.constitution
    if (scores.intelligence) statsMap.INT = scores.intelligence
    if (scores.wisdom) statsMap.WIS = scores.wisdom
    if (scores.charisma) statsMap.CHA = scores.charisma

    const weapons = (v.weapons as PlayerFormWeapon[]).filter((w) => w.name.trim()).map((w) => ({ name: w.name, attackBonus: w.attackBonus || undefined, damage: w.damage || undefined, notes: w.notes || undefined }))
    const equipment = (v.equipment as PlayerFormEquipItem[]).filter((e) => e.name.trim()).map((e) => ({ name: e.name, qty: e.qty || undefined }))
    const cp = parseInt(v.currencyCp) || undefined, sp = parseInt(v.currencySp) || undefined
    const ep = parseInt(v.currencyEp) || undefined, gp = parseInt(v.currencyGp) || undefined, pp = parseInt(v.currencyPp) || undefined
    const currency = [cp, sp, ep, gp, pp].some((x) => x != null) ? { cp, sp, ep, gp, pp } : undefined
    const savingThrows = Object.fromEntries(Object.entries(v.savingThrows).filter(([, val]) => val.trim()))
    const skills = Object.fromEntries(Object.entries(v.skills).filter(([, val]) => val.trim()))

    await updateCharacter({
      variables: {
        id: editChar.id,
        input: {
          name: v.name, description: v.description || undefined,
          hpMax: parseInt(v.hpMax) || undefined, hpCurrent: parseInt(v.hpMax) || undefined,
          armorClass: parseInt(v.armorClass) || undefined,
          speed: v.speed ? parseInt(v.speed) || undefined : undefined,
          stats: Object.keys(statsMap).length ? statsMap : undefined,
          extra: {
            ...ex, playerName: v.playerName || undefined, race: v.race || undefined, class: v.class || undefined,
            level: parseInt(v.level) || undefined, background: v.background || undefined, alignment: v.alignment || undefined,
            hpMax: parseInt(v.hpMax) || undefined, armorClass: parseInt(v.armorClass) || undefined,
            speed: v.speed || undefined, initiative: v.initiative || undefined,
            hitDice: v.hitDice || undefined, proficiencyBonus: v.proficiencyBonus || undefined,
            spellSaveDC: v.spellSaveDC || undefined,
            passivePerception: v.passivePerception ? parseInt(v.passivePerception) : undefined,
            gender: v.gender || undefined, age: v.age || undefined, height: v.height || undefined,
            weight: v.weight || undefined, eyes: v.eyes || undefined, hair: v.hair || undefined, skin: v.skin || undefined,
            weapons: weapons.length ? weapons : undefined, equipment: equipment.length ? equipment : undefined, currency,
            savingThrows: Object.keys(savingThrows).length ? savingThrows : undefined,
            skills: Object.keys(skills).length ? skills : undefined,
            featuresTraits: v.featuresTraits ? v.featuresTraits.split('\n\n').filter(Boolean) : undefined,
            actions: v.actions ? v.actions.split('\n\n').filter(Boolean) : undefined,
            proficienciesAndLanguages: v.proficienciesAndLanguages || undefined,
            ...scores,
            strengthMod: scores.strength ? modStr(scores.strength) : undefined,
            dexterityMod: scores.dexterity ? modStr(scores.dexterity) : undefined,
            constitutionMod: scores.constitution ? modStr(scores.constitution) : undefined,
            intelligenceMod: scores.intelligence ? modStr(scores.intelligence) : undefined,
            wisdomMod: scores.wisdom ? modStr(scores.wisdom) : undefined,
            charismaMod: scores.charisma ? modStr(scores.charisma) : undefined,
          },
        },
      },
    })
    setFormOpen(false)
    setEditChar(null)
    refetch()
  }

  return (
    <Box
      pt={isMobile ? 1 : 0}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 1 }}>
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
          sx={{ minWidth: { xs: '100%', sm: 220 }, flex: { xs: '1 1 100%', sm: 'unset' } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: '#786c5c' }} />
              </InputAdornment>
            ),
          }}
        />
        <FormControl size="small" sx={{ minWidth: { xs: 'calc(50% - 6px)', sm: 130 }, flex: { xs: '1 1 calc(50% - 6px)', sm: 'unset' } }}>
          <InputLabel>Role</InputLabel>
          <Select value={role} onChange={(e) => setRole(e.target.value)} label="Role">
            {ROLES.map((r) => <MenuItem key={r} value={r}>{r || 'All Roles'}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: { xs: 'calc(50% - 6px)', sm: 130 }, flex: { xs: '1 1 calc(50% - 6px)', sm: 'unset' } }}>
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

      {isEditingPlayer ? (
        <PlayerFormDialog
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditChar(null) }}
          onSave={handlePlayerSave}
          initial={playerInitial}
          title={editChar?.name}
        />
      ) : (
        <CharacterFormDialog
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditChar(null) }}
          onSaved={() => refetch()}
          character={editChar}
        />
      )}

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
