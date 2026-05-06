import React, { useState, useEffect } from 'react'
import Dashboard from './Dashboard'
import Login from './Login'

function App() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    // Check if user is already logged in (simulated by checking localStorage token)
    const token = localStorage.getItem('sgac_token')
    if (token) {
      // In a real app we'd validate the token with the backend here
      // For this demo, we'll just allow them in if a token exists
      // The backend should return the user profile. Here we mock it if missing.
      setUser({ username: 'Usuario', role: 'chef' })
    }
  }, [])

  const handleLogin = (userData) => {
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('sgac_token')
    setUser(null)
  }

  if (!user) {
    return <Login onLogin={handleLogin} />
  }

  return <Dashboard user={user} onLogout={handleLogout} />
}

export default App
