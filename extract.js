const fs = require('fs');
const path = require('path');

function extractJsClean(baseName) {
    const htmlPath = path.join(__dirname, baseName + '.html');
    const jsPath = path.join(__dirname, baseName + '.js');

    let content = fs.readFileSync(htmlPath, 'utf8');

    // Find the last <script> tag
    const scriptStartTag = '<script>';
    const scriptEndTag = '</script>';

    const startIdx = content.lastIndexOf(scriptStartTag);
    const endIdx = content.lastIndexOf(scriptEndTag);

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        // Extract inner JS
        const jsContent = content.substring(startIdx + scriptStartTag.length, endIdx).trim();

        // Write to .js
        fs.writeFileSync(jsPath, jsContent + '\n');

        // Replace in HTML with src tag
        const newHtml = content.substring(0, startIdx) + `<script src="${baseName}.js"></script>` + content.substring(endIdx + scriptEndTag.length);

        fs.writeFileSync(htmlPath, newHtml);
        console.log(`Successfully extracted ${baseName}.js`);
    } else {
        console.log(`Failed to find <script> in ${baseName}`);
    }
}

['index', 'settings', 'fasting', 'bodydata', 'water'].forEach(extractJsClean);
