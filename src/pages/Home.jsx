import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth, db } from '../firebase'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from 'firebase/auth'
import { collection, addDoc } from 'firebase/firestore'

const GROQ_KEY = import.meta.env.VITE_GROQ_KEY
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

const outlineBtn = {
  padding: '8px 16px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--code-bg)',
  color: 'var(--text-h)',
  cursor: 'pointer',
  fontSize: 14,
}

async function callGroq(text) {
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: text }]
    }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message || 'Groq API error')
  return data.choices[0].message.content
}

export default function Home() {
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [shareLink, setShareLink] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    return onAuthStateChanged(auth, setUser)
  }, [])

  async function handleAuth() {
    setAuthError('')
    try {
      if (authMode === 'signup') {
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
    } catch (err) {
      setAuthError(err.message)
    }
  }

  async function generateForm() {
    setLoading(true)
    setShareLink(null)
    try {
      const systemPrompt = `You are a form builder. The user will describe a form they need.
Return ONLY a JSON object with this exact structure, no markdown, no explanation, no backticks:
{
  "title": "Form title",
  "fields": [
    {
      "id": "field_1",
      "label": "Field label",
      "type": "text",
      "required": true,
      "placeholder": "placeholder text"
    }
  ]
}
Supported types: text, email, number, textarea, dropdown, checkbox, image.
For dropdown, add an "options" array of strings.
For image type use: { "id": "field_x", "label": "Upload reference image", "type": "image", "required": false }
IMPORTANT: Always include an image field when the request involves visual references, designs, or inspiration.`

      const raw = await callGroq(systemPrompt + '\n\nForm request: ' + prompt)
      const cleaned = raw.replace(/```json|```/g, '').trim()
      const json = JSON.parse(cleaned)

      // Save form to Firestore
      const docRef = await addDoc(collection(db, 'forms'), {
        ...json,
        ownerId: user.uid,
        createdAt: new Date().toISOString()
      })

      setShareLink(`${window.location.origin}/form/${docRef.id}`)
    } catch (err) {
      console.error(err)
      alert('Something went wrong: ' + err.message)
    }
    setLoading(false)
  }

  if (!user) {
    return (
      <div style={{ maxWidth: 400, margin: '100px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
        <h1>Formly</h1>
        <p style={{ color: '#666' }}>AI-powered forms for your business.</p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button onClick={() => setAuthMode('login')}
            style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #ddd', background: authMode === 'login' ? '#4F46E5' : '#fff', color: authMode === 'login' ? '#fff' : '#333', cursor: 'pointer' }}>
            Log in
          </button>
          <button onClick={() => setAuthMode('signup')}
            style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #ddd', background: authMode === 'signup' ? '#4F46E5' : '#fff', color: authMode === 'signup' ? '#fff' : '#333', cursor: 'pointer' }}>
            Sign up
          </button>
        </div>

        <input type='email' placeholder='Email' value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', marginBottom: 10, boxSizing: 'border-box' }} />

        <input type='password' placeholder='Password' value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', marginBottom: 10, boxSizing: 'border-box' }} />

        {authError && <p style={{ color: 'red', fontSize: 13 }}>{authError}</p>}

        <button onClick={handleAuth}
          style={{ width: '100%', padding: 12, background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, cursor: 'pointer' }}>
          {authMode === 'login' ? 'Log in' : 'Sign up'}
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 600, margin: '60px auto', padding: '0 20px', fontFamily: 'sans-serif', textAlign: 'left' }}>
      <div style={{ marginBottom: 32, textAlign: 'left' }}>
        <h1 style={{ margin: 0 }}>Formly</h1>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={() => navigate('/dashboard')} style={outlineBtn}>
            Dashboard
          </button>
          <button onClick={() => auth.signOut()} style={outlineBtn}>
            Log out
          </button>
        </div>
      </div>

      <p style={{ color: '#666' }}>Describe the form you need and AI will build it.</p>

      <textarea rows={4}
        style={{ width: '100%', padding: 12, fontSize: 15, borderRadius: 8, border: '1px solid #ddd', boxSizing: 'border-box' }}
        placeholder='e.g. A cake order form for a bakery with name, email, occasion dropdown, and reference image upload'
        value={prompt}
        onChange={e => setPrompt(e.target.value)} />

      <button onClick={generateForm} disabled={loading || !prompt}
        style={{ marginTop: 12, padding: '10px 24px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, cursor: 'pointer' }}>
        {loading ? 'Generating...' : 'Generate form'}
      </button>

      {shareLink && (
        <div style={{ marginTop: 24, padding: 16, background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
          <p style={{ margin: '0 0 8px', fontWeight: 500, color: '#16a34a' }}>✓ Form created! Share this link with your clients:</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input readOnly value={shareLink}
              style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
            <button onClick={() => navigator.clipboard.writeText(shareLink)}
              style={{ ...outlineBtn, padding: '8px 14px', borderRadius: 6 }}>
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  )
}