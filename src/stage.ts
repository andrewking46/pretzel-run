import {
  ACESFilmicToneMapping, AdditiveBlending, BoxGeometry, Color, DirectionalLight, Fog, Group, HemisphereLight, InstancedMesh, Mesh,
  PlaneGeometry, PMREMGenerator, Sprite, SpriteMaterial, PCFShadowMap, PCFSoftShadowMap, Scene,
  SRGBColorSpace, Vector3, WebGLRenderer, type Material,
} from 'three';
import { AlexView } from './actors/alex.ts';
import { Coins } from './actors/coins.ts';
import { Crowd } from './actors/crowd.ts';
import { buildDog } from './actors/dog.ts';
import { Obstacles } from './actors/obstacles.ts';
import { Powerups } from './actors/powerups.ts';
import { SPEED } from './config/tuning.ts';
import { CameraRig } from './fx/camera.ts';
import { Particles } from './fx/particles.ts';
import { Post } from './fx/post.ts';
import type { Run } from './sim/run.ts';
import type { Tier } from './ui/settings.ts';
import { buildAtlas, type Atlas } from './world/atlas.ts';
import { City, PENN_DOOR, type CityMaterials } from './world/city.ts';
import { groundHeight, toZ } from './world/layout.ts';
import {
  asphaltTexture, billboardMaterial, facadeMaterial, glowMaterial, groundMaterial, sharedUniforms, sidewalkTexture, signMaterial,
  toyMaterial,
} from './world/materials.ts';
import { canyonEnvironment, HAZE, Sky } from './world/sky.ts';
import { Traffic } from './world/traffic.ts';

// The 3D view: renderer, lights, camera, sky, and the per-run world (city, traffic, obstacles, cash,
// power-ups, Alex). Reads sim state every frame; never writes it.

// Low sun from the right (west) and a little behind the camera: far-side facades and the faces of
// obstacles catch warm light, our side of the street sits in cool shade.
const SUN_OFFSET = new Vector3(34, 26, 30);

interface World {
  run: Run;
  city: City;
  traffic: Traffic;
  obstacles: Obstacles;
  coins: Coins;
  powerups: Powerups;
}

export class Stage {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly rig = new CameraRig();
  readonly particles = new Particles();
  readonly crowd = new Crowd();
  readonly alex: AlexView;
  readonly atlas: Atlas;
  readonly sun = new DirectionalLight('#ffd2a0', 2.6);
  /**
   * Made once and shared by every run. Instanced meshes get their own copy of a material: three.js picks
   * a shader per material, and one material drawn both plain and instanced makes it re-pick every frame.
   */
  readonly mats: { toy: Material; toyInstanced: Material; glow: Material; sign: Material };
  private readonly cityMats: Omit<CityMaterials, 'facade'>;
  /** the facade shader with and without its detail (off on the Low tier) */
  private readonly facades = new Map<boolean, Material>();
  private readonly hemi = new HemisphereLight('#bcd4f2', '#8a6a4a', 0.55);
  private readonly sky: Sky;
  private readonly post: Post;
  private world: World | null = null;
  private width = 1;
  private height = 1;
  private tier: Tier = 'medium';
  time = 0;

  constructor(container: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.info.autoReset = false;
    container.appendChild(this.renderer.domElement);

    this.atlas = buildAtlas();
    this.mats = { toy: toyMaterial(), toyInstanced: toyMaterial(), glow: glowMaterial(), sign: signMaterial(this.atlas) };
    this.cityMats = {
      toy: this.mats.toy,
      glow: this.mats.glow,
      sign: this.mats.sign,
      signals: signMaterial(this.atlas),
      sidewalk: groundMaterial(sidewalkTexture()),
      road: groundMaterial(asphaltTexture()),
      billboard: billboardMaterial(),
    };

    this.scene.fog = new Fog(HAZE, 80, 330);
    this.scene.background = new Color(HAZE);
    this.scene.add(this.hemi);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = -18;
    sc.right = 18;
    sc.top = 26;
    sc.bottom = -26;
    sc.near = 5;
    sc.far = 120;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    this.sky = new Sky(SUN_OFFSET.clone());
    this.scene.add(this.sky.group);
    // Image-based light from the golden-hour sky: glass reflects it, metal shines, shadows aren't flat gray.
    const envScene = new Scene();
    envScene.add(canyonEnvironment(SUN_OFFSET.clone()));
    const pmrem = new PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(envScene, 0.02, 1, 1500, { size: 128 }).texture;
    this.scene.environmentIntensity = 0.75;
    pmrem.dispose();
    this.scene.add(this.particles.soft.points, this.particles.glow.points);
    this.alex = new AlexView(this.mats.toy);
    this.scene.add(this.alex.root);
    this.post = new Post(this.renderer, this.scene, this.rig.camera);
  }

  get run(): Run | null {
    return this.world?.run ?? null;
  }

  onTierChange: (() => void) | null = null;

  setTier(tier: Tier): void {
    this.tier = tier;
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(tier === 'low' ? 1 : tier === 'medium' ? Math.min(dpr, 1.5) : Math.min(dpr, 2));
    this.renderer.shadowMap.enabled = tier !== 'low';
    this.renderer.shadowMap.type = tier === 'high' ? PCFSoftShadowMap : PCFShadowMap;
    const size = tier === 'high' ? 2048 : 1024;
    this.sun.shadow.mapSize.set(size, size);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
    this.scene.traverse(o => {
      const m = (o as { material?: Material | Material[] }).material;
      for (const mat of Array.isArray(m) ? m : m ? [m] : []) mat.needsUpdate = true;
    });
    this.resize(this.width, this.height);
    this.post.configure(tier, this.width, this.height);
    this.onTierChange?.();
  }

