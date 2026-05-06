const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function read(fileName) {
    return fs.readFileSync(path.join(__dirname, '..', fileName), 'utf8');
}

function extractFunctionSource(filePath, functionName) {
    const source = fs.readFileSync(filePath, 'utf8');
    const signature = `function ${functionName}(`;
    const start = source.indexOf(signature);
    if (start === -1) {
        throw new Error(`Function ${functionName} not found in ${filePath}`);
    }

    let braceIndex = source.indexOf('{', start);
    let depth = 0;
    let end = braceIndex;

    for (; end < source.length; end++) {
        const ch = source[end];
        if (ch === '{') depth++;
        if (ch === '}') {
            depth--;
            if (depth === 0) {
                end++;
                break;
            }
        }
    }

    return source.slice(start, end);
}

const aiCounterPath = path.join(__dirname, '..', 'ai-counter.js');
const aiCounterHtml = read('ai-counter.html');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(
    `${extractFunctionSource(aiCounterPath, 'getWorkingImageSpec')}`,
    sandbox,
    { filename: 'ai-counter.js' }
);

assert.equal(typeof sandbox.getWorkingImageSpec, 'function', 'expected getWorkingImageSpec helper');

const landscapeSpec = sandbox.getWorkingImageSpec(1600, 900, 1024);
assert.equal(landscapeSpec.shouldRotate, true, 'landscape uploads should be rotated into portrait working images');
assert.equal(landscapeSpec.canvasWidth, 576, 'landscape rotation should swap width and scale to portrait canvas width');
assert.equal(landscapeSpec.canvasHeight, 1024, 'landscape rotation should scale long side to the portrait height cap');
assert.equal(landscapeSpec.sourceDrawWidth, 1024, 'landscape source draw width should keep the scaled original long side');
assert.equal(landscapeSpec.sourceDrawHeight, 576, 'landscape source draw height should keep the scaled original short side');

const portraitSpec = sandbox.getWorkingImageSpec(900, 1600, 1024);
assert.equal(portraitSpec.shouldRotate, false, 'portrait uploads should keep their orientation');
assert.equal(portraitSpec.canvasWidth, 576, 'portrait uploads should keep the proportional portrait width');
assert.equal(portraitSpec.canvasHeight, 1024, 'portrait uploads should still scale to the same long side cap');

assert.match(
    aiCounterHtml,
    /<div class="flex-1 relative overflow-hidden flex items-center justify-center p-0 bg/,
    'fullscreen canvas area should remove extra padding so the rotated portrait image fills more of the screen'
);

console.log('photo counter landscape rotation test passed');
