import React from 'react'

export default function ResultPanel({ resultUrl }) {
    return (
        <div className="card">
            <label className="label">3) Result</label>
            {resultUrl ? (
                <div className="output">
                    <img src={resultUrl} alt="Result" />
                    <div className="controls">
                        <a href={resultUrl} download="result.png">
                            <button>Download PNG</button>
                        </a>
                    </div>
                </div>
            ) : (
                <p>
                    <small>No result yet.</small>
                </p>
            )}
        </div>
    )
}

