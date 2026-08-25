export type KnowledgeMapSemanticRole =
  | 'premise' | 'trigger' | 'mechanism' | 'transformation' | 'result' | 'verification' | 'failure'
  | 'subject' | 'object' | 'direction' | 'condition' | 'covariation' | 'exception' | 'evidence'
  | 'start' | 'input' | 'execution' | 'state_change' | 'decision' | 'output' | 'review'
  | 'definition' | 'inside' | 'outside' | 'criterion' | 'neighbor' | 'boundary_case' | 'quick_check'
  | 'setup' | 'observation' | 'variation' | 'boundary' | 'formal_name' | 'meaning' | 'attributes' | 'alias'
  | 'recognition_signal' | 'confusable' | 'restatement' | 'error_origin' | 'missing_condition' | 'wrong_branch'
  | 'consequence' | 'warning_signal' | 'correction' | 'result_check' | 'components' | 'near_concept' | 'example' | 'self_check'
  | 'origin' | 'early_phase' | 'turning_point' | 'evolution' | 'milestone' | 'current_state' | 'retrospect'

export type SemanticKnowledgeMapType =
  | 'concept_tree'
  | 'process_flow'
  | 'comparison_map'
  | 'system_map'
  | 'timeline_map'
  | 'causal_map'
  | 'relationship_map'
  | 'decision_map'
  | 'lab_map'

type SemanticNode = {
  id: string
  label: string
  group?: string
  semantic_role?: KnowledgeMapSemanticRole
}

export const knowledgeMapSemanticRoles: Record<SemanticKnowledgeMapType, KnowledgeMapSemanticRole[]> = {
  relationship_map: ['subject', 'object', 'direction', 'condition', 'covariation', 'exception', 'evidence'],
  causal_map: ['premise', 'trigger', 'mechanism', 'transformation', 'result', 'verification', 'failure'],
  process_flow: ['start', 'input', 'execution', 'state_change', 'decision', 'output', 'review'],
  comparison_map: ['definition', 'inside', 'outside', 'criterion', 'neighbor', 'boundary_case', 'quick_check'],
  lab_map: ['setup', 'input', 'execution', 'observation', 'result', 'variation', 'boundary'],
  decision_map: ['error_origin', 'missing_condition', 'wrong_branch', 'consequence', 'warning_signal', 'correction', 'result_check'],
  system_map: ['formal_name', 'meaning', 'attributes', 'alias', 'recognition_signal', 'confusable', 'restatement'],
  concept_tree: ['definition', 'components', 'boundary', 'near_concept', 'recognition_signal', 'example', 'self_check'],
  timeline_map: ['origin', 'early_phase', 'turning_point', 'evolution', 'milestone', 'current_state', 'retrospect'],
}

export function createSemanticNodePicker<T extends SemanticNode>(nodes: T[]) {
  const used = new Set<string>()
  return (semanticRole: KnowledgeMapSemanticRole, patterns: string[], fallbackIndex: number) => {
    const matched = nodes.find(node => !used.has(node.id) && node.semantic_role === semanticRole)
      || nodes.find(node => !used.has(node.id) && patterns.some(pattern => `${node.label} ${node.group || ''}`.includes(pattern)))
      || nodes.find((node, index) => !used.has(node.id) && index >= fallbackIndex)
      || nodes.find(node => !used.has(node.id))
    if (matched) used.add(matched.id)
    return matched
  }
}
