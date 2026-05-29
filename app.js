/**
 * ============================================
 * VocalCleaner — AI Audio Enhancement Studio
 * Main Application JavaScript File
 * ============================================
 * 
 * This file contains all the frontend logic of the application.
 * For actual audio processing, the Node.js proxy server (server.js) is used.
 * 
 * Setup:
 *   1. Define the CLEANVOICE_API_KEY variable in the .env file.
 *   2. Start the server with "npm start".
 *   3. Access the application at http://localhost:3456.
 */

// ===== GLOBAL STATE =====
const AppState = {
    currentFile: null,           // Uploaded file object
    originalAudioUrl: null,      // Original audio URL
    enhancedAudioUrl: null,      // Enhanced audio URL
    audioContext: null,          // Web Audio API context
    originalBuffer: null,        // Original audio buffer
    enhancedBuffer: null,        // Enhanced audio buffer
    currentMode: 'original',     // 'original' or 'enhanced'
    isPlaying: false,
    currentAudio: null,          // Active HTMLAudioElement
    originalAudio: null,
    enhancedAudio: null,
    selectedIntensity: 'orta',    // 'hafif', 'orta', 'agresif'
};

// ===== DOM ELEMENTS =====
const DOM = {
    // Upload
    uploadZone: document.getElementById('uploadZone'),
    fileInput: document.getElementById('fileInput'),
    uploadBtn: document.getElementById('uploadBtn'),
    fileInfoCard: document.getElementById('fileInfoCard'),
    fileName: document.getElementById('fileName'),
    fileSize: document.getElementById('fileSize'),
    removeFileBtn: document.getElementById('removeFileBtn'),
    enhanceBtn: document.getElementById('enhanceBtn'),
    intensityBtns: document.querySelectorAll('.intensity-btn'),
    waveformCanvas: document.getElementById('waveformCanvas'),

    // Sections
    heroSection: document.getElementById('heroSection'),
    uploadSection: document.getElementById('uploadSection'),
    processingSection: document.getElementById('processingSection'),
    resultSection: document.getElementById('resultSection'),

    // Processing
    ringProgress: document.getElementById('ringProgress'),
    ringPercent: document.getElementById('ringPercent'),
    processingTitle: document.getElementById('processingTitle'),
    processingStage: document.getElementById('processingStage'),
    visualizerBars: document.getElementById('visualizerBars'),
    steps: [
        document.getElementById('step1'),
        document.getElementById('step2'),
        document.getElementById('step3'),
        document.getElementById('step4'),
        document.getElementById('step5'),
    ],

    // Player
    abOriginal: document.getElementById('abOriginal'),
    abEnhanced: document.getElementById('abEnhanced'),
    abThumb: document.getElementById('abThumb'),
    activeModeLabel: document.getElementById('activeModeLabel'),
    modeLabelText: document.getElementById('modeLabelText'),
    playerWaveformCanvas: document.getElementById('playerWaveformCanvas'),
    playhead: document.getElementById('playhead'),
    currentTime: document.getElementById('currentTime'),
    totalTime: document.getElementById('totalTime'),
    progressFill: document.getElementById('progressFill'),
    progressBarContainer: document.getElementById('progressBarContainer'),
    playPauseBtn: document.getElementById('playPauseBtn'),
    playIcon: document.getElementById('playIcon'),
    skipBackBtn: document.getElementById('skipBackBtn'),
    skipForwardBtn: document.getElementById('skipForwardBtn'),
    volumeBtn: document.getElementById('volumeBtn'),
    volumeSlider: document.getElementById('volumeSlider'),

    // Download
    downloadWav: document.getElementById('downloadWav'),
    downloadMp3: document.getElementById('downloadMp3'),
    newFileBtn: document.getElementById('newFileBtn'),

    // Other
    bgParticles: document.getElementById('bgParticles'),
    toastContainer: document.getElementById('toastContainer'),
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    initLucideIcons();
    initParticles();
    initVisualizerBars();
    addSVGGradient();
    bindEvents();
});

/** Activate Lucide icons */
function initLucideIcons() {
    if (window.lucide) {
        lucide.createIcons();
    }
}

