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
  | 'code-trace'
  | 'timeline'
  | 'network'

export type DynamicExplanationPalette = 'sage' | 'cobalt' | 'ember' | 'plum' | 'ink'

export type DynamicExplanationSceneEngine =
  | 'process'
  | 'state'
  | 'comparison'
  | 'spatial'
  | 'timeline'
  | 'experiment'
  | 'story'

export type DynamicExplanationTeachingPhase =
  | 'question'
  | 'intuition'
  | 'mechanism'
  | 'verification'
  | 'boundary'
  | 'synthesis'

export type DynamicExplanationStageKind =
  | 'service-flow'
  | 'number-transform'
  | 'instruction-cycle'
  | 'storage-hierarchy'
  | 'pipeline-overlap'
  | 'hazard-lab'
  | 'performance-lab'
  | 'process-lab'
  | 'concept-constellation'
  | 'causal-chain'
  | 'timeline-river'
  | 'comparison-studio'
  | 'system-network'
  | 'state-machine'
  | 'case-lab'
  | 'parameter-lab'

export type DynamicExplanationStage = {
  kind: DynamicExplanationStageKind
  environment: string
  focal_question: string
  chapter_label?: string
  interaction_prompt?: string
  requires_interaction?: boolean
  zones: Array<{
    id: string
    label: string
    role?: string
    x?: number
    y?: number
  }>
  cues: Array<{
    beat_id: string
    caption: string
    focus?: string
    from?: string
    to?: string
  }>
}

// Internal director brief. It is intentionally kept out of the persistent
// stage copy, but lets the backend reject scenes that only look animated.
export type DynamicExplanationStoryboard = {
  learning_job: string
  knowledge_relation: string
  visible_change: string
  interaction: string
  atoms: string[]
  source?: 'model' | 'incomplete'
  missing_fields?: string[]
}

type ScenePayloadMeta = {
  source?: 'model' | 'legacy' | 'repaired'
  missing_fields?: string[]
}

export type ConceptConstellationPayload = ScenePayloadMeta & {
  kind: 'concept-constellation'
  core: string
  core_detail?: string
  branches: Array<{ id: string; label: string; relation: string; detail: string }>
  boundary_conditions: string[]
  cross_links: Array<{ from: string; to: string; label: string }>
}

export type CausalChainPayload = ScenePayloadMeta & {
  kind: 'causal-chain'
  trigger: string
  steps: Array<{
    id: string
    label: string
    mechanism: string
    effect: string
    state_before?: string
    state_after?: string
    observable?: string
  }>
  outcome: string
  blockers: string[]
}

export type TimelineRiverPayload = ScenePayloadMeta & {
  kind: 'timeline-river'
  events: Array<{ id: string; marker: string; title: string; change: string; impact: string; is_turning_point?: boolean }>
  period_label: string
  retrospective: string
}

export type ComparisonStudioPayload = ScenePayloadMeta & {
  kind: 'comparison-studio'
  shared_condition: string
  dimensions: Array<{ id?: string; label: string; left: string; right: string; deciding_factor: string }>
  left_title: string
  right_title: string
  recommendation: string
}

export type SystemNetworkPayload = ScenePayloadMeta & {
  kind: 'system-network'
  nodes: Array<{ id: string; label: string; role: string; detail: string }>
  edges: Array<{ from: string; to: string; label: string; direction?: string }>
  inputs: string[]
  outputs: string[]
  feedback_loops: Array<{ from: string; to: string; label: string }>
}

export type StateMachinePayload = ScenePayloadMeta & {
  kind: 'state-machine'
  states: Array<{ id: string; label: string; description: string }>
  transitions: Array<{ from: string; to: string; trigger: string; effect: string }>
  initial_state: string
  terminal_states: string[]
  exception_paths: Array<{ from: string; to: string; trigger: string; effect: string }>
}

export type CaseLabPayload = ScenePayloadMeta & {
  kind: 'case-lab'
  background: string
  evidence: Array<{ id: string; label: string; detail: string; supports: string }>
  reasoning_steps: string[]
  conclusion: string
  counterevidence: string[]
}

export type ParameterLabPayload = ScenePayloadMeta & {
  kind: 'parameter-lab'
  parameter_label: string
  unit?: string
  min: number
  max: number
  initial: number
  thresholds: Array<{ value: number; label: string; effect: string }>
  response_points: Array<{ value: number; label: string; result: string }>
  stable_range: { min: number; max: number; label: string }
}

export type DynamicExplanationScenePayload =
  | ConceptConstellationPayload
  | CausalChainPayload
  | TimelineRiverPayload
  | ComparisonStudioPayload
  | SystemNetworkPayload
  | StateMachinePayload
  | CaseLabPayload
  | ParameterLabPayload

