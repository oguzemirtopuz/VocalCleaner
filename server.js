/**
 * ============================================
 * VocalCleaner — Backend Proxy Server
 * ============================================
 *
 * Pipeline (surgical settings):
 *   1. POST /v2/upload?filename=...  → Get Signed URL
 *   2. PUT  signedUrl                → Upload file to CleanVoice
 *   3. POST /v2/edits                → Create processing job (NO fillers/stutters/long_silences)
 *   4. GET  /v2/edits/{id}  (poll)   → Wait until CleanVoice completes
 *   5. Create + start Auphonic production
 *      (denoise:false, gate:false — only leveler/normloudness/filtering/deess)
 *   6. Auphonic polling → DONE → returns download_url to frontend
 *
 * Setup:
 *   1. Add CLEANVOICE_API_KEY, AUPHONIC_USER, AUPHONIC_PASS to the .env file
 *   2. npm install
 *   3. npm start
 */

require('dotenv').config();
const express = require('express');
const multer  = require('multer');
const cors    = require('cors');
const path    = require('path');
const https   = require('https');
const http    = require('http');
const fs      = require('fs');
const os      = require('os');

const app  = express();
const PORT = process.env.PORT || 3456;

// ===== API SETTINGS =====
const CLEANVOICE_BASE_URL = 'https://api.cleanvoice.ai/v2';
const CLEANVOICE_API_KEY  = process.env.CLEANVOICE_API_KEY;
const AUPHONIC_BASE_URL   = 'https://auphonic.com/api';
const AUPHONIC_USER       = process.env.AUPHONIC_USER;
const AUPHONIC_PASS       = process.env.AUPHONIC_PASS;

// State of background running chains (editId → chain state)
const chains = {};

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

const staticPath = fs.existsSync(path.join(__dirname, 'dist'))
    ? path.join(__dirname, 'dist')
    : __dirname;
app.use(express.static(staticPath));

// Multer — temporary file on disk (so large files do not consume RAM)
const tmpDir = os.tmpdir();
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, tmpDir),
        filename: (req, file, cb) => {
            const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            cb(null, `${Date.now()}-${safeName}`);
        }
    }),
    limits: { fileSize: 500 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ext = file.originalname.split('.').pop().toLowerCase();
        if (['mp3', 'wav'].includes(ext) ||
            ['audio/mpeg','audio/wav','audio/x-wav','audio/mp3'].includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only MP3 and WAV are supported.'));
        }
    },
});

// ===== HELPERS =====
function checkKeys() {
    return !!(CLEANVOICE_API_KEY &&
              CLEANVOICE_API_KEY !== 'your_cleanvoice_api_key_here' &&
              AUPHONIC_USER && AUPHONIC_PASS);
}

function auphonicAuth() {
    return `Basic ${Buffer.from(`${AUPHONIC_USER}:${AUPHONIC_PASS}`).toString('base64')}`;
}

