import { HalfFloatType, Vector2, WebGLRenderTarget, type Camera, type Scene, type WebGLRenderer } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { Tier } from '../ui/settings.ts';

// Post-processing per quality tier.
//  low:    none (straight to screen)
//  medium: bloom at half resolution
//  high:   MSAA, bloom, and a grade pass (warm highlights, teal shadows, gentle vignette)

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uVignette: { value: 0.28 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      vec3 shadows = vec3(-0.012, 0.01, 0.03);
      vec3 highlights = vec3(0.035, 0.012, -0.03);
      c.rgb += mix(shadows, highlights, smoothstep(0.2, 0.8, l));
      c.rgb = mix(vec3(l), c.rgb, 1.06);
      float v = smoothstep(0.85, 0.25, length(vUv - 0.5) * 1.25);
      c.rgb *= mix(1.0 - uVignette, 1.0, v);
      gl_FragColor = c;
    }`,
};

export class Post {
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private readonly renderer: WebGLRenderer;
  private readonly scene: Scene;
  private readonly camera: Camera;
  tier: Tier = 'medium';

  constructor(renderer: WebGLRenderer, scene: Scene, camera: Camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
  }

  configure(tier: Tier, width: number, height: number): void {
    this.tier = tier;
    this.composer?.dispose();
    this.composer = null;
    this.bloom = null;
    if (tier === 'low') return;
    const pr = this.renderer.getPixelRatio();
    const target = new WebGLRenderTarget(width * pr, height * pr, { type: HalfFloatType, samples: tier === 'high' ? 4 : 0 });
    const composer = new EffectComposer(this.renderer, target);
    composer.addPass(new RenderPass(this.scene, this.camera));
    const scale = tier === 'high' ? 1 : 0.5;
    this.bloom = new UnrealBloomPass(new Vector2(width * scale, height * scale), tier === 'high' ? 0.55 : 0.45, 0.5, 0.92);
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());
    composer.addPass(new ShaderPass(GradeShader));
    if (tier === 'medium') composer.addPass(new FXAAPass());
    composer.setSize(width, height);
    this.composer = composer;
  }

  resize(width: number, height: number): void {
    if (!this.composer) return;
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(width, height);
    const scale = this.tier === 'high' ? 1 : 0.5;
    this.bloom?.resolution.set(width * scale, height * scale);
  }

  render(): void {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
