const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(fileName) {
    return fs.readFileSync(path.join(__dirname, '..', fileName), 'utf8');
}

const indexHtml = read('index.html');
const medicineHtml = read('medicine.html');
const aiCounterHtml = read('ai-counter.html');
const aiCounterJs = read('ai-counter.js');
const medicineJs = read('medicine-refactored.js');

assert.match(
    indexHtml,
    /href="ai-counter\.html\?source=desktop"[\s\S]*?>[\s\S]*?拍图数药<\/span>/,
    'desktop should expose a standalone 拍图数药 app entry'
);

assert.match(
    medicineHtml,
    /id="btn-ai-counter"[\s\S]*?拍图数药/,
    'medicine form should rename the launcher button to 拍图数药'
);
assert.match(
    medicineHtml,
    /拍图数药结果/,
    'medicine page should rename the result modal to 拍图数药结果'
);
assert.doesNotMatch(
    medicineHtml,
    /AI 数药/,
    'medicine page should not keep the old AI 数药 user-facing copy'
);

assert.match(aiCounterHtml, /<title>拍图数药<\/title>/, 'standalone page title should be 拍图数药');
assert.match(aiCounterHtml, />\s*拍图数药\s*<\/h1>/, 'standalone page heading should be 拍图数药');
assert.match(aiCounterHtml, /拍图数药记录/, 'standalone page history copy should be renamed');
assert.doesNotMatch(
    aiCounterHtml,
    /标点辅助数药/,
    'standalone page should not keep the old 标点辅助数药 copy'
);

assert.match(aiCounterJs, /拍图数药记录/, 'history prompts should use 拍图数药记录');
assert.doesNotMatch(
    aiCounterJs,
    /确认删除这条数药记录/,
    'history delete prompt should no longer mention the old 数药记录 copy'
);

assert.match(
    medicineJs,
    /拍图数药：URL 参数解析/,
    'medicine integration comments and user-facing flow labels should be renamed to 拍图数药'
);

console.log('photo counter renaming test passed');
