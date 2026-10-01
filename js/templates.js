/* Map types (templates), logo and chrome (legend, titles) rendering. */
(function () {
  'use strict';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const FONT = "'Poppins', 'Segoe UI', Arial, sans-serif";

  // ---- Built-in map types -------------------------------------------------
  // Colours sampled from the agency's existing graphics, slightly cleaned up.
  const MAP_TYPES = [
    {
      id: 'outlook', builtin: true,
      name: 'Significant Weather Outlook',
      short: 'Outlook',
      description: 'Risk areas with hazard labels and arrows. Slight (yellow), Enhanced (orange), High (red).',
      base: 'white', titleMode: 'none', legend: 'levels', labels: 'arrow', hazards: true,
      categoryLabel: 'Risk level',
      categories: [
        { id: 'slight', name: 'Slight', suffix: 'Slight Risk', color: '#FFF04A', opacity: 0.88, stroke: '#111111', strokeWidth: 3 },
        { id: 'enhanced', name: 'Enhanced', suffix: 'Enhanced Risk', color: '#F9A447', opacity: 0.88, stroke: '#111111', strokeWidth: 3 },
        { id: 'high', name: 'High', suffix: 'High Risk', color: '#F03B2E', opacity: 0.88, stroke: '#111111', strokeWidth: 3 },
      ],
      footer: 'Significant Weather Outlook',
    },
    {
      id: 'climate', builtin: true,
      name: 'Climate Outlook',
      short: 'Climate',
      description: 'Monthly / seasonal rainfall or temperature outlook with five probability classes.',
      base: 'white', titleMode: 'climate', legend: 'pills', labels: 'optional', hazards: false,
      categoryLabel: 'Outlook class',
      categories: [
        { id: 'below', name: 'Below Normal', color: '#C84A08', opacity: 0.92, stroke: 'none', strokeWidth: 0 },
        { id: 'sbelow', name: 'Near or Slightly Below', color: '#F8C06C', opacity: 0.92, stroke: 'none', strokeWidth: 0 },
        { id: 'equal', name: 'Equal Chances', color: '#D1D5DB', opacity: 0.92, stroke: 'none', strokeWidth: 0 },
        { id: 'sabove', name: 'Near or Slightly Above', color: '#BFE0FF', opacity: 0.92, stroke: 'none', strokeWidth: 0 },
        { id: 'above', name: 'Above Normal', color: '#2457C5', opacity: 0.92, stroke: 'none', strokeWidth: 0 },
      ],
    },
    {
      id: 'risks', builtin: true,
      name: 'Weather Risks Today',
      short: 'Risks Today',
      description: 'Daily hazard map on a terrain base with numbered areas and a hazard legend.',
      base: 'terrain', titleMode: 'bar', legend: 'panel', labels: 'number', hazards: false,
      categoryLabel: 'Hazard',
      categories: [
        { id: 'rain', name: 'Heavy Rain', color: '#22E8FF', opacity: 0.55, stroke: '#111111', strokeWidth: 3 },
        { id: 'storm', name: 'Thunderstorms', color: '#A62BF0', opacity: 0.55, stroke: '#111111', strokeWidth: 3 },
        { id: 'snow', name: 'Heavy Snow', color: '#F2F2F2', opacity: 0.62, stroke: '#111111', strokeWidth: 3 },
        { id: 'gales', name: 'Severe Gales', color: '#21E321', opacity: 0.55, stroke: '#111111', strokeWidth: 3 },
      ],
      titleText: 'Weather Risks Today',
    },
  ];

  // Hazard chips available on the Outlook template.
  const HAZARDS = [
    { key: 'Heavy Rain' }, { key: 'Heavy Snow', detail: '+500m', detailHint: 'Elevation, e.g. +500m' },
    { key: 'Severe Gales', detail: 'S', detailHint: 'Direction, e.g. NW' }, { key: 'Thunderstorms' },
    { key: 'Strong Winds', detail: '', detailHint: 'Direction (optional)' }, { key: 'Heavy Swell' },
    { key: 'Snow to Low Levels' }, { key: 'Severe Frost' }, { key: 'Dense Fog' }, { key: 'Large Hail' },
    { key: 'Damaging Winds' }, { key: 'Extreme Heat' }, { key: 'Coastal Inundation' },
  ];

  // ---- SVG helpers --------------------------------------------------------
  function el(name, attrs, parent) {
    const e = document.createElementNS(SVG_NS, name);
    if (attrs) for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, str, attrs) {
    const t = el('text', Object.assign({ x, y, 'font-family': FONT }, attrs), parent);
    t.textContent = str;
    return t;
  }
  function textColorFor(hex) {
    // Dark text on light swatches, white text on dark ones.
    const c = hex.replace('#', '');
    if (c.length < 6) return '#111';
    const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.62 ? '#1B2430' : '#FFFFFF';
  }

  // ---- Logo ---------------------------------------------------------------
  // Vector redraw of the SIMA drop mark: a large drop with a bite taken from
  // its upper-right shoulder, plus two small drops rising above it.
  function logoMark(parent, x, y, size, idSuffix) {
    const g = el('g', { transform: `translate(${x},${y}) scale(${size / 100})` }, parent);
    const defs = el('defs', null, g);
    const grad = el('linearGradient', { id: 'simaGrad' + idSuffix, x1: '0', y1: '0', x2: '0.6', y2: '1' }, defs);
    el('stop', { offset: '0', 'stop-color': '#3D9BE9' }, grad);
    el('stop', { offset: '1', 'stop-color': '#0E3B6E' }, grad);
    const mask = el('mask', { id: 'simaMask' + idSuffix }, defs);
    el('rect', { x: -10, y: -10, width: 120, height: 120, fill: '#fff' }, mask);
    el('circle', { cx: 72, cy: 38, r: 26, fill: '#000' }, mask);
    const fill = `url(#simaGrad${idSuffix})`;
    // main body: circle at (50,62) r 38 with bite removed
    el('circle', { cx: 50, cy: 62, r: 38, fill, mask: `url(#simaMask${idSuffix})` }, g);
    // two small drops
    el('path', { d: 'M36 4 C36 4 24 20 24 28 a12 12 0 0 0 24 0 C48 20 36 4 36 4Z', fill: '#2E8FD8' }, g);
    el('path', { d: 'M66 12 C66 12 56 24 56 31 a10 10 0 0 0 20 0 C76 24 66 12 66 12Z', fill: '#2E8FD8' }, g);
    return g;
  }
  function logoFull(parent, x, y, brand, scale, idSuffix) {
    const g = el('g', { transform: `translate(${x},${y}) scale(${scale})` }, parent);
    if (brand.logoData) {
      el('image', { href: brand.logoData, x: 0, y: 0, width: 640, height: 200, preserveAspectRatio: 'xMinYMid meet' }, g);
      return g;
    }
    logoMark(g, 0, 0, 180, idSuffix);
    text(g, 200, 100, brand.line1 || 'South Island', { 'font-size': 76, 'font-weight': 600, fill: '#1F2937', 'letter-spacing': -1 });
    text(g, 202, 148, brand.line2 || 'Meteorological Agency', { 'font-size': 34, 'font-weight': 500, fill: '#2E8FD8', 'letter-spacing': 0.5 });
    return g;
  }

  // ---- Chrome: legends and titles ----------------------------------------
  function roundedCard(parent, x, y, w, h, r, opts) {
    opts = opts || {};
    return el('rect', { x, y, width: w, height: h, rx: r, ry: r, fill: opts.fill || '#fff', stroke: opts.stroke || '#E2E8F0', 'stroke-width': opts.sw == null ? 2 : opts.sw, filter: opts.shadow ? 'url(#cardShadow)' : null }, parent);
  }

  function legendLevels(parent, type, brand, W, H) {
    // Modern card: title, rounded level chips, website.
    const cats = type.categories;
    const chipW = 150, chipH = 48, gap = 14, pad = 32;
    const title = type.footer || type.name;
    const titleW = title.length * 17; // approximate (Poppins 600 @ 30px)
    const w = Math.max(560, pad * 2 + cats.length * chipW + (cats.length - 1) * gap, pad * 2 + titleW), h = 176;
    const x = 48, y = H - h - 48;
    roundedCard(parent, x, y, w, h, 26, { shadow: true });
    text(parent, x + pad, y + 52, title, { 'font-size': 30, 'font-weight': 600, fill: '#1B2430' });
    const cy = y + 80;
    cats.forEach((c, i) => {
      const cx = x + pad + i * (chipW + gap);
      el('rect', { x: cx, y: cy, width: chipW, height: chipH, rx: 14, fill: c.color, stroke: '#111', 'stroke-width': 1.5, 'stroke-opacity': 0.25 }, parent);
      text(parent, cx + chipW / 2, cy + 33, c.name, { 'font-size': 24, 'font-weight': 600, fill: textColorFor(c.color), 'text-anchor': 'middle' });
    });
    text(parent, x + pad, y + h - 22, (type.categoryLabel || 'Risk level') + ' — low to high', { 'font-size': 20, fill: '#94A3B8', 'font-weight': 400 });
    text(parent, x + w - pad, y + h - 22, brand.site || 'sima.co.nz', { 'font-size': 22, 'font-weight': 500, fill: '#64748B', 'text-anchor': 'end' });
  }

  function legendPills(parent, type, W, H) {
    const cats = type.categories;
    const n = cats.length, pillW = 300, pillH = 24, gap = 26;
    const total = n * pillW + (n - 1) * gap;
    const x0 = (W - total) / 2, y = H - 60;
    cats.forEach((c, i) => {
      const x = x0 + i * (pillW + gap);
      text(parent, x + pillW / 2, y - 18, c.name, { 'font-size': 27, 'font-weight': 700, fill: '#1E3A5F', 'text-anchor': 'middle' });
      el('rect', { x, y, width: pillW, height: pillH, rx: 12, fill: c.color }, parent);
    });
  }

  function legendPanel(parent, type, brand, W, H, idSuffix) {
    const cats = type.categories;
    const rowH = 92, pad = 36;
    const w = 440, h = pad * 2 + cats.length * rowH + 150;
    const x = W - w - 40, y = H - h - 40;
    roundedCard(parent, x, y, w, h, 28, { shadow: true, sw: 0 });
    cats.forEach((c, i) => {
      const ry = y + pad + i * rowH;
      el('rect', { x: x + pad, y: ry + 12, width: 56, height: 56, rx: 14, fill: c.color, stroke: '#111', 'stroke-width': 1.5, 'stroke-opacity': 0.3 }, parent);
      text(parent, x + pad + 80, ry + 52, c.name, { 'font-size': 32, 'font-weight': 500, fill: '#1B2430' });
    });
    // compact logo
    const ly = y + h - 130;
    if (brand.logoData) {
      el('image', { href: brand.logoData, x: x + pad, y: ly, width: w - pad * 2, height: 110, preserveAspectRatio: 'xMidYMid meet' }, parent);
    } else {
      logoMark(parent, x + pad, ly + 6, 96, idSuffix);
      text(parent, x + pad + 112, ly + 54, brand.line1 || 'South Island', { 'font-size': 42, 'font-weight': 600, fill: '#1F2937' });
      text(parent, x + pad + 113, ly + 84, brand.line2 || 'Meteorological Agency', { 'font-size': 19, 'font-weight': 500, fill: '#2E8FD8' });
    }
  }

  function titleClimate(parent, meta, brand, W, H, idSuffix) {
    if (brand.logoData) el('image', { href: brand.logoData, x: 48, y: 40, width: 200, height: 200, preserveAspectRatio: 'xMinYMin meet' }, parent);
    else logoMark(parent, 60, 36, 200, idSuffix);
    const title = meta.title || '';
    text(parent, 290, 128, title, { 'font-size': 84, 'font-weight': 800, fill: '#1D2B45', 'letter-spacing': -1.5 });
    text(parent, 294, 180, brand.site || 'sima.co.nz', { 'font-size': 30, 'font-weight': 500, fill: '#334155' });
  }

  function titleBar(parent, meta, W) {
    el('rect', { x: 0, y: 0, width: W, height: 96, fill: '#fff' }, parent);
    text(parent, W / 2, 64, meta.title || '', { 'font-size': 54, 'font-weight': 500, fill: '#111', 'text-anchor': 'middle' });
  }

  function issuedLine(parent, meta, W, H) {
    if (!meta.issued && !meta.valid) return;
    const parts = [];
    if (meta.issued) parts.push('Issued ' + meta.issued);
    if (meta.valid) parts.push('Valid ' + meta.valid);
    text(parent, W - 48, H - 40, parts.join('   ·   '), { 'font-size': 24, 'font-weight': 500, fill: '#475569', 'text-anchor': 'end' });
  }

  function renderChrome(parent, type, state, settings, W, H) {
    const brand = settings.brand || {};
    const suffix = '_c';
    if (type.titleMode === 'climate') titleClimate(parent, state.meta, brand, W, H, suffix);
    else if (type.titleMode === 'bar') titleBar(parent, state.meta, W);
    else if (type.titleMode === 'heading') {
      logoFull(parent, 44, 28, brand, 1, suffix);
      text(parent, W - 48, 100, state.meta.title || '', { 'font-size': 52, 'font-weight': 700, fill: '#1D2B45', 'text-anchor': 'end' });
    } else logoFull(parent, 44, 28, brand, 1, suffix);

    if (type.legend === 'levels') legendLevels(parent, type, brand, W, H);
    else if (type.legend === 'pills') legendPills(parent, type, W, H);
    else if (type.legend === 'panel') legendPanel(parent, type, brand, W, H, suffix);
    if (type.titleMode !== 'bar') issuedLine(parent, state.meta, W, H);
  }

  window.Templates = { MAP_TYPES, HAZARDS, FONT, el, text, textColorFor, logoMark, logoFull, renderChrome };
})();
