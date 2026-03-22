import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, gql } from '@apollo/client'
import {
  Box, Typography, Button, CircularProgress, Alert, Grid,
  Chip, IconButton, TextField, Select, MenuItem, FormControl,
  Dialog, DialogTitle, DialogContent, DialogActions, Tooltip,
  Divider, LinearProgress, Autocomplete, InputLabel, InputAdornment,
  Popover, useTheme, useMediaQuery,
} from '@mui/material'
import { useCampaign } from '../context/campaign'
import { useAuthStore } from '../store/auth'
import { fetchDdbSheet, sheetToUpdateInput } from '../utils/ddbSync'
import { useDiceStore } from '../store/dice'
import CasinoIcon from '@mui/icons-material/Casino'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SkipNextIcon from '@mui/icons-material/SkipNext'
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious'
import AddIcon from '@mui/icons-material/Add'
import FavoriteIcon from '@mui/icons-material/Favorite'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import RemoveIcon from '@mui/icons-material/Remove'
import GpsFixedIcon from '@mui/icons-material/GpsFixed'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import EditNoteIcon from '@mui/icons-material/EditNote'

const ENCOUNTER = gql`
  query EncounterActive($id: ID!) {
    encounter(id: $id) {
      id name description status round currentTurnIndex outcomeType outcome
      linkedDecision { id question }
      outcomeDecision { id question }
      startedAt endedAt elapsedSeconds
      participants {
        id name isPlayer initiative hpMax hpCurrent armorClass conditions isActive
        killedByName killedDescription notes
        character { id name attacks extra portraitUrl }
      }
    }
  }
`

const NEXT_TURN = gql`
  mutation NextTurn($id: ID!) { nextTurn(encounterId: $id) { id round currentTurnIndex } }
`
const PREV_TURN = gql`
  mutation PrevTurn($id: ID!) { prevTurn(encounterId: $id) { id round currentTurnIndex } }
`
const UPDATE_PARTICIPANT = gql`
  mutation UpdateParticipant($id: ID!, $input: UpdateParticipantInput!) {
    updateParticipant(id: $id, input: $input) {
      id hpCurrent hpMax conditions isActive killedByName killedDescription notes
    }
  }
`
const ADD_PARTICIPANT = gql`
  mutation AddParticipant($encounterId: ID!, $input: CreateParticipantInput!) {
    addParticipant(encounterId: $encounterId, input: $input) { id name initiative }
  }
`
const REMOVE_PARTICIPANT = gql`
  mutation RemoveParticipant($id: ID!) { removeParticipant(id: $id) }
`
const UPDATE_CHARACTER_STATUS = gql`
  mutation UpdateCharacterStatus($id: ID!, $status: CharacterStatus!) {
    updateCharacterStatus(id: $id, status: $status) { id status }
  }
`

const END_ENCOUNTER = gql`
  mutation EndEncounter($id: ID!, $outcomeType: EncounterOutcome!, $outcome: String) {
    endEncounter(id: $id, outcomeType: $outcomeType, outcome: $outcome) { id status outcomeType elapsedSeconds }
  }
`

const PAUSE_ENCOUNTER = gql`
  mutation PauseEncounter($id: ID!) { pauseEncounter(id: $id) { id status elapsedSeconds } }
`
const RESUME_ENCOUNTER = gql`
  mutation ResumeEncounter($id: ID!) { resumeEncounter(id: $id) { id status startedAt } }
`

const LOG_ROLL = gql`
  mutation LogRoll($input: LogRollInput!) { logRoll(input: $input) { id } }
`

const UPDATE_CHARACTER = gql`
  mutation EncounterUpdateCharacter($id: ID!, $input: UpdateCharacterInput!) {
    updateCharacter(id: $id, input: $input) { id name attacks extra stats hpMax hpCurrent armorClass speed }
  }
`

const CAMPAIGN_CHARS = gql`
  query EncounterChars($campaignId: ID!) {
    characters(campaignId: $campaignId) {
      id name role hpMax hpCurrent armorClass initiative stats portraitUrl
    }
  }
`

const CONDITIONS = ['Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated',
  'Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious']

type Attack = { name: string; bonus: number; damage: string }

// Normalized attack usable for dice rolling regardless of source
type NormalizedAttack = {
  name: string; bonus: number; damage: string
  dmgNotation: string; dmgMod: number; notes?: string
}

type SpellEntry = { name: string; level: number; damage?: string; damageMod?: number; damageType?: string; upcastDice?: string; canUpcast?: boolean; castingTime?: string; range?: string; concentration?: boolean }

/** Compute effective damage dice for a spell cast at a given slot level */
function computeSpellDamage(spell: SpellEntry, castLevel: number): string | undefined {
  if (!spell.damage) return undefined
  if (castLevel <= spell.level || !spell.upcastDice) return spell.damage
  const bm = spell.damage.match(/^(\d+)d(\d+)$/)
  const um = spell.upcastDice.match(/^(\d+)d(\d+)$/)
  if (!bm || !um || bm[2] !== um[2]) return spell.damage
  return `${parseInt(bm[1]) + parseInt(um[1]) * (castLevel - spell.level)}d${bm[2]}`
}

/** Strip damage type suffix ("1d8+2 Slashing" → "1d8+2") */
function stripDmgType(dmgStr: string): string {
  return dmgStr.replace(/\s+[A-Za-z].*$/, '').trim()
}

function parseDmg(dmgStr: string): { dmgNotation: string; dmgMod: number } {
  const s = stripDmgType(dmgStr)
  const m = s.match(/(\d+d\d+)([+-]\d+)?/)
  if (m) return { dmgNotation: m[1], dmgMod: m[2] ? parseInt(m[2]) : 0 }
  const flat = parseInt(s)
  if (!isNaN(flat)) return { dmgNotation: `${flat}`, dmgMod: 0 }
  return { dmgNotation: '1d6', dmgMod: 0 }
}

function normalizeAttacks(character: { attacks?: Attack[] | null; extra?: unknown } | null | undefined): NormalizedAttack[] {
  const result: NormalizedAttack[] = []

  // NPC / character.attacks field (bonus is number)
  for (const atk of character?.attacks ?? []) {
    const { dmgNotation, dmgMod } = parseDmg(atk.damage)
    result.push({ name: atk.name, bonus: atk.bonus, damage: atk.damage, dmgNotation, dmgMod })
  }

  // Player weapons from extra.weapons (attackBonus is string like "+4", damage may have type suffix)
  // extra may arrive as a string from the JSON scalar in some environments
  const rawExtra = character?.extra
  const extraObj = typeof rawExtra === 'string'
    ? (JSON.parse(rawExtra) as Record<string, unknown>)
    : (rawExtra as Record<string, unknown> | null)
  const extraWeapons = extraObj?.weapons as
    Array<{ name?: string; attackBonus?: string; damage?: string; notes?: string }> | undefined
  for (const w of extraWeapons ?? []) {
    if (!w.name?.trim()) continue
    // Skip if already in attacks (avoid duplicates for characters with both fields)
    if (result.some((r) => r.name === w.name)) continue
    const bonus = parseInt(w.attackBonus ?? '0') || 0
    const dmgStr = stripDmgType(w.damage ?? '')
    const { dmgNotation, dmgMod } = parseDmg(dmgStr)
    result.push({ name: w.name, bonus, damage: dmgStr, dmgNotation, dmgMod, notes: w.notes })
  }

  return result
}

type Participant = {
  id: string; name: string; isPlayer: boolean; initiative: number
  hpMax?: number | null; hpCurrent?: number | null; armorClass?: number | null
  conditions: string[]; isActive: boolean
  killedByName?: string | null; killedDescription?: string | null
  notes?: string | null
  character?: { id: string; name: string; attacks?: Attack[] | null; extra?: unknown; portraitUrl?: string | null } | null
}

