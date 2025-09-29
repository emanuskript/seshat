# line_segmentor.py
import cv2 as cv
import numpy as np
from typing import List, Tuple

class LineSegmentor:

    def __init__(self, gray_img: np.ndarray, bin_img: np.ndarray):
        """
        Constructs a new line segmentation object for the given handwritten paragraph image.

        :param gray_img:    the handwritten paragraph image in gray scale.
        :param bin_img:     the handwritten paragraph image after binarization.
        """
        
        # Stage 1: normalise + deskew inputs for downstream heuristics
        self.gray_img, self.bin_img = self._prepare_inputs(gray_img, bin_img)

        # Ink mask: 1 where ink (black), 0 where background
        self.ink = (self.bin_img == 0).astype(np.uint8)

        # Horizontal ink histogram (per row) + smoothed projection
        self.hor_hist = np.sum(self.ink, axis=1, dtype=int)
        self.proj_signal = self._smooth_projection(self.hor_hist)

        # Robust thresholds based on ink, not background
        hmax = int(self.hor_hist.max()) if self.hor_hist.size else 0
        self.threshold_high = max(5, int(0.20 * hmax))   # 20% of max row ink
        self.threshold_low  = max(2, int(0.05 * hmax))   # 5%  of max row ink

        # init
        self.peaks = [] 
        self.valleys = []
        self.lines_boundaries = []
        
        # Calculate peaks and valleys of the page.
        self.detect_peaks()
        if len(self.peaks) > 1:
            self.avg_peaks_dist = int((self.peaks[-1] - self.peaks[0]) // len(self.peaks))
        else:
            self.avg_peaks_dist = 50  # default value
        self.detect_valleys()
        
        # Detect missing peaks and valleys in a second iteration.
        self.detect_missing_peaks_valleys()
        
        # Detect line boundaries.
        self.detect_line_boundaries()
        # Fallback to legacy boundaries if new detector fails
        if not self.lines_boundaries:
            self._legacy_line_boundaries()

    # ------------------------------------------------------------------
    # Pre-processing helpers
    # ------------------------------------------------------------------
    def _prepare_inputs(self, gray_img: np.ndarray, bin_img: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Return deskewed grayscale/binary images suitable for heuristic processing."""
        gray = gray_img.copy()
        binary = bin_img.copy()
        if len(gray.shape) == 3:
            gray = cv.cvtColor(gray, cv.COLOR_BGR2GRAY)
        if len(binary.shape) == 3:
            binary = cv.cvtColor(binary, cv.COLOR_BGR2GRAY)

        # Ensure binary is 0/255
        if binary.dtype != np.uint8:
            binary = binary.astype(np.uint8)
        _, binary = cv.threshold(binary, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU)

        deskewed_gray, deskewed_bin = self._deskew_page(gray, binary)
        return deskewed_gray, deskewed_bin

    def _deskew_page(self, gray: np.ndarray, binary: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Attempt to deskew the page using probabilistic Hough on the binary edges."""
        edges = cv.Canny(binary, 40, 120, apertureSize=3)
        lines = cv.HoughLinesP(edges, 1, np.pi / 180, threshold=120,
                               minLineLength=int(0.5 * binary.shape[1]),
                               maxLineGap=40)

        if lines is None or len(lines) == 0:
            return gray, binary

        angles = []
        for x1, y1, x2, y2 in lines[:, 0, :]:
            dx, dy = (x2 - x1), (y2 - y1)
            if dx == 0:
                continue
            angle = np.degrees(np.arctan2(dy, dx))
            # Ignore near-vertical lines
            if -45 <= angle <= 45:
                angles.append(angle)

        if not angles:
            return gray, binary

        median_angle = np.median(angles)
        if abs(median_angle) < 0.3:
            return gray, binary

        center = (gray.shape[1] // 2, gray.shape[0] // 2)
        rot_mat = cv.getRotationMatrix2D(center, median_angle, 1.0)
        cos = abs(rot_mat[0, 0])
        sin = abs(rot_mat[0, 1])
        # compute new bounding dimensions
        nW = int((gray.shape[0] * sin) + (gray.shape[1] * cos))
        nH = int((gray.shape[0] * cos) + (gray.shape[1] * sin))
        rot_mat[0, 2] += (nW / 2) - center[0]
        rot_mat[1, 2] += (nH / 2) - center[1]

        rotated_gray = cv.warpAffine(gray, rot_mat, (nW, nH), flags=cv.INTER_CUBIC, borderMode=cv.BORDER_REPLICATE)
        rotated_bin = cv.warpAffine(binary, rot_mat, (nW, nH), flags=cv.INTER_NEAREST, borderMode=cv.BORDER_REPLICATE)
        return rotated_gray, rotated_bin

    def _smooth_projection(self, signal: np.ndarray, window: int = 21) -> np.ndarray:
        """Apply moving-average smoothing to the horizontal ink histogram."""
        if signal.size == 0 or window <= 1:
            return signal.astype(np.float32)
        window = max(1, window | 1)  # ensure odd
        kernel = np.ones(window, dtype=np.float32) / float(window)
        padded = np.pad(signal.astype(np.float32), (window // 2,), mode='edge')
        smoothed = np.convolve(padded, kernel, mode='valid')
        return smoothed
    
    def segment(self):
        """
        Segments the handwritten paragraph into list of lines.

        :return:    two lists of lines:
                    one from the gray image and the other from the binary image.
        """
        
        # Initialize lines lists.
        gray_lines, bin_lines = [], []
        
        # Loop on every line boundary.
        for l, u, r, d in self.lines_boundaries:
            # Crop gray line.
            g_line = self.gray_img[u:d + 1, l:r + 1]
            gray_lines.append(g_line)
            
            # Crop binary line.
            b_line = self.bin_img[u:d + 1, l:r + 1]
            bin_lines.append(b_line)
        
        # Return list of separated lines.
        return gray_lines, bin_lines
    
    def detect_peaks(self):
        """
        Detects the peak rows of the image and update self.peaks in correspondence.

        The peak rows are the ones with the highest black pixel density.
        """
        
        self.peaks = []
        
        i = 0
        while i < len(self.hor_hist):
            # If the black pixels density of the row is below than threshold
            # then continue to the next row.
            if self.hor_hist[i] < self.threshold_high:
                i += 1
                continue
            
            # Get the row with the maximum density from the following
            # probable row lines.
            peak_idx = i
            while i < len(self.hor_hist) and self.is_probable_peak(i):
                if self.hor_hist[i] > self.hor_hist[peak_idx]:
                    peak_idx = i
                i += 1
            
            # Add peak row index to the list.
            self.peaks.append(peak_idx)
    
    def detect_valleys(self):
        """
        Detects the valleys rows of the image and update self.valleys in correspondence.

        The valleys rows are the ones with the lowest black pixel density
        between two consecutive peaks.
        """
        
        self.valleys = [0]
        
        i = 1
        while i < len(self.peaks):
            u = self.peaks[i - 1]
            d = self.peaks[i]
            i += 1
            
            expected_valley = d - self.avg_peaks_dist // 2
            valley_idx = u
            
            while u < d:
                dist1 = np.abs(u - expected_valley)
                dist2 = np.abs(valley_idx - expected_valley)
                
                cond1 = self.hor_hist[u] < self.hor_hist[valley_idx]
                cond2 = self.hor_hist[u] == self.hor_hist[valley_idx] and dist1 < dist2
                
                if cond1 or cond2:
                    valley_idx = u
                
                u += 1
            
            self.valleys.append(valley_idx)
        
        self.valleys.append(len(self.hor_hist) - 1)
    
    def detect_missing_peaks_valleys(self):
        """
        Detects the missing peaks and valleys after the first detection trial
        using functions self.detect_peaks and self.detect_valleys.

        And updates self.peaks and self.valleys in correspondence.
        """
        
        i = 1
        found = False
        
        while i < len(self.valleys):
            # Calculate distance between two consecutive valleys.
            up, down = self.valleys[i - 1], self.valleys[i]
            dis = down - up
            
            i += 1
            
            # If the distance is about twice the average distance between
            # two consecutive peaks, then it is most probable that we are missing
            # a line in between these two valleys.
            if dis < 1.5 * self.avg_peaks_dist:
                continue
            
            u = up + self.avg_peaks_dist
            d = min(down, u + self.avg_peaks_dist)
            
            while (d - u) * 2 > self.avg_peaks_dist:
                if self.is_probable_valley(u) and self.is_probable_valley(d):
                    peak = self.get_peak_in_range(u, d)
                    if self.hor_hist[peak] > self.threshold_low:
                        self.peaks.append(self.get_peak_in_range(u, d))
                        found = True
                
                u = u + self.avg_peaks_dist
                d = min(down, u + self.avg_peaks_dist)
        
        # Re-distribute peaks and valleys if new ones are found.
        if found:
            self.peaks.sort()
            self.detect_valleys()
    
    def detect_line_boundaries(self):
        """Detect handwritten lines combining projection analysis and connected components."""
        height, width = self.bin_img.shape
        self.lines_boundaries = []

        if height == 0 or width == 0:
            return

        high_thresh = max(12.0, 0.12 * float(self.proj_signal.max() if self.proj_signal.size else 0))
        low_thresh = high_thresh * 0.4

        projection_ranges = self._projection_intervals(self.proj_signal, high_thresh, low_thresh)
        bounds = []
        for u, d in projection_ranges:
            l, r = self._trim_lr(u, d, width)
            if r - l >= 10 and d - u >= 6:
                bounds.append((l, max(0, u), r, min(height - 1, d)))

        bounds.extend(self._component_candidates())

        merged = self._merge_bounds(bounds)

        final_bounds = []
        for l, u, r, d in merged:
            l2, r2 = self._trim_lr(u, d, width, initial_bounds=(l, r))
            if r2 - l2 >= 8 and d - u >= 6:
                final_bounds.append((max(0, l2), max(0, u), min(width - 1, r2), min(height - 1, d)))

        self.lines_boundaries = final_bounds

    def _projection_intervals(self, signal: np.ndarray, high: float, low: float) -> List[Tuple[int, int]]:
        intervals = []
        if signal.size == 0:
            return intervals

        n = len(signal)
        i = 0
        while i < n:
            if signal[i] >= high:
                start = i
                while i < n and signal[i] >= low:
                    i += 1
                end = i - 1
                if end - start >= 4:
                    intervals.append((max(0, start - 1), min(n - 1, end + 1)))
            else:
                i += 1
        return intervals

    def _trim_lr(self, top: int, bottom: int, width: int, initial_bounds: Tuple[int, int] = None) -> Tuple[int, int]:
        band = self.ink[max(0, top):min(self.ink.shape[0], bottom + 1), :]
        if band.size == 0:
            return 0, width - 1
        ver_hist = np.sum(band, axis=0, dtype=int)
        vmax = int(ver_hist.max()) if ver_hist.size else 0
        if vmax == 0:
            return 0, width - 1
        thresh = max(2, int(0.05 * vmax))
        if initial_bounds:
            l, r = max(0, initial_bounds[0]), min(width - 1, initial_bounds[1])
        else:
            l, r = 0, width - 1
        while l < r and ver_hist[l] <= thresh:
            l += 1
        while r > l and ver_hist[r] <= thresh:
            r -= 1
        return l, r

    def _component_candidates(self) -> List[Tuple[int, int, int, int]]:
        bounds = []
        num, _, stats, _ = cv.connectedComponentsWithStats(self.ink, connectivity=8)
        for i in range(1, num):
            x, y, w, h, area = stats[i]
            if h < 6 or w < 12 or area < 80:
                continue
            bounds.append((x, y, x + w - 1, y + h - 1))
        return bounds

    def _merge_bounds(self, bounds: List[Tuple[int, int, int, int]], gap: int = 4) -> List[Tuple[int, int, int, int]]:
        if not bounds:
            return []
        bounds_sorted = sorted(bounds, key=lambda b: b[1])
        merged = [list(bounds_sorted[0])]
        for l, u, r, d in bounds_sorted[1:]:
            prev = merged[-1]
            if u <= prev[3] + gap and d >= prev[1] - gap:
                prev[0] = min(prev[0], l)
                prev[1] = min(prev[1], u)
                prev[2] = max(prev[2], r)
                prev[3] = max(prev[3], d)
            else:
                merged.append([l, u, r, d])
        return [tuple(b) for b in merged]

    def _legacy_line_boundaries(self):
        """Legacy peak/valley based detector as fallback."""
        height, width = self.bin_img.shape
        self.lines_boundaries = []

        i = 1
        while i < len(self.valleys):
            u = self.valleys[i - 1]
            d = self.valleys[i]
            i += 1

            while u < d and self.hor_hist[u] <= self.threshold_low:
                u += 1
            while d > u and self.hor_hist[d] <= self.threshold_low:
                d -= 1
            if d - u < 6:
                continue

            ver_hist = np.sum(self.ink[u:d + 1, :], axis=0, dtype=int)
            vmax = int(ver_hist.max()) if ver_hist.size else 0
            vth = max(2, int(0.05 * vmax))

            l, r = 0, width - 1
            while l < r and ver_hist[l] <= vth:
                l += 1
            while r > l and ver_hist[r] <= vth:
                r -= 1

            if r - l >= 10 and d - u >= 8:
                self.lines_boundaries.append((l, u, r, d))
    
    def get_peak_in_range(self, up: int, down: int) -> int:
        """
        Get the peak row index within the given range.
        """
        max_density = 0
        peak_idx = up
        
        for i in range(up, down + 1):
            if i < len(self.hor_hist) and self.hor_hist[i] > max_density:
                max_density = self.hor_hist[i]
                peak_idx = i
        
        return peak_idx
    
    def is_probable_peak(self, row: int) -> bool:
        """
        Check if the given row is a probable peak.
        """
        return row < len(self.hor_hist) and self.hor_hist[row] >= self.threshold_high
    
    def is_probable_valley(self, row: int) -> bool:
        """
        Check if the given row is a probable valley.
        """
        return row < len(self.hor_hist) and self.hor_hist[row] <= self.threshold_low
