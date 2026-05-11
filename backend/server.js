const express = require('express')
const fs = require('fs')
const jwt = require('jsonwebtoken')
const path = require('path')
const { createAuthMiddleware, requireRole } = require('./middleware/auth')
const { findUserByCredentials } = require('./userStore')

// --- STEP 4 & 5: Security System Setup ---
let securityLogs = [];

function logSecurityEvent(type, details) {
  const event = {
    id: securityLogs.length + 1,
    type,
    details,
    timestamp: new Date()
  };
  securityLogs.push(event);
  console.log("SECURITY EVENT:", event);
}

// --- STEP 10: Anomaly Detection ---
function checkForSuspiciousActivity() {
  if (faults.length > 5) {
    logSecurityEvent("ANOMALY_DETECTED", { reason: "High number of faults detected" });
  }
}

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env')
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  lines.forEach((line) => {
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine.startsWith('#')) return
    const separatorIndex = trimmedLine.indexOf('=')
    if (separatorIndex === -1) return
    const key = trimmedLine.slice(0, separatorIndex).trim()
    const value = trimmedLine.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '')
    if (key && process.env[key] === undefined) process.env[key] = value
  })
}

loadEnvFile()

const app = express()
const port = process.env.PORT || 5050
const secret = process.env.JWT_SECRET || 'techinno-secret-key'
const authenticateToken = createAuthMiddleware(secret)
const authorizeDashboard = requireRole('admin', 'engineer', 'viewer')
const authorizeEngineer = requireRole('engineer')
const authorizeAdmin = requireRole('admin')
const allowedOrigins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173'])

const faults = [
  { id: 'F1', title: 'Track signal fault', location: 'North platform', severity: 'high' },
  { id: 'F2', title: 'Door sensor failure', location: 'East carriage', severity: 'medium' },
  { id: 'F3', title: 'Lighting outage', location: 'West concourse', severity: 'low' },
]

app.use((req, res, next) => {
  const origin = req.headers.origin
  if (allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.use(express.json())

// --- STEP 7: Failed Auth Logging ---
app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError' || err.status === 401) {
     logSecurityEvent("AUTH_FAILED", { reason: "invalid or missing token" });
  }
  next(err)
})

app.post('/api/login', async (req, res) => {
  const { technicianId, passkey, username, password } = req.body || {}
  const loginId = technicianId ?? username
  const loginPasskey = passkey ?? password

  // --- STEP 6: Log Attempt ---
  logSecurityEvent("LOGIN_ATTEMPT", { role: "engineer", id: loginId });

  if (!loginId || !loginPasskey) {
    return res.status(400).json({ error: 'Required fields missing.' })
  }

  let user
  try {
    user = await findUserByCredentials(loginId, loginPasskey)
  } catch {
    return res.status(500).json({ error: 'Store unavailable.' })
  }

  if (!user) {
    // --- STEP 7: Log Failed Login ---
    logSecurityEvent("AUTH_FAILED", { reason: "invalid credentials", id: loginId });
    return res.status(401).json({ error: 'Invalid credentials.' })
  }

  const token = jwt.sign(
    { technicianId: user.technicianId, role: user.role, displayName: user.displayName },
    secret,
    { expiresIn: '1h' }
  )

  res.json({ token, user })
})

// --- STEP 9: Security Log Endpoint ---
app.get("/api/security-logs", (req, res) => {
  res.json(securityLogs);
});

app.get('/api/dashboard', authenticateToken, authorizeDashboard, (req, res) => {
  res.json({ totalFaults: faults.length, faults })
})

app.post('/api/dashboard/faults', authenticateToken, authorizeEngineer, (req, res) => {
  const fault = req.body
  if (!fault || !fault.severity || !fault.title || !fault.location) {
    return res.status(400).json({ error: 'Missing details.' })
  }

  const newFault = {
    id: fault.id ?? `${Date.now()}`,
    title: fault.title,
    location: fault.location,
    severity: fault.severity,
  }

  // --- STEP 8: Log Fault ---
  logSecurityEvent("FAULT_REPORTED", { type: newFault.title, location: newFault.location });

  faults.push(newFault)
  checkForSuspiciousActivity(); // --- STEP 11 ---

  res.status(201).json({ success: true, fault: newFault })
})

app.delete('/api/dashboard/faults/:id', authenticateToken, authorizeAdmin, (req, res) => {
  const faultIndex = faults.findIndex((f) => f.id === req.params.id)
  if (faultIndex === -1) return res.status(404).json({ error: 'Not found.' })
  faults.splice(faultIndex, 1)
  res.json({ success: true })
})

app.get('/', (req, res) => {
  res.send('Backend API is running')
})

app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`)
})
