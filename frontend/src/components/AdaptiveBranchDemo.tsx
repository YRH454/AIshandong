import { DynamicExplanationPlayer } from './DynamicExplanationPlayer'
import type { DynamicExplanationData, DynamicExplanationScene } from './dynamicExplanation'

const visual = (headline: string, items: string[], example: string) => ({
  headline,
  items,
  before: items[0] || headline,
  after: items[items.length - 1] || headline,
  example,
})

const baseScene = (scene: Omit<DynamicExplanationScene, 'suggested_seconds'>): DynamicExplanationScene => {
  const atoms = (scene.director_beats || [])
    .map(beat => beat.label)
    .filter(Boolean)
  return {
    ...scene,
    storyboard: scene.storyboard || {
      learning_job: `辨认“${scene.title}”中的关键学习对象。`,
      knowledge_relation: scene.key_point,
      visible_change: `沿着${atoms.slice(0, 2).join('与')}观察关系如何推进。`,
      interaction: `选择${atoms[0] || scene.visual.items[0] || scene.title}，追踪它对当前结果的影响。`,
      atoms: atoms.length ? atoms : scene.visual.items,
    },
    suggested_seconds: 38,
  }
}

const directorBeats = (targets: Array<{ id: string; label: string }>, conclusion: string) => targets.slice(0, 5).map((target, index) => ({
  id: `director-${index + 1}`,
  label: target.label,
  detail: index === targets.length - 1 ? conclusion : `聚焦${target.label}在当前机制中的作用。`,
  narration: index === 0
    ? `先聚焦${target.label}，确认它在这一幕里承担的角色。`
    : index === targets.length - 1
      ? `回到${target.label}，${conclusion}`
      : `接着观察${target.label}如何推动当前关系继续变化。`,
  target: target.id,
  action: index === 0 ? 'spawn' as const : index === targets.length - 1 ? 'resolve' as const : 'focus' as const,
  duration_ms: 2500,
  pause_for_interaction: false,
  tone: index === targets.length - 1 ? 'conclusion' as const : 'guide' as const,
  source: 'model' as const,
}))

