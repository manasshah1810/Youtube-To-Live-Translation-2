import React, { useState, useEffect } from 'react';
import { ArrowLeft, List } from 'lucide-react';
import ReactMarkdown from 'react-markdown'; // Assuming we might want markdown rendering, but plain text is fine too

const TopicsCovered = ({ filePath, onBack }) => {
    const [topics, setTopics] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const eventSource = new EventSource(`http://localhost:3000/api/stream-topics?filePath=${encodeURIComponent(filePath)}`);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'topics') {
                setTopics(data.topics);
                setLoading(false);
            }
        };

        eventSource.onerror = (err) => {
            console.error('Topic stream error:', err);
            // Don't close immediately as it might be temporary or waiting for start
        };

        return () => {
            eventSource.close();
        };
    }, [filePath]);

    return (
        <div className="success-card" style={{ textAlign: 'left', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
                <button
                    onClick={onBack}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '0.5rem',
                        marginRight: '1rem',
                        display: 'flex',
                        alignItems: 'center'
                    }}
                >
                    <ArrowLeft size={20} />
                </button>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <List size={24} />
                    Topics Covered
                </h3>
            </div>

            <div
                style={{
                    backgroundColor: 'var(--bg-primary)',
                    padding: '2rem',
                    borderRadius: '0.5rem',
                    minHeight: '300px',
                    border: '1px solid var(--border)',
                    lineHeight: '1.8',
                    whiteSpace: 'pre-wrap' // Preserve formatting
                }}
            >
                {loading && !topics ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem' }}>
                        <div className="animate-spin" style={{ display: 'inline-block', marginBottom: '1rem', fontSize: '2rem' }}>✨</div>
                        <p>Analyzing transcript with Gemini...</p>
                    </div>
                ) : (
                    <div className="markdown-content">
                        {/* Simple rendering for now, can be enhanced with ReactMarkdown */}
                        {topics}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TopicsCovered;
