// The 3D view, loaded on its own after the page is up. Everything is built from the layout: one box
// per part, in metres, the wall at z = 0. Frames are drawn on demand only (a change, a drag, an
// animation), which keeps phones cool and the main thread free. Materials are Lambert (matte wood,
// walls) and Phong (lacquer, brass): their shaders compile far faster than physically based ones, which
// matters on phones and on machines without a GPU, and suits matte furniture.
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MATERIALS } from '../domain/catalog';
import type { Layout, Part } from '../domain/rules';
import type { Config } from '../domain/schema';
import { setCapturer, useView, type Camera } from '../state/view';
import { shade } from '../ui/colors';
import { brassMaterial, labelTexture, shadowTexture, woodTexture } from './textures';

const M = 0.001; // millimetres to metres
const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Scene({ config, layout, label, onReady }: { config: Config; layout: Layout; label: string; onReady: () => void }) {
  return (
    <Canvas
      className="scene"
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ fov: 32, near: 0.05, far: 60, position: [2, 1.6, 4] }}
      gl={{ antialias: typeof devicePixelRatio === 'number' && devicePixelRatio < 1.5 }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; }}
      aria-label={label}
      role="img"
    >
      <color attach="background" args={['#ece6dc']} />
      <hemisphereLight args={['#fff8ee', '#b9ad9c', 1.1]} />
      <directionalLight position={[-2.5, 4, 5]} intensity={1.6} />
      <directionalLight position={[3, 2, 2]} intensity={0.35} />
      <Room config={config} />
      <Bookcase config={config} layout={layout} />
      <Dimensions config={config} />
      <Controls config={config} />
      <Ready onReady={onReady} />
    </Canvas>
  );
}

function Ready({ onReady }: { onReady: () => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    setCapturer(() => { gl.render(scene, camera); return gl.domElement.toDataURL('image/png'); });
    onReady();
    return () => { setCapturer(null); };
  }, [gl, scene, camera, onReady]);
  return null;
}

function Room({ config }: { config: Config }) {
  const shadow = useMemo(() => shadowTexture(), []);
  const W = config.width * M;
  const D = config.depth * M;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 2]}>
        <planeGeometry args={[14, 8]} />
        <meshLambertMaterial color="#cdbfa9" />
      </mesh>
      <mesh position={[0, 2, 0]}>
        <planeGeometry args={[14, 4]} />
        {/* lit mostly by itself: a wall facing the camera would otherwise turn grey */}
        <meshLambertMaterial color="#f4efe6" emissive="#efe8dc" emissiveIntensity={0.55} />
      </mesh>
      <mesh position={[0, 0.04, 0.006]}>
        <boxGeometry args={[14, 0.08, 0.012]} />
        <meshLambertMaterial color="#e6dfd3" />
      </mesh>
      {/* soft shadow under the unit, painted rather than computed */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, D / 2 + 0.02]}>
        <planeGeometry args={[W * 1.35, D * 2.2]} />
        <meshBasicMaterial map={shadow} transparent depthWrite={false} opacity={0.55} />
      </mesh>
    </group>
  );
}

