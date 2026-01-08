const fs = require('fs');
const path = require('path');
const https = require('https');

const modelUrl = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin';
const modelsDir = path.join(__dirname, 'models');
const modelPath = path.join(modelsDir, 'ggml-base.en.bin');

const downloadModel = () => {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(modelsDir)) {
            fs.mkdirSync(modelsDir);
            console.log('Created models directory');
        }

        if (fs.existsSync(modelPath)) {
            console.log('Model already exists. Skipping download.');
            resolve();
            return;
        }

        console.log('Downloading Whisper model (ggml-base.en.bin)...');
        const file = fs.createWriteStream(modelPath);

        https.get(modelUrl, (response) => {
            // Handle redirects
            if (response.statusCode === 301 || response.statusCode === 302) {
                https.get(response.headers.location, (redirectResponse) => {
                    if (redirectResponse.statusCode !== 200) {
                        console.error(`Failed to download model: Status Code ${redirectResponse.statusCode}`);
                        fs.unlink(modelPath, () => { });
                        reject(new Error(`Status Code ${redirectResponse.statusCode}`));
                        return;
                    }
                    redirectResponse.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        console.log('Model downloaded successfully.');
                        resolve();
                    });
                });
                return;
            }

            if (response.statusCode !== 200) {
                console.error(`Failed to download model: Status Code ${response.statusCode}`);
                fs.unlink(modelPath, () => { });
                reject(new Error(`Status Code ${response.statusCode}`));
                return;
            }

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                console.log('Model downloaded successfully.');
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(modelPath, () => { });
            console.error('Error downloading model:', err.message);
            reject(err);
        });
    });
};

if (require.main === module) {
    downloadModel();
}

module.exports = downloadModel;
