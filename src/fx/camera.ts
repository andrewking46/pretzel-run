import { PerspectiveCamera, Vector3 } from 'three';
import { toZ } from '../world/layout.ts';

// Chase camera. Framing matches the prototype: 7 m behind and 3.4 m above Alex, looking level,
// with the lens shifted so Alex's feet sit at 84% of screen height on any aspect ratio.
const BACK = 7;
const HEIGHT = 3.4;
const FEET_AT = 0.84;

export interface CameraTarget {
  dist: number;
  x: number;
  y: number;
  groundY: number;
  speed: number;
  maxSpeed: number;
}

export class CameraRig {
  readonly camera = new PerspectiveCamera(60, 1, 0.3, 900);
  private width = 1;
  private height = 1;
  private focal = 1;
  private camX = 0;
  private camY = 0;
  private fovKick = 1;
  private shakeT = 0;
  private shakeAmp = 0;
  /** 1 → 0 during the countdown fly-in */
  private flyIn = 0;
  /** 0 → 1 during the finish swing */
  private swing = 0;
  private swingFrom = new Vector3();
  private swingTo = new Vector3();
  private swingLook = new Vector3();
  reducedMotion = false;

  resize(w: number, h: number): void {
    this.width = w;
    this.height = h;
    this.focal = Math.min(1.22 * w, 1.03 * h);
    this.applyLens(1);
  }

  shake(amount: number): void {
    if (this.reducedMotion) return;
    this.shakeT = 0.35;
    this.shakeAmp = amount;
  }

  startFlyIn(): void {
    this.flyIn = this.reducedMotion ? 0 : 1;
  }

  /** Finish cinematic: arc from the chase position to `to`, ending up looking at `look`. */
  startSwing(to: Vector3, look: Vector3): void {
    this.swing = 0.0001;
    this.swingFrom.copy(this.camera.position);
    this.swingTo.copy(to);
    this.swingLook.copy(look);
  }

  reset(x = 0): void {
    this.camX = x * 0.55;
    this.camY = 0;
    this.swing = 0;
    this.fovKick = 1;
  }

  update(dt: number, t: CameraTarget, focus?: Vector3): void {
    const cam = this.camera;
    this.camX += (t.x * 0.55 - this.camX) * Math.min(1, dt * 7);
    this.camY += (t.y * 0.35 + t.groundY - this.camY) * Math.min(1, dt * 6);

    if (this.swing > 0 && focus) {
      // Finish: arc out over the avenue and around to face Alex as he runs into Penn.
      this.swing = Math.min(1, this.swing + dt / 1.5);
      const e = this.swing * this.swing * (3 - 2 * this.swing);
      cam.position.lerpVectors(this.swingFrom, this.swingTo, e);
      cam.position.x -= Math.sin(e * Math.PI) * 2.5;
      cam.position.y += Math.sin(e * Math.PI) * 1.2;
      const look = new Vector3().lerpVectors(focus, this.swingLook, e);
      cam.lookAt(look);
      this.applyLens(1, 1 - e);
      return;
    }

    let back = BACK;
    let up = HEIGHT;
    if (this.flyIn > 0) {
      this.flyIn = Math.max(0, this.flyIn - dt / 2.6);
      const f = this.flyIn * this.flyIn;
      back += 16 * f;
      up += 9 * f;
    }
    const target = this.reducedMotion ? 1 : 1 + 0.08 * Math.max(0, (t.speed - 11) / (t.maxSpeed - 11 + 1e-6));
    this.fovKick += (target - this.fovKick) * Math.min(1, dt * 3);

    let sx = 0;
    let sy = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmp * Math.max(0, this.shakeT / 0.35);
      sx = (Math.random() - 0.5) * a;
      sy = (Math.random() - 0.5) * a;
    }
    cam.position.set(this.camX + sx, up + this.camY + sy, toZ(t.dist) + back);
    cam.rotation.set(0, 0, 0);
    if (this.flyIn > 0) cam.rotation.x = -0.35 * this.flyIn * this.flyIn;
    this.applyLens(this.fovKick);
  }

  /** Level camera with a vertical lens shift that puts the horizon where the prototype had it. */
  private applyLens(kick: number, shift = 1): void {
    const cam = this.camera;
    const w = this.width;
    const h = this.height;
    const f = this.focal / kick;
    const horizon = FEET_AT * h - (HEIGHT / BACK) * f;
    const s = (h / 2 - horizon) * shift;
    const fullH = h + 2 * Math.abs(s);
    // fov and aspect describe the full (taller) frustum; the view offset crops our window out of it.
    cam.fov = (2 * Math.atan(fullH / 2 / f) * 180) / Math.PI;
    cam.aspect = w / fullH;
    cam.setViewOffset(w, fullH, 0, s > 0 ? 2 * s : 0, w, h);
    cam.updateProjectionMatrix();
  }
}
