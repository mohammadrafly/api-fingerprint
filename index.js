const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const { PNG } = require('pngjs');
const fingerprint = require('fingerprintjs2');
const app = express();
const mysql = require('mysql');

// Middleware to parse JSON bodies
app.use(bodyParser.json({ limit: '10mb' })); // Increase the limit if necessary

const pool = mysql.createPool({
    connectionLimit: 10,
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'perpustakaan'
});

app.post('/api/login', async (req, res) => {
    const { fingerprint } = req.body;

    if (!fingerprint) {
        return res.status(400).json({ success: false, message: 'Fingerprint data is required' });
    }

    try {
        const data = Buffer.from(fingerprint, 'base64');
        const png = new PNG();

        png.parse(data, (err) => {
            if (err) {
                console.error('Error parsing PNG file:', err);
                return res.status(500).json({ success: false, message: 'Error parsing PNG file' });
            }
        
            fingerprint.getPromise({ canvas: true, audio: false })
                .then(async components => {
                    const generatedFingerprint = fingerprint.x64hash128(components.map(pair => pair.value).join(), 31);
                    
                    pool.query('SELECT fingerprint FROM users WHERE fingerprint = ?', [generatedFingerprint], (error, results) => {
                        if (error) {
                            console.error('Error retrieving user fingerprint:', error);
                            return res.status(500).json({ success: false, message: 'Error retrieving user fingerprint' });
                        }

                        if (results.length === 0) {
                            return res.status(404).json({ success: false, message: 'User not found' });
                        }

                        // User found by fingerprint
                        res.json({ success: true, message: 'Login berhasil!' });
                    });
                })
                .catch(error => {
                    console.error('Error generating fingerprint:', error);
                    res.status(500).json({ success: false, message: 'Error generating fingerprint' });
                });
        });        
    } catch (error) {
        console.error('Error during image processing:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
});

app.post('/api/enroll', async (req, res) => {
    const { fingerprint } = req.body;

    if (!fingerprint) {
        return res.status(400).json({ success: false, message: 'Fingerprint data is required' });
    }

    try {
        const data = Buffer.from(fingerprint, 'base64');
        const png = new PNG();

        png.parse(data, async (err) => {
            if (err) {
                console.error('Error parsing PNG file:', err);
                return res.status(500).json({ success: false, message: 'Error parsing PNG file' });
            }

            fingerprint.getPromise({ canvas: true, audio: false })
                .then(async components => {
                    const generatedFingerprint = fingerprint.x64hash128(components.map(pair => pair.value).join(), 31);
 
                    pool.query('INSERT INTO users (fingerprint) VALUES (?)', [generatedFingerprint], (error, results) => {
                        if (error) {
                            console.error('Error storing fingerprint in database:', error);
                            return res.status(500).json({ success: false, message: 'Error storing fingerprint in database' });
                        }
                        console.log('Fingerprint enrolled successfully:', generatedFingerprint);
                        res.json({ success: true, message: 'Fingerprint enrolled successfully' });
                    });
                })
                .catch(error => {
                    console.error('Error generating fingerprint:', error);
                    res.status(500).json({ success: false, message: 'Error generating fingerprint' });
                });
        });
    } catch (error) {
        console.error('Error during image processing:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server berjalan di port ${PORT}`);
    console.log(`URL: http://localhost:${PORT}/api/login`);
});
