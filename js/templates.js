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
      base: 'white', titleMode: 'none', legend: 'card', labels: 'arrow', hazards: true,
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
      base: 'white', titleMode: 'climate', legend: 'card', labels: 'optional', hazards: false,
      categoryLabel: 'Outlook class', footer: 'Climate Outlook',
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
      base: 'terrain', titleMode: 'bar', legend: 'card', labels: 'number', hazards: false,
      categoryLabel: 'Hazard',
      categories: [
        { id: 'rain', name: 'Heavy Rain', color: '#22E8FF', opacity: 0.55, stroke: '#111111', strokeWidth: 3 },
        { id: 'storm', name: 'Thunderstorms', color: '#A62BF0', opacity: 0.55, stroke: '#111111', strokeWidth: 3 },
        { id: 'snow', name: 'Heavy Snow', color: '#F2F2F2', opacity: 0.62, stroke: '#111111', strokeWidth: 3 },
        { id: 'gales', name: 'Severe Gales', color: '#21E321', opacity: 0.55, stroke: '#111111', strokeWidth: 3 },
      ],
      titleText: 'Weather Risks Today', footer: 'Weather Risks Today',
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
  // Always the agency's real logo: a custom upload from Settings if present,
  // otherwise the bundled SIMA banner. Drawn with rounded corners.
  function logo(parent, x, y, h, brand, idSuffix) {
    const src = brand.logoData || (window.SIMA_LOGO && window.SIMA_LOGO.src);
    if (!src) return null;
    const ratio = brand.logoData && brand.logoRatio ? brand.logoRatio : (window.SIMA_LOGO ? window.SIMA_LOGO.width / window.SIMA_LOGO.height : 4);
    const w = h * ratio;
    const defs = el('defs', null, parent);
    const cp = el('clipPath', { id: 'logoClip' + idSuffix }, defs);
    el('rect', { x, y, width: w, height: h, rx: h * 0.14, ry: h * 0.14 }, cp);
    const g = el('g', { 'clip-path': `url(#logoClip${idSuffix})` }, parent);
    el('image', { href: src, x, y, width: w, height: h, preserveAspectRatio: 'xMidYMid slice' }, g);
    return { x, y, w, h };
  }

  // ---- Chrome: legend card and headings ------------------------------------
  function roundedCard(parent, x, y, w, h, r, opts) {
    opts = opts || {};
    return el('rect', { x, y, width: w, height: h, rx: r, ry: r, fill: opts.fill || '#fff', stroke: opts.stroke || '#E2E8F0', 'stroke-width': opts.sw == null ? 2 : opts.sw, filter: opts.shadow ? 'url(#cardShadow)' : null }, parent);
  }
  function approxWidth(str, size, weight) { return str.length * size * (weight >= 600 ? 0.58 : 0.54); }

  // One legend design for every template: white card, title, colour chips.
  function legendCard(parent, type, brand, W, H) {
    const cats = type.categories;
    const pad = 36, chipH = 62, gap = 16, chipFont = 30;
    const chips = cats.map(c => ({ c, w: Math.max(190, approxWidth(c.name, chipFont, 600) + 48) }));
    // lay chips out in rows no wider than ~1050px
    const rows = [[]]; let rw = 0;
    chips.forEach(ch => { if (rw + ch.w + (rows[rows.length - 1].length ? gap : 0) > 1050 && rows[rows.length - 1].length) { rows.push([]); rw = 0; } rows[rows.length - 1].push(ch); rw += ch.w + gap; });
    const rowW = Math.max(...rows.map(r => r.reduce((s, ch) => s + ch.w, 0) + (r.length - 1) * gap));
    const title = type.footer || type.name;
    const w = Math.max(620, pad * 2 + rowW, pad * 2 + approxWidth(title, 34, 600));
    const h = pad + 44 + 18 + rows.length * (chipH + gap) + 44;
    const x = 48, y = H - h - 48;
    roundedCard(parent, x, y, w, h, 28, { shadow: true, sw: 0 });
    text(parent, x + pad, y + pad + 30, title, { 'font-size': 34, 'font-weight': 600, fill: '#1B2430', 'letter-spacing': -0.3 });
    let cy = y + pad + 62;
    rows.forEach(r => {
      let cx = x + pad;
      r.forEach(({ c, w: cw }) => {
        el('rect', { x: cx, y: cy, width: cw, height: chipH, rx: 16, fill: c.color, stroke: '#111', 'stroke-width': 1.5, 'stroke-opacity': 0.22 }, parent);
        text(parent, cx + cw / 2, cy + chipH / 2 + 11, c.name, { 'font-size': chipFont, 'font-weight': 600, fill: textColorFor(c.color), 'text-anchor': 'middle' });
        cx += cw + gap;
      });
      cy += chipH + gap;
    });
    text(parent, x + pad, y + h - 26, (type.categoryLabel || 'Risk level') + '  ·  low to high', { 'font-size': 22, fill: '#94A3B8', 'font-weight': 500 });
    text(parent, x + w - pad, y + h - 26, brand.site || 'sima.co.nz', { 'font-size': 24, 'font-weight': 600, fill: '#64748B', 'text-anchor': 'end' });
  }

  function legendPills(parent, type, W, H) {
    const cats = type.categories;
    const n = cats.length, pillW = 300, pillH = 26, gap = 26;
    const total = n * pillW + (n - 1) * gap;
    const x0 = (W - total) / 2, y = H - 64;
    cats.forEach((c, i) => {
      const x = x0 + i * (pillW + gap);
      text(parent, x + pillW / 2, y - 20, c.name, { 'font-size': 28, 'font-weight': 700, fill: '#1E3A5F', 'text-anchor': 'middle' });
      el('rect', { x, y, width: pillW, height: pillH, rx: 13, fill: c.color }, parent);
    });
  }

  // Heading in the top-right corner, matched to the base map.
  function heading(parent, type, meta, brand, W) {
    const title = meta.title || '';
    if (!title) return;
    const terrain = type.base === 'terrain';
    const sub = [meta.issued ? 'Issued ' + meta.issued : '', meta.valid ? 'Valid ' + meta.valid : ''].filter(Boolean).join('   ·   ') || (brand.site || 'sima.co.nz');
    // keep clear of the logo (top-left, ~640px wide): shrink the title to fit
    const maxW = W - 48 - 740;
    let fs = 72;
    while (fs > 40 && approxWidth(title, fs, 800) + 72 > maxW) fs -= 2;
    const tw = Math.min(maxW, Math.max(approxWidth(title, fs, 800), approxWidth(sub, 26, 500)) + 72);
    const x = W - 48 - tw, y = 40, h = 150;
    if (terrain) roundedCard(parent, x, y, tw, h, 28, { shadow: true, sw: 0 });
    text(parent, W - 48 - 36, y + 60 + fs * 0.3, title, { 'font-size': fs, 'font-weight': 800, fill: '#1D2B45', 'text-anchor': 'end', 'letter-spacing': -1.5 });
    text(parent, W - 48 - 36, y + 122, sub, { 'font-size': 26, 'font-weight': 500, fill: '#475569', 'text-anchor': 'end' });
  }
  function issuedLine(parent, type, meta, W, H) {
    if (!meta.issued && !meta.valid) return;
    const parts = [];
    if (meta.issued) parts.push('Issued ' + meta.issued);
    if (meta.valid) parts.push('Valid ' + meta.valid);
    const terrain = type.base === 'terrain';
    text(parent, W - 48, H - 44, parts.join('   ·   '), { 'font-size': 26, 'font-weight': 500, fill: terrain ? '#ffffff' : '#475569', 'text-anchor': 'end', stroke: terrain ? '#0B2545' : null, 'stroke-width': terrain ? 5 : null, 'paint-order': 'stroke' });
  }

  function renderChrome(parent, type, state, settings, W, H) {
    const brand = settings.brand || {};
    const suffix = '_c';
    logo(parent, 48, 40, 150, brand, suffix);
    if (type.titleMode && type.titleMode !== 'none') heading(parent, type, state.meta, brand, W);
    else issuedLine(parent, type, state.meta, W, H);
    if (type.legend === 'pills') legendPills(parent, type, W, H);
    else if (type.legend !== 'none') legendCard(parent, type, brand, W, H);
  }

  window.Templates = { MAP_TYPES, HAZARDS, FONT, el, text, textColorFor, logo, renderChrome };
})();
