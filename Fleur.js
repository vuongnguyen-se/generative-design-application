// ----------------------------
// Config
// ----------------------------
const params = {
  gradientType: 'linear',
  color1: '#E91D2E',
  color2: '#FE6A00',
  color3: '#F4A800',
  gradientScale: 1.0,
  angle: 45,

  // base motion
  speed: 0.5,
  seed: 1234,

  // render resolution
  cellSize: 10,

  // flow warp (directed)
  flowStrength: 1.2,
  flowScale: 2.2,
  flowTurbulence: 0.9,

  // scanlines / ribs
  stripeCount: 90,
  stripeWarp: 0.8,
  stripeDepth: 0.55,
  stripeOffset: 10,
  stripeSpeed: 1.2,

  // look / grading
  contrast: 1.35,
  vignette: 0.35
};

let canvasHolder = null;

// p5.Color cache
let cached = {
  c1: null, c2: null, c3: null,
  lastColor1: null, lastColor2: null, lastColor3: null
};

// ----------------------------
// p5 lifecycle
// ----------------------------
function setup() {
  canvasHolder = document.getElementById('canvas-holder');

  const { w, h } = getStageSize(canvasHolder);
  const canvas = createCanvas(w, h);
  canvas.parent(canvasHolder);

  pixelDensity(window.devicePixelRatio || 1);
  noStroke();

  initUI_p5();
  refreshColorCache();
}

function draw() {
  randomSeed(params.seed);
  noiseSeed(params.seed);
  refreshColorCache();

  background(0);

  const t = frameCount * 0.01 * params.speed;
  const cs = Math.max(2, params.cellSize);

  for (let y = 0; y < height; y += cs) {
    const v = y / height;

    for (let x = 0; x < width; x += cs) {
      const u = x / width;

      // Flow field
      const n1 = noise(u * params.flowScale, v * params.flowScale, t * params.flowTurbulence);
      const ang = n1 * TWO_PI * 2.0;

      const fx = cos(ang) * params.flowStrength;
      const fy = sin(ang) * params.flowStrength;

      // Stripes (vertical ribs) + warp
      const stripePhase =
        (u * params.stripeCount) +
        (params.stripeWarp * (fx * 0.35 + fy * 0.15)) +
        (t * params.stripeSpeed);

      const s = sin(stripePhase * TWO_PI); // -1..1
      const stripeMask = (1 - params.stripeDepth) + params.stripeDepth * (0.5 + 0.5 * s);
      const stripeShift = s * params.stripeOffset;

      // Sample position displaced by flow + stripes
      const px = x + fx * 60 + stripeShift;
      const py = y + fy * 60;

      // Base gradient
      let col = sampleGradient(px / width, py / height);

      // Stripe shading
      col = lerpColor(color(0), col, stripeMask);

      // Vignette
      if (params.vignette > 0) {
        const dx = u - 0.5;
        const dy = v - 0.5;
        const r = sqrt(dx * dx + dy * dy);
        const vig = constrain(1 - params.vignette * pow(r / 0.707, 1.8), 0, 1);
        col = lerpColor(color(0), col, vig);
      }

      fill(col);
      rect(x, y, cs + 1, cs + 1);
    }
  }
}

function windowResized() {
  if (!canvasHolder) return;
  const { w, h } = getStageSize(canvasHolder);
  resizeCanvas(w, h);
}

// ----------------------------
// Helpers
// ----------------------------
function getStageSize(holderEl) {
  if (!holderEl) return { w: 800, h: 800 };
  return {
    w: Math.max(1, holderEl.clientWidth),
    h: Math.max(1, holderEl.clientHeight)
  };
}

function refreshColorCache() {
  if (params.color1 !== cached.lastColor1) {
    cached.c1 = color(params.color1);
    cached.lastColor1 = params.color1;
  }
  if (params.color2 !== cached.lastColor2) {
    cached.c2 = color(params.color2);
    cached.lastColor2 = params.color2;
  }
  if (params.color3 !== cached.lastColor3) {
    cached.c3 = color(params.color3);
    cached.lastColor3 = params.color3;
  }
}

function sampleGradient(u, v) {
  u = constrain(u, 0, 1);
  v = constrain(v, 0, 1);

  let g;
  if (params.gradientType === 'linear') {
    const a = radians(params.angle);
    g = (u - 0.5) * cos(a) + (v - 0.5) * sin(a) + 0.5;
  } else {
    g = dist(u, v, 0.5, 0.5) * params.gradientScale;
  }

  g = constrain(g, 0, 1);

  // contrast
  const c = Math.max(0.5, params.contrast);
  g = constrain((g - 0.5) * c + 0.5, 0, 1);

  if (g < 0.5) return lerpColor(cached.c1, cached.c2, g * 2);
  return lerpColor(cached.c2, cached.c3, (g - 0.5) * 2);
}

