import React from 'react'

export default function CropperPanel({
    containerRef,
    canvasRef,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onSend,
    onClear,
    canSend,
    canClear,
    isSubmitting,
    error,
}) {
    return (
        <div className="card" ref={containerRef}>
            <label className="label">2) Select an area</label>
            <div
                style={{ position: 'relative', width: '100%', userSelect: 'none' }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
            >
                <canvas ref={canvasRef} />
            </div>
            <div className="controls">
                <button onClick={onSend} disabled={!canSend}>
                    {isSubmitting ? 'Sending…' : 'Send to backend'}
                </button>
                <button onClick={onClear} disabled={!canClear}>
                    Clear selection
                </button>
            </div>
            {error && (
                <p className="error">
                    <small>{error}</small>
                </p>
            )}
        </div>
    )
}

