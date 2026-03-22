import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, gql } from '@apollo/client'
import {
  Box, Typography, Chip, CircularProgress,
  Alert, Button, Accordion, AccordionSummary, AccordionDetails, Tooltip,
  Table, TableBody, TableRow, TableCell, Divider, IconButton,
  useTheme,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import PrintIcon from '@mui/icons-material/Print'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import StatusBadge from '../components/StatusBadge'
import HPTracker from '../components/HPTracker'
import CharacterFormDialog from '../components/CharacterFormDialog'
import PlayerFormDialog from '../components/PlayerFormDialog'
import type { PlayerFormValues, PlayerFormWeapon, PlayerFormEquipItem } from '../components/PlayerFormDialog'
import ConfirmDeleteDialog from '../components/ConfirmDeleteDialog'
import { useDiceStore } from '../store/dice'

const CHARACTER = gql`
  query CharacterDetail($id: ID!) {
    character(id: $id) {
      id name role description location status portraitUrl
      hpMax hpCurrent armorClass speed initiative
      stats attacks specialAbilities
      corruptionStage corruptionMax narrativeNotes
      miniPrinted miniStlSource miniSearchHint tags extra
      chapterIntroduced { id name }
      heldItems { id name type description }
      decisionStates {
        id stateLabel description
        branch { id label decision { id question } }
      }
    }
  }
`

const UPDATE_HP = gql`
  mutation UpdateHP($id: ID!, $hpCurrent: Int!) {
    updateCharacterHP(id: $id, hpCurrent: $hpCurrent) { id hpCurrent }
  }
`

const DELETE_CHARACTER = gql`
  mutation DeleteCharacter($id: ID!) {
    deleteCharacter(id: $id)
  }
`

const UPDATE_CHARACTER = gql`
  mutation UpdateCharacterDetail($id: ID!, $input: UpdateCharacterInput!) {
    updateCharacter(id: $id, input: $input) { id name }
  }
`

function modStr(score: number | string): string {
  const n = typeof score === 'string' ? parseInt(score) : score
  if (isNaN(n)) return ''
  const m = Math.floor((n - 10) / 2)
  return m >= 0 ? `+${m}` : `${m}`
}

function SheetSection({ title, children, defaultExpanded = false }: {
  title: string; children: React.ReactNode; defaultExpanded?: boolean
}) {
  return (
    <Accordion disableGutters defaultExpanded={defaultExpanded}
      sx={{ bgcolor: '#111009', border: '1px solid rgba(120,108,92,0.2)', '&:before': { display: 'none' }, mb: 0.5 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 16, color: '#786c5c' }} />}
        sx={{ minHeight: 36, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
        <Typography sx={{ fontSize: '0.72rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: '"JetBrains Mono"' }}>
          {title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0, pb: 1.5 }}>{children}</AccordionDetails>
    </Accordion>
  )
}

const STAT_LABELS: Record<string, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
  STR: 'STR', DEX: 'DEX', CON: 'CON', INT: 'INT', WIS: 'WIS', CHA: 'CHA',
}
const STAT_ORDER = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']

export default function CharacterDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data, loading, error, refetch } = useQuery(CHARACTER, { variables: { id }, skip: !id })
  const [updateHP] = useMutation(UPDATE_HP)
  const [updateCharacter] = useMutation(UPDATE_CHARACTER)
  const [deleteCharacter, { loading: deleting }] = useMutation(DELETE_CHARACTER)
  const { triggerRoll } = useDiceStore()

  const theme = useTheme()
  const isMobile = theme.breakpoints.down('md')

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress sx={{ color: '#c8a44a' }} /></Box>
  if (error) return <Alert severity="error">{error.message}</Alert>

  const c = data?.character
  if (!c) return null

  const stats = c.stats as Record<string, number> | null
  const attacks = (c.attacks as Array<{ name: string; bonus: number; damage: string }>) ?? []
  const abilities = (c.specialAbilities as Array<{ name: string; description: string }>) ?? []

  const handleDelete = async () => {
    await deleteCharacter({ variables: { id: c.id } })
    navigate('/characters')
  }

  const isPlayer = c.role === 'PLAYER'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ex = (c.extra ?? {}) as Record<string, any>

  // Build initial values for PlayerFormDialog from character.extra (same structure Players.tsx writes)
  const playerInitial: Partial<PlayerFormValues> = isPlayer ? {
    name: c.name,
    playerName: ex.playerName ?? '',
    race: ex.race ?? '',
    class: ex.class ?? '',
    level: ex.level != null ? String(ex.level) : '',
    background: ex.background ?? '',
    alignment: ex.alignment ?? '',
    description: c.description ?? '',
    hitDice: ex.hitDice ?? '',
    hpMax: c.hpMax != null ? String(c.hpMax) : '',
    armorClass: c.armorClass != null ? String(c.armorClass) : '',
    speed: ex.speed ?? (c.speed != null ? String(c.speed) : ''),
    initiative: ex.initiative ?? '',
    proficiencyBonus: ex.proficiencyBonus ?? '',
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
    savingThrows: ex.savingThrows ?? {},
    skills: ex.skills ?? {},
    weapons: ex.weapons ? (ex.weapons as Array<Record<string, string>>).map((w) => ({
      name: w.name ?? '', attackBonus: w.attackBonus ?? '', damage: w.damage ?? '', notes: w.notes ?? '',
    })) : [],
    equipment: ex.equipment ? (ex.equipment as Array<Record<string, string>>).map((e) => ({
      name: e.name ?? '', qty: e.qty ?? '',
    })) : [],
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
    const scores = {
      strength: parseInt(v.strength) || undefined,
      dexterity: parseInt(v.dexterity) || undefined,
      constitution: parseInt(v.constitution) || undefined,
      intelligence: parseInt(v.intelligence) || undefined,
      wisdom: parseInt(v.wisdom) || undefined,
      charisma: parseInt(v.charisma) || undefined,
    }
    const statsMap: Record<string, number> = {}
    if (scores.strength) statsMap.STR = scores.strength
    if (scores.dexterity) statsMap.DEX = scores.dexterity
    if (scores.constitution) statsMap.CON = scores.constitution
    if (scores.intelligence) statsMap.INT = scores.intelligence
    if (scores.wisdom) statsMap.WIS = scores.wisdom
    if (scores.charisma) statsMap.CHA = scores.charisma

    const weapons = (v.weapons as PlayerFormWeapon[]).filter((w) => w.name.trim()).map((w) => ({
      name: w.name, attackBonus: w.attackBonus || undefined,
      damage: w.damage || undefined, notes: w.notes || undefined,
    }))
    const equipment = (v.equipment as PlayerFormEquipItem[]).filter((e) => e.name.trim()).map((e) => ({
      name: e.name, qty: e.qty || undefined,
    }))
    const cp = parseInt(v.currencyCp) || undefined
    const sp = parseInt(v.currencySp) || undefined
    const ep = parseInt(v.currencyEp) || undefined
    const gp = parseInt(v.currencyGp) || undefined
    const pp = parseInt(v.currencyPp) || undefined
    const currency = [cp, sp, ep, gp, pp].some((x) => x != null) ? { cp, sp, ep, gp, pp } : undefined

    const savingThrows = Object.fromEntries(Object.entries(v.savingThrows).filter(([, val]) => val.trim()))
    const skills = Object.fromEntries(Object.entries(v.skills).filter(([, val]) => val.trim()))

    const newExtra = {
      ...ex, // preserve importType, sheetUrl, lastSynced etc.
      name: v.name || undefined,
      playerName: v.playerName || undefined,
      race: v.race || undefined, class: v.class || undefined,
      level: parseInt(v.level) || undefined,
      background: v.background || undefined, alignment: v.alignment || undefined,
      hpMax: parseInt(v.hpMax) || undefined, armorClass: parseInt(v.armorClass) || undefined,
      speed: v.speed || undefined, initiative: v.initiative || undefined,
      hitDice: v.hitDice || undefined, proficiencyBonus: v.proficiencyBonus || undefined,
      spellSaveDC: v.spellSaveDC || undefined,
      passivePerception: v.passivePerception ? parseInt(v.passivePerception) : undefined,
      gender: v.gender || undefined, age: v.age || undefined, height: v.height || undefined,
      weight: v.weight || undefined, eyes: v.eyes || undefined, hair: v.hair || undefined, skin: v.skin || undefined,
      weapons: weapons.length ? weapons : undefined,
      equipment: equipment.length ? equipment : undefined,
      currency,
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
    }

    await updateCharacter({
      variables: {
        id: c.id,
        input: {
          name: v.name,
          description: v.description || undefined,
          hpMax: parseInt(v.hpMax) || undefined,
          hpCurrent: parseInt(v.hpMax) || undefined,
          armorClass: parseInt(v.armorClass) || undefined,
          speed: v.speed ? parseInt(v.speed) || undefined : undefined,
          stats: Object.keys(statsMap).length ? statsMap : undefined,
          extra: newExtra,
        },
      },
    })
    setFormOpen(false)
    refetch()
  }

  const combatStats = [
    { label: 'HP', value: c.hpMax != null ? `${c.hpCurrent ?? c.hpMax}/${c.hpMax}` : null, color: '#62a870' },
    { label: 'AC', value: c.armorClass, color: '#c8a44a' },
    { label: 'Speed', value: c.speed ? `${c.speed} ft.` : (ex.speed ? `${ex.speed}` : null) },
    { label: 'Initiative', value: c.initiative != null ? (c.initiative >= 0 ? `+${c.initiative}` : `${c.initiative}`) : (ex.initiative || null) },
    ...(isPlayer ? [
      { label: 'Hit Dice', value: ex.hitDice || null },
      { label: 'Prof.', value: ex.proficiencyBonus || null },
      { label: 'Spell DC', value: ex.spellSaveDC || null },
      { label: 'Pass. Perc.', value: ex.passivePerception != null ? String(ex.passivePerception) : null },
    ] : []),
  ].filter((s) => s.value != null)

  return (
    <Box sx={{ maxWidth: 860, mx: 'auto', pt: isMobile ? 1 : 0 }}>
      {/* Top nav */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/characters')}
          sx={{ color: '#786c5c', fontSize: '0.85rem' }}>
          Characters
        </Button>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton size="small" onClick={() => setFormOpen(true)} sx={{ color: '#786c5c', '&:hover': { color: '#c8a44a' } }}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => setDeleteOpen(true)} sx={{ color: '#786c5c', '&:hover': { color: '#b84848' } }}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Header card */}
      <Box sx={{ bgcolor: '#111009', border: '1px solid rgba(120,108,92,0.25)', borderRadius: 1.5, p: 2, mb: 1.5 }}>
        {/* Portrait + Name row */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 0.5 }}>
          {c.portraitUrl && (
            <Box component="img" src={c.portraitUrl} alt={c.name}
              sx={{ width: 56, height: 56, borderRadius: 1, objectFit: 'cover', objectPosition: 'top', flexShrink: 0, border: '1px solid rgba(120,108,92,0.3)' }} />
          )}
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.25 }}>
              <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '1.25rem', color: '#e6d8c0' }}>{c.name}</Typography>
              <StatusBadge status={c.role} />
              <StatusBadge status={c.status} />
            </Box>
            {/* Player subtitle: race · class · level · background */}
            {isPlayer && (ex.race || ex.class || ex.level || ex.background) && (
              <Typography sx={{ fontSize: '0.72rem', color: '#786c5c', mb: 0.25 }}>
                {[ex.race, ex.class, ex.background].filter(Boolean).join(' · ')}
                {ex.level && <> &nbsp;·&nbsp; <Typography component="span" sx={{ color: '#c8a44a', fontSize: '0.72rem' }}>Lv.{ex.level}</Typography></>}
              </Typography>
            )}
            {isPlayer && ex.playerName && (
              <Typography sx={{ fontSize: '0.68rem', color: '#786c5c' }}>Player: {ex.playerName}</Typography>
            )}
          </Box>
        </Box>

        {/* Location */}
        {c.location && (
          <Typography sx={{ fontSize: '0.7rem', color: '#786c5c', mb: 0.5 }}>{c.location}</Typography>
        )}

        {/* Tags row */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
          {c.chapterIntroduced && (
            <Chip label={`Intro: ${c.chapterIntroduced.name}`} size="small"
              sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#1a160f', color: '#786c5c' }} />
          )}
          {c.miniPrinted && (
            <Chip icon={<PrintIcon style={{ fontSize: 11 }} />} label="Mini printed" size="small"
              sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#1a3d1a', color: '#62a870' }} />
          )}
          {c.tags?.map((tag: string) => (
            <Chip key={tag} label={tag} size="small"
              sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#1a160f', color: '#786c5c' }} />
          ))}
        </Box>
      </Box>

      {/* Combat stats bar */}
      {combatStats.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          {combatStats.map((s) => (
            <Box key={s.label} sx={{ textAlign: 'center', px: 1.5, py: 0.75, bgcolor: '#111009', borderRadius: 1, border: '1px solid rgba(120,108,92,0.2)', flex: '1 1 auto', minWidth: 60 }}>
              <Typography sx={{ fontSize: '0.58rem', color: '#786c5c', fontFamily: '"JetBrains Mono"', textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</Typography>
              <Typography sx={{ fontSize: '1rem', color: s.color ?? '#e6d8c0', fontWeight: 700, fontFamily: '"JetBrains Mono"', lineHeight: 1.3 }}>{s.value}</Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* HP Tracker (separate, interactive) */}
      {c.hpMax && (
        <Box sx={{ bgcolor: '#111009', border: '1px solid rgba(120,108,92,0.2)', borderRadius: 1, p: 1.5, mb: 1.5 }}>
          <Typography sx={{ fontSize: '0.6rem', color: '#786c5c', fontFamily: '"JetBrains Mono"', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.75 }}>Hit Points</Typography>
          <HPTracker
            characterId={c.id}
            current={c.hpCurrent ?? 0}
            max={c.hpMax}
            onChange={(hp) => updateHP({ variables: { id: c.id, hpCurrent: hp } })}
          />
        </Box>
      )}

      {/* Ability scores */}
      {stats && Object.keys(stats).length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          {(STAT_ORDER.flatMap((k) => {
            const val = stats[k] ?? stats[k.toLowerCase()]
            return val != null ? [[k, val] as [string, number]] : []
          })).map(([key, val]) => {
            const label = STAT_LABELS[key] ?? key.toUpperCase()
            const mod = Math.floor((Number(val) - 10) / 2)
            return (
              <Tooltip key={key} title={`Roll d20 + ${mod >= 0 ? '+' : ''}${mod}`}>
                <Box
                  onClick={() => triggerRoll('1d20', `${c.name} — ${label} check`, mod)}
                  sx={{
                    flex: '1 1 calc(16.66% - 8px)', minWidth: 60, textAlign: 'center',
                    py: 1, bgcolor: '#111009', borderRadius: 1,
                    border: '1px solid rgba(120,108,92,0.2)', cursor: 'pointer',
                    transition: 'all 0.15s',
                    '&:hover': { bgcolor: 'rgba(200,164,74,0.07)', borderColor: 'rgba(200,164,74,0.4)' },
                  }}
                >
                  <Typography sx={{ fontSize: '0.58rem', color: '#786c5c', fontFamily: '"JetBrains Mono"' }}>{label}</Typography>
                  <Typography sx={{ fontSize: '1.2rem', color: '#e6d8c0', fontWeight: 700, fontFamily: '"JetBrains Mono"', lineHeight: 1.2 }}>{val}</Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: '#c8a44a', fontFamily: '"JetBrains Mono"' }}>{mod >= 0 ? '+' : ''}{mod}</Typography>
                </Box>
              </Tooltip>
            )
          })}
        </Box>
      )}

      <Divider sx={{ mb: 1.5, borderColor: 'rgba(120,108,92,0.2)' }} />

      {/* Description */}
      {c.description && (
        <SheetSection title="Description" defaultExpanded>
          <Typography sx={{ fontSize: '0.8rem', color: '#b4a48a', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
            {c.description}
          </Typography>
        </SheetSection>
      )}

      {/* ── PLAYER-SPECIFIC SECTIONS ── */}

      {/* Saving Throws */}
      {isPlayer && ex.savingThrows && Object.keys(ex.savingThrows).length > 0 && (
        <SheetSection title="Saving Throws">
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {Object.entries(ex.savingThrows as Record<string, string>).map(([stat, val]) => {
              const mod = parseInt(val)
              return (
                <Tooltip key={stat} title={`Roll ${stat} save`}>
                  <Box onClick={() => triggerRoll('1d20', `${c.name} — ${stat} save`, isNaN(mod) ? 0 : mod)}
                    sx={{ display: 'flex', gap: 0.5, alignItems: 'center', px: 1, py: 0.25, bgcolor: '#0b0906', borderRadius: 1, border: '1px solid rgba(120,108,92,0.2)', cursor: 'pointer', '&:hover': { borderColor: 'rgba(200,164,74,0.4)' } }}>
                    <Typography sx={{ fontSize: '0.65rem', color: '#786c5c' }}>{stat}</Typography>
                    <Typography sx={{ fontSize: '0.78rem', color: '#c8a44a', fontFamily: '"JetBrains Mono"', fontWeight: 700 }}>{val}</Typography>
                  </Box>
                </Tooltip>
              )
            })}
          </Box>
        </SheetSection>
      )}

      {/* Skills */}
      {isPlayer && ex.skills && Object.keys(ex.skills).length > 0 && (
        <SheetSection title="Skills">
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {Object.entries(ex.skills as Record<string, string>).map(([skill, val]) => {
              const mod = parseInt(val)
              return (
                <Tooltip key={skill} title={`Roll ${skill}`}>
                  <Box onClick={() => triggerRoll('1d20', `${c.name} — ${skill}`, isNaN(mod) ? 0 : mod)}
                    sx={{ display: 'flex', gap: 0.5, alignItems: 'center', px: 0.75, py: 0.2, bgcolor: '#0b0906', borderRadius: 1, border: '1px solid rgba(120,108,92,0.15)', cursor: 'pointer', '&:hover': { borderColor: 'rgba(200,164,74,0.35)' } }}>
                    <Typography sx={{ fontSize: '0.63rem', color: '#786c5c' }}>{skill}</Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: '#b4a48a', fontFamily: '"JetBrains Mono"' }}>{val}</Typography>
                  </Box>
                </Tooltip>
              )
            })}
          </Box>
        </SheetSection>
      )}

      {/* Weapons / Attacks — merged from character.attacks (NPC) and extra.weapons (player) */}
      {(() => {
        const stripType = (s: string) => s.replace(/\s+[A-Za-z].*$/, '').trim()
        const parseDmg = (dmgStr: string) => {
          const s = stripType(dmgStr)
          const m = s.match(/(\d+d\d+)([+-]\d+)?/)
          if (m) return { dmgNotation: m[1], dmgMod: m[2] ? parseInt(m[2]) : 0 }
          const flat = parseInt(s)
          return isNaN(flat) ? { dmgNotation: '1d6', dmgMod: 0 } : { dmgNotation: `${flat}`, dmgMod: 0 }
        }
        type WeaponRow = { name: string; bonus: number; damage: string; dmgNotation: string; dmgMod: number; notes?: string }
        const allWeapons: WeaponRow[] = [
          ...attacks.map((atk) => {
            const { dmgNotation, dmgMod } = parseDmg(atk.damage)
            return { name: atk.name, bonus: atk.bonus, damage: stripType(atk.damage), dmgNotation, dmgMod }
          }),
          ...(isPlayer ? ((ex.weapons ?? []) as Array<Record<string, string>>) : [])
            .filter((w) => w.name?.trim() && !attacks.some((a) => a.name === w.name))
            .map((w) => {
              const dmg = stripType(w.damage ?? '')
              const { dmgNotation, dmgMod } = parseDmg(dmg)
              return { name: w.name, bonus: parseInt(w.attackBonus ?? '0') || 0, damage: dmg, dmgNotation, dmgMod, notes: w.notes }
            }),
        ]
        if (!allWeapons.length) return null
        return (
          <SheetSection title={`Weapons (${allWeapons.length})`} defaultExpanded>
            <Table size="small">
              <TableBody>
                {allWeapons.map((atk, i) => (
                  <TableRow key={i} sx={{ '& td': { border: 0, py: 0.35 } }}>
                    <TableCell sx={{ color: '#e6d8c0', fontSize: '0.82rem', fontFamily: '"Cinzel", serif', pl: 0 }}>
                      {atk.name}
                      {atk.notes && <Typography component="span" sx={{ fontSize: '0.62rem', color: '#4a3f2e', fontStyle: 'italic', ml: 0.75 }}>{atk.notes}</Typography>}
                    </TableCell>
                    <TableCell sx={{ color: '#c8a44a', fontSize: '0.75rem', fontFamily: '"JetBrains Mono"' }}>
                      {atk.bonus >= 0 ? '+' : ''}{atk.bonus}
                    </TableCell>
                    <TableCell sx={{ color: '#b84848', fontSize: '0.75rem', fontFamily: '"JetBrains Mono"' }}>{atk.damage}</TableCell>
                    <TableCell sx={{ pr: 0 }}>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title={`Roll attack (d20${atk.bonus >= 0 ? '+' : ''}${atk.bonus})`}>
                          <Box
                            onClick={() => triggerRoll('1d20', `${c.name} — ${atk.name} attack`, atk.bonus)}
                            sx={{ px: 0.75, py: 0.2, borderRadius: 0.75, border: '1px solid rgba(200,164,74,0.3)', cursor: 'pointer', fontSize: '0.62rem', color: '#c8a44a', fontFamily: '"JetBrains Mono"', '&:hover': { bgcolor: 'rgba(200,164,74,0.1)' } }}
                          >ATK</Box>
                        </Tooltip>
                        {atk.dmgNotation && (
                          <Tooltip title={`Roll damage (${atk.damage})`}>
                            <Box
                              onClick={() => triggerRoll(atk.dmgNotation, `${c.name} — ${atk.name} damage`, atk.dmgMod)}
                              sx={{ px: 0.75, py: 0.2, borderRadius: 0.75, border: '1px solid rgba(184,72,72,0.3)', cursor: 'pointer', fontSize: '0.62rem', color: '#b84848', fontFamily: '"JetBrains Mono"', '&:hover': { bgcolor: 'rgba(184,72,72,0.1)' } }}
                            >DMG</Box>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SheetSection>
        )
      })()}

      {/* Spells */}
      {isPlayer && ex.spells && (ex.spells as Array<Record<string, unknown>>).length > 0 && (() => {
        type SpellEntry = { name: string; level: number; school?: string; castingTime?: string; range?: string; damage?: string; damageMod?: number; damageType?: string; concentration?: boolean; ritual?: boolean; upcastDice?: string; attackBonus?: number; canUpcast?: boolean }
        const spells = ex.spells as SpellEntry[]
        const byLevel = spells.reduce<Record<number, SpellEntry[]>>((acc, sp) => { ;(acc[sp.level] ??= []).push(sp); return acc }, {})
        return (
          <SheetSection title={`Spells (${spells.length})`}>
            {/* Spell stats */}
            {(ex.spellAttackBonus || ex.spellSlots) && (
              <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                {ex.spellAttackBonus && (
                  <Tooltip title="Roll spell attack">
                    <Box onClick={() => { const mod = parseInt(ex.spellAttackBonus as string); triggerRoll('1d20', `${c.name} — Spell Attack`, isNaN(mod) ? 0 : mod) }}
                      sx={{ px: 1.25, py: 0.5, bgcolor: '#0b0906', borderRadius: 1, border: '1px solid rgba(120,108,92,0.2)', cursor: 'pointer', '&:hover': { borderColor: 'rgba(200,164,74,0.4)' } }}>
                      <Typography sx={{ fontSize: '0.58rem', color: '#786c5c', fontFamily: '"JetBrains Mono"', textTransform: 'uppercase' }}>Spell Atk</Typography>
                      <Typography sx={{ fontSize: '0.9rem', color: '#c8a44a', fontWeight: 700, fontFamily: '"JetBrains Mono"' }}>{ex.spellAttackBonus as string}</Typography>
                    </Box>
                  </Tooltip>
                )}
                {ex.spellSlots && Object.entries(ex.spellSlots as Record<string, number>).sort(([a], [b]) => Number(a) - Number(b)).map(([lvl, count]) => (
                  <Box key={lvl} sx={{ px: 1.25, py: 0.5, bgcolor: '#0b0906', borderRadius: 1, border: '1px solid rgba(120,108,92,0.2)' }}>
                    <Typography sx={{ fontSize: '0.58rem', color: '#786c5c', fontFamily: '"JetBrains Mono"', textTransform: 'uppercase' }}>Lv {lvl} slots</Typography>
                    <Typography sx={{ fontSize: '0.9rem', color: '#b4a48a', fontWeight: 700, fontFamily: '"JetBrains Mono"' }}>{count}</Typography>
                  </Box>
                ))}
              </Box>
            )}
            {Object.entries(byLevel).sort(([a], [b]) => Number(a) - Number(b)).map(([lvl, lvlSpells]) => (
              <Box key={lvl} sx={{ mb: 1 }}>
                <Typography sx={{ fontSize: '0.62rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 0.7, fontFamily: '"JetBrains Mono"', mb: 0.5 }}>
                  {lvl === '0' ? 'Cantrips' : `Level ${lvl}`}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {lvlSpells.map((sp, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.4, px: 0.75, py: 0.3, borderRadius: 1, bgcolor: '#0b0906', border: `1px solid ${sp.concentration ? 'rgba(98,168,112,0.25)' : 'rgba(120,108,92,0.18)'}` }}>
                      <Tooltip title={[sp.school, sp.castingTime, sp.range, sp.damageType, sp.concentration ? 'Concentration' : null, sp.ritual ? 'Ritual' : null].filter(Boolean).join(' · ') || sp.name}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, cursor: 'default' }}>
                          <Typography component="span" sx={{ fontSize: '0.72rem', color: '#b4a48a' }}>{sp.name}</Typography>
                          {sp.concentration && <Typography component="span" sx={{ fontSize: '0.6rem', color: '#62a870' }}>©</Typography>}
                          {sp.ritual && <Typography component="span" sx={{ fontSize: '0.6rem', color: '#786c5c' }}>R</Typography>}
                        </Box>
                      </Tooltip>
                      {sp.damage && (
                        <Tooltip title={`Roll ${sp.name} (${sp.damage}${sp.damageType ? ' ' + sp.damageType : ''})`}>
                          <Box onClick={() => { const m = sp.damage!.match(/(\d+)d(\d+)/); if (m) triggerRoll(`${m[1]}d${m[2]}`, `${c.name} — ${sp.name}`, sp.damageMod ?? 0) }}
                            sx={{ px: 0.5, py: 0.1, borderRadius: 0.5, cursor: 'pointer', border: '1px solid rgba(184,72,72,0.3)', fontSize: '0.6rem', color: '#b84848', fontFamily: '"JetBrains Mono"', '&:hover': { bgcolor: 'rgba(184,72,72,0.1)' } }}>
                            {sp.damage}
                          </Box>
                        </Tooltip>
                      )}
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </SheetSection>
        )
      })()}

      {/* Equipment & Currency */}
      {isPlayer && ex.equipment && (ex.equipment as Array<Record<string, string>>).length > 0 && (
        <SheetSection title={`Equipment (${(ex.equipment as Array<unknown>).length})`}>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: ex.currency ? 1 : 0 }}>
            {(ex.equipment as Array<{ name: string; qty?: string }>).map((item, i) => (
              <Chip key={i} label={`${item.qty && item.qty !== '1' ? `${item.qty}× ` : ''}${item.name}`}
                size="small" sx={{ height: 20, fontSize: '0.68rem', bgcolor: '#0b0906', color: '#b4a48a', border: '1px solid rgba(120,108,92,0.2)' }} />
            ))}
          </Box>
          {ex.currency && Object.values(ex.currency as Record<string, unknown>).some(Boolean) && (
            <Box sx={{ display: 'flex', gap: 1, mt: 0.75 }}>
              {Object.entries(ex.currency as Record<string, number>).map(([k, v]) => v ? (
                <Box key={k} sx={{ textAlign: 'center', px: 1, bgcolor: '#0b0906', borderRadius: 1, border: '1px solid rgba(200,164,74,0.2)' }}>
                  <Typography sx={{ fontSize: '0.58rem', color: '#786c5c', fontFamily: '"JetBrains Mono"' }}>{k.toUpperCase()}</Typography>
                  <Typography sx={{ fontSize: '0.88rem', color: '#c8a44a', fontFamily: '"JetBrains Mono"' }}>{v}</Typography>
                </Box>
              ) : null)}
            </Box>
          )}
        </SheetSection>
      )}

      {/* Features & Traits */}
      {isPlayer && ex.featuresTraits && (ex.featuresTraits as string[]).length > 0 && (
        <SheetSection title="Features & Traits">
          {(ex.featuresTraits as string[]).map((block, i) => (
            <Typography key={i} sx={{ fontSize: '0.75rem', color: '#b4a48a', lineHeight: 1.7, whiteSpace: 'pre-wrap', mb: i < (ex.featuresTraits as string[]).length - 1 ? 1.5 : 0 }}>
              {block}
            </Typography>
          ))}
        </SheetSection>
      )}

      {/* Actions */}
      {isPlayer && ex.actions && (ex.actions as string[]).length > 0 && (
        <SheetSection title="Actions">
          {(ex.actions as string[]).map((block, i) => (
            <Typography key={i} sx={{ fontSize: '0.75rem', color: '#b4a48a', lineHeight: 1.7, whiteSpace: 'pre-wrap', mb: i < (ex.actions as string[]).length - 1 ? 1.5 : 0 }}>
              {block}
            </Typography>
          ))}
        </SheetSection>
      )}

      {/* Proficiencies & Languages */}
      {isPlayer && ex.proficienciesAndLanguages && (
        <SheetSection title="Proficiencies & Languages">
          <Typography sx={{ fontSize: '0.75rem', color: '#b4a48a', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {ex.proficienciesAndLanguages as string}
          </Typography>
        </SheetSection>
      )}

      {/* Character Info */}
      {isPlayer && [ex.gender, ex.age, ex.height, ex.weight, ex.eyes, ex.hair, ex.skin].some(Boolean) && (
        <SheetSection title="Character Info">
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {[
              { label: 'Gender', value: ex.gender }, { label: 'Age', value: ex.age },
              { label: 'Height', value: ex.height }, { label: 'Weight', value: ex.weight ? `${ex.weight} lb` : null },
              { label: 'Eyes', value: ex.eyes }, { label: 'Hair', value: ex.hair }, { label: 'Skin', value: ex.skin },
            ].filter((s) => s.value).map((s) => (
              <Box key={s.label} sx={{ px: 1, py: 0.25, bgcolor: '#0b0906', borderRadius: 1, border: '1px solid rgba(120,108,92,0.2)' }}>
                <Typography sx={{ fontSize: '0.58rem', color: '#786c5c' }}>{s.label}</Typography>
                <Typography sx={{ fontSize: '0.78rem', color: '#b4a48a' }}>{s.value as string}</Typography>
              </Box>
            ))}
          </Box>
        </SheetSection>
      )}

      {/* Special Abilities */}
      {abilities.length > 0 && (
        <SheetSection title={`Special Abilities (${abilities.length})`}>
          {abilities.map((ability, i) => (
            <Box key={i} sx={{ mb: i < abilities.length - 1 ? 1.25 : 0 }}>
              <Typography sx={{ fontSize: '0.78rem', color: '#c8a44a', mb: 0.25 }}>{ability.name}</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#b4a48a', lineHeight: 1.7 }}>{ability.description}</Typography>
            </Box>
          ))}
        </SheetSection>
      )}

      {/* DM Notes */}
      {c.narrativeNotes && (
        <SheetSection title="DM Notes">
          <Typography sx={{ fontSize: '0.78rem', color: '#b4a48a', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
            {c.narrativeNotes}
          </Typography>
        </SheetSection>
      )}

      {/* Corruption */}
      {c.corruptionMax > 0 && (
        <SheetSection title={`Corruption — ${c.corruptionStage}/${c.corruptionMax}`}>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            {Array.from({ length: c.corruptionMax }, (_, i) => (
              <Box key={i} sx={{ width: 18, height: 18, borderRadius: '50%',
                bgcolor: i < c.corruptionStage ? '#b84848' : '#3a332a',
                border: '1px solid #6e303060' }} />
            ))}
          </Box>
        </SheetSection>
      )}

      {/* Decision States */}
      {c.decisionStates?.length > 0 && (
        <SheetSection title="Reaction to Decisions">
          {c.decisionStates.map((ds: { id: string; stateLabel?: string | null; description: string; branch: { label: string; decision: { question: string } } }) => (
            <Box key={ds.id} sx={{ mb: 1, p: 1, bgcolor: '#0b0906', borderRadius: 1, border: '1px solid rgba(120,108,92,0.2)' }}>
              <Typography sx={{ fontSize: '0.65rem', color: '#786c5c', display: 'block', mb: 0.25 }}>
                {ds.branch.decision.question} → {ds.branch.label}
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: '#b4a48a' }}>{ds.description}</Typography>
            </Box>
          ))}
        </SheetSection>
      )}

      {/* Held Items */}
      {c.heldItems?.length > 0 && (
        <SheetSection title={`Held Items (${c.heldItems.length})`}>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {c.heldItems.map((item: { id: string; name: string; type: string }) => (
              <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.3, bgcolor: '#0b0906', borderRadius: 1, border: '1px solid rgba(120,108,92,0.2)' }}>
                <StatusBadge status={item.type} />
                <Typography sx={{ fontSize: '0.78rem', color: '#e6d8c0' }}>{item.name}</Typography>
              </Box>
            ))}
          </Box>
        </SheetSection>
      )}

      {/* Miniature */}
      {(c.miniStlSource || c.miniSearchHint) && (
        <SheetSection title="Miniature">
          {c.miniStlSource && (
            <Typography sx={{ fontSize: '0.78rem', color: '#b4a48a', mb: 0.25 }}>Source: {c.miniStlSource}</Typography>
          )}
          {c.miniSearchHint && (
            <Typography sx={{ fontSize: '0.75rem', color: '#786c5c', fontStyle: 'italic' }}>Search: {c.miniSearchHint}</Typography>
          )}
        </SheetSection>
      )}

      {isPlayer ? (
        <PlayerFormDialog
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSave={handlePlayerSave}
          title={`Edit — ${c.name}`}
          initial={playerInitial}
        />
      ) : (
        <CharacterFormDialog
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); refetch() }}
          character={c}
        />
      )}

      <ConfirmDeleteDialog
        open={deleteOpen}
        title={`Delete "${c.name}"?`}
        onConfirm={handleDelete}
        onClose={() => setDeleteOpen(false)}
        loading={deleting}
      />
    </Box>
  )
}
