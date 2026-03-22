// D&D Beyond character import & parsing

// ─── Types ───────────────────────────────────────────────────────────────────

export type DdbModifier = { type: string; subType: string; value: number | null }

export type DdbInventoryItem = {
  quantity: number; equipped: boolean
  definition: {
    name: string; armorClass: number | null; armorTypeId: number | null
    damage: { diceString: string } | null; attackType: number | null
    type: string; properties?: Array<{ name: string }>
  } | null
}

export type DdbClass = {
  level: number
  definition: { name: string; hitDice: number; spellCastingAbilityId?: number | null }
  subclassDefinition?: { name: string }
}

export type DdbSpellDie = { diceCount: number | null; diceValue: number | null; diceString: string | null }

export type DdbSpellModifier = {
  type: string; subType: string
  die: DdbSpellDie | null
  usePrimaryStat: boolean
  atHigherLevels: { higherLevelDefinitions: Array<{ level: number; typeId: number; dice?: DdbSpellDie | null; die?: DdbSpellDie | null }> } | null
}

export type DdbSpellDef = {
  name: string; level: number; school: string
  activation: { activationType: number | null } | null
  range: { origin: string; rangeValue: number | null; aoeType: string | null; aoeValue: number | null } | null
  concentration: boolean; ritual: boolean
  scaleType: string | null
  modifiers: DdbSpellModifier[]
}

export type DdbClassSpells = {
  spellCastingAbilityId: number | null
  spells: Array<{ definition: DdbSpellDef; prepared: boolean | null; alwaysPrepared: boolean }>
}

export type DdbCharacterData = {
  name: string; username: string; gender: string; age: number; hair: string
  eyes: string; skin: string; height: string; weight: number
  baseHitPoints: number; bonusHitPoints: number; overrideHitPoints: number | null; removedHitPoints: number
  bonusStats: Array<{ id: number; value: number | null }> | null
  overrideStats: Array<{ id: number; value: number | null }> | null
  stats: Array<{ id: number; value: number | null }>
  classes: DdbClass[]
  race: { fullName: string; baseName: string } | null
  background: { definition?: { name: string } | null; customBackground?: unknown } | null
  decorations: { avatarUrl: string | null } | null
  inventory: DdbInventoryItem[]
  currencies: { cp: number; sp: number; ep: number; gp: number; pp: number } | null
  modifiers: Record<string, DdbModifier[]>
  customProficiencies: Array<{ name: string; type: number }>
  classSpells: DdbClassSpells[] | null
  spells: Record<string, Array<{ definition: DdbSpellDef; prepared?: boolean | null; alwaysPrepared?: boolean }>> | null
  spellSlots: Array<{ level: number; available: number; used: number }> | null
  pactMagic: Array<{ level: number; available: number; used: number }> | null
  options: Record<string, Array<{ definition: { name: string } | null }>> | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function modNum(score: number) { return Math.floor((score - 10) / 2) }
function modStr(score: number) { const m = modNum(score); return m >= 0 ? `+${m}` : `${m}` }

const castingTimeLabels: Record<number, string> = {
  1: 'Action', 2: '', 3: 'Bonus Action', 4: 'Reaction', 6: '1 Minute', 7: '10 Minutes',
}

function formatDdbRange(r: DdbSpellDef['range']): string | undefined {
  if (!r) return undefined
  const { origin, rangeValue, aoeType, aoeValue } = r
  if (origin === 'Touch') return 'Touch'
  if (origin === 'Self' && aoeType && aoeValue) return `Self (${aoeValue}-ft. ${aoeType.toLowerCase()})`
  if (origin === 'Self') return 'Self'
  if (origin === 'Sight') return 'Sight'
  if (origin === 'Unlimited') return 'Unlimited'
  if (origin === 'Special') return 'Special'
  if (rangeValue) return `${rangeValue} ft.`
  return origin || undefined
}

const PACT_LEVEL_TABLE = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]
// Number of pact magic slots per Warlock level (index = level)
const PACT_SLOT_COUNT  = [0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4]

