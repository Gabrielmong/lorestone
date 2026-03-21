import { useState, useEffect } from 'react'
import { useMutation, gql } from '@apollo/client'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Grid, Typography, Divider, FormControlLabel, Checkbox, Box,
  IconButton, useTheme, useMediaQuery,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
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
const SAVING_THROW_KEYS = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']
const SKILL_KEYS = [
  'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception',
  'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine',
  'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion',
  'Sleight of Hand', 'Stealth', 'Survival',
]
const CURRENCY_KEYS: Array<[string, string]> = [
  ['cp', 'CP'], ['sp', 'SP'], ['ep', 'EP'], ['gp', 'GP'], ['pp', 'PP'],
]

interface AttackRow { name: string; bonus: string; damage: string }
interface AbilityRow { name: string; description: string }
interface EquipRow { name: string; qty: string }

interface CharacterExtra {
  savingThrows?: Record<string, string>
  skills?: Record<string, string>
  equipment?: Array<{ name: string; qty?: string }>
  currency?: Record<string, number | undefined>
  gender?: string; age?: string; height?: string; weight?: string
  eyes?: string; hair?: string; skin?: string
  proficienciesAndLanguages?: string
  featuresTraits?: string[]
  actions?: string[]
}

interface CharacterData {
  id?: string
  name?: string; role?: string; status?: string
  description?: string | null; location?: string | null
  hpMax?: number | null; hpCurrent?: number | null
  armorClass?: number | null; speed?: number | null; initiative?: number | null
  stats?: Record<string, number> | null
  attacks?: Array<{ name: string; bonus: number; damage: string }> | null
  specialAbilities?: Array<{ name: string; description: string }> | null
  corruptionStage?: number; corruptionMax?: number
  narrativeNotes?: string | null
  miniPrinted?: boolean; miniStlSource?: string | null; miniSearchHint?: string | null
  tags?: string[]
  extra?: CharacterExtra | null
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  character?: CharacterData | null
}

function modStr(score: string): string {
  const n = parseInt(score)
  if (isNaN(n)) return '—'
  const m = Math.floor((n - 10) / 2)
  return m >= 0 ? `+${m}` : `${m}`
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{
      fontSize: '0.68rem', color: '#786c5c', textTransform: 'uppercase',
      letterSpacing: 1, fontFamily: '"JetBrains Mono"', mb: 1,
    }}>
      {children}
    </Typography>
  )
}

const defaultStats = { str: '10', dex: '10', con: '10', int: '10', wis: '10', cha: '10' }

