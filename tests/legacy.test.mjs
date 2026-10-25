import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

async function app(url = 'https://example.test/') {
  const dom = new JSDOM(await readFile(new URL('../index.html', import.meta.url), 'utf8'), { url, runScripts: 'outside-only' });
  dom.window.scrollTo = () => {};
  dom.window.confirm = () => true;
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  dom.window.eval(await readFile(new URL('../projects.js', import.meta.url), 'utf8'));
  dom.window.eval(await readFile(new URL('../app.js', import.meta.url), 'utf8'));
  return dom;
}
test('existing personal/work/project navigation, search and assets boundary', async () => {
  const dom = await app(); const { document: d, Event } = dom.window;
  try {
    assert.equal(d.querySelector('#link-counter').textContent, '16 LINKS');
    assert.equal(d.querySelectorAll('#dashboard-grid .section-card').length, 8);
    const search = d.querySelector('#site-search'); search.value = 'ChatGPT'; search.dispatchEvent(new Event('input'));
    assert.equal(d.querySelectorAll('#dashboard-grid .site-link').length, 1);
    d.querySelector('[data-tab="work"]').click();
    assert.equal(d.querySelector('#link-counter').textContent, '6 LINKS');
    assert.equal(d.querySelectorAll('#dashboard-grid .section-card').length, 3);
    d.querySelector('[data-tab="projects"]').click();
    assert.equal(d.querySelector('#grid-heading').textContent, '개인 프로젝트');
    assert.equal(d.querySelectorAll('#dashboard-grid .lab-card').length, 6);
    assert.ok(d.querySelector('a[href="https://hsh3167.github.io/my-space-dashboard/"]'));
    d.querySelector('[data-tab="assets"]').click();
    assert.equal(d.querySelector('#asset-workspace').hidden, false);
    assert.equal(d.querySelector('#breadcrumb-active').textContent, 'Assets');
    d.querySelector('[data-tab="personal"]').click();
    assert.equal(d.querySelector('#asset-workspace').hidden, true);
    assert.equal(d.querySelector('#link-counter').textContent, '16 LINKS');
  } finally { dom.window.close(); }
});
test('link create/edit/delete, backup shape and legacy storage remain independent', async () => {
  const dom = await app(); const { document: d, Event } = dom.window;
  try {
    d.querySelector('#add-site-global').click();
    d.querySelector('#edit-name').value = 'Synthetic project'; d.querySelector('#edit-url').value = 'example.com';
    d.querySelector('#site-form').dispatchEvent(new Event('submit', { cancelable: true }));
    let saved = JSON.parse(dom.window.localStorage.getItem('myspace.dashboard.v1'));
    assert.equal(saved.projects.at(-1).url, 'https://example.com');
    const id = saved.projects.at(-1).id;
    d.querySelector(`button[data-id="${id}"]`).click();
    d.querySelector('#edit-name').value = 'Edited project';
    d.querySelector('#site-form').dispatchEvent(new Event('submit', { cancelable: true }));
    saved = JSON.parse(dom.window.localStorage.getItem('myspace.dashboard.v1'));
    assert.equal(saved.projects.at(-1).name, 'Edited project');
    d.querySelector(`button[data-id="${id}"]`).click(); d.querySelector('#delete-site').click();
    assert.equal(JSON.parse(dom.window.localStorage.getItem('myspace.dashboard.v1')).projects.length, 5);
    let backup;
    dom.window.Blob = class { constructor(parts) { this.parts = parts; } };
    dom.window.URL.createObjectURL = blob => { backup = JSON.parse(blob.parts[0]); return 'blob:synthetic'; };
    dom.window.URL.revokeObjectURL = () => {};
    dom.window.HTMLAnchorElement.prototype.click = () => {};
    d.querySelector('#export-json').click();
    assert.equal(backup.app, 'myspace'); assert.equal(backup.links.workapps.length, 4);
    assert.equal(backup.projects.length, 6);
    assert.equal(Object.keys(backup.links).includes('assets'), false);
  } finally { dom.window.close(); }
});
test('asset deep link opens only its workspace, leaving default link tabs public', async () => {
  const dom = await app('https://example.test/?view=assets');
  try { assert.equal(dom.window.document.querySelector('#asset-workspace').hidden, false); }
  finally { dom.window.close(); }
});
