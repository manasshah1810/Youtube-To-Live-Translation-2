import React, { useState, useRef } from 'react';
import { UploadCloud, FileAudio, Loader2, ArrowRight, X } from 'lucide-react';
import axios from 'axios';

const FileUpload = ({ onProcessComplete }) => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const inputRef = useRef(null);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const validateFile = (selectedFile) => {
        const validTypes = ['audio/mpeg', 'audio/wav', 'video/mp4'];
        if (!validTypes.includes(selectedFile.type)) {
            setError('Invalid file type. Please upload .mp3, .wav, or .mp4');
            return false;
        }
        return true;
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        setError('');

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const droppedFile = e.dataTransfer.files[0];
            if (validateFile(droppedFile)) {
                setFile(droppedFile);
            }
        }
    };

    const handleChange = (e) => {
        e.preventDefault();
        setError('');
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            if (validateFile(selectedFile)) {
                setFile(selectedFile);
            }
        }
    };

    const handleProcess = async () => {
        if (!file) return;

        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post('http://localhost:3000/api/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            onProcessComplete(response.data);
        } catch (err) {
            setError('Failed to upload file');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="input-card">
            <div className="icon-wrapper upload">
                <UploadCloud size={32} />
            </div>
            <h3>Upload File</h3>
            <p className="description">Support for .mp3, .wav, .mp4</p>

            {!file ? (
                <div
                    className={`drop-zone ${dragActive ? 'active' : ''}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current.click()}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        className="hidden-input"
                        onChange={handleChange}
                        accept=".mp3,.wav,.mp4"
                    />
                    <p>Drag & Drop or Click to Upload</p>
                </div>
            ) : (
                <div className="file-preview">
                    <div className="file-info">
                        <FileAudio size={24} />
                        <span className="file-name">{file.name}</span>
                    </div>
                    <button className="remove-btn" onClick={() => setFile(null)}>
                        <X size={18} />
                    </button>
                </div>
            )}

            {error && <p className="error-message">{error}</p>}

            <button
                className="process-btn"
                onClick={handleProcess}
                disabled={loading || !file}
            >
                {loading ? (
                    <>
                        <Loader2 className="animate-spin" size={18} /> Uploading...
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

export default FileUpload;
