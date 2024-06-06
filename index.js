const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const { PNG } = require('pngjs');
const fingerprint = require('fingerprintjs2');
const multer = require('multer');
const app = express();
const mysql = require('mysql');

app.use(bodyParser.urlencoded({ extended: true }));

const upload = multer({ dest: 'uploads/' });

const pool = mysql.createPool({
    connectionLimit: 10,
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'perpustakaan'
});

app.post('/api/login', upload.single('fingerprintImage'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'fingerprintImage is required' });
    }

    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const filePath = req.file.path;

    try {
        const data = await fs.readFile(filePath);
        const png = new PNG();

        png.parse(data, (err) => {
            if (err) {
                console.error('Error parsing PNG file:', err);
                return res.status(500).json({ success: false, message: 'Error parsing PNG file' });
            }
        
            fingerprint.getPromise({ canvas: true, audio: false })
                .then(async components => {
                    const generatedFingerprint = fingerprint.x64hash128(components.map(pair => pair.value).join(), 31);
                    
                    pool.query('SELECT fingerprint FROM users WHERE email = ?', [email], (error, results) => {
                        if (error) {
                            console.error('Error retrieving user fingerprint:', error);
                            return res.status(500).json({ success: false, message: 'Error retrieving user fingerprint' });
                        }

                        if (results.length === 0) {
                            return res.status(404).json({ success: false, message: 'User not found' });
                        }

                        const storedFingerprint = results[0].fingerprint;

                        if (generatedFingerprint === storedFingerprint) {
                            res.json({ success: true, message: 'Login berhasil!' });
                        } else {
                            res.status(401).json({ success: false, message: 'Login gagal. Sidik jari tidak cocok.' });
                        }
                    });
                })
                .catch(error => {
                    console.error('Error generating fingerprint:', error);
                    res.status(500).json({ success: false, message: 'Error generating fingerprint' });
                });
        });        
    } catch (error) {
        console.error('Error during file processing:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    } finally {
        try {
            await fs.unlink(filePath);
        } catch (unlinkError) {
            console.error(`Error removing temporary file: ${unlinkError.message}`);
        }
    }
});

app.post('/api/enroll', upload.single('fingerprintImage'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'fingerprintImage is required' });
    }

    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const filePath = req.file.path;

    try {
        const data = await fs.readFile(filePath);
        const png = new PNG();

        png.parse(data, async (err) => {
            if (err) {
                console.error('Error parsing PNG file:', err);
                return res.status(500).json({ success: false, message: 'Error parsing PNG file' });
            }

            fingerprint.getPromise({ canvas: true, audio: false })
                .then(async components => {
                    const generatedFingerprint = fingerprint.x64hash128(components.map(pair => pair.value).join(), 31);
 
                    pool.query('UPDATE users SET fingerprint = ? WHERE email = ?', [generatedFingerprint, email], (error, results) => {
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
        console.error('Error during file processing:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    } finally {
        try {
            await fs.unlink(filePath);
        } catch (unlinkError) {
            console.error(`Error removing temporary file: ${unlinkError.message}`);
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server berjalan di port ${PORT}`);
    console.log(`URL: http://localhost:${PORT}/api/login`);
});
