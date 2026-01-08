import React, { useState } from 'react';
import YouTubeInput from './YouTubeInput';
import FileUpload from './FileUpload';
import LiveTranscription from './LiveTranscription';
import TopicsCovered from './TopicsCovered';
import axios from 'axios';

const InputFlow = () => {
    const [result, setResult] = useState(null);
    const [showLive, setShowLive] = useState(false);
    const [showTopics, setShowTopics] = useState(false);

    const handleProcessComplete = (data) => {
        setResult(data);
        setShowLive(false);
        setShowTopics(false);
    };

    const handleStartTranscription = () => {
        setShowLive(true);
        setShowTopics(false);
    };

    const handleShowTopics = () => {
        setShowTopics(true);
        setShowLive(false);
    };

    const handleBackToLive = () => {
        setShowTopics(false);
        setShowLive(true);
    };

    return (
        <div className="flow-container">
            <div className="header">
                <h2>Input Processing</h2>
                <p>Choose a source to begin transcription</p>
            </div>

            {showTopics && result ? (
                <TopicsCovered
                    filePath={result.filePath}
                    onBack={handleBackToLive}
                />
            ) : showLive && result ? (
                <LiveTranscription
                    filePath={result.filePath}
                    onReset={() => {
                        setResult(null);
                        setShowLive(false);
                        setShowTopics(false);
                    }}
                    onNext={handleShowTopics}
                />
            ) : result ? (
                <div className="success-card">
                    <h3>Success!</h3>
                    <p>{result.message}</p>
                    <p className="file-path">File ready at: {result.filePath}</p>

                    <button
                        className="process-btn"
                        onClick={handleStartTranscription}
                        style={{ marginTop: '1rem' }}
                    >
                        Start Live Transcription
                    </button>

                    <button className="reset-btn" onClick={() => setResult(null)}>Process Another</button>
                </div>
            ) : (
                <div className="options-grid">
                    <YouTubeInput onProcessComplete={handleProcessComplete} />
                    <div className="divider">
                        <span>OR</span>
                    </div>
                    <FileUpload onProcessComplete={handleProcessComplete} />
                </div>
            )}
        </div>
    );
};

export default InputFlow;
