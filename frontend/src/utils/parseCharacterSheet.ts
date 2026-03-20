import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export interface ParsedWeapon {
  name: string
  attackBonus?: string
  damage?: string
  notes?: string
}

export interface ParsedCharacterSheet {
  // Identity
  name?: string
  playerName?: string
  race?: string
  class?: string
  level?: number
  background?: string
  alignment?: string
  experiencePoints?: string
  gender?: string
  age?: string
  height?: string
  weight?: string
  size?: string
  eyes?: string
  skin?: string
  hair?: string

  // Ability scores
  strength?: number
  dexterity?: number
  constitution?: number
  intelligence?: number
  wisdom?: number
  charisma?: number

  // Modifiers (stored as strings like "+2")
  strengthMod?: string
  dexterityMod?: string
  constitutionMod?: string
  intelligenceMod?: string
  wisdomMod?: string
  charismaMod?: string

  // Combat
  armorClass?: number
  initiative?: string
  speed?: string
  hpMax?: number
  hpCurrent?: number
  hitDice?: string
  proficiencyBonus?: string
  spellSaveDC?: string

  // Passive senses
  passivePerception?: number
  passiveInsight?: number
  passiveInvestigation?: number

  // Saving throws (e.g. { Strength: "+4", Constitution: "+6" })
  savingThrows?: Record<string, string>

  // Skills (e.g. { Acrobatics: "+3", Athletics: "+4" })
  skills?: Record<string, string>
  customSkills?: Array<{ name: string; bonus: string }>

  // Combat: weapons
  weapons?: ParsedWeapon[]

  // Narrative text blocks
  featuresTraits?: string[]
  actions?: string[]
  proficienciesAndLanguages?: string

  // Equipment
  equipment?: Array<{ name: string; qty?: string; weight?: string }>

  // Currency
  currency?: { cp?: number; sp?: number; ep?: number; gp?: number; pp?: number }

  // Spells (raw from page 4 if present)
  spellcastingClass?: string
  spellcastingAbility?: string

  // Raw field dump for debugging
  _fields?: Record<string, string>
}

async function extractFormFields(file: File | ArrayBuffer): Promise<Record<string, string>> {
  const arrayBuffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const fields: Record<string, string> = {}

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const annotations = await page.getAnnotations()
    for (const ann of annotations) {
      if (ann.subtype === 'Widget' && ann.fieldName && ann.fieldValue !== undefined) {
        const key = (ann.fieldName as string).trim()
        const val = String(ann.fieldValue).trim()
        if (val && val !== 'Off') {
          fields[key] = val
        }
      }
    }
  }
  return fields
}

function num(val: string | undefined): number | undefined {
  if (!val) return undefined
  const n = parseInt(val.replace(/[^0-9-]/g, ''), 10)
  return isNaN(n) ? undefined : n
}

function parseClassLevel(raw: string | undefined): { class?: string; level?: number } {
  if (!raw) return {}
  // e.g. "Champion 1" or "Wizard 5" or "Fighter/Rogue 3"
  const m = raw.match(/^(.+?)\s+(\d+)$/)
  if (m) return { class: m[1].trim(), level: parseInt(m[2]) }
  return { class: raw }
}

function parseSpeed(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  // "30 ft. (Walking)" → "30 ft."
  return raw.replace(/\s*\(.*?\)/, '').trim()
}