// =========================================================================
// ENDPOINT: Audio Enhancement   POST /api/enhance
//
// • Uploads file to CleanVoice and opens an edit job
// • Starts the chain (CleanVoice → Auphonic) asynchronously in the background
// • Returns { editId } to frontend immediately; status is tracked via polling
// =========================================================================
app.post('/api/enhance', upload.single('audio'), async (req, res) => {
    let filePath = null;
    try {
        if (!CLEANVOICE_API_KEY || CLEANVOICE_API_KEY === 'your_cleanvoice_api_key_here') {
            return res.status(500).json({
                error: 'API_KEY_MISSING',
                message: 'CLEANVOICE_API_KEY is not defined in the .env file.',
            });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'NO_FILE', message: 'Audio file not found.' });
        }

        filePath = req.file.path;
        const filename  = req.file.originalname;
        const intensity = (req.body?.intensity ?? 'orta').toLowerCase().trim();

        console.log(`\n[VC] ── New Request ──────────────────────────────────`);
        console.log(`[VC] File     : ${filename} (${(req.file.size/1024/1024).toFixed(1)} MB)`);
        console.log(`[VC] Intensity: ${intensity}`);

        // ── 1. Signed URL ──────────────────────────────────────────────
        const upRes = await fetch(
            `${CLEANVOICE_BASE_URL}/upload?filename=${encodeURIComponent(filename)}`,
            { method: 'POST', headers: { 'X-API-Key': CLEANVOICE_API_KEY } }
        );
        if (!upRes.ok) {
            const errText = await upRes.text();
            let errorMsg = `Upload URL: ${upRes.status} — ${errText}`;
            if (upRes.status === 401) errorMsg = "Invalid API Key (401)";
            else if (upRes.status === 429) errorMsg = "Limit Exceeded (429)";
            throw new Error(errorMsg);
        }
        const { signedUrl } = await upRes.json();
        console.log('[VC] Get Signed URLındı.');

        // ── 2. Upload the file ───────────────────────────────────────────
        const stat = fs.statSync(filePath);
        const stream = fs.createReadStream(filePath);

        const putRes = await fetch(signedUrl, {
            method:  'PUT',
            headers: { 
                'Content-Type': req.file.mimetype || 'application/octet-stream',
                'Content-Length': String(stat.size)
            },
            body:    stream,
            duplex:  'half' // Required when sending a stream with Node.js fetch
        });
        if (!putRes.ok) throw new Error(`PUT: ${putRes.status} — ${await putRes.text()}`);
        const fileUrl = signedUrl.split('?')[0];
        console.log('[VC] File uploaded.');

        // ── 3. CleanVoice edit job ─────────────────────────────────────
        const config = buildCleanvoiceConfig(intensity);
        console.log('[VC] CleanVoice config:', JSON.stringify(config));

        const editRes = await fetch(`${CLEANVOICE_BASE_URL}/edits`, {
            method:  'POST',
            headers: { 'X-API-Key': CLEANVOICE_API_KEY, 'Content-Type': 'application/json' },
            body:    JSON.stringify({ input: { files: [fileUrl], config } }),
        });
        if (!editRes.ok) {
            const errText = await editRes.text();
            let errorMsg = `Edit: ${editRes.status} — ${errText}`;
            if (editRes.status === 401) errorMsg = "Invalid API Key (401)";
            else if (editRes.status === 429) errorMsg = "Limit Exceeded (429)";
            throw new Error(errorMsg);
        }

        const { id: editId } = await editRes.json();
        console.log(`[VC] Edit job: ${editId}`);

        // Chain record
        chains[editId] = { phase: 'CLEANVOICE', finalUrl: null, error: null };

        // Start in the background (no blocking)
        runChain(editId).catch(err => {
            console.error(`[VC] Chain error (${editId}):`, err.message);
            chains[editId].phase = 'FAILURE';
            chains[editId].error = err.message;
        });

        return res.json({ success: true, editId });

    } catch (err) {
        console.error('[VC] /api/enhance error:', err.message);
        return res.status(500).json({ error: 'PROCESSING_ERROR', message: err.message });
    } finally {
        if (filePath && fs.existsSync(filePath)) {
            try { 
                fs.unlinkSync(filePath); 
                console.log('[VC] Temporary file deleted.');
            } catch (e) { 
                console.error('[VC] Error deleting temporary file:', e); 
            }
        }
    }
});

