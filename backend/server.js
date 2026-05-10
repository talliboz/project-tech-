const express = require('express')
const fs = require('fs')
const jwt = require('jsonwebtoken')
const path = require('path')
const { createAuthMiddleware, requireRole } = require('./middleware/auth')
const { findUserByCredentials } = require('./userStore')

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env')

  if (!fs.existsSync(envPath)) {
    return
  }

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)

  lines.forEach((line) => {
    const trimmedLine = line.trim()

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      return
    }

    const separatorIndex = trimmedLine.indexOf('=')

    if (separatorIndex === -1) {
      return
    }

    const key = trimmedLine.slice(0, separatorIndex).trim()
    const value = trimmedLine.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '')

    if (key && process.env[key] === undefined) {
      process.env[key] = value
    }
  })
}

loadEnvFile()

const app = express()
const port = process.env.PORT || 5000
const secret = process.env.JWT_SECRET || 'techinno-secret-key'
const authenticateToken = createAuthMiddleware(secret)
const authorizeDashboard = requireRole('admin', 'engineer', 'viewer')
const authorizeEngineer = requireRole('engineer')
const authorizeAdmin = requireRole('admin')
const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

const faults = [
  {
    id: 'F1',
    title: 'Track signal fault',
    location: 'North platform',
    severity: 'high',
  },
  {
    id: 'F2',
    title: 'Door sensor failure',
    location: 'East carriage',
    severity: 'medium',
  },
  {
    id: 'F3',
    title: 'Lighting outage',
    location: 'West concourse',
    severity: 'low',
  },
]

app.use((req, res, next) => {
  const origin = req.headers.origin

  if (allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }

  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204)
  }

  next()
})

app.use(express.json())

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload.' })
  }

  next(err)
})

app.post('/api/login', async (req, res) => {
  const { technicianId, passkey, username, password } = req.body || {}
  const loginId = technicianId ?? username
  const loginPasskey = passkey ?? password

  if (!loginId || !loginPasskey) {
    return res.status(400).json({ error: 'Technician ID and passkey are required.' })
  }

  let user

  try {
    user = await findUserByCredentials(loginId, loginPasskey)
  } catch {
    return res.status(500).json({ error: 'User store is unavailable.' })
  }

  if (!user) {
    return res.status(401).json({ error: 'Invalid technician ID or passkey.' })
  }

  const token = jwt.sign(
    {
      technicianId: user.technicianId,
      role: user.role,
      displayName: user.displayName,
    },
    secret,
    { expiresIn: '1h' },
  )

  res.json({
    token,
    user: {
      technicianId: user.technicianId,
      role: user.role,
      displayName: user.displayName,
    },
  })
})

app.get('/api/dashboard', authenticateToken, authorizeDashboard, (req, res) => {
  const totalFaults = faults.length

  const severityCount = {
    low: 0,
    medium: 0,
    high: 0,
  }

  faults.forEach((fault) => {
    if (severityCount[fault.severity] !== undefined) {
      severityCount[fault.severity]++
    }
  })

  res.json({
    totalFaults,
    severityCount,
    faults,
  })
})

app.post('/api/dashboard/faults', authenticateToken, authorizeEngineer, (req, res) => {
  const fault = req.body

  if (!fault || !fault.severity) {
    return res.status(400).json({ error: 'Fault object with severity is required.' })
  }
  else if (!fault.title) {
    return res.status(400).json({ error: 'Fault object with title is required.' })
  }
  else if (!fault.location) {
    return res.status(400).json({ error: 'Fault object with location is required.' })
  }

  const newFault = {
    id: fault.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: fault.title ?? 'Reported fault',
    location: fault.location ?? 'Unknown location',
    severity: fault.severity,
  }

  faults.push(newFault)
  res.status(201).json({ success: true, fault: newFault })
})

app.delete('/api/dashboard/faults/:id', authenticateToken, authorizeAdmin, (req, res) => {
  const faultIndex = faults.findIndex((fault) => fault.id === req.params.id)

  if (faultIndex === -1) {
    return res.status(404).json({ error: 'Fault not found.' })
  }

  const [deletedFault] = faults.splice(faultIndex, 1)
  res.json({ success: true, fault: deletedFault })
})

app.get('/', (req, res) => {
  res.send('Backend API is running')
})

app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`)
})
