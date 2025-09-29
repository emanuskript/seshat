# feature_extractor.py
"""
Line embeddings for scribe detection (fixed-dim):
- Central-band crop (focus on x-height)
- LBP (texture) -> length = P+2 (default 10)
- HOG (orientation histogram aggregated over blocks) -> length = orientations (default 9)
- Optional color stats on ink (Hue circular mean/var, Value mean/std) -> length = 5

Final embedding is [w_lbp*LBP || w_hog*HOG || w_color*COLOR] then global L2-normalized.
"""

from __future__ import annotations
import numpy as np
import cv2
from typing import Tuple, Optional
from skimage.feature import local_binary_pattern, hog

def _assert_fixed_length(name: str, vec: np.ndarray, expected: int = None) -> np.ndarray:
    """Debug helper to ensure vectors are fixed-length."""
    if vec.ndim != 1:
        vec = vec.ravel()
    if expected is not None and vec.size != expected:
        raise ValueError(f"{name} length {vec.size} != expected {expected}")
    return vec.astype(np.float32)

def _to_gray(img: np.ndarray) -> np.ndarray:
    if img.ndim == 3:
        return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return img

def _resize_keep_aspect(img: np.ndarray, target_h: int = 128,
                        max_w: int = 12000, max_upscale: float = 4.0) -> np.ndarray:
    """
    Resize to target height while preserving aspect ratio, but:
    - never up-scale by more than `max_upscale`
    - never let the resulting width exceed `max_w` (OpenCV remap limit safety)
    """
    h, w = img.shape[:2]
    if h <= 0 or w <= 0:
        return img

    # Desired scale to hit target_h
    scale = float(target_h) / float(h)

    # Cap crazy upscales (e.g., when band is ~12 px tall)
    if scale > max_upscale:
        scale = max_upscale
        target_h = max(1, int(round(h * scale)))

    # Proposed width at this scale
    new_w = max(1, int(round(w * scale)))

    # Keep width under safety cap; adjust height accordingly to preserve aspect
    if new_w > max_w:
        scale = float(max_w) / float(w)
        new_w = max_w
        target_h = max(1, int(round(h * scale)))

    interp = cv2.INTER_AREA if scale < 1.0 else cv2.INTER_CUBIC
    return cv2.resize(img, (new_w, target_h), interpolation=interp)

def _l1_normalize(v: np.ndarray, eps: float = 1e-8) -> np.ndarray:
    s = float(np.sum(np.abs(v))) + eps
    return (v / s).astype(np.float32)

def _l2_normalize(v: np.ndarray, eps: float = 1e-12) -> np.ndarray:
    n = float(np.linalg.norm(v) + eps)
    return (v / n).astype(np.float32)

def _moving_sum(y: np.ndarray, win: int) -> np.ndarray:
    if win <= 1:
        return y.copy()
    pad = win // 2
    yp = np.pad(y, (pad, pad), mode="reflect")
    k = np.ones(win, dtype=np.float64)
    return np.convolve(yp, k, mode="valid")

