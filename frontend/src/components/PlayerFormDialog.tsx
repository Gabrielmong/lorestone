import { useState, useEffect } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Grid, TextField, Typography, Box, Divider, Select, MenuItem,
  FormControl, InputLabel,
} from '@mui/material'

export interface PlayerFormValues {
  name: string
  playerName: string
  race: string
  class: string
  level: string
  background: string
  alignment: string
  // Combat
  hpMax: string
  armorClass: string
  speed: string
  initiative: string
  hitDice: string
  proficiencyBonus: string
  // Ability scores
  strength: string
  dexterity: string
  constitution: string
  intelligence: string
  wisdom: string
  charisma: string
  // Extra
  description: string
  proficienciesAndLanguages: string
}

const BLANK: PlayerFormValues = {
  name: '', playerName: '', race: '', class: '', level: '', background: '', alignment: '',
  hpMax: '', armorClass: '', speed: '', initiative: '', hitDice: '', proficiencyBonus: '',
  strength: '', dexterity: '', constitution: '', intelligence: '', wisdom: '', charisma: '',
  description: '', proficienciesAndLanguages: '',
}

const ALIGNMENTS = [
  'Lawful Good', 'Neutral Good', 'Chaotic Good',
  'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
  'Lawful Evil', 'Neutral Evil', 'Chaotic Evil',
]

function mod(score: string): string {
  const n = parseInt(score)
  if (isNaN(n)) return '—'
  const m = Math.floor((n - 10) / 2)
  return m >= 0 ? `+${m}` : `${m}`
}

function AbilityField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Box sx={{ textAlign: 'center' }}>
      <TextField
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type="number"
        size="small"
        inputProps={{ min: 1, max: 30, style: { textAlign: 'center', fontFamily: '"JetBrains Mono"', fontWeight: 700, fontSize: '1.1rem' } }}
        sx={{ '& input': { py: 1 } }}
      />
      <Typography sx={{ fontSize: '0.72rem', color: '#c8a44a', fontFamily: '"JetBrains Mono"', mt: 0.25 }}>
        {mod(value)}
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
  const [v, setV] = useState<PlayerFormValues>(BLANK)

  useEffect(() => {
    if (open) setV({ ...BLANK, ...initial })
  }, [open, initial])

  const set = (key: keyof PlayerFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((prev) => ({ ...prev, [key]: e.target.value }))

  const fieldSx = { size: 'small' as const, fullWidth: true }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: '#0f0d0a', border: '1px solid rgba(120,108,92,0.3)' } }}>
      <DialogTitle sx={{ color: '#e6d8c0', fontFamily: '"Cinzel", serif', fontSize: '1rem', pb: 1 }}>
        {title ?? 'New Player Character'}
      </DialogTitle>

      <DialogContent dividers sx={{ borderColor: 'rgba(120,108,92,0.2)' }}>
        <Grid container spacing={2}>
          {/* Identity */}
          <Grid item xs={12}>
            <Typography sx={{ fontSize: '0.68rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 1, fontFamily: '"JetBrains Mono"', mb: 1 }}>
              Identity
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField {...fieldSx} label="Character Name *" value={v.name} onChange={set('name')} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField {...fieldSx} label="Player Name" value={v.playerName} onChange={set('playerName')} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField {...fieldSx} label="Race / Species" value={v.race} onChange={set('race')} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField {...fieldSx} label="Class" value={v.class} onChange={set('class')} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField {...fieldSx} label="Level" type="number" value={v.level} onChange={set('level')}
              inputProps={{ min: 1, max: 20 }} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField {...fieldSx} label="Hit Dice" value={v.hitDice} onChange={set('hitDice')} placeholder="1d10" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField {...fieldSx} label="Background" value={v.background} onChange={set('background')} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl {...fieldSx}>
              <InputLabel>Alignment</InputLabel>
              <Select value={v.alignment} onChange={(e) => setV((p) => ({ ...p, alignment: e.target.value }))} label="Alignment">
                <MenuItem value=""><em>None</em></MenuItem>
                {ALIGNMENTS.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField {...fieldSx} label="Brief Description" value={v.description} onChange={set('description')} />
          </Grid>

          <Grid item xs={12}><Divider sx={{ borderColor: 'rgba(120,108,92,0.2)' }} /></Grid>

          {/* Ability Scores */}
          <Grid item xs={12}>
            <Typography sx={{ fontSize: '0.68rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 1, fontFamily: '"JetBrains Mono"', mb: 1 }}>
              Ability Scores
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {(['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const).map((key) => (
                <Box key={key} sx={{ flex: 1, minWidth: 72 }}>
                  <AbilityField
                    label={key.slice(0, 3).toUpperCase()}
                    value={v[key]}
                    onChange={(val) => setV((p) => ({ ...p, [key]: val }))}
                  />
                </Box>
              ))}
            </Box>
          </Grid>

          <Grid item xs={12}><Divider sx={{ borderColor: 'rgba(120,108,92,0.2)' }} /></Grid>

          {/* Combat */}
          <Grid item xs={12}>
            <Typography sx={{ fontSize: '0.68rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 1, fontFamily: '"JetBrains Mono"', mb: 1 }}>
              Combat
            </Typography>
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField {...fieldSx} label="HP Max" type="number" value={v.hpMax} onChange={set('hpMax')} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField {...fieldSx} label="Armor Class" type="number" value={v.armorClass} onChange={set('armorClass')} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField {...fieldSx} label="Speed" value={v.speed} onChange={set('speed')} placeholder="30 ft." />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField {...fieldSx} label="Initiative" value={v.initiative} onChange={set('initiative')} placeholder="+1" />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField {...fieldSx} label="Prof. Bonus" value={v.proficiencyBonus} onChange={set('proficiencyBonus')} placeholder="+2" />
          </Grid>

          <Grid item xs={12}><Divider sx={{ borderColor: 'rgba(120,108,92,0.2)' }} /></Grid>

          {/* Proficiencies */}
          <Grid item xs={12}>
            <TextField
              {...fieldSx}
              label="Proficiencies & Languages"
              value={v.proficienciesAndLanguages}
              onChange={set('proficienciesAndLanguages')}
              multiline rows={3}
              placeholder="Languages, armor, weapon, tool proficiencies..."
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: '#786c5c' }}>Cancel</Button>
        <Button
          onClick={() => onSave(v)}
          disabled={!v.name.trim()}
          variant="contained" size="small"
          sx={{ bgcolor: '#c8a44a', color: '#0b0906', '&:hover': { bgcolor: '#e6c86a' } }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
