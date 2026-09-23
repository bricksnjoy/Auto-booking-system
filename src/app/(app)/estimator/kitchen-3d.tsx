"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { EstimateResult } from "@/lib/estimator";
import { kitchenModel, roomWalls, worldBox, type SolidKind } from "@/lib/kitchen-model";
import { planPoint } from "@/lib/kitchen";

const COLOR: Record<SolidKind, number> = {
  carcass: 0xe8dfcf,
  back: 0xf3efe7,
  shelf: 0xe2d7c3,
  door: 0x8fa2ba,
  drawer: 0x8fa2ba,
  handle: 0x1b263b,
  box: 0xd9cdb8,
  filler: 0x9eb0c5,
  leg: 0x3d4552,
  skirting: 0x5d6b7c,
  worktop: 0xeeeae3,
  tile: 0xfbfbf9,
  appliance: 0xc4cbd4,
  window: 0xbcd6ea,
};

const f1 = (n: number) => Number(n.toFixed(1)).toString();
const ftIn = (inches: number) => {
  const ft = Math.floor(inches / 12 + 1e-9);
  const rest = Math.round((inches - ft * 12) * 10) / 10;
  return rest ? `${ft}' ${rest}"` : `${ft}'`;
};

interface Built {
  scene: THREE.Scene;
  fronts: THREE.Object3D[];
  dims: THREE.Object3D[];
  centre: THREE.Vector3;
  size: number;
  /** a U is looked into from straight in front; anything else from the open side */
  side: number;
  dispose: () => void;
}

/** A text label that always faces the camera. */
function label(text: string, height: number, color = "#0d1b2a", background = "rgba(255,255,255,0.88)") {
  const lines = text.split("\n");
  const px = 44;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = `600 ${px}px Poppins, Arial, sans-serif`;
  const w = Math.ceil(Math.max(...lines.map((l) => ctx.measureText(l).width)) + px * 0.8);
  const h = Math.ceil(lines.length * px * 1.2 + px * 0.4);
  canvas.width = w;
  canvas.height = h;
  ctx.font = `600 ${px}px Poppins, Arial, sans-serif`;
  ctx.fillStyle = background;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, px * 0.3);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, w / 2, px * 0.2 + px * 1.2 * (i + 0.5)));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set((height * w) / h, height, 1);
  sprite.renderOrder = 10;
  return sprite;
}

