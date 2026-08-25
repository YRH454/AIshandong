import type { DynamicExplanationData } from './dynamicExplanation'

export function isComputerArchitecturePresentation(data: DynamicExplanationData) {
  const text = [
    data.title,
    data.summary,
    ...data.highlights,
    ...data.scenes.flatMap(scene => [
      scene.title,
      scene.narration,
      scene.key_point,
      scene.visual.headline,
      ...scene.visual.items,
      scene.simulation?.subject || '',
      ...(scene.simulation?.code_lines || []),
      ...(scene.simulation?.actors || []).flatMap(actor => [actor.label, actor.role || '']),
    ]),
  ].join(' ')
  if (/计算机组成|计算机体系结构|computer architecture/i.test(text)) return true
  const matches = text.match(/CPU|中央处理器|Cache|缓存|内存|memory|寄存器|register|编译器|compiler|机器指令|instruction|ALU/gi) || []
  return new Set(matches.map(item => item.toLowerCase())).size >= 3
}
