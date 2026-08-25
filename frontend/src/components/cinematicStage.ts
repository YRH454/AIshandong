import type { DynamicExplanationScene, DynamicExplanationStageKind } from './dynamicExplanation'

export function getCinematicStageKind(scene: DynamicExplanationScene): DynamicExplanationStageKind | null {
  if (scene.stage?.kind) return scene.stage.kind
  const text = `${scene.title} ${scene.visual.headline} ${scene.simulation?.subject || ''}`.toLowerCase()
  if (/冒险|冲突|暂停|转发|清空|hazard|stall|forward|flush/.test(text)) return 'hazard-lab'
  if (/性能|命中率|分支预测|延迟|吞吐|cpi|performance|throughput|latency|prediction/.test(text)) return 'performance-lab'
  if (/存储层次|寄存器.*cache|cache.*内存|高速缓存|缓存|ram|memory hierarchy|storage hierarchy/.test(text)) return 'storage-hierarchy'
  if (/流水线|并行执行|重叠执行|pipeline|overlap/.test(text)) return 'pipeline-overlap'
  if (/餐厅|服务员|厨房|点餐|restaurant|kitchen|service/.test(text)) return 'service-flow'
  if (/补码|原码|反码|二进制|bit|binary|complement/.test(text)) return 'number-transform'
  if (/cpu|指令系统|取指|译码|instruction cycle/.test(text)) return 'instruction-cycle'
  if (scene.scene_engine === 'process') return scene.visual_type === 'timeline' ? 'timeline-river' : 'causal-chain'
  if (scene.scene_engine === 'state') return 'state-machine'
  if (scene.scene_engine === 'comparison') return 'comparison-studio'
  if (scene.scene_engine === 'spatial') return scene.visual_type === 'network' ? 'system-network' : 'concept-constellation'
  if (scene.scene_engine === 'timeline') return 'timeline-river'
  if (scene.scene_engine === 'experiment') return scene.simulation?.initial_input !== undefined ? 'parameter-lab' : 'case-lab'
  if (scene.visual_type === 'network') return 'system-network'
  if (scene.visual_type === 'timeline') return 'timeline-river'
  if (scene.visual_type === 'compare' || scene.visual_type === 'contrast' || scene.visual_type === 'pitfall' || scene.visual_type === 'error-lab') return 'comparison-studio'
  if (scene.visual_type === 'example' || scene.visual_type === 'lab') return 'case-lab'
  return 'concept-constellation'
}
