const fs = require('fs');
const path = require('path');

function restoreHtml(baseName) {
    const htmlPath = path.join(__dirname, baseName + '.html');
    const jsPath = path.join(__dirname, baseName + '.js');

    if (!fs.existsSync(jsPath)) {
        console.log(`Skipping ${baseName}, no js file.`);
        return;
    }

    let jsContent = fs.readFileSync(jsPath, 'utf8');
    if (jsContent.endsWith('\n')) {
        jsContent = jsContent.slice(0, -1);
    }

    let htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // We replace `<script src="baseName.js"></script>\n</body>`
    // with `<script>` + jsContent + `</script>\n</body>`
    const regex = new RegExp(`<script src="${baseName}\\.js"></script>\\s*</body>`, 'i');

    if (regex.test(htmlContent)) {
        let newHtml = htmlContent.replace(regex, `<script>${jsContent}</script>\n</body>`);
        fs.writeFileSync(htmlPath, newHtml);
        fs.unlinkSync(jsPath);
        console.log(`Restored ${baseName}.html`);
    } else {
        console.log(`Could not find replacement tag in ${baseName}.html`);
    }
}

['index', 'settings', 'fasting', 'bodydata', 'water'].forEach(restoreHtml);
