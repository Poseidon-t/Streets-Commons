import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import StreetsCommons from './StreetsCommons'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StreetsCommons />
  </StrictMode>,
)