// =========================================================================
// ENDPOINT: Process Status   GET /api/status/:editId
//
// Frontend polling uses this endpoint.
// CleanVoice status is proxied until it transitions to the AUPHONIC phase.
// Returns { status: 'DONE', downloadUrl } when Auphonic is completed.
// =========================================================================
app.get('/api/status/:editId', async (req, res) => {
    try {
        const { editId } = req.params;
        const chain = chains[editId];

        // Chain not started yet
        if (!chain) {
            // Query CleanVoice directly
            const r = await fetch(`${CLEANVOICE_BASE_URL}/edits/${editId}`, {
                headers: { 'X-API-Key': CLEANVOICE_API_KEY },
            });
            if (!r.ok) {
                if (r.status === 401) throw new Error("Invalid API Key (401)");
                if (r.status === 429) throw new Error("Limit Exceeded (429)");
                throw new Error(`CleanVoice status: ${r.status}`);
            }
            return res.json(await r.json());
        }

        // Auphonic mastering is ongoing
        if (chain.phase === 'AUPHONIC_MASTERING') {
            return res.json({ status: 'AUPHONIC_MASTERING', auphonicUuid: chain.auphonicUuid });
        }

        // Entire chain finished
        if (chain.phase === 'DONE') {
            return res.json({ status: 'DONE', downloadUrl: chain.finalUrl });
        }

        // Error
        if (chain.phase === 'FAILURE') {
            return res.json({ status: 'FAILURE', error: chain.error });
        }

        // Still in CleanVoice phase — direct proxy
        const r = await fetch(`${CLEANVOICE_BASE_URL}/edits/${editId}`, {
            headers: { 'X-API-Key': CLEANVOICE_API_KEY },
        });
        if (!r.ok) {
            if (r.status === 401) throw new Error("Invalid API Key (401)");
            if (r.status === 429) throw new Error("Limit Exceeded (429)");
            throw new Error(`CleanVoice status: ${r.status}`);
        }
        return res.json(await r.json());

    } catch (err) {
        console.error('[VC] /api/status error:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// =========================================================================
// ENDPOINT: Proxy Download   GET /api/download?url=...
// =========================================================================
app.get('/api/download', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ error: 'URL parameter required.' });

        console.log(`[VC] Proxy download: ${url.substring(0, 80)}...`);

        const extraHeaders = {};
        if (url.includes('auphonic.com')) {
            extraHeaders['Authorization'] = auphonicAuth();
            console.log('[VC] Auphonic auth added.');
        }

        const { buffer, contentType } = await downloadWithRedirects(url, extraHeaders);

        const rawName  = url.split('?')[0].split('/').pop() || 'enhanced_audio.wav';
        const fileName = decodeURIComponent(rawName);

        console.log(`[VC] ✅ Download completed: ${fileName} (${(buffer.length/1024/1024).toFixed(1)} MB)`);

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(buffer);

    } catch (err) {
        console.error('[VC] /api/download error:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// =========================================================================
// ENDPOINT: API Check   GET /api/check-key
// =========================================================================
app.get('/api/check-key', (_req, res) => {
    res.json({
        configured: checkKeys(),
        cleanvoice: !!(CLEANVOICE_API_KEY && CLEANVOICE_API_KEY !== 'your_cleanvoice_api_key_here'),
        auphonic:   !!(AUPHONIC_USER && AUPHONIC_PASS),
    });
});

// =========================================================================
// MAIN CHAIN: CleanVoice → Auphonic (background async)
// =========================================================================
async function runChain(editId) {
    // ── Wait until CleanVoice completes ────────────────────────────
    const cvData = await pollCleanvoice(editId);

    const cvUrl =
        cvData.download_url           ||
        cvData.result?.download_url   ||
        cvData.result?.output?.download_url ||
        cvData.output?.download_url   ||
        null;

    if (!cvUrl) throw new Error('CleanVoice download_url not found: ' + JSON.stringify(cvData));
    console.log(`[VC] ✅ CleanVoice completed.`);

    // ── Transition to Auphonic phase ────────────────────────────────────────
    chains[editId].phase = 'AUPHONIC_MASTERING';

    const prod = await createAuphonicProduction(cvUrl);
    chains[editId].auphonicUuid = prod.uuid;
    console.log(`[Auphonic] Production started: ${prod.uuid}`);

    const finalData = await pollAuphonic(prod.uuid);

    // ─────────────────────────────────────────────────────────────────
    // Find download URL in Auphonic output_files
    // The domain name may differ depending on the API version:
    //   "download_url" | "download" | "url"
    // ─────────────────────────────────────────────────────────────────
    const outFile  = (finalData.output_files || [])[0];
    const finalUrl = outFile?.download_url || outFile?.download || outFile?.url || null;

    if (!finalUrl) {
        throw new Error('Auphonic output URL not found: ' + JSON.stringify(finalData.output_files));
    }

    chains[editId].phase    = 'DONE';
    chains[editId].finalUrl = finalUrl;
    console.log(`[VC] ✨ Pipeline completed: ${finalUrl.substring(0, 80)}...`);
}

// =========================================================================
// CleanVoice Polling
// =========================================================================
async function pollCleanvoice(editId, maxAttempts = 120) {
    console.log('[VC] CleanVoice polling started...');
    await sleep(5000); // Wait first 5 secs

    for (let i = 1; i <= maxAttempts; i++) {
        const r = await fetch(`${CLEANVOICE_BASE_URL}/edits/${editId}`, {
            headers: { 'X-API-Key': CLEANVOICE_API_KEY },
        });
        if (!r.ok) {
            if (r.status === 401) throw new Error("Invalid API Key (401)");
            if (r.status === 429) console.warn(`[VC] Polling error #${i}: Limit Exceeded (429)`);
            else console.warn(`[VC] Polling error #${i}: ${r.status}`);
            await sleep(5000);
            continue;
        }

        const data   = await r.json();
        const status = data.status || data.task_status;
        console.log(`[VC] CleanVoice #${i}: ${status}`);

        if (status === 'SUCCESS') return data;
        if (status === 'FAILURE' || status === 'FAILED') {
            throw new Error('CleanVoice failed: ' + JSON.stringify(data));
        }

        await sleep(5000);
    }
    throw new Error(`CleanVoice timed out (${maxAttempts} attempts).`);
}

// =========================================================================
// Auphonic Create + Start Production
//
// ⚠️ Important: Passing presigned S3/R2 URL to Auphonic is not reliable.
//    Reliable way: Download the file to our server first, then upload to Auphonic.
//
// 🎯 Auphonic's role: Take the raw audio, "polish" it, and bring it to studio tone.
//
//   ❌ denoise → KAPALI  (CleanVoice zaten temizledi; çift geçiş = artifact compounding)
//   ❌ gate    → KAPALI  (Sessizlik kapısı pump/sıkışma efekti yarattı)
//   ✅ filtering          → 3–8 kHz EQ kurtarma — CleanVoice'un sildiği tizleri geri verir
//   ✅ normloudness        → -16 LUFS broadcast standard (no clipping)
//   ✅ deess              → Sibilans kontrolü — doğal ses
//   ✅ leveler            → Adaptif vokal seviyeleme
// =========================================================================
async function createAuphonicProduction(cleanvoiceUrl) {
    // ── STEP A: Download file from CleanVoice to our server ─────────
    console.log('[Auphonic] Downloading CleanVoice output...');
    const { buffer: audioBuffer } = await downloadWithRedirects(cleanvoiceUrl);
    console.log(`[Auphonic] Downloaded: ${(audioBuffer.length / 1024 / 1024).toFixed(1)} MB`);

    // ── STEP B: Create production (NO input_file — file upload will come next) ──
    console.log('[Auphonic] Creating production...');
    const createRes = await fetch(`${AUPHONIC_BASE_URL}/productions.json`, {
        method:  'POST',
        headers: { 'Authorization': auphonicAuth(), 'Content-Type': 'application/json' },
        body:    JSON.stringify({
            algorithms: {
                denoise:         false,  // ❌ OFF — prevents artifact compounding
                gate:            false,  // ❌ OFF — prevents pump/squash effect
                filtering:       true,   // ✅ 3–8 kHz EQ recovery + frequency balancing
                highpass_filter: true,   // ✅ Low frequency rumble/wind cleaning (75% sub-bass)
                normloudness:    true,   // ✅ Loudness normalization
                loudnesstarget:  -16,    // -16 LUFS broadcast standard (no clipping)
                deess:           true,   // ✅ Sibilance control
                leveler:         true,   // ✅ Adaptive vocal leveling
            },
            output_files: [{ format: 'wav' }],
        }),
    });
    if (!createRes.ok) {
        throw new Error(`Auphonic create: ${createRes.status} — ${await createRes.text()}`);
    }
    const createData = await createRes.json();
    const uuid       = createData.data.uuid;
    console.log(`[Auphonic] Production created: ${uuid}`);

    // ── STEP C: Upload file to production (binary upload instead of URL) ──
    console.log('[Auphonic] Uploading file (file upload)...');
    const formData = new FormData();
    formData.append(
        'input_file',
        new Blob([audioBuffer], { type: 'audio/wav' }),
        'cleaned_audio.wav'
    );
    const uploadRes = await fetch(`${AUPHONIC_BASE_URL}/production/${uuid}/upload.json`, {
        method:  'POST',
        headers: { 'Authorization': auphonicAuth() },
        body:    formData,
    });
    if (!uploadRes.ok) {
        throw new Error(`Auphonic upload: ${uploadRes.status} — ${await uploadRes.text()}`);
    }
    console.log('[Auphonic] File uploaded.');

    // ── STEP D: Start production ────────────────────────────────────
    const startRes = await fetch(`${AUPHONIC_BASE_URL}/production/${uuid}/start.json`, {
        method:  'POST',
        headers: { 'Authorization': auphonicAuth() },
    });
    if (!startRes.ok) {
        throw new Error(`Auphonic start: ${startRes.status} — ${await startRes.text()}`);
    }
    console.log(`[Auphonic] ✅ Production started: ${uuid}`);
    return createData.data;
}

// =========================================================================
// Auphonic Polling
// =========================================================================
async function pollAuphonic(uuid, maxAttempts = 72) {
    // 72 × 5 sec = 6 minutes max
    console.log(`[Auphonic] Polling started (UUID: ${uuid})...`);

    for (let i = 0; i < maxAttempts; i++) {
        await sleep(5000);

        const r = await fetch(`${AUPHONIC_BASE_URL}/production/${uuid}.json`, {
            headers: { 'Authorization': auphonicAuth() },
        });
        if (!r.ok) {
            console.warn(`[Auphonic] Polling error: ${r.status}`);
            continue;
        }

        const json   = await r.json();
        const data   = json.data;
        const status = data.status_string;
        console.log(`[Auphonic] Status #${i + 1}: ${status}`);

        if (status === 'Done')  return data;
        if (status === 'Error') throw new Error(`Auphonic error: ${data.error_message || 'Unknown error'}`);
    }
    throw new Error('Auphonic timed out.');
}

// =========================================================================
// HELPERS: Native https ile redirect takipli indirme
// (to prevent built-in fetch SSL/redirect issues)
// =========================================================================
function downloadWithRedirects(targetUrl, extraHeaders = {}, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        if (maxRedirects < 0) return reject(new Error('Too many redirects.'));

        const parsed = new URL(targetUrl);
        const lib    = parsed.protocol === 'https:' ? https : http;

        const req = lib.request({
            hostname: parsed.hostname,
            port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path:     parsed.pathname + parsed.search,
            method:   'GET',
            headers:  { 'User-Agent': 'VocalCleaner-UA', ...extraHeaders },
        }, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                const next = res.headers.location.startsWith('http')
                    ? res.headers.location
                    : `${parsed.protocol}//${parsed.host}${res.headers.location}`;
                console.log(`[VC] Redirect → ${next.substring(0, 80)}...`);
                const nextHeaders = new URL(next).hostname === parsed.hostname ? extraHeaders : {};
                return resolve(downloadWithRedirects(next, nextHeaders, maxRedirects - 1));
            }
            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error(`HTTP ${res.statusCode}`));
            }
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end',  () => resolve({
                buffer:      Buffer.concat(chunks),
                contentType: res.headers['content-type'] || 'audio/wav',
            }));
            res.on('error', reject);
        });
        req.on('error', reject);
        req.end();
    });
}