  get currentTier(): Tier {
    return this.tier;
  }

  resize(w: number, h: number): void {
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.rig.resize(w, h);
    this.post.resize(w, h);
    this.particles.setViewport(h * this.renderer.getPixelRatio(), this.rig.camera.fov);
  }

  /** Tear down the previous run's world and build this one's. */
  load(run: Run): void {
    this.unload();
    const detail = this.tier !== 'low';
    if (!this.facades.has(detail)) this.facades.set(detail, facadeMaterial(detail));
    const city = new City(run.course, this.atlas, { ...this.cityMats, facade: this.facades.get(detail)! });
    const traffic = new Traffic(run.course, this.mats.toy, this.mats.glow, this.crowd);
    const obstacles = new Obstacles(this.mats, this.atlas, this.particles, this.crowd);
    const coins = new Coins(run.course.coins);
    const powerups = new Powerups(this.mats.toy);
    this.scene.add(city.group, traffic.group, obstacles.group, coins.group, powerups.group);
    this.world = { run, city, traffic, obstacles, coins, powerups };
    city.prime(run.dist, 140);
    this.alex.reset();
    this.rig.reset(run.player.x);
  }

  /**
   * Compile every shader variant the run can need (instanced, skinned, sprites, screens) now, behind the
   * title screen, so nothing compiles mid-run and hitches a frame.
   */
  warmUp(): void {
    const g = new Group();
    const toyInstanced = new InstancedMesh(new BoxGeometry(), this.mats.toyInstanced, 1);
    const signInstanced = new InstancedMesh(new BoxGeometry(), this.cityMats.signals, 1);
    const glow = new Mesh(new BoxGeometry(), this.mats.glow);
    const board = new Mesh(new PlaneGeometry(), this.cityMats.billboard);
    const sprite = new Sprite(new SpriteMaterial({ blending: AdditiveBlending, depthWrite: false, toneMapped: false }));
    for (const o of [toyInstanced, signInstanced, glow, board, sprite]) {
      o.position.set(0, -50, toZ(this.run?.dist ?? 0) - 10);
      o.castShadow = true;
      g.add(o);
    }
    for (let i = 0; i < 5; i++) {
      const dog = buildDog(i / 5 + 0.01);
      dog.object.position.set(0, -50, toZ(this.run?.dist ?? 0) - 10);
      g.add(dog.object);
    }
    this.scene.add(g);
    this.renderer.compile(this.scene, this.rig.camera);
    this.render();
    this.scene.remove(g);
    g.traverse(o => (o as Mesh).geometry?.dispose());
  }

  /** Build every chunk in view right away (after a teleport). */
  prime(): void {
    if (this.world) this.world.city.prime(this.world.run.dist);
  }

  unload(): void {
    const w = this.world;
    if (!w) return;
    w.city.dispose();
    w.traffic.dispose();
    w.obstacles.dispose();
    w.coins.dispose();
    w.powerups.clear();
    this.scene.remove(w.city.group, w.traffic.group, w.obstacles.group, w.coins.group, w.powerups.group);
    this.world = null;
  }

  /** The finish cinematic: the camera swings round to face the Penn Station doorway. */
  swingToPenn(): void {
    const mid = (PENN_DOOR.d0 + PENN_DOOR.d1) / 2;
    this.rig.startSwing(new Vector3(-3.4, 2.9, toZ(PENN_DOOR.d1 + 9.5)), new Vector3(2.8, 2.6, toZ(mid + 0.5)));
  }

  get obstacles(): Obstacles | null {
    return this.world?.obstacles ?? null;
  }

  get coins(): Coins | null {
    return this.world?.coins ?? null;
  }

  get traffic(): Traffic | null {
    return this.world?.traffic ?? null;
  }

  /** Ground height under distance d in the current course. */
  ground = (d: number): number => (this.world ? groundHeight(this.world.run.course, d) : 0);

  frame(dt: number, reducedMotion: boolean): void {
    this.time += dt;
    sharedUniforms.uTime.value = this.time;
    this.crowd.warm(3);
    const w = this.world;
    if (!w) return;
    const { run } = w;
    const t = this.time;
    const gy = this.ground(run.dist);
    // the express overlay hides the street, so use that time to build blocks faster
    w.city.update(run.dist, t, 330, run.express ? 10 : 2.5);
    w.traffic.update(run.dist, dt);
    w.obstacles.update(run, dt, t, this.ground);
    this.alex.update(run, dt, t, gy, this.particles, reducedMotion);
    const alexPos = this.alex.root.position;
    w.coins.update(run, dt, t, this.ground, alexPos);
    w.powerups.update(run, t, this.ground);
    this.particles.update(dt);

    this.rig.reducedMotion = reducedMotion;
    this.rig.update(dt, { dist: run.dist, x: run.player.x, y: run.player.y, groundY: gy, speed: run.speed, maxSpeed: SPEED.max }, this.alex.focus());
    const cam = this.rig.camera.position;
    this.sky.update(cam, run.progress);

    // sun and its shadow box follow Alex
    this.sun.target.position.set(0, 0, toZ(run.dist) - 12);
    this.sun.position.copy(this.sun.target.position).add(SUN_OFFSET);
  }

  render(): void {
    this.renderer.info.reset();
    this.post.render();
  }
}
