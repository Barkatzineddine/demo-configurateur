// Textures drawn on a canvas at load: nothing to download, nothing that a CSP would have to allow.
import * as THREE from 'three';

/** A seeded pseudo-random generator: the same grain on every visit. */
function rng(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

/** Light wood grain to multiply with the material colour; plywood gets its layered look. */
export function woodTexture(vertical: boolean, plywood = false): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    const r = rng(plywood ? 7 : 3);
    for (let i = 0; i < (plywood ? 26 : 70); i++) {
      const x = r() * size;
      const w = plywood ? 1 + r() * 3 : 0.5 + r() * 2.5;
      ctx.strokeStyle = `rgba(90, 60, 30, ${plywood ? 0.05 + r() * 0.05 : 0.04 + r() * 0.1})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      // gently wavy lines along the grain
      for (let y = 0; y <= size; y += 16) ctx.lineTo(x + Math.sin(y / 40 + i) * (plywood ? 1 : 4), y);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.center.set(0.5, 0.5);
  if (!vertical) texture.rotation = Math.PI / 2;
  return texture;
}

/** A radial gradient: the soft shadow of the unit on the floor. */
export function shadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
    g.addColorStop(0, 'rgba(40, 30, 20, 0.55)');
    g.addColorStop(1, 'rgba(40, 30, 20, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(canvas);
}

/** A dimension label as a texture for a sprite. */
export function labelTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(255, 252, 246, 0.92)';
    ctx.beginPath();
    ctx.roundRect(4, 6, 248, 52, 26);
    ctx.fill();
    ctx.fillStyle = '#2b241d';
    ctx.font = '600 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 33);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function brassMaterial(): THREE.MeshPhongMaterial {
  return new THREE.MeshPhongMaterial({ color: '#a8812f', specular: '#fff0c0', shininess: 70 });
}
