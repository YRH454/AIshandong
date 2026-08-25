import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const root = createRoot(document.getElementById('root')!)
const localBranchDemo = ['127.0.0.1', 'localhost'].includes(window.location.hostname)
  && new URLSearchParams(window.location.search).has('adaptive-branch-demo')

if (localBranchDemo) {
  void import('./components/AdaptiveBranchDemo.tsx').then(({ default: AdaptiveBranchDemo }) => {
    root.render(<StrictMode><AdaptiveBranchDemo /></StrictMode>)
  })
} else {
  root.render(<StrictMode><App /></StrictMode>)
}