// =========================================================================
// CleanVoice Configuration — "Golden Ratio" Principle
//
// 🎯 Role: Only raw noise reduction. Polishing/EQ → Auphonic will handle.
//
// ❌ studio_sound → OFF IN ALL MODES
//    The main source of robotic sound. Artificial "studio polishing" ruins the audio.
//    Frequency restoration will be handled by Auphonic filtering.
//
// ❌ normalize → OFF IN ALL MODES (normalize: false)
//    Let Auphonic handle volume leveling solely (normloudness: -16 LUFS).
//    Double normalization destroys the audio dynamics.
//
// ❌ fillers, stutters, long_silences → OFF (they perform physical cuts)
// =========================================================================
function buildCleanvoiceConfig(intensity) {
    if (intensity === 'hafif') {
        // Absolute minimum — raw noise reduction only
        // Normalization and EQ completely delegated to Auphonic
        return {
            remove_noise:  true,
            normalize:     false,  // Auphonic will handle it — we don't want double processing
            export_format: 'wav',
        };
    }

    if (intensity === 'orta') {
        // Raw cleaning + breath — absolutely no studio_sound
        // noise_reduction: 0.7 → o son rüzgar pürüzünü robotiklik yaratmadan yakalar
        return {
            remove_noise:    true,
            normalize:       false,  // Auphonic will handle
            noise_reduction: 0.7,   // ⚠️ Experimental — increased from 0.5 (residual wind)
            breath:          true,
            export_format:   'wav',
        };
    }

    // aggressive — NO studio_sound, remove_noise + mouth/breath cleaning
    // All frequency shaping and polishing in Auphonic
    return {
        remove_noise:    true,
        normalize:       false,  // Auphonic will handle
        noise_reduction: 0.7,   // ⚠️ Experimental — below robotic limit, above wind
        breath:          true,
        mouth_sounds:    true,
        export_format:   'wav',
    };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// =========================================================================
// START SERVER
// =========================================================================
const server = app.listen(PORT, () => {
    const cvOk  = !!(CLEANVOICE_API_KEY && CLEANVOICE_API_KEY !== 'your_cleanvoice_api_key_here');
    const auOk  = !!(AUPHONIC_USER && AUPHONIC_PASS);

    console.log(`\n[SYSTEM] Starting Server...`);
    if (cvOk) {
        console.log(`[SYSTEM] CleanVoice API Key Active: "${CLEANVOICE_API_KEY.substring(0, 4)}..." (Length: ${CLEANVOICE_API_KEY.length})`);
    } else {
        console.log(`[SYSTEM] ATTENTION: CleanVoice API Key is MISSING or INVALID!`);
    }

    console.log('');
    console.log('  ╔══════════════════════════════════════════════════╗');
    console.log('  ║                                                  ║');
    console.log('  ║   🎤 VocalCleaner — AI Audio Enhancement Studio  ║');
    console.log('  ║                                                  ║');
    console.log(`  ║   🌐 http://localhost:${PORT}                      ║`);
    console.log('  ║                                                  ║');
    console.log(`  ║   🔑 CleanVoice : ${cvOk ? '✅ Configured             ' : '❌ Missing (check .env)   '}║`);
    console.log(`  ║   🎚  Auphonic  : ${auOk ? '✅ Configured             ' : '❌ Missing (check .env)   '}║`);
    console.log('  ║                                                  ║');
    console.log('  ║   Pipeline: CleanVoice → Auphonic (surgical)     ║');
    console.log('  ║   Disabled: denoise · gate · fillers ·         ║');
    console.log('  ║              stutters · long_silences            ║');
    console.log('  ║                                                  ║');
    console.log('  ╚══════════════════════════════════════════════════╝');
    console.log('');
});

// Increase server timeout for large files (30 minutes)
server.timeout = 1800000;