def central_band_coords(
    gray_line: np.ndarray,
    frac: float = 0.6,
    pad: int = 2,
    method: str = "maxsum",
    min_band_px: int = 12
) -> Tuple[int, int]:
    g = _to_gray(gray_line)
    H, _ = g.shape[:2]
    if H == 0:
        return 0, 0
    if frac is None or not (0.0 < frac <= 1.01):
        return 0, H

    band = int(round(max(min_band_px, frac * H)))
    band = min(band, H)

    if band >= H or method != "maxsum":
        center = H // 2
        top = max(0, center - band // 2)
        bot = min(H, top + band)
    else:
        ink = (255.0 - g.astype(np.float64))
        row_profile = ink.mean(axis=1)
        s = _moving_sum(row_profile, max(1, band))
        top = int(np.argmax(s))
        top = max(0, min(top, H - band))
        bot = top + band

    top = max(0, top - pad)
    bot = min(H, bot + pad)
    return top, bot

def central_band_crop(img: np.ndarray, frac: float = 0.6, pad: int = 2,
                      method: str = "maxsum", min_band_px: int = 12) -> np.ndarray:
    g = _to_gray(img)
    top, bot = central_band_coords(g, frac=frac, pad=pad, method=method, min_band_px=min_band_px)
    return g[top:bot, :]

def lbp_hist(img: np.ndarray, P: int = 8, R: int = 1, method: str = "uniform") -> np.ndarray:
    g = _to_gray(img)
    lbp = local_binary_pattern(g, P=P, R=R, method=method)
    bins = P + 2  # 'uniform' pattern count
    hist, _ = np.histogram(lbp.ravel(), bins=bins, range=(0, bins), density=False)
    return _l1_normalize(hist.astype(np.float32))

def _hog_orient_hist(
    g: np.ndarray,
    orientations: int = 9,
    pixels_per_cell: Tuple[int, int] = (16, 16),
    cells_per_block: Tuple[int, int] = (2, 2),
    transform_sqrt: bool = True,
    block_norm: str = "L2-Hys",
) -> np.ndarray:
    if g.size == 0:
        return np.zeros((orientations,), dtype=np.float32)
    
    try:
        feat = hog(
            g, 
            orientations=orientations,
            pixels_per_cell=pixels_per_cell,
            cells_per_block=cells_per_block,
            transform_sqrt=transform_sqrt,
            block_norm=block_norm,
            feature_vector=False,  # crucial
        )
        # skimage returns shape (n_blocks_row, n_blocks_col, cb_r, cb_c, orientations)
        if feat.ndim == 5 and feat.shape[-1] == orientations:
            orient_hist = feat.sum(axis=(0, 1, 2, 3))
        elif feat.ndim == 3 and feat.shape[-1] == orientations:
            orient_hist = feat.sum(axis=(0, 1))
        else:
            # Fallback: flatten then fold into orientations bins
            flat = feat.ravel().astype(np.float32)
            k = flat.size // orientations
            if k > 0:
                orient_hist = flat[:k * orientations].reshape(-1, orientations).sum(axis=0)
            else:
                orient_hist = np.zeros((orientations,), dtype=np.float32)
    except Exception:
        orient_hist = np.zeros((orientations,), dtype=np.float32)
    
    return _l1_normalize(orient_hist.astype(np.float32))

def hog_hist(
    img: np.ndarray,
    orientations: int = 9,
    pixels_per_cell: Tuple[int, int] = (8, 8),
    cells_per_block: Tuple[int, int] = (2, 2),
    transform_sqrt: bool = True,
    block_norm: str = "L2-Hys",
) -> np.ndarray:
    g = _to_gray(img)
    return _hog_orient_hist(
        g,
        orientations=orientations,
        pixels_per_cell=pixels_per_cell,
        cells_per_block=cells_per_block,
        transform_sqrt=transform_sqrt,
        block_norm=block_norm,
    )

def _ink_mask_from_gray(g: np.ndarray) -> np.ndarray:
    if g.size == 0:
        return np.zeros_like(g, dtype=bool)
    _, bw = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    ink = (bw == 0)
    ink = cv2.morphologyEx(ink.astype(np.uint8), cv2.MORPH_OPEN,
                           cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))).astype(bool)
    return ink

