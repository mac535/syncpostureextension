import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Extension Manifest: dist/manifest.json is valid MV3', () => {
  const manifestPath = path.resolve('dist', 'manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'dist/manifest.json must exist');

  const content = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(content);

  assert.equal(manifest.manifest_version, 3, 'Must be Manifest V3');
  assert.ok(manifest.name, 'Extension must have a name');
  assert.ok(manifest.version, 'Extension must have a version');

  // Popup
  assert.ok(manifest.action, 'Must specify action');
  assert.ok(manifest.action.default_popup, 'Must specify default_popup');
  const popupPath = path.resolve('dist', manifest.action.default_popup);
  assert.ok(fs.existsSync(popupPath), `Popup file ${manifest.action.default_popup} must exist in dist`);

  // Background
  assert.ok(manifest.background, 'Must specify background');
  assert.equal(manifest.background.service_worker, 'background.js', 'Service worker must be background.js');
  const bgPath = path.resolve('dist', manifest.background.service_worker);
  assert.ok(fs.existsSync(bgPath), 'background.js must exist in dist');
  assert.ok(fs.statSync(bgPath).size > 100, 'background.js must not be empty');

  // Content scripts
  assert.ok(Array.isArray(manifest.content_scripts), 'content_scripts must be an array');
  assert.ok(manifest.content_scripts.length > 0, 'content_scripts must not be empty');
  const cs = manifest.content_scripts[0];
  assert.ok(cs.js.includes('content.js'), 'Must include content.js');
  assert.ok(cs.css.includes('content.css'), 'Must include content.css');

  const csJsPath = path.resolve('dist', 'content.js');
  const csCssPath = path.resolve('dist', 'content.css');
  assert.ok(fs.existsSync(csJsPath), 'content.js must exist in dist');
  assert.ok(fs.existsSync(csCssPath), 'content.css must exist in dist');

  // Monitor page
  const monitorPath = path.resolve('dist', 'monitor.html');
  assert.ok(fs.existsSync(monitorPath), 'monitor.html must exist in dist');

  // Icons
  assert.ok(manifest.icons['16'], 'Icon 16 must be specified');
  assert.ok(manifest.icons['48'], 'Icon 48 must be specified');
  assert.ok(manifest.icons['128'], 'Icon 128 must be specified');

  assert.ok(fs.existsSync(path.resolve('dist', manifest.icons['16'])), 'icon16.png must exist');
  assert.ok(fs.existsSync(path.resolve('dist', manifest.icons['48'])), 'icon48.png must exist');
  assert.ok(fs.existsSync(path.resolve('dist', manifest.icons['128'])), 'icon128.png must exist');
});
