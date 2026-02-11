const params = {
  // Output
  format: '1:1',        // '16:9' | '1:1' | '9:16'
  longSide: 720,        // base canvas size (locked)

  // Columns
  columnCount: 7,
  gutter: 2,            // gap/seam between columns (px)
  seamAlpha: 0.10,      // 0..1 subtle vertical seams

  // Colors (top -> bottom)
  color1: '#552080',
  color2: '#006DD5',
  color3: '#FF1F2D',
  color4: '#FF3300',
  color5: '#FFFFFF',

  // Motion
  amplitude: 55,        // px up/down
  speed: 0.8,           // animation speed
  phaseStep: 0.35,      // delay between columns
  centerFirst: true,    // true: middle leads, false: outside leads
};

let canvasHolder = null;
let outW = 720, outH = 720;

let recorder = null;
let recordedChunks = [];
let recordTimeout = null;
let isRecording = false;
let recordBtn = null;

// Record configs
const RECORD_SECONDS = 10;
const RECORD_FPS = 60;
const RECORD_BITRATE = 8_000_000; // 8 Mbps (able to increase/ decrease)

let useFixedTime = false;
let fixedFrame = 0;

const GIF_FPS = 20;     // 15–24 reasonable
const LOOP_COUNT = 1;   // 1 cycle (can be 2,3)

// Function for setting up 
function setup() {
  canvasHolder = document.getElementById('canvas-holder');
  computeOutputSize();

  const c = createCanvas(outW, outH);
  c.parent(canvasHolder);

  pixelDensity(window.devicePixelRatio || 1);
  noStroke();

  initUI_p5();
}

function draw() {
  background(0);

  // Draw columns
  const n = Math.max(1, Math.floor(params.columnCount));
  const totalGutters = (n - 1) * params.gutter;
  const colW = (width - totalGutters) / n;

//   const t = millis() * 0.001 * params.speed;
  const t = useFixedTime
  ? (fixedFrame / GIF_FPS) * params.speed
  : millis() * 0.001 * params.speed;
  const center = (n - 1) / 2;

  for (let i = 0; i < n; i++) {
    const x = i * (colW + params.gutter);

    // phase ordering: center leads OR edges lead
    const distFromCenter = Math.abs(i - center);
    const phase = (params.centerFirst ? distFromCenter : (center - distFromCenter)) * params.phaseStep;

    // Vertical offset (sin wave) — smooth up/down
    const yOff = Math.sin(t + phase) * params.amplitude;

    drawGradientColumn(x, yOff, colW, height);
  }

  // Seams (subtle vertical lines like screenshot)
  if (params.seamAlpha > 0 && params.gutter >= 0) {
    const a = Math.max(0, Math.min(1, params.seamAlpha));
    fill(0, 0, 0, 255 * a);
    for (let i = 1; i < n; i++) {
      const sx = i * (colW + params.gutter) - params.gutter * 0.5;
      rect(sx, 0, 1, height);
    }
  }
}

function windowResized() {
  // Intentionally NOT responsive to keep output reproducible.
  // You can scale with CSS instead (width:100%; height:auto).
}

// ----------------------------
// Rendering helpers
// ----------------------------
function drawGradientColumn(x, yOffset, w, h) {
  const ctx = drawingContext;

  // Multi-stop vertical gradient (stacked bands)
  const g = ctx.createLinearGradient(0, yOffset, 0, h + yOffset);

  // top blue -> deep blue band -> magenta -> yellow -> near-white
  g.addColorStop(0.00, params.color1);
  g.addColorStop(0.22, params.color2);
  g.addColorStop(0.58, params.color3);
  g.addColorStop(0.82, params.color4);
  g.addColorStop(1.00, params.color5);

  ctx.fillStyle = g;
  ctx.fillRect(x, 0, w, h);
}

function addStepper(parent, labelText, minV, maxV, initial, onChange) {
  addLabel(parent, labelText);

  const wrap = createDiv();
  wrap.parent(parent);
  wrap.style('display', 'flex');
  wrap.style('align-items', 'center');
  wrap.style('gap', '8px');

  const btnMinus = createButton('–');
  const btnPlus  = createButton('+');
  const valueTxt = createSpan(initial);

  btnMinus.parent(wrap);
  valueTxt.parent(wrap);
  btnPlus.parent(wrap);

  let value = initial;

  function update(delta) {
    value = Math.max(minV, Math.min(maxV, value + delta));
    valueTxt.html(value);
    onChange(value);
  }

  btnMinus.mousePressed(() => update(-1));
  btnPlus.mousePressed(() => update(+1));

  return { btnMinus, btnPlus, valueTxt };
}


// ----------------------------
// Output sizing
// ----------------------------
function computeOutputSize() {
  const L = params.longSide;
  if (params.format === '16:9') {
    outW = L;
    outH = Math.round(L * 9 / 16);
  } else if (params.format === '9:16') {
    outH = L;
    outW = Math.round(L * 9 / 16);
  } else {
    outW = L;
    outH = L;
  }
}

function addNumber(parent, labelText, minV, maxV, initial, step, onInput) {
  addLabel(parent, labelText);
  const inp = createInput(String(initial), 'number');
  inp.parent(parent);

  inp.attribute('min', minV);
  inp.attribute('max', maxV);
  inp.attribute('step', step);

  inp.input(() => {
    const v = Number(inp.value());
    if (Number.isFinite(v)) onInput(v);
  });

  return inp;
}


