import React from 'react'

export default function ImageUploader({ onFileChange }) {
    return (
        <div className="card">
            <label className="label">1) Choose an image</label>
            <input type="file" accept="image/*" onChange={onFileChange} />
        </div>
    )
}

