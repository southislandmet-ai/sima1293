/* Geometry helpers: projection, smooth closed curves, hit-testing. */
(function () {
  'use strict';
  const D2R = Math.PI / 180;

  // Mercator helpers. `frame` = {cx, cy, scale} where cx/cy is the lon/lat
  // placed at the centre of the canvas and `scale` is px per mercator unit.
  function mercY(lat) { return Math.log(Math.tan(Math.PI / 4 + (lat * D2R) / 2)); }
  function project(lon, lat, frame, W, H) {
    const x = W / 2 + (lon - frame.cx) * D2R * frame.scale;
    const y = H / 2 - (mercY(lat) - mercY(frame.cy)) * frame.scale;
    return [x, y];
  }
  // Compute a frame that fits a lon/lat bbox into a pixel rect.
  function fitFrame(bbox, rect, W, H) {
    const [minLon, minLat, maxLon, maxLat] = bbox;
    const dx = (maxLon - minLon) * D2R;
    const dy = mercY(maxLat) - mercY(minLat);
    const scale = Math.min(rect.w / dx, rect.h / dy);
    // centre of the bbox in projected space should land at the rect centre.
    const midMerc = (mercY(maxLat) + mercY(minLat)) / 2;
    const cy = (2 * Math.atan(Math.exp(midMerc)) - Math.PI / 2) / D2R;
    const cxLon = (minLon + maxLon) / 2;
    // Shift so that the bbox centre maps to rect centre (not canvas centre).
    const rcx = rect.x + rect.w / 2, rcy = rect.y + rect.h / 2;
    const cx = cxLon - (rcx - W / 2) / (D2R * scale);
    const cyAdj = (2 * Math.atan(Math.exp(midMerc + (rcy - H / 2) / scale)) - Math.PI / 2) / D2R;
    return { cx, cy: cyAdj, scale };
  }

  // Closed Catmull-Rom spline -> cubic bezier SVG path. `k` controls
  // smoothness (0 = straight polygon, 1 = classic Catmull-Rom, >1 looser).
  function smoothClosedPath(pts, k) {
    const n = pts.length;
    if (n === 0) return '';
    if (n === 1) return `M${pts[0].x},${pts[0].y}`;
    if (n === 2) return `M${pts[0].x},${pts[0].y}L${pts[1].x},${pts[1].y}Z`;
    if (k <= 0) return 'M' + pts.map(p => `${p.x},${p.y}`).join('L') + 'Z';
    let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const c1x = p1.x + ((p2.x - p0.x) / 6) * k, c1y = p1.y + ((p2.y - p0.y) / 6) * k;
      const c2x = p2.x - ((p3.x - p1.x) / 6) * k, c2y = p2.y - ((p3.y - p1.y) / 6) * k;
      d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d + 'Z';
  }
  // Open version used while drawing (preview).
  function smoothOpenPath(pts, k) {
    const n = pts.length;
    if (n < 2) return n ? `M${pts[0].x},${pts[0].y}` : '';
    if (k <= 0) return 'M' + pts.map(p => `${p.x},${p.y}`).join('L');
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, n - 1)];
      const c1x = p1.x + ((p2.x - p0.x) / 6) * k, c1y = p1.y + ((p2.y - p0.y) / 6) * k;
      const c2x = p2.x - ((p3.x - p1.x) / 6) * k, c2y = p2.y - ((p3.y - p1.y) / 6) * k;
      d += `C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
    }
    return d;
  }

  // Sample the smooth closed curve into a dense polygon (for hit tests,
  // centroid and arrow anchoring).
  function sampleClosed(pts, k, perSeg) {
    const n = pts.length, out = [];
    if (n < 3) return pts.slice();
    perSeg = perSeg || 8;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const c1x = p1.x + ((p2.x - p0.x) / 6) * k, c1y = p1.y + ((p2.y - p0.y) / 6) * k;
      const c2x = p2.x - ((p3.x - p1.x) / 6) * k, c2y = p2.y - ((p3.y - p1.y) / 6) * k;
      for (let s = 0; s < perSeg; s++) {
        const t = s / perSeg, mt = 1 - t;
        const x = mt * mt * mt * p1.x + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * p2.x;
        const y = mt * mt * mt * p1.y + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * p2.y;
        out.push({ x, y });
      }
    }
    return out;
  }
  function pointInPolygon(pt, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
      const hit = (yi > pt.y) !== (yj > pt.y) && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
      if (hit) inside = !inside;
    }
    return inside;
  }
  function centroid(poly) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const f = poly[j].x * poly[i].y - poly[i].x * poly[j].y;
      a += f; cx += (poly[j].x + poly[i].x) * f; cy += (poly[j].y + poly[i].y) * f;
    }
    if (Math.abs(a) < 1e-6) {
      const n = poly.length;
      return { x: poly.reduce((s, p) => s + p.x, 0) / n, y: poly.reduce((s, p) => s + p.y, 0) / n };
    }
    a *= 0.5;
    return { x: cx / (6 * a), y: cy / (6 * a) };
  }
  function bbox(poly) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of poly) { if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y; }
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
  }
  // Nearest point on a polygon outline to a given point.
  function nearestOnOutline(pt, poly) {
    let best = null, bd = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[j], b = poly[i];
      const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
      let t = l2 ? ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      const x = a.x + t * dx, y = a.y + t * dy, d = (pt.x - x) ** 2 + (pt.y - y) ** 2;
      if (d < bd) { bd = d; best = { x, y }; }
    }
    return best;
  }
  // Point of a polygon's interior closest to a desired point, used so that the
  // arrow tip lands just inside the shape.
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  // Ring (lon/lat array) -> SVG path in canvas coordinates.
  function ringToPath(ring, frame, W, H) {
    let d = '';
    for (let i = 0; i < ring.length; i++) {
      const [x, y] = project(ring[i][0], ring[i][1], frame, W, H);
      d += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
    }
    return d + 'Z';
  }

  window.Geo = { project, fitFrame, mercY, smoothClosedPath, smoothOpenPath, sampleClosed, pointInPolygon, centroid, bbox, nearestOnOutline, dist, ringToPath };
})();
