# pre_processor.py
"""
Preprocessing for manuscript pages:
1) Grayscale
2) Illumination/background correction
3) Small-angle deskew (±5°)
4) Sauvola adaptive binarization
5) Light denoise (ink-preserving)

Primary entry point: preprocess(bgr_img) -> bw uint8 (0 or 255)
"""

from __future__ import annotations
import cv2
import numpy as np
from typing import Tuple

try:
    from skimage.filters import threshold_sauvola
    _HAS_SAUVOLA = True
except Exception:
    _HAS_SAUVOLA = False


__all__ = [
    "to_gray",
    "illumination_correct",
    "deskew_small",
    "binarize_sauvola",
    "preprocess",
]


def _ensure_odd(n: int, minimum: int = 3) -> int:
    n = int(max(n, minimum))
    return n if (n % 2 == 1) else (n + 1)


def to_gray(img: np.ndarray) -> np.ndarray:
    """Convert BGR/RGB to single-channel grayscale (uint8)."""
    if img is None or img.size == 0:
        return np.zeros((0, 0), dtype=np.uint8)
    if img.ndim == 3:
        g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        g = img
    if g.dtype != np.uint8:
        g = cv2.normalize(g, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    return g


def _auto_kernel_size(shape: Tuple[int, int], frac: float = 0.035,
                      min_ks: int = 21, max_ks: int = 151) -> int:
    """
    Choose an odd kernel size as a fraction of the smaller image dimension.
    Good defaults for background estimation on manuscript scans.
    """
    if len(shape) < 2 or shape[0] == 0 or shape[1] == 0:
        return _ensure_odd(min_ks)
    h, w = int(shape[0]), int(shape[1])
    base = int(round(min(h, w) * float(frac)))
    base = int(np.clip(base, min_ks, max_ks))
    return _ensure_odd(base)


def illumination_correct(gray: np.ndarray, method: str = "morph_open", frac: float = 0.035) -> np.ndarray:
    """
    Background estimation + removal for evening out illumination.
    """
    if gray is None or gray.size == 0:
        return gray.copy()

    ks = _auto_kernel_size(gray.shape, frac=frac)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (ks, ks))

    if method == "morph_open":
        bg_est = cv2.morphologyEx(gray, cv2.MORPH_OPEN, kernel)
    else:
        bg_est = cv2.GaussianBlur(gray, (ks, ks), 0)

    # subtract background then stretch to full range
    corrected = cv2.subtract(gray, bg_est)
    corrected = cv2.normalize(corrected, None, 0, 255, cv2.NORM_MINMAX)
    corrected = corrected.astype(np.uint8)
    return corrected


def _estimate_small_skew_angle(gray: np.ndarray, max_angle: float = 5.0) -> float:
    """Robust small-angle skew estimation using Hough lines (ignore verticals)."""
    if gray is None or gray.size == 0:
        return 0.0

    # Edge map; use low thresholds to pick up faint lines
    edges = cv2.Canny(gray, 40, 120, apertureSize=3)

    # Dynamic threshold scaled by image width to avoid over/under-detection
    thr = max(80, int(0.25 * gray.shape[1]))
    lines = cv2.HoughLines(edges, 1, np.pi / 180, threshold=thr)

    if lines is None or len(lines) == 0:
        return 0.0

    angles = []
    for entry in lines[:100]:  # at most 100 candidates
        # Accept both [[rho, theta]] and [rho, theta]
        if isinstance(entry, np.ndarray) and entry.ndim > 1:
            rho, theta = entry[0]
        else:
            rho, theta = entry
        # angle w.r.t. horizontal, mapped to deviation from vertical
        angle_deg = (theta - np.pi / 2) * 180.0 / np.pi
        if abs(angle_deg) <= max_angle:
            angles.append(angle_deg)

    return float(np.median(angles)) if angles else 0.0


def deskew_small(gray: np.ndarray, max_angle: float = 5.0,
                 border_value: int = 255) -> Tuple[np.ndarray, float]:
    """
    Rotate image by a small estimated angle; returns (rotated, angle_degrees).
    """
    if gray is None or gray.size == 0:
        return gray, 0.0

    angle = _estimate_small_skew_angle(gray, max_angle)
    if abs(angle) < 0.1:
        return gray.copy(), angle

    h, w = gray.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(
        gray, M, (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=border_value
    )
    return rotated, angle


def binarize_sauvola(gray: np.ndarray, window: int = 31, k: float = 0.2) -> np.ndarray:
    """
    Sauvola adaptive thresholding with Otsu fallback.
    Returns a uint8 binary image with values {0, 255}.
    """
    if gray is None or gray.size == 0:
        return gray.copy()

    window = _ensure_odd(int(window), minimum=15)

    if _HAS_SAUVOLA:
        try:
            # skimage returns a float threshold array same size as gray
            thresh = threshold_sauvola(gray, window_size=window, k=float(k))
            # foreground → ink (dark) → 0
            bw = (gray > thresh).astype(np.uint8) * 255
            return bw
        except Exception:
            # fall through to Otsu
            pass

    # Fallback to Otsu (globally good after illumination correction)
    _, bw = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return bw.astype(np.uint8)


def preprocess(bgr_img: np.ndarray,
               illum_method: str = "morph_open",
               illum_frac: float = 0.035,
               do_deskew: bool = True,
               sauvola_window: int = 31,
               sauvola_k: float = 0.2) -> np.ndarray:
    """
    Full pipeline → returns a binary image (uint8 with values {0, 255}).
    Steps are designed to be ink-preserving for thin strokes.
    """
    # 1) Grayscale
    gray = to_gray(bgr_img)

    # 2) Illumination correction
    corrected = illumination_correct(gray, method=illum_method, frac=float(illum_frac))

    # 2b) Boost local contrast for faint strokes (CLAHE)
    try:
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        corrected = clahe.apply(corrected)
    except Exception:
        pass

    # 3) Optional small-angle deskew
    if do_deskew:
        corrected, _ = deskew_small(corrected, max_angle=5.0, border_value=255)

    # 4) Adaptive binarization (Sauvola → Otsu fallback)
    bw = binarize_sauvola(corrected, window=int(sauvola_window), k=float(sauvola_k))

    # 5) Light denoise without harming thin strokes
    try:
        k = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        bw = cv2.morphologyEx(bw, cv2.MORPH_OPEN, k, iterations=1)
    except Exception:
        pass

    # Ensure pure {0,255}
    if bw.dtype != np.uint8:
        bw = bw.astype(np.uint8)
    bw[bw != 0] = 255
    return bw
