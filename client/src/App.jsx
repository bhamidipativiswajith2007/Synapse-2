import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import { SignInButton,SignedIn,SignedOut, SignOutButton, UserButton } from '@clerk/clerk-react'


function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <h1>welcomr to the app </h1>
      <SignedOut>
        <SignInButton mode='modal'>
          <button>Login</button>
        </SignInButton>
      </SignedOut>

      <SignedIn>
        <SignOutButton/>
      </SignedIn>

      <UserButton/>
          </>
  )
}

export default App
