# feature_extractor.py
"""
Line embeddings for scribe detection (fixed-dim):
- Central-band crop (focus on x-height) + ascender/descender bands
- LBP (texture) -> length = P+2 (default 10)
- HOG (orientation histogram aggregated over blocks) -> length = orientations (default 9)
- Optional color stats on ink (Hue circular mean/var, Value mean/std) -> length = 5

Final embedding is [ (w_lbp*LBP || w_hog*HOG || w_color*COLOR) ] for each band,
concatenated over the 3 bands, then global L2-normalized.

This is a drop-in replacement that remains backward-compatible with callers that
pass w_lbp, w_hog, and w_color keyword arguments.
"""

from __future__ import annotations
import numpy as np
import cv2
from typing import Tuple, Optional

# Optional skimage import with graceful fallback
try:
    from skimage.feature import local_binary_pattern, hog
    _HAS_SKIMAGE = True
except Exception:
    _HAS_SKIMAGE = False
    local_binary_pattern = None
    hog = None

__all__ = [
    "central_band_coords",
    "central_band_crop",
    "lbp_hist",
    "hog_hist",
    "color_stats_hv",
    "line_embedding",
]

# --------------------------- small utilities ---------------------------

def _to_gray(img: np.ndarray) -> np.ndarray:
    if img is None or img.size == 0:
        return np.zeros((0, 0), dtype=np.uint8)
    if img.ndim == 3:
        g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        g = img
    if g.dtype != np.uint8:
        g = cv2.normalize(g, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    return g


def _l1_normalize(v: np.ndarray, eps: float = 1e-8) -> np.ndarray:
    v = np.asarray(v, dtype=np.float32).ravel()
    s = float(np.sum(np.abs(v)))
    if s < eps:
        return np.zeros_like(v, dtype=np.float32)
    return (v / s).astype(np.float32)


def _l2_normalize(v: np.ndarray, eps: float = 1e-12) -> np.ndarray:
    v = np.asarray(v, dtype=np.float32).ravel()
    n = float(np.linalg.norm(v))
    if n < eps:
        return np.zeros_like(v, dtype=np.float32)
    return (v / n).astype(np.float32)


def _moving_sum(y: np.ndarray, win: int) -> np.ndarray:
    if win <= 1:
        return y.astype(np.float64)
    pad = win // 2
    yp = np.pad(y.astype(np.float64), (pad, pad), mode="reflect")
    k = np.ones(win, dtype=np.float64)
    return np.convolve(yp, k, mode="valid")


def _resize_keep_aspect(img: np.ndarray, target_h: int = 144,
                        max_w: int = 16000, max_upscale: float = 4.0) -> np.ndarray:
    """
    Resize to target height while preserving aspect ratio, but:
    - never up-scale by more than `max_upscale`
    - never let the resulting width exceed `max_w` (OpenCV remap limit safety)
    """
    if img is None or img.size == 0:
        return np.zeros((0, 0), dtype=np.uint8)
    h, w = img.shape[:2]
    if h <= 0 or w <= 0:
        return np.zeros((0, 0), dtype=np.uint8)

    scale = float(target_h) / float(h)
    if scale > max_upscale:
        scale = max_upscale
        target_h = max(1, int(round(h * scale)))

    new_w = max(1, int(round(w * scale)))
    if new_w > max_w:
        scale = float(max_w) / float(w)
        new_w = max_w
        target_h = max(1, int(round(h * scale)))

    interp = cv2.INTER_AREA if scale < 1.0 else cv2.INTER_CUBIC
    try:
        return cv2.resize(img, (new_w, target_h), interpolation=interp)
    except Exception:
        # Last-ditch: return original
        return img


# --------------------------- band selection ---------------------------

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
    if not (0.0 < float(frac) <= 1.01):
        return 0, H

    band = int(round(max(min_band_px, float(frac) * H)))
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


# --------------------------- feature extractors ---------------------------

def lbp_hist(img: np.ndarray, P: int = 8, R: int = 1, method: str = "uniform") -> np.ndarray:
    if img is None or img.size == 0 or not _HAS_SKIMAGE:
        return np.zeros((P + 2,), dtype=np.float32)
    g = _to_gray(img)
    try:
        lbp = local_binary_pattern(g, P=P, R=R, method=method)
        bins = P + 2  # 'uniform' pattern count
        hist, _ = np.histogram(lbp.ravel(), bins=bins, range=(0, bins), density=False)
        return _l1_normalize(hist.astype(np.float32))
    except Exception:
        return np.zeros((P + 2,), dtype=np.float32)


def _hog_orient_hist(
    g: np.ndarray,
    orientations: int = 9,
    pixels_per_cell: Tuple[int, int] = (8, 8),
    cells_per_block: Tuple[int, int] = (2, 2),
    transform_sqrt: bool = True,
    block_norm: str = "L2-Hys",
) -> np.ndarray:
    """
    Aggregate HOG over the whole image into a single orientation histogram.
    Robust to tiny images by falling back to zeros.
    """
    if g is None or g.size == 0 or not _HAS_SKIMAGE:
        return np.zeros((orientations,), dtype=np.float32)

    # Ensure image is at least one cell
    gh, gw = g.shape[:2]
    min_h = pixels_per_cell[0] * max(1, cells_per_block[0])
    min_w = pixels_per_cell[1] * max(1, cells_per_block[1])
    if gh < min_h or gw < min_w:
        scale = max(min_h / max(1, gh), min_w / max(1, gw))
        try:
            g = cv2.resize(g, (max(1, int(round(gw * scale))), max(1, int(round(gh * scale)))), interpolation=cv2.INTER_CUBIC)
        except Exception:
            return np.zeros((orientations,), dtype=np.float32)

    try:
        feat = hog(
            g,
            orientations=orientations,
            pixels_per_cell=pixels_per_cell,
            cells_per_block=cells_per_block,
            transform_sqrt=transform_sqrt,
            block_norm=block_norm,
            feature_vector=False,  # we will aggregate manually
        )
        # skimage returns shape (n_blocks_row, n_blocks_col, cb_r, cb_c, orientations)
        if feat.ndim == 5 and feat.shape[-1] == orientations:
            orient_hist = feat.sum(axis=(0, 1, 2, 3))
        elif feat.ndim == 3 and feat.shape[-1] == orientations:
            orient_hist = feat.sum(axis=(0, 1))
        else:
            flat = feat.ravel().astype(np.float32)
            k = max(1, flat.size // orientations)
            orient_hist = flat[:k * orientations].reshape(-1, orientations).sum(axis=0)
    except Exception:
        return np.zeros((orientations,), dtype=np.float32)

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
    if g is None or g.size == 0:
        return np.zeros_like(g, dtype=bool)
    try:
        _, bw = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    except Exception:
        # Fallback fixed threshold
        _, bw = cv2.threshold(g, 128, 255, cv2.THRESH_BINARY)
    ink = (bw == 0)
    try:
        ink = cv2.morphologyEx(ink.astype(np.uint8), cv2.MORPH_OPEN,
                               cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))).astype(bool)
    except Exception:
        ink = ink.astype(bool)
    return ink


