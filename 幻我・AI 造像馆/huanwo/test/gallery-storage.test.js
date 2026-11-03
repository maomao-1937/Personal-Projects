const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function gallery({ failWrites = false } = {}) {
  const previous = JSON.stringify([{ dataUrl: 'data:image/png;base64,old', ts: 1 }]);
  const storage = new Map([['huanwo_history', previous]]);
  const nodes = new Map();
  function node(selector) {
    if (!nodes.has(selector)) nodes.set(selector, {
      hidden: true, style: {}, classList: { add() {}, remove() {} },
      listeners: {}, querySelectorAll: () => [],
      addEventListener(event, callback) { this.listeners[event] = callback; },
    });
    return nodes.get(selector);
  }
  const context = vm.createContext({
    document: {
      querySelector: node, querySelectorAll: () => [],
      getElementById: (id) => node('#' + id),
      addEventListener() {}, body: { style: {} },
    },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem(key, value) {
        if (failWrites) throw new Error('QuotaExceededError');
        storage.set(key, value);
      },
    },
    console: { warn() {} }, setTimeout() {}, clearTimeout() {},
  });
  vm.runInContext(readFileSync(path.join(__dirname, '../js/utils.js'), 'utf8'), context);
  const app = readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
  // Exercise real modal click handlers without starting the unrelated network/UI setup.
  assert.match(app, /  init\(\);/);
  vm.runInContext(app.replace('  init();', '  globalThis.openModalForTest = openModal;'), context);
  return { context, node, storage, previous };
}

for (const [action, source, item] of [
  ['Save', 'result', { dataUrl: 'data:image/png;base64,new', styleName: 'portrait' }],
  ['Delete', 'gallery', { dataUrl: 'data:image/png;base64,old', ts: 1 }],
]) {
  test(`${action}: failed storage write preserves the image and never reports success`, () => {
    const { context, node, storage, previous } = gallery({ failWrites: true });
    context.openModalForTest(item, source);
    node('#modal' + action).listeners.click();
    assert.equal(storage.get('huanwo_history'), previous);
    assert.equal(node('#modal').hidden, false);
    assert.equal(node('#modalImg').src, item.dataUrl);
    assert.match(node('#toast').textContent, /失败/);
    assert.doesNotMatch(node('#toast').textContent, /已收藏|已删除/);
  });

  test(`${action}: successful storage write persists the change and closes the modal`, () => {
    const { context, node, storage } = gallery();
    context.openModalForTest(item, source);
    node('#modal' + action).listeners.click();
    const saved = JSON.parse(storage.get('huanwo_history'));
    assert.equal(saved.length, action === 'Save' ? 2 : 0);
    if (action === 'Save') assert.equal(saved[0].dataUrl, item.dataUrl);
    assert.equal(node('#modal').hidden, true);
    assert.match(node('#toast').textContent, /已收藏|已删除/);
  });
}
