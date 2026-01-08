import React, { useState } from 'react';
import { Youtube, Loader2, ArrowRight } from 'lucide-react';
import axios from 'axios';

const YouTubeInput = ({ onProcessComplete }) => {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(0);
    const [eta, setEta] = useState('');

    const validateUrl = (input) => {
        const regex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
        return regex.test(input);
    };

    const handleProcess = async () => {
        setError('');
        setProgress(0);
        setEta('');

        if (!url) {
            setError('Please enter a YouTube URL');
            return;
        }
        if (!validateUrl(url)) {
            setError('Invalid YouTube URL');
            return;
        }

        setLoading(true);

        // Setup SSE listener
        const eventSource = new EventSource('http://localhost:3000/api/events');

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'progress') {
                setProgress(data.progress);
                setEta(data.eta);
            } else if (data.type === 'complete') {
                eventSource.close();
                setLoading(false);
                onProcessComplete(data);
            } else if (data.type === 'error') {
                eventSource.close();
                setLoading(false);
                setError(data.message);
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
            setLoading(false);
            // Don't set error here as connection might close normally
        };

        try {
            await axios.post('http://localhost:3000/api/process-youtube', { url });
            // The response just confirms processing started. Updates come via SSE.
        } catch (err) {
            eventSource.close();
            setLoading(false);
            setError(err.response?.data?.error || 'Failed to start processing');
        }
    };

    return (
        <div className="input-card">
            <div className="icon-wrapper youtube">
                <Youtube size={32} />
            </div>
            <h3>YouTube Link</h3>
            <p className="description">Paste a YouTube URL to extract audio.</p>

            <div className="input-group">
                <input
                    type="text"
                    placeholder="https://youtube.com/watch?v=..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={loading}
                />
            </div>

            {loading && (
                <div className="progress-container">
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                    <div className="progress-info">
                        <span>{progress.toFixed(1)}%</span>
                        <span>ETA: {eta}</span>
                    </div>
                </div>
            )}

            {error && <p className="error-message">{error}</p>}

            <button
                className="process-btn"
                onClick={handleProcess}
                disabled={loading || !url}
            >
                {loading ? (
                    <>
                        <Loader2 className="animate-spin" size={18} /> Processing...
                    </>
                ) : (
                    <>
                        Process Lecture <ArrowRight size={18} />
                    </>
                )}
            </button>
        </div>
    );
};

export default YouTubeInput;