/** Everything in the kitchen, and the room around it. */
function buildScene(result: EstimateResult): Built {
  const { layout } = result;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf6f7f9);
  const fronts: THREE.Object3D[] = [];
  const dims: THREE.Object3D[] = [];
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(x: T) => {
    disposables.push(x);
    return x;
  };

  const box = new THREE.BoxGeometry(1, 1, 1);
  const edges = new THREE.EdgesGeometry(box);
  track(box);
  track(edges);
  const mats = new Map<string, THREE.Material>();
  const mat = (kind: SolidKind) => {
    const key = kind;
    let m = mats.get(key);
    if (!m) {
      const see = kind === "appliance" || kind === "window";
      m = track(
        new THREE.MeshStandardMaterial({
          color: COLOR[kind],
          roughness: kind === "worktop" ? 0.35 : kind === "handle" ? 0.4 : 0.75,
          metalness: kind === "handle" ? 0.5 : 0,
          transparent: see,
          opacity: see ? 0.35 : 1,
          depthWrite: !see,
        }),
      );
      mats.set(key, m);
    }
    return m;
  };
  const edgeMat = track(new THREE.LineBasicMaterial({ color: 0x55606e, transparent: true, opacity: 0.55 }));
  const edgeSoft = track(new THREE.LineBasicMaterial({ color: 0x9aa3ae, transparent: true, opacity: 0.45 }));

  const min = new THREE.Vector3(Infinity, 0, Infinity);
  const max = new THREE.Vector3(-Infinity, 0, -Infinity);
  for (const s of kitchenModel(result)) {
    const b = worldBox(layout, s);
    const mesh = new THREE.Mesh(box, mat(s.kind));
    mesh.scale.set(b.x[1] - b.x[0], b.y[1] - b.y[0], b.z[1] - b.z[0]);
    mesh.position.set((b.x[0] + b.x[1]) / 2, (b.y[0] + b.y[1]) / 2, (b.z[0] + b.z[1]) / 2);
    const line = new THREE.LineSegments(edges, s.kind === "tile" || s.kind === "back" ? edgeSoft : edgeMat);
    mesh.add(line);
    scene.add(mesh);
    if (s.front) fronts.push(mesh);
    if (s.label) {
      const l = label(s.label, 5, "#415a77");
      l.position.set((b.x[0] + b.x[1]) / 2, b.y[1] + 2.5, (b.z[0] + b.z[1]) / 2);
      scene.add(l);
      dims.push(l);
    }
    min.x = Math.min(min.x, b.x[0]);
    min.z = Math.min(min.z, b.z[0]);
    max.x = Math.max(max.x, b.x[1]);
    max.y = Math.max(max.y, b.y[1]);
    max.z = Math.max(max.z, b.z[1]);
  }
  if (!Number.isFinite(min.x)) {
    min.set(0, 0, 0);
    max.set(96, 36, 24);
  }

  // the room: floor and the walls the cabinets stand against
  const walls = roomWalls(layout);
  const wallH = Math.max(max.y + 12, 96);
  const wallMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, side: THREE.FrontSide }));
  const plane = (w: number, h: number, pos: THREE.Vector3, rotY: number) => {
    const g = track(new THREE.PlaneGeometry(w, h));
    const m = new THREE.Mesh(g, wallMat);
    m.position.copy(pos);
    m.rotation.y = rotY;
    scene.add(m);
  };
  if (walls.back > 0) plane(walls.back, wallH, new THREE.Vector3(walls.back / 2, wallH / 2, -0.01), 0);
  if (walls.left > 0) plane(walls.left, wallH, new THREE.Vector3(-0.01, wallH / 2, walls.left / 2), Math.PI / 2);
  if (walls.right > 0) plane(walls.right, wallH, new THREE.Vector3(walls.rightX + 0.01, wallH / 2, walls.right / 2), -Math.PI / 2);
  const fw = Math.max(max.x, walls.back, 48) + 36;
  const fd = Math.max(max.z, walls.left, walls.right, 36) + 48;
  const floorG = track(new THREE.PlaneGeometry(fw, fd));
  const floor = new THREE.Mesh(floorG, track(new THREE.MeshStandardMaterial({ color: 0xe9e4da, roughness: 1 })));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(fw / 2 - 18, -0.02, fd / 2 - 0.01);
  scene.add(floor);

  // dimensions: each wall's length above it, each cabinet's code and width, and the heights
  const dimMat = track(new THREE.LineBasicMaterial({ color: 0x0d1b2a }));
  const dimLine = (pts: THREE.Vector3[]) => {
    const g = track(new THREE.BufferGeometry().setFromPoints(pts));
    const l = new THREE.LineSegments(g, dimMat);
    scene.add(l);
    dims.push(l);
  };
  const tick = 2;
  const span = Math.max(max.x - min.x, max.z - min.z, 60);
  const text = Math.min(9, Math.max(4.5, span / 26));
  const done = new Set<string>();
  for (const run of layout.runs) {
    if (run.length <= 0) continue;
    const key = `${run.wallId}:${f1(run.length)}`;
    if (!done.has(key)) {
      done.add(key);
      const y = max.y + 6 + (run.group === "top" ? 0 : 0);
      const a = planPoint(layout, run, 0, 0);
      const b = planPoint(layout, run, run.length, 0);
      const out = planPoint(layout, run, 0, 1);
      const nx = out.x - a.x;
      const nz = out.z - a.z;
      dimLine([
        new THREE.Vector3(a.x, y, a.z), new THREE.Vector3(b.x, y, b.z),
        new THREE.Vector3(a.x, y - tick, a.z), new THREE.Vector3(a.x, y + tick, a.z),
        new THREE.Vector3(b.x, y - tick, b.z), new THREE.Vector3(b.x, y + tick, b.z),
      ]);
      const l = label(`${f1(run.length)}in (${ftIn(run.length)})`, text * 1.1);
      l.position.set((a.x + b.x) / 2 + nx * 2, y + 3, (a.z + b.z) / 2 + nz * 2);
      scene.add(l);
      dims.push(l);
    }
    for (const seg of run.segments) {
      for (const c of seg.cabinets) {
        const p = planPoint(layout, run, (c.e0 + c.e1) / 2, run.depth + 2);
        const l = label(`${c.code} · ${f1(c.e1 - c.e0)}`, text * 0.9, "#0d1b2a", c.kind === "blind" ? "rgba(255,244,214,0.92)" : "rgba(255,255,255,0.88)");
        l.position.set(p.x, run.y0 + run.height / 2, p.z);
        scene.add(l);
        dims.push(l);
      }
    }
  }
  // the heights, up the free end of the first run
  const first = layout.runs.find((r) => r.segments.some((s) => s.cabinets.length));
  if (first) {
    const h = layout.heights;
    const at = planPoint(layout, first, first.ends[1] === "free" ? first.length + 6 : -6, 0);
    const marks: [number, number, string][] = [];
    const hasBottom = layout.runs.some((r) => r.group === "bottom");
    const hasTop = layout.runs.some((r) => r.group === "top");
    if (hasBottom) {
      if (h.leg) marks.push([0, h.leg, `legs ${f1(h.leg)}`]);
      marks.push([h.leg, h.leg + h.bottom, `cabinet ${f1(h.bottom)}`]);
      if (h.worktop) marks.push([h.leg + h.bottom, h.leg + h.bottom + h.worktop, ""]);
      if (hasTop) marks.push([h.leg + h.bottom + h.worktop, h.topY0, `tiles ${f1(h.gap)}`]);
    }
    if (hasTop) marks.push([h.topY0, h.topY0 + h.top, `cabinet ${f1(h.top)}`]);
    for (const [ya, yb, words] of marks) {
      dimLine([
        new THREE.Vector3(at.x, ya, at.z), new THREE.Vector3(at.x, yb, at.z),
        new THREE.Vector3(at.x - tick, ya, at.z), new THREE.Vector3(at.x + tick, ya, at.z),
        new THREE.Vector3(at.x - tick, yb, at.z), new THREE.Vector3(at.x + tick, yb, at.z),
      ]);
      if (words) {
        const l = label(`${words}in`, text * 0.85);
        l.position.set(at.x, (ya + yb) / 2, at.z + 0.5);
        scene.add(l);
        dims.push(l);
      }
    }
  }

  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc6b8, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(max.x * 0.8 + 60, 160, max.z + 140);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-80, 90, 60);
  scene.add(fill);

  const centre = new THREE.Vector3((min.x + max.x) / 2, max.y / 2.4, (min.z + max.z) / 2);
  const size = Math.max(max.x - min.x, max.y, max.z - min.z, 60);
  const side = walls.right > 0 ? (walls.left > 0 ? 0.12 : -0.55) : 0.55;
  return {
    scene,
    fronts,
    dims,
    centre,
    size,
    side,
    dispose: () => {
      for (const d of disposables) d.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Sprite) {
          o.material.map?.dispose();
          o.material.dispose();
        }
      });
    },
  };
}

