import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, gql } from '@apollo/client'
import {
  Box, Typography, Chip, CircularProgress,
  Alert, Button, Accordion, AccordionSummary, AccordionDetails, Tooltip,
  Table, TableBody, TableRow, TableCell, Divider, IconButton,
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
      id name role description location status
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
    { label: 'Speed', value: c.speed ? `${c.speed} ft.` : null },
    { label: 'Initiative', value: c.initiative != null ? (c.initiative >= 0 ? `+${c.initiative}` : `${c.initiative}`) : null },
  ].filter((s) => s.value != null)

  return (
    <Box sx={{ maxWidth: 860, mx: 'auto' }}>
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
        {/* Name + badges */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '1.25rem', color: '#e6d8c0' }}>{c.name}</Typography>
          <StatusBadge status={c.role} />
          <StatusBadge status={c.status} />
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
