/* SIMA Map Studio — main application. */
(function () {
  'use strict';
  const W = 2000, H = 1650, D2R = Math.PI / 180;
  const { el, text, FONT } = Templates;
  const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
  const SETTINGS_KEY = 'sima.settings.v1', PROJECT_KEY = 'sima.project.v1', CHAT_KEY = 'sima.chat.v1';
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clone = o => JSON.parse(JSON.stringify(o));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const CITY_PICK = new Set(['Nelson', 'Blenheim', 'Kaikōura', 'Greymouth', 'Hokitika', 'Westport', 'Christchurch', 'Rangiora', 'Rolleston', 'Ashburton', 'Timaru', 'Ōamaru', 'Dunedin', 'Queenstown', 'Wānaka', 'Alexandra', 'Gore', 'Invercargill', 'Te Anau', 'Lake Tekapo', 'Twizel', 'Franz Josef', 'Haast', 'Milford Sound', 'Hanmer Springs', 'Cromwell', 'Balclutha', 'Wellington', 'Palmerston North', 'New Plymouth', 'Picton', 'Motueka', 'Bluff', 'Winton', 'Glenorchy', 'Methven', 'Geraldine', 'Masterton', 'Whanganui', 'Napier', 'Hastings', 'Hamilton', 'Auckland', 'Tauranga', 'Rotorua', 'Gisborne', 'Whangarei', 'Taupo', 'Levin']);

  // =====================================================================
  // Settings
  // =====================================================================
  const defaultSettings = () => ({ model: AI.DEFAULT_MODEL, brand: { site: 'sima.co.nz', logoData: null, logoRatio: null }, exportScale: 1, showHints: true, autoLabels: true, customTypes: [] });
  let settings = (() => { try { return Object.assign(defaultSettings(), JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (e) { return defaultSettings(); } })();
  function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { toast('Could not save settings (storage full?)', 'err'); } }
  const allTypes = () => Templates.MAP_TYPES.concat(settings.customTypes || []);
  const typeById = id => allTypes().find(t => t.id === id) || Templates.MAP_TYPES[0];

  // =====================================================================
  // Project state
  // =====================================================================
  function todayStr() { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; }
  function defaultMeta(typeId) {
    const d = new Date(), t = typeById(typeId);
    const m = { issued: '', valid: '', title: '' };
    if (t.titleMode === 'climate') { m.month = MONTHS[d.getMonth()]; m.year = String(d.getFullYear()); m.variable = 'Rainfall'; }
    if (t.titleMode === 'bar') { m.date = todayStr(); }
    if (t.titleMode === 'heading') { m.title = t.name; }
    return m;
  }
  function newProject(typeId) {
    const t = typeById(typeId);
    return { version: 1, mapType: t.id, areas: [], elements: [], meta: defaultMeta(t.id), frame: { preset: 'south', zoom: 1, dx: 0, dy: 0 }, layers: { cities: t.base === 'terrain', lakes: true, borders: true, graticule: true } };
  }
  let state = (() => { try { const p = JSON.parse(localStorage.getItem(PROJECT_KEY)); if (p && p.areas) return normalise(p); } catch (e) { /* ignore */ } return newProject('outlook'); })();
  function normalise(p) {
    p.elements = p.elements || []; p.areas = p.areas || []; p.meta = p.meta || {}; p.frame = Object.assign({ preset: 'south', zoom: 1, dx: 0, dy: 0 }, p.frame || {});
    p.layers = Object.assign({ cities: false, lakes: true, borders: true, graticule: true }, p.layers || {});
    if (!allTypes().some(t => t.id === p.mapType)) p.mapType = 'outlook';
    return p;
  }
  let saveTimer = null;
  function autosave() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem(PROJECT_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }, 300); }

  // Undo / redo ---------------------------------------------------------
  const undoStack = [], redoStack = [];
  function snapshot() { undoStack.push(JSON.stringify({ areas: state.areas, elements: state.elements, meta: state.meta, frame: state.frame, layers: state.layers })); if (undoStack.length > 80) undoStack.shift(); redoStack.length = 0; updateUndoButtons(); }
  function restore(json) { const s = JSON.parse(json); Object.assign(state, s); selection = null; closePicker(); render(); buildInspector(); buildMetaForm(); syncFrameControls(); }
  function undo() { if (!undoStack.length) return; redoStack.push(JSON.stringify({ areas: state.areas, elements: state.elements, meta: state.meta, frame: state.frame, layers: state.layers })); restore(undoStack.pop()); updateUndoButtons(); toast('Undo'); }
  function redo() { if (!redoStack.length) return; undoStack.push(JSON.stringify({ areas: state.areas, elements: state.elements, meta: state.meta, frame: state.frame, layers: state.layers })); restore(redoStack.pop()); updateUndoButtons(); toast('Redo'); }
  function updateUndoButtons() { $('#btnUndo').disabled = !undoStack.length; $('#btnRedo').disabled = !redoStack.length; }

  // =====================================================================
  // Projection / framing
  // =====================================================================
  const PRESETS = {
    south: { bbox: [166.3, -47.4, 174.6, -40.4], rect: { x: 470, y: 90, w: 1260, h: 1290 } },
    southNorth: { bbox: [166.3, -47.4, 176.4, -38.8], rect: { x: 300, y: 80, w: 1450, h: 1420 } },
    lowerSouth: { bbox: [166.3, -47.4, 171.6, -43.0], rect: { x: 300, y: 160, w: 1400, h: 1300 } },
    upperSouth: { bbox: [169.6, -44.6, 174.6, -40.4], rect: { x: 300, y: 160, w: 1400, h: 1300 } },
    nz: { bbox: [166.3, -47.4, 178.6, -34.3], rect: { x: 260, y: 70, w: 1480, h: 1500 } },
  };
  let frame = null;
  function computeFrame() {
    const p = PRESETS[state.frame.preset] || PRESETS.south;
    const f = Geo.fitFrame(p.bbox, p.rect, W, H);
    f.scale *= state.frame.zoom || 1;
    // keep the rect centre fixed while zooming
    const rc = { x: p.rect.x + p.rect.w / 2, y: p.rect.y + p.rect.h / 2 };
    const base = Geo.fitFrame(p.bbox, p.rect, W, H);
    const [bx, by] = Geo.project(base.cx, base.cy, f, W, H); // where the old centre lands
    f.dx = (W / 2 - bx) + (rc.x - W / 2) * 0 + (state.frame.dx || 0);
    f.dy = (H / 2 - by) + (state.frame.dy || 0);
    // the fit frame places bbox centre at rect centre: recompute offset so the same lon/lat stays at rect centre
    const [cx0, cy0] = Geo.project((p.bbox[0] + p.bbox[2]) / 2, midLat(p.bbox[1], p.bbox[3]), base, W, H);
    const [cx1, cy1] = Geo.project((p.bbox[0] + p.bbox[2]) / 2, midLat(p.bbox[1], p.bbox[3]), f, W, H);
    f.dx = (cx0 - cx1) + (state.frame.dx || 0);
    f.dy = (cy0 - cy1) + (state.frame.dy || 0);
    frame = f;
    return f;
  }
  function midLat(a, b) { const m = (Geo.mercY(a) + Geo.mercY(b)) / 2; return (2 * Math.atan(Math.exp(m)) - Math.PI / 2) / D2R; }
  function toXY(lon, lat) { const [x, y] = Geo.project(lon, lat, frame, W, H); return { x: x + frame.dx, y: y + frame.dy }; }
  function toLL(x, y) {
    x -= frame.dx; y -= frame.dy;
    const lon = frame.cx + (x - W / 2) / (D2R * frame.scale);
    const m = Geo.mercY(frame.cy) - (y - H / 2) / frame.scale;
    const lat = (2 * Math.atan(Math.exp(m)) - Math.PI / 2) / D2R;
    return { lon, lat };
  }
  const areaPts = a => a.points.map(p => toXY(p.lon, p.lat));

  // =====================================================================
  // Editor viewport (zoom / pan of the canvas on screen)
  // =====================================================================
  const svg = $('#map');
  let view = { x: 0, y: 0, z: 1 }; // viewBox origin and zoom
  function applyView() { svg.setAttribute('viewBox', `${view.x} ${view.y} ${W / view.z} ${H / view.z}`); $('#zoomPct').textContent = Math.round(view.z * 100) + '%'; }
  function zoomAt(factor, cx, cy) {
    const nz = clamp(view.z * factor, 0.5, 12);
    if (cx == null) { cx = view.x + W / view.z / 2; cy = view.y + H / view.z / 2; }
    view.x = cx - (cx - view.x) * (view.z / nz); view.y = cy - (cy - view.y) * (view.z / nz); view.z = nz;
    constrainView(); applyView(); render();
  }
  function constrainView() { const vw = W / view.z, vh = H / view.z; view.x = clamp(view.x, -vw * 0.5, W - vw * 0.5); view.y = clamp(view.y, -vh * 0.5, H - vh * 0.5); }
  function fitView() { view = { x: 0, y: 0, z: 1 }; applyView(); render(); }
  const sx = () => 1 / view.z; // screen-constant size multiplier

  function canvasPoint(ev) { const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse()); return { x: p.x, y: p.y }; }

  // =====================================================================
  // Rendering
  // =====================================================================
  let selection = null; // {kind:'area'|'element', id}
  let hoverId = null;
  let tool = 'select';
  let draft = []; // points being drawn (canvas coords)
  let cursor = null; // canvas coords of pointer
  let drag = null;
  let pendingShape = null; // {kind:'line'|'box', start:{x,y}, cur:{x,y}}
  let currentIcon = 'rain';
  const hits = new Map(); // id -> {kind, poly|bbox|seg}
  const measureCtx = document.createElement('canvas').getContext('2d');
  function measure(str, size, weight) { measureCtx.font = `${weight || 500} ${size}px Poppins, Arial, sans-serif`; return measureCtx.measureText(str).width; }

  function currentType() { return typeById(state.mapType); }
  function catOf(a, type) { return (type || currentType()).categories.find(c => c.id === a.category); }
  function computedTitle(type) {
    const m = state.meta;
    if (type.titleMode === 'climate') return m.titleOverride || `${m.month || ''} ${m.year || ''} ${m.variable || ''}`.replace(/\s+/g, ' ').trim();
    if (type.titleMode === 'bar') return m.titleOverride || `${type.titleText || type.name} ${m.date || ''}`.trim();
    return m.title || '';
  }

  function render(target, opts) {
    const out = target || svg; opts = opts || {};
    const forExport = !!opts.forExport;
    const type = currentType();
    computeFrame();
    while (out.firstChild) out.removeChild(out.firstChild);
    hits.clear();
    const defs = el('defs', null, out);
    buildDefs(defs, type);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: type.base === 'terrain' ? 'url(#ocean)' : '#ffffff' }, out);
    const base = el('g', { id: 'base' }, out);
    renderBase(base, type);
    const areas = el('g', { id: 'areas' }, out);
    const labels = el('g', { id: 'labels' }, out);
    renderAreas(areas, labels, type, forExport);
    const elems = el('g', { id: 'elements' }, out);
    renderElements(elems, forExport);
    const chrome = el('g', { id: 'chrome' }, out);
    const stateForChrome = { meta: Object.assign({}, state.meta, { title: computedTitle(type) }) };
    Templates.renderChrome(chrome, type, stateForChrome, settings, W, H);
    if (!forExport) { const edit = el('g', { id: 'edit' }, out); renderEdit(edit, type); }
    return out;
  }

  function buildDefs(defs, type) {
    const sh = el('filter', { id: 'cardShadow', x: '-10%', y: '-10%', width: '120%', height: '130%' }, defs);
    el('feDropShadow', { dx: 0, dy: 6, stdDeviation: 10, 'flood-color': '#0F2A4A', 'flood-opacity': 0.14 }, sh);
    const ls = el('filter', { id: 'landShadow', x: '-10%', y: '-10%', width: '120%', height: '120%' }, defs);
    el('feDropShadow', { dx: 0, dy: 4, stdDeviation: 8, 'flood-color': '#0B2545', 'flood-opacity': 0.45 }, ls);
    const ts = el('filter', { id: 'textHalo' }, defs);
    const m = el('feMorphology', { in: 'SourceAlpha', operator: 'dilate', radius: 3, result: 'd' }, ts);
    el('feFlood', { 'flood-color': '#ffffff', result: 'f' }, ts);
    el('feComposite', { in: 'f', in2: 'd', operator: 'in', result: 'h' }, ts);
    const mg = el('feMerge', null, ts); el('feMergeNode', { in: 'h' }, mg); el('feMergeNode', { in: 'SourceGraphic' }, mg);
    const oc = el('linearGradient', { id: 'ocean', x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': '#17406F' }, oc); el('stop', { offset: 0.55, 'stop-color': '#2A64A8' }, oc); el('stop', { offset: 1, 'stop-color': '#3B7FC4' }, oc);
    const lg = el('linearGradient', { id: 'landGrad', x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': '#7FA463' }, lg); el('stop', { offset: 0.5, 'stop-color': '#6B9254' }, lg); el('stop', { offset: 1, 'stop-color': '#8CA86B' }, lg);
    const pat = el('pattern', { id: 'hatch', width: 14, height: 14, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    el('rect', { width: 14, height: 14, fill: '#CBD5E1', 'fill-opacity': 0.5 }, pat);
    el('rect', { width: 5, height: 14, fill: '#64748B', 'fill-opacity': 0.4 }, pat);
    void m;
  }

  function renderBase(g, type) {
    const terrain = type.base === 'terrain';
    const L = state.layers;
    if (!terrain && L.graticule) {
      const gr = el('g', { stroke: '#EDF1F6', 'stroke-width': 2 }, g);
      for (let lon = 160; lon <= 182; lon += 2) { const a = toXY(lon, -30), b = toXY(lon, -52); el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y }, gr); }
      for (let lat = -52; lat <= -30; lat += 2) { const a = toXY(160, lat), b = toXY(182, lat); el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y }, gr); }
    }
    const regionPaths = NZ_GEO.regions.map(r => ({ r, d: r.rings.map(ring => Geo.ringToPath(ring, frame, W, H)).join('') }));
    const land = el('g', { transform: `translate(${frame.dx},${frame.dy})` }, g);
    if (terrain) {
      // coastline glow + shadow
      const glow = el('g', { filter: 'url(#landShadow)' }, land);
      regionPaths.forEach(p => el('path', { d: p.d, fill: '#2F5E8E', stroke: '#A9D4F5', 'stroke-width': 10, 'stroke-opacity': 0.35, 'stroke-linejoin': 'round' }, glow));
      regionPaths.forEach(p => el('path', { d: p.d, fill: 'url(#landGrad)', stroke: L.borders ? '#F8FAFC' : 'none', 'stroke-width': 2, 'stroke-opacity': 0.55, 'stroke-linejoin': 'round' }, land));
      regionPaths.forEach(p => el('path', { d: p.d, fill: 'none', stroke: '#2E4D2B', 'stroke-width': 1.5, 'stroke-opacity': 0.5 }, land));
    } else {
      regionPaths.forEach(p => el('path', { d: p.d, fill: '#E7E8EA', stroke: L.borders ? '#8E949C' : '#C9CDD3', 'stroke-width': L.borders ? 2.2 : 1.5, 'stroke-linejoin': 'round' }, land));
    }
    if (L.lakes) {
      NZ_GEO.lakes.forEach(lk => el('path', { d: Geo.ringToPath(lk.ring, frame, W, H), fill: terrain ? '#2E7CC4' : '#ffffff', stroke: terrain ? '#1C5A95' : 'none', 'stroke-width': 1.5 }, land));
    }
    if (L.cities) renderCities(g, terrain);
  }

  function renderCities(g, terrain) {
    const placed = [];
    const list = NZ_GEO.places.filter(p => CITY_PICK.has(p.name) || p.pop >= 40000).sort((a, b) => b.pop - a.pop);
    const grp = el('g', { 'font-family': FONT }, g);
    list.forEach(p => {
      const { x, y } = toXY(p.lon, p.lat);
      if (x < 40 || x > W - 40 || y < 120 || y > H - 120) return;
      const size = p.pop >= 100000 ? 30 : 26;
      const w = measure(p.name, size, 500) + 30, h = size + 8;
      const box = { x: x + 14, y: y - h / 2, w, h };
      if (placed.some(b => !(box.x > b.x + b.w || box.x + box.w < b.x || box.y > b.y + b.h || box.y + box.h < b.y))) return;
      placed.push(box);
      el('circle', { cx: x, cy: y, r: 7, fill: terrain ? '#fff' : '#334155', stroke: terrain ? '#0B2545' : '#fff', 'stroke-width': 2.5 }, grp);
      text(grp, x + 16, y + size * 0.36, p.name, { 'font-size': size, 'font-weight': 500, fill: terrain ? '#ffffff' : '#334155', stroke: terrain ? '#0B2545' : '#ffffff', 'stroke-width': 5, 'paint-order': 'stroke', 'stroke-linejoin': 'round' });
    });
  }

  // ---- Areas and labels -------------------------------------------------
  function areaStyle(a, type) {
    const c = catOf(a, type);
    if (!c) return { fill: 'url(#hatch)', opacity: 1, stroke: '#64748B', sw: 3, dash: '14 10' };
    return { fill: c.color, opacity: a.opacity != null ? a.opacity : c.opacity, stroke: c.stroke || 'none', sw: c.strokeWidth || 0, dash: null };
  }
  function labelLines(a, type) {
    if (a.labelText != null && a.labelText !== '') return a.labelText.split('\n');
    const c = catOf(a, type);
    const lines = [];
    if (type.hazards) (a.hazards || []).forEach(h => lines.push(h.detail ? `${h.key} ${h.detail}` : h.key));
    if (c) lines.push(type.hazards ? (c.suffix || c.name + ' Risk') : c.name);
    if (!lines.length) lines.push('Choose a level…');
    return lines;
  }
  function labelBox(a, type) {
    const lines = labelLines(a, type), size = a.labelSize || 42, lh = size * 1.2;
    const w = Math.max(...lines.map(l => measure(l, size, 500))), h = lines.length * lh;
    const p = a.label ? toXY(a.label.lon, a.label.lat) : null;
    return { lines, size, lh, w, h, cx: p ? p.x : 0, cy: p ? p.y : 0 };
  }
  function renderAreas(gAreas, gLabels, type, forExport) {
    const smoothOf = a => (a.smooth == null ? 1 : a.smooth);
    state.areas.forEach((a, idx) => {
      if (a.points.length < 3) return;
      const pts = areaPts(a);
      const d = Geo.smoothClosedPath(pts, smoothOf(a));
      const st = areaStyle(a, type);
      const poly = Geo.sampleClosed(pts, smoothOf(a), 6);
      hits.set(a.id, { kind: 'area', poly, pts });
      const sel = selection && selection.kind === 'area' && selection.id === a.id;
      el('path', { d, fill: st.fill, 'fill-opacity': st.opacity, stroke: st.stroke, 'stroke-width': st.sw, 'stroke-dasharray': st.dash, 'stroke-linejoin': 'round', 'data-id': a.id, class: 'area' + (sel ? ' sel' : '') + (hoverId === a.id && !forExport ? ' hov' : '') }, gAreas);
      if (a.hideLabel) return;
      const labelMode = type.labels;
      if (labelMode === 'arrow' || (labelMode === 'optional' && a.label && a.showLabel)) renderArrowLabel(gLabels, a, type, poly);
      else if (labelMode === 'number') renderNumberBadge(gLabels, a, idx, poly);
    });
  }
  function renderArrowLabel(g, a, type, poly) {
    if (!a.label) a.label = autoLabelPos(a, poly);
    const lb = labelBox(a, type);
    const x0 = lb.cx - lb.w / 2, y0 = lb.cy - lb.h / 2;
    hits.set('label:' + a.id, { kind: 'label', bbox: { x: x0 - 10, y: y0 - 10, w: lb.w + 20, h: lb.h + 20 } });
    // arrow
    if (a.showArrow !== false) {
      const target = Geo.nearestOnOutline({ x: lb.cx, y: lb.cy }, poly);
      const c = Geo.centroid(poly);
      const inside = Geo.pointInPolygon({ x: lb.cx, y: lb.cy }, poly);
      if (!inside && target) {
        const dx = target.x - lb.cx, dy = target.y - lb.cy;
        const tx = Math.abs(dx) > 1e-6 ? (lb.w / 2 + 22) / Math.abs(dx) : Infinity, ty = Math.abs(dy) > 1e-6 ? (lb.h / 2 + 16) / Math.abs(dy) : Infinity;
        const t = Math.min(tx, ty);
        const start = { x: lb.cx + dx * t, y: lb.cy + dy * t };
        const vx = c.x - target.x, vy = c.y - target.y, vl = Math.hypot(vx, vy) || 1;
        const end = { x: target.x + (vx / vl) * 14, y: target.y + (vy / vl) * 14 };
        if (Geo.dist(start, end) > 30) drawArrow(g, start, end, a.arrowColor || '#111111', 5);
      }
    }
    const tg = el('g', { 'data-id': 'label:' + a.id, class: 'label', 'font-family': FONT }, g);
    lb.lines.forEach((ln, i) => text(tg, x0, y0 + lb.size * 0.95 + i * lb.lh, ln, { 'font-size': lb.size, 'font-weight': a.labelWeight || 500, fill: a.labelColor || '#111111', 'letter-spacing': -0.3 }));
  }
  function drawArrow(g, s, e, color, width) {
    const ang = Math.atan2(e.y - s.y, e.x - s.x), hl = 34, hw = 15;
    const bx = e.x - Math.cos(ang) * hl * 0.8, by = e.y - Math.sin(ang) * hl * 0.8;
    el('line', { x1: s.x, y1: s.y, x2: bx, y2: by, stroke: color, 'stroke-width': width, 'stroke-linecap': 'round' }, g);
    const p1 = { x: e.x - Math.cos(ang) * hl + Math.sin(ang) * hw, y: e.y - Math.sin(ang) * hl - Math.cos(ang) * hw };
    const p2 = { x: e.x - Math.cos(ang) * hl - Math.sin(ang) * hw, y: e.y - Math.sin(ang) * hl + Math.cos(ang) * hw };
    el('path', { d: `M${e.x},${e.y}L${p1.x},${p1.y}L${p2.x},${p2.y}Z`, fill: color }, g);
  }
  function renderNumberBadge(g, a, idx, poly) {
    if (!a.label) { const c = Geo.centroid(poly); a.label = toLL(c.x, c.y); }
    const p = toXY(a.label.lon, a.label.lat), s = 66;
    const n = numberOf(a);
    hits.set('label:' + a.id, { kind: 'label', bbox: { x: p.x - s / 2, y: p.y - s / 2, w: s, h: s } });
    const tg = el('g', { 'data-id': 'label:' + a.id, class: 'label' }, g);
    el('rect', { x: p.x - s / 2, y: p.y - s / 2, width: s, height: s, rx: 8, fill: '#FFE600', stroke: '#111', 'stroke-width': 3 }, tg);
    text(tg, p.x, p.y + 16, String(n), { 'font-size': 44, 'font-weight': 600, fill: '#111', 'text-anchor': 'middle' });
  }
  function numberOf(a) { return state.areas.indexOf(a) + 1; }
  function autoLabelPos(a, poly) {
    // Try several candidate positions around the area and keep the one that
    // overlaps other areas / labels the least and stays on the canvas.
    const bb = Geo.bbox(poly), type = currentType();
    const lb = labelBox(Object.assign({}, a, { label: null }), type);
    const others = state.areas.filter(o => o !== a && o.points.length >= 3).map(o => Geo.sampleClosed(areaPts(o), o.smooth == null ? 1 : o.smooth, 4));
    const labels = state.areas.filter(o => o !== a && o.label && !o.hideLabel).map(o => { const b = labelBox(o, type); return { x: b.cx - b.w / 2, y: b.cy - b.h / 2, w: b.w, h: b.h }; });
    state.elements.forEach(e => { const b = elementBox(e); if (b) labels.push(b); });
    const gapX = 110 + lb.w / 2, gapY = 90 + lb.h / 2;
    const cands = [
      { x: bb.minX - gapX, y: bb.cy }, { x: bb.maxX + gapX, y: bb.cy },
      { x: bb.minX - gapX, y: bb.cy - bb.h * 0.3 }, { x: bb.maxX + gapX, y: bb.cy - bb.h * 0.3 },
      { x: bb.minX - gapX, y: bb.cy + bb.h * 0.3 }, { x: bb.maxX + gapX, y: bb.cy + bb.h * 0.3 },
      { x: bb.cx, y: bb.minY - gapY }, { x: bb.cx, y: bb.maxY + gapY },
      { x: bb.minX - gapX * 0.7, y: bb.minY - gapY * 0.7 }, { x: bb.maxX + gapX * 0.7, y: bb.maxY + gapY * 0.7 },
      { x: bb.maxX + gapX * 0.7, y: bb.minY - gapY * 0.7 }, { x: bb.minX - gapX * 0.7, y: bb.maxY + gapY * 0.7 },
    ];
    let best = null, bestScore = Infinity;
    cands.forEach((c, idx) => {
      const x = clamp(c.x, lb.w / 2 + 50, W - lb.w / 2 - 50), y = clamp(y0(c.y), lb.h / 2 + 230, H - lb.h / 2 - 230);
      const box = { x: x - lb.w / 2, y: y - lb.h / 2, w: lb.w, h: lb.h };
      let score = idx * 2 + Math.hypot(x - c.x, y - c.y) * 0.5; // prefer earlier candidates and unclamped positions
      // overlap with areas: sample a grid of points inside the label box
      const samples = [];
      for (let i = 0; i <= 4; i++) for (let j = 0; j <= 2; j++) samples.push({ x: box.x + (box.w * i) / 4, y: box.y + (box.h * j) / 2 });
      samples.forEach(s => { if (Geo.pointInPolygon(s, poly)) score += 40; others.forEach(o => { if (Geo.pointInPolygon(s, o)) score += 40; }); });
      labels.forEach(l => { if (!(box.x > l.x + l.w || box.x + box.w < l.x || box.y > l.y + l.h || box.y + box.h < l.y)) score += 300; });
      // keep clear of the logo (top-left) and legend (bottom-left)
      if (box.x < 720 && box.y < 240) score += 300;
      if (box.x < 700 && box.y + box.h > H - 260) score += 300;
      if (score < bestScore) { bestScore = score; best = { x, y }; }
    });
    return toLL(best.x, best.y);
    function y0(v) { return v; }
  }

  function elementBox(e) {
    if (e.kind === 'text') { const p = toXY(e.lon, e.lat), lines = String(e.text || '').split('\n'), size = e.size || 40; const w = Math.max(...lines.map(l => measure(l, size, e.weight || 600))) + 36, h = lines.length * size * 1.22 + 20; const x0 = e.align === 'middle' ? p.x - w / 2 : e.align === 'end' ? p.x - w : p.x; return { x: x0, y: p.y - 10, w, h }; }
    if (e.kind === 'box') { const p = toXY(e.lon, e.lat); return { x: p.x, y: p.y, w: e.w, h: e.h }; }
    if (e.kind === 'icon') { const p = toXY(e.lon, e.lat), s = e.size || 120; return { x: p.x - s * 0.6, y: p.y - s * 0.6, w: s * 1.2, h: s * 1.2 }; }
    return null;
  }

  // ---- Elements -----------------------------------------------------------
  function renderElements(g, forExport) {
    state.elements.forEach(e => {
      const sel = selection && selection.kind === 'element' && selection.id === e.id;
      const grp = el('g', { 'data-id': 'el:' + e.id, class: 'element' + (sel ? ' sel' : '') }, g);
      if (e.kind === 'text') {
        const p = toXY(e.lon, e.lat), lines = String(e.text || '').split('\n'), size = e.size || 40, lh = size * 1.22;
        const w = Math.max(...lines.map(l => measure(l, size, e.weight || 600))) + 36, h = lines.length * lh + 20;
        const x0 = e.align === 'middle' ? p.x - w / 2 : e.align === 'end' ? p.x - w : p.x;
        if (e.bg && e.bg !== 'none') el('rect', { x: x0, y: p.y - 10, width: w, height: h, rx: 14, fill: e.bg, 'fill-opacity': e.bgOpacity == null ? 0.92 : e.bgOpacity, stroke: e.border || 'none', 'stroke-width': 2.5 }, grp);
        const tx = e.align === 'middle' ? x0 + w / 2 : e.align === 'end' ? x0 + w - 18 : x0 + 18;
        lines.forEach((ln, i) => text(grp, tx, p.y + size * 0.95 + i * lh, ln, { 'font-size': size, 'font-weight': e.weight || 600, fill: e.color || '#111', 'text-anchor': e.align || 'start', 'font-style': e.italic ? 'italic' : null }));
        hits.set('el:' + e.id, { kind: 'element', bbox: { x: x0, y: p.y - 10, w, h } });
      } else if (e.kind === 'line') {
        const a = toXY(e.a.lon, e.a.lat), b = toXY(e.b.lon, e.b.lat), wdt = e.width || 6, col = e.color || '#111';
        if (e.head === 'none') el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: col, 'stroke-width': wdt, 'stroke-linecap': 'round', 'stroke-dasharray': e.dash ? `${wdt * 3} ${wdt * 2}` : null }, grp);
        else if (e.head === 'both') { const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; drawArrow(grp, mid, b, col, wdt); drawArrow(grp, mid, a, col, wdt); }
        else drawArrow(grp, a, b, col, wdt);
        if (e.dash && e.head !== 'none') grp.querySelectorAll('line').forEach(l => l.setAttribute('stroke-dasharray', `${wdt * 3} ${wdt * 2}`));
        hits.set('el:' + e.id, { kind: 'element', seg: [a, b] });
      } else if (e.kind === 'box') {
        const p = toXY(e.lon, e.lat);
        el('rect', { x: p.x, y: p.y, width: e.w, height: e.h, rx: e.radius == null ? 16 : e.radius, fill: e.fill || '#ffffff', 'fill-opacity': e.fillOpacity == null ? 0.9 : e.fillOpacity, stroke: e.stroke || '#111', 'stroke-width': e.strokeWidth == null ? 3 : e.strokeWidth, 'stroke-dasharray': e.dash ? '16 10' : null }, grp);
        hits.set('el:' + e.id, { kind: 'element', bbox: { x: p.x, y: p.y, w: e.w, h: e.h } });
      } else if (e.kind === 'icon') {
        const p = toXY(e.lon, e.lat), s = e.size || 120;
        if (e.bg !== false) el('circle', { cx: p.x, cy: p.y, r: s * 0.58, fill: e.bgColor || '#ffffff', 'fill-opacity': 0.95, stroke: '#111', 'stroke-width': 2.5, 'stroke-opacity': 0.5, filter: forExport ? null : null }, grp);
        const ig = el('g', { transform: `translate(${p.x - s / 2},${p.y - s / 2}) scale(${s / 100})`, stroke: e.color || '#1B2430', fill: e.color || '#1B2430', color: e.color || '#1B2430' }, grp);
        ig.innerHTML = Icons.get(e.icon).svg;
        if (e.caption) text(grp, p.x, p.y + s * 0.58 + 34, e.caption, { 'font-size': 28, 'font-weight': 600, fill: '#111', 'text-anchor': 'middle', 'font-family': FONT });
        hits.set('el:' + e.id, { kind: 'element', bbox: { x: p.x - s * 0.6, y: p.y - s * 0.6, w: s * 1.2, h: s * 1.2 } });
      }
    });
  }

  // ---- Edit overlay --------------------------------------------------------
  function renderEdit(g, type) {
    const k = sx();
    // selection outline for area + vertex handles
    if (selection && selection.kind === 'area') {
      const a = state.areas.find(x => x.id === selection.id);
      if (a) {
        const pts = areaPts(a);
        if (pts.length >= 3) el('path', { d: Geo.smoothClosedPath(pts, a.smooth == null ? 1 : a.smooth), fill: 'none', stroke: '#2563EB', 'stroke-width': 3 * k, 'stroke-dasharray': `${10 * k} ${8 * k}` }, g);
        pts.forEach((p, i) => el('circle', { cx: p.x, cy: p.y, r: 10 * k, fill: '#fff', stroke: '#2563EB', 'stroke-width': 3 * k, 'data-vertex': i, class: 'vertex' }, g));
        const lh = hits.get('label:' + a.id);
        if (lh && lh.bbox) el('rect', { x: lh.bbox.x, y: lh.bbox.y, width: lh.bbox.w, height: lh.bbox.h, rx: 8, fill: 'none', stroke: '#2563EB', 'stroke-width': 2 * k, 'stroke-dasharray': `${8 * k} ${6 * k}` }, g);
      }
    }
    if (selection && selection.kind === 'element') {
      const h = hits.get('el:' + selection.id), e = state.elements.find(x => x.id === selection.id);
      if (h && h.bbox) {
        el('rect', { x: h.bbox.x - 6, y: h.bbox.y - 6, width: h.bbox.w + 12, height: h.bbox.h + 12, rx: 8, fill: 'none', stroke: '#2563EB', 'stroke-width': 2.5 * k, 'stroke-dasharray': `${8 * k} ${6 * k}` }, g);
        if (e && (e.kind === 'box' || e.kind === 'icon' || e.kind === 'text')) el('rect', { x: h.bbox.x + h.bbox.w - 8 * k, y: h.bbox.y + h.bbox.h - 8 * k, width: 16 * k, height: 16 * k, fill: '#2563EB', 'data-resize': '1', class: 'resize' }, g);
      }
      if (h && h.seg) { h.seg.forEach((p, i) => el('circle', { cx: p.x, cy: p.y, r: 10 * k, fill: '#fff', stroke: '#2563EB', 'stroke-width': 3 * k, 'data-end': i, class: 'vertex' }, g)); }
    }
    // draft polygon while drawing
    if (tool === 'draw' && draft.length) {
      const pts = cursor ? draft.concat([cursor]) : draft;
      if (draft.length >= 3) el('path', { d: Geo.smoothClosedPath(pts, 1), fill: '#2563EB', 'fill-opacity': 0.12, stroke: 'none' }, g);
      el('path', { d: Geo.smoothOpenPath(pts, 1), fill: 'none', stroke: '#2563EB', 'stroke-width': 3.5 * k, 'stroke-linecap': 'round' }, g);
      draft.forEach((p, i) => el('circle', { cx: p.x, cy: p.y, r: (i === 0 ? 12 : 7) * k, fill: i === 0 ? '#fff' : '#2563EB', stroke: '#2563EB', 'stroke-width': 3 * k }, g));
      if (draft.length >= 3 && cursor && Geo.dist(cursor, draft[0]) < 18 * k) el('circle', { cx: draft[0].x, cy: draft[0].y, r: 20 * k, fill: 'none', stroke: '#16A34A', 'stroke-width': 4 * k }, g);
    }
    if (pendingShape) {
      const s = pendingShape.start, c = pendingShape.cur;
      if (pendingShape.kind === 'line') drawArrow(g, s, c, '#2563EB', 5 * k);
      else el('rect', { x: Math.min(s.x, c.x), y: Math.min(s.y, c.y), width: Math.abs(c.x - s.x), height: Math.abs(c.y - s.y), rx: 16, fill: '#2563EB', 'fill-opacity': 0.12, stroke: '#2563EB', 'stroke-width': 3 * k }, g);
    }
  }

  // =====================================================================
  // Hit testing
  // =====================================================================
  function hitAt(p) {
    const k = sx();
    // labels first (they sit above areas), then elements (topmost first), then areas
    const ids = Array.from(hits.keys()).reverse();
    for (const id of ids) {
      const h = hits.get(id);
      if (h.kind === 'element') {
        if (h.bbox && inBox(p, h.bbox)) return { kind: 'element', id: id.slice(3) };
        if (h.seg && distToSeg(p, h.seg[0], h.seg[1]) < 12 * k) return { kind: 'element', id: id.slice(3) };
      }
    }
    for (const id of ids) { const h = hits.get(id); if (h.kind === 'label' && inBox(p, h.bbox)) return { kind: 'label', id: id.slice(6) }; }
    for (const id of ids) { const h = hits.get(id); if (h.kind === 'area' && Geo.pointInPolygon(p, h.poly)) return { kind: 'area', id }; }
    return null;
  }
  const inBox = (p, b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  function distToSeg(p, a, b) { const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy; let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0; t = clamp(t, 0, 1); return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)); }

  // =====================================================================
  // Pointer interaction
  // =====================================================================
  let spaceDown = false, pointerDownAt = null, pointerMoved = false;
  svg.addEventListener('pointerdown', ev => {
    if (ev.button === 1 || (ev.button === 0 && spaceDown)) { startPan(ev); return; }
    if (ev.button !== 0) return;
    const p = canvasPoint(ev);
    pointerDownAt = p; pointerMoved = false;
    closeMenus();
    if (tool === 'draw') { addDraftPoint(p); return; }
    if (tool === 'text') { placeText(p); return; }
    if (tool === 'icon') { placeIcon(p); return; }
    if (tool === 'line' || tool === 'box') { pendingShape = { kind: tool, start: p, cur: p }; svg.setPointerCapture(ev.pointerId); render(); return; }
    // select tool ------------------------------------------------------
    const t = ev.target;
    if (t.dataset && t.dataset.vertex != null && selection && selection.kind === 'area') { snapshot(); drag = { kind: 'vertex', i: +t.dataset.vertex }; svg.setPointerCapture(ev.pointerId); return; }
    if (t.dataset && t.dataset.end != null && selection && selection.kind === 'element') { snapshot(); drag = { kind: 'end', i: +t.dataset.end }; svg.setPointerCapture(ev.pointerId); return; }
    if (t.dataset && t.dataset.resize && selection && selection.kind === 'element') { const e = elementById(selection.id); snapshot(); drag = { kind: 'resize', start: p, e0: clone(e) }; svg.setPointerCapture(ev.pointerId); return; }
    const hit = hitAt(p);
    if (hit) {
      if (ev.shiftKey && hit.kind === 'area' && selection && selection.kind === 'area' && selection.id === hit.id) { insertVertex(hit.id, p); return; }
      if (hit.kind === 'area') { select({ kind: 'area', id: hit.id }); const a = areaById(hit.id); snapshot(); drag = { kind: 'area', a, start: p, pts0: clone(a.points), label0: a.label ? clone(a.label) : null }; }
      else if (hit.kind === 'label') { select({ kind: 'area', id: hit.id }); const a = areaById(hit.id); snapshot(); drag = { kind: 'label', a, start: p, label0: clone(a.label) }; }
      else if (hit.kind === 'element') { select({ kind: 'element', id: hit.id }); const e = elementById(hit.id); snapshot(); drag = { kind: 'element', e, start: p, e0: clone(e) }; }
      svg.setPointerCapture(ev.pointerId);
    } else {
      drag = { kind: 'maybe-pan', start: { x: ev.clientX, y: ev.clientY }, view0: Object.assign({}, view) };
      svg.setPointerCapture(ev.pointerId);
    }
  });
  svg.addEventListener('pointermove', ev => {
    const p = canvasPoint(ev); cursor = p;
    if (drag && drag.kind === 'pan') { doPan(ev); return; }
    if (drag && drag.kind === 'maybe-pan') {
      if (Math.hypot(ev.clientX - drag.start.x, ev.clientY - drag.start.y) > 5) { drag.kind = 'pan'; svg.classList.add('panning'); doPan(ev); }
      return;
    }
    if (pendingShape) { pendingShape.cur = ev.shiftKey && pendingShape.kind === 'box' ? squareCorner(pendingShape.start, p) : p; render(); return; }
    if (drag) {
      pointerMoved = true;
      const dx = drag.start ? p.x - drag.start.x : 0, dy = drag.start ? p.y - drag.start.y : 0;
      if (drag.kind === 'vertex') { const a = areaById(selection.id); a.points[drag.i] = toLL(p.x, p.y); }
      else if (drag.kind === 'area') { drag.a.points = drag.pts0.map(pt => { const xy = toXY(pt.lon, pt.lat); return toLL(xy.x + dx, xy.y + dy); }); if (drag.label0) { const xy = toXY(drag.label0.lon, drag.label0.lat); drag.a.label = toLL(xy.x + dx, xy.y + dy); } }
      else if (drag.kind === 'label') { const xy = toXY(drag.label0.lon, drag.label0.lat); drag.a.label = toLL(xy.x + dx, xy.y + dy); }
      else if (drag.kind === 'element') moveElement(drag.e, drag.e0, dx, dy);
      else if (drag.kind === 'end') { const e = elementById(selection.id); e[drag.i === 0 ? 'a' : 'b'] = toLL(p.x, p.y); }
      else if (drag.kind === 'resize') resizeElement(elementById(selection.id), drag.e0, dx, dy, ev.shiftKey);
      render(); return;
    }
    if (tool === 'draw' && draft.length) { render(); return; }
    if (tool === 'select') {
      const hit = hitAt(p); const id = hit && hit.kind === 'area' ? hit.id : null;
      if (id !== hoverId) { hoverId = id; render(); }
      svg.style.cursor = hit ? 'move' : '';
    }
  });
  svg.addEventListener('pointerup', ev => {
    if (pendingShape) { finishShape(); try { svg.releasePointerCapture(ev.pointerId); } catch (e) { /* ignore */ } return; }
    if (drag) {
      if (drag.kind === 'maybe-pan') { select(null); }
      else if (drag.kind === 'pan') { svg.classList.remove('panning'); }
      else if (!pointerMoved) { undoStack.pop(); updateUndoButtons(); } // nothing changed; drop the snapshot
      else { autosave(); buildInspector(); }
      drag = null; try { svg.releasePointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
    }
  });
  svg.addEventListener('dblclick', ev => {
    ev.preventDefault();
    if (tool === 'draw') { if (draft.length >= 3) { draft.pop(); finishDraft(ev); } return; }
    if (tool === 'select') {
      const t = ev.target;
      if (t.dataset && t.dataset.vertex != null && selection && selection.kind === 'area') { const a = areaById(selection.id); if (a.points.length > 3) { snapshot(); a.points.splice(+t.dataset.vertex, 1); render(); autosave(); } return; }
      const hit = hitAt(canvasPoint(ev));
      if (hit && hit.kind === 'element') { const e = elementById(hit.id); if (e.kind === 'text') { const f = $('#inspector textarea'); if (f) f.focus(); } }
    }
  });
  svg.addEventListener('wheel', ev => { ev.preventDefault(); const p = canvasPoint(ev); zoomAt(ev.deltaY < 0 ? 1.12 : 1 / 1.12, p.x, p.y); }, { passive: false });
  svg.addEventListener('contextmenu', ev => ev.preventDefault());
  function startPan(ev) { drag = { kind: 'pan', start: { x: ev.clientX, y: ev.clientY }, view0: Object.assign({}, view) }; svg.classList.add('panning'); svg.setPointerCapture(ev.pointerId); }
  function doPan(ev) { const ctm = svg.getScreenCTM(); view.x = drag.view0.x - (ev.clientX - drag.start.x) / ctm.a; view.y = drag.view0.y - (ev.clientY - drag.start.y) / ctm.d; constrainView(); applyView(); }
  function squareCorner(s, p) { const d = Math.max(Math.abs(p.x - s.x), Math.abs(p.y - s.y)); return { x: s.x + Math.sign(p.x - s.x || 1) * d, y: s.y + Math.sign(p.y - s.y || 1) * d }; }
  const areaById = id => state.areas.find(a => a.id === id);
  const elementById = id => state.elements.find(e => e.id === id);

  function moveElement(e, e0, dx, dy) {
    const mv = ll => { const xy = toXY(ll.lon, ll.lat); return toLL(xy.x + dx, xy.y + dy); };
    if (e.kind === 'line') { e.a = mv(e0.a); e.b = mv(e0.b); } else { const n = mv(e0); e.lon = n.lon; e.lat = n.lat; }
  }
  function resizeElement(e, e0, dx, dy, keepRatio) {
    if (e.kind === 'box') { e.w = Math.max(40, e0.w + dx); e.h = Math.max(30, keepRatio ? e.w * (e0.h / e0.w) : e0.h + dy); }
    else if (e.kind === 'icon') e.size = clamp((e0.size || 120) + Math.max(dx, dy), 40, 600);
    else if (e.kind === 'text') e.size = clamp((e0.size || 40) + Math.max(dx, dy) * 0.3, 14, 200);
  }

  // ---- Drawing ------------------------------------------------------------
  function addDraftPoint(p) {
    const k = sx();
    if (draft.length >= 3 && Geo.dist(p, draft[0]) < 18 * k) { finishDraft(); return; }
    if (draft.length && Geo.dist(p, draft[draft.length - 1]) < 2 * k) return; // ignore accidental double clicks
    draft.push(p); render(); setHint();
  }
  function finishDraft() {
    if (draft.length < 3) { toast('Add at least 3 points to make an area', 'warn'); return; }
    snapshot();
    const type = currentType();
    const a = { id: uid(), points: draft.map(p => toLL(p.x, p.y)), category: null, hazards: [], smooth: 1, label: null, showLabel: type.labels === 'arrow' };
    state.areas.push(a); draft = [];
    if (settings.autoLabels !== false && type.labels === 'arrow') { const poly = Geo.sampleClosed(areaPts(a), 1, 6); a.label = autoLabelPos(a, poly); }
    select({ kind: 'area', id: a.id });
    render(); autosave();
    setTool('select', true);
    openPicker(a);
  }
  function cancelDraft() { draft = []; render(); setHint(); }
  function insertVertex(id, p) {
    const a = areaById(id), pts = areaPts(a);
    let best = 0, bd = Infinity;
    for (let i = 0; i < pts.length; i++) { const d = distToSeg(p, pts[i], pts[(i + 1) % pts.length]); if (d < bd) { bd = d; best = i; } }
    snapshot(); a.points.splice(best + 1, 0, toLL(p.x, p.y)); render(); autosave(); toast('Point added');
  }
  function placeText(p) {
    snapshot();
    const e = { id: uid(), kind: 'text', lon: 0, lat: 0, text: 'New text', size: 40, weight: 600, color: '#111111', bg: '#ffffff', border: '#111111', align: 'start' };
    Object.assign(e, toLL(p.x, p.y)); state.elements.push(e); select({ kind: 'element', id: e.id }); setTool('select', true); render(); autosave();
    setTimeout(() => { const f = $('#inspector textarea'); if (f) { f.focus(); f.select(); } }, 30);
  }
  function placeIcon(p) {
    snapshot();
    const e = Object.assign({ id: uid(), kind: 'icon', icon: currentIcon, size: 120, color: '#1B2430', bg: true, bgColor: '#ffffff', caption: '' }, toLL(p.x, p.y));
    state.elements.push(e); select({ kind: 'element', id: e.id }); render(); autosave();
  }
  function finishShape() {
    const s = pendingShape.start, c = pendingShape.cur, kind = pendingShape.kind; pendingShape = null;
    if (Geo.dist(s, c) < 20) { render(); return; }
    snapshot();
    let e;
    if (kind === 'line') e = { id: uid(), kind: 'line', a: toLL(s.x, s.y), b: toLL(c.x, c.y), width: 6, color: '#111111', head: 'end', dash: false };
    else { const ll = toLL(Math.min(s.x, c.x), Math.min(s.y, c.y)); e = { id: uid(), kind: 'box', lon: ll.lon, lat: ll.lat, w: Math.abs(c.x - s.x), h: Math.abs(c.y - s.y), fill: '#ffffff', fillOpacity: 0.9, stroke: '#111111', strokeWidth: 3, radius: 16, dash: false }; }
    state.elements.push(e); select({ kind: 'element', id: e.id }); setTool('select', true); render(); autosave();
  }

  // =====================================================================
  // Tools, selection, hints
  // =====================================================================
  function setTool(t, silent) {
    if (tool === 'draw' && t !== 'draw' && draft.length) { if (!silent && !confirm('Discard the area you are drawing?')) return; draft = []; }
    tool = t; pendingShape = null;
    $$('.tool').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
    svg.className.baseVal = 'tool-' + t;
    $('#iconTray').hidden = t !== 'icon';
    if (t !== 'select') { select(null); }
    const help = { select: 'Click an area to select it. Drag to move, drag the blue points to reshape, double-click a point to remove it, Shift+click the outline to add a point.', draw: 'Click around the edge of the risk area. Close it by clicking the first point, pressing Enter or double-clicking. Backspace removes the last point, Esc cancels. Scroll to zoom for small areas.', text: 'Click on the map to place a text box.', line: 'Drag on the map to draw an arrow. Change the arrowheads in the inspector.', box: 'Drag to draw a box. Hold Shift for a square.', icon: 'Pick an icon, then click on the map to place it.' };
    $('#toolHelp').textContent = help[t];
    setHint(); render();
  }
  function select(sel) {
    selection = sel; closePicker(); render(); buildInspector();
  }
  function setHint() {
    const hb = $('#hintbar'); hb.hidden = settings.showHints === false;
    let h;
    if (tool === 'draw') h = draft.length ? `<b>${draft.length} point${draft.length === 1 ? '' : 's'}</b> · click the first point, press <span class="kbd">Enter</span> or double-click to close · <span class="kbd">Backspace</span> undo last point · <span class="kbd">Esc</span> cancel` : 'Click to start the outline of a risk area. Scroll to zoom in for small areas; hold <span class="kbd">Space</span> and drag to pan.';
    else if (selection) h = selection.kind === 'area' ? 'Drag the area to move it · drag blue points to reshape · <span class="kbd">Shift</span>+click outline to add a point · double-click a point to remove it · <span class="kbd">1</span>–<span class="kbd">9</span> set level · <span class="kbd">Del</span> delete' : 'Drag to move · drag the blue square to resize · <span class="kbd">Del</span> delete';
    else h = '<span class="kbd">D</span> draw area · <span class="kbd">V</span> select · <span class="kbd">T</span> text · <span class="kbd">L</span> arrow · <span class="kbd">B</span> box · <span class="kbd">I</span> icon · scroll to zoom · <span class="kbd">Space</span>+drag to pan · <span class="kbd">Ctrl</span>+<span class="kbd">Z</span> undo';
    hb.innerHTML = h;
  }

  // =====================================================================
  // Picker popover (after an area is closed)
  // =====================================================================
  function openPicker(a) {
    const type = currentType(), pk = $('#picker');
    const poly = hits.get(a.id) ? hits.get(a.id).poly : areaPts(a);
    const bb = Geo.bbox(poly);
    // position in screen space near the area's right edge
    const ctm = svg.getScreenCTM(), wrap = $('#canvasWrap').getBoundingClientRect();
    let sxp = ctm.a * (bb.maxX) + ctm.e - wrap.left + 16, syp = ctm.d * bb.cy + ctm.f - wrap.top - 120;
    if (sxp + 340 > wrap.width) sxp = Math.max(8, ctm.a * bb.minX + ctm.e - wrap.left - 346);
    syp = clamp(syp, 8, Math.max(8, wrap.height - 360));
    pk.style.left = sxp + 'px'; pk.style.top = syp + 'px';
    pk.innerHTML = `<h4>${esc(type.categoryLabel || 'Category')}</h4><div class="level-grid ${type.categories.length <= 2 ? 'cols2' : type.categories.length > 3 ? 'cols2' : ''}" id="pkLevels"></div>` +
      (type.hazards ? `<h4>Hazards</h4><div class="chips" id="pkChips"></div><div id="pkDetails"></div>` : '') +
      `<div class="row end"><button class="btn ghost" id="pkDelete">Delete area</button><span class="spacer"></span><button class="btn primary" id="pkDone">Done</button></div>`;
    pk.hidden = false;
    renderLevelButtons($('#pkLevels'), a, type, () => { render(); buildInspector(); autosave(); });
    if (type.hazards) renderHazardChips($('#pkChips'), $('#pkDetails'), a, () => { render(); buildInspector(); autosave(); });
    $('#pkDone').onclick = () => { closePicker(); if (!a.category) toast('No level chosen yet — pick one in the inspector', 'warn'); };
    $('#pkDelete').onclick = () => deleteSelected();
  }
  function closePicker() { $('#picker').hidden = true; }

  function renderLevelButtons(host, a, type, onChange) {
    host.innerHTML = '';
    type.categories.forEach(c => {
      const b = document.createElement('button'); b.className = 'level-btn' + (a.category === c.id ? ' active' : '');
      b.style.background = c.color; b.style.color = Templates.textColorFor(c.color); b.textContent = c.name; b.type = 'button';
      b.onclick = () => { snapshot(); a.category = c.id; host.querySelectorAll('.level-btn').forEach(x => x.classList.toggle('active', x === b)); onChange(); };
      host.appendChild(b);
    });
  }
  function renderHazardChips(host, detailHost, a, onChange) {
    host.innerHTML = ''; detailHost.innerHTML = '';
    a.hazards = a.hazards || [];
    Templates.HAZARDS.forEach(hz => {
      const on = a.hazards.find(h => h.key === hz.key);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (on ? ' active' : ''); b.textContent = hz.key;
      b.onclick = () => { snapshot(); if (on) a.hazards = a.hazards.filter(h => h.key !== hz.key); else a.hazards.push({ key: hz.key, detail: hz.detail || '' }); renderHazardChips(host, detailHost, a, onChange); onChange(); };
      host.appendChild(b);
    });
    // custom hazard
    const add = document.createElement('button'); add.type = 'button'; add.className = 'chip'; add.textContent = '+ Custom';
    add.onclick = () => { const v = prompt('Hazard text (e.g. "Heavy Rain")'); if (v) { snapshot(); a.hazards.push({ key: v.trim(), detail: '' }); renderHazardChips(host, detailHost, a, onChange); onChange(); } };
    host.appendChild(add);
    a.hazards.forEach(h => {
      const def = Templates.HAZARDS.find(x => x.key === h.key);
      const row = document.createElement('div'); row.className = 'chip-detail';
      row.innerHTML = `<span>${esc(h.key)}</span><input placeholder="${esc(def && def.detailHint || 'Detail (optional)')}" value="${esc(h.detail || '')}"><button type="button" class="btn ghost sm" title="Remove">✕</button>`;
      const inp = row.querySelector('input');
      inp.oninput = () => { h.detail = inp.value; onChange(); };
      inp.onfocus = () => snapshot();
      row.querySelector('button').onclick = () => { snapshot(); a.hazards = a.hazards.filter(x => x !== h); renderHazardChips(host, detailHost, a, onChange); onChange(); };
      detailHost.appendChild(row);
    });
  }

  // =====================================================================
  // Inspector (right panel)
  // =====================================================================
  function buildInspector() {
    const host = $('#inspector'), type = currentType();
    if (selection && selection.kind === 'area') { const a = areaById(selection.id); if (a) return buildAreaInspector(host, a, type); }
    if (selection && selection.kind === 'element') { const e = elementById(selection.id); if (e) return buildElementInspector(host, e); }
    // overview list
    let html = `<h3>Areas (${state.areas.length})</h3>`;
    if (!state.areas.length) html += `<div class="empty"><div class="big">✎</div>No risk areas yet.<br>Press <span class="kbd">D</span> and click around the area on the map.</div>`;
    state.areas.forEach((a, i) => {
      const c = catOf(a, type), col = c ? c.color : '#CBD5E1';
      const lines = labelLines(a, type);
      html += `<div class="area-card" data-area="${a.id}"><div class="sw" style="background:${col}">${type.labels === 'number' ? i + 1 : ''}</div><div class="t"><b>${esc(c ? c.name : 'No level chosen')}</b><span>${esc(lines.filter(l => !c || l !== (c.suffix || c.name + ' Risk')).join(', ') || (type.hazards ? 'No hazards' : ''))}</span></div></div>`;
    });
    if (state.elements.length) {
      html += `<h3 style="margin-top:16px">Elements (${state.elements.length})</h3>`;
      state.elements.forEach(e => { html += `<div class="area-card" data-el="${e.id}"><div class="sw" style="background:#F1F5F9">${{ text: 'T', line: '➚', box: '▭', icon: '☂' }[e.kind]}</div><div class="t"><b>${esc(elementTitle(e))}</b></div></div>`; });
    }
    html += `<div class="actions"><button class="btn sm" id="inspDraw">+ Draw area</button>${state.areas.length ? '<button class="btn sm ghost" id="inspAutoLabels">Re-place labels</button><button class="btn sm ghost danger" id="inspClear">Clear all</button>' : ''}</div>`;
    html += `<div class="callout" style="margin-top:14px"><b>Tips</b><br>Scroll to zoom in for tiny areas · drag an area to move it · click a label to drag it · <span class="kbd">Ctrl</span>+<span class="kbd">D</span> duplicates the selection.</div>`;
    host.innerHTML = html;
    host.querySelectorAll('[data-area]').forEach(c => { c.onclick = () => select({ kind: 'area', id: c.dataset.area }); c.onmouseenter = () => { hoverId = c.dataset.area; render(); }; c.onmouseleave = () => { hoverId = null; render(); }; });
    host.querySelectorAll('[data-el]').forEach(c => { c.onclick = () => select({ kind: 'element', id: c.dataset.el }); });
    const d = $('#inspDraw'); if (d) d.onclick = () => setTool('draw');
    const al = $('#inspAutoLabels'); if (al) al.onclick = () => { snapshot(); state.areas.forEach(a => { a.label = null; }); render(); autosave(); toast('Labels re-placed'); };
    const cl = $('#inspClear'); if (cl) cl.onclick = () => { if (confirm('Remove all areas and elements from this map?')) { snapshot(); state.areas = []; state.elements = []; select(null); render(); autosave(); } };
  }
  function elementTitle(e) { return e.kind === 'text' ? (e.text || 'Text').split('\n')[0].slice(0, 30) : e.kind === 'icon' ? Icons.get(e.icon).name + ' icon' : e.kind === 'line' ? 'Arrow' : 'Box'; }

  function field(label, inner) { return `<label class="field"><span>${label}</span>${inner}</label>`; }
  function buildAreaInspector(host, a, type) {
    const c = catOf(a, type);
    const idx = state.areas.indexOf(a);
    let html = `<div class="insp-head"><div class="sw" style="background:${c ? c.color : '#CBD5E1'}"></div><h2>${type.labels === 'number' ? 'Area ' + (idx + 1) : 'Risk area'}</h2><button class="btn ghost sm" id="inspBack">‹ All</button></div>`;
    if (!c) html += `<div class="callout warn">Choose a ${esc((type.categoryLabel || 'category').toLowerCase())} to colour this area.</div>`;
    html += `<h3>${esc(type.categoryLabel || 'Category')}</h3><div class="level-grid ${type.categories.length > 3 ? 'cols2' : ''}" id="inspLevels"></div>`;
    if (type.hazards) html += `<h3>Hazards</h3><div class="chips" id="inspChips"></div><div id="inspDetails"></div>`;
    if (type.labels !== 'none') {
      html += `<h3>Label</h3>`;
      if (type.labels === 'optional') html += `<label class="check"><input type="checkbox" id="inspShowLabel" ${a.showLabel ? 'checked' : ''}> Show a text label with arrow</label>`;
      if (type.labels !== 'number') html += field('Custom text (leave empty for automatic)', `<textarea id="inspLabelText" rows="3" placeholder="${esc(labelLines(a, type).join('\n'))}">${esc(a.labelText || '')}</textarea>`) +
        `<label class="check"><input type="checkbox" id="inspArrow" ${a.showArrow === false ? '' : 'checked'}> Show arrow</label>` +
        field(`Text size <output>${a.labelSize || 42}</output>`, `<input type="range" id="inspLabelSize" min="24" max="80" step="1" value="${a.labelSize || 42}">`);
      html += `<label class="check"><input type="checkbox" id="inspHideLabel" ${a.hideLabel ? 'checked' : ''}> Hide label</label>`;
    }
    html += `<h3>Shape</h3>` + field(`Smoothing <output>${Math.round((a.smooth == null ? 1 : a.smooth) * 100)}%</output>`, `<input type="range" id="inspSmooth" min="0" max="1.4" step="0.05" value="${a.smooth == null ? 1 : a.smooth}">`) +
      field(`Opacity <output>${Math.round((a.opacity != null ? a.opacity : (c ? c.opacity : 1)) * 100)}%</output>`, `<input type="range" id="inspOpacity" min="0.2" max="1" step="0.02" value="${a.opacity != null ? a.opacity : (c ? c.opacity : 1)}">`) +
      `<p class="muted small">${a.points.length} points · drag the blue points to reshape · double-click a point to remove it · Shift+click the outline to add one.</p>`;
    html += `<div class="actions"><button class="btn sm" id="inspDup">Duplicate</button><button class="btn sm" id="inspFront">Bring to front</button><button class="btn sm" id="inspBack2">Send to back</button><button class="btn sm" id="inspSimplify">Simplify points</button><button class="btn sm danger" id="inspDelete">Delete</button></div>`;
    host.innerHTML = html;
    renderLevelButtons($('#inspLevels'), a, type, () => { render(); buildInspector(); autosave(); });
    if (type.hazards) renderHazardChips($('#inspChips'), $('#inspDetails'), a, () => { render(); autosave(); });
    $('#inspBack').onclick = () => select(null);
    bind('#inspShowLabel', 'change', e => { snapshot(); a.showLabel = e.target.checked; render(); autosave(); });
    bind('#inspLabelText', 'input', e => { a.labelText = e.target.value; render(); autosave(); });
    bind('#inspLabelText', 'focus', () => snapshot());
    bind('#inspArrow', 'change', e => { snapshot(); a.showArrow = e.target.checked; render(); autosave(); });
    bind('#inspLabelSize', 'input', e => { a.labelSize = +e.target.value; e.target.previousElementSibling.querySelector('output').textContent = e.target.value; render(); autosave(); });
    bind('#inspHideLabel', 'change', e => { snapshot(); a.hideLabel = e.target.checked; render(); autosave(); });
    bind('#inspSmooth', 'input', e => { a.smooth = +e.target.value; e.target.previousElementSibling.querySelector('output').textContent = Math.round(a.smooth * 100) + '%'; render(); autosave(); });
    bind('#inspOpacity', 'input', e => { a.opacity = +e.target.value; e.target.previousElementSibling.querySelector('output').textContent = Math.round(a.opacity * 100) + '%'; render(); autosave(); });
    $('#inspDup').onclick = duplicateSelected;
    $('#inspFront').onclick = () => { snapshot(); state.areas.splice(idx, 1); state.areas.push(a); render(); buildInspector(); autosave(); };
    $('#inspBack2').onclick = () => { snapshot(); state.areas.splice(idx, 1); state.areas.unshift(a); render(); buildInspector(); autosave(); };
    $('#inspSimplify').onclick = () => { if (a.points.length <= 6) return toast('Already simple', 'warn'); snapshot(); a.points = a.points.filter((p, i) => i % 2 === 0 || a.points.length <= 8); render(); buildInspector(); autosave(); };
    $('#inspDelete').onclick = deleteSelected;
  }
  function bind(sel, evt, fn) { const n = $(sel); if (n) n.addEventListener(evt, fn); }

  function buildElementInspector(host, e) {
    let html = `<div class="insp-head"><div class="sw" style="background:#F1F5F9"></div><h2>${esc(elementTitle(e))}</h2><button class="btn ghost sm" id="inspBack">‹ All</button></div>`;
    const colorField = (label, key, def) => field(label, `<input type="color" data-k="${key}" value="${e[key] || def}">`);
    if (e.kind === 'text') {
      html += field('Text', `<textarea data-k="text" rows="3">${esc(e.text || '')}</textarea>`) +
        field(`Size <output>${e.size || 40}</output>`, `<input type="range" data-k="size" min="16" max="140" step="1" value="${e.size || 40}">`) +
        field('Weight', `<select data-k="weight"><option value="400" ${e.weight == 400 ? 'selected' : ''}>Regular</option><option value="500" ${e.weight == 500 ? 'selected' : ''}>Medium</option><option value="600" ${!e.weight || e.weight == 600 ? 'selected' : ''}>Semi-bold</option><option value="700" ${e.weight == 700 ? 'selected' : ''}>Bold</option></select>`) +
        field('Alignment', `<select data-k="align"><option value="start" ${e.align === 'start' || !e.align ? 'selected' : ''}>Left</option><option value="middle" ${e.align === 'middle' ? 'selected' : ''}>Centre</option><option value="end" ${e.align === 'end' ? 'selected' : ''}>Right</option></select>`) +
        `<div class="row">${colorField('Text colour', 'color', '#111111')}${colorField('Background', 'bg', '#ffffff')}${colorField('Border', 'border', '#111111')}</div>` +
        `<label class="check"><input type="checkbox" data-k="noBg" ${e.bg === 'none' ? 'checked' : ''}> No background</label><label class="check"><input type="checkbox" data-k="italic" ${e.italic ? 'checked' : ''}> Italic</label>`;
    } else if (e.kind === 'line') {
      html += field('Arrowheads', `<select data-k="head"><option value="end" ${e.head === 'end' ? 'selected' : ''}>At the end</option><option value="both" ${e.head === 'both' ? 'selected' : ''}>Both ends</option><option value="none" ${e.head === 'none' ? 'selected' : ''}>None (plain line)</option></select>`) +
        field(`Thickness <output>${e.width || 6}</output>`, `<input type="range" data-k="width" min="2" max="24" step="1" value="${e.width || 6}">`) +
        colorField('Colour', 'color', '#111111') + `<label class="check"><input type="checkbox" data-k="dash" ${e.dash ? 'checked' : ''}> Dashed</label>` +
        `<p class="muted small">Drag the end handles on the map to reposition the arrow.</p>`;
    } else if (e.kind === 'box') {
      html += `<div class="row">${colorField('Fill', 'fill', '#ffffff')}${colorField('Border', 'stroke', '#111111')}</div>` +
        field(`Fill opacity <output>${Math.round((e.fillOpacity == null ? 0.9 : e.fillOpacity) * 100)}%</output>`, `<input type="range" data-k="fillOpacity" min="0" max="1" step="0.05" value="${e.fillOpacity == null ? 0.9 : e.fillOpacity}">`) +
        field(`Border width <output>${e.strokeWidth == null ? 3 : e.strokeWidth}</output>`, `<input type="range" data-k="strokeWidth" min="0" max="16" step="1" value="${e.strokeWidth == null ? 3 : e.strokeWidth}">`) +
        field(`Corner radius <output>${e.radius == null ? 16 : e.radius}</output>`, `<input type="range" data-k="radius" min="0" max="120" step="2" value="${e.radius == null ? 16 : e.radius}">`) +
        `<label class="check"><input type="checkbox" data-k="dash" ${e.dash ? 'checked' : ''}> Dashed border</label>`;
    } else if (e.kind === 'icon') {
      html += `<h3>Icon</h3><div class="icon-tray" id="inspIcons"></div>` +
        field(`Size <output>${e.size || 120}</output>`, `<input type="range" data-k="size" min="40" max="400" step="4" value="${e.size || 120}">`) +
        `<div class="row">${colorField('Icon colour', 'color', '#1B2430')}${colorField('Disc colour', 'bgColor', '#ffffff')}</div>` +
        `<label class="check"><input type="checkbox" data-k="bg" ${e.bg !== false ? 'checked' : ''}> White disc behind icon</label>` +
        field('Caption (optional)', `<input data-k="caption" value="${esc(e.caption || '')}">`);
    }
    html += `<div class="actions"><button class="btn sm" id="inspDup">Duplicate</button><button class="btn sm" id="inspFront">Bring to front</button><button class="btn sm danger" id="inspDelete">Delete</button></div>`;
    host.innerHTML = html;
    $('#inspBack').onclick = () => select(null);
    host.querySelectorAll('[data-k]').forEach(inp => {
      const k = inp.dataset.k;
      const apply = () => {
        if (inp.type === 'checkbox') { if (k === 'noBg') e.bg = inp.checked ? 'none' : '#ffffff'; else e[k] = inp.checked; }
        else if (inp.type === 'range') { e[k] = +inp.value; const o = inp.previousElementSibling && inp.previousElementSibling.querySelector('output'); if (o) o.textContent = k === 'fillOpacity' ? Math.round(e[k] * 100) + '%' : inp.value; }
        else if (inp.tagName === 'SELECT') e[k] = isNaN(+inp.value) ? inp.value : (k === 'head' || k === 'align' ? inp.value : +inp.value);
        else e[k] = inp.value;
        render(); autosave();
      };
      inp.addEventListener(inp.type === 'checkbox' || inp.tagName === 'SELECT' ? 'change' : 'input', apply);
      inp.addEventListener('focus', () => snapshot());
    });
    if (e.kind === 'icon') buildIconTray($('#inspIcons'), e.icon, id => { snapshot(); e.icon = id; render(); buildInspector(); autosave(); });
    $('#inspDup').onclick = duplicateSelected;
    $('#inspFront').onclick = () => { snapshot(); state.elements = state.elements.filter(x => x !== e); state.elements.push(e); render(); autosave(); };
    $('#inspDelete').onclick = deleteSelected;
  }
  function buildIconTray(host, active, onPick) {
    host.innerHTML = '';
    Icons.list.forEach(ic => { const b = document.createElement('button'); b.type = 'button'; b.className = ic.id === active ? 'active' : ''; b.innerHTML = Icons.markup(ic.id, '#1B2430', 28) + `<span>${esc(ic.name)}</span>`; b.title = ic.name; b.onclick = () => { onPick(ic.id); host.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b)); }; host.appendChild(b); });
  }
  function deleteSelected() {
    if (!selection) return;
    snapshot();
    if (selection.kind === 'area') state.areas = state.areas.filter(a => a.id !== selection.id);
    else state.elements = state.elements.filter(e => e.id !== selection.id);
    select(null); render(); autosave(); toast('Deleted');
  }
  function duplicateSelected() {
    if (!selection) return;
    snapshot();
    const shift = ll => { const xy = toXY(ll.lon, ll.lat); return toLL(xy.x + 60, xy.y + 60); };
    if (selection.kind === 'area') {
      const a = clone(areaById(selection.id)); a.id = uid(); a.points = a.points.map(shift); if (a.label) a.label = shift(a.label); state.areas.push(a); select({ kind: 'area', id: a.id });
    } else {
      const e = clone(elementById(selection.id)); e.id = uid(); if (e.kind === 'line') { e.a = shift(e.a); e.b = shift(e.b); } else Object.assign(e, shift(e)); state.elements.push(e); select({ kind: 'element', id: e.id });
    }
    render(); autosave();
  }

  // =====================================================================
  // Left panel: template tabs, map details, framing, layers, icon tray
  // =====================================================================
  function buildTypeTabs() {
    const host = $('#typeTabs'); host.innerHTML = '';
    allTypes().forEach(t => { const b = document.createElement('button'); b.textContent = t.short || t.name; b.className = t.id === state.mapType ? 'active' : ''; b.onclick = () => switchType(t.id); host.appendChild(b); });
    $('#typeDesc').textContent = currentType().description || '';
  }
  function switchType(id) {
    if (id === state.mapType) return;
    const t = typeById(id);
    snapshot();
    state.mapType = id;
    // keep areas but drop categories that do not exist in the new type
    state.areas.forEach(a => { if (!t.categories.some(c => c.id === a.category)) a.category = null; a.label = null; });
    state.meta = Object.assign(defaultMeta(id), { issued: state.meta.issued, valid: state.meta.valid });
    state.layers.cities = t.base === 'terrain';
    select(null); buildTypeTabs(); buildMetaForm(); syncFrameControls(); render(); autosave();
  }
  function buildMetaForm() {
    const t = currentType(), m = state.meta, host = $('#metaForm');
    let html = '';
    if (t.titleMode === 'climate') {
      html += field('Month', `<select data-m="month">${MONTHS.map(x => `<option ${m.month === x ? 'selected' : ''}>${x}</option>`).join('')}<option value="" ${m.month === '' ? 'selected' : ''}>(none)</option></select>`) +
        field('Year', `<input data-m="year" value="${esc(m.year || '')}">`) +
        field('Variable', `<select data-m="variable">${['Rainfall', 'Temperature', 'Soil Moisture', 'Sunshine', 'Wind', 'Snowfall', 'Fire Danger', 'Outlook'].map(x => `<option ${m.variable === x ? 'selected' : ''}>${x}</option>`).join('')}</select>`) +
        field('Title override (optional)', `<input data-m="titleOverride" value="${esc(m.titleOverride || '')}" placeholder="${esc(computedTitle(t))}">`);
    } else if (t.titleMode === 'bar') {
      html += field('Date', `<input data-m="date" value="${esc(m.date || '')}" placeholder="DD/MM/YYYY">`) + field('Title override (optional)', `<input data-m="titleOverride" value="${esc(m.titleOverride || '')}" placeholder="${esc(computedTitle(t))}">`);
    } else if (t.titleMode === 'heading') {
      html += field('Heading', `<input data-m="title" value="${esc(m.title || '')}">`);
    }
    if (t.titleMode !== 'bar') html += field('Issued (optional)', `<input data-m="issued" value="${esc(m.issued || '')}" placeholder="e.g. 9am Mon 31 Aug">`) + field('Valid (optional)', `<input data-m="valid" value="${esc(m.valid || '')}" placeholder="e.g. Tue 1 – Thu 3 Sep">`);
    host.innerHTML = html || '<p class="muted small">No details needed for this template.</p>';
    host.querySelectorAll('[data-m]').forEach(inp => { inp.addEventListener('input', () => { m[inp.dataset.m] = inp.value; render(); autosave(); }); inp.addEventListener('change', () => { m[inp.dataset.m] = inp.value; render(); autosave(); }); inp.addEventListener('focus', () => snapshot()); });
  }
  function syncFrameControls() {
    $('#framePreset').value = state.frame.preset; $('#frameZoom').value = state.frame.zoom; $('#zoomOut').textContent = Math.round(state.frame.zoom * 100) + '%';
    $('#layerCities').checked = !!state.layers.cities; $('#layerLakes').checked = !!state.layers.lakes; $('#layerBorders').checked = !!state.layers.borders; $('#layerGraticule').checked = !!state.layers.graticule;
  }
  $('#framePreset').addEventListener('change', e => { snapshot(); state.frame.preset = e.target.value; state.frame.dx = 0; state.frame.dy = 0; render(); autosave(); });
  $('#frameZoom').addEventListener('input', e => { state.frame.zoom = +e.target.value; $('#zoomOut').textContent = Math.round(state.frame.zoom * 100) + '%'; render(); autosave(); });
  $('#frameZoom').addEventListener('pointerdown', () => snapshot());
  $$('[data-pan]').forEach(b => b.onclick = () => { snapshot(); if (b.dataset.pan === 'reset') { state.frame.dx = 0; state.frame.dy = 0; state.frame.zoom = 1; } else { const [dx, dy] = b.dataset.pan.split(',').map(Number); state.frame.dx += dx; state.frame.dy += dy; } syncFrameControls(); render(); autosave(); });
  [['layerCities', 'cities'], ['layerLakes', 'lakes'], ['layerBorders', 'borders'], ['layerGraticule', 'graticule']].forEach(([id, k]) => $('#' + id).addEventListener('change', e => { snapshot(); state.layers[k] = e.target.checked; render(); autosave(); }));
  $$('.tool').forEach(b => b.onclick = () => setTool(b.dataset.tool));
  buildIconTray($('#iconTray'), currentIcon, id => { currentIcon = id; });
  $('#zoomInBtn').onclick = () => zoomAt(1.25); $('#zoomOutBtn').onclick = () => zoomAt(1 / 1.25); $('#zoomFit').onclick = fitView;

  // =====================================================================
  // Keyboard
  // =====================================================================
  document.addEventListener('keydown', ev => {
    const inField = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if (ev.key === ' ' && !inField) { spaceDown = true; ev.preventDefault(); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { if (inField) return; ev.preventDefault(); ev.shiftKey ? redo() : undo(); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') { ev.preventDefault(); redo(); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); saveProject(); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'e') { ev.preventDefault(); exportImage('png'); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'd') { if (!inField) { ev.preventDefault(); duplicateSelected(); } return; }
    if (inField) { if (ev.key === 'Escape') document.activeElement.blur(); return; }
    if (activeView !== 'standard') return;
    switch (ev.key) {
      case 'Escape': if (tool === 'draw' && draft.length) cancelDraft(); else if (tool !== 'select') setTool('select', true); else { select(null); } break;
      case 'Enter': if (tool === 'draw' && draft.length >= 3) finishDraft(); break;
      case 'Backspace': if (tool === 'draw' && draft.length) { ev.preventDefault(); draft.pop(); render(); setHint(); } else if (selection) { ev.preventDefault(); deleteSelected(); } break;
      case 'Delete': if (selection) deleteSelected(); break;
      case 'd': case 'D': setTool('draw'); break;
      case 'v': case 'V': setTool('select'); break;
      case 't': case 'T': setTool('text'); break;
      case 'l': case 'L': setTool('line'); break;
      case 'b': case 'B': setTool('box'); break;
      case 'i': case 'I': setTool('icon'); break;
      case '+': case '=': zoomAt(1.25); break;
      case '-': zoomAt(1 / 1.25); break;
      case '0': fitView(); break;
      case 'ArrowUp': case 'ArrowDown': case 'ArrowLeft': case 'ArrowRight': if (selection) { ev.preventDefault(); nudge(ev.key, ev.shiftKey ? 20 : 4); } break;
      default:
        if (/^[1-9]$/.test(ev.key) && selection && selection.kind === 'area') { const t = currentType(), c = t.categories[+ev.key - 1]; if (c) { snapshot(); areaById(selection.id).category = c.id; render(); buildInspector(); autosave(); } }
    }
  });
  document.addEventListener('keyup', ev => { if (ev.key === ' ') spaceDown = false; });
  function nudge(key, step) {
    const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0, dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
    snapshot();
    if (selection.kind === 'area') { const a = areaById(selection.id); a.points = a.points.map(p => { const xy = toXY(p.lon, p.lat); return toLL(xy.x + dx, xy.y + dy); }); if (a.label) { const xy = toXY(a.label.lon, a.label.lat); a.label = toLL(xy.x + dx, xy.y + dy); } }
    else { const e = elementById(selection.id); moveElement(e, clone(e), dx, dy); }
    render(); autosave();
  }

  // =====================================================================
  // Export
  // =====================================================================
  let fontCss = null;
  async function getFontCss() {
    if (fontCss != null) return fontCss;
    try { const r = await fetch('css/fonts.css'); if (r.ok) { fontCss = await r.text(); return fontCss; } } catch (e) { /* file:// */ }
    try { for (const sh of document.styleSheets) { if (sh.href && /fonts\.css/.test(sh.href)) { fontCss = Array.from(sh.cssRules).map(r => r.cssText).join('\n'); return fontCss; } } } catch (e) { /* ignore */ }
    fontCss = ''; return fontCss;
  }
  async function buildExportSvg() {
    const out = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    out.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); out.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    out.setAttribute('viewBox', `0 0 ${W} ${H}`); out.setAttribute('width', W); out.setAttribute('height', H);
    render(out, { forExport: true });
    const css = await getFontCss();
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style'); style.textContent = css + `\ntext{font-family:${FONT};}`;
    out.insertBefore(style, out.firstChild);
    hits.clear(); render(); // restore interactive canvas hit map
    return new XMLSerializer().serializeToString(out);
  }
  function fileName(ext) { const t = currentType(); const d = new Date().toISOString().slice(0, 10); return `SIMA_${(t.short || t.name).replace(/\s+/g, '')}_${d}.${ext}`; }
  function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
  async function rasterise(scale, type) {
    const svgText = await buildExportSvg();
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('Could not render the map image')); img.src = url; });
    const c = document.createElement('canvas'); c.width = W * scale; c.height = H * scale;
    const ctx = c.getContext('2d');
    if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    return new Promise(res => c.toBlob(res, type, 0.94));
  }
  async function exportImage(kind) {
    closeMenus();
    const warn = state.areas.filter(a => !a.category).length;
    if (warn && !confirm(`${warn} area${warn > 1 ? 's have' : ' has'} no level chosen and will export with a grey hatch. Export anyway?`)) return;
    try {
      toast('Preparing export…');
      if (kind === 'svg') { download(new Blob([await buildExportSvg()], { type: 'image/svg+xml' }), fileName('svg')); }
      else if (kind === 'jpg') download(await rasterise(settings.exportScale || 1, 'image/jpeg'), fileName('jpg'));
      else if (kind === 'png2') download(await rasterise(2, 'image/png'), fileName('png'));
      else if (kind === 'copy') { const b = await rasterise(settings.exportScale || 1, 'image/png'); await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); toast('Copied to clipboard', 'ok'); return; }
      else download(await rasterise(settings.exportScale || 1, 'image/png'), fileName('png'));
      toast('Exported', 'ok');
    } catch (e) { console.error(e); toast('Export failed: ' + e.message, 'err'); }
  }
  $('#btnExport').onclick = ev => { ev.stopPropagation(); $('#exportMenu').hidden = !$('#exportMenu').hidden; };
  $$('#exportMenu button').forEach(b => b.onclick = () => exportImage(b.dataset.export));
  document.addEventListener('click', closeMenus);
  function closeMenus() { $('#exportMenu').hidden = true; }

  // =====================================================================
  // Project save / open / new
  // =====================================================================
  function saveProject() { download(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), fileName('json').replace('.json', '.sima.json')); toast('Project saved', 'ok'); }
  $('#btnSave').onclick = saveProject;
  $('#btnOpen').onclick = () => $('#openFile').click();
  $('#openFile').addEventListener('change', async ev => {
    const f = ev.target.files[0]; if (!f) return;
    try { const p = JSON.parse(await f.text()); if (!p.areas) throw new Error('not a map project'); snapshot(); state = normalise(p); select(null); buildTypeTabs(); buildMetaForm(); syncFrameControls(); render(); autosave(); toast('Project opened', 'ok'); }
    catch (e) { toast('Could not open file: ' + e.message, 'err'); }
    ev.target.value = '';
  });
  $('#btnNew').onclick = () => { if (state.areas.length || state.elements.length) { if (!confirm('Start a new blank map? The current map stays in your browser history (Undo) until you reload.')) return; } snapshot(); state = newProject(state.mapType); select(null); buildMetaForm(); syncFrameControls(); render(); autosave(); fitView(); };
  $('#btnUndo').onclick = undo; $('#btnRedo').onclick = redo;

  // =====================================================================
  // Views
  // =====================================================================
  let activeView = 'standard';
  function showView(v) {
    activeView = v;
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === v));
    ['standard', 'ai', 'settings'].forEach(x => { $('#view-' + x).hidden = x !== v; });
    const vp = $('#viewport');
    if (v === 'ai') { $('#aiCanvasHost').appendChild(vp); } else if (v === 'standard') { $('#canvasWrap').insertBefore(vp, $('#canvasWrap').firstChild); }
    if (v === 'settings') buildSettings();
    if (v === 'ai') { buildAiTypeSelect(); renderChat(); }
    if (v !== 'standard') { select(null); setTool('select', true); }
    render();
  }
  $$('.tab').forEach(t => t.onclick = () => showView(t.dataset.view));

  // =====================================================================
  // Toasts
  // =====================================================================
  function toast(msg, kind, action) {
    const t = document.createElement('div'); t.className = 'toast ' + (kind || '');
    t.innerHTML = esc(msg); if (action) { const b = document.createElement('button'); b.textContent = action.label; b.onclick = () => { action.fn(); t.remove(); }; t.appendChild(b); }
    const host = $('#toasts'); while (host.children.length >= 3) host.firstChild.remove();
    host.appendChild(t); setTimeout(() => t.remove(), action ? 8000 : 2600);
  }

  // =====================================================================
  // AI Map Creation
  // =====================================================================
  let chat = (() => { try { return JSON.parse(sessionStorage.getItem(CHAT_KEY) || '[]'); } catch (e) { return []; } })();
  let aiBusy = false;
  function saveChat() { try { sessionStorage.setItem(CHAT_KEY, JSON.stringify(chat)); } catch (e) { /* ignore */ } }
  function buildAiTypeSelect() { const s = $('#aiType'); s.innerHTML = allTypes().map(t => `<option value="${t.id}" ${t.id === state.mapType ? 'selected' : ''}>${esc(t.name)}</option>`).join(''); }
  $('#aiType').addEventListener('change', e => { if (e.target.value !== state.mapType) switchType(e.target.value); });
  function zoneNames() {
    const regions = NZ_GEO.regions.map(r => r.name);
    const zones = NZ_ZONES.map(z => z.name + (z.aliases ? ` (${z.aliases.slice(0, 4).join(', ')})` : ''));
    return { regions, zones };
  }
  function aiSystemPrompt(type) {
    const { regions, zones } = zoneNames();
    const cats = type.categories.map(c => `- id "${c.id}": ${c.name}`).join('\n');
    const hz = type.hazards ? `\nHazard chips available (use the exact key text; "detail" is free text such as "+500m" or "S" for a direction): ${Templates.HAZARDS.map(h => h.key).join(', ')}. Custom hazard keys are allowed when needed.` : '';
    return `You are the map-production assistant for the South Island Meteorological Agency (SIMA), a New Zealand weather service. A forecaster will paste or describe risk levels in words. Your job in chat is to make sure you understand exactly which areas get which category and hazards, then (when the forecaster presses "Plot on map", handled separately) the areas are drawn.

Template in use: ${type.name}.
Categories (lowest to highest):
${cats}${hz}

Geographic building blocks you can refer to (areas are built by combining these; the app follows their boundaries, lightly rounded):
Regional councils / districts (exact boundaries): ${regions.join('; ')}.
Forecast zones: ${zones.join('; ')}.
Towns and landmarks that can be used as reference points for relative locations ("south of Gore", "north of Rolleston", "east of Arthur's Pass"): ${NZ_GEO.places.filter(p => p.lat < -40.3).map(p => p.name).join(', ')}.
Relative wording is supported in the plot: an area can be limited to one side of a town (cuts), restricted to the coastal strip or to inland parts (band), and areas follow the coastline by default (clip "land"), with a wider offshore allowance for marine hazards (clip "coast") or no clipping. "Whole island" wording means the South Island.
You may also describe extra outline points as lon/lat for offshore extents (South Island spans roughly 166.4E–174.4E, 40.5S–47.3S).

How to behave in chat:
- Be concise and practical, like a colleague in a forecast office. Use New Zealand place names and macrons where usual (Kaikōura, Wānaka, Ōamaru).
- When the forecaster gives you their risk text, restate your understanding as a short bullet list: one bullet per area with category, hazards (with details such as snow level or wind direction) and the zones/regions it covers. Ask at most 2–3 focused questions only when something is genuinely ambiguous (e.g. which category, whether a coast or the ranges are meant, snow level). Otherwise say you are ready to plot.
- Smoothing: areas are drawn as lightly rounded shapes following the named boundaries. If the forecaster asks for no smoothing or sharp edges for an area, remember that for the plot.
- Do not output JSON or code in chat. Do not invent areas the forecaster did not mention.
- If asked general meteorology or wording questions, answer briefly and helpfully.`;
  }
  const PLAN_SCHEMA = {
    type: 'object', additionalProperties: false,
    properties: {
      title: { type: 'string', description: 'Optional heading or title text for the map' },
      meta: { type: 'object', additionalProperties: false, properties: { issued: { type: 'string' }, valid: { type: 'string' }, month: { type: 'string' }, year: { type: 'string' }, variable: { type: 'string' }, date: { type: 'string' } } },
      areas: {
        type: 'array', items: {
          type: 'object', additionalProperties: false,
          properties: {
            category: { type: 'string', description: 'category id from the template' },
            hazards: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { key: { type: 'string' }, detail: { type: 'string' } }, required: ['key'] } },
            zones: { type: 'array', items: { type: 'string' }, description: 'zone or regional council names from the list' },
            points: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { lon: { type: 'number' }, lat: { type: 'number' } }, required: ['lon', 'lat'] }, description: 'optional extra outline points (lon/lat) or the full outline when mode is points' },
            mode: { type: 'string', enum: ['zones', 'points'] },
            smooth: { type: 'boolean', description: 'false for sharp edges' },
            label: { type: 'string', description: 'optional custom label text (newline separated lines)' },
            cuts: { type: 'array', description: 'relative-location limits such as "south of Gore": keep only the part of the area on that side of the place', items: { type: 'object', additionalProperties: false, properties: { ref: { type: 'string', description: 'town or landmark name' }, side: { type: 'string', enum: ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest'] } }, required: ['ref', 'side'] } },
            band: { type: 'string', enum: ['none', 'coastal', 'inland'], description: 'coastal = only the coastal strip of the named zones; inland = away from the coast' },
            clip: { type: 'string', enum: ['land', 'coast', 'none'], description: 'land = follow the coastline with a small margin (default); coast = allow a wider offshore margin for marine hazards; none = no clipping' },
          }, required: ['category'],
        },
      },
      notes: { type: 'string' },
    }, required: ['areas'],
  };
  function renderChat() {
    const host = $('#chat'); host.innerHTML = '';
    if (!chat.length) { host.innerHTML = `<div class="msg system">Start by pasting your written risk levels. Claude will confirm which areas and levels it understood and ask if anything is unclear. ${AI.getKey() ? '' : '<b>No API key saved yet — add one in Settings.</b>'}</div>`; }
    chat.forEach(m => { const d = document.createElement('div'); d.className = 'msg ' + m.role + (m.error ? ' error' : ''); d.textContent = m.content; host.appendChild(d); });
    host.scrollTop = host.scrollHeight;
  }
  function pushChat(role, content, extra) { chat.push(Object.assign({ role, content }, extra || {})); saveChat(); renderChat(); }
  async function sendChat() {
    const ta = $('#chatText'), txt = ta.value.trim();
    if (!txt || aiBusy) return;
    if (!AI.getKey()) { toast('Add your Claude API key in Settings first', 'warn', { label: 'Settings', fn: () => showView('settings') }); return; }
    ta.value = ''; pushChat('user', txt);
    aiBusy = true; $('#aiStatus').textContent = 'Claude is thinking…'; $('#chatSend').disabled = true; $('#chatPlot').disabled = true;
    try {
      const reply = await AI.chat({ system: aiSystemPrompt(currentType()), messages: chat.filter(m => !m.error && (m.role === 'user' || m.role === 'assistant')).map(m => ({ role: m.role, content: m.content })), model: settings.model });
      pushChat('assistant', reply);
    } catch (e) { pushChat('assistant', 'Error: ' + e.message, { error: true }); }
    aiBusy = false; $('#aiStatus').textContent = ''; $('#chatSend').disabled = false; $('#chatPlot').disabled = false;
  }
  $('#chatSend').onclick = sendChat;
  $('#chatText').addEventListener('keydown', ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); sendChat(); } });
  $('#chatClear').onclick = () => { if (chat.length && !confirm('Clear this conversation?')) return; chat = []; saveChat(); renderChat(); };
  $('#chatPlot').onclick = plotFromChat;
  async function plotFromChat() {
    if (aiBusy) return;
    if (!AI.getKey()) { toast('Add your Claude API key in Settings first', 'warn', { label: 'Settings', fn: () => showView('settings') }); return; }
    const type = currentType();
    const history = chat.filter(m => !m.error && (m.role === 'user' || m.role === 'assistant'));
    const pending = $('#chatText').value.trim();
    if (!history.length && !pending) { toast('Describe the risk areas first', 'warn'); return; }
    if (pending) { $('#chatText').value = ''; pushChat('user', pending); history.push({ role: 'user', content: pending }); }
    aiBusy = true; $('#aiStatus').textContent = 'Plotting areas…'; $('#chatSend').disabled = true; $('#chatPlot').disabled = true;
    try {
      const sys = aiSystemPrompt(type) + `\n\nPLOTTING MODE: Produce the final plan as JSON for the app. For each area pick the category id, hazards, and the zones/regions it covers (use names from the lists; prefer regional councils when the forecaster names a whole region, otherwise forecast zones). Express relative wording with the modifiers: "south of Gore" -> cuts [{ref:"Gore", side:"south"}] on the zones/region mentioned (or on the whole South Island if none was named); "coastal Otago" -> zones ["Otago"], band "coastal"; "inland Canterbury" -> band "inland"; "north of Rolleston" -> cuts [{ref:"Rolleston", side:"north"}]. Combine several cuts for "between Timaru and Oamaru" (south of Timaru + north of Oamaru). Use clip "coast" for gales, swell and other marine hazards that extend offshore, "land" otherwise. Add "points" only for extents the zones and modifiers cannot express, or set mode "points" with a full 8–16 point outline when nothing fits. Set smooth to false only if the forecaster asked for sharp edges. Order areas from lowest to highest category so higher levels draw on top.`;
      const msgs = history.map(m => ({ role: m.role, content: m.content })).concat([{ role: 'user', content: 'Plot the areas now. Output the JSON plan only.' }]);
      const plan = await AI.json({ system: sys, messages: msgs, schema: PLAN_SCHEMA, model: settings.model });
      const result = applyPlan(plan, type);
      pushChat('system', `Plotted ${result.count} area${result.count === 1 ? '' : 's'}.` + (result.skipped.length ? ` Could not resolve: ${result.skipped.join(', ')}.` : '') + (plan.notes ? ` ${plan.notes}` : ''));
      toast('Areas plotted — fine-tune them in Standard', 'ok', { label: 'Open Standard', fn: () => showView('standard') });
    } catch (e) { pushChat('assistant', 'Error: ' + e.message, { error: true }); }
    aiBusy = false; $('#aiStatus').textContent = ''; $('#chatSend').disabled = false; $('#chatPlot').disabled = false;
  }
  const fold = s => String(s || '').toLowerCase().replace(/ā/g, 'a').replace(/ē/g, 'e').replace(/ī/g, 'i').replace(/ō/g, 'o').replace(/ū/g, 'u').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  function placeFor(name) {
    const n = fold(name);
    let p = NZ_GEO.places.find(q => fold(q.name) === n);
    if (!p) p = NZ_GEO.places.find(q => fold(q.name).startsWith(n) || n.startsWith(fold(q.name)));
    if (p) return { lon: p.lon, lat: p.lat };
    const zp = zonePolysFor(name);
    if (zp) { const pts = zp.flat(); return { lon: pts.reduce((a, q) => a + q[0], 0) / pts.length, lat: pts.reduce((a, q) => a + q[1], 0) / pts.length }; }
    return null;
  }
  let landPolysCache = null, landPolysKey = '';
  function landPolys() {
    const key = JSON.stringify(frame);
    if (landPolysCache && landPolysKey === key) return landPolysCache;
    landPolysKey = key; landPolysCache = NZ_GEO.regions.flatMap(r => r.rings.filter(rg => rg.length > 12).map(rg => rg.map(q => toXY(q[0], q[1]))));
    return landPolysCache;
  }
  function zonePolysFor(name) {
    const n = fold(name);
    if (/^(the )?(whole )?south island$/.test(n) || n === 'te waipounamu') return NZ_GEO.regions.filter(r => r.island === 'S').flatMap(r => r.rings.filter(rg => rg.length > 12).map(rg => rg.filter((p, i) => i % 2 === 0)));
    if (/^(the )?(whole )?north island$/.test(n)) return NZ_GEO.regions.filter(r => r.island === 'N').flatMap(r => r.rings.filter(rg => rg.length > 12).map(rg => rg.filter((p, i) => i % 2 === 0)));
    const reg = NZ_GEO.regions.find(r => { const f = fold(r.name); return f === n || f.replace(/ (district|city|regional council)$/, '') === n || (n === f.split(' ')[0] && f.length - n.length < 10 && !/^(west|bay)$/.test(n)); });
    if (reg) return reg.rings.filter(r => r.length > 12).map(r => r.filter((p, i) => i % 2 === 0));
    const z = NZ_ZONES.find(z => fold(z.name) === n || (z.aliases || []).some(a => fold(a) === n));
    if (z) return [z.pts];
    const z2 = NZ_ZONES.find(z => fold(z.name).includes(n) || n.includes(fold(z.name)) || (z.aliases || []).some(a => fold(a).includes(n) || n.includes(fold(a))));
    if (z2) return [z2.pts];
    const grp = NZ_ZONES.filter(z => fold(z.group) === n);
    if (grp.length) return grp.map(z => z.pts);
    return null;
  }
  function convexHull(pts) {
    const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    if (p.length < 3) return p;
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = []; for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
    const upper = []; for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
    upper.pop(); lower.pop(); return lower.concat(upper);
  }
  // Union of several polygons (canvas coords) via a raster mask, traced back
  // to an outline so the result follows the zone boundaries instead of a hull.
  function unionOutline(polys, cell, grow, mods) {
    cell = cell || 10; grow = grow == null ? 2 : grow; mods = mods || {};
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    polys.forEach(pl => pl.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }));
    const pad = (grow + 14) * cell;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const cols = Math.ceil((maxX - minX) / cell), rows = Math.ceil((maxY - minY) / cell);
    if (cols * rows > 400000) return convexHull(polys.flat());
    const cellPt = (r, c) => ({ x: minX + (c + 0.5) * cell, y: minY + (r + 0.5) * cell });
    const rasterise = plist => {
      const m = new Uint8Array(cols * rows);
      plist.forEach(pl => {
        const bb = Geo.bbox(pl);
        const r0 = Math.max(0, Math.floor((bb.minY - minY) / cell)), r1 = Math.min(rows - 1, Math.ceil((bb.maxY - minY) / cell));
        const c0 = Math.max(0, Math.floor((bb.minX - minX) / cell)), c1 = Math.min(cols - 1, Math.ceil((bb.maxX - minX) / cell));
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { if (!m[r * cols + c] && Geo.pointInPolygon(cellPt(r, c), pl)) m[r * cols + c] = 1; }
      });
      return m;
    };
    let mask = rasterise(polys);
    // "south of Gore" style cuts: drop cells on the far side of the reference point
    (mods.cuts || []).forEach(cut => {
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const p = cellPt(r, c); let keep = true;
        if (/north/.test(cut.side) && p.y > cut.y) keep = false;
        if (/south/.test(cut.side) && p.y < cut.y) keep = false;
        if (/east/.test(cut.side) && p.x < cut.x) keep = false;
        if (/west/.test(cut.side) && p.x > cut.x) keep = false;
        if (!keep) mask[r * cols + c] = 0;
      }
    });
    // dilate (grow) then erode (grow-1) -> closes gaps between touching zones
    const dil = (m, n) => { for (let k = 0; k < n; k++) { const o = new Uint8Array(m); for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { if (m[r * cols + c]) continue; if ((r && m[(r - 1) * cols + c]) || (r < rows - 1 && m[(r + 1) * cols + c]) || (c && m[r * cols + c - 1]) || (c < cols - 1 && m[r * cols + c + 1])) o[r * cols + c] = 1; } m = o; } return m; };
    const ero = (m, n) => { for (let k = 0; k < n; k++) { const o = new Uint8Array(m); for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { if (!m[r * cols + c]) continue; if (!r || !c || r === rows - 1 || c === cols - 1 || !m[(r - 1) * cols + c] || !m[(r + 1) * cols + c] || !m[r * cols + c - 1] || !m[r * cols + c + 1]) o[r * cols + c] = 0; } m = o; } return m; };
    // Grow the mask until the zones form one connected shape (bridges small
    // gaps between neighbouring zones), then shrink most of it back.
    const components = m => {
      const label = new Int32Array(cols * rows); let best = 0, bestN = 0, nLab = 0;
      for (let i = 0; i < m.length; i++) {
        if (!m[i] || label[i]) continue;
        nLab++; let n = 0; const st = [i]; label[i] = nLab;
        while (st.length) { const j = st.pop(); n++; const r = (j / cols) | 0, c = j % cols; [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([rr, cc]) => { if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) return; const k = rr * cols + cc; if (m[k] && !label[k]) { label[k] = nLab; st.push(k); } }); }
        if (n > bestN) { bestN = n; best = nLab; }
      }
      return { count: nLab, label, best };
    };
    const base = mask;
    let g = grow, result = null;
    for (; g <= grow + 10; g += 2) {
      const grown = dil(base, g + 2);
      const comp = components(grown);
      if (comp.count <= 1 || g >= grow + 10) { result = ero(grown, 2); if (comp.count > 1) { const c2 = components(result); for (let i = 0; i < result.length; i++) result[i] = c2.label[i] === c2.best ? 1 : 0; } break; }
    }
    mask = result;
    // land clipping and coastal / inland bands
    if (mods.land && (mods.clip !== 'none' || (mods.band && mods.band !== 'none'))) {
      const land = rasterise(mods.land);
      if (mods.band === 'coastal') { const inner = ero(land, 6); const coastal = land.map((v, i) => v && !inner[i] ? 1 : 0); const cz = dil(coastal, 2); for (let i = 0; i < mask.length; i++) if (!cz[i]) mask[i] = 0; }
      else if (mods.band === 'inland') { const inner = ero(land, 5); for (let i = 0; i < mask.length; i++) if (!inner[i]) mask[i] = 0; }
      if (mods.clip !== 'none') { const margin = mods.clip === 'coast' ? 8 : 2; const ld = dil(land, margin); for (let i = 0; i < mask.length; i++) if (!ld[i]) mask[i] = 0; }
      // soften the clipped edge and keep the largest piece
      mask = dil(ero(mask, 1), 1);
      const c3 = components(mask); if (c3.count > 1) for (let i = 0; i < mask.length; i++) mask[i] = c3.label[i] === c3.best ? 1 : 0;
    }
    // Moore-neighbour boundary trace, starting from the top-most left-most cell
    const at = (r, c) => r >= 0 && c >= 0 && r < rows && c < cols && mask[r * cols + c] === 1;
    let start = -1; for (let i = 0; i < mask.length; i++) if (mask[i]) { start = i; break; }
    if (start < 0) return convexHull(polys.flat());
    const sr = (start / cols) | 0, sc = start % cols;
    const dirs = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]]; // E SE S SW W NW N NE (clockwise)
    const ring = []; let r = sr, c = sc, dir = 6, guard = 0;
    do {
      ring.push({ x: minX + (c + 0.5) * cell, y: minY + (r + 0.5) * cell });
      let found = false;
      for (let k = 0; k < 8; k++) { const d = (dir + 6 + k) % 8; const rr = r + dirs[d][0], cc = c + dirs[d][1]; if (at(rr, cc)) { r = rr; c = cc; dir = d; found = true; break; } }
      if (!found) break;
      guard++;
    } while ((r !== sr || c !== sc) && guard < cols * rows * 4);
    return ring.length >= 3 ? ring : convexHull(polys.flat());
  }
  // Ramer–Douglas–Peucker simplification for closed rings.
  function simplifyRing(ring, eps) {
    if (ring.length < 6) return ring;
    const keep = new Uint8Array(ring.length); keep[0] = 1;
    const far = Math.max(...ring.map((p, i) => Geo.dist(p, ring[0]) * 1 + i * 0)); void far;
    let fi = 0, fd = 0; ring.forEach((p, i) => { const d = Geo.dist(p, ring[0]); if (d > fd) { fd = d; fi = i; } });
    keep[fi] = 1;
    const rdp = (a, b) => {
      let md = 0, mi = -1;
      for (let i = a + 1; i < b; i++) { const d = distToSeg(ring[i], ring[a], ring[b]); if (d > md) { md = d; mi = i; } }
      if (md > eps && mi > 0) { keep[mi] = 1; rdp(a, mi); rdp(mi, b); }
    };
    rdp(0, fi); const tail = ring.concat([ring[0]]);
    // second half: indices fi..n (wrapping to 0)
    (function () { let md = 0, mi = -1; for (let i = fi + 1; i < tail.length - 1; i++) { const d = distToSeg(tail[i], tail[fi], tail[tail.length - 1]); if (d > md) { md = d; mi = i; } } if (md > eps && mi > 0) { keep[mi] = 1; const sub = (a, b) => { let m2 = 0, i2 = -1; for (let i = a + 1; i < b; i++) { const d = distToSeg(tail[i], tail[a], tail[b]); if (d > m2) { m2 = d; i2 = i; } } if (m2 > eps && i2 > 0) { keep[i2] = 1; sub(a, i2); sub(i2, b); } }; sub(fi, mi); sub(mi, tail.length - 1); } })();
    return ring.filter((p, i) => keep[i]);
  }
  function applyPlan(plan, type) {
    type = type || currentType();
    const skipped = [], areas = [];
    computeFrame();
    (plan.areas || []).forEach(pa => {
      let cat = type.categories.find(c => c.id === pa.category) || type.categories.find(c => fold(c.name) === fold(pa.category)) || type.categories.find(c => fold(c.name).includes(fold(pa.category)));
      let pts = [];
      const zonePolys = [], extraPts = [];
      const useRaw = pa.mode === 'points' && pa.points && pa.points.length >= 3;
      const cuts = (pa.cuts || []).map(ct => { const ref = placeFor(ct.ref); if (!ref) { skipped.push(ct.ref); return null; } const xy = toXY(ref.lon, ref.lat); return { x: xy.x, y: xy.y, side: fold(ct.side).replace(/ /g, '') }; }).filter(Boolean);
      let zoneNames = (pa.zones || []).slice();
      if (!zoneNames.length && !useRaw && (cuts.length || (pa.band && pa.band !== 'none'))) zoneNames = ['South Island'];
      if (!useRaw) {
        zoneNames.forEach(z => { const zp = zonePolysFor(z); if (zp) zp.forEach(poly => { const cp = poly.map(q => toXY(q[0], q[1])); zonePolys.push(cp); pts.push(...cp); }); else skipped.push(z); });
        (pa.points || []).forEach(q => { const xy = toXY(q.lon, q.lat); extraPts.push(xy); pts.push(xy); });
      } else pts = pa.points.map(q => toXY(q.lon, q.lat));
      if (pts.length < 3) { if (!(pa.zones || []).length) skipped.push(pa.category); return; }
      let outline;
      if (useRaw) outline = pts;
      else {
        // union of the zone polygons (each zone's own outline, plus any extra
        // points as a small polygon of their own) traced back to a boundary
        const polys = zonePolys.slice();
        if (extraPts.length >= 3) polys.push(convexHull(extraPts));
        else if (extraPts.length) polys.push(convexHull(extraPts.concat(zonePolys.flat().slice(0, 2))));
        const marine = /gale|swell|wind|inundation|surf|sea/i.test(JSON.stringify(pa.hazards || []) + ' ' + (pa.category || ''));
        const clip = pa.clip || (marine ? 'coast' : 'land');
        outline = unionOutline(polys, 10, 2, { cuts, band: pa.band || 'none', clip, land: landPolys() });
        outline = simplifyRing(outline, 16);
        // cap the number of points so it stays easy to edit by hand
        const maxPts = 28;
        if (outline.length > maxPts) { const step = outline.length / maxPts; outline = Array.from({ length: maxPts }, (_, i) => outline[Math.floor(i * step)]); }
      }
      const a = { id: uid(), points: outline.map(p => toLL(p.x, p.y)), category: cat ? cat.id : null, hazards: (pa.hazards || []).map(h => ({ key: h.key, detail: h.detail || '' })), smooth: pa.smooth === false ? 0 : 0.7, label: null, showLabel: type.labels === 'arrow' || type.labels === 'optional', labelText: pa.label || null };
      if (!cat) skipped.push('category "' + pa.category + '"');
      areas.push(a);
    });
    if (!areas.length) throw new Error('No areas could be built from the plan' + (skipped.length ? ' (unknown: ' + skipped.join(', ') + ')' : ''));
    snapshot();
    if (state.areas.length && !confirm('Replace the existing areas on the map? Cancel to add the new areas alongside them.')) state.areas.push(...areas); else state.areas = areas;
    if (plan.meta) Object.keys(plan.meta).forEach(k => { if (plan.meta[k]) state.meta[k] = plan.meta[k]; });
    if (plan.title && type.titleMode === 'heading') state.meta.title = plan.title;
    select(null); buildMetaForm(); render(); autosave();
    return { count: areas.length, skipped: Array.from(new Set(skipped)) };
  }

  // =====================================================================
  // Settings view
  // =====================================================================
  function buildSettings() {
    $('#apiKey').value = AI.getKey();
    const ms = $('#apiModel'); ms.innerHTML = AI.MODELS.map(m => `<option value="${m.id}" ${m.id === settings.model ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
    $('#brandSite').value = settings.brand.site || '';
    $('#brandLogoPreview').hidden = !settings.brand.logoData; $('#brandLogoRemove').hidden = !settings.brand.logoData; if (settings.brand.logoData) $('#brandLogoPreview').src = settings.brand.logoData;
    $('#exportScale').value = String(settings.exportScale || 1); $('#showHints').checked = settings.showHints !== false; $('#autoLabels').checked = settings.autoLabels !== false;
    buildTypeList();
  }
  $('#apiSave').onclick = () => { const k = $('#apiKey').value.trim(); if (!k) return toast('Enter a key first', 'warn'); AI.setKey(k); settings.model = $('#apiModel').value; saveSettings(); $('#apiStatus').textContent = 'Saved on this device.'; toast('API key saved', 'ok'); };
  $('#apiModel').onchange = () => { settings.model = $('#apiModel').value; saveSettings(); };
  $('#apiClear').onclick = () => { AI.setKey(''); $('#apiKey').value = ''; $('#apiStatus').textContent = 'Key removed.'; };
  $('#apiTest').onclick = async () => { const k = $('#apiKey').value.trim(); if (k && k !== AI.getKey()) AI.setKey(k); $('#apiStatus').textContent = 'Testing…'; try { await AI.testKey($('#apiModel').value); $('#apiStatus').textContent = '✓ Connected to Claude.'; toast('Connection OK', 'ok'); } catch (e) { $('#apiStatus').textContent = '✗ ' + e.message; } };
  $('#brandSite').addEventListener('input', e => { settings.brand.site = e.target.value; saveSettings(); render(); });
  $('#brandLogo').addEventListener('change', ev => { const f = ev.target.files[0]; if (!f) return; if (f.size > 1500000) return toast('Logo must be under 1.5 MB', 'warn'); const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => { settings.brand.logoData = r.result; settings.brand.logoRatio = im.naturalWidth / im.naturalHeight; saveSettings(); buildSettings(); render(); toast('Logo updated', 'ok'); }; im.src = r.result; }; r.readAsDataURL(f); ev.target.value = ''; });
  $('#brandLogoRemove').onclick = () => { settings.brand.logoData = null; saveSettings(); buildSettings(); render(); };
  $('#exportScale').onchange = e => { settings.exportScale = +e.target.value; saveSettings(); };
  $('#showHints').onchange = e => { settings.showHints = e.target.checked; saveSettings(); setHint(); };
  $('#autoLabels').onchange = e => { settings.autoLabels = e.target.checked; saveSettings(); };
  $('#dataReset').onclick = () => { if (confirm('Reset the current map to blank?')) { snapshot(); state = newProject(state.mapType); select(null); buildMetaForm(); render(); autosave(); toast('Map reset'); } };
  $('#dataWipe').onclick = () => { if (confirm('Clear all saved maps, settings and your API key from this device?')) { localStorage.clear(); sessionStorage.clear(); AI.setKey(''); location.reload(); } };

  // ---- Map type manager -------------------------------------------------
  function buildTypeList() {
    const host = $('#typeList'); host.innerHTML = '';
    allTypes().forEach(t => {
      const d = document.createElement('div'); d.className = 'type-card';
      d.innerHTML = `<b>${esc(t.name)}</b>${t.builtin ? '<span class="tag">built-in</span>' : '<span class="tag">custom</span>'}<div class="sws">${t.categories.map(c => `<i style="background:${c.color}" title="${esc(c.name)}"></i>`).join('')}</div><p class="muted small">${esc(t.description || '')}</p><div class="row"><button class="btn sm" data-dup>Duplicate</button>${t.builtin ? '' : '<button class="btn sm" data-edit>Edit</button><button class="btn sm danger" data-del>Delete</button>'}</div>`;
      d.querySelector('[data-dup]').onclick = () => openTypeEditor(Object.assign(clone(t), { id: 'custom_' + uid(), builtin: false, name: t.name + ' (copy)', short: (t.short || t.name) + ' copy' }));
      const ed = d.querySelector('[data-edit]'); if (ed) ed.onclick = () => openTypeEditor(clone(t));
      const dl = d.querySelector('[data-del]'); if (dl) dl.onclick = () => { if (!confirm(`Delete map type "${t.name}"?`)) return; settings.customTypes = settings.customTypes.filter(x => x.id !== t.id); saveSettings(); if (state.mapType === t.id) switchType('outlook'); buildTypeList(); buildTypeTabs(); };
      host.appendChild(d);
    });
  }
  let editingType = null;
  function openTypeEditor(t) {
    editingType = t;
    $('#typeDialogTitle').textContent = settings.customTypes.some(x => x.id === t.id) ? 'Edit map type' : 'New map type';
    $('#tName').value = t.name || ''; $('#tShort').value = t.short || ''; $('#tBase').value = t.base || 'white'; $('#tTitle').value = (t.titleMode && t.titleMode !== 'none') ? 'heading' : 'none'; $('#tLegend').value = (t.legend === 'levels' || t.legend === 'panel') ? 'card' : (t.legend || 'card'); $('#tLabels').value = t.labels || 'arrow'; $('#tCatLabel').value = t.categoryLabel || ''; $('#tHazards').checked = !!t.hazards;
    renderCatRows(t.categories || []);
    $('#typeDialog').showModal();
  }
  function renderCatRows(cats) {
    const host = $('#tCats'); host.innerHTML = `<div class="cat-row cat-head"><span>Name</span><span>Colour</span><span>Opacity</span><span>Outline</span><span>Label suffix</span><span></span></div>`;
    cats.forEach((c, i) => {
      const r = document.createElement('div'); r.className = 'cat-row';
      r.innerHTML = `<input data-f="name" value="${esc(c.name)}" required><input type="color" data-f="color" value="${c.color || '#cccccc'}"><input type="number" data-f="opacity" min="0.1" max="1" step="0.01" value="${c.opacity == null ? 0.88 : c.opacity}"><select data-f="stroke"><option value="#111111" ${c.stroke && c.stroke !== 'none' ? 'selected' : ''}>Black</option><option value="none" ${!c.stroke || c.stroke === 'none' ? 'selected' : ''}>None</option></select><input data-f="suffix" value="${esc(c.suffix || '')}" placeholder="${esc(c.name)} Risk"><button type="button" class="x" title="Remove">✕</button>`;
      r.querySelector('.x').onclick = () => { cats.splice(i, 1); renderCatRows(cats); };
      host.appendChild(r);
    });
    host._cats = cats;
  }
  $('#tAddCat').onclick = () => { const cats = readCatRows(); cats.push({ id: 'c' + (cats.length + 1), name: 'New', color: '#60A5FA', opacity: 0.88, stroke: '#111111', strokeWidth: 3 }); renderCatRows(cats); };
  function readCatRows() {
    return Array.from($('#tCats').querySelectorAll('.cat-row:not(.cat-head)')).map((r, i) => {
      const g = f => r.querySelector(`[data-f="${f}"]`).value;
      const old = ($('#tCats')._cats || [])[i] || {};
      return { id: old.id || 'c' + (i + 1), name: g('name'), color: g('color'), opacity: +g('opacity'), stroke: g('stroke'), strokeWidth: g('stroke') === 'none' ? 0 : 3, suffix: g('suffix') || undefined };
    });
  }
  $('#tCancel').onclick = () => $('#typeDialog').close();
  $('#typeForm').addEventListener('submit', ev => {
    ev.preventDefault();
    const t = editingType || {};
    const cats = readCatRows().filter(c => c.name.trim());
    if (!cats.length) return toast('Add at least one category', 'warn');
    // ensure unique ids
    const seen = new Set(); cats.forEach(c => { let id = fold(c.name).replace(/ /g, '_') || c.id; while (seen.has(id)) id += '_'; seen.add(id); c.id = id; });
    Object.assign(t, { id: t.id && !t.builtin ? t.id : 'custom_' + uid(), builtin: false, name: $('#tName').value.trim(), short: $('#tShort').value.trim(), base: $('#tBase').value, titleMode: $('#tTitle').value, legend: $('#tLegend').value, labels: $('#tLabels').value, categoryLabel: $('#tCatLabel').value.trim() || 'Category', hazards: $('#tHazards').checked, categories: cats, description: t.description || `${cats.length} categories · ${$('#tBase').value} base` });
    if (!t.footer) t.footer = t.name;
    settings.customTypes = settings.customTypes.filter(x => x.id !== t.id).concat([t]); saveSettings();
    $('#typeDialog').close(); buildTypeList(); buildTypeTabs(); toast('Map type saved', 'ok', { label: 'Use it', fn: () => { showView('standard'); switchType(t.id); } });
  });
  $('#typeNew').onclick = () => openTypeEditor({ name: '', short: '', base: 'white', titleMode: 'heading', legend: 'card', labels: 'arrow', hazards: false, categoryLabel: 'Level', categories: [{ id: 'low', name: 'Low', color: '#FFF04A', opacity: 0.88, stroke: '#111111', strokeWidth: 3 }, { id: 'moderate', name: 'Moderate', color: '#F9A447', opacity: 0.88, stroke: '#111111', strokeWidth: 3 }, { id: 'high', name: 'High', color: '#F03B2E', opacity: 0.88, stroke: '#111111', strokeWidth: 3 }] });
  $('#typeAI').onclick = () => { if (!AI.getKey()) return toast('Save your Claude API key first', 'warn'); $('#aiTypeStatus').textContent = ''; $('#aiTypeDialog').showModal(); };
  $('#aiTypeCancel').onclick = () => $('#aiTypeDialog').close();
  $('#aiTypeGo').onclick = async () => {
    const p = $('#aiTypePrompt').value.trim(); if (!p) return;
    $('#aiTypeStatus').textContent = 'Asking Claude…'; $('#aiTypeGo').disabled = true;
    const schema = { type: 'object', additionalProperties: false, required: ['name', 'short', 'base', 'titleMode', 'legend', 'labels', 'hazards', 'categoryLabel', 'categories', 'description'], properties: { name: { type: 'string' }, short: { type: 'string' }, description: { type: 'string' }, base: { type: 'string', enum: ['white', 'terrain'] }, titleMode: { type: 'string', enum: ['none', 'heading'] }, legend: { type: 'string', enum: ['card', 'pills', 'none'] }, labels: { type: 'string', enum: ['arrow', 'number', 'optional', 'none'] }, hazards: { type: 'boolean' }, categoryLabel: { type: 'string' }, categories: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'color', 'opacity', 'outline'], properties: { name: { type: 'string' }, color: { type: 'string', description: '6-digit hex' }, opacity: { type: 'number' }, outline: { type: 'boolean' }, suffix: { type: 'string' } } } } } };
    try {
      const t = await AI.json({ system: 'You design map templates for a New Zealand weather agency\'s map tool. Return a template definition. Colours must be 6-digit hex, ordered from least to most severe, distinct and readable over a grey or green land base (opacities 0.55–0.92). "card" legend = the agency\'s standard rounded legend card with colour chips (use this unless asked otherwise); "pills" = row of colour pills along the bottom. titleMode "heading" puts a title top-right. "arrow" labels put text with an arrow beside each area; "number" labels put numbered badges. Keep names short.', messages: [{ role: 'user', content: p }], schema, model: settings.model });
      const cats = (t.categories || []).map((c, i) => ({ id: fold(c.name).replace(/ /g, '_') || 'c' + i, name: c.name, color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '#60A5FA', opacity: clamp(+c.opacity || 0.88, 0.1, 1), stroke: c.outline ? '#111111' : 'none', strokeWidth: c.outline ? 3 : 0, suffix: c.suffix || undefined }));
      $('#aiTypeDialog').close(); $('#aiTypeGo').disabled = false;
      openTypeEditor({ id: 'custom_' + uid(), builtin: false, name: t.name, short: t.short, description: t.description, base: t.base, titleMode: t.titleMode, legend: t.legend, labels: t.labels, hazards: !!t.hazards, categoryLabel: t.categoryLabel, categories: cats, footer: t.name });
    } catch (e) { $('#aiTypeStatus').textContent = 'Error: ' + e.message; $('#aiTypeGo').disabled = false; }
  };

  // =====================================================================
  // Init
  // =====================================================================
  function init() {
    buildTypeTabs(); buildMetaForm(); syncFrameControls(); applyView(); setTool('select', true); buildInspector(); updateUndoButtons();
    render();
    window.addEventListener('resize', () => render());
    if (!AI.getKey() && !localStorage.getItem('sima.welcomed')) { localStorage.setItem('sima.welcomed', '1'); setTimeout(() => toast('Welcome! Press D and click around an area on the map to start.', 'ok'), 400); }
  }
  // expose a little for debugging / tests
  window.SIMA = { get state() { return state; }, render, setTool, select, exportImage, applyPlan, switchType, showView, finishDraft: () => finishDraft(), get draft() { return draft; }, addDraftPoint, toXY: (lon, lat) => { computeFrame(); return toXY(lon, lat); }, toLL: (x, y) => { computeFrame(); return toLL(x, y); } };
  init();
})();
