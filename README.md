# 🎤 VocalCleaner — Dual-Engine AI Audio Enhancer & Mastering Pipeline 🎚️

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![CleanVoice AI](https://img.shields.io/badge/CleanVoice-AI_Denoise-8E75C2?style=for-the-badge)](https://cleanvoice.ai)
[![Auphonic](https://img.shields.io/badge/Auphonic-Studio_Mastering-1b2838?style=for-the-badge)](https://auphonic.com)
[![Render Deployment](https://img.shields.io/badge/Render-Live_App-46e3b7?style=for-the-badge&logo=render&logoColor=white)](https://vocalcleaner.onrender.com/)

**VocalCleaner** is a production-grade, dual-engine AI audio enhancing studio pipeline built with **Node.js** and **Express**. It seamlessly chains the surgical noise cleaning power of **CleanVoice AI** with the premium broadcast-level mastering abilities of **Auphonic API**, converting raw, noisy recordings into polished, radio-ready studio vocals in seconds.

**VocalCleaner is deployed and live on Render!**  
👉 **[Try VocalCleaner Live App Now!](https://vocalcleaner.onrender.com/)** 🌐

---

## 🎛️ The Dual-Engine Pipeline (Surgical Approach)

Rather than running a generic double-filtering pass that causes metallic audio distortions, VocalCleaner utilizes an optimized, non-destructive chain:

```mermaid
graph LR
    Raw[Raw MP3/WAV] -->|Upload| CV[CleanVoice AI: Phase 1]
    CV -->|Surgical Cleaning: Noise, Mouth, Breath| Aup[Auphonic API: Phase 2]
    Aup -->|Mastering: Leveler, EQ recovery, Sibilance| Final[Broadcast Studio Output]
```

### 🔬 Phase 1: CleanVoice AI (Surgical Denoise)
*   **Pure Noise Extraction:** Targets and cleans heavy background hums, breath noises, and mouth clicks without affecting the natural voice timbre.
*   **No Auto-EQ Distortion:** Deactivates automated EQ shaping and normalizations in this phase to prevent compression artifacts.

### 🎚️ Phase 2: Auphonic API (Studio Mastering)
*   **EQ & Frequency Recovery:** Boosts high frequencies (3–8 kHz EQ recovery) to restore natural brightness removed during noise cancellation.
*   **Adaptive Levelling & De-essing:** balances vocal spikes, controls sharp sibilance, and applies broadcast standard -16 LUFS loudness normalization.
*   **De-noise Gate Deactivated:** Kept off during this phase to prevent choppy silence gaps.

---

## ✨ System Architecture & APIs

*   **Asynchronous Processing:** Accepts audio uploads, writes them to disk to protect RAM, boots up the CleanVoice process, and immediately returns a unique `editId` to the client. The frontend tracks the job asynchronously via status polling.
*   **Proxy-Safe Downloader:** Features a custom redirect-tracing downloader that securely pulls mastered files from Auphonic S3 buckets, bypassing standard browser CORs policies.
*   **Responsive Control Dashboard:** A premium web UI built with Vanilla JS and CSS3 supporting intensity parameters (Hafif, Orta, Agresif) and clean file download actions.

---

## 🔒 Security Configuration

*   **Credential Hiding:** All cleanvoice and auphonic credentials are securely managed via environment variables (`.env`).
*   **Clean Git Footprint:** Excludes `.env`, local `node_modules/`, local compiled static assets (`dist/`), and local zip backups (`*.zip`, `*.rar`) to prevent security and space overhead on GitHub.

---

## 🚀 How to Set Up & Run Locally

### 1. Prerequisites
*   **Node.js:** Ensure Node.js (v18+) is installed.

### 2. Clone and Configure
```bash
git clone https://github.com/oguzemirtopuz/VocalCleaner.git
cd VocalCleaner
```
Create a `.env` file in the root folder and add your API credentials:
```env
CLEANVOICE_API_KEY=your_cleanvoice_api_key_here
AUPHONIC_USER=your_auphonic_username_here
AUPHONIC_PASS=your_auphonic_password_here
PORT=3456
```

### 3. Install & Start
```bash
npm install
npm start
```
Open `http://localhost:3456` in your browser and experience local-first AI audio mastering!

---

## 👤 Developer Profile

Engineered by **Oğuz Emir Topuz**.

*   **Age:** 14
*   **Passions:** Football Analyst & Advanced Fullstack Software Developer.
*   **Connect:** [My GitHub Portfolio](https://github.com/oguzemirtopuz)
