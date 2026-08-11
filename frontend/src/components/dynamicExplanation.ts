export type DynamicExplanationVisualType =
  | 'concept'
  | 'sequence'
  | 'compare'
  | 'example'
  | 'pitfall'
  | 'journey'
  | 'stack'
  | 'contrast'
  | 'lab'
  | 'error-lab'
  | 'map'
  | 'recap'

export type DynamicExplanationPalette = 'sage' | 'cobalt' | 'ember' | 'plum' | 'ink'

export type DynamicExplanationCheck = {
  prompt: string
  options: string[]
  answer: string
  explanation: string
}

export type DynamicExplanationScene = {
  id: string
  title: string
  narration: string
  key_point: string
  visual_type: DynamicExplanationVisualType
  visual: {
    headline: string
    items: string[]
    before: string
    after: string
    example: string
  }
  check: DynamicExplanationCheck | null
  suggested_seconds: number
}

export type DynamicExplanationData = {
  schema_version: number
  title: string
  summary: string
  highlights: string[]
  palette?: DynamicExplanationPalette
  scenes: DynamicExplanationScene[]
}

export function parseDynamicExplanation(content?: string): DynamicExplanationData | null {
  if (!content) return null
  try {
    const parsed = JSON.parse(content) as Partial<DynamicExplanationData>
    if (!Array.isArray(parsed.scenes) || parsed.scenes.length < 1 || !parsed.scenes.every(scene => (
      scene && typeof scene.id === 'string' && typeof scene.title === 'string' && typeof scene.narration === 'string'
    ))) return null
    return parsed as DynamicExplanationData
  } catch {
    return null
  }
}
