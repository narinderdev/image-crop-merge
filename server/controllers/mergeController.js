import sharp from 'sharp'

function validateSelection(body) {
    const { x, y, width, height } = body
    const sel = {
        x: Math.round(Number(x)),
        y: Math.round(Number(y)),
        width: Math.round(Number(width)),
        height: Math.round(Number(height)),
    }
    const invalid = [sel.x, sel.y, sel.width, sel.height].some(v => !Number.isFinite(v) || v < 0)
    if (invalid) {
        const error = new Error('Invalid selection rectangle.')
        error.status = 400
        throw error
    }
    return sel
}

function requireFiles(files) {
    const original = files?.original?.[0]
    const crop = files?.crop?.[0]
    if (!original || !crop) {
        const error = new Error('Both original and crop images are required.')
        error.status = 400
        throw error
    }
    return { originalBuf: original.buffer, cropBuf: crop.buffer }
}

function buildBorderOverlay(meta, sel) {
    const borderWidth = 4
    return Buffer.from(`
      <svg width="${meta.width}" height="${meta.height}" viewBox="0 0 ${meta.width} ${meta.height}" xmlns="http://www.w3.org/2000/svg">
        <rect x="${sel.x + borderWidth / 2}" y="${sel.y + borderWidth / 2}" width="${sel.width - borderWidth}" height="${sel.height - borderWidth}" fill="none" stroke="red" stroke-width="${borderWidth}" rx="2" ry="2"/>
      </svg>
    `)
}

export async function mergeImages(req, res) {
    try {
        const sel = validateSelection(req.body)
        const { originalBuf, cropBuf } = requireFiles(req.files)

        const originalMeta = await sharp(originalBuf).metadata()
        if (
            sel.x + sel.width > originalMeta.width ||
            sel.y + sel.height > originalMeta.height
        ) {
            const error = new Error('Selection is out of bounds.')
            error.status = 400
            throw error
        }

        const cropPrepared = await sharp(cropBuf)
            .resize({ width: sel.width, height: sel.height, fit: 'fill' })
            .toBuffer()

        const svg = buildBorderOverlay(originalMeta, sel)

        const merged = await sharp(originalBuf)
            .composite([
                { input: cropPrepared, left: sel.x, top: sel.y },
                { input: svg, left: 0, top: 0 },
            ])
            .toFormat('png')
            .toBuffer()

        res.setHeader('Content-Type', 'image/png')
        return res.status(200).send(merged)
    } catch (err) {
        const status = err.status || 500
        if (status === 500) {
            console.error(err)
        }
        return res.status(status).json({ error: err.message || 'Server error processing images.' })
    }
}

