import { VoxelTransitions, voxelKey } from "./transitions.js";
import * as THREE from "three";
import {
  CollisionField,
  DamageField,
  FlightPhysics,
  twist,
  decorativeScale,
} from "./physics.js";
import { Arcade } from "./arcade.js";
import { Exploration } from "./exploration.js";
import { Fauna } from "./fauna.js";
import { buildPrimitive } from "./primitives.js";
import { WORLD, wrap, delta, random, clamp, TAU } from "./simulation.js";

const box = new THREE.BoxGeometry(1, 1, 1);
const dummy = new THREE.Object3D();
const color = new THREE.Color();
const R = WORLD.length / TAU,
  r = WORLD.width / TAU,
  major = R - r;
const palettes = {
  ground: ["#768563", "#89976b", "#a2aa76", "#94a270", "#a7ae80", "#7f9069"],
  trunk: ["#706650", "#857355", "#9d8663"],
  leaves: ["#b5b77a", "#c5c184", "#d4c08b", "#d7b777", "#abb57b", "#e0c58e"],
  coral: ["#ad94b2", "#c1a2bb", "#d0b1c8", "#a888ac"],
  rock: ["#c4bba0", "#b2af99", "#d4c8a8"],
};
export function surface(
  u,
  v,
  h = 0,
  centerU = 0,
  centerV = 0,
  heading = 0,
  pivotV = centerV,
) {
  const rotated = twist(
    delta(u, centerU, WORLD.length),
    delta(v, pivotV, WORLD.width),
    heading,
  );
  const a = rotated.u / R,
    b = (rotated.v + delta(pivotV, centerV, WORLD.width)) / r;
  return new THREE.Vector3(
    (r + h) * Math.sin(b),
    (major + (r + h) * Math.cos(b)) * Math.cos(a) - R,
    -(major + (r + h) * Math.cos(b)) * Math.sin(a),
  );
}
export class FlyWorld {
  constructor(canvas, ecosystem) {
    this.ecosystem = ecosystem;
    this.u = 12;
    this.v = 160;
    this.centerV = this.v;
    this.simTime = 0;
    this.wallTime = 0;
    this.cameraMode = 0;
    this.chunks = new Map();
    this.dirty = new Set();
    this.frameCount = 0;
    this.collisions = new CollisionField();
    this.damage = new DamageField();
    this.events = [];
    this.heading = 0;
    this.exploration = new Exploration();
    this.exploration.record(this.u, this.v);
    this.altitude = Math.max(WORLD.seaLevel, this.height(this.u, this.v)) + 7;
    this.cameraAltitude = this.altitude;
    this.physics = new FlightPhysics(this.u, this.v, this.altitude);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.pixelRatio = Math.min(devicePixelRatio, 1.5);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#b8bba1");
    this.scene.fog = new THREE.FogExp2("#b7bca2", 0.0065);
    this.camera = new THREE.PerspectiveCamera(
      52,
      innerWidth / innerHeight,
      0.1,
      420,
    );
    this.eyeCamera = new THREE.PerspectiveCamera(105, 1, 0.1, 180);
    this.eyeTarget = new THREE.WebGLRenderTarget(30, 30, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });
    this.eyeTarget.texture.colorSpace = THREE.SRGBColorSpace;
    this.pixels = new Uint8Array(30 * 30 * 4);
    this.uniforms = {
      uCenter: { value: this.u },
      vCenter: { value: this.v },
      uTime: { value: 0 },
      uWallTime: { value: 0 },
      uFlyV: { value: this.v },
      uHeading: { value: 0 },
    };
    this.material = new THREE.MeshLambertMaterial();
    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader =
        "uniform float uCenter; uniform float vCenter; uniform float uTime; uniform float uFlyV; uniform float uHeading; attribute vec4 instanceRoot; attribute vec3 instanceLife; uniform float uWallTime; varying float vWater;\n" +
        shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        `
    float lifeT=clamp((uWallTime-instanceLife.x)/0.4,0.0,1.0);
    float lifeScale=mix(instanceLife.y,instanceLife.z,lifeT*lifeT*(3.0-2.0*lifeT));
    vec4 wp = vec4(transformed*lifeScale, 1.0);
    #ifdef USE_INSTANCING
    wp = instanceMatrix * wp;
    #endif
    vWater=step(1.5,instanceRoot.w)*(1.0-step(2.5,instanceRoot.w));
    if(vWater>.5)wp.y+=sin(wp.x*.6-wp.z*.45+uTime*1.6)*.06;
    if(instanceRoot.w>2.5)wp.y+=sin(uTime*.22+instanceRoot.x*.15)*.18;
    float du = mod(-wp.z-uCenter+480.0,960.0)-480.0;
    float dv = mod(wp.x-uFlyV+160.0,320.0)-160.0;
    float radius=length(vec2(du,dv));float t=clamp((radius-96.0)/40.0,0.0,1.0);
    float angle=uHeading*(1.0-t*t*(3.0-2.0*t));
    vec2 rotated=vec2(du*cos(angle)+dv*sin(angle),dv*cos(angle)-du*sin(angle));
    du=rotated.x;dv=rotated.y+mod(uFlyV-vCenter+160.0,320.0)-160.0;
    float a = du / ${R.toFixed(8)};
    float b = dv / ${r.toFixed(8)};
    float rr = ${r.toFixed(8)} + wp.y;
    wp.xyz=vec3(rr*sin(b),(${major.toFixed(8)}+rr*cos(b))*cos(a)-${R.toFixed(8)},-(${major.toFixed(8)}+rr*cos(b))*sin(a));
    vec4 mvPosition=modelViewMatrix*wp;
    gl_Position=projectionMatrix*mvPosition;
   `,
      );
      shader.fragmentShader =
        "uniform float uTime; varying float vWater;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        "#include <color_fragment>\n if(vWater>.5)diffuseColor.rgb*=.93+.12*sin(gl_FragCoord.x*.07+gl_FragCoord.y*.04+uTime*1.6);",
      );
    };
    this.scene.add(new THREE.HemisphereLight("#fff0cc", "#465945", 1.9));
    const light = new THREE.DirectionalLight("#ffdeb0", 2.3);
    light.position.set(-70, 100, -70);
    this.scene.add(light);
    const fill = new THREE.DirectionalLight("#becac0", 0.7);
    fill.position.set(60, 30, 20);
    this.scene.add(fill);
    this.createSky();
    this.createFly();
    this.createParticles();
    this.fauna = new Fauna(
      this.scene,
      (u, v, h) => this.project(u, v, h),
      (u, v) => this.height(u, v),
    );
    this.arcade = new Arcade(this);
    this.transitions = new VoxelTransitions(this);
    this.updateChunks(true);
    this.update(0, 0);
    window.addEventListener("resize", () => this.resize());
  }
  project(u, v, h) {
    return surface(u, v, h, this.u, this.centerV, this.heading, this.v);
  }
  consumeEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }
  createSky() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(350, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          top: { value: new THREE.Color("#819c9b") },
          bottom: { value: new THREE.Color("#e4c9a2") },
        },
        vertexShader:
          "varying vec3 vP; void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
        fragmentShader:
          "varying vec3 vP;uniform vec3 top;uniform vec3 bottom;void main(){float h=normalize(vP).y;vec3 col=mix(bottom,top,smoothstep(-.05,.8,h));gl_FragColor=vec4(col,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}",
      }),
    );
    // Includes must start on a new line for the shader preprocessor.
    sky.material.fragmentShader = sky.material.fragmentShader.replace(
      ";#include",
      ";\n#include",
    );
    this.scene.add(sky);
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(11, 32, 16),
      new THREE.MeshBasicMaterial({ color: "#ffe7b9", fog: false }),
    );
    sun.position.set(33, 8, -250);
    this.scene.add(sun);
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {},
        vertexShader:
          "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
        fragmentShader:
          "varying vec2 vUv;void main(){float d=distance(vUv,vec2(.5));gl_FragColor=vec4(1.,.83,.56,pow(max(0.,1.-d*2.),3.)*.24);}",
      }),
    );
    halo.position.copy(sun.position).add(new THREE.Vector3(0, 0, 12));
    halo.lookAt(0, 0, 0);
    this.scene.add(halo);
  }
  createFly() {
    this.observer = new THREE.Group();
    this.observer.name = "flying-observer";
    this.scene.add(this.observer);
    this.fly = new THREE.Group();
    this.observer.add(this.fly);
    const mat = (color, extra = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.58, ...extra });
    const body = mat("#746349"),
      dark = mat("#403e30"),
      eye = mat("#a84e36", { roughness: 0.28, metalness: 0.15 });
    const ellipsoid = (x, y, z, sx, sy, sz, m, parent = this.fly) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), m);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      parent.add(mesh);
      return mesh;
    };
    this.abdomen = new THREE.Group();
    this.fly.add(this.abdomen);
    for (let i = 0; i < 6; i++) {
      const taper = 1 - i * 0.1;
      ellipsoid(
        0,
        -0.04 - i * 0.055,
        0.45 + i * 0.22,
        0.5 * taper,
        0.4 * taper,
        0.25,
        i % 2 ? dark : body,
        this.abdomen,
      );
    }
    ellipsoid(0, 0.1, -0.2, 0.55, 0.48, 0.65, body);
    ellipsoid(0, 0.18, -0.96, 0.54, 0.39, 0.36, dark);
    for (const side of [-1, 1])
      ellipsoid(side * 0.4, 0.25, -1.07, 0.29, 0.34, 0.27, eye);
    // Subtle translucent brain window retains the experiment's visual identity.
    const brain = mat("#d6a18e", {
      emissive: "#9b5d40",
      emissiveIntensity: 0.12,
    });
    for (let i = 0; i < 12; i++) {
      const r = random(i + 52);
      ellipsoid(
        (r() - 0.5) * 0.62,
        0.47 + r() * 0.12,
        -0.3 + (r() - 0.5) * 0.55,
        0.15,
        0.12,
        0.16,
        brain,
      );
    }
    ellipsoid(
      0,
      0.48,
      -0.28,
      0.46,
      0.22,
      0.48,
      mat("#caddcc", { transparent: true, opacity: 0.14, depthWrite: false }),
    );
    this.wings = [];
    this.legs = [];
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.5, -0.65, 2.5, -0.9, 2.9, -0.1);
    shape.bezierCurveTo(3.3, 0.7, 1.8, 1.15, 0.2, 0.35);
    shape.closePath();
    const wingGeometry = new THREE.ShapeGeometry(shape, 12);
    wingGeometry.rotateX(Math.PI / 2);
    const wingMaterial = mat("#e3ecdc", {
      transparent: true,
      opacity: 0.43,
      side: THREE.DoubleSide,
      depthWrite: false,
      metalness: 0.1,
      roughness: 0.25,
    });
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.38, 0.32, -0.3);
      pivot.scale.x = side;
      this.fly.add(pivot);
      this.wings.push(pivot);
      const wing = new THREE.Mesh(wingGeometry, wingMaterial);
      pivot.add(wing);
      for (const z of [-0.3, 0.15, 0.5]) {
        const points = [
          new THREE.Vector3(0, 0.01, 0),
          new THREE.Vector3(0.9, 0.01, z * 0.4),
          new THREE.Vector3(2.5, 0.01, z),
        ];
        pivot.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(points),
            new THREE.LineBasicMaterial({
              color: "#afbca5",
              transparent: true,
              opacity: 0.55,
            }),
          ),
        );
      }
      // Two faint swept membranes communicate motion between readable wing beats.
      for (const angle of [-0.22, 0.22]) {
        const ghost = new THREE.Mesh(
          wingGeometry,
          mat("#e3ecdc", {
            transparent: true,
            opacity: 0.065,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        );
        ghost.rotation.z = angle;
        pivot.add(ghost);
      }
      for (let i = 0; i < 3; i++) {
        const leg = new THREE.Group();
        leg.position.set(side * 0.35, -0.2, -0.5 + i * 0.4);
        this.fly.add(leg);
        this.legs.push(leg);
        const points = [
          new THREE.Vector3(),
          new THREE.Vector3(side * 0.5, -0.3, 0.2),
          new THREE.Vector3(side * 0.65, -0.55, 0.6),
        ];
        leg.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(points),
            new THREE.LineBasicMaterial({ color: "#514c39" }),
          ),
        );
      }
      this.fly.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(side * 0.15, 0.4, -1.2),
            new THREE.Vector3(side * 0.28, 0.7, -1.5),
          ]),
          new THREE.LineBasicMaterial({ color: "#534e3a" }),
        ),
      );
    }
  }
  createParticles() {
    const rng = random(291);
    const positions = new Float32Array(130 * 3);
    for (let i = 0; i < 130; i++) {
      positions[i * 3] = (rng() - 0.5) * 100;
      positions[i * 3 + 1] = rng() * 20 + 1;
      positions[i * 3 + 2] = -rng() * 130 + 20;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.particles = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: "#f6e3b0",
        size: 0.12,
        transparent: true,
        opacity: 0.7,
        sizeAttenuation: true,
      }),
    );
    this.scene.add(this.particles);
  }
  height(u, v) {
    return Math.round(this.ecosystem.terrainHeight(u, v) * 2) / 2;
  }
  reset() {
    this.u = 12;
    this.v = 160;
    this.centerV = 160;
    this.simTime = 0;
    this.altitude = Math.max(WORLD.seaLevel, this.height(this.u, this.v)) + 7;
    this.cameraAltitude = this.altitude;
    this.heading = 0;
    this.physics = new FlightPhysics(this.u, this.v, this.altitude);
    this.damage = new DamageField();
    this.arcade.reset();
    this.transitions.clear();
    this.events = [];
    this.exploration.reset();
    this.exploration.record(this.u, this.v);
    this.fauna.reset(this.u, this.v);
    this.chunks.forEach((_, key) => this.dirty.add(key));
    this.updateChunks(true);
    this.update(0, 0);
  }
  makeChunk(cu, cv, old) {
    const prior = new Map(
      (old?.userData.boxes || []).map((b) => [voxelKey(b), b]),
    );
    const patch = this.ecosystem.patch(cu, cv),
      rng = random(patch.seed),
      genes = patch.genes;
    const distant =
      Math.hypot(
        delta(patch.u * 16 + 8, this.u, WORLD.length),
        delta(patch.v * 16 + 8, this.v, WORLD.width),
      ) > 145;
    const mesh =
      old || new THREE.InstancedMesh(box.clone(), this.material, 2200);
    mesh.frustumCulled = false;
    mesh.count = 0;
    if (!old)
      mesh.geometry.setAttribute(
        "instanceRoot",
        new THREE.InstancedBufferAttribute(new Float32Array(2200 * 4), 4),
      );
    if (!mesh.geometry.getAttribute("instanceLife"))
      mesh.geometry.setAttribute(
        "instanceLife",
        new THREE.InstancedBufferAttribute(new Float32Array(2200 * 3), 3),
      );
    const lives = mesh.geometry.getAttribute("instanceLife");
    let incoming = 0;
    const owner = this.ecosystem.key(cu, cv),
      boxes = [];
    const roots = mesh.geometry.getAttribute("instanceRoot");
    let root = [0, 0, 0, 0],
      voxelOrdinal = 0;
    const put = (x, y, z, sx, sy, sz, c) => {
      if (mesh.count >= 2200) return;
      // Tiny deterministic offsets separate overlapping decorative faces. Ground and water stay tiled.
      if (root[3] !== 0 && root[3] !== 2) {
        const k = decorativeScale(patch.seed, voxelOrdinal++);
        sx *= k;
        sy *= k;
        sz *= k;
        y += (k - 1) * 0.7;
      }
      let collider = {
        u: z,
        v: x,
        y,
        su: sz,
        sv: sx,
        sy,
        kind: root[3],
        rootV: root[0],
        root: [...root],
        color: c,
        owner,
        index: mesh.count,
      };
      collider = this.damage.apply(owner, collider);
      if (!collider) return;
      y = collider.y;
      sy = collider.sy;
      const key = voxelKey(collider),
        previous = prior.get(key);
      collider.life = previous?.life || [this.wallTime, 0.001, 1];
      prior.delete(key);
      if (!previous) incoming++;
      lives.setXYZ(mesh.count, ...collider.life);
      boxes.push(collider);
      dummy.position.set(x, y, -z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(mesh.count, dummy.matrix);
      color.set(c);
      mesh.setColorAt(mesh.count, color);
      roots.setXYZW(mesh.count, ...root);
      mesh.count++;
    };
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];
    for (let x = 0; x < 8; x++)
      for (let z = 0; z < 8; z++) {
        const u = patch.u * 16 + z * 2,
          v = patch.v * 16 + x * 2,
          h = this.height(u, v, patch);
        root = [v, h, u, 0];
        const underwater = h < WORLD.seaLevel;
        const groundRandom = random((u * 73856093) ^ (v * 19349663));
        const groundPick = arr => arr[Math.floor(groundRandom() * arr.length)];
        const gcolor = underwater
          ? "#779286"
          : h > 14
            ? "#d5d8c6"
            : h > 9
              ? groundPick(palettes.rock)
              : h < WORLD.seaLevel + 1
                ? "#c4b895"
                : groundPick(palettes.ground);
        put(v, (h - 32) / 2, u, 2, h + 32, 2, gcolor);
        if (underwater) {
          root = [v, WORLD.seaLevel, u, 2];
          put(v, WORLD.seaLevel, u, 2, 0.2, 2, h < -5 ? "#538f99" : "#79b2b2");
          if (patch.form !== 9) continue;
        }
        if (distant) continue;
        if (patch.form >= 2 && (x === 2 || x === 6) && (z === 2 || z === 6))
          buildPrimitive(
            patch.form,
            put,
            v,
            Math.max(h, WORLD.seaLevel),
            u,
            patch,
            rng,
            (value) => (root = value),
          );
        if (underwater || h > 14) continue;
        // Sparse meadow tufts and stones create a readable voxel surface.
        if (rng() < genes[0] * 0.5) {
          put(
            v + (rng() - 0.5),
            h + 0.13,
            u + (rng() - 0.5),
            0.4 + rng() * 0.6,
            0.25,
            0.4,
            pick(palettes.ground),
          );
        }
        root = [v, h, u, 1];
        const feature = rng();
        if (feature < (patch.form === 0 ? 0.16 : 0.015) * genes[1]) {
          const th = 2.4 + patch.height * 4 + rng() * 2;
          put(v, h + th / 2, u, 0.65, th, 0.65, pick(palettes.trunk));
          const leafColor =
            palettes.leaves[
              Math.floor(
                wrap(patch.hue * 0.6 + rng() * 0.4, 1) * palettes.leaves.length,
              )
            ];
          const radius = 1.4 + rng() * 0.8;
          for (let lx = -2; lx <= 2; lx++)
            for (let lz = -2; lz <= 2; lz++)
              for (let ly = 0; ly < 3; ly++) {
                if (
                  lx * lx + lz * lz + (ly - 1) * (ly - 1) * 2 > 5.5 ||
                  rng() < 0.13
                )
                  continue;
                put(
                  v + lx * radius * 0.65,
                  h + th + ly * 1.02,
                  u + lz * radius * 0.65,
                  radius * 0.645,
                  1.01,
                  radius * 0.645,
                  rng() > 0.25 ? leafColor : pick(palettes.leaves),
                );
              }
          put(
            v + 0.8,
            h + th * 0.66,
            u,
            0.95,
            0.35,
            0.45,
            pick(palettes.trunk),
          );
        } else if (feature < (patch.form === 1 ? 0.18 : 0.03) * genes[2]) {
          const height = 1.5 + patch.height * 2 + rng() * 2;
          const c = pick(palettes.coral);
          put(v, h + height / 2, u, 0.42, height, 0.42, c);
          for (let j = 0; j < 7; j++) {
            const angle = rng() * TAU,
              reach = 0.5 + rng() * 1.5,
              bh = height * 0.4 + rng() * height * 0.65;
            put(
              v + Math.cos(angle) * reach * 0.5,
              h + bh,
              u + Math.sin(angle) * reach * 0.5,
              reach * 0.8,
              0.35,
              0.45,
              c,
            );
            put(
              v + Math.cos(angle) * reach,
              h + bh + 0.5,
              u + Math.sin(angle) * reach,
              0.6,
              1 + rng(),
              0.6,
              pick(palettes.coral),
            );
          }
        } else if (feature > 0.975 && rng() < genes[3]) {
          const rh = 0.6 + rng() * 2.2;
          put(v, h + rh / 2, u, 1.2, rh, 1.1, pick(palettes.rock));
          put(v + 0.4, h + rh * 0.55, u + 0.2, 0.7, rh * 0.85, 0.7, "#dbba91");
        } else if (feature > 0.83 && rng() < genes[0] * 0.6) {
          put(v, h + 0.23, u, 0.15, 0.46, 0.15, "#6b845b");
          put(
            v,
            h + 0.49,
            u,
            0.45,
            0.18,
            0.45,
            rng() > 0.5 ? "#e4c88d" : "#d3b9c9",
          );
        }
      }
    this.transitions.retire([...prior.values()], this.wallTime);
    if ((incoming || prior.size) && this.wallTime > 0)
      this.events.push({
        type: "rearrange",
        incoming: incoming > prior.size,
        u: patch.u * 16 + 8,
        v: patch.v * 16 + 8,
        y: this.height(patch.u * 16 + 8, patch.v * 16 + 8),
      });
    this.collisions.remove(mesh);
    this.collisions.replace(mesh, boxes);
    lives.needsUpdate = true;
    mesh.userData.boxes = boxes;
    roots.needsUpdate = true;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.userData.distant = distant;
    mesh.userData.version = patch.version;
    mesh.userData.u = patch.u;
    mesh.userData.v = patch.v;
    if (!old) this.scene.add(mesh);
    return mesh;
  }
  updateChunks(force = false) {
    const cu = Math.floor(this.u / 16),
      cv = Math.floor(this.centerV / 16),
      token = `${cu},${cv},${Math.round(this.heading * 10)}`;
    if (token === this.chunkToken && !force && !this.dirty.size) return;
    this.chunkToken = token;
    const wanted = new Set(),
      jobs = [];
    for (let a = -12; a <= 12; a++)
      for (let b = -12; b <= 12; b++) {
        const u = (cu + a) * 16 + 8,
          v = (cv + b) * 16 + 8,
          rotated = twist(
            delta(u, this.u, WORLD.length),
            delta(v, this.v, WORLD.width),
            this.heading,
          );
        if (rotated.u < -42 || rotated.u > 190 || Math.abs(rotated.v) > 96)
          continue;
        const key = this.ecosystem.key(cu + a, cv + b);
        if (wanted.has(key)) continue;
        wanted.add(key);
        const distant =
          Math.hypot(
            delta(u, this.u, WORLD.length),
            delta(v, this.v, WORLD.width),
          ) > 145;
        if (
          !this.chunks.has(key) ||
          this.dirty.has(key) ||
          this.chunks.get(key).userData.distant !== distant
        )
          jobs.push([key, cu + a, cv + b]);
      }
    const pool = [];
    for (const [key, mesh] of this.chunks)
      if (!wanted.has(key)) {
        pool.push(mesh);
        this.chunks.delete(key);
      }
    for (const [key, a, b] of jobs)
      this.chunks.set(
        key,
        this.makeChunk(a, b, this.chunks.get(key) || pool.pop()),
      );
    for (const mesh of pool) {
      this.transitions.retire(mesh.userData.boxes || [], this.wallTime);
      this.scene.remove(mesh);
      this.collisions.remove(mesh);
      mesh.geometry.dispose();
      mesh.dispose();
    }
    this.dirty.clear();
  }
  markDirty(keys) {
    for (const key of keys) this.dirty.add(key);
  }
  update(dt, steer, cameraDt = dt, vertical = 0) {
    this.wallTime += cameraDt;
    this.collisions.wallTime = this.wallTime;
    this.uniforms.uWallTime.value = this.wallTime;
    this.transitions.update(this.wallTime);
    const previousAltitude = this.altitude;
    if (dt > 0) {
      this.events.push(
        ...this.physics.step(
          dt,
          steer,
          this.collisions,
          (u, v) => this.height(u, v),
          this.simTime,
          vertical,
          cameraDt,
          (event) => {
            if (event.escape) this.arcade.explode(event.impact, 6.5);
          },
        ),
      );
      this.simTime += dt;
      this.u = this.physics.u;
      this.v = this.physics.v;
      this.altitude = this.physics.altitude;
      this.heading = this.physics.heading;
      this.centerV = wrap(this.v - this.physics.cameraSide, WORLD.width);
      this.exploration.record(this.u, this.v);
    }
    this.uniforms.uCenter.value = this.u;
    this.uniforms.vCenter.value = this.centerV;
    this.uniforms.uTime.value = this.simTime;
    this.uniforms.uFlyV.value = this.v;
    this.uniforms.uHeading.value = this.heading;
    this.updateChunks();
    const pos = this.project(this.u, this.v, this.altitude);
    this.observer.position.copy(pos);
    this.fly.position.set(
      Math.sin(this.simTime * 1.7) * 0.1,
      Math.sin(this.simTime * 3.3) * 0.16,
      Math.sin(this.simTime * 2) * 0.08,
    );
    this.fly.rotation.y +=
      (-steer * 0.5 - this.fly.rotation.y) * (1 - Math.exp(-dt * 5));
    this.fly.rotation.z +=
      (-steer * 0.32 - this.fly.rotation.z) * (1 - Math.exp(-dt * 4));
    const climb = dt ? (this.altitude - previousAltitude) / dt : 0;
    this.fly.rotation.x =
      clamp(-climb * 0.035, -0.22, 0.22) + Math.sin(this.simTime * 2.3) * 0.045;
    this.abdomen.rotation.x = Math.sin(this.simTime * 3.3 - 0.4) * 0.07;
    this.wingPhase = this.simTime * TAU * 11;
    this.wings.forEach(
      (wing, i) =>
        (wing.rotation.z =
          (i ? 1 : -1) * (0.15 + Math.sin(this.simTime * TAU * 11) * 0.78)),
    );
    this.legs.forEach(
      (leg, i) =>
        (leg.rotation.x = 0.15 + Math.sin(this.simTime * 3 + i) * 0.12),
    );
    this.cameraAltitude +=
      (this.altitude - this.cameraAltitude) * (1 - Math.exp(-cameraDt / 1.5));
    const cameraHeight = this.cameraAltitude;
    const cam =
      this.cameraMode === 1
        ? new THREE.Vector3(0, cameraHeight + 30, 38)
        : this.cameraMode === 2
          ? pos.clone().add(new THREE.Vector3(0, 0.4, -1.3))
          : new THREE.Vector3(-0.5, cameraHeight + 9, 24);
    const target =
      this.cameraMode === 2
        ? new THREE.Vector3(pos.x, this.altitude, -50)
        : new THREE.Vector3(0, cameraHeight - 4, -20);
    this.camera.position.lerp(
      cam,
      cameraDt === 0 ? 1 : 1 - Math.exp(-cameraDt * 2.5),
    );
    this.camera.lookAt(target);
    this.observer.visible = this.cameraMode !== 2;
    this.eyeCamera.position.copy(pos).add(new THREE.Vector3(0, 0.3, -1.4));
    this.eyeCamera.lookAt(
      pos.x + steer * 2,
      Math.max(WORLD.seaLevel, this.altitude - 18),
      -45,
    );
    this.fauna.update(
      dt,
      this.u,
      this.v,
      this.centerV,
      this.ecosystem,
      this.heading,
    );
    this.arcade.update(dt, cameraDt);
    if (this.dirty.size) this.updateChunks();
    this.transitions.update(this.wallTime);
    this.particles.rotation.y = Math.sin(this.simTime * 0.025) * 0.1;
    this.particles.position.y = Math.sin(this.simTime * 0.25) * 0.3;
  }
  render() {
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }
  sense() {
    const visible = this.observer.visible;
    this.observer.visible = false;
    this.renderer.setRenderTarget(this.eyeTarget);
    this.renderer.render(this.scene, this.eyeCamera);
    this.renderer.readRenderTargetPixels(
      this.eyeTarget,
      0,
      0,
      30,
      30,
      this.pixels,
    );
    this.renderer.setRenderTarget(null);
    this.observer.visible = visible;
    return this.pixels;
  }
  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(this.pixelRatio);
  }
  setQuality(ratio) {
    this.pixelRatio = Math.max(0.6, Math.min(devicePixelRatio, 1.5, ratio));
    this.renderer.setPixelRatio(this.pixelRatio);
  }
  get voxels() {
    let count = 0;
    for (const mesh of this.chunks.values()) count += mesh.count;
    return count;
  }
}