const demo: DynamicExplanationData = {
  schema_version: 14,
  title: '缓存命中：一次会自动改道的动态讲解',
  summary: '用一道判断题观察纠错支线、进阶支线以及回归主线。',
  highlights: ['命中条件', '纠错对比', '迁移应用'],
  palette: 'sage',
  director_profile: {
    domain: '计算机组成',
    thread_label: '一次内存访问',
    knowledge_structure: '条件判断与性能迁移',
    teaching_arc: '建立命中判断 → 根据回答改道 → 回归访问机制 → 系统收束',
    scene_count_reason: '五幕中包含一条纠错支线和一条进阶支线，用于验收自适应路线。',
  },
  scenes: [
    baseScene({
      id: 'scene-1',
      title: '先判断：数据在缓存里就一定命中吗？',
      narration: '缓存命中不只取决于“数据似乎在缓存里”，还要检查地址映射到的组、标记位是否一致，以及缓存行是否有效。先做一次判断，系统会根据你的答案选择下一段讲解。',
      key_point: '命中 = 组索引找到位置 + 标记匹配 + 有效位成立。',
      visual_type: 'concept',
      scene_engine: 'spatial',
      visual: visual('缓存命中的三个条件', ['组索引', '标记位', '有效位', '目标数据'], '三个条件必须共同成立，不能只看其中一个。'),
      director_beats: directorBeats([{ id: 'index', label: '组索引' }, { id: 'tag', label: '标记位' }, { id: 'valid', label: '有效位' }], '命中必须让索引、标记和有效位同时成立。'),
      stage: { kind: 'concept-constellation', environment: '缓存地址观察台', focal_question: '一次访问要满足哪些条件才算命中？', chapter_label: '命中判断', interaction_prompt: '先观察三个条件，再完成理解检查。', requires_interaction: true, zones: [], cues: [] },
      scene_payload: { kind: 'concept-constellation', core: '缓存命中', core_detail: '地址映射与缓存状态共同决定结果', branches: [
        { id: 'index', label: '组索引', relation: '定位', detail: '决定到哪一组寻找缓存行' },
        { id: 'tag', label: '标记位', relation: '核对', detail: '确认缓存行是否属于目标地址' },
        { id: 'valid', label: '有效位', relation: '许可', detail: '确认缓存行中的内容可以使用' },
      ], boundary_conditions: ['替换后旧标记即使仍可见，也不能代表命中'], cross_links: [{ from: 'index', to: 'tag', label: '先定位再核对' }] },
      continuity: { teaching_phase: 'question', receives: '', passes: '命中需要索引、标记和有效位共同成立', next_question: '如果只看到了正确组，却忽略标记位，会发生什么？' },
      path_role: 'main',
      branching: {
        default_next_scene_id: 'scene-4',
        routes: [
          { condition: 'incorrect', target_scene_id: 'scene-2', label: '先修正命中误区', reason: '刚才的回答忽略了标记匹配或有效位，需要用正反例重新建立判断顺序。' },
          { condition: 'correct', target_scene_id: 'scene-3', label: '进入替换策略挑战', reason: '命中条件已经掌握，可以把判断迁移到更复杂的访问序列。' },
        ],
        rejoin_scene_id: 'scene-4',
      },
      check: { prompt: '地址映射到了正确的缓存组，但标记位不同，此时是什么结果？', options: ['缓存命中', '缓存未命中'], answer: '缓存未命中', explanation: '组索引只负责定位，标记不同说明缓存行属于另一个内存块。' },
    }),
    baseScene({
      id: 'scene-2',
      title: '纠错实验：把“找到位置”与“找到数据”拆开',
      narration: '把两个访问放在同一张对比台上：它们都映射到同一个组，但只有标记匹配且有效位为一的访问能够命中。先排除“到了正确组就算命中”的直觉，再重新完成一次判断。',
      key_point: '组索引相同只代表查看同一个位置，不代表缓存行属于目标地址。',
      visual_type: 'error-lab',
      scene_engine: 'comparison',
      visual: visual('两个地址进入同一组', ['地址 A：标记匹配', '地址 B：标记不同', '有效位检查', '命中结论'], '地址 B 虽然进入同一组，仍然必须从下一层存储取数。'),
      director_beats: directorBeats([{ id: 'dimensions-1', label: '标记位' }, { id: 'dimensions-2', label: '访问结果' }, { id: 'visual-3', label: '有效位检查' }], '同组只完成定位，标记和有效位才决定是否命中。'),
      stage: { kind: 'comparison-studio', environment: '缓存命中纠错台', focal_question: '相同组索引为何可能得到不同结果？', chapter_label: '纠错支线', interaction_prompt: '切换两个地址，找出真正决定结果的字段。', requires_interaction: true, zones: [], cues: [] },
      scene_payload: { kind: 'comparison-studio', shared_condition: '两个地址映射到同一缓存组', dimensions: [
        { label: '标记位', left: '与目标地址一致', right: '与目标地址不同', deciding_factor: '标记是否匹配' },
        { label: '访问结果', left: '直接读取缓存行', right: '向下一层请求数据', deciding_factor: '能否确认缓存行身份' },
      ], left_title: '真正命中', right_title: '同组但未命中', recommendation: '定位之后必须继续核对标记位和有效位' },
      continuity: { teaching_phase: 'verification', receives: '命中需要索引、标记和有效位共同成立', passes: '已经区分了位置相同与数据身份相同', next_question: '修正判断后，一次未命中如何继续完成访问？', source_scene_id: 'scene-1' },
      path_role: 'remediation',
      branch_brief: { trigger: '选择了“缓存命中”', diagnosis: '把组索引定位误当成完整的命中判断', teaching_move: '并排比较两个同组但标记不同的地址，逐字段排除错误直觉', success_evidence: '能够解释为什么同组地址仍可能未命中', strategy: 'contrast-and-correct', source: 'model' },
      branching: { default_next_scene_id: 'scene-4', routes: [], rejoin_scene_id: 'scene-4' },
      check: { prompt: '两个地址进入同一组，但标记不同，能否复用同一缓存行？', options: ['可以直接复用', '必须按未命中处理'], answer: '必须按未命中处理', explanation: '标记不同表示缓存行对应的是另一个内存块。' },
    }),
    baseScene({
      id: 'scene-3',
      title: '进阶挑战：连续访问如何改变下一次命中？',
      narration: '现在把单次判断迁移到连续访问。先打开访问序列中的证据，判断哪一次访问会替换已有缓存行，再预测后续地址是否仍能命中。重点不再是背结论，而是追踪状态变化。',
      key_point: '替换策略会改变缓存状态，因此前一次访问可能决定下一次是否命中。',
      visual_type: 'lab',
      scene_engine: 'story',
      visual: visual('三次访问的证据链', ['访问 A 命中', '访问 B 引发替换', 'A 的缓存行被覆盖', '再次访问 A'], '如果 B 与 A 竞争同一位置，再次访问 A 可能转为未命中。'),
      director_beats: directorBeats([{ id: 'a1', label: '第一次访问 A' }, { id: 'b', label: '访问 B' }, { id: 'a2', label: '再次访问 A' }], 'B 的替换使第二次访问 A 变为未命中。'),
      stage: { kind: 'case-lab', environment: '缓存访问案例室', focal_question: '哪一次替换改变了后续访问结果？', chapter_label: '进阶支线', interaction_prompt: '依次打开访问证据，再给出最终预测。', requires_interaction: true, zones: [], cues: [] },
      scene_payload: { kind: 'case-lab', background: '直接映射缓存连续访问 A、B、A，A 与 B 竞争同一缓存位置', evidence: [
        { id: 'a1', label: '第一次访问 A', detail: 'A 已在缓存且标记匹配', supports: '第一次 A 命中' },
        { id: 'b', label: '访问 B', detail: 'B 映射到同一位置并写入自己的标记', supports: 'B 替换 A' },
        { id: 'a2', label: '再次访问 A', detail: '当前位置的标记已经变为 B', supports: '第二次 A 未命中' },
      ], reasoning_steps: ['确认竞争位置', '追踪标记变化', '预测下一次访问'], conclusion: 'B 的替换使第二次 A 从命中变为未命中', counterevidence: ['如果 A 与 B 映射到不同位置，就不会发生这次冲突替换'] },
      continuity: { teaching_phase: 'verification', receives: '已经掌握单次命中的三个条件', passes: '能够把命中判断迁移到连续访问和状态变化', next_question: '发生未命中后，数据如何从下一层返回缓存？', source_scene_id: 'scene-1' },
      path_role: 'advanced',
      branch_brief: { trigger: '正确识别了标记不匹配', diagnosis: '单次命中条件已经掌握，可以进一步追踪连续访问造成的状态变化', teaching_move: '通过 A、B、A 访问序列判断替换发生的位置，并预测后续命中结果', success_evidence: '能够指出哪次访问改变了缓存状态，并解释第二次 A 的结果', strategy: 'case-application', source: 'model' },
      branching: { default_next_scene_id: 'scene-4', routes: [], rejoin_scene_id: 'scene-4' },
      check: null,
    }),
    baseScene({
      id: 'scene-4',
      title: '回归主线：未命中后的数据回填',
      narration: '无论你刚才走过纠错还是进阶路线，现在都回到同一个主线机制：缓存未命中后，请求会进入下一层存储，目标块返回并写入缓存，标记位和有效位同步更新，随后 CPU 才得到数据。',
      key_point: '未命中不是流程终点，而是一次向下一层请求并重建缓存状态的过程。',
      visual_type: 'sequence',
      scene_engine: 'process',
      visual: visual('一次未命中的回填链', ['缓存未命中', '发出下层请求', '定位目标数据块', '选择待替换缓存行', '回填数据并更新标记', '返回 CPU', '获得目标数据'], '回填完成后，再访问同一块数据才可能命中。'),
      director_beats: directorBeats([{ id: 'request', label: '发出下层请求' }, { id: 'locate', label: '定位目标数据块' }, { id: 'select', label: '选择待替换缓存行' }, { id: 'fill', label: '回填数据并更新标记' }, { id: 'return', label: '返回 CPU' }], '未命中会通过下层读取、替换和缓存回填恢复访问。'),
      stage: { kind: 'causal-chain', environment: '缓存回填通道', focal_question: '未命中如何重新建立可命中的缓存状态？', chapter_label: '回归主线', interaction_prompt: '选择链条中的一个对象，观察信号如何继续传导。', requires_interaction: true, zones: [], cues: [] },
      scene_payload: { kind: 'causal-chain', trigger: '缓存标记或有效位检查失败', steps: [
        { id: 'request', label: '发出下层请求', mechanism: '把未命中的目标地址交给下一层存储系统', effect: '下一层开始查找目标内存块', state_before: '缓存检查失败', state_after: '下层请求已建立', observable: '请求从缓存出口离开' },
        { id: 'locate', label: '定位目标数据块', mechanism: '下一层按地址定位包含所需数据的完整内存块', effect: '确定需要返回的块数据', state_before: '下层请求已建立', state_after: '目标块被找到', observable: '目标块进入返回通道' },
        { id: 'select', label: '选择待替换缓存行', mechanism: '依据映射位置和替换策略确定可以写入的缓存行', effect: '为回填腾出明确位置', state_before: '目标块被找到', state_after: '可写缓存行已确定', observable: '一行缓存被标为待更新' },
        { id: 'fill', label: '回填数据并更新标记', mechanism: '把块数据写入该行，同时写入对应标记并置有效位', effect: '建立下一次可命中的缓存状态', state_before: '可写缓存行已确定', state_after: '缓存行有效且标记匹配', observable: '缓存行内容与状态位同步变化' },
        { id: 'return', label: '返回 CPU', mechanism: '将已经得到的目标数据送回发起访问的处理器', effect: '本次访问完成并解除等待', state_before: '缓存行有效且标记匹配', state_after: 'CPU 获得目标数据', observable: 'CPU 的等待状态结束' },
      ], outcome: '缓存状态更新且 CPU 获得目标数据', blockers: ['下一层访问仍可能继续未命中'] },
      continuity: { teaching_phase: 'mechanism', receives: '已经确认本次访问为何命中或未命中', passes: '未命中通过下层读取和缓存回填得到解决', next_question: '把多次访问放进整个存储系统后，性能由什么共同决定？' },
      path_role: 'main',
      branching: { default_next_scene_id: 'scene-5', routes: [], rejoin_scene_id: '' },
      check: null,
    }),
    baseScene({
      id: 'scene-5',
      title: '系统收束：一次访问背后的完整协作',
      narration: '最后把判断和回填放回完整系统：CPU 发出地址，缓存优先检查，未命中时由主存提供数据，替换策略更新缓存状态。你需要带走的不是一个孤立名词，而是一条能预测性能变化的协作链。',
      key_point: '缓存性能来自命中判断、访问局部性、替换策略和下层延迟的共同作用。',
      visual_type: 'network',
      scene_engine: 'spatial',
      visual: visual('存储访问协作网', ['CPU 请求', '缓存检查', '替换策略', '主存回填', '性能结果'], '改变任一环节，都可能改变平均访问时间。'),
      director_beats: directorBeats([{ id: 'cpu', label: 'CPU' }, { id: 'cache', label: '缓存' }, { id: 'memory', label: '主存' }], '访问性能来自 CPU、缓存与主存的共同协作。'),
      stage: { kind: 'system-network', environment: '存储系统协作图', focal_question: '哪些环节共同决定平均访问时间？', chapter_label: '系统收束', interaction_prompt: '选择任意节点，追踪它对最终性能的影响。', requires_interaction: true, zones: [], cues: [] },
      scene_payload: { kind: 'system-network', nodes: [
        { id: 'cpu', label: 'CPU', role: '发起访问', detail: '提供目标地址并等待数据' },
        { id: 'cache', label: '缓存', role: '优先检查', detail: '比较索引、标记和有效位' },
        { id: 'memory', label: '主存', role: '下层供给', detail: '未命中时返回目标数据块' },
      ], edges: [{ from: 'cpu', to: 'cache', label: '地址请求', direction: 'forward' }, { from: 'cache', to: 'memory', label: '未命中请求', direction: 'forward' }, { from: 'memory', to: 'cache', label: '数据回填', direction: 'return' }], inputs: ['访问地址'], outputs: ['目标数据', '更新后的缓存状态'], feedback_loops: [{ from: 'cache', to: 'cpu', label: '命中数据或回填结果' }] },
      continuity: { teaching_phase: 'synthesis', receives: '未命中通过下层读取和缓存回填得到解决', passes: '能够用完整访问链解释缓存命中与性能变化', next_question: '' },
      path_role: 'main',
      branching: { default_next_scene_id: '', routes: [], rejoin_scene_id: '' },
      check: null,
    }),
  ],
}

export default function AdaptiveBranchDemo() {
  return <DynamicExplanationPlayer data={demo} language="zh-CN" openImmersiveRequest={1} />
}
