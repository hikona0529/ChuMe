const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(fileName) {
    return fs.readFileSync(path.join(__dirname, '..', fileName), 'utf8');
}

const indexHtml = read('index.html');
const aiCounterHtml = read('ai-counter.html');
const aiCounterJs = read('ai-counter.js');
const medicineJs = read('medicine-refactored.js');

assert.match(
    indexHtml,
    /href="ai-counter\.html\?source=desktop"/,
    'desktop launcher should open the photo counter with source=desktop'
);

assert.match(
    medicineJs,
    /window\.location\.href = 'ai-counter\.html\?source=medicine'/,
    'medicine launcher should open the photo counter with source=medicine'
);

assert.match(
    aiCounterHtml,
    /id="btn-counter-back"/,
    'photo counter page should expose a stable back-link id for dynamic routing'
);

assert.match(
    aiCounterHtml,
    /id="counter-back-label"/,
    'photo counter page should expose a stable back label id for dynamic copy updates'
);

assert.match(
    aiCounterJs,
    /var source = urlParams\.get\('source'\)/,
    'photo counter script should parse the source query parameter'
);

assert.match(
    aiCounterJs,
    /backHref = source === 'medicine' \? 'medicine\.html' : 'index\.html'/,
    'photo counter back link should route to medicine for source=medicine and desktop otherwise'
);

assert.match(
    aiCounterJs,
    /backText = source === 'medicine' \? '返回药箱' : '返回桌面'/,
    'photo counter back label should say 返回药箱 for medicine and 返回桌面 otherwise'
);

assert.match(
    aiCounterJs,
    /window\.location\.href = 'medicine\.html\?ai_count=' \+ totalCount/,
    'count completion should still route into medicine fill flow'
);

console.log('photo counter source routing test passed');