export async function parseCharacterSheet(file: File | ArrayBuffer): Promise<ParsedCharacterSheet> {
  const fields = await extractFormFields(file)

  const { class: charClass, level } = parseClassLevel(fields['CLASS  LEVEL'] ?? fields['CLASS & LEVEL'])

  const savingThrows: Record<string, string> = {}
  const stMap: Record<string, string> = {
    'ST Strength': 'Strength', 'ST Dexterity': 'Dexterity', 'ST Constitution': 'Constitution',
    'ST Intelligence': 'Intelligence', 'ST Wisdom': 'Wisdom', 'ST Charisma': 'Charisma',
  }
  for (const [k, label] of Object.entries(stMap)) {
    if (fields[k]) savingThrows[label] = fields[k]
  }

  const skills: Record<string, string> = {}
  const skillFields = [
    'Acrobatics', 'Animal', 'Arcana', 'Athletics', 'Deception', 'History',
    'Insight', 'Intimidation', 'Investigation', 'Medicine', 'Nature', 'Perception',
    'Performance', 'Persuasion', 'Religion', 'SleightofHand', 'Stealth ', 'Survival',
  ]
  const skillLabels: Record<string, string> = {
    'Animal': 'Animal Handling', 'SleightofHand': 'Sleight of Hand', 'Stealth ': 'Stealth',
  }
  for (const sk of skillFields) {
    if (fields[sk]) skills[skillLabels[sk] ?? sk] = fields[sk]
  }

  const customSkills: Array<{ name: string; bonus: string }> = []
  for (let i = 1; i <= 5; i++) {
    const name = fields[`CustomSkill${i}`]
    const bonus = fields[`Custom Skill Bonus ${i}`]
    if (name && bonus) customSkills.push({ name, bonus })
  }

  const weapons: ParsedWeapon[] = []
  // First weapon (no suffix)
  if (fields['Wpn Name']) {
    weapons.push({
      name: fields['Wpn Name'],
      attackBonus: fields['Wpn1 AtkBonus'],
      damage: fields['Wpn1 Damage'],
      notes: fields['Wpn Notes 1'],
    })
  }
  // Additional weapons (suffix 2, 3, …)
  for (let i = 2; i <= 6; i++) {
    const name = fields[`Wpn Name ${i}`] ?? fields[`Wpn Name${i}`]
    if (!name) continue
    weapons.push({
      name,
      attackBonus: fields[`Wpn${i} AtkBonus `] ?? fields[`Wpn${i} AtkBonus`],
      damage: fields[`Wpn${i} Damage `] ?? fields[`Wpn${i} Damage`],
      notes: fields[`Wpn Notes ${i}`],
    })
  }

  const equipment: Array<{ name: string; qty?: string; weight?: string }> = []
  for (let i = 0; i <= 20; i++) {
    const name = fields[`Eq Name${i}`]
    if (!name) continue
    equipment.push({
      name,
      qty: fields[`Eq Qty${i}`],
      weight: fields[`Eq Weight${i}`],
    })
  }

  const featuresTraits = [fields['FeaturesTraits1'], fields['FeaturesTraits2'], fields['FeaturesTraits3']]
    .filter(Boolean) as string[]

  const actions = [fields['Actions1'], fields['Actions2'], fields['Actions3']]
    .filter(Boolean) as string[]

  const cp = num(fields['CP'])
  const sp = num(fields['SP'])
  const ep = num(fields['EP'])
  const gp = num(fields['GP'])
  const pp = num(fields['PP'])
  const hasCurrency = [cp, sp, ep, gp, pp].some((v) => v != null && v > 0)

  return {
    name: fields['CharacterName'] ?? fields['CharacterName2'] ?? fields['CharacterName4'],
    playerName: fields['PLAYER NAME'] ?? fields['PLAYER NAME2'],
    race: fields['RACE'] ?? fields['SPECIES'] ?? fields['RACE2'],
    class: charClass,
    level,
    background: fields['BACKGROUND'] ?? fields['BACKGROUND2'],
    alignment: fields['ALIGNMENT'],
    experiencePoints: fields['EXPERIENCE POINTS'] ?? fields['EXPERIENCE POINTS2'],
    gender: fields['GENDER'],
    age: fields['AGE'],
    height: fields['HEIGHT'],
    weight: fields['WEIGHT'],
    size: fields['SIZE'],
    eyes: fields['EYES'],
    skin: fields['SKIN'],
    hair: fields['HAIR'],

    strength: num(fields['STR']),
    dexterity: num(fields['DEX']),
    constitution: num(fields['CON']),
    intelligence: num(fields['INT']),
    wisdom: num(fields['WIS']),
    charisma: num(fields['CHA']),

    strengthMod: fields['STRmod'],
    dexterityMod: fields['DEXmod '] ?? fields['DEXmod'],
    constitutionMod: fields['CONmod'],
    intelligenceMod: fields['INTmod'],
    wisdomMod: fields['WISmod'],
    charismaMod: fields['CHamod'] ?? fields['CHAmod'],

    armorClass: num(fields['AC']),
    initiative: fields['Init'],
    speed: parseSpeed(fields['Speed']),
    hpMax: num(fields['MaxHP']),
    hpCurrent: num(fields['MaxHP']), // sheets don't persist current HP
    hitDice: fields['Total'],
    proficiencyBonus: fields['ProfBonus'],
    spellSaveDC: fields['Spell Save DC'] ?? fields['SPELL SAVE DC'],

    passivePerception: num(fields['Passive1']),
    passiveInsight: num(fields['Passive2']),
    passiveInvestigation: num(fields['Passive3']),

    savingThrows: Object.keys(savingThrows).length ? savingThrows : undefined,
    skills: Object.keys(skills).length ? skills : undefined,
    customSkills: customSkills.length ? customSkills : undefined,

    weapons: weapons.length ? weapons : undefined,
    featuresTraits: featuresTraits.length ? featuresTraits : undefined,
    actions: actions.length ? actions : undefined,
    proficienciesAndLanguages: fields['ProficienciesLang'],

    equipment: equipment.length ? equipment : undefined,
    currency: hasCurrency ? { cp, sp, ep, gp, pp } : undefined,

    spellcastingClass: fields['Spellcasting Class'] ?? fields['SPELLCASTING CLASS'],
    spellcastingAbility: fields['SpellcastingAbility'] ?? fields['SPELLCASTING ABILITY'],

    _fields: fields,
  }
}
