import test from 'node:test';
import assert from 'node:assert/strict';

// Helper geometric calculations matching geometry.ts
function distance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function midpoint(p1, p2) {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

function angleFromVertical(top, bottom) {
  const dx = bottom.x - top.x;
  const dy = bottom.y - top.y;
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

test('Posture Geometry: distance calculation', () => {
  const p1 = { x: 0, y: 0 };
  const p2 = { x: 3, y: 4 };
  assert.equal(distance(p1, p2), 5);
});

test('Posture Geometry: midpoint calculation', () => {
  const p1 = { x: 2, y: 10 };
  const p2 = { x: 4, y: 20 };
  const mid = midpoint(p1, p2);
  assert.equal(mid.x, 3);
  assert.equal(mid.y, 15);
});

test('Posture Geometry: angle from vertical (perfect upright = 0 deg)', () => {
  const top = { x: 0.5, y: 0.2 };
  const bottom = { x: 0.5, y: 0.7 };
  const angle = angleFromVertical(top, bottom);
  assert.equal(Math.abs(angle), 0);
});

test('Posture Geometry: angle from vertical (tilted right)', () => {
  const top = { x: 0.5, y: 0.2 };
  const bottom = { x: 0.6, y: 0.7 }; // Leaning right
  const angle = angleFromVertical(top, bottom);
  assert.ok(angle > 10, 'Angle should be positive tilt');
});
