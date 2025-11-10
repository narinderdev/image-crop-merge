import dotenv from 'dotenv'

dotenv.config()

const DEFAULT_PORT = 5001
const parsedPort = Number(process.env.PORT)
export const PORT = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT

const rawCorsOrigin = process.env.CORS_ORIGIN
let corsOrigin = true
if (rawCorsOrigin) {
    const origins = rawCorsOrigin.split(',').map(o => o.trim()).filter(Boolean)
    corsOrigin = origins.length > 1 ? origins : origins[0] ?? true
}

export const corsOptions = { origin: corsOrigin }