/** Create background particles */
function initParticles() {
    const container = DOM.bgParticles;
    const colors = ['rgba(139, 92, 246, 0.3)', 'rgba(6, 214, 160, 0.2)', 'rgba(236, 72, 153, 0.15)'];

    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        const size = Math.random() * 4 + 2;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const left = Math.random() * 100;
        const duration = Math.random() * 15 + 10;
        const delay = Math.random() * 10;

        particle.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            left: ${left}%;
            background: ${color};
            animation-duration: ${duration}s;
            animation-delay: ${delay}s;
        `;
        container.appendChild(particle);
    }
}

/** Create bars for processing animation */
function initVisualizerBars() {
    const container = DOM.visualizerBars;
    for (let i = 0; i < 40; i++) {
        const bar = document.createElement('div');
        bar.classList.add('v-bar');
        bar.style.animationDuration = `${0.5 + Math.random() * 1}s`;
        bar.style.animationDelay = `${Math.random() * 0.5}s`;
        bar.style.height = `${20 + Math.random() * 60}%`;
        container.appendChild(bar);
    }
}

/** Add SVG gradient definition (for ring-progress) */
function addSVGGradient() {
    const svg = document.querySelector('.ring-svg');
    if (!svg) return;

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', 'progressGradient');
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '100%');
    gradient.setAttribute('y2', '100%');

    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', '#8b5cf6');

    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', '#06d6a0');

    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    defs.appendChild(gradient);
    svg.insertBefore(defs, svg.firstChild);
}

// ===== EVENT BINDINGS =====
function bindEvents() {
    // --- Upload Events ---
    DOM.uploadZone.addEventListener('click', (e) => {
        if (e.target.closest('#uploadBtn') || e.target === DOM.uploadZone || e.target.closest('.upload-zone-inner')) {
            DOM.fileInput.click();
        }
    });

    DOM.fileInput.addEventListener('change', handleFileSelect);
    DOM.removeFileBtn.addEventListener('click', handleFileRemove);
    DOM.enhanceBtn.addEventListener('click', handleEnhance);

    // Intensity Selector
    DOM.intensityBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            DOM.intensityBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            AppState.selectedIntensity = btn.dataset.intensity;
        });
    });

    // Drag & Drop
    DOM.uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        DOM.uploadZone.classList.add('drag-over');
    });

    DOM.uploadZone.addEventListener('dragleave', () => {
        DOM.uploadZone.classList.remove('drag-over');
    });

    DOM.uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        DOM.uploadZone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            processFile(files[0]);
        }
    });

    // --- A/B Switch ---
    DOM.abOriginal.addEventListener('click', () => switchMode('original'));
    DOM.abEnhanced.addEventListener('click', () => switchMode('enhanced'));
    document.querySelector('.ab-switch-track')?.addEventListener('click', () => {
        switchMode(AppState.currentMode === 'original' ? 'enhanced' : 'original');
    });

    // --- Player Controls ---
    DOM.playPauseBtn.addEventListener('click', togglePlayPause);
    DOM.skipBackBtn.addEventListener('click', () => skipTime(-5));
    DOM.skipForwardBtn.addEventListener('click', () => skipTime(5));
    DOM.volumeSlider.addEventListener('input', handleVolumeChange);
    DOM.volumeBtn.addEventListener('click', toggleMute);

    // Progress bar click
    DOM.progressBarContainer.addEventListener('click', handleProgressClick);

    // Player waveform click
    DOM.playerWaveformCanvas?.parentElement?.addEventListener('click', handleWaveformClick);

    // --- Download ---
    DOM.downloadWav.addEventListener('click', () => handleDownload('wav'));
    DOM.downloadMp3.addEventListener('click', () => handleDownload('mp3'));

    // --- New File ---
    DOM.newFileBtn.addEventListener('click', handleNewFile);
}

// ===== FILE HANDLING =====

/** File selection handler */
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processFile(file);
    }
}

/** File processing and validation */
function processFile(file) {
    // Format check
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp3'];
    const ext = file.name.split('.').pop().toLowerCase();

    if (!validTypes.includes(file.type) && !['mp3', 'wav'].includes(ext)) {
        showToast('Please select an MP3 or WAV format file.', 'error');
        return;
    }

    // Size check (500MB)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
        showToast('The file size exceeds the 500MB limit.', 'error');
        return;
    }

    AppState.currentFile = file;
    AppState.originalAudioUrl = URL.createObjectURL(file);

    // Update UI
    DOM.fileName.textContent = file.name;
    DOM.fileSize.textContent = `${formatFileSize(file.size)} • ${ext.toUpperCase()}`;

    DOM.uploadZone.classList.add('hidden');
    DOM.fileInfoCard.classList.add('visible');

    // Draw waveform
    drawUploadWaveform(file);

    showToast(`"${file.name}" successfully uploaded.`, 'success');
}

/** Remove file */
function handleFileRemove(e) {
    e.stopPropagation();
    resetUpload();
}

/** Reset upload area */
function resetUpload() {
    if (AppState.originalAudioUrl) {
        URL.revokeObjectURL(AppState.originalAudioUrl);
    }
    if (AppState.enhancedAudioUrl) {
        URL.revokeObjectURL(AppState.enhancedAudioUrl);
    }

    AppState.currentFile = null;
    AppState.originalAudioUrl = null;
    AppState.enhancedAudioUrl = null;
    AppState.originalBuffer = null;
    AppState.enhancedBuffer = null;

    DOM.fileInput.value = '';
    DOM.fileInfoCard.classList.remove('visible');
    DOM.uploadZone.classList.remove('hidden');
}

// ===== WAVEFORM DRAWING =====

/** Draw upload waveform */
async function drawUploadWaveform(file) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        AppState.originalBuffer = audioBuffer;
        drawWaveform(DOM.waveformCanvas, audioBuffer, '#8b5cf6', '#a78bfa');
        audioContext.close();
    } catch (err) {
        console.warn('Draw waveformimi başarısız:', err);
    }
}

/** Draw waveform on Canvas */
function drawWaveform(canvas, audioBuffer, colorStart, colorEnd) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    // Gradient
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, colorStart);
    gradient.addColorStop(1, colorEnd);

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
            const datum = data[(i * step) + j];
            if (datum !== undefined) {
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
        }
        const y1 = (1 + min) * amp;
        const y2 = (1 + max) * amp;

        ctx.fillStyle = gradient;
        ctx.fillRect(i, y1, 1, Math.max(1, y2 - y1));
    }
}

/** Draw player waveform */
function drawPlayerWaveform(audioBuffer, mode) {
    const colors = mode === 'enhanced'
        ? ['#06d6a0', '#34e8b8']
        : ['#8b5cf6', '#a78bfa'];
    drawWaveform(DOM.playerWaveformCanvas, audioBuffer, colors[0], colors[1]);
}

// ===== API INTEGRATION =====
// =========================================================================
// 🔑 CLEANVOICE AI API INTEGRATION
// =========================================================================
// This section connects to the Cleanvoice AI API via our Node.js-based proxy server (server.js).
// 
//
// The reason for using a proxy is to keep the API key secure (not expose it)
// and to bypass CORS issues.
// =========================================================================

/**
 * Audio enhancement with the real API
 * 
 * This function sends the audio file to the Node.js backend (proxy).
 * The backend uploads to the Cleanvoice API, processes it, and returns a download_url.
 * 
 * @param {File} audioFile - The audio file to be enhanced
 * @param {string} intensity - The enhancement intensity
 * @param {Function} onProgress - Callback to track upload progress
 * @returns {Promise<string>} URL of the enhanced audio (returns editId)
 */
function enhanceAudioWithAPI(audioFile, intensity, onProgress) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('intensity', intensity); // Text field must be before file
        formData.append('audio', audioFile);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/enhance', true);

        // Upload progress
        xhr.upload.onprogress = function(event) {
            if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                if (onProgress) onProgress(percentComplete);
            }
        };

        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    resolve(data.editId);
                } catch (e) {
                    reject(new Error('The server returned an invalid response.'));
                }
            } else {
                let errorMsg = `Backend Error: ${xhr.status}`;
                try {
                    const errorData = JSON.parse(xhr.responseText);
                    errorMsg = errorData.message || errorMsg;
                } catch (e) {}
                reject(new Error(errorMsg));
            }
        };

        xhr.onerror = function() {
            reject(new Error('Could not connect to the server. Please check your internet connection.'));
        };

        xhr.send(formData);
    });
}

/**
 * Maps the status value returned from Cleanvoice to UI steps
 * @param {string} status - Cleanvoice status (PENDING, PREPROCESSING, CLASSIFICATION, EDITING, POSTPROCESSING, EXPORT, SUCCESS)
 * @returns {number} Step index (0-4)
 */
function mapStatusToStep(status) {
    const statusMap = {
        'PENDING': 0,
        'PREPROCESSING': 1,
        'CLASSIFICATION': 1,
        'EDITING': 2,
        'POSTPROCESSING': 3,
        'EXPORT': 3,
        'AUPHONIC_MASTERING': 4,  // Auphonic engaged
        'DONE': 4,
        'SUCCESS': 4
    };
    return statusMap[status] !== undefined ? statusMap[status] : 0;
}

// ===== ENHANCE PROCESS =====

/** Runs when the Enhance button is clicked */
async function handleEnhance() {
    if (!AppState.currentFile) {
        showToast('Please upload a file first.', 'error');
        return;
    }

    // UI transition: Upload → Processing
    DOM.heroSection.classList.add('hidden');
    DOM.uploadSection.classList.add('hidden');
    DOM.processingSection.classList.add('visible');
    DOM.resultSection.classList.remove('visible');

    // Update navigation
    document.querySelector('.nav-link[data-section="studio"]')?.classList.add('active');
    document.querySelector('.nav-link[data-section="upload"]')?.classList.remove('active');

    try {
        // Start processing animation and execute API call
        const enhancedUrl = await runProcessingAnimation(AppState.currentFile, AppState.selectedIntensity);

        AppState.enhancedAudioUrl = enhancedUrl;

        // Process completed — switch to result screen
        showResultSection();
        showToast('Audio successfully enhanced!', 'success');

    } catch (error) {
        console.error('Enhancement error:', error);

        const msg = error.message || '';
        let userMsg = '';

        if (msg.includes('402') || msg.includes('quota') || msg.includes('credit') || msg.includes('limit') || msg.includes('insufficient')) {
            userMsg = '⚠️ CleanVoice API kredisi bitti. Lütfen yöneticiye bildirin: "CleanVoice API\'si bitmiş."';
        } else if (msg.includes('401') || msg.includes('403') || msg.includes('API_KEY')) {
            userMsg = '⚠️ Invalid API key. Please notify the administrator.';
        } else if (msg.includes('Auphonic')) {
            userMsg = '⚠️ Lütfen yöneticiye bildirin: "Auphonic API\'si bitti veya hatalı."';
        } else if (msg.includes('zaman aşımı') || msg.includes('timeout')) {
            userMsg = '⏱️ The process took too long. Please try again.';
        } else {
            userMsg = `❌ An error occurred. Please try again. (${msg})`;
        }

        showToast(userMsg, 'error');

        // Return to Upload screen
        DOM.processingSection.classList.remove('visible');
        DOM.heroSection.classList.remove('hidden');
        DOM.uploadSection.classList.remove('hidden');
    }
}

/** 
 * Run the processing animation and synchronize the API call
 */
async function runProcessingAnimation(file, intensity) {
    // UI Status Titles
    const stageInfo = [
        { title: 'Analyzing File...', sub: 'AI is extracting your audio profile' },
        { title: 'Cleaning Vocals...', sub: 'Noise and unnecessary sounds are being removed' },
        { title: 'Balancing Audio...', sub: 'EQ and dynamic range are being optimized' },
        { title: 'Polishing Vocals...', sub: 'Breath and mouth sounds are being eliminated' },
        { title: 'Auphonic Mastering...', sub: 'Professional audio signature and normalization applied' },
        { title: 'Preparing File...', sub: 'Processed audio is being downloaded to your browser' },
        { title: 'Process Completed!', sub: 'Your cleaned audio file is ready' }
    ];

    let currentStep = -1; // -1 means uploading
    let progressPercent = 0;
    let isFinished = false;

    // Reset UI to initial state (Upload phase)
    updateRingProgress(0);
    DOM.steps.forEach(s => s.classList.remove('active', 'completed'));
    DOM.steps[0].classList.add('active');
    
    DOM.processingTitle.textContent = 'Uploading File...';
    DOM.processingStage.textContent = 'Your audio file is being transferred to our secure servers (0%)';

    // 1. Start API Process and Listen to Upload Progress
    const editId = await enhanceAudioWithAPI(file, intensity, (percent) => {
        progressPercent = percent * 0.15; // Show upload from 0% to 15% on the ring
        updateRingProgress(progressPercent);
        DOM.processingStage.textContent = `Your audio file is being transferred to our secure servers (%${Math.round(percent)})`;
    });
    
    console.log(`[VocalCleaner] Job ID: ${editId} — Intensity: ${intensity} — Polling started...`);

    // Upload finished, transitioning to the first analysis phase
    currentStep = 0;
    DOM.processingTitle.textContent = stageInfo[0].title;
    DOM.processingStage.textContent = stageInfo[0].sub;

    // Polling Loop
    while (!isFinished) {
        try {
            const response = await fetch(`/api/status/${editId}`);
            if (!response.ok) throw new Error(`Status error: ${response.status}`);

            const data = await response.json();
            const currentStatus = data.status || data.task_status;
            console.log(`[VocalCleaner] Status: ${currentStatus}`);

            const stepIdx = mapStatusToStep(currentStatus);

            // Update UI
            if (stepIdx > currentStep) {
                // Mark previous steps as completed
                for (let i = 0; i < stepIdx; i++) {
                    DOM.steps[i].classList.remove('active');
                    DOM.steps[i].classList.add('completed');
                }
                currentStep = stepIdx;
                DOM.steps[currentStep].classList.add('active');

                DOM.processingTitle.textContent = stageInfo[currentStep].title;
                DOM.processingStage.textContent = stageInfo[currentStep].sub;
            }

            // Advance progress bar artificially but logically
            const targetPercent = (stepIdx + 1) * 20 - 5;
            if (progressPercent < targetPercent) {
                progressPercent += 0.8;
            } else if (progressPercent < 98) {
                progressPercent += 0.25; // Smoother progression (so it doesn't look frozen)
            }
            updateRingProgress(progressPercent);

            // Auphonic mastering is ongoing — wait, do not open download screen
            if (currentStatus === 'AUPHONIC_MASTERING' || currentStatus === 'SUCCESS') {
                DOM.processingTitle.textContent = stageInfo[4].title;
                DOM.processingStage.textContent = stageInfo[4].sub;
                if (DOM.steps[3]) { DOM.steps[3].classList.remove('active'); DOM.steps[3].classList.add('completed'); }
                if (DOM.steps[4]) { DOM.steps[4].classList.add('active'); }
                progressPercent = Math.min(progressPercent + 0.3, 94);
                updateRingProgress(progressPercent);
                await delay(2500);
                continue;
            }

            // Entire pipeline finished (CleanVoice + Auphonic) — only now show download screen
            if (currentStatus === 'DONE') {
                isFinished = true;

                const downloadUrl = data.downloadUrl || data.download_url;
                console.log('[VocalCleaner] ✅ Pipeline completed. Download URL:', downloadUrl);

                if (!downloadUrl) throw new Error('Could not get the Download URL.');

                DOM.steps.forEach(s => s.classList.add('completed'));
                DOM.processingTitle.textContent = stageInfo[5].title;
                DOM.processingStage.textContent = stageInfo[5].sub;
                updateRingProgress(95);

                const finalUrl = await downloadEnhancedAudio(downloadUrl);

                updateRingProgress(100);
                DOM.processingTitle.textContent = stageInfo[6].title;
                DOM.processingStage.textContent = stageInfo[6].sub;

                return finalUrl;
            }

            if (currentStatus === 'FAILURE' || currentStatus === 'FAILED') {
                throw new Error('The process failed.');
            }

            // Wait 1.5 seconds (reduced from 2000 for faster response)
            await delay(1500);

        } catch (err) {
            console.error('[VocalCleaner] Polling error:', err);
            throw err;
        }
    }
}

/**
 * Downloads the processed audio via proxy and returns the Audio URL
 * @param {string} rawUrl - Raw download URL from Cleanvoice
 */
async function downloadEnhancedAudio(rawUrl) {
    console.log('[Frontend] Downloading enhanced audio...');
    const proxyUrl = `/api/download?url=${encodeURIComponent(rawUrl)}`;

    const response = await fetch(proxyUrl);
    if (!response.ok) {
        let errMsg = 'Audio file could not be downloaded.';
        try {
            const errData = await response.json();
            errMsg += ` (${errData.error || response.status})`;
        } catch (e) {
            errMsg += ` (${response.status})`;
        }
        throw new Error(errMsg);
    }

    const audioBlob = await response.blob();
    const arrayBuffer = await audioBlob.arrayBuffer();

    // Draw waveformimi için buffer'ı decode et
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    AppState.enhancedBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    return URL.createObjectURL(audioBlob);
}

/** 
 * Ring progress animation
 * @param {number} startMs - Start millisecond (over total)
 * @param {number} endMs - End millisecond (over total)
 * @param {number} totalMs - Total animation duration
 * @param {number} durationMs - Duration of this stage
 * @param {Function} isApiCompleted - Function checking if API is completed
 */
function animateProgress(startMs, endMs, totalMs, durationMs, isApiCompleted) {
    return new Promise(resolve => {
        let startPercent = (startMs / totalMs) * 100;
        let endPercent = (endMs / totalMs) * 100;

        // Do not reach 100% too quickly, wait for the final step
        if (endPercent > 98 && startPercent < 98) {
            endPercent = 98;
        }

        const startTime = performance.now();

        function animate(currentTime) {
            let progress = Math.min((currentTime - startTime) / durationMs, 1);

            // Accelerate animation if API is completed
            if (isApiCompleted && isApiCompleted()) {
                progress = Math.min(progress * 3, 1);
            }

            const currentPercent = startPercent + (endPercent - startPercent) * easeInOutCubic(progress);
            updateRingProgress(currentPercent);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                resolve();
            }
        }

        requestAnimationFrame(animate);
    });
}

/** Update Ring SVG progress */
function updateRingProgress(percent) {
    const circumference = 2 * Math.PI * 54; // r=54
    const offset = circumference - (percent / 100) * circumference;
    DOM.ringProgress.style.strokeDashoffset = offset;
    DOM.ringPercent.textContent = `${Math.round(percent)}%`;
}

// ===== RESULT SECTION =====

/** Show result section */
function showResultSection() {
    DOM.processingSection.classList.remove('visible');
    DOM.resultSection.classList.add('visible');

    // Create audio elements
    AppState.originalAudio = new Audio(AppState.originalAudioUrl);
    AppState.enhancedAudio = new Audio(AppState.enhancedAudioUrl);
    AppState.currentAudio = AppState.originalAudio;
    AppState.currentMode = 'original';

    // Set volume
    const vol = DOM.volumeSlider.value / 100;
    AppState.originalAudio.volume = vol;
    AppState.enhancedAudio.volume = vol;

    // Show duration when audio is loaded
    AppState.originalAudio.addEventListener('loadedmetadata', () => {
        DOM.totalTime.textContent = formatTime(AppState.originalAudio.duration);
    });

    // Time updates
    AppState.originalAudio.addEventListener('timeupdate', updatePlayerUI);
    AppState.enhancedAudio.addEventListener('timeupdate', updatePlayerUI);

    // When playback ends
    AppState.originalAudio.addEventListener('ended', handleAudioEnded);
    AppState.enhancedAudio.addEventListener('ended', handleAudioEnded);

    // Draw player waveform
    if (AppState.originalBuffer) {
        drawPlayerWaveform(AppState.originalBuffer, 'original');
    }

    // Reset A/B mode
    switchMode('original');

    // Refresh Lucide icons
    lucide.createIcons();
}

/** Player Update UI (timeupdate) */
function updatePlayerUI() {
    const audio = AppState.currentAudio;
    if (!audio || !audio.duration) return;

    const percent = (audio.currentTime / audio.duration) * 100;
    DOM.progressFill.style.width = `${percent}%`;
    DOM.currentTime.textContent = formatTime(audio.currentTime);

    // Playhead position
    const waveformWidth = DOM.playerWaveformCanvas?.parentElement?.offsetWidth || 0;
    const playheadPos = (percent / 100) * waveformWidth;
    DOM.playhead.style.left = `${playheadPos}px`;
}

/** When audio ends */
function handleAudioEnded() {
    AppState.isPlaying = false;
    updatePlayPauseIcon();
}

// ===== A/B MODE SWITCHING =====

/** Switch to Original or Enhanced mode */
function switchMode(mode) {
    const wasPlaying = AppState.isPlaying;
    const currentTime = AppState.currentAudio?.currentTime || 0;

    // Stop if playing
    if (wasPlaying) {
        AppState.currentAudio.pause();
    }

    AppState.currentMode = mode;

    if (mode === 'enhanced') {
        AppState.currentAudio = AppState.enhancedAudio;
        DOM.abEnhanced.classList.add('active');
        DOM.abOriginal.classList.remove('active');
        DOM.abThumb.classList.add('enhanced');
        DOM.modeLabelText.textContent = 'Enhanced Audio';
        DOM.activeModeLabel.querySelector('.mode-dot').className = 'mode-dot enhanced';
        DOM.playhead.classList.add('enhanced-mode');

        if (AppState.enhancedBuffer) {
            drawPlayerWaveform(AppState.enhancedBuffer, 'enhanced');
        }
    } else {
        AppState.currentAudio = AppState.originalAudio;
        DOM.abOriginal.classList.add('active');
        DOM.abEnhanced.classList.remove('active');
        DOM.abThumb.classList.remove('enhanced');
        DOM.modeLabelText.textContent = 'Original Audio';
        DOM.activeModeLabel.querySelector('.mode-dot').className = 'mode-dot original';
        DOM.playhead.classList.remove('enhanced-mode');

        if (AppState.originalBuffer) {
            drawPlayerWaveform(AppState.originalBuffer, 'original');
        }
    }

    // Maintain time position (for A/B comparison)
    AppState.currentAudio.currentTime = currentTime;

    // Maintain volume
    const vol = DOM.volumeSlider.value / 100;
    AppState.currentAudio.volume = vol;

    // Resume if it was playing
    if (wasPlaying) {
        AppState.currentAudio.play();
    }

    updatePlayerUI();
}

// ===== PLAYER CONTROLS =====

/** Play/Pause toggle */
function togglePlayPause() {
    if (!AppState.currentAudio) return;

    if (AppState.isPlaying) {
        AppState.currentAudio.pause();
        AppState.isPlaying = false;
    } else {
        AppState.currentAudio.play();
        AppState.isPlaying = true;
    }

    updatePlayPauseIcon();
}

/** Update Play/Pause icon */
function updatePlayPauseIcon() {
    const iconEl = DOM.playIcon;
    if (AppState.isPlaying) {
        iconEl.setAttribute('data-lucide', 'pause');
    } else {
        iconEl.setAttribute('data-lucide', 'play');
    }
    lucide.createIcons();
}

/** Skip time */
function skipTime(seconds) {
    if (!AppState.currentAudio) return;
    AppState.currentAudio.currentTime = Math.max(0,
        Math.min(AppState.currentAudio.duration, AppState.currentAudio.currentTime + seconds)
    );
    // Keep synchronized
    const otherAudio = AppState.currentMode === 'original'
        ? AppState.enhancedAudio
        : AppState.originalAudio;
    if (otherAudio) {
        otherAudio.currentTime = AppState.currentAudio.currentTime;
    }
}

/** Volume change */
function handleVolumeChange(e) {
    const vol = e.target.value / 100;
    if (AppState.originalAudio) AppState.originalAudio.volume = vol;
    if (AppState.enhancedAudio) AppState.enhancedAudio.volume = vol;
    updateVolumeIcon(vol);
}

/** Mute toggle */
function toggleMute() {
    const slider = DOM.volumeSlider;
    if (parseFloat(slider.value) > 0) {
        slider.dataset.prevValue = slider.value;
        slider.value = 0;
    } else {
        slider.value = slider.dataset.prevValue || 80;
    }
    handleVolumeChange({ target: slider });
}

/** Update volume icon */
function updateVolumeIcon(vol) {
    const iconEl = document.getElementById('volumeIcon');
    if (vol === 0) {
        iconEl.setAttribute('data-lucide', 'volume-x');
    } else if (vol < 0.5) {
        iconEl.setAttribute('data-lucide', 'volume-1');
    } else {
        iconEl.setAttribute('data-lucide', 'volume-2');
    }
    lucide.createIcons();
}

/** Progress bar click */
function handleProgressClick(e) {
    if (!AppState.currentAudio) return;
    const rect = DOM.progressBarContainer.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * AppState.currentAudio.duration;
    AppState.currentAudio.currentTime = newTime;

    // Synchronize the other audio as well
    const otherAudio = AppState.currentMode === 'original'
        ? AppState.enhancedAudio
        : AppState.originalAudio;
    if (otherAudio) {
        otherAudio.currentTime = newTime;
    }
}

/** Waveform click */
function handleWaveformClick(e) {
    if (!AppState.currentAudio) return;
    const rect = DOM.playerWaveformCanvas.parentElement.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * AppState.currentAudio.duration;
    AppState.currentAudio.currentTime = newTime;

    const otherAudio = AppState.currentMode === 'original'
        ? AppState.enhancedAudio
        : AppState.originalAudio;
    if (otherAudio) {
        otherAudio.currentTime = newTime;
    }
}

// ===== DOWNLOAD =====

/** Download processed audio */
function handleDownload(format) {
    if (!AppState.enhancedAudioUrl && !AppState.enhancedBuffer) {
        showToast('No processed audio found to download.', 'error');
        return;
    }

    const fileName = AppState.currentFile?.name?.replace(/\.[^.]+$/, '') || 'vocal_enhanced';
    const finalFileName = `${fileName}_enhanced.wav`;

    // Mobile device check (critical for iPhone/iPad)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (format === 'wav') {
        if (AppState.enhancedBuffer) {
            const blob = audioBufferToWav(AppState.enhancedBuffer);
            
            // Native Share Menu for iPhone/Mobile (Web Share API)
            if (isMobile && navigator.share) {
                const file = new File([blob], finalFileName, { type: 'audio/wav' });
                navigator.share({
                    files: [file],
                    title: 'Enhanced Audio',
                    text: 'Enhanced by VocalCleaner'
                }).catch(err => {
                    console.log('Sharing canceled or error:', err);
                    downloadBlob(blob, finalFileName);
                });
            } else {
                downloadBlob(blob, finalFileName);
            }
        } else {
            downloadFromUrl(AppState.enhancedAudioUrl, finalFileName);
        }
    } else {
        // MP3 (Currently downloads as WAV)
        if (AppState.enhancedBuffer) {
            const blob = audioBufferToWav(AppState.enhancedBuffer);
            downloadBlob(blob, `${fileName}_enhanced.wav`);
            showToast('Note: Downloaded as WAV. Backend required for MP3.', 'info');
        } else {
            downloadFromUrl(AppState.enhancedAudioUrl, `${fileName}_enhanced.mp3`);
        }
    }

    showToast('Download started!', 'success');
}

/** Download Blob as file */
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/** Download file from URL */
function downloadFromUrl(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ===== NEW FILE =====

/** Upload new file — reset */
function handleNewFile() {
    // Stop playing audio
    if (AppState.originalAudio) {
        AppState.originalAudio.pause();
        AppState.originalAudio = null;
    }
    if (AppState.enhancedAudio) {
        AppState.enhancedAudio.pause();
        AppState.enhancedAudio = null;
    }
    AppState.isPlaying = false;
    AppState.currentAudio = null;

    // Reset all steps
    DOM.steps.forEach(step => {
        step.classList.remove('active', 'completed');
    });
    updateRingProgress(0);

    // Reset UI
    DOM.resultSection.classList.remove('visible');
    DOM.processingSection.classList.remove('visible');
    DOM.heroSection.classList.remove('hidden');
    DOM.uploadSection.classList.remove('hidden');

    resetUpload();

    // Navigation
    document.querySelector('.nav-link[data-section="upload"]')?.classList.add('active');
    document.querySelector('.nav-link[data-section="studio"]')?.classList.remove('active');

    lucide.createIcons();
}

// ===== UTILITY FUNCTIONS =====

/** AudioBuffer → WAV Blob converter */
function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const dataLength = buffer.length * blockAlign;
    const headerLength = 44;
    const totalLength = headerLength + dataLength;

    const arrayBuffer = new ArrayBuffer(totalLength);
    const view = new DataView(arrayBuffer);

    // WAV Header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, totalLength - 8, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // Interleave channels
    const channels = [];
    for (let i = 0; i < numChannels; i++) {
        channels.push(buffer.getChannelData(i));
    }

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
            const sample = Math.max(-1, Math.min(1, channels[ch][i]));
            const val = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, val, true);
            offset += 2;
        }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/** Write string to DataView */
function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

/** Format file size */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/** Show time in mm:ss format */
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Easing function */
function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Delay helper */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** Show toast notification */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.classList.add('toast', type);

    const iconName = {
        success: 'check-circle-2',
        error: 'alert-circle',
        info: 'info',
    }[type] || 'info';

    toast.innerHTML = `
        <i data-lucide="${iconName}"></i>
        <span>${message}</span>
    `;

    DOM.toastContainer.appendChild(toast);
    lucide.createIcons();

    // Remove after 4 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}