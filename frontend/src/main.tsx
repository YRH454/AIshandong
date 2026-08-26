import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const root = createRoot(document.getElementById('root')!)
const localBranchDemo = ['127.0.0.1', 'localhost'].includes(window.location.hostname)
  && new URLSearchParams(window.location.search).has('adaptive-branch-demo')
const g6MapDemo = ['127.0.0.1', 'localhost'].includes(window.location.hostname)
  && new URLSearchParams(window.location.search).has('g6-map-demo')

if (localBranchDemo) {
  void import('./components/AdaptiveBranchDemo.tsx').then(({ default: AdaptiveBranchDemo }) => {
    root.render(<StrictMode><AdaptiveBranchDemo /></StrictMode>)
  })
} else if (g6MapDemo) {
  void import('./components/G6KnowledgeMapDemo.tsx').then(({ default: G6KnowledgeMapDemo }) => {
    root.render(<StrictMode><G6KnowledgeMapDemo /></StrictMode>)
  })
} else {
  root.render(<StrictMode><App /></StrictMode>)
}