function Bookcase({ config, layout }: { config: Config; layout: Layout }) {
  const m = MATERIALS[config.material];
  const materials = useMemo(() => {
    const wood = (vertical: boolean, tone = 0) => (m.kind === 'lacquer'
      ? new THREE.MeshPhongMaterial({ color: shade(m.color, tone), shininess: 26, specular: '#3a3632' })
      : new THREE.MeshLambertMaterial({ color: shade(m.color, tone), map: woodTexture(vertical, m.kind === 'plywood') }));
    return {
      vertical: wood(true), horizontal: wood(false), back: wood(true, -0.22), front: wood(true, 0.03),
      drawer: new THREE.MeshLambertMaterial({ color: '#e6d3b0' }),
      brass: brassMaterial(),
      led: new THREE.MeshBasicMaterial({ color: '#fff1c2' }),
    };
  }, [m]);
  useEffect(() => () => { Object.values(materials).forEach((x) => { x.map?.dispose(); x.dispose(); }); }, [materials]);

  const pick = (p: Part) => {
    if (p.role === 'handle') return materials.brass;
    if (p.role === 'led') return materials.led;
    if (p.role === 'back') return materials.back;
    if (p.role === 'door' || p.role === 'front') return materials.front;
    if (p.group === 'drawer' || p.role === 'drawer-bottom') return materials.drawer;
    return p.role === 'side' || p.role === 'divider' ? materials.vertical : materials.horizontal;
  };
  // doors and drawers move with their fronts: grouped per bay and drawer
  const moving = (p: Part) => p.row === 0 && (p.role === 'door' || p.role === 'front' || p.role === 'handle' || p.role.startsWith('drawer-'));
  const fixed = layout.parts.filter((p) => !moving(p));
  const doors = layout.parts.filter((p) => p.role === 'door');
  const drawers = layout.parts.filter((p) => p.role === 'front');
  const inside = (outer: Part, p: Part) => p.x >= outer.x - 1 && p.x + p.w <= outer.x + outer.w + 1 && p.y >= outer.y - 20 && p.y + p.h <= outer.y + outer.h + 20 && p.bay === outer.bay;
  const offsetX = -config.width / 2;

  return (
    <group position={[offsetX * M, 0, 0]}>
      {fixed.map((p, i) => <Box key={i} part={p} material={pick(p)} />)}
      {doors.map((door, i) => (
        <Door key={`d${i}`} door={door}>
          {layout.parts.filter((p) => p.role === 'handle' && inside(door, p)).map((h, k) => <Box key={k} part={h} material={materials.brass} rounded={config.handle === 'knob'} />)}
          <Box part={door} material={pick(door)} />
        </Door>
      ))}
      {drawers.map((front, i) => (
        <Drawer key={`t${i}`} travel={(config.depth - layout.t) * 0.7}>
          {layout.parts.filter((p) => p !== front && moving(p) && p.role !== 'door' && inside(front, p)).map((p, k) => <Box key={k} part={p} material={pick(p)} rounded={p.role === 'handle' && config.handle === 'knob'} />)}
          <Box part={front} material={pick(front)} />
        </Drawer>
      ))}
    </group>
  );
}

function Box({ part: p, material, rounded = false }: { part: Part; material: THREE.Material; rounded?: boolean }) {
  const position: [number, number, number] = [(p.x + p.w / 2) * M, (p.y + p.h / 2) * M, (p.z + p.d / 2) * M];
  if (rounded) {
    return (
      <mesh position={position} rotation-x={Math.PI / 2} material={material}>
        <cylinderGeometry args={[(p.w / 2) * M, (p.w / 2) * M, p.d * M, 20]} />
      </mesh>
    );
  }
  return (
    <mesh position={position} material={material}>
      <boxGeometry args={[p.w * M, p.h * M, p.d * M]} />
    </mesh>
  );
}

/** Animates from 0 (closed, as the meshes are built) toward a target, or jumps there with reduced motion. */
function useEase(target: number, apply: (v: number) => void) {
  const current = useRef(0);
  const { invalidate } = useThree();
  useEffect(() => { invalidate(); }, [target, invalidate]);
  useFrame((_, delta) => {
    const diff = target - current.current;
    if (Math.abs(diff) < 1e-4) { if (current.current !== target) { current.current = target; apply(target); } return; }
    current.current = reduceMotion() ? target : current.current + diff * Math.min(1, delta * 7);
    apply(current.current);
    invalidate();
  });
}

function Door({ door, children }: { door: Part; children: React.ReactNode }) {
  const open = useView((s) => s.open);
  const pivot = useRef<THREE.Group>(null);
  // the door turns around its hinge edge, at the front of the unit
  const hingeX = (door.hinge === 'left' ? door.x : door.x + door.w) * M;
  const z = (door.z + door.d) * M;
  useEase(open ? (door.hinge === 'left' ? -1.75 : 1.75) : 0, (v) => { if (pivot.current) pivot.current.rotation.y = v; });
  return (
    <group position={[hingeX, 0, z]}>
      <group ref={pivot}>
        <group position={[-hingeX, 0, -z]}>{children}</group>
      </group>
    </group>
  );
}

function Drawer({ travel, children }: { travel: number; children: React.ReactNode }) {
  const open = useView((s) => s.open);
  const group = useRef<THREE.Group>(null);
  useEase(open ? travel * M : 0, (v) => { if (group.current) group.current.position.z = v; });
  return <group ref={group}>{children}</group>;
}

