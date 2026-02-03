/** Basic math/stat helpers used across features */

/** @param {number[]} values */
export function average(values) {
  const xs = (values || []).map(Number).filter((v) => !Number.isNaN(v));
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Population standard deviation */
export function stddev(values) {
  const xs = (values || []).map(Number).filter((v) => !Number.isNaN(v));
  if (!xs.length) return 0;
  const mu = average(xs);
  const varPop = xs.reduce((acc, v) => acc + (v - mu) ** 2, 0) / xs.length;
  return Math.sqrt(varPop);
}

/** Mode (smallest if multimodal). Returns "No mode" if none. */
export function mode(values) {
  const xs = (values || []).map(Number).filter((v) => !Number.isNaN(v));
  if (!xs.length) return "No mode";
  const freq = {};
  xs.forEach((v) => (freq[v] = (freq[v] || 0) + 1));
  const maxF = Math.max(...Object.values(freq));
  if (maxF === 1) return "No mode";
  const modes = Object.keys(freq).filter((k) => freq[k] === maxF).map(Number);
  return Math.min(...modes);
}

export function formatPoints(points) {
  return (points || []).map(({ x, y }) => `${x},${y}`).join(" ");
}

export function calculateAngle(p1, p2, p3) {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const m1 = Math.sqrt(v1.x ** 2 + v1.y ** 2);
  const m2 = Math.sqrt(v2.x ** 2 + v2.y ** 2);
  if (m1 === 0 || m2 === 0) return 0;
  const cos = Math.min(1, Math.max(-1, dot / (m1 * m2)));
  return ((Math.acos(cos) * 180) / Math.PI);
}

/**
 * Generate SVG path data for calligraphic stroke (variable width based on direction)
 * @param {Array} points - [{x, y}, ...]
 * @param {number} penWidth - Minimum stroke width (parallel to nib)
 * @param {number} penHeight - Maximum stroke width (perpendicular to nib)
 * @param {number} nibAngle - Nib angle in degrees (0-90)
 * @returns {string} SVG path 'd' attribute
 */
export function generateCalligraphicPath(points, penWidth, penHeight, nibAngle) {
  if (!points || points.length < 2) return '';

  const nibRad = ((nibAngle ?? 45) * Math.PI) / 180;
  const minW = penWidth || 2;
  const maxW = penHeight || minW;

  const leftEdge = [];
  const rightEdge = [];

  for (let i = 0; i < points.length; i++) {
    const p = points[i];

    // Calculate direction at this point (use neighboring points)
    let dx, dy;
    if (i === 0) {
      dx = points[1].x - p.x;
      dy = points[1].y - p.y;
    } else if (i === points.length - 1) {
      dx = p.x - points[i - 1].x;
      dy = p.y - points[i - 1].y;
    } else {
      // Average direction from neighbors for smoother result
      dx = points[i + 1].x - points[i - 1].x;
      dy = points[i + 1].y - points[i - 1].y;
    }

    // Calculate stroke width based on angle difference
    const segmentAngle = Math.atan2(dy, dx);
    const angleDiff = segmentAngle - nibRad;
    const strokeWidth = minW + (maxW - minW) * Math.abs(Math.sin(angleDiff));
    const halfWidth = strokeWidth / 2;

    // Calculate perpendicular offset vector
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len;  // Perpendicular normal x
    const ny = dx / len;   // Perpendicular normal y

    // Add points to left and right edges
    leftEdge.push({ x: p.x + nx * halfWidth, y: p.y + ny * halfWidth });
    rightEdge.push({ x: p.x - nx * halfWidth, y: p.y - ny * halfWidth });
  }

  // Build closed path: left edge forward, right edge backward
  let d = `M ${leftEdge[0].x.toFixed(2)} ${leftEdge[0].y.toFixed(2)}`;
  for (let i = 1; i < leftEdge.length; i++) {
    d += ` L ${leftEdge[i].x.toFixed(2)} ${leftEdge[i].y.toFixed(2)}`;
  }
  for (let i = rightEdge.length - 1; i >= 0; i--) {
    d += ` L ${rightEdge[i].x.toFixed(2)} ${rightEdge[i].y.toFixed(2)}`;
  }
  d += ' Z';

  return d;
}

/**
 * Generate array of polygon points for canvas rendering
 * Same algorithm as generateCalligraphicPath but returns point array
 * @param {Array} points - [{x, y}, ...]
 * @param {number} penWidth - Minimum stroke width
 * @param {number} penHeight - Maximum stroke width
 * @param {number} nibAngle - Nib angle in degrees
 * @param {number} scaleX - X scale factor for canvas
 * @param {number} scaleY - Y scale factor for canvas
 * @returns {Array} Array of {x, y} points forming closed polygon
 */
export function generateCalligraphicPolygon(points, penWidth, penHeight, nibAngle, scaleX = 1, scaleY = 1) {
  if (!points || points.length < 2) return [];

  const nibRad = ((nibAngle ?? 45) * Math.PI) / 180;
  const minW = penWidth || 2;
  const maxW = penHeight || minW;

  const leftEdge = [];
  const rightEdge = [];

  for (let i = 0; i < points.length; i++) {
    const p = points[i];

    let dx, dy;
    if (i === 0) {
      dx = points[1].x - p.x;
      dy = points[1].y - p.y;
    } else if (i === points.length - 1) {
      dx = p.x - points[i - 1].x;
      dy = p.y - points[i - 1].y;
    } else {
      dx = points[i + 1].x - points[i - 1].x;
      dy = points[i + 1].y - points[i - 1].y;
    }

    const segmentAngle = Math.atan2(dy, dx);
    const angleDiff = segmentAngle - nibRad;
    const strokeWidth = minW + (maxW - minW) * Math.abs(Math.sin(angleDiff));
    const halfWidth = strokeWidth / 2;

    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    leftEdge.push({
      x: (p.x + nx * halfWidth) * scaleX,
      y: (p.y + ny * halfWidth) * scaleY
    });
    rightEdge.push({
      x: (p.x - nx * halfWidth) * scaleX,
      y: (p.y - ny * halfWidth) * scaleY
    });
  }

  // Combine: left edge forward + right edge backward
  return [...leftEdge, ...rightEdge.reverse()];
}
