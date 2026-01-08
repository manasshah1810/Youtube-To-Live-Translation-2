import React, { useState, useEffect, useRef } from 'react';
import { Download, Type, FileText } from 'lucide-react';

const LiveTranscription = ({ filePath, onReset, onNext }) => {
    const [segments, setSegments] = useState([]);
    const [complete, setComplete] = useState(false);
    const [downloadUrl, setDownloadUrl] = useState(null);
    const [error, setError] = useState(null);
    const scrollRef = useRef(null);

    useEffect(() => {
        const eventSource = new EventSource(`http://localhost:3000/api/stream-transcription?filePath=${encodeURIComponent(filePath)}`);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'segment') {
                setSegments(prev => [...prev, data.segment]);
            } else if (data.type === 'complete') {
                setComplete(true);
                setDownloadUrl(data.downloadUrl);
                eventSource.close();
            } else if (data.type === 'error') {
                setError(data.message);
                eventSource.close();
            }
        };

        eventSource.onerror = (err) => {
            console.error('EventSource failed:', err);
            eventSource.close();
            if (!complete) setError('Connection lost');
        };

        return () => {
            eventSource.close();
        };
    }, [filePath]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [segments]);

    return (
        <div className="success-card" style={{ textAlign: 'left', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Type size={24} />
                    Live Transcription
                </h3>
                {complete && (
                    <span style={{
                        backgroundColor: 'var(--success)',
                        color: 'white',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '1rem',
                        fontSize: '0.8rem'
                    }}>
                        Complete
                    </span>
                )}
            </div>

            <div
                ref={scrollRef}
                style={{
                    backgroundColor: 'var(--bg-primary)',
                    padding: '1.5rem',
                    borderRadius: '0.5rem',
                    height: '400px',
                    overflowY: 'auto',
                    marginBottom: '1.5rem',
                    border: '1px solid var(--border)',
                    fontFamily: 'monospace',
                    lineHeight: '1.6'
                }}
            >
                {segments.length === 0 && !error && (
                    <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '2rem' }}>
                        <div className="animate-spin" style={{ display: 'inline-block', marginBottom: '1rem' }}>⏳</div>
                        <p>Initializing Whisper model...</p>
                    </div>
                )}

                {segments.map((seg, index) => (
                    <div key={index} className="typewriter-line" style={{ marginBottom: '0.5rem', animation: 'fadeIn 0.3s ease' }}>
                        <span style={{ color: 'var(--text-secondary)', marginRight: '1rem', fontSize: '0.8rem' }}>
                            [{seg.start} - {seg.end}]
                        </span>
                        <span>{seg.text}</span>
                    </div>
                ))}

                {error && (
                    <div style={{ color: 'var(--danger)', marginTop: '1rem', textAlign: 'center' }}>
                        Error: {error}
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
                {complete && downloadUrl && (
                    <a
                        href={downloadUrl}
                        className="process-btn"
                        style={{ textDecoration: 'none', flex: 1 }}
                        download
                    >
                        <Download size={18} />
                        Download Transcript
                    </a>
                )}
                <button
                    className="reset-btn"
                    onClick={onReset}
                    style={{ flex: complete ? 0 : 1, marginTop: 0 }}
                >
                    Process Another
                </button>

                <button
                    className="process-btn"
                    onClick={onNext}
                    style={{
                        flex: 0,
                        minWidth: '120px',
                        marginTop: 0,
                        backgroundColor: 'var(--accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                    }}
                >
                    Next
                    <span style={{ fontSize: '1.2em' }}>→</span>
                </button>
            </div>
        </div>
    );
};

export default LiveTranscription;