function Dimensions({ config }: { config: Config }) {
  const visible = useView((s) => s.dims);
  const { invalidate } = useThree();
  useEffect(() => { invalidate(); }, [visible, invalidate]);
  const labels = useMemo(() => ({
    w: labelTexture(`${(config.width / 10).toLocaleString('fr-FR')} cm`),
    h: labelTexture(`${(config.height / 10).toLocaleString('fr-FR')} cm`),
    d: labelTexture(`${(config.depth / 10).toLocaleString('fr-FR')} cm`),
  }), [config.width, config.height, config.depth]);
  useEffect(() => () => { Object.values(labels).forEach((t) => { t.dispose(); }); }, [labels]);
  if (!visible) return null;
  const W = config.width * M;
  const H = config.height * M;
  const D = config.depth * M;
  const line = (a: [number, number, number], b: [number, number, number]) => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]);
  const ink = new THREE.LineBasicMaterial({ color: '#3a3128' });
  return (
    <group>
      <primitive object={new THREE.Line(line([-W / 2, 0.02, D + 0.12], [W / 2, 0.02, D + 0.12]), ink)} />
      <primitive object={new THREE.Line(line([W / 2 + 0.12, 0, D], [W / 2 + 0.12, H, D]), ink)} />
      <primitive object={new THREE.Line(line([W / 2, H + 0.06, 0], [W / 2, H + 0.06, D]), ink)} />
      <sprite position={[0, 0.09, D + 0.14]} scale={[0.42, 0.105, 1]}><spriteMaterial map={labels.w} depthTest={false} toneMapped={false} /></sprite>
      <sprite position={[W / 2 + 0.36, H / 2, D]} scale={[0.42, 0.105, 1]}><spriteMaterial map={labels.h} depthTest={false} toneMapped={false} /></sprite>
      <sprite position={[W / 2 + 0.3, H + 0.13, D / 2]} scale={[0.42, 0.105, 1]}><spriteMaterial map={labels.d} depthTest={false} toneMapped={false} /></sprite>
    </group>
  );
}

const VIEWS: Record<Camera, (W: number, H: number, D: number, dist: number) => [number, number, number]> = {
  front: (_W, H, D, dist) => [0, H * 0.55, D + dist],
  angle: (_W, H, D, dist) => [dist * 0.55, H * 0.62, D + dist * 0.82],
  side: (_W, H, D, dist) => [dist * 0.92, H * 0.55, D + dist * 0.38],
};

function Controls({ config }: { config: Config }) {
  const { camera, gl, invalidate, size } = useThree();
  const view = useView((s) => s.camera);
  const nonce = useView((s) => s.nonce);
  const controls = useMemo(() => new OrbitControls(camera, gl.domElement), [camera, gl]);
  const flight = useRef<{ to: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const placed = useRef(false);

  useEffect(() => {
    Object.assign(controls, {
      enableDamping: true, dampingFactor: 0.12, enablePan: false, minDistance: 0.6, maxDistance: 9,
      maxPolarAngle: Math.PI / 2 - 0.04, minAzimuthAngle: -1.35, maxAzimuthAngle: 1.35,
    });
    const onChange = () => { invalidate(); };
    controls.addEventListener('change', onChange);
    return () => { controls.removeEventListener('change', onChange); controls.dispose(); };
  }, [controls, invalidate]);

  // frame the whole unit: distance from its size, the field of view and the canvas proportions
  useEffect(() => {
    const W = config.width * M;
    const H = config.height * M;
    const D = config.depth * M;
    const persp = camera as THREE.PerspectiveCamera;
    const vFov = (persp.fov * Math.PI) / 180;
    const aspect = size.width / Math.max(1, size.height);
    const fit = Math.max(H * 1.15, (W * 1.25) / aspect);
    const dist = fit / (2 * Math.tan(vFov / 2)) + D;
    const [x, y, z] = VIEWS[view](W, H, D, dist);
    flight.current = { to: new THREE.Vector3(x, y, z), target: new THREE.Vector3(0, H * 0.48, D / 2) };
    // the first view is simply there: an opening flight would cost a dozen frames while the page loads
    if (!placed.current || reduceMotion()) {
      persp.position.copy(flight.current.to);
      controls.target.copy(flight.current.target);
      flight.current = null;
      placed.current = true;
    }
    controls.update();
    invalidate();
  }, [config.width, config.height, config.depth, view, nonce, size.width, size.height, camera, controls, invalidate]);

  useFrame((_, delta) => {
    const f = flight.current;
    if (f) {
      const k = Math.min(1, delta * 6);
      camera.position.lerp(f.to, k);
      controls.target.lerp(f.target, k);
      if (camera.position.distanceTo(f.to) < 0.002) flight.current = null;
      invalidate();
    }
    if (controls.update()) invalidate();
  });
  return null;
}
