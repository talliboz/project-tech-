const { createPasswordHash } = require('../userStore')

async function main() {
  const password = process.argv[2]

  if (!password) {
    console.error('Usage: node scripts/hash-password.js <password>')
    process.exit(1)
  }

  console.log(await createPasswordHash(password))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
