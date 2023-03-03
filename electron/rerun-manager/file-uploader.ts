const fs = require('fs');
const https = require('https');
const {promisify} = require('util');

export async function upload(url, filename, onProgress): Promise<void> {
    const fileStream = fs.createReadStream(filename);
    const fileStats = await promisify(fs.stat)(filename);

    return new Promise((resolve, reject) => {
        const options = {
            method: 'PUT',
            headers: {
                'Content-Type': 'video/x-flv',
                'Content-Length': fileStats.size,
            },
            agent: false // Disable HTTP keep-alive
        }

        const req = https.request(url, options, (res) => {
            if (res.statusCode >= 400) {
                reject(new Error(`Failed to upload file: ${res.statusCode} ${res.statusMessage}`));
                return;
            }

            resolve();
        });

        req.on('error', reject);

        let uploadedBytes = 0;
        fileStream.on('data', (chunk) => {
            uploadedBytes += chunk.length;
            onProgress(Math.round((uploadedBytes / fileStats.size) * 100));
        });

        fileStream.on('error', reject);
        fileStream.pipe(req);
    });
}