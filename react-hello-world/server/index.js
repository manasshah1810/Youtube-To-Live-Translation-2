const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const YTDlpWrap = require('yt-dlp-wrap').default;
const fs = require('fs');
const { getTopicsFromTranscript } = require('./topic-extraction');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure uploads, temp, and transcripts directories exist
const uploadDir = path.join(__dirname, 'uploads');
const tempDir = path.join(__dirname, 'temp');
const transcriptsDir = path.join(__dirname, 'transcripts');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
if (!fs.existsSync(transcriptsDir)) fs.mkdirSync(transcriptsDir);

// Serve uploads and transcripts statically
app.use('/uploads', express.static(uploadDir));
app.use('/transcripts', express.static(transcriptsDir));

// Initialize yt-dlp
const ytDlpBinaryPath = path.join(__dirname, 'yt-dlp.exe');
const ytDlpWrap = new YTDlpWrap(ytDlpBinaryPath);

// Check and download yt-dlp binary if not exists
const ensureYtDlp = async () => {
    if (!fs.existsSync(ytDlpBinaryPath)) {
        console.log('Downloading yt-dlp binary...');
        await YTDlpWrap.downloadFromGithub(ytDlpBinaryPath);
        console.log('yt-dlp binary downloaded successfully');
    }
};

// Download Whisper Model and Binary
const downloadModel = require('./download-model');
const downloadBinary = require('./download-binary');

const initServer = async () => {
    try {
        await ensureYtDlp();
        await downloadModel();
        await downloadBinary();
        console.log('Server initialization complete (yt-dlp, model, and binary ready)');

        if (process.env.GOOGLE_API_KEY) {
            console.log('Google API Key loaded: ' + process.env.GOOGLE_API_KEY.substring(0, 8) + '...');
        } else {
            console.error('WARNING: Google API Key NOT loaded. Topic extraction will fail.');
        }
    } catch (error) {
        console.error('Server initialization failed:', error);
    }
};
initServer();

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['audio/mpeg', 'audio/wav', 'video/mp4'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only .mp3, .wav, and .mp4 are allowed.'));
        }
    }
});

// Store active clients for SSE
let clients = [];

// Store transcription sessions for topic extraction
// Key: filePath, Value: { transcript: string, topics: string, topicClients: [], processingTopics: boolean }
const sessions = {};

// SSE Endpoint
app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const clientId = Date.now();
    const newClient = {
        id: clientId,
        res
    };
    clients.push(newClient);

    req.on('close', () => {
        clients = clients.filter(client => client.id !== clientId);
    });
});

const sendProgress = (data) => {
    clients.forEach(client => client.res.write(`data: ${JSON.stringify(data)}\n\n`));
};

// Endpoint: Process YouTube URL
app.post('/api/process-youtube', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    // Validate YouTube URL
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
    if (!youtubeRegex.test(url)) {
        return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const outputFile = path.join(tempDir, `audio-${Date.now()}.mp3`);

    // Respond immediately to acknowledge receipt
    res.json({ message: 'Processing started', status: 'processing' });

    console.log(`Starting download for: ${url}`);

    try {
        const ytDlpEventEmitter = ytDlpWrap.exec([
            url,
            '-x',
            '--audio-format', 'mp3',
            '-o', outputFile
        ]);

        ytDlpEventEmitter.on('progress', (progress) => {
            sendProgress({
                type: 'progress',
                progress: progress.percent,
                eta: progress.eta
            });
        });

        ytDlpEventEmitter.on('error', (error) => {
            console.error(error);
            sendProgress({
                type: 'error',
                message: 'Failed to process YouTube video'
            });
        });

        ytDlpEventEmitter.on('close', () => {
            sendProgress({
                type: 'complete',
                message: 'YouTube audio extracted successfully',
                filePath: outputFile,
                status: 'ready_for_transcription'
            });
        });

    } catch (error) {
        console.error(error);
        sendProgress({
            type: 'error',
            message: 'Failed to start processing'
        });
    }
});

