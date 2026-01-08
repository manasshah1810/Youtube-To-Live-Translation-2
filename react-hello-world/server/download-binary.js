const fs = require('fs');
const path = require('path');
const https = require('https');
const AdmZip = require('adm-zip');

const binaryUrl = 'https://github.com/ggerganov/whisper.cpp/releases/download/v1.5.4/whisper-bin-x64.zip';
const zipPath = path.join(__dirname, 'whisper-bin.zip');
const binaryPath = path.join(__dirname, 'main.exe');

const downloadFile = (url, dest, resolve, reject) => {
    const file = fs.createWriteStream(dest);

    const request = https.get(url, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
            file.close();
            fs.unlink(dest, () => { }); // Delete partial file
            downloadFile(response.headers.location, dest, resolve, reject);
            return;
        }

        if (response.statusCode !== 200) {
            file.close();
            fs.unlink(dest, () => { });
            reject(new Error(`Status Code ${response.statusCode}`));
            return;
        }

        response.pipe(file);

        file.on('finish', () => {
            file.close();
            resolve();
        });
    });

    request.on('error', (err) => {
        file.close();
        fs.unlink(dest, () => { });
        reject(err);
    });
};

const extractBinary = (resolve, reject) => {
    console.log('Extracting Whisper binary...');
    try {
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(__dirname, true);

        // Cleanup
        fs.unlinkSync(zipPath);

        if (fs.existsSync(binaryPath)) {
            console.log('Whisper binary extracted successfully.');
            resolve();
        } else {
            reject(new Error('main.exe not found in downloaded zip'));
        }
    } catch (err) {
        console.error('Error extracting binary:', err);
        reject(err);
    }
};

const downloadBinary = () => {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(binaryPath)) {
            console.log('Whisper binary (main.exe) already exists. Skipping download.');
            resolve();
            return;
        }

        console.log('Downloading Whisper binary...');
        downloadFile(binaryUrl, zipPath, () => {
            extractBinary(resolve, reject);
        }, reject);
    });
};

if (require.main === module) {
    downloadBinary();
}

module.exports = downloadBinary;