def color_stats_hv(color_band: np.ndarray, gray_band: np.ndarray) -> np.ndarray:
    H, W = gray_band.shape[:2]
    if gray_band.size == 0:
        return np.zeros((5,), dtype=np.float32)
    if color_band is None or color_band.ndim != 3 or color_band.shape[2] != 3:
        v = (gray_band.astype(np.float32) / 255.0).ravel()
        v_mean = float(v.mean()) if v.size else 0.0
        v_std = float(v.std()) if v.size else 0.0
        return np.array([0.0, 0.0, 0.0, v_mean, v_std], dtype=np.float32)

    # Guard against shape mismatch
    if color_band.shape[:2] != gray_band.shape[:2]:
        color_band = cv2.resize(color_band, (W, H), interpolation=cv2.INTER_AREA if color_band.shape[0] > H else cv2.INTER_CUBIC)

    hsv = cv2.cvtColor(color_band, cv2.COLOR_BGR2HSV)
    h = hsv[..., 0].astype(np.float32) * (2.0 * np.pi / 180.0)
    v = hsv[..., 2].astype(np.float32) / 255.0

    ink = _ink_mask_from_gray(gray_band)
    if not ink.any():
        return np.array([0.0, 0.0, 0.0, float(v.mean()), float(v.std())], dtype=np.float32)

    h_ink = h[ink]
    v_ink = v[ink]
    
    # Circular stats for hue
    h_cos = float(np.mean(np.cos(h_ink))) if h_ink.size else 0.0
    h_sin = float(np.mean(np.sin(h_ink))) if h_ink.size else 0.0
    h_var = float(1.0 - np.sqrt(h_cos**2 + h_sin**2)) if h_ink.size else 0.0
    
    # Value stats
    v_mean = float(v_ink.mean()) if v_ink.size else 0.0
    v_std = float(v_ink.std()) if v_ink.size else 0.0
    
    return np.array([h_cos, h_sin, h_var, v_mean, v_std], dtype=np.float32)

def _estimate_slant(g: np.ndarray) -> float:
    """Estimate dominant slant using HOG orientation."""
    # HOG to get dominant orientation, map around vertical 90°
    h = hog_hist(g)  # length = orientations
    step = 180.0 / len(h)
    ang = np.argmax(h) * step
    # convert to deviation from vertical (90 deg) -> negative = right, positive = left
    return float(ang - 90.0)

