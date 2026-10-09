import readline from 'node:readline'
import { connectDatabase, disconnectDatabase } from '../src/config/db'
import { Admin, type AdminRole } from '../src/models/Admin'
import { hashPassword } from '../src/utils/password'

interface Options {
  username?: string
  password?: string
  role: AdminRole
  update: boolean
}

const VALID_ROLES: AdminRole[] = ['admin', 'superadmin']
const MIN_USERNAME = 3
const MIN_PASSWORD = 12

function isTruthy(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test((value ?? '').trim())
}

function parseArgs(argv: string[]): Partial<Options> {
  const options: Partial<Options> = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--username' || arg === '-u') options.username = argv[++i]
    else if (arg === '--password' || arg === '-p') options.password = argv[++i]
    else if (arg === '--role') options.role = argv[++i] as AdminRole
    else if (arg === '--update') options.update = true
  }
  return options
}

function envOptions(): Partial<Options> {
  const role = process.env.ADMIN_ROLE as AdminRole | undefined
  return {
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD,
    role: role && VALID_ROLES.includes(role) ? role : undefined,
    update: process.env.ADMIN_UPDATE === undefined ? undefined : isTruthy(process.env.ADMIN_UPDATE),
  }
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    }),
  )
}

function askHidden(question: string): Promise<string> {
  if (!process.stdin.isTTY) return ask(question)
  return new Promise((resolve, reject) => {
    const stdin = process.stdin
    const stdout = process.stdout
    stdout.write(question)
    let value = ''
    const cleanup = () => {
      stdin.setRawMode(false)
      stdin.pause()
      stdin.removeListener('data', onData)
    }
    const onData = (chunk: Buffer | string) => {
      const char = chunk.toString()
      if (char === '\u0003') {
        cleanup()
        stdout.write('\n')
        reject(new Error('Aborted'))
        return
      }
      if (char === '\r' || char === '\n' || char === '\u0004') {
        cleanup()
        stdout.write('\n')
        resolve(value.trim())
        return
      }
      if (char === '\u007f' || char === '\b') {
        if (value.length > 0) {
          value = value.slice(0, -1)
          stdout.write('\b \b')
        }
        return
      }
      for (const c of char) {
        if (c >= ' ') {
          value += c
          stdout.write('*')
        }
      }
    }
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    stdin.on('data', onData)
  })
}

function requireNonInteractive(value: string | undefined, name: string, hint: string): string {
  if (value && value.trim()) return value.trim()
  const interactive = Boolean(process.stdin.isTTY)
  if (!interactive) {
    throw new Error(
      `${name} is not set and no interactive terminal is available.\n` +
        `Set it in server/.env or pass it on the command line.\n${hint}`,
    )
  }
  return ''
}

async function main() {
  const cli = parseArgs(process.argv.slice(2))
  const fromEnv = envOptions()

  // Precedence: CLI flag > environment variable > interactive prompt.
  const options: Options = {
    role: cli.role ?? fromEnv.role ?? 'superadmin',
    update: cli.update ?? fromEnv.update ?? false,
    username: cli.username ?? fromEnv.username,
    password: cli.password ?? fromEnv.password,
  }

  if (!VALID_ROLES.includes(options.role)) {
    throw new Error(`Invalid role "${options.role}". Use one of: ${VALID_ROLES.join(', ')}`)
  }

  if (process.stdin.isTTY && !(options.username && options.password)) {
    // eslint-disable-next-line no-console
    console.log(
      'Tip: set ADMIN_USERNAME and ADMIN_PASSWORD in server/.env to skip these prompts.\n',
    )
  }

  let username = requireNonInteractive(
    options.username,
    'ADMIN_USERNAME',
    '  ADMIN_USERNAME=owner',
  )
  if (!username && process.stdin.isTTY) username = await ask('Admin username: ')
  username = username.trim().toLowerCase()

  let password = requireNonInteractive(
    options.password,
    'ADMIN_PASSWORD',
    '  ADMIN_PASSWORD=choose-a-strong-password',
  )
  if (!password && process.stdin.isTTY) {
    password = await askHidden(`Admin password (min ${MIN_PASSWORD} chars): `)
    const confirm = await askHidden('Confirm password: ')
    if (password !== confirm) throw new Error('Passwords do not match')
  }

  if (username.length < MIN_USERNAME) {
    throw new Error(`Username must be at least ${MIN_USERNAME} characters`)
  }
  if (password.length < MIN_PASSWORD) {
    throw new Error(`Password must be at least ${MIN_PASSWORD} characters`)
  }

  await connectDatabase()

  const existing = await Admin.findOne({ username })
  if (existing && !options.update) {
    // eslint-disable-next-line no-console
    console.error(
      `Admin "${username}" already exists. Set ADMIN_UPDATE=true (or pass --update) to reset the password.`,
    )
    process.exitCode = 1
    return
  }

  const passwordHash = await hashPassword(password)
  if (existing) {
    existing.passwordHash = passwordHash
    existing.role = options.role
    existing.active = true
    await existing.save()
    // eslint-disable-next-line no-console
    console.log(`Updated admin "${username}" (role: ${existing.role}).`)
  } else {
    const created = await Admin.create({
      username,
      passwordHash,
      role: options.role,
      active: true,
    })
    // eslint-disable-next-line no-console
    console.log(`Created admin "${created.username}" (id: ${created._id.toString()}).`)
  }
}

main()
  .then(() => disconnectDatabase())
  .then(() => process.exit(process.exitCode ?? 0))
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to create admin:', error instanceof Error ? error.message : error)
    await disconnectDatabase().catch(() => undefined)
    process.exit(1)
  })