// ----------------------------
// UI (minimal, relevant sliders only)
// ----------------------------
function initUI_p5() {
  const uiRoot = document.getElementById('ui');
  const panel = createDiv();
  panel.parent(uiRoot);
  panel.style('width', '100%');
  panel.style('box-sizing', 'border-box');
  panel.style('padding', '10px');

  addSelect(panel, 'Format', ['16:9', '1:1', '9:16'], params.format, v => {
    params.format = v;
    computeOutputSize();
    resizeCanvas(outW, outH);
  });

  addSlider(panel, 'Long Side (px)', 480, 1600, params.longSide, 10, v => {
    params.longSide = v;
    computeOutputSize();
    resizeCanvas(outW, outH);
  });

  // addSlider(panel, 'Columns', 3, 12, params.columnCount, 1, v => (params.columnCount = v));
  addStepper(
    panel,
    'Columns',
    5,   // min
    25,  // max
    params.columnCount,
    v => (params.columnCount = v)
  );


//   addSlider(panel, 'Gutter', 0, 12, params.gutter, 1, v => (params.gutter = v));
  // addSlider(panel, 'Seam Alpha', 0, 0.35, params.seamAlpha, 0.01, v => (params.seamAlpha = v));

  addColor(panel, 'Color 1 (Top)', params.color1, v => (params.color1 = v));
  addColor(panel, 'Color 2', params.color2, v => (params.color2 = v));
  addColor(panel, 'Color 3', params.color3, v => (params.color3 = v));
  addColor(panel, 'Color 4', params.color4, v => (params.color4 = v));
  addColor(panel, 'Color 5 (Bottom)', params.color5, v => (params.color5 = v));

  addSlider(panel, 'Amplitude', 0, 140, params.amplitude, 1, v => (params.amplitude = v));
  addSlider(panel, 'Speed', 0, 3, params.speed, 0.01, v => (params.speed = v));
  addSlider(panel, 'Phase Step', 0.0, 1.2, params.phaseStep, 0.01, v => (params.phaseStep = v));
  addSelect(panel, 'Wave Order', ['center-first', 'outside-first'], params.centerFirst ? 'center-first' : 'outside-first', v => {
    params.centerFirst = (v === 'center-first');
  });

  const btn = createButton('Save PNG');
  btn.parent(panel);
  btn.mousePressed(() => saveCanvas('columns-gradient', 'png'));

  recordBtn = createButton(`Record ${RECORD_SECONDS}s Video`);
  recordBtn.parent(panel);
  recordBtn.mousePressed(() => startRecord10s());
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
  s.input(() => onInput(Number(s.value())));
  return s;
}
function addColor(parent, labelText, initial, onInput) {
  addLabel(parent, labelText);
  const cp = createColorPicker(initial);
  cp.parent(parent);
  cp.input(() => onInput(cp.value()));
  return cp;
}

function pickMimeType() {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const t of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

function startRecord10s() {
  console.log('Start record clicked');

  if (!window.isSecureContext) {
    alert('Record cần chạy trên HTTPS hoặc http://localhost (không chạy file://).');
    console.warn('Not secure context:', location.href);
    return;
  }

  if (!window.MediaRecorder) {
    alert('Trình duyệt không hỗ trợ MediaRecorder. Thử Chrome/Edge mới nhất.');
    return;
  }

  if (isRecording) return;

  const canvasEl = document.querySelector('#canvas-holder canvas');
  if (!canvasEl) {
    alert('Không tìm thấy canvas trong #canvas-holder');
    return;
  }

  // giảm fps cho ổn định
  const stream = canvasEl.captureStream(30);
  recordedChunks = [];

  const mimeType = pickMimeType();
  console.log('mimeType:', mimeType);

  if (!mimeType) {
    alert('Không tìm được mimeType WebM phù hợp cho MediaRecorder.');
    return;
  }

  try {
    recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: RECORD_BITRATE,
    });
  } catch (e) {
    console.error('MediaRecorder init error:', e);
    alert('Không khởi tạo được MediaRecorder. Xem console để biết lỗi.');
    return;
  }

  recorder.onstart = () => console.log('Recorder started', recorder.state);

  recorder.ondataavailable = (e) => {
    console.log('dataavailable size=', e.data?.size);
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  };

  recorder.onerror = (e) => {
    console.error('Recorder error:', e);
    alert('Recorder gặp lỗi. Xem console.');
  };

  recorder.onstop = () => {
    console.log('Recorder stopped. chunks=', recordedChunks.length);

    isRecording = false;
    if (recordBtn) recordBtn.removeAttribute('disabled');

    if (!recordedChunks.length) {
      alert('Không có dữ liệu video (chunks rỗng). Thử chạy trên localhost/https và Chrome/Edge.');
      return;
    }

    const blob = new Blob(recordedChunks, { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `columns-gradient-${RECORD_SECONDS}s.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  isRecording = true;
  if (recordBtn) recordBtn.setAttribute('disabled', 'true');

  // timeslice: cứ 1s xuất 1 chunk => chắc chắn có data
  recorder.start(1000);

  recordTimeout = setTimeout(() => {
    if (recorder && recorder.state === 'recording') recorder.stop();
  }, RECORD_SECONDS * 1000);
}
