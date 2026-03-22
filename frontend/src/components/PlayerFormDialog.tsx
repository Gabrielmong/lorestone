import { useState, useEffect } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Grid, TextField, Typography, Box, Divider, Select, MenuItem,
  FormControl, InputLabel, useTheme, useMediaQuery, IconButton,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'

export interface PlayerFormWeapon {
  name: string; attackBonus: string; damage: string; notes: string
}

export interface PlayerFormEquipItem {
  name: string; qty: string
}

export interface PlayerFormSpell {
  name: string
  level: string
  school: string
  castingTime: string
  range: string
  damage: string
  damageMod: string
  damageType: string
  concentration: boolean
  ritual: boolean
}

export interface PlayerFormValues {
  // Identity
  name: string; playerName: string; race: string; class: string
  level: string; background: string; alignment: string; description: string
  hitDice: string
  // Combat
  hpMax: string; armorClass: string; speed: string; initiative: string
  proficiencyBonus: string; spellSaveDC: string; passivePerception: string
  // Ability scores
  strength: string; dexterity: string; constitution: string
  intelligence: string; wisdom: string; charisma: string
  // Character info
  gender: string; age: string; height: string; weight: string
  eyes: string; hair: string; skin: string
  // Complex fields
  savingThrows: Record<string, string>
  skills: Record<string, string>
  weapons: PlayerFormWeapon[]
  equipment: PlayerFormEquipItem[]
  spells: PlayerFormSpell[]
  currencyCp: string; currencySp: string; currencyEp: string
  currencyGp: string; currencyPp: string
  // Narrative
  featuresTraits: string; actions: string; proficienciesAndLanguages: string
}

export const BLANK_PLAYER_FORM: PlayerFormValues = {
  name: '', playerName: '', race: '', class: '', level: '',
  background: '', alignment: '', description: '', hitDice: '',
  hpMax: '', armorClass: '', speed: '', initiative: '',
  proficiencyBonus: '', spellSaveDC: '', passivePerception: '',
  strength: '', dexterity: '', constitution: '',
  intelligence: '', wisdom: '', charisma: '',
  gender: '', age: '', height: '', weight: '', eyes: '', hair: '', skin: '',
  savingThrows: {}, skills: {},
  weapons: [], equipment: [], spells: [],
  currencyCp: '', currencySp: '', currencyEp: '', currencyGp: '', currencyPp: '',
  featuresTraits: '', actions: '', proficienciesAndLanguages: '',
}

const ALIGNMENTS = [
  'Lawful Good', 'Neutral Good', 'Chaotic Good',
  'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
  'Lawful Evil', 'Neutral Evil', 'Chaotic Evil',
]

const SAVING_THROW_KEYS = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']
const SKILL_KEYS = [
  'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception',
  'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine',
  'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion',
  'Sleight of Hand', 'Stealth', 'Survival',
]
const CURRENCY_KEYS: Array<[keyof PlayerFormValues, string]> = [
  ['currencyCp', 'CP'], ['currencySp', 'SP'], ['currencyEp', 'EP'],
  ['currencyGp', 'GP'], ['currencyPp', 'PP'],
]

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

function AbilityField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Box sx={{ textAlign: 'center' }}>
      <TextField
        label={label} value={value} onChange={(e) => onChange(e.target.value)}
        type="number" size="small"
        inputProps={{ min: 1, max: 30, style: { textAlign: 'center', fontFamily: '"JetBrains Mono"', fontWeight: 700, fontSize: '1.1rem' } }}
        sx={{ '& input': { py: 1 } }}
      />
      <Typography sx={{ fontSize: '0.72rem', color: '#c8a44a', fontFamily: '"JetBrains Mono"', mt: 0.25 }}>
        {modStr(value)}
      </Typography>
    </Box>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  onSave: (values: PlayerFormValues) => void
  initial?: Partial<PlayerFormValues>
  title?: string
}

