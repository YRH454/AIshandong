/**
 * The map workspace and its entry cards both need to describe the same set of
 * visualisations. Keep the catalogue count in a small, dependency-free module
 * so App.tsx does not have to eagerly load the G6 renderer just to render a
 * card label.
 */
export const knowledgeMapViewIds = [
  'mindmap', 'dendrogram', 'compact-box', 'fishbone', 'indented', 'org-chart', 'radial-tree', 'outline-tree',
  'dagre-lr', 'dagre-tb', 'snake', 'timeline-river', 'funnel-flow', 'cycle-loop', 'swimlane', 'staircase',
  'circular', 'concentric', 'radial', 'force', 'd3-bubble', 'fruchterman', 'atlas2', 'mds',
  'orbit', 'honeycomb', 'bipartite', 'chord-ring',
  'grid', 'arc-dependency', 'edge-bundling', 'split-comparison', 'quadrant', 'pyramid', 'spectrum', 'matrix-heat',
] as const

export type KnowledgeMapViewId = typeof knowledgeMapViewIds[number]

export const knowledgeMapViewCount = knowledgeMapViewIds.length
