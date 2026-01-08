const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

const modelsDir = path.join(__dirname, 'models');
const modelPath = path.join(modelsDir, 'ggml-base.en.bin');
const whisperExecutable = path.join(__dirname, 'main.exe'); // Assuming main.exe is in server root

// Helper to format Whisper output
const formatWhisperOutput = (rawText) => {
    const lines = rawText.split('\n');
    const segments = [];

    // Regex to parse standard Whisper.cpp output: [00:00:00.000 --> 00:00:05.000]  Text
    // Note: Output format might vary slightly depending on arguments, but this is standard
    const regex = /\[(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})\]\s+(.*)/;

    lines.forEach(line => {
        const match = line.match(regex);
        if (match) {
            segments.push({
                start: match[1],
                end: match[2],
                text: match[3].trim(),
                confidence: 0.9 // Placeholder as standard CLI output might not show confidence per segment easily without -pc
            });
        }
    });

    return segments;
};

const convertToWav = (inputPath, outputPath) => {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .toFormat('wav')
            .audioFrequency(16000)
            .audioChannels(1)
            .on('end', () => resolve(outputPath))
            .on('error', (err) => reject(err))
            .save(outputPath);
    });
};

const transcribeAudio = async (inputFilePath, onSegment) => {
    if (!fs.existsSync(modelPath)) {
        throw new Error('Model file not found. Please wait for download to complete.');
    }

    if (!fs.existsSync(whisperExecutable)) {
        throw new Error('Whisper executable (main.exe) not found. Please wait for download to complete.');
    }

    const tempWavPath = inputFilePath + '.wav';

    try {
        console.log('Converting audio to 16kHz WAV...');
        await convertToWav(inputFilePath, tempWavPath);

        console.log('Starting transcription...');
        return new Promise((resolve, reject) => {
            // Arguments: -m model -f file -t threads
            const safeArgs = [
                '-m', modelPath,
                '-f', tempWavPath,
                '-t', '8' // Use 8 threads for faster processing
            ];

            const whisper = spawn(whisperExecutable, safeArgs);

            let stdoutData = '';
            let stderrData = '';

            whisper.stdout.on('data', (data) => {
                const output = data.toString();
                stdoutData += output;

                // Check for new lines/segments and emit them
                // Whisper output format: [00:00:00.000 --> 00:00:05.000]  Text
                const lines = output.split('\n');
                lines.forEach(line => {
                    const match = line.match(/\[(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})\]\s+(.*)/);
                    if (match && onSegment) {
                        onSegment({
                            start: match[1],
                            end: match[2],
                            text: match[3].trim()
                        });
                    }
                });

                console.log('Whisper stdout:', output.trim());
            });

            whisper.stderr.on('data', (data) => {
                stderrData += data.toString();
                // Whisper often prints progress/info to stderr
                console.log('Whisper stderr:', data.toString().trim());
            });

            whisper.on('close', (code) => {
                // Cleanup temp wav
                fs.unlink(tempWavPath, () => { });

                if (code === 0) {
                    const segments = formatWhisperOutput(stdoutData);
                    resolve(segments);
                } else {
                    reject(new Error(`Whisper exited with code ${code}: ${stderrData}`));
                }
            });

            whisper.on('error', (err) => {
                fs.unlink(tempWavPath, () => { });
                reject(new Error(`Failed to spawn Whisper: ${err.message}. Make sure main.exe is in the server directory.`));
            });
        });

    } catch (error) {
        if (fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath);
        throw error;
    }
};

module.exports = { transcribeAudio, formatWhisperOutput };