def _deskew_slant(g: np.ndarray, limit_deg: float = 20.0) -> np.ndarray:
    """Deskew slant by rotating the image."""
    angle = _estimate_slant(g)
    if abs(angle) < 2.0 or abs(angle) > limit_deg:  # ignore extreme noise
        return g
    h, w = g.shape[:2]
    M = cv2.getRotationMatrix2D((w//2, h//2), angle, 1.0)
    return cv2.warpAffine(g, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)

def _band_triplet(g: np.ndarray, frac_center=0.6, pad=2):
    """Extract center, ascender (upper), descender (lower) bands."""
    top, bot = central_band_coords(g, frac=frac_center, pad=pad, method="maxsum", min_band_px=12)
    H = g.shape[0]
    band_h = bot - top
    # ascender above center band
    a_top = max(0, top - band_h//2)
    a_bot = top
    # descender below center band
    d_top = bot
    d_bot = min(H, bot + band_h//2)
    return (g[top:bot, :], g[a_top:a_bot, :], g[d_top:d_bot, :])

def _gabor_feats(g: np.ndarray, scales=(3,5,7), thetas=(0,np.pi/6,np.pi/3,np.pi/2)):
    """Extract Gabor texture features."""
    if g.size == 0: 
        return np.zeros((len(scales)*len(thetas)*2,), np.float32)
    feats = []
    for k in scales:
        for t in thetas:
            kern = cv2.getGaborKernel((k*4+1, k*4+1), sigma=k, theta=t, lambd=k*3, gamma=0.5, psi=0)
            resp = cv2.filter2D(g, cv2.CV_32F, kern)
            feats += [float(resp.mean()), float(resp.std())]
    return _l1_normalize(np.array(feats, np.float32))

def _swt_stats(g: np.ndarray) -> np.ndarray:
    """Stroke-Width Transform statistics."""
    # cheap stroke-width proxy via distance transform on binarized ink
    _, bw = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY+cv2.THRESH_OTSU)
    ink = (bw==0).astype(np.uint8)
    dist = cv2.distanceTransform(255 - ink*255, cv2.DIST_L2, 3)  # distance in background
    # invert notion: stroke width ~ local min distance to background around ink edges
    edges = cv2.Canny(g, 50, 150)
    vals = dist[edges>0]
    if vals.size == 0: 
        return np.zeros((4,), np.float32)
    v = np.array([vals.mean(), vals.std(), np.percentile(vals, 25), np.percentile(vals, 75)], np.float32)
    return _l2_normalize(v)

def _band_embed(g_band: np.ndarray, use_color: bool, color_band: Optional[np.ndarray]) -> np.ndarray:
    """Extract fixed-length features from a single band with slant normalization."""
    if g_band.size == 0: 
        return np.zeros((24,), np.float32) if use_color else np.zeros((19,), np.float32)
    
    gb = _deskew_slant(_resize_keep_aspect(g_band, target_h=144))
    
    # Resize color band to match resized gray band
    cb = None
    if use_color and color_band is not None:
        cb = cv2.resize(
            color_band,
            (gb.shape[1], gb.shape[0]),
            interpolation=cv2.INTER_AREA if color_band.shape[0] > gb.shape[0] else cv2.INTER_CUBIC
        )
    
    parts = []
    # Fixed-length features only with assertions
    lbp_vec = _assert_fixed_length("LBP", lbp_hist(gb, P=8, R=1), expected=10)
    hog_vec = _assert_fixed_length("HOG", hog_hist(gb, orientations=9), expected=9)
    
    parts.append(lbp_vec)
    parts.append(hog_vec)
    
    if use_color and cb is not None:
        color_vec = _assert_fixed_length("COLOR", _l2_normalize(color_stats_hv(cb, gb)), expected=5)
        parts.append(color_vec)
    
    return _l2_normalize(np.concatenate(parts).astype(np.float32))

def line_embedding(
    line_img: np.ndarray,
    central_band_frac: Optional[float] = 0.6,
    central_band_pad: int = 2,
    resize_height: int = 144,
    use_color: bool = True,
    w_lbp: float = 1.0,
    w_hog: float = 1.2,
    w_color: float = 0.25,
    lbp_P: int = 8,
    lbp_R: int = 1,
    hog_orientations: int = 9,
    hog_pixels_per_cell: Tuple[int, int] = (8, 8),
    hog_cells_per_block: Tuple[int, int] = (2, 2),
) -> np.ndarray:
    """Extract multi-band line embedding with slant normalization."""
    # Get full gray image
    gray_full = _to_gray(line_img)
    H, W = gray_full.shape[:2]
    if H == 0 or W == 0:
        return np.zeros((1,), dtype=np.float32)
    
    # Get central band coordinates for reference
    if central_band_frac is not None and 0.0 < central_band_frac <= 1.01:
        top, bot = central_band_coords(gray_full, frac=central_band_frac,
                                       pad=central_band_pad, method="maxsum", min_band_px=12)
    else:
        top, bot = 0, H

    # NEW: three-band representation
    center, asc, desc = _band_triplet(gray_full, frac_center=central_band_frac or 0.6, pad=central_band_pad)
    
    # Color triplet slices (safe if None)
    color_band = line_img if (line_img.ndim == 3 and line_img.shape[2] == 3) else None
    if color_band is not None:
        c_center = color_band[top:bot, :]
        band_h = bot - top
        a_top = max(0, top - band_h//2)
        a_bot = top
        d_top = bot
        d_bot = min(H, bot + band_h//2)
        c_asc = color_band[a_top:a_bot, :]
        c_desc = color_band[d_top:d_bot, :]
    else:
        c_center = c_asc = c_desc = None

    # Extract features from each band using enhanced _band_embed
    parts = [
        _band_embed(center, use_color, c_center),
        _band_embed(asc,    use_color, c_asc),
        _band_embed(desc,   use_color, c_desc),
    ]
    
    # Debug: verify all parts have the same length
    sizes = [p.size for p in parts]
    if len(set(sizes)) > 1:
        raise ValueError(f"Band embedding size mismatch: {sizes}")
    
    # Concatenate and normalize
    emb = _l2_normalize(np.concatenate(parts).astype(np.float32))
    return emb
