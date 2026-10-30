import { useState, useEffect } from 'react'
import Layout from './components/Layout'

export default function App() {
  const [message, setMessage] = useState('Loading...')

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setMessage(data.message))
      .catch(() => setMessage('Could not reach API'))
  }, [])

  return (
    <Layout>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Background Remover</h1>
      <p className="text-gray-600">API says: {message}</p>
    </Layout>
  )
}
