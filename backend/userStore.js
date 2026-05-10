const crypto = require('crypto')
const fs = require('fs/promises')
const path = require('path')

const defaultUserStorePath = path.join(__dirname, 'data', 'users.json')
const userStorePath = process.env.USER_STORE_PATH || defaultUserStorePath
const scryptOptions = {
  N: 16384,
  r: 8,
  p: 1,
}
const keyLength = 64

function scryptAsync(password, salt, options = scryptOptions) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keyLength, options, (err, derivedKey) => {
      if (err) {
        reject(err)
        return
      }

      resolve(derivedKey)
    })
  })
}

async function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('base64url')
  const derivedKey = await scryptAsync(password, salt)

  return [
    'scrypt',
    'v1',
    scryptOptions.N,
    scryptOptions.r,
    scryptOptions.p,
    salt,
    derivedKey.toString('base64url'),
  ].join(':')
}

async function verifyPassword(password, passwordHash) {
  const [algorithm, version, n, r, p, salt, expectedHash] = passwordHash.split(':')

  if (algorithm !== 'scrypt' || version !== 'v1' || !salt || !expectedHash) {
    return false
  }

  const expectedKey = Buffer.from(expectedHash, 'base64url')
  const derivedKey = await scryptAsync(password, salt, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  })

  if (derivedKey.length !== expectedKey.length) {
    return false
  }

  return crypto.timingSafeEqual(derivedKey, expectedKey)
}

async function readUsers() {
  const data = await fs.readFile(userStorePath, 'utf8')
  const parsedData = JSON.parse(data)

  return Array.isArray(parsedData.users) ? parsedData.users : []
}

function toPublicUser(user) {
  return {
    id: user.id,
    technicianId: user.technicianId,
    role: user.role,
    displayName: user.displayName,
  }
}

async function findUserByCredentials(technicianId, passkey) {
  const users = await readUsers()
  const user = users.find(
    (candidate) => candidate.technicianId === technicianId && candidate.enabled !== false,
  )

  if (!user || !(await verifyPassword(passkey, user.passwordHash))) {
    return null
  }

  return toPublicUser(user)
}

module.exports = {
  createPasswordHash,
  findUserByCredentials,
}