export default function PlayerFormDialog({ open, onClose, onSave, initial, title }: Props) {
  const [v, setV] = useState<PlayerFormValues>(BLANK_PLAYER_FORM)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  useEffect(() => {
    if (open) setV({ ...BLANK_PLAYER_FORM, ...initial })
  }, [open, initial])

  const set = (key: keyof PlayerFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setV((p) => ({ ...p, [key]: e.target.value }))

  const setST = (stat: string, val: string) =>
    setV((p) => ({ ...p, savingThrows: { ...p.savingThrows, [stat]: val } }))

  const setSkill = (skill: string, val: string) =>
    setV((p) => ({ ...p, skills: { ...p.skills, [skill]: val } }))

  const addWeapon = () =>
    setV((p) => ({ ...p, weapons: [...p.weapons, { name: '', attackBonus: '', damage: '', notes: '' }] }))

  const updateWeapon = (i: number, field: keyof PlayerFormWeapon, val: string) =>
    setV((p) => ({ ...p, weapons: p.weapons.map((w, idx) => idx === i ? { ...w, [field]: val } : w) }))

  const removeWeapon = (i: number) =>
    setV((p) => ({ ...p, weapons: p.weapons.filter((_, idx) => idx !== i) }))

  const addEquip = () =>
    setV((p) => ({ ...p, equipment: [...p.equipment, { name: '', qty: '' }] }))

  const updateEquip = (i: number, field: keyof PlayerFormEquipItem, val: string) =>
    setV((p) => ({ ...p, equipment: p.equipment.map((e, idx) => idx === i ? { ...e, [field]: val } : e) }))

  const removeEquip = (i: number) =>
    setV((p) => ({ ...p, equipment: p.equipment.filter((_, idx) => idx !== i) }))

  const addSpell = () =>
    setV((p) => ({ ...p, spells: [...p.spells, { name: '', level: '0', school: '', castingTime: 'Action', range: '', damage: '', damageMod: '', damageType: '', concentration: false, ritual: false }] }))

  const updateSpell = (i: number, field: keyof PlayerFormSpell, val: string | boolean) =>
    setV((p) => ({ ...p, spells: p.spells.map((s, idx) => idx === i ? { ...s, [field]: val } : s) }))

  const removeSpell = (i: number) =>
    setV((p) => ({ ...p, spells: p.spells.filter((_, idx) => idx !== i) }))

  const fs = { size: 'small' as const, fullWidth: true }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={isMobile}
      PaperProps={{ sx: { bgcolor: '#0f0d0a', border: '1px solid rgba(120,108,92,0.3)' } }}>
      <DialogTitle sx={{ color: '#e6d8c0', fontFamily: '"Cinzel", serif', fontSize: '1rem', pb: 1 }}>
        {title ?? 'New Player Character'}
      </DialogTitle>

      <DialogContent dividers sx={{ borderColor: 'rgba(120,108,92,0.2)' }}>
        <Grid container spacing={2}>

          {/* ── IDENTITY ── */}
          <Grid item xs={12}><SectionLabel>Identity</SectionLabel></Grid>
          <Grid item xs={12} sm={6}>
            <TextField {...fs} label="Character Name *" value={v.name} onChange={set('name')} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField {...fs} label="Player Name" value={v.playerName} onChange={set('playerName')} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField {...fs} label="Race / Species" value={v.race} onChange={set('race')} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField {...fs} label="Class" value={v.class} onChange={set('class')} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField {...fs} label="Level" type="number" value={v.level} onChange={set('level')} inputProps={{ min: 1, max: 20 }} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField {...fs} label="Hit Dice" value={v.hitDice} onChange={set('hitDice')} placeholder="1d10" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField {...fs} label="Background" value={v.background} onChange={set('background')} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl {...fs}>
              <InputLabel>Alignment</InputLabel>
              <Select value={v.alignment} onChange={(e) => setV((p) => ({ ...p, alignment: e.target.value }))} label="Alignment">
                <MenuItem value=""><em>None</em></MenuItem>
                {ALIGNMENTS.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField {...fs} label="Brief Description" value={v.description} onChange={set('description')} />
          </Grid>

          <Grid item xs={12}><Divider sx={{ borderColor: 'rgba(120,108,92,0.2)' }} /></Grid>

          {/* ── ABILITY SCORES ── */}
          <Grid item xs={12}><SectionLabel>Ability Scores</SectionLabel></Grid>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {(['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const).map((key) => (
                <Box key={key} sx={{ flex: 1, minWidth: 72 }}>
                  <AbilityField label={key.slice(0, 3).toUpperCase()} value={v[key]}
                    onChange={(val) => setV((p) => ({ ...p, [key]: val }))} />
                </Box>
              ))}
            </Box>
          </Grid>

          <Grid item xs={12}><Divider sx={{ borderColor: 'rgba(120,108,92,0.2)' }} /></Grid>

          {/* ── COMBAT ── */}
          <Grid item xs={12}><SectionLabel>Combat</SectionLabel></Grid>
          <Grid item xs={6} sm={3}>
            <TextField {...fs} label="HP Max" type="number" value={v.hpMax} onChange={set('hpMax')} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField {...fs} label="Armor Class" type="number" value={v.armorClass} onChange={set('armorClass')} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField {...fs} label="Speed" value={v.speed} onChange={set('speed')} placeholder="30 ft." />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField {...fs} label="Initiative" value={v.initiative} onChange={set('initiative')} placeholder="+1" />
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField {...fs} label="Prof. Bonus" value={v.proficiencyBonus} onChange={set('proficiencyBonus')} placeholder="+2" />
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField {...fs} label="Spell Save DC" value={v.spellSaveDC} onChange={set('spellSaveDC')} />
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField {...fs} label="Passive Perception" type="number" value={v.passivePerception} onChange={set('passivePerception')} />
          </Grid>

          <Grid item xs={12}><Divider sx={{ borderColor: 'rgba(120,108,92,0.2)' }} /></Grid>

          {/* ── SAVING THROWS ── */}
          <Grid item xs={12}><SectionLabel>Saving Throws</SectionLabel></Grid>
          {SAVING_THROW_KEYS.map((stat) => (
            <Grid item xs={4} sm={2} key={stat}>
              <TextField
                {...fs} label={stat.slice(0, 3)} value={v.savingThrows[stat] ?? ''}
                onChange={(e) => setST(stat, e.target.value)} placeholder="+0"
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
                {...fs} label={skill} value={v.skills[skill] ?? ''}
                onChange={(e) => setSkill(skill, e.target.value)} placeholder="+0"
                inputProps={{ style: { fontFamily: '"JetBrains Mono"' } }}
              />
            </Grid>
          ))}

          <Grid item xs={12}><Divider sx={{ borderColor: 'rgba(120,108,92,0.2)' }} /></Grid>

          {/* ── WEAPONS ── */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: -0.5 }}>
              <SectionLabel>Weapons</SectionLabel>
              <Button size="small" startIcon={<AddIcon sx={{ fontSize: 14 }} />} onClick={addWeapon}
                sx={{ color: '#c8a44a', fontSize: '0.72rem', mb: 1, minWidth: 0 }}>
                Add
              </Button>
            </Box>
          </Grid>
          {v.weapons.length === 0 && (
            <Grid item xs={12}>
              <Typography sx={{ fontSize: '0.75rem', color: '#4a3f2e', fontStyle: 'italic' }}>No weapons added.</Typography>
            </Grid>
          )}
          {v.weapons.map((w, i) => (
            <Grid item xs={12} key={i}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField size="small" label="Name" value={w.name}
                  onChange={(e) => updateWeapon(i, 'name', e.target.value)} sx={{ flex: 2 }} />
                <TextField size="small" label="Atk" value={w.attackBonus}
                  onChange={(e) => updateWeapon(i, 'attackBonus', e.target.value)}
                  placeholder="+4" sx={{ flex: 1 }}
                  inputProps={{ style: { fontFamily: '"JetBrains Mono"', textAlign: 'center' } }} />
                <TextField size="small" label="Damage" value={w.damage}
                  onChange={(e) => updateWeapon(i, 'damage', e.target.value)}
                  placeholder="1d8+2" sx={{ flex: 1.5 }}
                  inputProps={{ style: { fontFamily: '"JetBrains Mono"' } }} />
                <TextField size="small" label="Notes" value={w.notes}
                  onChange={(e) => updateWeapon(i, 'notes', e.target.value)} sx={{ flex: 2 }} />
                <IconButton size="small" onClick={() => removeWeapon(i)}
                  sx={{ color: '#786c5c', '&:hover': { color: '#b84848' }, flexShrink: 0 }}>
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            </Grid>
          ))}

          <Grid item xs={12}><Divider sx={{ borderColor: 'rgba(120,108,92,0.2)' }} /></Grid>

          <Grid item xs={12}><Divider sx={{ borderColor: 'rgba(120,108,92,0.2)' }} /></Grid>

          {/* ── SPELLS ── */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: -0.5 }}>
              <SectionLabel>Spells</SectionLabel>
              <Button size="small" startIcon={<AddIcon sx={{ fontSize: 14 }} />} onClick={addSpell}
                sx={{ color: '#62a870', fontSize: '0.72rem', mb: 1, minWidth: 0 }}>
                Add
              </Button>
            </Box>
          </Grid>
          {v.spells.length === 0 && (
            <Grid item xs={12}>
              <Typography sx={{ fontSize: '0.75rem', color: '#4a3f2e', fontStyle: 'italic' }}>No spells added.</Typography>
            </Grid>
          )}
          {v.spells.map((sp, i) => (
            <Grid item xs={12} key={i}>
              <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField size="small" label="Spell Name" value={sp.name}
                  onChange={(e) => updateSpell(i, 'name', e.target.value)} sx={{ flex: '2 1 120px' }} />
                <TextField size="small" label="Lv" type="number" value={sp.level}
                  onChange={(e) => updateSpell(i, 'level', e.target.value)}
                  inputProps={{ min: 0, max: 9, style: { textAlign: 'center', fontFamily: '"JetBrains Mono"' } }}
                  sx={{ flex: '0 0 52px' }} />
                <TextField size="small" label="Damage" value={sp.damage}
                  onChange={(e) => updateSpell(i, 'damage', e.target.value)}
                  placeholder="8d6" sx={{ flex: '1 1 72px' }}
                  inputProps={{ style: { fontFamily: '"JetBrains Mono"' } }} />
                <TextField size="small" label="+Mod" value={sp.damageMod}
                  onChange={(e) => updateSpell(i, 'damageMod', e.target.value)}
                  placeholder="+3" sx={{ flex: '0 0 56px' }}
                  inputProps={{ style: { fontFamily: '"JetBrains Mono"', textAlign: 'center' } }} />
                <TextField size="small" label="Dmg Type" value={sp.damageType}
                  onChange={(e) => updateSpell(i, 'damageType', e.target.value)}
                  placeholder="fire" sx={{ flex: '1 1 72px' }} />
                <FormControl size="small" sx={{ flex: '1 1 100px' }}>
                  <InputLabel>Casting Time</InputLabel>
                  <Select value={sp.castingTime} label="Casting Time"
                    onChange={(e) => updateSpell(i, 'castingTime', e.target.value)}>
                    {['Action','Bonus Action','Reaction','1 Minute','10 Minutes'].map((ct) => (
                      <MenuItem key={ct} value={ct}>{ct}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField size="small" label="Range" value={sp.range}
                  onChange={(e) => updateSpell(i, 'range', e.target.value)}
                  placeholder="60 ft." sx={{ flex: '1 1 72px' }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                  <Typography sx={{ fontSize: '0.65rem', cursor: 'pointer', border: `1px solid ${sp.concentration ? 'rgba(98,168,112,0.5)' : 'rgba(120,108,92,0.25)'}`, borderRadius: 0.5, px: 0.6, py: 0.3, color: sp.concentration ? '#62a870' : '#786c5c' }}
                    onClick={() => updateSpell(i, 'concentration', !sp.concentration)}>
                    C
                  </Typography>
                  <Typography sx={{ fontSize: '0.65rem', cursor: 'pointer', border: `1px solid ${sp.ritual ? 'rgba(200,164,74,0.5)' : 'rgba(120,108,92,0.25)'}`, borderRadius: 0.5, px: 0.6, py: 0.3, color: sp.ritual ? '#c8a44a' : '#786c5c' }}
                    onClick={() => updateSpell(i, 'ritual', !sp.ritual)}>
                    R
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => removeSpell(i)}
                  sx={{ color: '#786c5c', '&:hover': { color: '#b84848' }, flexShrink: 0 }}>
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            </Grid>
          ))}

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
          {v.equipment.length === 0 && (
            <Grid item xs={12}>
              <Typography sx={{ fontSize: '0.75rem', color: '#4a3f2e', fontStyle: 'italic' }}>No equipment added.</Typography>
            </Grid>
          )}
          {v.equipment.map((item, i) => (
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

          {/* Currency */}
          <Grid item xs={12}>
            <Typography sx={{ fontSize: '0.62rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: '"JetBrains Mono"', mt: 0.5 }}>
              Currency
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {CURRENCY_KEYS.map(([key, label]) => (
                <TextField key={key} size="small" label={label} type="number"
                  value={v[key] as string} onChange={set(key)} sx={{ flex: 1 }}
                  inputProps={{ style: { fontFamily: '"JetBrains Mono"', textAlign: 'center' } }} />
              ))}
            </Box>
          </Grid>

          <Grid item xs={12}><Divider sx={{ borderColor: 'rgba(120,108,92,0.2)' }} /></Grid>

          {/* ── CHARACTER INFO ── */}
          <Grid item xs={12}><SectionLabel>Character Info</SectionLabel></Grid>
          <Grid item xs={6} sm={3}>
            <TextField {...fs} label="Gender" value={v.gender} onChange={set('gender')} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField {...fs} label="Age" value={v.age} onChange={set('age')} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField {...fs} label="Height" value={v.height} onChange={set('height')} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField {...fs} label="Weight" value={v.weight} onChange={set('weight')} placeholder="lbs" />
          </Grid>
          <Grid item xs={4}>
            <TextField {...fs} label="Eyes" value={v.eyes} onChange={set('eyes')} />
          </Grid>
          <Grid item xs={4}>
            <TextField {...fs} label="Hair" value={v.hair} onChange={set('hair')} />
          </Grid>
          <Grid item xs={4}>
            <TextField {...fs} label="Skin" value={v.skin} onChange={set('skin')} />
          </Grid>

          <Grid item xs={12}><Divider sx={{ borderColor: 'rgba(120,108,92,0.2)' }} /></Grid>

          {/* ── FEATURES & TRAITS ── */}
          <Grid item xs={12}>
            <TextField {...fs} label="Features & Traits" value={v.featuresTraits}
              onChange={set('featuresTraits')} multiline rows={4}
              helperText="Separate multiple blocks with a blank line" />
          </Grid>

          {/* ── ACTIONS ── */}
          <Grid item xs={12}>
            <TextField {...fs} label="Actions" value={v.actions}
              onChange={set('actions')} multiline rows={3}
              helperText="Separate multiple blocks with a blank line" />
          </Grid>

          {/* ── PROFICIENCIES & LANGUAGES ── */}
          <Grid item xs={12}>
            <TextField {...fs} label="Proficiencies & Languages" value={v.proficienciesAndLanguages}
              onChange={set('proficienciesAndLanguages')} multiline rows={3}
              placeholder="Languages, armor, weapon, tool proficiencies…" />
          </Grid>

        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: '#786c5c' }}>Cancel</Button>
        <Button onClick={() => onSave(v)} disabled={!v.name.trim()} variant="contained" size="small"
          sx={{ bgcolor: '#c8a44a', color: '#0b0906', '&:hover': { bgcolor: '#e6c86a' } }}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