/** Whether this browser can draw 3D at all. */
function canDraw3D() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

function place(camera: THREE.PerspectiveCamera, built: Built, zoom = 1) {
  const d = (built.size * 1.25) / zoom;
  camera.position.set(built.centre.x + d * built.side, built.centre.y + d * 0.55, built.centre.z + d * 1.1);
  camera.lookAt(built.centre);
}

/**
 * The kitchen in 3D, to turn round and look into: doors on or off, with the
 * sizes marked, and a picture of it to download.
 */
export function Kitchen3D({ result, file }: { result: EstimateResult; file: string }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ show: (doors: boolean, dims: boolean) => void; reset: () => void; picture: () => string } | null>(null);
  const [doors, setDoors] = useState(true);
  const [showDims, setShowDims] = useState(true);
  const [failed] = useState(() => !canDraw3D());

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    const built = buildScene(result);
    const camera = new THREE.PerspectiveCamera(40, 1, 1, 5000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(built.centre);
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 20;
    controls.maxDistance = built.size * 6;
    const render = () => renderer.render(built.scene, camera);
    const show = (d: boolean, m: boolean) => {
      for (const o of built.fronts) o.visible = d;
      for (const o of built.dims) o.visible = m;
      render();
    };
    const reset = () => {
      place(camera, built);
      controls.target.copy(built.centre);
      controls.update();
      render();
    };
    const size = () => {
      const w = el.clientWidth || 800;
      const h = el.clientHeight || 480;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
    };
    controls.addEventListener("change", render);
    const ro = new ResizeObserver(size);
    ro.observe(el);
    place(camera, built);
    controls.update();
    size();
    api.current = {
      show,
      reset,
      picture: () => {
        render();
        return renderer.domElement.toDataURL("image/png");
      },
    };
    return () => {
      ro.disconnect();
      controls.dispose();
      built.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, [result]);

  // after the scene is built, and whenever the toggles change
  useEffect(() => {
    api.current?.show(doors, showDims);
  }, [doors, showDims, result]);

  function download() {
    const a = api.current;
    if (!a) return;
    const link = document.createElement("a");
    link.href = a.picture();
    link.download = `${file}-3d${doors ? "" : "-open"}.png`;
    link.click();
  }

  const pill = (on: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium ${on ? "bg-[var(--brand)] text-white" : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={pill(doors)} aria-pressed={doors} onClick={() => setDoors(true)}>Doors on</button>
        <button type="button" className={pill(!doors)} aria-pressed={!doors} onClick={() => setDoors(false)}>Doors off</button>
        <span className="mx-1 h-4 w-px bg-[var(--border)]" />
        <button type="button" className={pill(showDims)} aria-pressed={showDims} onClick={() => setShowDims((v) => !v)}>Dimensions</button>
        <span className="ml-auto flex gap-3 text-xs">
          <button type="button" className="text-[var(--brand)] hover:underline" onClick={() => api.current?.reset()}>Reset view</button>
          <button type="button" className="text-[var(--brand)] hover:underline" onClick={download}>Download PNG</button>
        </span>
      </div>
      {failed ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">This browser cannot show 3D (WebGL is off).</p>
      ) : (
        <div ref={host} className="h-[520px] w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[#f6f7f9]" />
      )}
      <p className="text-xs text-[var(--muted)]">Drag to turn, scroll to zoom, right-drag to move. All sizes in inches.</p>
    </div>
  );
}

/** Pictures of the kitchen, doors on and off, for the PDF. */
export function snapshots(result: EstimateResult, width = 1600, height = 1000): { doors: string; open: string } | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  } catch {
    return null;
  }
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const built = buildScene(result);
    const camera = new THREE.PerspectiveCamera(40, width / height, 1, 5000);
    place(camera, built, 0.82);
    renderer.render(built.scene, camera);
    const doors = renderer.domElement.toDataURL("image/png");
    for (const o of built.fronts) o.visible = false;
    renderer.render(built.scene, camera);
    const open = renderer.domElement.toDataURL("image/png");
    built.dispose();
    return { doors, open };
  } finally {
    renderer.dispose();
  }
}
