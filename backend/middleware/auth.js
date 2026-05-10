const jwt = require('jsonwebtoken')

function createAuthMiddleware(secret) {
  return function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return res.status(401).json({ error: 'Authorization token required.' })
    }

    jwt.verify(token, secret, (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid or expired token.' })
      }

      req.user = user
      next()
    })
  }
}

function requireRole(...allowedRoles) {
  return function authorizeRole(req, res, next) {
    if (!req.user?.role || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'This user role is not allowed to perform that action.' })
    }

    next()
  }
}

module.exports = { createAuthMiddleware, requireRole }
