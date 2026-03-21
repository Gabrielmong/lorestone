declare module '@3d-dice/dice-box-threejs' {
  interface DiceBoxConfig {
    assetPath?: string
    framerate?: number
    sounds?: boolean
    volume?: number
    color_spotlight?: number
    shadows?: boolean
    theme_surface?: string
    sound_dieMaterial?: string
    theme_colorset?: string
    theme_texture?: string
    theme_material?: string
    theme_customColorset?: {
      background: string | string[]
      foreground?: string
      texture?: string
      material?: string
    } | null
    gravity_multiplier?: number
    light_intensity?: number
    baseScale?: number
    strength?: number
    iterationLimit?: number
    onRollComplete?: (results: RollResult) => void
    onRerollComplete?: (results: RollResult) => void
    onAddDiceComplete?: (results: RollResult) => void
    onRemoveDiceComplete?: (results: RollResult) => void
  }

  interface DiceRoll {
    id: number
    sides: number
    value: number
    label: string
    type: string
    reason: string
  }

  interface DiceSet {
    num: number
    sides: number
    type: string
    total: number
    rolls: DiceRoll[]
  }

  interface RollResult {
    notation: string
    modifier: number
    total: number
    sets: DiceSet[]
  }

  class DiceBox {
    constructor(selector: string, config?: DiceBoxConfig)
    initialize(): Promise<void>
    roll(notation: string): Promise<DiceResult[]>
    add(notation: string): Promise<DiceResult[]>
    reroll(notation: string): Promise<DiceResult[]>
    remove(notation: string): Promise<void>
    clear(): void
    updateConfig(config: Partial<DiceBoxConfig>): void
    hide(): void
    show(): void
  }

  export default DiceBox
}