// Standard multiclass spell slot table indexed by combined caster level (1-20)
// Values: [L1, L2, L3, L4, L5, L6, L7, L8, L9]
const FULL_CASTER_SLOTS: number[][] = [
  [2],                         // 1
  [3],                         // 2
  [4, 2],                      // 3
  [4, 3],                      // 4
  [4, 3, 2],                   // 5
  [4, 3, 3],                   // 6
  [4, 3, 3, 1],                // 7
  [4, 3, 3, 2],                // 8
  [4, 3, 3, 3, 1],             // 9
  [4, 3, 3, 3, 2],             // 10
  [4, 3, 3, 3, 2, 1],          // 11
  [4, 3, 3, 3, 2, 1],          // 12
  [4, 3, 3, 3, 2, 1, 1],       // 13
  [4, 3, 3, 3, 2, 1, 1],       // 14
  [4, 3, 3, 3, 2, 1, 1, 1],    // 15
  [4, 3, 3, 3, 2, 1, 1, 1],    // 16
  [4, 3, 3, 3, 2, 1, 1, 1, 1], // 17
  [4, 3, 3, 3, 3, 1, 1, 1, 1], // 18
  [4, 3, 3, 3, 3, 2, 1, 1, 1], // 19
  [4, 3, 3, 3, 3, 2, 2, 1, 1], // 20
]

const FULL_CASTER_NAMES = new Set(['bard', 'cleric', 'druid', 'sorcerer', 'wizard'])
const HALF_CASTER_NAMES = new Set(['paladin', 'ranger', 'artificer'])

function computeMaxSpellSlots(classes: DdbClass[]): number[] {
  let casterLevel = 0
  for (const cls of classes) {
    const name = cls.definition?.name?.toLowerCase() ?? ''
    const subclass = cls.subclassDefinition?.name?.toLowerCase() ?? ''
    // Warlocks use pact magic (separate), not the standard slot table
    if (FULL_CASTER_NAMES.has(name)) {
      casterLevel += cls.level
    } else if (HALF_CASTER_NAMES.has(name)) {
      casterLevel += Math.floor(cls.level / 2)
    } else if (subclass.includes('arcane trickster') || subclass.includes('eldritch knight')) {
      casterLevel += Math.floor(cls.level / 3)
    }
  }
  if (casterLevel < 1) return []
  return FULL_CASTER_SLOTS[Math.min(casterLevel, 20) - 1] ?? []
}

// ─── Main parser ─────────────────────────────────────────────────────────────