export default function CharacterFormDialog({ open, onClose, onSaved, character }: Props) {
  const { campaignId } = useCampaign()
  const isEdit = !!character?.id
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  // ── Basic ──
  const [name, setName] = useState('')
  const [role, setRole] = useState('NPC')
  const [status, setStatus] = useState('ACTIVE')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [narrativeNotes, setNarrativeNotes] = useState('')
  const [tags, setTags] = useState('')

  // ── Ability scores ──
  const [stats, setStats] = useState<Record<string, string>>({ ...defaultStats })

  // ── Combat ──
  const [hpMax, setHpMax] = useState('')
  const [hpCurrent, setHpCurrent] = useState('')
  const [armorClass, setArmorClass] = useState('')
  const [speed, setSpeed] = useState('')
  const [initiative, setInitiative] = useState('')
  const [proficiencyBonus, setProficiencyBonus] = useState('')
  const [spellSaveDC, setSpellSaveDC] = useState('')
  const [passivePerception, setPassivePerception] = useState('')

  // ── Saving throws & skills ──
  const [savingThrows, setSavingThrows] = useState<Record<string, string>>({})
  const [skills, setSkills] = useState<Record<string, string>>({})

  // ── Attacks ──
  const [attacks, setAttacks] = useState<AttackRow[]>([])

  // ── Special abilities ──
  const [specialAbilities, setSpecialAbilities] = useState<AbilityRow[]>([])

  // ── Narrative text ──
  const [featuresTraits, setFeaturesTraits] = useState('')
  const [actions, setActions] = useState('')
  const [proficienciesAndLanguages, setProficienciesAndLanguages] = useState('')

  // ── Equipment ──
  const [equipment, setEquipment] = useState<EquipRow[]>([])
  const [currency, setCurrency] = useState<Record<string, string>>({ cp: '', sp: '', ep: '', gp: '', pp: '' })

  // ── Character info ──
  const [gender, setGender] = useState('')
  const [age, setAge] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [eyes, setEyes] = useState('')
  const [hair, setHair] = useState('')
  const [skin, setSkin] = useState('')

  // ── Corruption & mini ──
  const [corruptionMax, setCorruptionMax] = useState('')
  const [corruptionStage, setCorruptionStage] = useState('')
  const [miniPrinted, setMiniPrinted] = useState(false)
  const [miniStlSource, setMiniStlSource] = useState('')
  const [miniSearchHint, setMiniSearchHint] = useState('')

  useEffect(() => {
    if (!open) return
    const ex = (character?.extra ?? {}) as CharacterExtra

    setName(character?.name ?? '')
    setRole(character?.role ?? 'NPC')
    setStatus(character?.status ?? 'ACTIVE')
    setDescription(character?.description ?? '')
    setLocation(character?.location ?? '')
    setNarrativeNotes(character?.narrativeNotes ?? '')
    setTags(character?.tags?.join(', ') ?? '')

    const existingStats = character?.stats ?? {}
    setStats(Object.fromEntries(STAT_KEYS.map((k) => [k, String(existingStats[k] ?? 10)])))

    setHpMax(character?.hpMax != null ? String(character.hpMax) : '')
    setHpCurrent(character?.hpCurrent != null ? String(character.hpCurrent) : '')
    setArmorClass(character?.armorClass != null ? String(character.armorClass) : '')
    setSpeed(character?.speed != null ? String(character.speed) : '')
    setInitiative(character?.initiative != null ? String(character.initiative) : '')
    setProficiencyBonus(String(ex.savingThrows?.['proficiencyBonus'] ?? ''))

    setSavingThrows(ex.savingThrows ?? {})
    setSkills(ex.skills ?? {})
    setProficiencyBonus((ex as any).proficiencyBonus ?? '')
    setSpellSaveDC((ex as any).spellSaveDC ?? '')
    setPassivePerception((ex as any).passivePerception != null ? String((ex as any).passivePerception) : '')

    setAttacks(character?.attacks?.map((a) => ({
      name: a.name ?? '', bonus: a.bonus != null ? String(a.bonus) : '', damage: a.damage ?? '',
    })) ?? [])

    setSpecialAbilities(character?.specialAbilities?.map((a) => ({
      name: a.name ?? '', description: a.description ?? '',
    })) ?? [])

    setFeaturesTraits(ex.featuresTraits?.join('\n\n') ?? '')
    setActions(ex.actions?.join('\n\n') ?? '')
    setProficienciesAndLanguages(ex.proficienciesAndLanguages ?? '')

    setEquipment(ex.equipment?.map((e) => ({ name: e.name ?? '', qty: e.qty ?? '' })) ?? [])
    setCurrency({
      cp: ex.currency?.cp != null ? String(ex.currency.cp) : '',
      sp: ex.currency?.sp != null ? String(ex.currency.sp) : '',
      ep: ex.currency?.ep != null ? String(ex.currency.ep) : '',
      gp: ex.currency?.gp != null ? String(ex.currency.gp) : '',
      pp: ex.currency?.pp != null ? String(ex.currency.pp) : '',
    })

    setGender(ex.gender ?? '')
    setAge(ex.age ?? '')
    setHeight(ex.height ?? '')
    setWeight(ex.weight ?? '')
    setEyes(ex.eyes ?? '')
    setHair(ex.hair ?? '')
    setSkin(ex.skin ?? '')

    setCorruptionMax(character?.corruptionMax ? String(character.corruptionMax) : '')
    setCorruptionStage(character?.corruptionStage ? String(character.corruptionStage) : '')
    setMiniPrinted(character?.miniPrinted ?? false)
    setMiniStlSource(character?.miniStlSource ?? '')
    setMiniSearchHint(character?.miniSearchHint ?? '')
  }, [open, character])

  const [createCharacter, { loading: creating }] = useMutation(CREATE_CHARACTER)
  const [updateCharacter, { loading: updating }] = useMutation(UPDATE_CHARACTER)
  const loading = creating || updating

  // ── Dynamic list helpers ──
  const addAttack = () => setAttacks((p) => [...p, { name: '', bonus: '', damage: '' }])
  const updateAttack = (i: number, field: keyof AttackRow, val: string) =>
    setAttacks((p) => p.map((a, idx) => idx === i ? { ...a, [field]: val } : a))
  const removeAttack = (i: number) => setAttacks((p) => p.filter((_, idx) => idx !== i))

  const addAbility = () => setSpecialAbilities((p) => [...p, { name: '', description: '' }])
  const updateAbility = (i: number, field: keyof AbilityRow, val: string) =>
    setSpecialAbilities((p) => p.map((a, idx) => idx === i ? { ...a, [field]: val } : a))
  const removeAbility = (i: number) => setSpecialAbilities((p) => p.filter((_, idx) => idx !== i))

  const addEquip = () => setEquipment((p) => [...p, { name: '', qty: '' }])
  const updateEquip = (i: number, field: keyof EquipRow, val: string) =>
    setEquipment((p) => p.map((e, idx) => idx === i ? { ...e, [field]: val } : e))
  const removeEquip = (i: number) => setEquipment((p) => p.filter((_, idx) => idx !== i))

  const handleSave = async () => {
    const statsJson: Record<string, number> = {}
    for (const k of STAT_KEYS) {
      const v = parseInt(stats[k])
      if (!isNaN(v)) statsJson[k] = v
    }

    const attacksJson = attacks
      .filter((a) => a.name.trim())
      .map((a) => ({ name: a.name, bonus: parseInt(a.bonus) || 0, damage: a.damage }))

    const specialAbilitiesJson = specialAbilities.filter((a) => a.name.trim())

    const filteredST = Object.fromEntries(Object.entries(savingThrows).filter(([, v]) => v.trim()))
    const filteredSk = Object.fromEntries(Object.entries(skills).filter(([, v]) => v.trim()))

    const cp = parseInt(currency.cp) || undefined
    const sp = parseInt(currency.sp) || undefined
    const ep = parseInt(currency.ep) || undefined
    const gp = parseInt(currency.gp) || undefined
    const pp = parseInt(currency.pp) || undefined
    const currencyObj = [cp, sp, ep, gp, pp].some((v) => v != null) ? { cp, sp, ep, gp, pp } : undefined

    const extra: CharacterExtra & Record<string, unknown> = {
      ...(Object.keys(filteredST).length ? { savingThrows: filteredST } : {}),
      ...(Object.keys(filteredSk).length ? { skills: filteredSk } : {}),
      ...(proficiencyBonus ? { proficiencyBonus } : {}),
      ...(spellSaveDC ? { spellSaveDC } : {}),
      ...(passivePerception ? { passivePerception: parseInt(passivePerception) } : {}),
      ...(equipment.filter((e) => e.name.trim()).length ? { equipment: equipment.filter((e) => e.name.trim()) } : {}),
      ...(currencyObj ? { currency: currencyObj } : {}),
      ...(gender ? { gender } : {}),
      ...(age ? { age } : {}),
      ...(height ? { height } : {}),
      ...(weight ? { weight } : {}),
      ...(eyes ? { eyes } : {}),
      ...(hair ? { hair } : {}),
      ...(skin ? { skin } : {}),
      ...(proficienciesAndLanguages ? { proficienciesAndLanguages } : {}),
      ...(featuresTraits ? { featuresTraits: featuresTraits.split('\n\n').filter(Boolean) } : {}),
      ...(actions ? { actions: actions.split('\n\n').filter(Boolean) } : {}),
    }

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
      initiative: initiative ? parseInt(initiative) : undefined,
      stats: Object.keys(statsJson).length ? statsJson : undefined,
      attacks: attacksJson,
      specialAbilities: specialAbilitiesJson,
      corruptionMax: corruptionMax ? parseInt(corruptionMax) : 0,
      corruptionStage: corruptionStage ? parseInt(corruptionStage) : 0,
      miniPrinted,
      miniStlSource: miniStlSource || undefined,
      miniSearchHint: miniSearchHint || undefined,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      extra,
    }

    if (isEdit) {
      await updateCharacter({ variables: { id: character!.id, input } })
    } else {
      await createCharacter({ variables: { input: { ...input, campaignId } } })
    }
    onSaved()
    onClose()
  }

  const fs = { size: 'small' as const, fullWidth: true }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={isMobile}
      PaperProps={{ sx: { bgcolor: '#0f0d0a', border: '1px solid rgba(120,108,92,0.3)' } }}>
      <DialogTitle sx={{ color: '#e6d8c0', fontFamily: '"Cinzel", serif', fontSize: '1rem', pb: 1 }}>
        {isEdit ? `Edit — ${character?.name}` : 'New Character'}
      </DialogTitle>

      <DialogContent dividers sx={{ borderColor: 'rgba(120,108,92,0.2)' }}>
        <Grid container spacing={2}>

          {/* ── BASIC ── */}
          <Grid item xs={12}><SectionLabel>Identity</SectionLabel></Grid>
          <Grid item xs={12} sm={6}>
            <TextField {...fs} label="Name *" value={name} onChange={(e) => setName(e.target.value)} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormControl {...fs}>
              <InputLabel>Role</InputLabel>
              <Select value={role} onChange={(e) => setRole(e.target.value)} label="Role">
                {ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormControl {...fs}>
              <InputLabel>Status</InputLabel>
              <Select value={status} onChange={(e) => setStatus(e.target.value)} label="Status">
                {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField {...fs} label="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField {...fs} label="Tags (comma-separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
          </Grid>
          <Grid item xs={12}>
            <TextField {...fs} label="Description" value={description} onChange={(e) => setDescription(e.target.value)} multiline rows={2} />
          </Grid>
          <Grid item xs={12}>
            <TextField {...fs} label="DM Notes" value={narrativeNotes} onChange={(e) => setNarrativeNotes(e.target.value)} multiline rows={2} />
          </Grid>

          <Grid item xs={12}><Divider sx={{ borderColor: 'rgba(120,108,92,0.2)' }} /></Grid>

          {/* ── ABILITY SCORES ── */}
          <Grid item xs={12}><SectionLabel>Ability Scores</SectionLabel></Grid>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {STAT_KEYS.map((k) => (
                <Box key={k} sx={{ flex: 1, minWidth: 72, textAlign: 'center' }}>
                  <TextField
                    label={k.toUpperCase()} type="number" value={stats[k]}
                    onChange={(e) => setStats((p) => ({ ...p, [k]: e.target.value }))}
                    size="small"
                    inputProps={{ min: 1, max: 30, style: { textAlign: 'center', fontFamily: '"JetBrains Mono"', fontWeight: 700, fontSize: '1.1rem' } }}
                    sx={{ '& input': { py: 1 } }}
                  />
                  <Typography sx={{ fontSize: '0.72rem', color: '#c8a44a', fontFamily: '"JetBrains Mono"', mt: 0.25 }}>
                    {modStr(stats[k])}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Grid>

          <Grid item xs={12}><Divider sx={{ borderColor: 'rgba(120,108,92,0.2)' }} /></Grid>

          {/* ── COMBAT ── */}
          <Grid item xs={12}><SectionLabel>Combat</SectionLabel></Grid>
          <Grid item xs={6} sm={3}>
            <TextField {...fs} label="HP Max" type="number" value={hpMax} onChange={(e) => setHpMax(e.target.value)} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField {...fs} label="HP Current" type="number" value={hpCurrent} onChange={(e) => setHpCurrent(e.target.value)} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField {...fs} label="AC" type="number" value={armorClass} onChange={(e) => setArmorClass(e.target.value)} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField {...fs} label="Speed (ft)" type="number" value={speed} onChange={(e) => setSpeed(e.target.value)} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField {...fs} label="Initiative" type="number" value={initiative} onChange={(e) => setInitiative(e.target.value)} />
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField {...fs} label="Prof. Bonus" value={proficiencyBonus} onChange={(e) => setProficiencyBonus(e.target.value)} placeholder="+2" />
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField {...fs} label="Spell Save DC" value={spellSaveDC} onChange={(e) => setSpellSaveDC(e.target.value)} />
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField {...fs} label="Passive Perception" type="number" value={passivePerception} onChange={(e) => setPassivePerception(e.target.value)} />
          </Grid>

          <Grid item xs={12}><Divider sx={{ borderColor: 'rgba(120,108,92,0.2)' }} /></Grid>

          {/* ── SAVING THROWS ── */}
          <Grid item xs={12}><SectionLabel>Saving Throws</SectionLabel></Grid>
          {SAVING_THROW_KEYS.map((stat) => (
            <Grid item xs={4} sm={2} key={stat}>
              <TextField
                {...fs} label={stat.slice(0, 3)} value={savingThrows[stat] ?? ''}
                onChange={(e) => setSavingThrows((p) => ({ ...p, [stat]: e.target.value }))}
                placeholder="+0"
                inputProps={{ style: { fontFamily: '"JetBrains Mono"', textAlign: 'center' } }}
              />
            </Grid>
          ))}

          <Grid item xs={12}><Divider sx={{ borderColor: 'rgba(120,108,92,0.2)' }} /></Grid>

          {/* ── SKILLS ── */}
          <Grid item xs={12}><SectionLabel>Skills</SectionLabel></Grid>
          {SKILL_KEYS.map((skill) => (
            <Grid item xs={6} sm={4} md={3} key={skill}>
              <TextField
                {...fs} label={skill} value={skills[skill] ?? ''}
                onChange={(e) => setSkills((p) => ({ ...p, [skill]: e.target.value }))}
                placeholder="+0"
                inputProps={{ style: { fontFamily: '"JetBrains Mono"' } }}
              />
            </Grid>
          ))}

          <Grid item xs={12}><Divider sx={{ borderColor: 'rgba(120,108,92,0.2)' }} /></Grid>

          {/* ── ATTACKS ── */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: -0.5 }}>
              <SectionLabel>Attacks</SectionLabel>
              <Button size="small" startIcon={<AddIcon sx={{ fontSize: 14 }} />} onClick={addAttack}
                sx={{ color: '#c8a44a', fontSize: '0.72rem', mb: 1, minWidth: 0 }}>
                Add
              </Button>
            </Box>
          </Grid>
          {attacks.length === 0 && (
            <Grid item xs={12}>
              <Typography sx={{ fontSize: '0.75rem', color: '#4a3f2e', fontStyle: 'italic' }}>No attacks added.</Typography>
            </Grid>
          )}
          {attacks.map((a, i) => (
            <Grid item xs={12} key={i}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField size="small" label="Name" value={a.name}
                  onChange={(e) => updateAttack(i, 'name', e.target.value)} sx={{ flex: 2 }} />
                <TextField size="small" label="Bonus" value={a.bonus}
                  onChange={(e) => updateAttack(i, 'bonus', e.target.value)}
                  placeholder="+4" sx={{ flex: 1 }}
                  inputProps={{ style: { fontFamily: '"JetBrains Mono"', textAlign: 'center' } }} />
                <TextField size="small" label="Damage" value={a.damage}
                  onChange={(e) => updateAttack(i, 'damage', e.target.value)}
                  placeholder="1d8+2" sx={{ flex: 1.5 }}
                  inputProps={{ style: { fontFamily: '"JetBrains Mono"' } }} />
                <IconButton size="small" onClick={() => removeAttack(i)}
                  sx={{ color: '#786c5c', '&:hover': { color: '#b84848' }, flexShrink: 0 }}>
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            </Grid>
          ))}

          <Grid item xs={12}><Divider sx={{ borderColor: 'rgba(120,108,92,0.2)' }} /></Grid>

          {/* ── SPECIAL ABILITIES ── */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: -0.5 }}>
              <SectionLabel>Special Abilities</SectionLabel>
              <Button size="small" startIcon={<AddIcon sx={{ fontSize: 14 }} />} onClick={addAbility}
                sx={{ color: '#c8a44a', fontSize: '0.72rem', mb: 1, minWidth: 0 }}>
                Add
              </Button>
            </Box>
          </Grid>
          {specialAbilities.length === 0 && (
            <Grid item xs={12}>
              <Typography sx={{ fontSize: '0.75rem', color: '#4a3f2e', fontStyle: 'italic' }}>No special abilities added.</Typography>
            </Grid>
          )}
          {specialAbilities.map((a, i) => (
            <Grid item xs={12} key={i}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <TextField size="small" label="Name" value={a.name}
                  onChange={(e) => updateAbility(i, 'name', e.target.value)} sx={{ flex: 1 }} />
                <TextField size="small" label="Description" value={a.description}
                  onChange={(e) => updateAbility(i, 'description', e.target.value)}
                  multiline rows={2} sx={{ flex: 3 }} />
                <IconButton size="small" onClick={() => removeAbility(i)}
                  sx={{ color: '#786c5c', '&:hover': { color: '#b84848' }, flexShrink: 0, mt: 0.5 }}>
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            </Grid>
          ))}

          <Grid item xs={12}><Divider sx={{ borderColor: 'rgba(120,108,92,0.2)' }} /></Grid>

          {/* ── FEATURES & TRAITS / ACTIONS ── */}
          <Grid item xs={12}>
            <TextField {...fs} label="Features & Traits" value={featuresTraits}
              onChange={(e) => setFeaturesTraits(e.target.value)} multiline rows={3}
              helperText="Separate multiple blocks with a blank line" />
          </Grid>
          <Grid item xs={12}>
            <TextField {...fs} label="Actions" value={actions}
              onChange={(e) => setActions(e.target.value)} multiline rows={3}
              helperText="Separate multiple blocks with a blank line" />
          </Grid>
          <Grid item xs={12}>
            <TextField {...fs} label="Proficiencies & Languages" value={proficienciesAndLanguages}
              onChange={(e) => setProficienciesAndLanguages(e.target.value)} multiline rows={2} />
          </Grid>

          <Grid item xs={12}><Divider sx={{ borderColor: 'rgba(120,108,92,0.2)' }} /></Grid>

          {/* ── EQUIPMENT ── */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: -0.5 }}>
              <SectionLabel>Equipment</SectionLabel>
              <Button size="small" startIcon={<AddIcon sx={{ fontSize: 14 }} />} onClick={addEquip}
                sx={{ color: '#c8a44a', fontSize: '0.72rem', mb: 1, minWidth: 0 }}>
                Add
              </Button>
            </Box>
          </Grid>
          {equipment.length === 0 && (
            <Grid item xs={12}>
              <Typography sx={{ fontSize: '0.75rem', color: '#4a3f2e', fontStyle: 'italic' }}>No equipment added.</Typography>
            </Grid>
          )}
          {equipment.map((item, i) => (
            <Grid item xs={12} key={i}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField size="small" label="Item Name" value={item.name}
                  onChange={(e) => updateEquip(i, 'name', e.target.value)} sx={{ flex: 4 }} />
                <TextField size="small" label="Qty" value={item.qty}
                  onChange={(e) => updateEquip(i, 'qty', e.target.value)} sx={{ flex: 1 }}
                  inputProps={{ style: { fontFamily: '"JetBrains Mono"', textAlign: 'center' } }} />
                <IconButton size="small" onClick={() => removeEquip(i)}
                  sx={{ color: '#786c5c', '&:hover': { color: '#b84848' }, flexShrink: 0 }}>
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            </Grid>
          ))}
          <Grid item xs={12}>
            <Typography sx={{ fontSize: '0.62rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: '"JetBrains Mono"', mt: 0.5 }}>
              Currency
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {CURRENCY_KEYS.map(([key, label]) => (
                <TextField key={key} size="small" label={label} type="number"
                  value={currency[key]} onChange={(e) => setCurrency((p) => ({ ...p, [key]: e.target.value }))}
                  sx={{ flex: 1 }}
                  inputProps={{ style: { fontFamily: '"JetBrains Mono"', textAlign: 'center' } }} />
              ))}
            </Box>
          </Grid>

          <Grid item xs={12}><Divider sx={{ borderColor: 'rgba(120,108,92,0.2)' }} /></Grid>

          {/* ── CHARACTER INFO ── */}
          <Grid item xs={12}><SectionLabel>Character Info</SectionLabel></Grid>
          <Grid item xs={6} sm={3}>
            <TextField {...fs} label="Gender" value={gender} onChange={(e) => setGender(e.target.value)} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField {...fs} label="Age" value={age} onChange={(e) => setAge(e.target.value)} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField {...fs} label="Height" value={height} onChange={(e) => setHeight(e.target.value)} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField {...fs} label="Weight" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="lbs" />
          </Grid>
          <Grid item xs={4}>
            <TextField {...fs} label="Eyes" value={eyes} onChange={(e) => setEyes(e.target.value)} />
          </Grid>
          <Grid item xs={4}>
            <TextField {...fs} label="Hair" value={hair} onChange={(e) => setHair(e.target.value)} />
          </Grid>
          <Grid item xs={4}>
            <TextField {...fs} label="Skin" value={skin} onChange={(e) => setSkin(e.target.value)} />
          </Grid>

          <Grid item xs={12}><Divider sx={{ borderColor: 'rgba(120,108,92,0.2)' }} /></Grid>

          {/* ── CORRUPTION ── */}
          <Grid item xs={12}><SectionLabel>Corruption</SectionLabel></Grid>
          <Grid item xs={6} sm={3}>
            <TextField {...fs} label="Max" type="number" value={corruptionMax} onChange={(e) => setCorruptionMax(e.target.value)} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField {...fs} label="Stage" type="number" value={corruptionStage} onChange={(e) => setCorruptionStage(e.target.value)} />
          </Grid>

          <Grid item xs={12}><Divider sx={{ borderColor: 'rgba(120,108,92,0.2)' }} /></Grid>

          {/* ── MINIATURE ── */}
          <Grid item xs={12}><SectionLabel>Miniature</SectionLabel></Grid>
          <Grid item xs={12} sm={4}>
            <FormControlLabel
              control={<Checkbox checked={miniPrinted} onChange={(e) => setMiniPrinted(e.target.checked)} size="small" />}
              label={<Typography sx={{ fontSize: '0.85rem', color: '#b4a48a' }}>Mini Printed</Typography>}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField {...fs} label="STL Source" value={miniStlSource} onChange={(e) => setMiniStlSource(e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField {...fs} label="Search Hint" value={miniSearchHint} onChange={(e) => setMiniSearchHint(e.target.value)} />
          </Grid>

        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} disabled={loading} sx={{ color: '#786c5c' }}>Cancel</Button>
        <Button onClick={handleSave} disabled={loading || !name.trim()} variant="contained" size="small"
          sx={{ bgcolor: '#c8a44a', color: '#0b0906', '&:hover': { bgcolor: '#e6c86a' } }}>
          {loading ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