def color_stats_hv(color_band: np.ndarray, gray_band: np.ndarray) -> np.ndarray:
    """
    Returns [h_cos, h_sin, h_var, v_mean, v_std] restricted to ink pixels.
    If color is missing, returns zeros for hue and V stats from grayscale.
    """
    g = _to_gray(gray_band)
    H, W = g.shape[:2]
    if H == 0 or W == 0:
        return np.zeros((5,), dtype=np.float32)

    if color_band is None or color_band.ndim != 3 or color_band.shape[2] != 3:
        v = (g.astype(np.float32) / 255.0).ravel()
        v_mean = float(v.mean()) if v.size else 0.0
        v_std = float(v.std()) if v.size else 0.0
        return np.array([0.0, 0.0, 0.0, v_mean, v_std], dtype=np.float32)

    # Guard against shape mismatch
    if color_band.shape[:2] != g.shape[:2]:
        try:
            color_band = cv2.resize(color_band, (W, H), interpolation=cv2.INTER_AREA if color_band.shape[0] > H else cv2.INTER_CUBIC)
        except Exception:
            return np.zeros((5,), dtype=np.float32)

    try:
        hsv = cv2.cvtColor(color_band, cv2.COLOR_BGR2HSV)
        h = hsv[..., 0].astype(np.float32) * (2.0 * np.pi / 180.0)
        v = hsv[..., 2].astype(np.float32) / 255.0
    except Exception:
        # Fallback: approximate V from gray
        v = (g.astype(np.float32) / 255.0)
        return np.array([0.0, 0.0, 0.0, float(v.mean()), float(v.std())], dtype=np.float32)

    ink = _ink_mask_from_gray(g)
    if not ink.any():
        return np.array([0.0, 0.0, 0.0, float(v.mean()), float(v.std())], dtype=np.float32)

    h_ink = h[ink]
    v_ink = v[ink]

    # Circular stats for hue
    if h_ink.size:
        h_cos = float(np.mean(np.cos(h_ink)))
        h_sin = float(np.mean(np.sin(h_ink)))
        h_var = float(1.0 - np.sqrt(h_cos**2 + h_sin**2))
    else:
        h_cos = h_sin = h_var = 0.0

    # Value stats
    v_mean = float(v_ink.mean()) if v_ink.size else 0.0
    v_std = float(v_ink.std()) if v_ink.size else 0.0

    return np.array([h_cos, h_sin, h_var, v_mean, v_std], dtype=np.float32)