export type DynamicExplanationBeat = {
  id: string
  label: string
  detail: string
  narration?: string
  action: 'spawn' | 'focus' | 'move' | 'change' | 'branch' | 'return' | 'resolve'
  target?: string
  from?: string
  to?: string
  value?: string
  code_line?: number
  duration_ms?: number
  pause_for_interaction?: boolean
  tone?: 'guide' | 'emphasis' | 'question' | 'correction' | 'challenge' | 'conclusion'
}

export type DynamicExplanationDirectorBeat = DynamicExplanationBeat & {
  source?: 'model' | 'fallback'
  target_repaired?: boolean
  action_repaired?: boolean
}

export type DynamicExplanationSimulation = {
  subject: string
  input_label?: string
  initial_input?: number
  input_min?: number
  input_max?: number
  code_lines: string[]
  actors: Array<{ id: string; label: string; role?: string }>
  beats: DynamicExplanationBeat[]
  experiment?: {
    label: string
    description: string
    effect: string
  } | null
}

export type DynamicExplanationCheck = {
  prompt: string
  options: string[]
  answer: string
  explanation: string
}

export type DynamicExplanationCheckpoint = {
  attempts: number
  correct: boolean
  last_answer: string
}

export type DynamicExplanationInteractionOutcome = {
  label: string
  detail: string
  value?: string
  kind?: DynamicExplanationStageKind
  signal?: 'complete' | 'blocked' | 'boundary' | 'incomplete'
}

export type DynamicExplanationPathRole = 'main' | 'remediation' | 'advanced'
export type DynamicExplanationBranchCondition = 'incorrect' | 'correct' | 'blocked' | 'boundary' | 'incomplete' | 'complete' | 'default'

export type DynamicExplanationBranching = {
  default_next_scene_id: string
  routes: Array<{
    condition: DynamicExplanationBranchCondition
    target_scene_id: string
    label: string
    reason: string
  }>
  rejoin_scene_id?: string
}

export type DynamicExplanationBranchBrief = {
  trigger: string
  diagnosis: string
  teaching_move: string
  success_evidence: string
  strategy: 'contrast-and-correct' | 'guided-rebuild' | 'boundary-test' | 'transfer-challenge' | 'parameter-challenge' | 'case-application'
  source?: 'model' | 'fallback'
}

export type DynamicExplanationContinuity = {
  teaching_phase: DynamicExplanationTeachingPhase
  receives: string
  passes: string
  next_question: string
  source_scene_id?: string
}

export type DynamicExplanationScene = {
  id: string
  title: string
  narration: string
  key_point: string
  visual_type: DynamicExplanationVisualType
  scene_engine?: DynamicExplanationSceneEngine
  visual: {
    headline: string
    items: string[]
    before: string
    after: string
    example: string
  }
  simulation?: DynamicExplanationSimulation | null
  director_beats?: DynamicExplanationDirectorBeat[]
  stage?: DynamicExplanationStage | null
  scene_payload?: DynamicExplanationScenePayload | null
  storyboard?: DynamicExplanationStoryboard | null
  continuity?: DynamicExplanationContinuity
  path_role?: DynamicExplanationPathRole
  branching?: DynamicExplanationBranching
  branch_brief?: DynamicExplanationBranchBrief
  check: DynamicExplanationCheck | null
  suggested_seconds: number
}

export type DynamicExplanationData = {
  schema_version: number
  title: string
  summary: string
  highlights: string[]
  palette?: DynamicExplanationPalette
  visual_contract?: {
    mode: 'stage-first' | 'compatible'
    max_scene_copy_chars?: number | null
    max_beat_copy_chars?: number | null
    requires_interaction?: boolean
    requires_state_change?: boolean
  }
  director_profile?: {
    domain: string
    thread_label: string
    knowledge_structure?: string
    teaching_arc: string
    scene_count_reason?: string
    phase_plan?: DynamicExplanationTeachingPhase[]
  }
  quality_report?: {
    audit_version: number
    status: 'ready' | 'refined' | 'needs_refinement'
    score: number
    scene_count: number
    passed_scene_count: number
    unique_stage_count: number
    branch_scene_count?: number
    branch_point_count?: number
    visual_first?: boolean
    visual_first_passed_scene_count?: number | null
    display_ready?: boolean
    blocking_scene_ids?: string[]
    blocking_codes?: string[]
    repaired_scene_ids: string[]
    issues: Array<{
      scene_id: string
      scene_index: number
      title: string
      severity: number
      codes: string[]
      messages: string[]
    }>
  }
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