// Endpoint: Upload File
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    res.json({
        message: 'File uploaded successfully',
        filePath: req.file.path,
        status: 'ready_for_transcription'
    });
});

// Transcription Route (JSON)
const { transcribeAudio } = require('./transcribe');

app.post('/api/transcribe-audio', async (req, res) => {
    const { filePath } = req.body;

    if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
    }

    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    try {
        const segments = await transcribeAudio(resolvedPath);
        res.json({ segments });
    } catch (error) {
        console.error('Transcription error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Transcription Route (Download)
app.post('/api/transcribe-and-download', async (req, res) => {
    const { filePath } = req.body;

    if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
    }

    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    try {
        const segments = await transcribeAudio(resolvedPath);

        // Convert segments to plain text
        const fullText = segments.map(s => s.text).join(' ');

        // Create transcript file
        const filename = path.basename(filePath, path.extname(filePath)) + '-transcript.txt';
        const transcriptPath = path.join(transcriptsDir, filename);

        fs.writeFileSync(transcriptPath, fullText);

        // Return download URL
        const downloadUrl = `http://localhost:${PORT}/transcripts/${filename}`;

        res.json({
            message: 'Transcription complete',
            downloadUrl,
            text: fullText
        });
    } catch (error) {
        console.error('Transcription error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper to broadcast topics to listeners
const broadcastTopics = (filePath, topics) => {
    const session = sessions[filePath];
    if (session && session.topicClients) {
        session.topicClients.forEach(client => {
            client.res.write(`data: ${JSON.stringify({ type: 'topics', topics })}\n\n`);
        });
    }
};

// Transcription Route (Streaming)
app.get('/api/stream-transcription', async (req, res) => {
    const { filePath } = req.query;

    if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
    }

    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    // Initialize session
    if (!sessions[filePath]) {
        sessions[filePath] = {
            transcript: '',
            topics: '',
            topicClients: [],
            processingTopics: false,
            lastTopicUpdateLength: 0
        };
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const segments = await transcribeAudio(resolvedPath, (segment) => {
            res.write(`data: ${JSON.stringify({ type: 'segment', segment })}\n\n`);

            // Update cumulative transcript
            if (sessions[filePath]) {
                sessions[filePath].transcript += segment.text + ' ';


            }
        });

        // Final topic extraction
        if (sessions[filePath]) {
            console.log('Final topic extraction...');
            getTopicsFromTranscript(sessions[filePath].transcript).then(topics => {
                sessions[filePath].topics = topics;
                broadcastTopics(filePath, topics);
            });
        }

        // Convert segments to plain text and save
        const fullText = segments.map(s => s.text).join(' ');
        const filename = path.basename(filePath, path.extname(filePath)) + '-transcript.txt';
        const transcriptPath = path.join(transcriptsDir, filename);
        fs.writeFileSync(transcriptPath, fullText);
        const downloadUrl = `http://localhost:${PORT}/transcripts/${filename}`;

        res.write(`data: ${JSON.stringify({ type: 'complete', downloadUrl, fullText })}\n\n`);
        res.end();
    } catch (error) {
        console.error('Transcription error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
    }
});

// Topic Streaming Endpoint
app.get('/api/stream-topics', (req, res) => {
    const { filePath } = req.query;

    if (!filePath || !sessions[filePath]) {
        // If session doesn't exist yet, just wait or return empty
        // We'll initialize it if missing to allow early connection
        if (filePath) {
            if (!sessions[filePath]) {
                sessions[filePath] = {
                    transcript: '',
                    topics: '',
                    topicClients: [],
                    processingTopics: false,
                    lastTopicUpdateLength: 0
                };
            }
        } else {
            return res.status(400).json({ error: 'File path is required' });
        }
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const client = { res };
    sessions[filePath].topicClients.push(client);

    // Send current topics immediately if available
    if (sessions[filePath].topics) {
        res.write(`data: ${JSON.stringify({ type: 'topics', topics: sessions[filePath].topics })}\n\n`);
    }

    req.on('close', () => {
        if (sessions[filePath]) {
            sessions[filePath].topicClients = sessions[filePath].topicClients.filter(c => c !== client);
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
