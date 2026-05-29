const fs = require('fs');
const path = require('path');

// Target directory
const distDir = path.join(__dirname, 'dist');

// Create directory (if it exists, it doesn't clean/delete, just creates)
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
    console.log('[Build] dist directory created.');
}

// Files to copy
const filesToCopy = [
    'index.html',
    'style.css',
    'app.js'
];

// Copy files
filesToCopy.forEach(file => {
    const src = path.join(__dirname, file);
    const dest = path.join(distDir, file);
    
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`[Build] ${file} -> dist/${file} copied.`);
    } else {
        console.warn(`[Build] Warning: ${file} not found!`);
    }
});

console.log('[Build] Completed! Project is ready for Render.com.');