# --------------------------- slant helpers ---------------------------

def _estimate_slant(g: np.ndarray) -> float:
    """Estimate dominant slant using HOG orientation deviation from vertical (90°)."""
    h = hog_hist(g)  # length = orientations
    if h.size == 0:
        return 0.0
    step = 180.0 / float(len(h))
    ang = np.argmax(h) * step
    # convert to deviation from vertical (90 deg) -> negative = right, positive = left
    return float(ang - 90.0)


def _deskew_slant(g: np.ndarray, limit_deg: float = 20.0) -> np.ndarray:
    """Deskew slant by rotating the image around its center."""
    if g is None or g.size == 0:
        return g
    angle = _estimate_slant(g)
    if abs(angle) < 2.0 or abs(angle) > limit_deg:  # ignore extreme noise
        return g
    h, w = g.shape[:2]
    M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
    try:
        return cv2.warpAffine(g, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    except Exception:
        return g


# --------------------------- band embedding ---------------------------

def _band_embed(
    g_band: np.ndarray,
    use_color: bool,
    color_band: Optional[np.ndarray],
    lbp_P: int = 8,
    lbp_R: int = 1,
    hog_orientations: int = 9,
    hog_pixels_per_cell: Tuple[int, int] = (8, 8),
    hog_cells_per_block: Tuple[int, int] = (2, 2),
    resize_height: int = 144,
    w_lbp: float = 1.0,
    w_hog: float = 1.0,
    w_color: float = 0.25
) -> np.ndarray:
    """
    Extract fixed-length features from a single band with slant normalization.
    Returns a vector of length:
      10 (LBP) + 9 (HOG) + (5 if use_color) = 19 or 24
    Weights scale the respective blocks before concatenation.
    """
    if g_band is None or g_band.size == 0:
        return np.zeros((24,), np.float32) if use_color else np.zeros((19,), np.float32)

    gb = _deskew_slant(_resize_keep_aspect(_to_gray(g_band), target_h=resize_height))

    cb = None
    if use_color and color_band is not None:
        try:
            cb = cv2.resize(
                color_band,
                (gb.shape[1], gb.shape[0]),
                interpolation=cv2.INTER_AREA if color_band.shape[0] > gb.shape[0] else cv2.INTER_CUBIC
            )
        except Exception:
            cb = None

    parts = []
    lbp_vec = lbp_hist(gb, P=lbp_P, R=lbp_R)                     # 10
    hog_vec = _hog_orient_hist(                                  # 9
        gb,
        orientations=hog_orientations,
        pixels_per_cell=hog_pixels_per_cell,
        cells_per_block=hog_cells_per_block
    )

    parts.append((w_lbp * lbp_vec).astype(np.float32))
    parts.append((w_hog * hog_vec).astype(np.float32))

    if use_color and cb is not None:
        color_vec = _l2_normalize(color_stats_hv(cb, gb)).astype(np.float32)  # 5
        parts.append((w_color * color_vec).astype(np.float32))

    emb = np.concatenate(parts).astype(np.float32)
    return _l2_normalize(emb)


# --------------------------- public API ---------------------------

def line_embedding(
    line_img: np.ndarray,
    central_band_frac: Optional[float] = 0.6,
    central_band_pad: int = 2,
    resize_height: int = 144,
    use_color: bool = True,
    # compatibility weights (accepted and applied)
    w_lbp: float = 1.0,
    w_hog: float = 1.0,
    w_color: float = 0.25,
    # extractor params
    lbp_P: int = 8,
    lbp_R: int = 1,
    hog_orientations: int = 9,
    hog_pixels_per_cell: Tuple[int, int] = (8, 8),
    hog_cells_per_block: Tuple[int, int] = (2, 2),
    **_ignored_kwargs,  # absorb any extra legacy kwargs safely
) -> np.ndarray:
    """
    Extract multi-band line embedding with slant normalization.
    Output shape is fixed:
      3 bands * (10 + 9 [+ 5 if use_color]) → 57 (no color) or 72 (with color)
    """
    gray_full = _to_gray(line_img)
    H, W = gray_full.shape[:2]
    if H == 0 or W == 0:
        return np.zeros((1,), dtype=np.float32)

    # Determine central band
    if central_band_frac is not None and 0.0 < float(central_band_frac) <= 1.01:
        top, bot = central_band_coords(
            gray_full, frac=float(central_band_frac),
            pad=int(central_band_pad), method="maxsum", min_band_px=12
        )
    else:
        top, bot = 0, H

    # Build three bands
    center = gray_full[top:bot, :]
    band_h = bot - top
    a_top = max(0, top - band_h // 2)
    a_bot = top
    d_top = bot
    d_bot = min(H, bot + band_h // 2)
    asc = gray_full[a_top:a_bot, :]
    desc = gray_full[d_top:d_bot, :]

    # Color counterparts (optional)
    color = line_img if (line_img is not None and line_img.ndim == 3 and line_img.shape[2] == 3) else None
    if color is not None:
        c_center = color[top:bot, :]
        c_asc = color[a_top:a_bot, :]
        c_desc = color[d_top:d_bot, :]
    else:
        c_center = c_asc = c_desc = None

    # Extract per-band features (apply weights)
    parts = [
        _band_embed(center, use_color, c_center,
                    lbp_P, lbp_R, hog_orientations, hog_pixels_per_cell, hog_cells_per_block,
                    resize_height, w_lbp, w_hog, w_color),
        _band_embed(asc,    use_color, c_asc,
                    lbp_P, lbp_R, hog_orientations, hog_pixels_per_cell, hog_cells_per_block,
                    resize_height, w_lbp, w_hog, w_color),
        _band_embed(desc,   use_color, c_desc,
                    lbp_P, lbp_R, hog_orientations, hog_pixels_per_cell, hog_cells_per_block,
                    resize_height, w_lbp, w_hog, w_color),
    ]

    # Ensure all parts are same length
    sizes = [p.size for p in parts]
    if len(set(sizes)) > 1:
        m = min(sizes)
        parts = [p[:m] if p.size >= m else np.pad(p, (0, m - p.size), mode="constant") for p in parts]

    emb = np.concatenate(parts).astype(np.float32)
    return _l2_normalize(emb)
