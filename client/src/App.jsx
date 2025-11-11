import React, { useEffect, useRef, useState } from 'react'
import ImageUploader from './components/ImageUploader'
import CropperPanel from './components/CropperPanel'
import ResultPanel from './components/ResultPanel'

function resolveApiBase() {
    const viteBase = typeof import.meta !== 'undefined' ? import.meta?.env?.VITE_API_BASE : undefined
    const craBase = typeof process !== 'undefined' ? (process.env?.REACT_APP_API_BASE ?? process.env?.API_BASE) : undefined
    const base = viteBase ?? craBase ?? ''
    return base.endsWith('/') ? base.slice(0, -1) : base
}
const API_BASE = resolveApiBase()
export default function App() {
    const [file, setFile] = useState(null)
    const [imgEl, setImgEl] = useState(null)
    const [selection, setSelection] = useState(null) // {x,y,w,h}
    const [dragging, setDragging] = useState(false)
    const [resultUrl, setResultUrl] = useState(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState(null)
    const canvasRef = useRef(null)
    const containerRef = useRef(null)
    const abortRef = useRef(null)
    // Load image file to an <img> element and draw to canvas
    useEffect(() => {
        if (!file) return
        const img = new Image()
        img.onload = () => setImgEl(img)
        img.src = URL.createObjectURL(file)
        return () => URL.revokeObjectURL(img.src)
    }, [file])
    // Draw whenever image or selection changes
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !imgEl) return
        // Fit canvas width to container, keep image aspect
        const container = containerRef.current
        const maxW = container ? container.clientWidth : 800
        const scale = imgEl.width > 0 ? Math.min(1, maxW / imgEl.width) : 1
        const cw = Math.floor(imgEl.width * scale)
        const ch = Math.floor(imgEl.height * scale)
        canvas.width = cw
        canvas.height = ch
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, cw, ch)
        ctx.drawImage(imgEl, 0, 0, cw, ch)
        if (selection) {
            // Draw selection overlay
            ctx.save()
            ctx.strokeStyle = '#4f8cff'
            ctx.lineWidth = 2
            ctx.setLineDash([6, 3])
            ctx.strokeRect(selection.x, selection.y, selection.w, selection.h)
            ctx.restore()
        }
    }, [imgEl, selection])
    function onFileChange(e) {
        const f = e.target.files?.[0]
        setResultUrl(null)
        setSelection(null)
        if (f) setFile(f)
    }
    function getScale() {
        const canvas = canvasRef.current
        if (!canvas || !imgEl) return { sx: 1, sy: 1 }
        return {
            sx: imgEl.width / canvas.width, sy: imgEl.height /
                canvas.height
        }
    }
    function getCanvasPoint(e) {
        const canvas = canvasRef.current
        if (!canvas) return null
        const rect = canvas.getBoundingClientRect()
        if (!rect.width || !rect.height) return null
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        }
    }
    function onMouseDown(e) {
        if (!imgEl) return
        const point = getCanvasPoint(e)
        if (!point) return
        setDragging(true)
        setSelection({ x: point.x, y: point.y, w: 0, h: 0, startX: point.x, startY: point.y })
    }
    function onMouseMove(e) {
        if (!dragging || !selection) return
        const point = getCanvasPoint(e)
        if (!point) return
        const currX = point.x
        const currY = point.y
        const x = Math.min(selection.startX, currX)
        const y = Math.min(selection.startY, currY)
        const w = Math.abs(currX - selection.startX)
        const h = Math.abs(currY - selection.startY)
        setSelection({ ...selection, x, y, w, h })
    }
    function onMouseUp() {
        setDragging(false)
        if (selection && (selection.w === 0 || selection.h === 0))
            setSelection(null)
    }
    useEffect(() => {
        return () => {
            if (abortRef.current) {
                abortRef.current.abort()
            }
        }
    }, [])
    async function handleSend() {
        if (!file || !selection || !imgEl || isSubmitting) return
        // Map selection from canvas space to natural image pixels
        const { sx, sy } = getScale()
        const selNat = {
            x: selection.x * sx,
            y: selection.y * sy,
            width: selection.w * sx,
            height: selection.h * sy,
        }
        // Create a cropped image Blob client‑side to send along
        const cropBlob = await cropFromCanvas(canvasRef.current, selection)
        const form = new FormData()
        form.append('original', file, file.name)
        form.append('crop', cropBlob, 'crop.png')
        form.append('x', String(selNat.x))
        form.append('y', String(selNat.y))
        form.append('width', String(selNat.width))
        form.append('height', String(selNat.height))
        const controller = new AbortController()
        if (abortRef.current) {
            abortRef.current.abort()
        }
        abortRef.current = controller
        setIsSubmitting(true)
        setError(null)
        try {
            const res = await fetch(`${API_BASE}/api/merge`, {
                method: 'POST',
                body: form,
                signal: controller.signal,
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Upload failed' }))
                throw new Error(err.error || 'Upload failed')
            }
            const blob = await res.blob()
            setResultUrl(URL.createObjectURL(blob))
        } catch (err) {
            if (err.name === 'AbortError') return
            setError(err.message || 'Network error')
        } finally {
            setIsSubmitting(false)
            if (abortRef.current === controller) {
                abortRef.current = null
            }
        }
    }
    function clearSelection() {
        setSelection(null)
    }
    return (
        <div className="container">
            <h1>Image Crop Merge</h1>
            <p><small>Upload an image, drag to select a region, then “Send to
                backend”. The server re‑merges the crop and outlines it.</small></p>
            <ImageUploader onFileChange={onFileChange} />
            <div className="row" style={{ marginTop: 16 }}>
                <CropperPanel
                    containerRef={containerRef}
                    canvasRef={canvasRef}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onSend={handleSend}
                    onClear={clearSelection}
                    canSend={Boolean(file && selection && !isSubmitting)}
                    canClear={Boolean(selection)}
                    isSubmitting={isSubmitting}
                    error={error}
                />
                <ResultPanel resultUrl={resultUrl} />
            </div>
        </div>
    )
}
// Helper: crop selection from the visible canvas to a Blob
async function cropFromCanvas(canvas, sel) {
    const off = document.createElement('canvas')
    off.width = Math.max(1, Math.ceil(sel.w))
    off.height = Math.max(1, Math.ceil(sel.h))
    const ctx = off.getContext('2d')
    ctx.drawImage(canvas, sel.x, sel.y, sel.w, sel.h, 0, 0, off.width,
        off.height)
    return new Promise(resolve => off.toBlob(b => resolve(b), 'image/png'))
}
