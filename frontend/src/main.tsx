import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './app/App'
import { installThemeRuntime } from './theme/installThemeRuntime'
import './styles/global.css'

// Started before the first render so the contract stylesheet is in the document
// while the tree mounts. Nothing awaits it: a slow or absent theme service must
// not delay the application, and the page is correct either way.
void installThemeRuntime()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