export function parseDdbCharacter(d: DdbCharacterData) {
  // Ability scores — base + racial/feat/ASI bonuses from modifiers + explicit bonusStats + overrides
  const statNames = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']
  const statValues: Record<string, number> = {}
  for (const stat of d.stats ?? []) {
    const name = statNames[stat.id - 1]
    if (name && stat.value != null) statValues[name] = stat.value
  }
  // Apply score bonuses from all modifier sources (racial, feat, ASI, etc.)
  for (const mod of Object.values(d.modifiers ?? {}).flat()) {
    if (mod.type === 'bonus' && mod.value != null) {
      const match = statNames.find((n) => mod.subType === `${n}-score`)
      if (match) statValues[match] = (statValues[match] ?? 10) + mod.value
    }
  }
  // Override stats take final precedence (manually set stat totals)
  for (const override of d.overrideStats ?? []) {
    const name = statNames[override.id - 1]
    if (name && override.value != null) statValues[name] = override.value
  }

  // Class & level
  const cls = d.classes?.[0]
  const level = cls?.level ?? 1
  const className = cls?.definition?.name
  const subclassName = cls?.subclassDefinition?.name
  const classDisplay = subclassName ? `${className} (${subclassName})` : className
  const allClasses = (d.classes ?? []).map((c) => `${c.definition?.name} ${c.level}`).join(' / ')
  const hitDice = cls?.definition?.hitDice ? `${level}d${cls.definition.hitDice}` : undefined

  const background = d.background?.definition?.name ??
    (d.background?.customBackground != null ? 'Custom Background' : undefined)

  // HP — baseHitPoints is dice-only (no CON bonus); CON mod × level must be added
  const conMod = modNum(statValues.constitution ?? 10)
  const hpMax = d.overrideHitPoints ?? (d.baseHitPoints + level * conMod + (d.bonusHitPoints ?? 0))
  const hpCurrent = Math.max(0, hpMax - (d.removedHitPoints ?? 0))

  // Proficiency bonus
  const profBonusNum = Math.ceil(level / 4) + 1
  const profBonusStr = `+${profBonusNum}`

  // Flatten all modifiers
  const allMods: DdbModifier[] = Object.values(d.modifiers ?? {}).flat()
  const hasProfIn = (subType: string) => allMods.some((m) => m.type === 'proficiency' && m.subType === subType)
  const hasExpertiseIn = (subType: string) => allMods.some((m) => m.type === 'expertise' && m.subType === subType)

  // Saving throws
  const stAbilities = [
    ['Strength', 'strength', 'strength-saving-throws'],
    ['Dexterity', 'dexterity', 'dexterity-saving-throws'],
    ['Constitution', 'constitution', 'constitution-saving-throws'],
    ['Intelligence', 'intelligence', 'intelligence-saving-throws'],
    ['Wisdom', 'wisdom', 'wisdom-saving-throws'],
    ['Charisma', 'charisma', 'charisma-saving-throws'],
  ] as const
  const savingThrows: Record<string, string> = {}
  for (const [label, stat, subType] of stAbilities) {
    const base = modNum(statValues[stat] ?? 10)
    const bonus = base + (hasProfIn(subType) ? profBonusNum : 0)
    savingThrows[label] = bonus >= 0 ? `+${bonus}` : `${bonus}`
  }

  // Skills
  const skillDefs = [
    ['Acrobatics', 'dexterity', 'acrobatics'],
    ['Animal Handling', 'wisdom', 'animal-handling'],
    ['Arcana', 'intelligence', 'arcana'],
    ['Athletics', 'strength', 'athletics'],
    ['Deception', 'charisma', 'deception'],
    ['History', 'intelligence', 'history'],
    ['Insight', 'wisdom', 'insight'],
    ['Intimidation', 'charisma', 'intimidation'],
    ['Investigation', 'intelligence', 'investigation'],
    ['Medicine', 'wisdom', 'medicine'],
    ['Nature', 'intelligence', 'nature'],
    ['Perception', 'wisdom', 'perception'],
    ['Performance', 'charisma', 'performance'],
    ['Persuasion', 'charisma', 'persuasion'],
    ['Religion', 'intelligence', 'religion'],
    ['Sleight of Hand', 'dexterity', 'sleight-of-hand'],
    ['Stealth', 'dexterity', 'stealth'],
    ['Survival', 'wisdom', 'survival'],
  ] as const
  const skills: Record<string, string> = {}
  for (const [label, stat, subType] of skillDefs) {
    const base = modNum(statValues[stat] ?? 10)
    const extra = hasExpertiseIn(subType) ? profBonusNum * 2 : hasProfIn(subType) ? profBonusNum : 0
    const bonus = base + extra
    skills[label] = bonus >= 0 ? `+${bonus}` : `${bonus}`
  }

  // Passive perception
  const passivePerception = 10 + modNum(statValues.wisdom ?? 10) + (hasProfIn('perception') ? profBonusNum : 0)

  // AC from equipped armor
  const strMod = modNum(statValues.strength ?? 10)
  const dexMod = modNum(statValues.dexterity ?? 10)
  let baseAC = 10 + dexMod
  let shieldBonus = 0
  for (const item of d.inventory ?? []) {
    if (!item.equipped || !item.definition?.armorClass) continue
    const { armorTypeId, armorClass } = item.definition
    if (armorTypeId === 4) shieldBonus = armorClass
    else if (armorTypeId === 1) baseAC = armorClass + dexMod
    else if (armorTypeId === 2) baseAC = armorClass + Math.min(dexMod, 2)
    else if (armorTypeId === 3) baseAC = armorClass
  }
  const unarmoredDef = allMods.find((m) => m.type === 'set' && m.subType === 'unarmored-armor-class')
  if (unarmoredDef) baseAC = 10 + dexMod + modNum(statValues.constitution ?? 10)
  const totalAC = baseAC + shieldBonus

  // Speed — 'set' overrides base (e.g. Barbarian fast movement sets to 40)
  //         'bonus' adds to base (e.g. Wood Elf Fleet of Foot +5, subType: 'walking-speed')
  const speedSet = allMods.find((m) => (m.subType === 'speed' || m.subType === 'walking-speed') && m.type === 'set' && m.value)
  const speedBonus = allMods.filter((m) => (m.subType === 'speed' || m.subType === 'walking-speed') && m.type === 'bonus' && m.value).reduce((s, m) => s + (m.value ?? 0), 0)
  const speedFt = speedSet?.value ?? (30 + speedBonus)
  const speedStr = `${speedFt} ft.`

  // Initiative
  const initiativeStr = modStr(statValues.dexterity ?? 10)

  // Weapons
  const isFinesseOrRanged = (item: DdbInventoryItem) => {
    const props = item.definition?.properties?.map((p) => p.name.toLowerCase()) ?? []
    return props.includes('finesse') || (item.definition?.attackType === 2)
  }
  const weapons = (d.inventory ?? [])
    .filter((i) => i.equipped && i.definition?.attackType != null)
    .map((i) => {
      const defn = i.definition!
      const usesDex = isFinesseOrRanged(i) && dexMod > strMod
      const atkMod = (usesDex ? dexMod : strMod) + profBonusNum
      const dmgMod = usesDex ? dexMod : strMod
      const atkBonus = atkMod >= 0 ? `+${atkMod}` : `${atkMod}`
      let damage = defn.damage?.diceString ?? '1'
      if (dmgMod !== 0) damage += dmgMod > 0 ? `+${dmgMod}` : `${dmgMod}`
      return { name: defn.name, attackBonus: atkBonus, damage }
    })
  const unarmedAtk = strMod + profBonusNum
  weapons.push({
    name: 'Unarmed Strike',
    attackBonus: unarmedAtk >= 0 ? `+${unarmedAtk}` : `${unarmedAtk}`,
    damage: `${Math.max(1, 1 + strMod)} Bludgeoning`,
  })

  // Equipment list
  const equipment = (d.inventory ?? [])
    .filter((i) => i.definition)
    .map((i) => ({ name: i.definition!.name, qty: i.quantity != null ? String(i.quantity) : undefined }))

  // Spellcasting
  const spellCastingAbilityId = d.classSpells?.find((cs) => cs.spellCastingAbilityId)?.spellCastingAbilityId
    ?? d.classes?.find((c) => c.definition?.spellCastingAbilityId)?.definition?.spellCastingAbilityId
  const spellAbilityName = spellCastingAbilityId === 4 ? 'intelligence'
    : spellCastingAbilityId === 5 ? 'wisdom'
    : spellCastingAbilityId === 6 ? 'charisma' : null
  const spellAbilityMod = spellAbilityName ? modNum(statValues[spellAbilityName] ?? 10) : null
  const spellSaveDcBonuses = allMods.filter((m) => m.type === 'bonus' && m.subType === 'spell-save-dc' && m.value).reduce((s, m) => s + (m.value ?? 0), 0)
  const spellAtkBonuses = allMods.filter((m) => m.type === 'bonus' && m.subType === 'spell-attacks' && m.value).reduce((s, m) => s + (m.value ?? 0), 0)
  const spellSaveDcNum = spellAbilityMod != null ? 8 + profBonusNum + spellAbilityMod + spellSaveDcBonuses : null
  const spellAtkNum = spellAbilityMod != null ? profBonusNum + spellAbilityMod + spellAtkBonuses : null

  // Agonizing Blast
  const hasAgonizingBlast = Object.values(d.options ?? {}).flat()
    .some((o) => o?.definition?.name === 'Agonizing Blast')

  function mapSpellDef(def: DdbSpellDef) {
    const actType = def.activation?.activationType
    const dmgMod = def.modifiers?.find((m) => m.type === 'damage' && m.die?.diceString)
    let damageDice = dmgMod?.die?.diceString ?? undefined
    // Cantrip scaling
    if (damageDice && def.scaleType === 'characterlevel' && dmgMod?.atHigherLevels?.higherLevelDefinitions?.length) {
      const scaled = [...dmgMod.atHigherLevels.higherLevelDefinitions]
        .sort((a, b) => b.level - a.level)
        .find((hld) => level >= hld.level)
      const scaledDice = scaled?.die?.diceString ?? scaled?.dice?.diceString
      if (scaledDice) damageDice = scaledDice
    }
    // Damage modifier
    let damageMod: number | undefined
    if (dmgMod?.usePrimaryStat && spellAbilityMod != null) {
      damageMod = spellAbilityMod
    } else if (def.name === 'Eldritch Blast' && hasAgonizingBlast && spellAbilityMod != null) {
      damageMod = spellAbilityMod
    }
    const damageType = dmgMod?.subType ?? undefined
    // Upcast scaling (typeId=15 = dice added per slot level)
    const upcastDef = dmgMod?.atHigherLevels?.higherLevelDefinitions?.find((h) => h.typeId === 15)
    const upcastDice = (upcastDef?.die?.diceString ?? upcastDef?.dice?.diceString) ?? undefined
    // canUpcast: true if any modifier has any higherLevelDefinitions (e.g. Magic Missile adds darts, not dice)
    const canUpcast = def.level > 0 && def.modifiers?.some((m) => m.atHigherLevels?.higherLevelDefinitions?.length)
    return {
      name: def.name,
      level: def.level,
      school: def.school ?? undefined,
      castingTime: actType != null ? (castingTimeLabels[actType] || undefined) : undefined,
      range: formatDdbRange(def.range),
      concentration: def.concentration || undefined,
      ritual: def.ritual || undefined,
      damage: damageDice ?? undefined,
      damageType: damageType ?? undefined,
      damageMod: damageMod ?? undefined,
      upcastDice: upcastDice ?? undefined,
      canUpcast: canUpcast || undefined,
    }
  }

  // Merge classSpells + granted spells (pact boon, race, feat, etc.), deduplicate
  const allSpellEntries = [
    ...(d.classSpells ?? []).flatMap((cs) => cs.spells.map((sp) => sp.definition)),
    ...Object.values(d.spells ?? {}).flatMap((arr) => (arr ?? []).map((sp) => sp.definition)),
  ]
  const spells = allSpellEntries
    .filter((def): def is DdbSpellDef => !!def?.name)
    .map(mapSpellDef)
    .filter((sp, idx, arr) => arr.findIndex((s) => s.name === sp.name && s.level === sp.level) === idx)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))

  // Spell slots — max from class progression table; remaining from DDB (slot.used = remaining)
  const spellSlots: Record<string, number> = {}
  const spellSlotsRemaining: Record<string, number> = {}
  // Regular spell slots (non-Warlock casters)
  const maxSlots = computeMaxSpellSlots(d.classes ?? [])
  maxSlots.forEach((count, idx) => {
    if (count > 0) spellSlots[String(idx + 1)] = count
  })
  for (const slot of d.spellSlots ?? []) {
    if (slot.used > 0) spellSlotsRemaining[String(slot.level)] = slot.used
  }
  // Pact magic — always derived from Warlock class level table (both 2014 and 2024)
  const warlockClass = d.classes?.find((c) => c.definition?.name?.toLowerCase().includes('warlock'))
  const pactMagicLevel = warlockClass
    ? PACT_LEVEL_TABLE[Math.min(warlockClass.level, 20)] || undefined
    : undefined
  if (pactMagicLevel && warlockClass) {
    const pactCount = PACT_SLOT_COUNT[Math.min(warlockClass.level, 20)]
    const key = String(pactMagicLevel)
    spellSlots[key] = (spellSlots[key] ?? 0) + pactCount
    // Remaining: prefer DDB tracking data, fall back to full count
    const ddbRemaining = (d.pactMagic ?? []).find((s) => s.level === pactMagicLevel)?.used
    const remaining = ddbRemaining ?? pactCount
    if (remaining > 0) spellSlotsRemaining[key] = (spellSlotsRemaining[key] ?? 0) + remaining
  }

  // Currency
  const cur = d.currencies
  const currency =
    cur && (cur.cp || cur.sp || cur.ep || cur.gp || cur.pp)
      ? { cp: cur.cp || undefined, sp: cur.sp || undefined, ep: cur.ep || undefined, gp: cur.gp || undefined, pp: cur.pp || undefined }
      : undefined

  return {
    name: d.name,
    playerName: d.username || undefined,
    race: d.race?.fullName ?? d.race?.baseName,
    class: (d.classes?.length ?? 0) > 1 ? allClasses : (classDisplay || undefined),
    level,
    background,
    gender: d.gender || undefined,
    age: d.age != null ? String(d.age) : undefined,
    height: d.height || undefined,
    weight: d.weight != null ? String(d.weight) : undefined,
    eyes: d.eyes || undefined,
    skin: d.skin || undefined,
    hair: d.hair || undefined,
    ...statValues,
    strengthMod: modStr(statValues.strength ?? 10),
    dexterityMod: modStr(statValues.dexterity ?? 10),
    constitutionMod: modStr(statValues.constitution ?? 10),
    intelligenceMod: modStr(statValues.intelligence ?? 10),
    wisdomMod: modStr(statValues.wisdom ?? 10),
    charismaMod: modStr(statValues.charisma ?? 10),
    hpMax,
    hpCurrent,
    armorClass: totalAC,
    speed: speedStr,
    initiative: initiativeStr,
    hitDice,
    proficiencyBonus: profBonusStr,
    passivePerception,
    savingThrows,
    skills,
    weapons: weapons.length ? weapons : undefined,
    equipment: equipment.length ? equipment : undefined,
    currency,
    spells: spells.length ? spells : undefined,
    spellAttackBonus: spellAtkNum != null ? (spellAtkNum >= 0 ? `+${spellAtkNum}` : `${spellAtkNum}`) : undefined,
    spellSaveDC: spellSaveDcNum != null ? String(spellSaveDcNum) : undefined,
    spellSaveDCValue: spellSaveDcNum ?? undefined,
    spellSlots: Object.keys(spellSlots).length ? spellSlots : undefined,
    spellSlotsRemaining: Object.keys(spellSlotsRemaining).length ? spellSlotsRemaining : undefined,
    pactMagicLevel,
    portraitUrl: d.decorations?.avatarUrl || undefined,
  }
}
