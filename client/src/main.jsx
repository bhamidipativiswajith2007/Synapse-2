import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ClerkProvider } from '@clerk/clerk-react'

let PUBLISHABLE_KEY=import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if(!PUBLISHABLE_KEY){
  throw new Error("missing key")
}

createRoot(document.getElementById('root')).render(
  
  <StrictMode>
  <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
    <App />
    </ClerkProvider>
  </StrictMode>,
)
