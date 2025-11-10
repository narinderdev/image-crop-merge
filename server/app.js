import express from 'express'
import cors from 'cors'
import { corsOptions } from './config.js'
import mergeRoutes from './routes/mergeRoutes.js'

const app = express()

app.use(cors(corsOptions))
app.use(express.json())

app.use('/api/merge', mergeRoutes)
app.get('/health', (_req, res) => res.json({ ok: true }))

export default app