type CampaignChar = { id: string; name: string; role: string; hpMax?: number | null; hpCurrent?: number | null; armorClass?: number | null; initiative?: number | null; stats?: Record<string, number> | null; portraitUrl?: string | null }

export default function EncounterActive() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { campaignId } = useCampaign()
  const { user } = useAuthStore()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const { data, loading, error } = useQuery(ENCOUNTER, {
    variables: { id },
    skip: !id,
    pollInterval: 5000,
  })

  const [nextTurnMutation] = useMutation(NEXT_TURN, { refetchQueries: ['EncounterActive'] })
  const [prevTurnMutation] = useMutation(PREV_TURN, { refetchQueries: ['EncounterActive'] })
  const [updateCharacter] = useMutation(UPDATE_CHARACTER)
  const [updateParticipant] = useMutation(UPDATE_PARTICIPANT, { refetchQueries: ['EncounterActive'] })
  const [updateParticipantSilent] = useMutation(UPDATE_PARTICIPANT) // no refetch — used during background sync

  // Silently sync all DDB-linked player participants: updates both Character record and participant HP/AC
  const syncDdbParticipants = useCallback((participants: Participant[]) => {
    participants.forEach(async (p) => {
      if (!p.isPlayer || !p.character) return
      const extra = p.character.extra as Record<string, unknown> | null
      if (extra?.importType !== 'url' || typeof extra?.sheetUrl !== 'string') return
      try {
        const ddbId = extra.sheetUrl.match(/dndbeyond\.com\/characters\/(\d+)/i)?.[1] ?? (/^\d+$/.test(extra.sheetUrl) ? extra.sheetUrl : null)
        if (!ddbId) return
        const sheet = await fetchDdbSheet(ddbId)
        // Update the Character record (stats, extra, portraitUrl, etc.)
        await updateCharacter({ variables: { id: p.character.id, input: sheetToUpdateInput(sheet, extra.sheetUrl as string) } })
        // Also push fresh HP / AC into the encounter participant so the UI reflects DDB data
        await updateParticipantSilent({
          variables: {
            id: p.id,
            input: {
              hpMax: sheet.hpMax ?? undefined,
              hpCurrent: sheet.hpCurrent ?? sheet.hpMax ?? undefined,
              armorClass: sheet.armorClass ?? undefined,
            },
          },
        })
      } catch { /* silent */ }
    })
  }, [updateCharacter, updateParticipantSilent])

  const nextTurn = useCallback((opts?: Parameters<typeof nextTurnMutation>[0]) => {
    const participants: Participant[] = data?.encounter?.participants ?? []
    syncDdbParticipants(participants)
    return nextTurnMutation(opts)
  }, [nextTurnMutation, data, syncDdbParticipants])

  const prevTurn = useCallback((opts?: Parameters<typeof prevTurnMutation>[0]) => {
    const participants: Participant[] = data?.encounter?.participants ?? []
    syncDdbParticipants(participants)
    return prevTurnMutation(opts)
  }, [prevTurnMutation, data, syncDdbParticipants])

  const [addParticipant, { loading: addingP }] = useMutation(ADD_PARTICIPANT, { refetchQueries: ['EncounterActive'] })
  const [removeParticipant] = useMutation(REMOVE_PARTICIPANT, { refetchQueries: ['EncounterActive'] })
  const [updateCharacterStatus] = useMutation(UPDATE_CHARACTER_STATUS, { refetchQueries: ['Characters', 'Dashboard'] })
  const [pauseEncounter] = useMutation(PAUSE_ENCOUNTER, { refetchQueries: ['EncounterActive'] })
  const [resumeEncounter] = useMutation(RESUME_ENCOUNTER, { refetchQueries: ['EncounterActive'] })
  const [logRoll] = useMutation(LOG_ROLL)

  const [endEncounter, { loading: ending }] = useMutation(END_ENCOUNTER, {
    refetchQueries: ['Encounters', 'EncountersForTree'],
    onCompleted: () => navigate('/encounters'),
  })

  // Save each player participant's final HP back to their Character record before ending
  const handleEndEncounter = useCallback(async (variables: { id: string; outcomeType: string; outcome?: string }) => {
    const participants: Participant[] = data?.encounter?.participants ?? []
    await Promise.all(
      participants
        .filter((p) => p.isPlayer && p.character?.id && p.hpCurrent != null)
        .map((p) =>
          updateCharacter({ variables: { id: p.character!.id, input: { hpCurrent: p.hpCurrent ?? 0 } } }).catch(() => {})
        )
    )
    endEncounter({ variables })
  }, [data, updateCharacter, endEncounter])

  const { data: charsData } = useQuery(CAMPAIGN_CHARS, { variables: { campaignId }, skip: !campaignId, fetchPolicy: 'cache-and-network' })
  const campaignChars: CampaignChar[] = charsData?.characters ?? []

  const { triggerAutoRoll, triggerRoll } = useDiceStore()

  // Add participant form
  const [addOpen, setAddOpen] = useState(false)
  const [selectedChar, setSelectedChar] = useState<CampaignChar | null>(null)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('monster')
  const [newInit, setNewInit] = useState('')
  const [newHpMax, setNewHpMax] = useState('')
  const [newHpCurrent, setNewHpCurrent] = useState('')
  const [newAc, setNewAc] = useState('')
  const [newCount, setNewCount] = useState('1')

  // End encounter dialog
  const [endOpen, setEndOpen] = useState(false)
  const [outcomeType, setOutcomeType] = useState('WIN')
  const [outcomeText, setOutcomeText] = useState('')

  // HP delta per participant
  const [hpDelta, setHpDelta] = useState<Record<string, string>>({})

  // Spell cast level picker
  const [spellCast, setSpellCast] = useState<{
    pos: { top: number; left: number }; pName: string; spell: SpellEntry; availableLevels: number[]
  } | null>(null)

  const rollSpell = (pName: string, spell: SpellEntry, castLevel: number) => {
    const dmgDice = computeSpellDamage(spell, castLevel)
    if (!dmgDice) return
    const m = dmgDice.match(/(\d+)d(\d+)/)
    if (m) triggerRoll(`${m[1]}d${m[2]}`, `${pName} — ${spell.name}${castLevel > spell.level ? ` (Lv ${castLevel})` : ''}`, spell.damageMod ?? 0)
    setSpellCast(null)
  }

  const openSpellDmg = (e: React.MouseEvent, pName: string, spell: SpellEntry, extraObj: Record<string, unknown> | null) => {
    const pactLevel = extraObj?.pactMagicLevel as number | undefined
    const slots = extraObj?.spellSlots as Record<string, number> | undefined
    if (spell.level === 0) { rollSpell(pName, spell, 0); return }
    let availableLevels: number[]
    if (pactLevel) {
      availableLevels = spell.level <= pactLevel ? [pactLevel] : [spell.level]
    } else if (spell.upcastDice || spell.canUpcast) {
      // Show all levels from spell's base level up to the character's max slot level
      const slotLevels = slots ? Object.keys(slots).map(Number) : []
      const maxLevel = slotLevels.length ? Math.max(...slotLevels) : spell.level
      availableLevels = Array.from({ length: maxLevel - spell.level + 1 }, (_, i) => spell.level + i)
    } else {
      rollSpell(pName, spell, spell.level); return
    }
    if (availableLevels.length === 1) { rollSpell(pName, spell, availableLevels[0]); return }
    setSpellCast({ pos: { top: e.clientY, left: e.clientX }, pName, spell, availableLevels })
  }

  // Kill tracking dialog
  const [killDialogOpen, setKillDialogOpen] = useState(false)
  const [killedParticipant, setKilledParticipant] = useState<Participant | null>(null)
  const [killedByName, setKilledByName] = useState('')
  const [killedDescription, setKilledDescription] = useState('')

  // Manual roll log
  const [rollLogOpen, setRollLogOpen] = useState(false)
  const [rlCharacter, setRlCharacter] = useState('')
  const [rlLabel, setRlLabel] = useState('')
  const [rlDiceType, setRlDiceType] = useState('d20')
  const [rlResult, setRlResult] = useState('')
  const [rlModifier, setRlModifier] = useState('0')

  const handleLogManualRoll = async () => {
    const total = parseInt(rlResult)
    if (!rlCharacter || isNaN(total)) return
    const mod = parseInt(rlModifier) || 0
    const base = total - mod
    const critical = rlDiceType === 'd20' && base === 20 ? 'nat20' : rlDiceType === 'd20' && base === 1 ? 'nat1' : undefined
    await logRoll({
      variables: {
        input: {
          campaignId,
          characterName: rlCharacter,
          notation: `1${rlDiceType}${mod >= 0 ? '+' : ''}${mod}`,
          diceType: rlDiceType,
          individualRolls: [base],
          modifier: mod,
          total,
          label: rlLabel || rlDiceType.toUpperCase(),
          ...(critical && { critical }),
        },
      },
    })
    setRlResult('')
    setRollLogOpen(false)
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress sx={{ color: '#c8a44a' }} /></Box>
  if (error) return <Alert severity="error">{error.message}</Alert>

  const encounter = data?.encounter
  if (!encounter) return null

  const activeParticipants: Participant[] = (encounter.participants as Participant[])
    .filter((p) => p.isActive)
    .sort((a, b) => b.initiative - a.initiative)

  const inactiveParticipants: Participant[] = (encounter.participants as Participant[])
    .filter((p) => !p.isActive)

  const currentParticipant = activeParticipants[encounter.currentTurnIndex] ?? null
  const isCompleted = encounter.status === 'COMPLETED'
  const isPaused = encounter.status === 'PAUSED'
  const isActive = encounter.status === 'ACTIVE'
  const isPending = encounter.status === 'PENDING'
  const isInProgress = isActive || isPending  // can advance turns / pause

  const applyHpDelta = async (p: Participant, delta: number) => {
    const current = p.hpCurrent ?? p.hpMax ?? 0
    const max = p.hpMax ?? 999
    const next = Math.max(0, Math.min(max, current + delta))
    await updateParticipant({ variables: { id: p.id, input: { hpCurrent: next } } })
  }

  const toggleCondition = async (p: Participant, cond: string) => {
    const current = p.conditions ?? []
    const next = current.includes(cond) ? current.filter((c) => c !== cond) : [...current, cond]
    await updateParticipant({ variables: { id: p.id, input: { conditions: next } } })
  }

  const handleToggleActive = (p: Participant) => {
    if (p.isActive && !p.isPlayer) {
      // Going inactive (dying) — prompt for kill tracking
      setKilledParticipant(p)
      setKilledByName('')
      setKilledDescription('')
      setKillDialogOpen(true)
    } else {
      updateParticipant({ variables: { id: p.id, input: { isActive: !p.isActive } } })
    }
  }

  const confirmKill = async () => {
    if (!killedParticipant) return
    await updateParticipant({
      variables: {
        id: killedParticipant.id,
        input: {
          isActive: false,
          killedByName: killedByName || undefined,
          killedDescription: killedDescription || undefined,
        },
      },
    })
    // If this participant is linked to a real character (non-monster), mark them dead
    if (killedParticipant.character?.id && !killedParticipant.isPlayer) {
      await updateCharacterStatus({ variables: { id: killedParticipant.character.id, status: 'DEAD' } })
    }
    setKillDialogOpen(false)
    setKilledParticipant(null)
  }

  const resetAddForm = () => {
    setSelectedChar(null); setNewName(''); setNewRole('monster')
    setNewInit(''); setNewHpMax(''); setNewHpCurrent(''); setNewAc(''); setNewCount('1')
  }

  const handleAddParticipant = async () => {
    const isMonster = newRole === 'monster'
    const count = isMonster ? Math.max(1, parseInt(newCount) || 1) : 1
    const isPlayer = newRole === 'player'
    const hpMax = newHpMax ? parseInt(newHpMax) : undefined
    const hpCurrent = newHpCurrent ? parseInt(newHpCurrent) : hpMax
    const ac = newAc ? parseInt(newAc) : undefined
    const init = newInit ? parseInt(newInit) : 0

    for (let i = 0; i < count; i++) {
      const name = count > 1 ? `${newName} ${i + 1}` : newName
      await addParticipant({
        variables: {
          encounterId: id,
          input: {
            name,
            isPlayer,
            characterId: selectedChar?.id,
            initiative: init,
            hpMax,
            hpCurrent,
            armorClass: ac,
          },
        },
      })
    }
    setAddOpen(false)
    resetAddForm()
  }

  const ParticipantRow = ({ p, isCurrent, readonly }: { p: Participant; isCurrent: boolean; readonly?: boolean }) => {
    const hpPct = p.hpMax ? Math.max(0, ((p.hpCurrent ?? 0) / p.hpMax) * 100) : null
    const hpColor = hpPct != null ? (hpPct > 50 ? '#62a870' : hpPct > 25 ? '#c8a44a' : '#b84848') : '#786c5c'

    return (
      <Box sx={{
        p: 1.5, borderRadius: 1, mb: 1,
        border: `1px solid ${isCurrent ? 'rgba(200,164,74,0.6)' : 'rgba(120,108,92,0.2)'}`,
        bgcolor: isCurrent ? '#1a160a' : '#111009',
        boxShadow: isCurrent ? '0 0 12px rgba(200,164,74,0.15)' : undefined,
        opacity: p.isActive ? 1 : 0.5,
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{
              width: 32, height: 32, borderRadius: 1, bgcolor: isCurrent ? '#3a2e14' : '#1a1610',
              border: `1px solid ${isCurrent ? '#c8a44a' : 'rgba(120,108,92,0.3)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              position: 'relative', overflow: 'hidden',
            }}>
              {p.character?.portraitUrl && (
                <Box component="img" src={p.character.portraitUrl} alt={p.name}
                  sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', opacity: 0.75 }} />
              )}
              <Typography sx={{ fontSize: '0.78rem', fontFamily: '"JetBrains Mono"', fontWeight: 700, position: 'relative',
                color: isCurrent ? '#c8a44a' : (p.character?.portraitUrl ? '#fff' : '#786c5c'),
                textShadow: p.character?.portraitUrl ? '0 1px 3px rgba(0,0,0,0.9)' : 'none' }}>
                {p.initiative}
              </Typography>
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                {isCurrent && <LocalFireDepartmentIcon sx={{ fontSize: 12, color: '#c8a44a' }} />}
                <Typography sx={{ fontSize: '0.88rem', color: isCurrent ? '#e6d8c0' : '#b4a48a', fontWeight: isCurrent ? 600 : 400 }}>
                  {p.name}
                </Typography>
                {p.isPlayer && <Chip label="PC" size="small" sx={{ height: 14, fontSize: '0.55rem', bgcolor: '#1a2a1a', color: '#62a870' }} />}
                {p.armorClass && (
                  <Typography sx={{ fontSize: '0.65rem', color: '#786c5c', fontFamily: '"JetBrains Mono"' }}>
                    AC {p.armorClass}
                  </Typography>
                )}
              </Box>
              {/* Kill info for inactive NPCs */}
              {!p.isActive && p.killedByName && (
                <Typography sx={{ fontSize: '0.68rem', color: '#b84848', mt: 0.25 }}>
                  Slain by <strong>{p.killedByName}</strong>
                  {p.killedDescription && ` — ${p.killedDescription}`}
                </Typography>
              )}
            </Box>
          </Box>

          {/* HP controls / static display */}
          {p.hpMax != null && (
            readonly ? (
              <Box sx={{ textAlign: 'right', minWidth: 52 }}>
                <Typography sx={{ fontSize: '0.78rem', fontFamily: '"JetBrains Mono"', color: hpColor }}>
                  {p.hpCurrent ?? '—'}/{p.hpMax}
                </Typography>
                <FavoriteIcon sx={{ fontSize: 8, color: hpColor }} />
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <IconButton size="small"
                  onClick={() => applyHpDelta(p, -(parseInt(hpDelta[p.id] || '1') || 1))}
                  sx={{ color: '#b84848', width: 24, height: 24 }}>
                  <RemoveIcon sx={{ fontSize: 12 }} />
                </IconButton>
                <TextField
                  value={hpDelta[p.id] ?? ''}
                  onChange={(e) => setHpDelta((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  placeholder="Δ"
                  size="small"
                  inputProps={{ style: { textAlign: 'center', width: 32, fontFamily: '"JetBrains Mono"', fontSize: '0.78rem', padding: '2px 4px' } }}
                  sx={{ '& .MuiOutlinedInput-root': { height: 24 } }}
                />
                <IconButton size="small"
                  onClick={() => applyHpDelta(p, parseInt(hpDelta[p.id] || '1') || 1)}
                  sx={{ color: '#62a870', width: 24, height: 24 }}>
                  <AddIcon sx={{ fontSize: 12 }} />
                </IconButton>
                <Box sx={{ textAlign: 'right', minWidth: 52 }}>
                  <Typography sx={{ fontSize: '0.78rem', fontFamily: '"JetBrains Mono"', color: hpColor }}>
                    {p.hpCurrent ?? '—'}/{p.hpMax}
                  </Typography>
                  <FavoriteIcon sx={{ fontSize: 8, color: hpColor }} />
                </Box>
              </Box>
            )
          )}
        </Box>

        {/* HP bar */}
        {hpPct != null && (
          <LinearProgress variant="determinate" value={hpPct}
            sx={{ height: 3, borderRadius: 1, mb: 0.75, bgcolor: 'rgba(120,108,92,0.2)',
              '& .MuiLinearProgress-bar': { bgcolor: hpColor, borderRadius: 1 } }} />
        )}

        {/* Attacks — merged from character.attacks (NPC) + character.extra.weapons (player) */}
        {(() => {
          const normalized = normalizeAttacks(p.character)
          const extraActions = (p.character?.extra as Record<string, unknown> | null)?.actions as string[] | undefined
          if (!normalized.length && !extraActions?.length) return null
          return (
          <Box sx={{ mt: 0.75, mb: 0.5 }}>
            {normalized.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: extraActions?.length ? 0.5 : 0 }}>
            {normalized.map((atk, i) => (
                <Box key={i} sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5,
                  px: 1, py: 0.25, borderRadius: 1,
                  bgcolor: 'rgba(120,108,92,0.08)', border: '1px solid rgba(120,108,92,0.15)',
                }}>
                  <Typography sx={{ fontSize: '0.72rem', color: '#b4a48a', fontFamily: '"JetBrains Mono"' }}>
                    {atk.name}
                  </Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: '#786c5c', fontFamily: '"JetBrains Mono"' }}>
                    {atk.bonus >= 0 ? '+' : ''}{atk.bonus}/{atk.damage}
                  </Typography>
                  {atk.notes && (
                    <Typography sx={{ fontSize: '0.6rem', color: '#4a3f2e', fontStyle: 'italic', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {atk.notes}
                    </Typography>
                  )}
                  <Tooltip title={`Roll attack (d20${atk.bonus >= 0 ? '+' : ''}${atk.bonus})`}>
                    <Box
                      onClick={() => triggerRoll('1d20', `${p.name} — ${atk.name} attack`, atk.bonus)}
                      sx={{
                        px: 0.6, py: 0.1, borderRadius: 0.5, cursor: 'pointer',
                        border: '1px solid rgba(200,164,74,0.3)', fontSize: '0.58rem',
                        color: '#c8a44a', fontFamily: '"JetBrains Mono"',
                        '&:hover': { bgcolor: 'rgba(200,164,74,0.1)' },
                      }}
                    >ATK</Box>
                  </Tooltip>
                  {atk.dmgNotation && atk.dmgNotation !== atk.damage && (
                  <Tooltip title={`Roll damage (${atk.damage})`}>
                    <Box
                      onClick={() => triggerRoll(atk.dmgNotation, `${p.name} — ${atk.name} damage`, atk.dmgMod)}
                      sx={{
                        px: 0.6, py: 0.1, borderRadius: 0.5, cursor: 'pointer',
                        border: '1px solid rgba(184,72,72,0.3)', fontSize: '0.58rem',
                        color: '#b84848', fontFamily: '"JetBrains Mono"',
                        '&:hover': { bgcolor: 'rgba(184,72,72,0.1)' },
                      }}
                    >DMG</Box>
                  </Tooltip>
                  )}
                </Box>
            ))}
            </Box>
            )}
            {extraActions && extraActions.length > 0 && (
            <Box sx={{ mt: 0.5 }}>
              <Typography sx={{ fontSize: '0.6rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.25, fontFamily: '"JetBrains Mono"' }}>
                Actions
              </Typography>
              {extraActions.map((action, ai) => (
                <Typography key={ai} sx={{ fontSize: '0.7rem', color: '#786c5c', mb: 0.25, fontStyle: 'italic' }}>
                  {action}
                </Typography>
              ))}
            </Box>
            )}
          </Box>
          )
        })()}

        {/* Spells */}
        {(() => {
          const rawExtra = p.character?.extra
          const extraObj = typeof rawExtra === 'string'
            ? (JSON.parse(rawExtra) as Record<string, unknown>)
            : (rawExtra as Record<string, unknown> | null)
          const spells = extraObj?.spells as SpellEntry[] | undefined
          const spellAtk = extraObj?.spellAttackBonus as string | undefined
          const slots = extraObj?.spellSlots as Record<string, number> | undefined
          const slotsRemaining = extraObj?.spellSlotsRemaining as Record<string, number> | undefined
          const pactLevel = extraObj?.pactMagicLevel as number | undefined
          if (!spells?.length) return null
          const cantrips = spells.filter((s) => s.level === 0)
          const leveled = spells.filter((s) => s.level > 0)
          const slotEntries = slots ? Object.entries(slots).sort(([a], [b]) => Number(a) - Number(b)) : []
          return (
            <Box sx={{ mt: 0.75 }}>
              {/* Header: label + atk bonus + slot tracker */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.4, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: '0.6rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: '"JetBrains Mono"' }}>
                  Spells
                </Typography>
                {spellAtk && (
                  <Tooltip title={`Roll spell attack (d20${spellAtk})`}>
                    <Box onClick={() => { const m = parseInt(spellAtk); triggerRoll('1d20', `${p.name} — Spell Attack`, isNaN(m) ? 0 : m) }}
                      sx={{ px: 0.6, py: 0.1, borderRadius: 0.5, cursor: 'pointer', border: '1px solid rgba(98,168,112,0.3)', fontSize: '0.58rem', color: '#62a870', fontFamily: '"JetBrains Mono"', '&:hover': { bgcolor: 'rgba(98,168,112,0.1)' } }}>
                      {spellAtk} ATK
                    </Box>
                  </Tooltip>
                )}
                {/* Slot dots: ●=remaining ○=used */}
                {slotEntries.map(([lvl, total]) => {
                  const remaining = slotsRemaining?.[lvl] ?? 0
                  const isPact = pactLevel === Number(lvl)
                  return (
                    <Box key={lvl} sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                      <Typography sx={{ fontSize: '0.52rem', color: isPact ? '#c8a44a' : '#786c5c', fontFamily: '"JetBrains Mono"' }}>
                        {isPact ? `P${lvl}` : `L${lvl}`}
                      </Typography>
                      {Array.from({ length: total }).map((_, i) => (
                        <Box key={i} sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: i < remaining ? (isPact ? '#c8a44a' : '#b4a48a') : 'transparent', border: `1px solid ${isPact ? 'rgba(200,164,74,0.5)' : 'rgba(180,164,138,0.4)'}` }} />
                      ))}
                    </Box>
                  )
                })}
              </Box>
              {/* Cantrips */}
              {cantrips.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap', mb: 0.3 }}>
                  {cantrips.map((sp, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.3, px: 0.75, py: 0.15, bgcolor: 'rgba(120,108,92,0.06)', border: '1px solid rgba(120,108,92,0.18)', borderRadius: 0.75 }}>
                      <Tooltip title={[sp.castingTime, sp.range, sp.damageType].filter(Boolean).join(' · ') || sp.name}>
                        <Typography sx={{ fontSize: '0.65rem', color: '#786c5c', fontFamily: '"JetBrains Mono"', cursor: 'default' }}>{sp.name}</Typography>
                      </Tooltip>
                      {sp.damage && (
                        <Tooltip title={`Roll ${sp.name} (${sp.damage}${sp.damageType ? ' ' + sp.damageType : ''})`}>
                          <Box onClick={(e) => openSpellDmg(e, p.name, sp, extraObj)}
                            sx={{ px: 0.5, py: 0.05, borderRadius: 0.4, cursor: 'pointer', border: '1px solid rgba(184,72,72,0.3)', fontSize: '0.55rem', color: '#b84848', fontFamily: '"JetBrains Mono"', '&:hover': { bgcolor: 'rgba(184,72,72,0.1)' } }}>
                            {sp.damage}
                          </Box>
                        </Tooltip>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
              {/* Leveled spells */}
              {leveled.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                  {leveled.map((sp, i) => {
                    // For Warlocks, always show damage at pact level; others show base
                    const effectiveDmg = pactLevel && sp.level > 0 && sp.level <= pactLevel
                      ? computeSpellDamage(sp, pactLevel)
                      : sp.damage
                    const isUpcastable = !pactLevel && !!(sp.upcastDice || sp.canUpcast)
                    const dmgTooltip = pactLevel
                      ? `Roll ${sp.name} at Lv ${pactLevel} (pact magic)`
                      : isUpcastable
                        ? 'Click to choose cast level'
                        : `Roll ${sp.name} (${sp.damage})`
                    return (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.3, px: 0.75, py: 0.15, bgcolor: 'rgba(98,168,112,0.05)', border: `1px solid ${sp.concentration ? 'rgba(98,168,112,0.25)' : 'rgba(120,108,92,0.15)'}`, borderRadius: 0.75 }}>
                      <Tooltip title={[`Lv ${sp.level}`, sp.castingTime, sp.range, sp.damageType, sp.upcastDice ? `+${sp.upcastDice}/lvl` : null, sp.concentration ? 'Conc.' : null].filter(Boolean).join(' · ')}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.2, cursor: 'default' }}>
                          <Typography component="span" sx={{ fontSize: '0.65rem', color: '#b4a48a', fontFamily: '"JetBrains Mono"' }}>{sp.name}</Typography>
                          {sp.concentration && <Typography component="span" sx={{ fontSize: '0.58rem', color: '#62a870' }}>©</Typography>}
                          {isUpcastable && <Typography component="span" sx={{ fontSize: '0.52rem', color: '#c8a44a', ml: 0.2 }}>↑</Typography>}
                        </Box>
                      </Tooltip>
                      {effectiveDmg && (
                        <Tooltip title={dmgTooltip}>
                          <Box onClick={(e) => openSpellDmg(e, p.name, sp, extraObj)}
                            sx={{ px: 0.5, py: 0.05, borderRadius: 0.4, cursor: 'pointer', border: `1px solid ${isUpcastable ? 'rgba(200,164,74,0.4)' : 'rgba(184,72,72,0.3)'}`, fontSize: '0.55rem', color: isUpcastable ? '#c8a44a' : '#b84848', fontFamily: '"JetBrains Mono"', '&:hover': { bgcolor: 'rgba(184,72,72,0.08)' } }}>
                            {effectiveDmg}
                          </Box>
                        </Tooltip>
                      )}
                    </Box>
                    )
                  })}
                </Box>
              )}
            </Box>
          )
        })()}

        {/* Conditions */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
          {p.conditions.map((c) => (
            <Chip key={c} label={c} size="small"
              onDelete={readonly ? undefined : () => toggleCondition(p, c)}
              sx={{ height: 18, fontSize: '0.62rem', bgcolor: '#3a1010', color: '#b84848', '& .MuiChip-deleteIcon': { fontSize: 10, color: '#b84848' } }} />
          ))}
          {!readonly && (
            <Tooltip title="Add condition">
              <Select
                value="" displayEmpty size="small"
                onChange={(e) => e.target.value && toggleCondition(p, e.target.value as string)}
                renderValue={() => '+'}
                sx={{ height: 18, fontSize: '0.62rem', '& .MuiSelect-select': { py: 0, px: 0.5 }, minWidth: 24 }}
              >
                {CONDITIONS.filter((c) => !p.conditions.includes(c)).map((c) => (
                  <MenuItem key={c} value={c} sx={{ fontSize: '0.8rem' }}>{c}</MenuItem>
                ))}
              </Select>
            </Tooltip>
          )}

          {!readonly && (
            <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5 }}>
              <Tooltip title={p.isActive ? 'Mark as defeated' : 'Restore'}>
                <Chip
                  label={p.isActive ? '✓ Active' : '✗ Out'}
                  size="small"
                  onClick={() => handleToggleActive(p)}
                  sx={{ height: 18, fontSize: '0.6rem', cursor: 'pointer',
                    bgcolor: p.isActive ? '#1a2a1a' : '#3a1010',
                    color: p.isActive ? '#62a870' : '#b84848' }}
                />
              </Tooltip>
              <Chip label="✕" size="small"
                onClick={() => removeParticipant({ variables: { id: p.id } })}
                sx={{ height: 18, fontSize: '0.6rem', cursor: 'pointer', bgcolor: '#1a1010', color: '#786c5c', '&:hover': { color: '#b84848' } }} />
            </Box>
          )}
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ pb: { xs: isCompleted ? 0 : '72px', md: 0 }, pt: isMobile ? 1 : 0 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
            <IconButton size="small" onClick={() => navigate('/encounters')} sx={{ color: '#786c5c' }}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <LocalFireDepartmentIcon sx={{ fontSize: 18, color: '#b84848' }} />
            <Typography variant="h4" sx={{ color: '#e6d8c0', fontSize: { xs: '1.15rem', md: undefined } }}>{encounter.name}</Typography>
            {!isCompleted && (
              <Box sx={{ px: 1.5, py: 0.5, borderRadius: 1, bgcolor: isPaused ? '#1a1500' : '#1a0909', border: `1px solid ${isPaused ? 'rgba(200,164,74,0.4)' : 'rgba(180,72,72,0.4)'}` }}>
                <Typography sx={{ fontSize: '0.82rem', fontFamily: '"JetBrains Mono"', color: isPaused ? '#c8a44a' : '#b84848' }}>
                  {isPaused ? '⏸ Paused' : `Round ${encounter.round}`}
                </Typography>
              </Box>
            )}
            {isCompleted && encounter.outcomeType && (
              <Chip label={encounter.outcomeType} size="small"
                sx={{ bgcolor: '#1a2a1a', color: '#62a870', fontFamily: '"JetBrains Mono"' }} />
            )}
          </Box>
          {currentParticipant && !isCompleted && (
            <Typography sx={{ fontSize: '0.82rem', color: '#c8a44a', ml: 5 }}>
              Current turn: <strong>{currentParticipant.name}</strong>
            </Typography>
          )}
        </Box>

        {/* Desktop-only action buttons */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1 }}>
          {!isCompleted && (
            <>
              {!isPaused && (
                <Tooltip title="Previous turn">
                  <IconButton size="small" onClick={() => prevTurn({ variables: { id } })}
                    sx={{ border: '1px solid rgba(120,108,92,0.3)', color: '#786c5c' }}>
                    <SkipPreviousIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {!isPaused && (
                <Button variant="contained" startIcon={<SkipNextIcon />}
                  onClick={() => nextTurn({ variables: { id } })}
                  sx={{ bgcolor: '#b84848', '&:hover': { bgcolor: '#d45f5f' } }}>
                  Next Turn
                </Button>
              )}
              {isInProgress && (
                <Tooltip title="Pause encounter">
                  <IconButton size="small" onClick={() => pauseEncounter({ variables: { id } })}
                    sx={{ border: '1px solid rgba(120,108,92,0.3)', color: '#786c5c' }}>
                    <PauseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {isPaused && (
                <Button variant="outlined" startIcon={<PlayArrowIcon />}
                  onClick={() => resumeEncounter({ variables: { id } })}
                  sx={{ borderColor: 'rgba(200,164,74,0.4)', color: '#c8a44a' }}>
                  Resume
                </Button>
              )}
              <Tooltip title="Log manual roll">
                <IconButton size="small" onClick={() => setRollLogOpen(true)}
                  sx={{ border: '1px solid rgba(120,108,92,0.3)', color: '#786c5c' }}>
                  <EditNoteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Button variant="outlined" startIcon={<PersonAddIcon />}
                onClick={() => setAddOpen(true)}
                sx={{ borderColor: 'rgba(120,108,92,0.4)', color: '#786c5c' }}>
                Add
              </Button>
              <Button variant="outlined" startIcon={<EmojiEventsIcon />}
                onClick={() => setEndOpen(true)}
                sx={{ borderColor: 'rgba(200,164,74,0.3)', color: '#c8a44a' }}>
                End
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* Mobile fixed bottom action bar */}
      {!isCompleted && (
        <Box sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1100,
          bgcolor: '#111009', borderTop: '1px solid rgba(120,108,92,0.3)',
          px: 1.5, py: 1, gap: 1, alignItems: 'center',
        }}>
          {isInProgress && (
            <Tooltip title="Previous turn">
              <IconButton size="small" onClick={() => prevTurn({ variables: { id } })}
                sx={{ border: '1px solid rgba(120,108,92,0.3)', color: '#786c5c', flexShrink: 0 }}>
                <SkipPreviousIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {isInProgress ? (
            <Button variant="contained" startIcon={<SkipNextIcon />}
              onClick={() => nextTurn({ variables: { id } })}
              sx={{ bgcolor: '#b84848', '&:hover': { bgcolor: '#d45f5f' }, flex: 1 }}>
              Next
            </Button>
          ) : isPaused ? (
            <Button variant="outlined" startIcon={<PlayArrowIcon />}
              onClick={() => resumeEncounter({ variables: { id } })}
              sx={{ borderColor: 'rgba(200,164,74,0.4)', color: '#c8a44a', flex: 1 }}>
              Resume
            </Button>
          ) : null}
          {isInProgress && (
            <Tooltip title="Pause">
              <IconButton size="small" onClick={() => pauseEncounter({ variables: { id } })}
                sx={{ border: '1px solid rgba(120,108,92,0.3)', color: '#786c5c', flexShrink: 0 }}>
                <PauseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Log roll">
            <IconButton size="small" onClick={() => setRollLogOpen(true)}
              sx={{ border: '1px solid rgba(120,108,92,0.3)', color: '#786c5c', flexShrink: 0 }}>
              <EditNoteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button variant="outlined" startIcon={<PersonAddIcon />}
            onClick={() => setAddOpen(true)}
            sx={{ borderColor: 'rgba(120,108,92,0.4)', color: '#786c5c', flex: 1 }}>
            Add
          </Button>
          <Button variant="outlined" startIcon={<EmojiEventsIcon />}
            onClick={() => setEndOpen(true)}
            sx={{ borderColor: 'rgba(200,164,74,0.3)', color: '#c8a44a', flex: 1 }}>
            End
          </Button>
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        {encounter.linkedDecision && (
          <Box sx={{ p: 1.25, bgcolor: '#111009', borderRadius: 1, border: '1px solid rgba(200,164,74,0.2)' }}>
            <Typography sx={{ fontSize: '0.75rem', color: '#786c5c' }}>
              Triggered by: <span style={{ color: '#c8a44a' }}>{encounter.linkedDecision.question}</span>
            </Typography>
          </Box>
        )}
        {encounter.outcomeDecision && (
          <Box sx={{ p: 1.25, bgcolor: '#111009', borderRadius: 1, border: '1px solid rgba(98,168,112,0.2)', display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <GpsFixedIcon sx={{ fontSize: 12, color: '#62a870' }} />
            <Typography sx={{ fontSize: '0.75rem', color: '#786c5c' }}>
              Leads to: <span style={{ color: '#62a870' }}>{encounter.outcomeDecision.question}</span>
            </Typography>
          </Box>
        )}
      </Box>

      {isCompleted && (
        <Box sx={{ mb: 2.5, p: 2, bgcolor: '#0d160d', borderRadius: 1, border: '1px solid rgba(98,168,112,0.25)' }}>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: encounter.outcome ? 1.5 : 0 }}>
            {encounter.outcomeType && (() => {
              const outcomeColor: Record<string, string> = { WIN: '#62a870', LOSS: '#b84848', FLEE: '#c8a44a', DRAW: '#786c5c' }
              const col = outcomeColor[encounter.outcomeType] ?? '#786c5c'
              return (
                <Box>
                  <Typography sx={{ fontSize: '0.6rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 0.5 }}>Outcome</Typography>
                  <Typography sx={{ fontSize: '1rem', fontFamily: '"JetBrains Mono"', color: col, fontWeight: 700 }}>{encounter.outcomeType}</Typography>
                </Box>
              )
            })()}
            <Box>
              <Typography sx={{ fontSize: '0.6rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 0.5 }}>Rounds</Typography>
              <Typography sx={{ fontSize: '1rem', fontFamily: '"JetBrains Mono"', color: '#c8a44a', fontWeight: 700 }}>{encounter.round}</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.6rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 0.5 }}>Combatants</Typography>
              <Typography sx={{ fontSize: '1rem', fontFamily: '"JetBrains Mono"', color: '#b4a48a', fontWeight: 700 }}>{encounter.participants.length}</Typography>
            </Box>
            {encounter.elapsedSeconds > 0 && (() => {
              const secs = encounter.elapsedSeconds
              const mins = Math.floor(secs / 60)
              const s = secs % 60
              return (
                <Box>
                  <Typography sx={{ fontSize: '0.6rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 0.5 }}>Duration</Typography>
                  <Typography sx={{ fontSize: '1rem', fontFamily: '"JetBrains Mono"', color: '#b4a48a', fontWeight: 700 }}>
                    {mins > 0 ? `${mins}m ${s}s` : `${s}s`}
                  </Typography>
                </Box>
              )
            })()}
          </Box>
          {encounter.outcome && (
            <Typography sx={{ fontSize: '0.82rem', color: '#b4a48a', fontStyle: 'italic' }}>{encounter.outcome}</Typography>
          )}
        </Box>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          {activeParticipants.map((p, i) => (
            <ParticipantRow key={p.id} p={p} isCurrent={i === encounter.currentTurnIndex && !isCompleted} readonly={isCompleted} />
          ))}

          {inactiveParticipants.length > 0 && (
            <>
              <Divider sx={{ my: 1.5 }}><Typography sx={{ fontSize: '0.7rem', color: '#786c5c' }}>OUT OF COMBAT</Typography></Divider>
              {inactiveParticipants.map((p) => <ParticipantRow key={p.id} p={p} isCurrent={false} readonly={isCompleted} />)}
            </>
          )}

          {encounter.participants.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography sx={{ color: '#786c5c' }}>No participants yet.</Typography>
              <Button size="small" startIcon={<PersonAddIcon />} onClick={() => setAddOpen(true)} sx={{ mt: 1, color: '#c8a44a' }}>
                Add First Combatant
              </Button>
            </Box>
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          <Box sx={{ p: 1.5, bgcolor: '#111009', borderRadius: 1, border: '1px solid rgba(120,108,92,0.2)' }}>
            <Typography sx={{ fontSize: '0.72rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 1, mb: 1 }}>
              Initiative Order
            </Typography>
            {activeParticipants.map((p, i) => (
              <Box key={p.id} sx={{
                display: 'flex', alignItems: 'center', gap: 1, py: 0.4,
                borderLeft: i === encounter.currentTurnIndex && !isCompleted ? '2px solid #c8a44a' : '2px solid transparent',
                pl: 1,
              }}>
                <Typography sx={{ fontSize: '0.72rem', fontFamily: '"JetBrains Mono"', color: '#786c5c', minWidth: 20 }}>
                  {p.initiative}
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: i === encounter.currentTurnIndex && !isCompleted ? '#c8a44a' : '#b4a48a' }}>
                  {p.name}
                </Typography>
                {p.hpMax != null && (
                  <Typography sx={{ ml: 'auto', fontSize: '0.68rem', fontFamily: '"JetBrains Mono"', color: '#786c5c' }}>
                    {p.hpCurrent}/{p.hpMax}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </Grid>
      </Grid>

      {/* Add Participant Dialog */}
      <Dialog open={addOpen} onClose={() => { setAddOpen(false); resetAddForm() }} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: '#0f0d0a' } }}>
        <DialogTitle sx={{ color: '#e6d8c0', fontFamily: '"Cinzel", serif', fontSize: '0.95rem' }}>Add Combatant</DialogTitle>
        <DialogContent>
          <Grid container spacing={1.5} sx={{ mt: 0 }}>

            {/* Existing character picker */}
            <Grid item xs={12}>
              <Autocomplete
                options={campaignChars}
                getOptionLabel={(c) => `${c.name} (${c.role})`}
                value={selectedChar}
                onChange={(_, c) => {
                  setSelectedChar(c)
                  if (c) {
                    setNewName(c.name)
                    setNewRole(c.role.toLowerCase())
                    setNewHpMax(c.hpMax != null ? String(c.hpMax) : '')
                    setNewHpCurrent(c.hpCurrent != null ? String(c.hpCurrent) : '')
                    setNewAc(c.armorClass != null ? String(c.armorClass) : '')
                  }
                }}
                renderOption={(props, c) => (
                  <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: '6px !important' }}>
                    {c.portraitUrl
                      ? <Box component="img" src={c.portraitUrl} alt="" sx={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(120,108,92,0.3)' }} />
                      : <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: '#1a160f', border: '1px solid rgba(120,108,92,0.2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Typography sx={{ fontSize: '0.65rem', color: '#786c5c' }}>{c.name[0]}</Typography>
                        </Box>
                    }
                    <Box>
                      <Typography sx={{ fontSize: '0.85rem', color: '#e6d8c0' }}>{c.name}</Typography>
                      <Typography sx={{ fontSize: '0.68rem', color: '#786c5c', textTransform: 'capitalize' }}>{c.role.toLowerCase()}</Typography>
                    </Box>
                  </Box>
                )}
                renderInput={(params) => <TextField {...params} label="Pick existing character (optional)" size="small" />}
                clearOnEscape
              />
            </Grid>

            {/* Role */}
            <Grid item xs={12}>
              <FormControl size="small" fullWidth>
                <InputLabel>Role</InputLabel>
                <Select label="Role" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                  <MenuItem value="monster">Monster</MenuItem>
                  <MenuItem value="player">Player Character</MenuItem>
                  <MenuItem value="npc">NPC</MenuItem>
                  <MenuItem value="ally">Ally</MenuItem>
                  <MenuItem value="villain">Villain</MenuItem>
                  <MenuItem value="neutral">Neutral</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Name + Count (count only for monsters) */}
            <Grid item xs={newRole === 'monster' ? 8 : 12}>
              <TextField label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} fullWidth size="small" />
            </Grid>
            {newRole === 'monster' && (
              <Grid item xs={4}>
                <TextField label="Count" type="number" value={newCount}
                  onChange={(e) => setNewCount(e.target.value)}
                  fullWidth size="small"
                  inputProps={{ min: 1, max: 20 }} />
              </Grid>
            )}

            <Grid item xs={6}>
              <TextField
                label="Initiative" type="number" value={newInit}
                onChange={(e) => setNewInit(e.target.value)}
                fullWidth size="small"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={(() => {
                        const dexMod = selectedChar?.stats?.DEX != null
                          ? Math.floor((selectedChar.stats.DEX - 10) / 2)
                          : selectedChar?.stats?.dex != null
                            ? Math.floor((selectedChar.stats.dex - 10) / 2)
                            : null
                        const initMod = selectedChar?.initiative ?? dexMod
                        return initMod != null ? `Roll d20 + ${initMod >= 0 ? '+' : ''}${initMod}` : 'Roll d20 for initiative'
                      })()}>
                        <IconButton size="small"
                          sx={{ color: '#786c5c', '&:hover': { color: '#c8a44a' }, p: 0.25 }}
                          onClick={() => {
                            const dexVal = selectedChar?.stats?.DEX ?? selectedChar?.stats?.dex
                            const dexMod = dexVal != null ? Math.floor((Number(dexVal) - 10) / 2) : 0
                            const initMod = selectedChar?.initiative ?? dexMod
                            const label = selectedChar
                              ? `${selectedChar.name} — Initiative`
                              : `${newName || 'Initiative'} — Initiative`
                            triggerAutoRoll('1d20', label, initMod, (total) => setNewInit(String(total)))
                          }}>
                          <CasinoIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField label="AC" type="number" value={newAc} onChange={(e) => setNewAc(e.target.value)} fullWidth size="small" />
            </Grid>
            <Grid item xs={6}>
              <TextField label="HP Max" type="number" value={newHpMax} onChange={(e) => setNewHpMax(e.target.value)} fullWidth size="small" />
            </Grid>
            <Grid item xs={6}>
              <TextField label="HP Current" type="number" value={newHpCurrent} onChange={(e) => setNewHpCurrent(e.target.value)} fullWidth size="small" placeholder="= HP Max" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => { setAddOpen(false); resetAddForm() }} sx={{ color: '#786c5c' }}>Cancel</Button>
          <Button onClick={handleAddParticipant} disabled={!newName || addingP} variant="contained" size="small">
            {newRole === 'monster' && parseInt(newCount) > 1 ? `Add ${newCount}` : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Kill Tracking Dialog */}
      <Dialog open={killDialogOpen} onClose={() => setKillDialogOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: '#0f0d0a', border: '1px solid rgba(184,72,72,0.3)' } }}>
        <DialogTitle sx={{ color: '#e6d8c0', fontFamily: '"Cinzel", serif', fontSize: '0.95rem', pb: 0.5 }}>
          {killedParticipant?.name} falls
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.8rem', color: '#786c5c', mb: 2, fontStyle: 'italic' }}>
            Record who delivered the killing blow and how it happened.
          </Typography>
          <Grid container spacing={1.5}>
            <Grid item xs={12}>
              <Typography sx={{ fontSize: '0.62rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: '"JetBrains Mono"', mb: 0.75 }}>
                Slain by
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.25 }}>
                {(encounter.participants as Participant[])
                  .filter((p) => p.id !== killedParticipant?.id)
                  .map((p) => {
                    const selected = killedByName === p.name
                    return (
                      <Box
                        key={p.id}
                        onClick={() => setKilledByName(selected ? '' : p.name)}
                        sx={{
                          px: 1.25, py: 0.5, borderRadius: 1, cursor: 'pointer',
                          border: selected ? '1px solid rgba(184,72,72,0.7)' : '1px solid rgba(120,108,92,0.25)',
                          bgcolor: selected ? 'rgba(184,72,72,0.15)' : 'rgba(120,108,92,0.06)',
                          '&:hover': { borderColor: 'rgba(184,72,72,0.4)', bgcolor: 'rgba(184,72,72,0.08)' },
                          transition: 'all 0.12s',
                        }}
                      >
                        <Typography sx={{
                          fontSize: '0.78rem', fontFamily: '"Cinzel", serif',
                          color: selected ? '#e6a8a8' : '#b4a48a',
                        }}>
                          {p.name}
                        </Typography>
                        {p.isPlayer && (
                          <Typography sx={{ fontSize: '0.58rem', color: '#786c5c', fontFamily: '"JetBrains Mono"' }}>player</Typography>
                        )}
                      </Box>
                    )
                  })}
              </Box>
              <TextField
                label="Or type a name"
                value={killedByName}
                onChange={(e) => setKilledByName(e.target.value)}
                fullWidth size="small"
                placeholder="e.g. Thorin Stormhammer"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="How it happened"
                value={killedDescription}
                onChange={(e) => setKilledDescription(e.target.value)}
                fullWidth size="small" multiline rows={3}
                placeholder="e.g. A critical strike through the visor as it charged..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setKillDialogOpen(false)} sx={{ color: '#786c5c' }}>Cancel</Button>
          <Button
            onClick={confirmKill}
            variant="contained" size="small"
            sx={{ bgcolor: '#b84848', '&:hover': { bgcolor: '#d45f5f' } }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* End Encounter Dialog */}
      <Dialog open={endOpen} onClose={() => setEndOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: '#0f0d0a' } }}>
        <DialogTitle sx={{ color: '#e6d8c0', fontFamily: '"Cinzel", serif', fontSize: '0.95rem' }}>End Encounter</DialogTitle>
        <DialogContent>
          <Grid container spacing={1.5} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <FormControl size="small" fullWidth>
                <Select value={outcomeType} onChange={(e) => setOutcomeType(e.target.value)}>
                  <MenuItem value="WIN">Victory</MenuItem>
                  <MenuItem value="LOSS">Defeat</MenuItem>
                  <MenuItem value="FLEE">Fled / Retreated</MenuItem>
                  <MenuItem value="DRAW">Draw / Standoff</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField label="Outcome notes" value={outcomeText} onChange={(e) => setOutcomeText(e.target.value)}
                fullWidth size="small" multiline rows={2} placeholder="What happened?" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setEndOpen(false)} sx={{ color: '#786c5c' }}>Cancel</Button>
          <Button onClick={() => handleEndEncounter({ id: id!, outcomeType, outcome: outcomeText || undefined })}
            disabled={ending} variant="contained" size="small"
            sx={{ bgcolor: '#c8a44a', '&:hover': { bgcolor: '#e6c86a' } }}>
            End Encounter
          </Button>
        </DialogActions>
      </Dialog>

      {/* Spell cast level picker */}
      <Popover
        open={!!spellCast}
        anchorReference="anchorPosition"
        anchorPosition={spellCast?.pos}
        onClose={() => setSpellCast(null)}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { bgcolor: '#1a1612', border: '1px solid rgba(120,108,92,0.4)', p: 1 } }}
      >
        {spellCast && (
          <Box>
            <Typography sx={{ fontSize: '0.7rem', color: '#786c5c', mb: 0.75, fontFamily: '"JetBrains Mono"' }}>
              Cast {spellCast.spell.name} at level:
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {spellCast.availableLevels.map((lvl) => (
                <Box
                  key={lvl}
                  onClick={() => rollSpell(spellCast.pName, spellCast.spell, lvl)}
                  sx={{
                    px: 1, py: 0.4, borderRadius: 0.75, cursor: 'pointer',
                    border: `1px solid ${lvl === spellCast.spell.level ? 'rgba(200,164,74,0.5)' : 'rgba(98,168,112,0.4)'}`,
                    color: lvl === spellCast.spell.level ? '#c8a44a' : '#62a870',
                    fontSize: '0.75rem', fontFamily: '"JetBrains Mono"',
                    '&:hover': { bgcolor: 'rgba(200,164,74,0.1)' },
                  }}
                >
                  {lvl === 0 ? 'Cantrip' : `Lv ${lvl}`}
                  {spellCast.spell.upcastDice && lvl > spellCast.spell.level && (
                    <Typography component="span" sx={{ fontSize: '0.6rem', color: '#786c5c', ml: 0.4 }}>
                      {computeSpellDamage(spellCast.spell, lvl)}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Popover>

      {/* Manual Roll Log Dialog */}
      <Dialog open={rollLogOpen} onClose={() => setRollLogOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: '#0f0d0a' } }}>
        <DialogTitle sx={{ color: '#e6d8c0', fontFamily: '"Cinzel", serif', fontSize: '0.95rem', pb: 0.5 }}>
          Log Physical Roll
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={1.5} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <Autocomplete
                freeSolo
                options={[
                  `${user?.name ?? 'DM'} (DM)`,
                  ...encounter.participants.map((p: Participant) => p.name),
                ]}
                value={rlCharacter}
                onInputChange={(_, v) => setRlCharacter(v)}
                renderInput={(params) => <TextField {...params} label="Character / Player" size="small" />}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Label (e.g. Attack, Perception)" value={rlLabel}
                onChange={(e) => setRlLabel(e.target.value)} fullWidth size="small" />
            </Grid>
            <Grid item xs={5}>
              <FormControl size="small" fullWidth>
                <InputLabel>Die</InputLabel>
                <Select label="Die" value={rlDiceType} onChange={(e) => setRlDiceType(e.target.value)}>
                  {['d4','d6','d8','d10','d12','d20','d100'].map((d) => (
                    <MenuItem key={d} value={d}>{d}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={3.5}>
              <TextField label="Modifier" type="number" value={rlModifier}
                onChange={(e) => setRlModifier(e.target.value)} fullWidth size="small" />
            </Grid>
            <Grid item xs={3.5}>
              <TextField label="Total" type="number" value={rlResult}
                onChange={(e) => setRlResult(e.target.value)} fullWidth size="small" autoFocus />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setRollLogOpen(false)} sx={{ color: '#786c5c' }}>Cancel</Button>
          <Button onClick={handleLogManualRoll} variant="contained" size="small" disabled={!rlCharacter || !rlResult}>
            Log Roll
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
