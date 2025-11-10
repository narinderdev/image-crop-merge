import { Router } from 'express'
import upload from '../middleware/upload.js'
import { mergeImages } from '../controllers/mergeController.js'

const router = Router()

router.post('/', upload.fields([
    { name: 'original', maxCount: 1 },
    { name: 'crop', maxCount: 1 },
]), mergeImages)

export default router