// ----------------------------
// UI (p5 DOM)
// ----------------------------
function initUI_p5() {
  const uiRoot = document.getElementById('ui');

  const panel = createDiv();
  panel.parent(uiRoot);
  panel.style('width', '100%');
  panel.style('box-sizing', 'border-box');
  panel.style('padding', '10px');

  addSelect(panel, 'Gradient Type', ['linear', 'radial'], params.gradientType, v => (params.gradientType = v));
  addSlider(panel, 'Angle', 0, 360, params.angle, 1, v => (params.angle = v));
  addSlider(panel, 'Gradient Scale', 0.2, 3, params.gradientScale, 0.01, v => (params.gradientScale = v));

  addColor(panel, 'Color 1', params.color1, v => (params.color1 = v));
  addColor(panel, 'Color 2', params.color2, v => (params.color2 = v));
  addColor(panel, 'Color 3', params.color3, v => (params.color3 = v));

  addSlider(panel, 'Speed', 0, 2, params.speed, 0.01, v => (params.speed = v));
  addSlider(panel, 'Cell Size', 2, 20, params.cellSize, 1, v => (params.cellSize = v));
  addNumber(panel, 'Seed', params.seed, v => (params.seed = v));

  addSlider(panel, 'Flow Strength', 0, 3, params.flowStrength, 0.01, v => (params.flowStrength = v));
  addSlider(panel, 'Flow Scale', 0.5, 6, params.flowScale, 0.01, v => (params.flowScale = v));
  addSlider(panel, 'Flow Turbulence', 0.1, 3, params.flowTurbulence, 0.01, v => (params.flowTurbulence = v));

  addSlider(panel, 'Stripe Count', 10, 200, params.stripeCount, 1, v => (params.stripeCount = v));
  addSlider(panel, 'Stripe Warp', 0, 2, params.stripeWarp, 0.01, v => (params.stripeWarp = v));
  addSlider(panel, 'Stripe Depth', 0, 1, params.stripeDepth, 0.01, v => (params.stripeDepth = v));
  addSlider(panel, 'Stripe Offset', 0, 30, params.stripeOffset, 0.1, v => (params.stripeOffset = v));
  addSlider(panel, 'Stripe Speed', 0, 3, params.stripeSpeed, 0.01, v => (params.stripeSpeed = v));

  addSlider(panel, 'Contrast', 0.8, 2.2, params.contrast, 0.01, v => (params.contrast = v));
  addSlider(panel, 'Vignette', 0, 0.8, params.vignette, 0.01, v => (params.vignette = v));

  const btn = createButton('Save PNG');
  btn.parent(panel);
  btn.mousePressed(() => saveCanvas('gradient', 'png'));
}

// ----------------------------
// UI primitives
// ----------------------------
function addLabel(parent, text) {
  const label = createDiv(text);
  label.parent(parent);
  label.style('margin', '6px 0 2px');
  label.style('font-size', '13px');
  return label;
}

function addSelect(parent, labelText, options, initial, onChange) {
  addLabel(parent, labelText);
  const sel = createSelect();
  sel.parent(parent);
  options.forEach(o => sel.option(o));
  sel.value(initial);
  sel.changed(() => onChange(sel.value()));
  return sel;
}

function addSlider(parent, labelText, minV, maxV, initial, step, onInput) {
  addLabel(parent, labelText);
  const s = createSlider(minV, maxV, initial, step);
  s.parent(parent);
  // Không set width ở JS nữa để CSS điều khiển
  s.input(() => onInput(s.value()));
  return s;
}

function addColor(parent, labelText, initial, onInput) {
  addLabel(parent, labelText);
  const cp = createColorPicker(initial);
  cp.parent(parent);
  cp.input(() => onInput(cp.value()));
  return cp;
}

function addNumber(parent, labelText, initial, onInput) {
  addLabel(parent, labelText);
  const inp = createInput(String(initial), 'number');
  inp.parent(parent);
  // width sẽ theo CSS
  inp.input(() => {
    const v = Number(inp.value());
    onInput(Number.isFinite(v) ? v : 0);
  });
  return inp;
}
