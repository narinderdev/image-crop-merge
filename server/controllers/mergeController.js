import sharp from 'sharp'
sharp.concurrency(0)

/**
 * Validate and normalize selection coordinates.
 */
function validateSelection(body) {
  const { x, y, width, height } = body
  const sel = {
    x: Number(x),
    y: Number(y),
    width: Number(width),
    height: Number(height),
  }

  const invalid =
    [sel.x, sel.y, sel.width, sel.height].some(v => !Number.isFinite(v) || v < 0) ||
    sel.width === 0 ||
    sel.height === 0

  if (invalid) {
    const error = new Error('Invalid selection rectangle.')
    error.status = 400
    throw error
  }

  return sel
}

/**
 * Extract file buffers from multer upload.
 */
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

function normalizeRegion(sel) {
  return {
    left: Math.max(0, Math.floor(sel.x)),
    top: Math.max(0, Math.floor(sel.y)),
    width: Math.max(1, Math.ceil(sel.width)),
    height: Math.max(1, Math.ceil(sel.height)),
  }
}

/**
 * Prepare crop buffer by extracting directly from the original image to avoid quality loss.
 */
async function prepareCropBuffer(originalSharp, cropBuf, region) {
  const extractOriginalRegion = async () => ({
    buffer: await originalSharp
      .clone()
      .extract(region)
      .toBuffer(),
    source: 'original',
  })

  if (!cropBuf) {
    return extractOriginalRegion()
  }

  try {
    const cropMeta = await sharp(cropBuf).metadata()
    const cropWidth = cropMeta.width || 0
    const cropHeight = cropMeta.height || 0
    const cropHasDetail = cropWidth >= region.width && cropHeight >= region.height

    if (!cropHasDetail) {
      // Client crop would require up-scaling – fall back to pristine pixels.
      return extractOriginalRegion()
    }

    let pipeline = sharp(cropBuf)
    if (cropWidth !== region.width || cropHeight !== region.height) {
      pipeline = pipeline.resize({
        width: region.width,
        height: region.height,
        fit: 'cover',
        kernel: 'lanczos3',
        withoutEnlargement: true,
      })
    }

    return {
      buffer: await pipeline.sharpen({ sigma: 0.8, m1: 0.9, m2: 0 }).toBuffer(),
      source: 'client',
    }
  } catch (err) {
    console.warn('Crop metadata inspection failed; using original pixels.', err)
    return extractOriginalRegion()
  }
}

/**
 * Build SVG border overlay dynamically.
 */
function buildBorderOverlay(meta, sel, opts = {}) {
  const borderWidth = Number(opts.borderWidth) || 1
  const borderColor = opts.borderColor || 'red'

  return Buffer.from(`
    <svg width="${meta.width}" height="${meta.height}" xmlns="http://www.w3.org/2000/svg">
      <rect 
        x="${sel.x + borderWidth / 2}" 
        y="${sel.y + borderWidth / 2}"
        width="${sel.width - borderWidth}" 
        height="${sel.height - borderWidth}"
        fill="none" 
        stroke="${borderColor}" 
        stroke-width="${borderWidth}" 
        rx="2" ry="2"/>
    </svg>
  `)
}

/**
 * Merge the images, preserve quality, and return the merged image.
 */
export async function mergeImages(req, res) {
  try {
    const sel = validateSelection(req.body)
    const { originalBuf, cropBuf } = requireFiles(req.files)
    const region = normalizeRegion(sel)

    const originalSharp = sharp(originalBuf)
    const originalMeta = await originalSharp.metadata()
    const format = originalMeta.format || 'png'

    if (sel.x + sel.width > originalMeta.width || sel.y + sel.height > originalMeta.height) {
      const error = new Error('Selection is out of bounds.')
      error.status = 400
      throw error
    }

    const { buffer: cropPrepared, source: cropSource } = await prepareCropBuffer(
      originalSharp,
      cropBuf,
      region,
    )

    const svg = buildBorderOverlay(originalMeta, sel, {
      borderColor: req.body.borderColor,
      borderWidth: req.body.borderWidth,
    })

    let mergedPipeline = originalSharp
      .ensureAlpha()
      .composite([
        { input: cropPrepared, left: region.left, top: region.top },
        { input: svg, left: 0, top: 0 },
      ])
      .withMetadata()

    if (format !== 'png' && cropSource === 'client') {
      // Only sharpen when we actually relied on the client-provided crop and not PNG output.
      mergedPipeline = mergedPipeline.sharpen({ sigma: 0.6, m1: 0.9, m2: 0 })
    }

    let merged
    switch (format) {
      case 'jpeg':
      case 'jpg':
        merged = await mergedPipeline
          .jpeg({
            quality: 100,
            chromaSubsampling: '4:4:4',
            mozjpeg: true,
          })
          .toBuffer()
        res.setHeader('Content-Type', 'image/jpeg')
        break
      case 'webp':
        merged = await mergedPipeline
          .webp({
            quality: 100,
            nearLossless: true,
          })
          .toBuffer()
        res.setHeader('Content-Type', 'image/webp')
        break
      case 'png':
        merged = await mergedPipeline
          .png({
            compressionLevel: 0,
            adaptiveFiltering: false,
            bitdepth: 16,
            palette: false,
            progressive: false,
            quality: 100,
            force: true,
          })
          .toBuffer()
        res.setHeader('Content-Type', 'image/png')
        break
      default:
        merged = await mergedPipeline
          .png({
            compressionLevel: 0,
            adaptiveFiltering: false,
            bitdepth: 16,
            palette: false,
            progressive: false,
            quality: 100,
            force: true,
          })
          .toBuffer()
        res.setHeader('Content-Type', 'image/png')
    }

    return res.status(200).send(merged)
  } catch (err) {
    const status = err.status || 500
    if (status === 500) {
      console.error('Image merge error:', err.message, err.stack)
    }
    return res.status(status).json({ error: err.message || 'Server error processing images.' })
  }
}
