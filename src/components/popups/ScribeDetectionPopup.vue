<template>
  <div v-if="isVisible" class="scribe-modal" @click.self="closePopup">
    <div class="scribe-card">
      <header class="scribe-header">
        <div class="header-left">
          <img :src="logo" alt="PharoSight" class="pharaonic-icon" />
          <span class="pharosight-text">PharoSight</span>
          <h3>Scribe Detection</h3>
        </div>
        <button class="icon-btn" @click="closePopup" aria-label="Close">✕</button>
      </header>

      <!-- STEP TABS -->
      <div class="steps">
        <div class="step" :class="{active: step===1}"><span>1</span> Segmentation</div>
        <div class="line"></div>
        <div class="step" :class="{active: step===2}"><span>2</span> Tune & Run</div>
      </div>

      <!-- STEP 1: CHOOSE METHOD -->
      <section v-if="step===1" class="step-pane">
        <p class="helper">How should we pick the lines to compare?</p>

        <div class="method-grid">
          <!-- Option 1 -->
          <button class="method-card"
                  :class="{selected: mode==='auto'}"
                  @click="selectMode('auto')">
            <div class="method-title">PharoSight Auto</div>
            <div class="method-sub">Detect lines automatically</div>
          </button>

          <!-- Option 2 -->
          <button class="method-card"
                  :class="{selected: mode==='manual'}"
                  @click="selectMode('manual')">
            <div class="method-title">Manual Line Pick</div>
            <div class="method-sub">Recommended • Draw boxes on the specific lines</div>
          </button>

          <!-- Option 3: JSON Upload -->
          <button class="method-card"
                  :class="{selected: mode==='json'}"
                  @click="selectMode('json')">
            <div class="method-title">Import JSON Annotations</div>
            <div class="method-sub">Upload COCO-format line detections</div>
          </button>
        </div>

        <!-- Manual drawing canvas (visible only when manual is chosen) -->
        <div v-if="mode==='manual'" class="draw-wrap">
          <div class="draw-toolbar">
            <div>Boxes selected: <strong>{{ regions.length }}</strong></div>
            <div class="spacer"></div>
            <button class="pill" @click="clearRegions" :disabled="regions.length===0">Clear</button>
            <button class="pill" @click="toggleDraw">
              {{ drawActive ? 'Stop Drawing' : 'Start Drawing' }}
            </button>
          </div>

          <!-- The same image you show in the viewer popup; use a fitted container -->
          <div class="draw-stage" ref="drawStage">
            <img v-if="drawImageSrc" :src="drawImageSrc" :key="drawImageSrc" alt="Manuscript page"
                 class="draw-img" draggable="false"
                 @load="onDrawImgLoad"
                 @mousedown="onImgDown"
                 @mousemove="onImgMove"
                 @mouseup="onImgUp"
                 @mouseleave="onImgUp" />
            <!-- existing rectangles -->
            <div v-for="(r, i) in regions" :key="i" class="box"
                 :style="boxStyle(r)"></div>
            <!-- live rectangle -->
            <div v-if="liveBox" class="box live" :style="boxStyle(liveBox)"></div>
          </div>

          <p class="hint">
            Tip: Click "Start Drawing", then drag to draw a box around a single text line. Repeat to add more lines.  
            You can refine during Step 2 before running.
          </p>
        </div>

        <!-- JSON Upload interface -->
        <div v-if="mode==='json'" class="json-upload-wrap">
          <p class="helper">Upload the manuscript image and its annotation JSON file</p>
          
          <!-- Image Upload -->
          <div class="upload-section">
            <label class="upload-label">1. Manuscript Image</label>
            <div class="upload-area" :class="{dragover: isDraggingImage}">
              <input type="file" ref="imageFileInput" accept="image/*"
                     @change="handleImageSelect" style="display: none;" />
              <div class="upload-content">
                <span class="upload-icon">🖼️</span>
                <p class="upload-text">
                  <strong v-if="!uploadedImageFile">Drop image file here or click to browse</strong>
                  <strong v-else class="file-selected">✓ {{ uploadedImageFile.name }}</strong>
                </p>
                <button class="pill" @click="$refs.imageFileInput.click()">
                  {{ uploadedImageFile ? 'Change Image' : 'Select Image' }}
                </button>
              </div>
            </div>
          </div>

          <!-- JSON Upload -->
          <div class="upload-section">
            <label class="upload-label">2. Annotation JSON</label>
            <div class="upload-area" :class="{dragover: isDraggingFile}">
              <input type="file" ref="jsonFileInput" accept=".json,application/json"
                     @change="handleFileSelect" style="display: none;" />
              <div class="upload-content">
                <span class="upload-icon">📄</span>
                <p class="upload-text">
                  <strong v-if="!uploadedJsonFile">Drop JSON file here or click to browse</strong>
                  <strong v-else class="file-selected">✓ {{ uploadedJsonFile.name }}</strong>
                </p>
                <button class="pill" @click="$refs.jsonFileInput.click()">
                  {{ uploadedJsonFile ? 'Change File' : 'Select File' }}
                </button>
              </div>
            </div>
          </div>
          
          <div v-if="jsonParseError" class="error-message">
            <strong>⚠ Error:</strong> {{ jsonParseError }}
          </div>
          
          <div v-if="uploadedJsonFile && !jsonParseError && uploadedImageFile" class="json-info">
            <p><strong>Image:</strong> {{ uploadedImageFile.name }}</p>
            <p><strong>JSON:</strong> {{ uploadedJsonFile.name }}</p>
            <p><strong>Lines detected:</strong> {{ regions.length }}</p>
          </div>

          <!-- Show preview of page with detected regions -->
          <div v-if="uploadedJsonFile && !jsonParseError && jsonImagePreview" class="json-preview-wrap">
            <p class="preview-label">Preview: Detected line regions</p>
            <div class="draw-stage">
              <img :src="jsonImagePreview" alt="Manuscript page"
                   class="draw-img" draggable="false" ref="jsonPreviewImg" />
              <!-- Show regions from JSON -->
              <div v-for="(r, i) in regions" :key="i" class="box json-box"
                   :style="getJsonBoxStyle(r)"></div>
            </div>
          </div>
        </div>

        <footer class="actions">
          <button class="ghost" @click="closePopup">Cancel</button>
          <button class="primary"
                  :disabled="mode===null || (mode==='json' && (!uploadedJsonFile || !uploadedImageFile))"
                  @click="goStep(2)">
            Next: Tune & Run →
          </button>
        </footer>
      </section>

      <!-- STEP 2: TUNING AND RUNNING -->
      <section v-else class="step-pane">
        <!-- Pharaonic Loading Animation -->
        <div v-if="isAnalyzing" class="loading-section pharaonic-loading">
          <div class="pharaonic-spinner">
            <div class="ankh-spinner"></div>
            <div class="hieroglyph-ring"></div>
          </div>
          <div class="loading-text">
            <h4>{{ loadingMessage }}</h4>
            <p class="loading-detail">{{ loadingDetail }}</p>
          </div>
        </div>

        <!-- Results Display -->
        <div v-else-if="hasResults" class="results-section">
          <div class="results-header">
            <h4>Analysis Complete</h4>
            <div class="results-summary">
              <div class="metric">
                <span class="metric-label">Total Scribes:</span>
                <span class="metric-value">{{ results.statistics?.total_scribes || results.total_scribes || 'Unknown' }}</span>
              </div>
              <div class="metric">
                <span class="metric-label">Overall Confidence:</span>
                <span class="metric-value">{{ results.statistics?.overall_confidence ? Math.round(results.statistics.overall_confidence) + '%' : (results.confidence ? Math.round(results.confidence) + '%' : 'N/A') }}</span>
              </div>
            </div>
          </div>

          <!-- Export wrapper includes analyzed page + results for PDF -->
          <div class="pdf-layout" ref="exportWrapper">
            <div class="pdf-left" v-if="currentPageImage">
              <div class="analyzed-card">
                <div class="analyzed-card-header" style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                  <span>Analyzed Page</span>
                  <label class="param-label" style="display:flex;align-items:center;gap:6px;font-size:12px;">
                    <input type="checkbox" v-model="debugOverlayEnabled" @change="drawPageOverlay" /> Debug overlay
                  </label>
                </div>
                <div class="analyzed-card-body">
                  <div class="page-stage">
                    <img :src="analyzedImageSrc" :key="analyzedImageSrc"
                       alt="Analyzed page"
                       class="pdf-page-image"
                       ref="manuscriptImage"
                       crossorigin="anonymous"
                       @load="onAnalyzedImageLoad"/>
                    <canvas ref="pageOverlay" class="page-overlay"></canvas>
                  </div>
                </div>
              </div>
            </div>

            <div class="pdf-right">
              <!-- Results content -->
              <div class="scribe-results">
                <div v-if="results.scribe_changes && results.scribe_changes.length > 0" class="detected-scribes">
                  <h5>Detected Scribes</h5>
                  <div v-for="(change, index) in results.scribe_changes" :key="index" class="scribe-item">
                    <div class="scribe-header">
                      <h6 class="scribe-title">{{ change.scribe }}</h6>
                      <!-- NEVER show confidence for initial scribe (index 0) -->
                      <span v-if="index > 0 && change.confidence && !change.is_initial && change.confidence !== null && change.confidence !== undefined" class="scribe-confidence">
                        {{ Math.round(change.confidence) }}% confidence
                      </span>
                      <!-- Show return indicator for returning scribes -->
                      <span v-if="!change.is_initial && isScribeReturn(change.scribe, index)" class="scribe-return">
                        (Returns)
                      </span>
                    </div>
                <p class="scribe-explanation">{{ explain(change, index) }}</p>

                <!-- Scribe Previews (prefer OCR screenshots; fallback to page crop) -->
                <div class="scribe-samples">
                  <h6 class="samples-title">Scribe Previews:</h6>
                  <div class="samples-gallery">
                    <div v-for="(shot, sIdx) in previewImagesFor(change)" :key="sIdx" class="preview-image-container">
                      <img :src="shot"
                           :alt="`Preview for ${change.scribe} #${sIdx+1}`"
                           class="preview-image"
                           @error="onScribeSampleError" />
                    </div>
                  </div>
                </div>

                    <!-- Scribe Sample Images (fallback only if no previews available) -->
                    <div v-if="previewImagesFor(change).length === 0 && change.samples && change.samples.length > 0" class="scribe-samples">
                      <h6 class="samples-title">Sample Handwriting:</h6>
                      <div class="samples-gallery">
                        <div v-for="(sample, sampleIndex) in change.samples" :key="sampleIndex" class="sample-image-container">
                          <img :src="backendBase + sample" 
                               :alt="`${change.scribe} handwriting sample ${sampleIndex + 1}`"
                               class="sample-image"
                               crossorigin="anonymous"
                               @error="onScribeSampleError">
                        </div>
                      </div>
                    </div>

                    <!-- Alternative: Use scribe_samples from results if samples not in change object -->
                    <div v-else-if="previewImagesFor(change).length === 0 && results.scribe_samples && results.scribe_samples[change.scribe]" class="scribe-samples">
                      <h6 class="samples-title">Sample Handwriting:</h6>
                      <div class="samples-gallery">
                        <div v-for="(sample, sampleIndex) in results.scribe_samples[change.scribe]" :key="sampleIndex" class="sample-image-container">
                          <img :src="backendBase + sample" 
                               :alt="`${change.scribe} handwriting sample ${sampleIndex + 1}`"
                               class="sample-image"
                               crossorigin="anonymous"
                               @error="onScribeSampleError">
                        </div>
                      </div>
                    </div>

                    <div v-if="change.features" class="scribe-features">
                      <span class="feature-tag" v-for="(value, key) in change.features" :key="key">
                        {{ key }}: {{ value }}
                      </span>
                    </div>
                  </div>
                </div>
                <div v-else>
                  <p>No scribe changes detected. The entire selection appears to be written by a single hand.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tuning Controls (when not analyzing and no results) -->
        <div v-else class="tuning-section">
          <div class="params-container">
            <h4 class="params-title">Analysis Parameters</h4>
            <div class="params-grid">
              <div class="param-group">
                <label class="param-label">
                  <i class="info-icon" data-tooltip="sensitivity">ⓘ</i>
                  Sensitivity (z-thresh)
                </label>
                <div class="input-group">
                  <input type="range" min="2.0" max="4.0" step="0.1" v-model.number="params.z_thresh" class="range-input">
                  <span class="param-value">{{ params.z_thresh?.toFixed(1) ?? 'auto' }}</span>
                </div>
              </div>

              <div class="param-group">
                <label class="param-label">
                  <i class="info-icon" data-tooltip="min_gap">ⓘ</i>
                  Min Gap (lines)
                </label>
                <div class="input-group">
                  <input type="number" min="2" max="8" v-model.number="params.min_gap" class="number-input">
                </div>
              </div>

              <div class="param-group">
                <label class="param-label">
                  <i class="info-icon" data-tooltip="min_run">ⓘ</i>
                  Min Run (lines)
                </label>
                <div class="input-group">
                  <input type="number" min="2" max="8" v-model.number="params.min_run" class="number-input">
                </div>
              </div>

              <div class="param-group">
                <label class="param-label">
                  <i class="info-icon" data-tooltip="illum_frac">ⓘ</i>
                  Illumination Fraction
                </label>
                <div class="input-group">
                  <input type="number" step="0.005" v-model.number="params.illum_frac" class="number-input">
                </div>
              </div>

              <div class="param-group">
                <label class="param-label">
                  <i class="info-icon" data-tooltip="sauvola_window">ⓘ</i>
                  Sauvola Window
                </label>
                <div class="input-group">
                  <input type="number" min="15" step="2" v-model.number="params.sauvola_window" class="number-input">
                </div>
              </div>

              <div class="param-group">
                <label class="param-label">
                  <i class="info-icon" data-tooltip="algorithm">ⓘ</i>
                  Algorithm
                </label>
                <div class="input-group">
                  <select v-model="params.algo" class="select-input">
                    <option value="auto">Auto</option>
                    <option value="peaks">Peaks</option>
                    <option value="ruptures">Ruptures</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer class="actions">
          <button class="ghost" @click="goStep(1)">← Back</button>
          <div class="action-right">
            <button v-if="hasResults" class="secondary" @click="exportPDF">Export PDF</button>
            <button class="primary" @click="runDetection" :disabled="runButtonDisabled">
              {{ isAnalyzing ? 'Analyzing…' : (mode==='auto' ? 'Run PharoSight' : 'Run on Selected Lines') }}
              <small v-if="mode==='manual'" style="display: block; font-size: 10px; opacity: 0.7;">
                ({{ regions.length }} regions selected)
              </small>
            </button>
          </div>
        </footer>
      </section>
    </div>
  </div>
</template>

<script>
/* eslint-disable no-console */
import logo from '@/assets/pharosight_icon_no_text.png'

export default {
  name: 'ScribeDetectionPopup',
  props: {
    currentPage: { type: Number, default: 1 },
    totalPages:  { type: Number, default: 1 },
    currentPageImage: { type: String, default: null }
  },
  data() {
    return {
      logo,
      // UI state
      isVisible: false,
      step: 1,
      mode: null, // 'auto' | 'manual'
      // Analysis state
      isAnalyzing: false,
      analysisCompleted: false,
      results: null,
      segmentationOverlay: null,
      highlightedScribe: null,
      loadingMessage: 'Analyzing handwriting patterns...',
      loadingDetail:  'Initializing scribe detection algorithm',
      // Params
      params: {
        z_thresh: 2.5,
        min_gap: 3,
        min_run: 3,
        illum_frac: 0.035,
        sauvola_window: 31,
        algo: 'auto'
      },
      // Manual drawing
      regions: [],
      lastPayloadRegions: [],
      drawActive: false,
      // JSON upload
      uploadedJsonFile: null,
      uploadedImageFile: null,
      jsonImagePreview: null,
      jsonParseError: null,
      isDraggingFile: false,
      isDraggingImage: false,
      jsonSourceWidth: null,
      jsonSourceHeight: null,
      liveBox: null,
      drawImgNaturalW: 0,
      drawImgNaturalH: 0,
      stageRect: null,
      drawImgBox: null,
      canDraw: false,
      // Prepared page (server-side preprocessing cache)
      preparedJobId: null,
      preparedPageUrl: null,
      isPreparingPage: false,
      // Debug overlay
      debugOverlayEnabled: false,
      // Fallback/preview cache when OCR line crops aren't present
      segmentPreviews: Object.create(null),
    }
  },
  watch: {
    results: {
      handler(newResults) {
        if (newResults && newResults.scribe_changes) {
          console.log('Analysis results received:', {
            scribe_changes: newResults.scribe_changes?.length || 0,
            line_screenshots: newResults.line_screenshots?.length || 0,
            ocr_available: newResults.ocr_available,
            total_lines: newResults.total_lines
          })
          // If no OCR line screenshots, create basic previews from page image
          setTimeout(() => {
            this.$nextTick(() => {
              if (newResults.line_screenshots && newResults.line_screenshots.length > 0) {
                console.log('Using OCR-extracted line screenshots:', newResults.line_screenshots.length)
              } else if (Array.isArray(newResults.scribe_changes)) {
                console.log('No OCR screenshots available, generating fallback previews from canvas')
                newResults.scribe_changes.forEach((change, index) => {
                  this.captureLineScreenshot(change, index)
                })
              }
              this.drawPageOverlay()
            })
          }, 100)
        }
      },
      immediate: true
    },
    currentPage() {
      this._resetPreparedAndDrawing()
    },
    currentPageImage() {
      this._resetPreparedAndDrawing()
      // Only prepare in manual mode where selections depend on server-side prepped page
      if (this.isVisible && this.currentPageImage && this.mode === 'manual') {
        this.$nextTick(() => this.preparePageIfNeeded())
      }
    },
  },
  computed: {
    hasResults() {
      return !!(
        this.results &&
        (this.results.primary_scribe ||
         (Array.isArray(this.results.scribe_changes) && this.results.scribe_changes.length > 0))
      )
    },
    backendBase() {
      // FORCE localhost:5001 for development
      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      
      if (isDev) {
        console.log('🔗 Backend URL: http://localhost:5001 (DEVELOPMENT MODE)')
        return 'http://localhost:5001'
      }

      const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {}
      const fromEnv = env?.VITE_PHAROSIGHT_API_BASE || env?.VUE_APP_PHAROSIGHT_API_BASE
      const fromWindow = (typeof window !== 'undefined' && window.__PHAROSIGHT_API_BASE__) ? window.__PHAROSIGHT_API_BASE__ : null
      const prodDefault = 'https://basuony-pharosight.hf.space'
      let base = fromEnv || fromWindow || prodDefault

      // Guard against legacy endpoints that should no longer receive traffic.
      if (typeof base === 'string' && /pharosight\.onrender\.com/i.test(base)) {
        console.warn('Legacy backend URL detected; forcing Hugging Face endpoint instead.')
        base = prodDefault
      }

      const normalized = String(base).replace(/\/+$/, '')
      if (!/^https?:\/\//i.test(normalized)) {
        console.warn('Unexpected backend base URL, defaulting to Hugging Face endpoint.', normalized)
        return prodDefault
      }
      
      console.log('🔗 Backend URL:', normalized)
      return normalized
    },
    drawImageSrc() {
      return (this.mode === 'manual' && this.preparedPageUrl) ? this.preparedPageUrl : this.currentPageImage
    },
    drawImageKey() {
      return `${this.drawImageSrc || ''}::p=${this.currentPage}::j=${this.preparedJobId || 'none'}`
    },
    analyzedImageSrc() {
      // For JSON mode, show the uploaded image
      if (this.mode === 'json' && this.jsonImagePreview) {
        return this.jsonImagePreview
      }
      return this.drawImageSrc
    },
    analyzedImageKey() {
      if (this.mode === 'json' && this.jsonImagePreview) {
        return `json::${this.uploadedImageFile?.name || 'uploaded'}`
      }
      return this.drawImageKey
    },
    runButtonDisabled() {
      // Allow running while preparing; backend accepts raw image if no prepared job yet
      const waiting = this.isAnalyzing
      const manualNeedsSelection = (this.mode === 'manual' && this.regions.length === 0)
      return waiting || manualNeedsSelection
    }
  },
  mounted() {
    window.addEventListener('resize', this.drawPageOverlay)
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.drawPageOverlay)
  },
  methods: {
    // ---------- Lifecycle helpers ----------
    openPopup() {
      this.isVisible = true
      this.resetAnalysis()
    },
    closePopup() {
      this.isVisible = false
      this.resetAnalysis()
    },
    resetAnalysis() {
      this.isAnalyzing = false
      this.analysisCompleted = false
      this.results = null
      this.step = 1
      this.mode = null
      this.regions = []
      this.lastPayloadRegions = []
      this.drawActive = false
      this.liveBox = null
      this.segmentPreviews = Object.create(null)
    },
    goStep(stepNum) {
      this.step = stepNum
    },
    selectMode(modeType) {
      this.mode = modeType
      this._resetPreparedAndDrawing()
      // Clear JSON upload state when switching modes
      if (modeType !== 'json') {
        this.uploadedJsonFile = null
        this.uploadedImageFile = null
        this.jsonImagePreview = null
        this.jsonParseError = null
      }
      this.$nextTick(async () => {
        // Only pre-prepare for manual. Auto can run without a prepared job.
        if (this.currentPageImage && modeType === 'manual') {
          await this.preparePageIfNeeded()
        }
      })
    },

    handleImageSelect(event) {
      const file = event.target.files[0]
      if (file) {
        this.processImageFile(file)
      }
    },

    handleFileSelect(event) {
      const file = event.target.files[0]
      if (file) {
        this.processJsonFile(file)
      }
    },

    processImageFile(file) {
      this.uploadedImageFile = file
      // Create preview URL
      const reader = new FileReader()
      reader.onload = (e) => {
        this.jsonImagePreview = e.target.result
      }
      reader.readAsDataURL(file)
    },

    handleFileDrop(event) {
      this.isDraggingFile = false
      const file = event.dataTransfer.files[0]
      if (file && file.type === 'application/json') {
        this.processJsonFile(file)
      } else {
        this.jsonParseError = 'Please drop a valid JSON file'
      }
    },

    async processJsonFile(file) {
      this.jsonParseError = null
      this.uploadedJsonFile = file

      try {
        const text = await file.text()
        const data = JSON.parse(text)

        // Parse COCO format JSON
        const lines = this.parseCocoAnnotations(data)
        
        if (lines.length === 0) {
          this.jsonParseError = 'No line detections found in JSON file'
          return
        }

        // Get image dimensions from JSON
        const image = data.images && data.images[0]
        if (!image) {
          this.jsonParseError = 'No image metadata found in JSON'
          return
        }

        // Store the regions with metadata
        this.regions = lines.map(line => ({
          x: line.bbox[0],
          y: line.bbox[1],
          w: line.bbox[2],
          h: line.bbox[3],
          score: line.score,
          id: line.id
        }))

        // Store source dimensions for backend processing
        this.jsonSourceWidth = image.width
        this.jsonSourceHeight = image.height

        console.log(`Parsed ${this.regions.length} line detections from JSON`)
      } catch (error) {
        console.error('Error parsing JSON:', error)
        this.jsonParseError = `Failed to parse JSON: ${error.message}`
        this.regions = []
      }
    },

    parseCocoAnnotations(data) {
      // Extract line detections from COCO format
      // Category ID 1 is typically "Line Detection_object"
      const lineCategories = (data.categories || []).filter(cat => 
        cat.name && cat.name.toLowerCase().includes('line')
      ).map(cat => cat.id)

      if (lineCategories.length === 0) {
        console.warn('No line categories found, using category_id: 1 as fallback')
        lineCategories.push(1)
      }

      const lines = (data.annotations || []).filter(ann => 
        lineCategories.includes(ann.category_id) && ann.bbox
      )

      // Sort by y-position (top to bottom) for proper reading order
      lines.sort((a, b) => a.bbox[1] - b.bbox[1])

      return lines
    },

    getJsonBoxStyle(r) {
      // Scale the bounding box to fit the preview image display size
      const img = this.$refs.jsonPreviewImg
      if (!img || !this.jsonSourceWidth || !this.jsonSourceHeight) {
        return {
          left: `${r.x}px`,
          top: `${r.y}px`,
          width: `${r.w}px`,
          height: `${r.h}px`
        }
      }
      
      // Calculate the actual displayed size (considering object-fit: contain)
      const imgAspect = this.jsonSourceWidth / this.jsonSourceHeight
      const containerAspect = img.clientWidth / img.clientHeight
      
      let displayWidth, displayHeight, offsetX, offsetY
      
      if (imgAspect > containerAspect) {
        // Image is wider - fits to width
        displayWidth = img.clientWidth
        displayHeight = img.clientWidth / imgAspect
        offsetX = 0
        offsetY = (img.clientHeight - displayHeight) / 2
      } else {
        // Image is taller - fits to height
        displayHeight = img.clientHeight
        displayWidth = img.clientHeight * imgAspect
        offsetX = (img.clientWidth - displayWidth) / 2
        offsetY = 0
      }
      
      const scaleX = displayWidth / this.jsonSourceWidth
      const scaleY = displayHeight / this.jsonSourceHeight
      
      return {
        left: `${offsetX + (r.x * scaleX)}px`,
        top: `${offsetY + (r.y * scaleY)}px`,
        width: `${r.w * scaleX}px`,
        height: `${r.h * scaleY}px`
      }
    },

    // ---------- Prepare page (server-side cache) ----------
    async preparePageIfNeeded() {
      try {
        if (!this.currentPageImage || this.preparedJobId) return
        this.isPreparingPage = true
        const resp = await fetch(this.currentPageImage, { mode: 'cors', cache: 'no-cache' })
        if (!resp.ok) return
        const blob = await resp.blob()
        const fd = new FormData()
        fd.append('image', blob, 'manuscript_page.jpg')
        const r = await fetch(`${this.backendBase}/prepare`, {
          method: 'POST',
          body: fd,
          cache: 'no-cache',
          mode: 'cors'
        })
        if (!r.ok) return
        const data = await r.json()
        if (data && data.job_id && data.page_image) {
          this.preparedJobId = data.job_id
          this.preparedPageUrl = `${this.backendBase}/static/${data.page_image}`
        }
      } catch (e) {
        console.warn('preparePageIfNeeded failed', e)
      } finally {
        this.isPreparingPage = false
      }
    },

    // ---------- Drawing (manual selection) ----------
    stageBounds() {
      if (!this.$refs.drawStage) return null
      this.stageRect = this.$refs.drawStage.getBoundingClientRect()
      return this.stageRect
    },
    updateDrawImageMetrics() {
      const stageEl = this.$refs.drawStage
      if (!stageEl) return
      const imgEl = stageEl.querySelector('img')
      if (!imgEl) return
      this.drawImgNaturalW = imgEl.naturalWidth || 0
      this.drawImgNaturalH = imgEl.naturalHeight || 0
      this.drawImgBox = imgEl.getBoundingClientRect()
      this.stageBounds()
    },
    onDrawImgLoad() {
      this.updateDrawImageMetrics()
      this.canDraw = true
    },
    toggleDraw() {
      if (!this.canDraw) return
      this.drawActive = !this.drawActive
    },
    clearRegions() {
      this.regions = []
    },
    boxStyle(r) {
      return { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` }
    },
    getDisplayedContentBox(imgEl) {
      const rect = imgEl.getBoundingClientRect()
      const natW = imgEl.naturalWidth
      const natH = imgEl.naturalHeight
      if (!natW || !natH || !rect.width || !rect.height) {
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, offX: 0, offY: 0 }
      }
      const natAR = natW / natH
      const rectAR = rect.width / rect.height
      let contentW, contentH, offX = 0, offY = 0
      if (rectAR > natAR) {
        contentH = rect.height
        contentW = contentH * natAR
        offX = (rect.width - contentW) / 2
      } else {
        contentW = rect.width
        contentH = contentW / natAR
        offY = (rect.height - contentH) / 2
      }
      return {
        left: rect.left + offX,
        top: rect.top + offY,
        width: contentW,
        height: contentH,
        offX,
        offY,
        rect
      }
    },
    _clamp(v, min, max) { return Math.max(min, Math.min(v, max)) },
    onImgDown(e) {
      if (this.mode !== 'manual' || !this.drawActive || !this.canDraw) return
      const img = e.currentTarget
      const box = this.getDisplayedContentBox(img)
      const natW = img.naturalWidth, natH = img.naturalHeight
      const sxC = this._clamp(e.clientX - box.left, 0, box.width)
      const syC = this._clamp(e.clientY - box.top, 0, box.height)
      const scaleX = natW / box.width
      const scaleY = natH / box.height
      this.liveBox = {
        x: box.offX + sxC,
        y: box.offY + syC,
        w: 0, h: 0,
        _sxC: sxC, _syC: syC, _box: box,
        nx: Math.round(sxC * scaleX),
        ny: Math.round(syC * scaleY),
        nw: 0, nh: 0
      }
    },
    onImgMove(e) {
      if (!this.liveBox) return
      const img = e.currentTarget
      const box = this.getDisplayedContentBox(img)
      const natW = img.naturalWidth, natH = img.naturalHeight
      const scaleX = natW / box.width
      const scaleY = natH / box.height
      const cx = this._clamp(e.clientX - box.left, 0, box.width)
      const cy = this._clamp(e.clientY - box.top, 0, box.height)
      const sx = this.liveBox._sxC
      const sy = this.liveBox._syC
      const leftC = Math.min(cx, sx)
      const topC  = Math.min(cy, sy)
      const wC    = Math.abs(cx - sx)
      const hC    = Math.abs(cy - sy)
      this.liveBox.x = box.offX + leftC
      this.liveBox.y = box.offY + topC
      this.liveBox.w = wC
      this.liveBox.h = hC
      this.liveBox.nx = Math.round(leftC * scaleX)
      this.liveBox.ny = Math.round(topC  * scaleY)
      this.liveBox.nw = Math.round(wC    * scaleX)
      this.liveBox.nh = Math.round(hC    * scaleY)
    },
    onImgUp() {
      if (!this.liveBox) return
      const r = this.liveBox
      if (r.w > 6 && r.h > 6) {
        this.regions.push({ x: r.x, y: r.y, w: r.w, h: r.h, nx: r.nx, ny: r.ny, nw: r.nw, nh: r.nh })
      }
      this.liveBox = null
    },

    // ---------- Running detection ----------
    async runDetection() {
      console.log('runDetection()', { mode: this.mode, regions: this.regions.length, isAnalyzing: this.isAnalyzing })
      this.analysisCompleted = false
      this.results = null
      this.segmentationOverlay = null
      this.highlightedScribe = null
      this.segmentPreviews = Object.create(null)

      try {
        if (this.mode === 'auto') {
          await this.analyzeScribes()
        } else if (this.mode === 'json') {
          // JSON mode: use regions from uploaded JSON file + uploaded image
          const payloadRegions = this.regions.map(r => ({
            x: Math.round(r.x),
            y: Math.round(r.y),
            w: Math.round(r.w),
            h: Math.round(r.h)
          }))
          this.lastPayloadRegions = payloadRegions
          await this.analyzeScribesWithJsonImage(payloadRegions, this.jsonSourceWidth, this.jsonSourceHeight)
        } else {
          // Manual mode: use drawn regions
          const payloadRegions = this.regions.map(r => ({
            x: Math.round(r.nx), y: Math.round(r.ny),
            w: Math.round(r.nw), h: Math.round(r.nh)
          }))
          this.lastPayloadRegions = payloadRegions
          const imgEl = this.$refs.drawStage?.querySelector('img')
          const srcW = imgEl?.naturalWidth || this.drawImgNaturalW || 0
          const srcH = imgEl?.naturalHeight || this.drawImgNaturalH || 0
          await this.analyzeScribesWithRegions(payloadRegions, srcW, srcH)
        }
      } catch (err) {
        console.error('Detection error:', err)
      }
    },

    async analyzeScribes() {
      if (this.isAnalyzing) return
      this.isAnalyzing = true
      this.analysisCompleted = false
      this.results = null
      this.segmentationOverlay = null
      this.loadingMessage = 'Preparing manuscript image...'
      this.loadingDetail  = 'Initializing auto analysis'

      try {
        // Only send the image when we don't already have a prepared job
        let imageBlob = null
        if (!this.preparedJobId) {
          if (!this.currentPageImage) throw new Error('No page image available')
          const res = await fetch(this.currentPageImage, { mode: 'cors', cache: 'no-cache' })
          if (!res.ok) throw new Error('Failed to fetch page image')
          imageBlob = await res.blob()
        }

        const fd = new FormData()
        fd.append('mode', 'auto')
        if (imageBlob) fd.append('image', imageBlob, 'manuscript_page.jpg')
        if (this.preparedJobId) fd.append('prepared_job', this.preparedJobId)

        if (this.params.z_thresh) fd.append('z_thresh', String(this.params.z_thresh))
        fd.append('min_gap', String(this.params.min_gap))
        fd.append('min_run', String(this.params.min_run))
        fd.append('illum_frac', String(this.params.illum_frac))
        fd.append('sauvola_window', String(this.params.sauvola_window))
        fd.append('algo', this.params.algo)

        const ts = Date.now() + Math.random()
        const resp = await fetch(`${this.backendBase}/analyze?t=${ts}`, {
          method: 'POST',
          body: fd,
          cache: 'no-cache',
          mode: 'cors'
        })
        if (!resp.ok) throw new Error(await resp.text())

        const data = await resp.json()
        this.results = this.transformBackendResults(data)
        if (data.segmentation_overlay) {
          this.segmentationOverlay = `${this.backendBase}${data.segmentation_overlay}`
        }
        this.analysisCompleted = true
        this.$nextTick(() => this.drawPageOverlay())
      } catch (err) {
        console.error('Auto analysis error:', err)
        this.loadingMessage = 'Analysis failed'
        this.loadingDetail = err.message || 'Unknown error'
      } finally {
        this.isAnalyzing = false
      }
    },

    async analyzeScribesWithJsonImage(regions, srcW, srcH) {
      if (this.isAnalyzing) return
      this.isAnalyzing = true
      this.analysisCompleted = false
      this.results = null
      this.segmentationOverlay = null
      this.loadingMessage = 'Analyzing manuscript with JSON annotations...'
      this.loadingDetail = 'Processing uploaded image and regions'

      try {
        if (!this.uploadedImageFile) throw new Error('No image file uploaded')

        console.log('📤 JSON Analysis Request:', {
          backend: this.backendBase,
          regions: regions.length,
          imageSize: `${srcW}x${srcH}`,
          imageFile: this.uploadedImageFile.name
        })

        const formData = new FormData()
        formData.append('mode', 'json')
        formData.append('image', this.uploadedImageFile)
        formData.append('regions', JSON.stringify(regions))
        formData.append('regions_src_w', String(srcW || 0))
        formData.append('regions_src_h', String(srcH || 0))

        if (this.params.z_thresh) formData.append('z_thresh', String(this.params.z_thresh))
        formData.append('min_gap', String(this.params.min_gap))
        formData.append('min_run', String(this.params.min_run))
        formData.append('illum_frac', String(this.params.illum_frac))
        formData.append('sauvola_window', String(this.params.sauvola_window))
        formData.append('algo', this.params.algo)

        const ts = Date.now() + Math.random()
        const url = `${this.backendBase}/analyze?t=${ts}&mode=json`
        console.log('🚀 Sending request to:', url)
        
        const response = await fetch(url, {
          method: 'POST',
          body: formData,
          cache: 'no-cache'
        })
        
        console.log('📥 Response status:', response.status, response.statusText)

        if (!response.ok) throw new Error(await response.text())
        const data = await response.json()

        this.results = this.transformBackendResults(data)
        if (data.segmentation_overlay) {
          this.segmentationOverlay = `${this.backendBase}${data.segmentation_overlay}`
        }
        this.analysisCompleted = true
        this.$nextTick(() => this.drawPageOverlay())
      } catch (err) {
        console.error('JSON analysis error:', err)
        this.loadingMessage = 'Analysis failed'
        this.loadingDetail = err.message || 'Unknown error'
      } finally {
        this.isAnalyzing = false
      }
    },

    async analyzeScribesWithRegions(regions, srcW = 0, srcH = 0) {
      console.log('=== MANUAL MODE ANALYSIS START ===', { regions, srcW, srcH, params: this.params })
      if (this.isAnalyzing) return

      this.isAnalyzing = true
      this.analysisCompleted = false
      this.results = null
      this.segmentationOverlay = null
      this.loadingMessage = 'Preparing manuscript image...'
      this.loadingDetail  = 'Decoding and pre-processing for region analysis'

      try {
        if (!this.currentPageImage) throw new Error('No page image available for analysis')

        // Only send the image when we don't already have a prepared job
        let imageBlob = null
        if (!this.preparedJobId) {
          this.loadingMessage = 'Loading page image...'
          this.loadingDetail  = 'Converting image for processing'
          const imageResponse = await fetch(this.currentPageImage, { mode: 'cors', cache: 'no-cache' })
          if (!imageResponse.ok) throw new Error('Failed to fetch page image')
          imageBlob = await imageResponse.blob()
        }

        this.loadingMessage = 'Configuring manual analysis...'
        this.loadingDetail  = 'Mapping selections and segmenting lines'

        const formData = new FormData()
        formData.append('mode', 'manual')
        formData.append('regions', JSON.stringify(regions))
        formData.append('regions_src_w', String(srcW || 0))
        formData.append('regions_src_h', String(srcH || 0))
        if (imageBlob) formData.append('image', imageBlob, 'manuscript_page.jpg')
        if (this.preparedJobId) formData.append('prepared_job', this.preparedJobId)

        if (this.params.z_thresh) formData.append('z_thresh', String(this.params.z_thresh))
        formData.append('min_gap', String(this.params.min_gap))
        formData.append('min_run', String(this.params.min_run))
        formData.append('illum_frac', String(this.params.illum_frac))
        formData.append('sauvola_window', String(this.params.sauvola_window))
        formData.append('algo', this.params.algo)

        this.loadingMessage = 'Extracting line features...'
        this.loadingDetail  = 'Measuring stroke width, spacing, and slant'

        const ts = Date.now() + Math.random()
        const response = await fetch(`${this.backendBase}/analyze?t=${ts}&mode=manual`, {
          method: 'POST',
          body: formData,
          cache: 'no-cache',
          mode: 'cors'
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Analysis failed: ${response.status} ${response.statusText}\n${errorText}`)
        }

        const data = await response.json()
        this.loadingMessage = 'Clustering styles and scoring...'
        this.loadingDetail  = 'Detecting scribe transitions and computing confidence'

        this.results = this.transformBackendResults(data)
        if (data.segmentation_overlay) {
          this.segmentationOverlay = `${this.backendBase}${data.segmentation_overlay}`
        }

        this.analysisCompleted = true
        this.loadingMessage = 'Analysis complete!'
        this.loadingDetail  = `Detected ${data.statistics?.total_scribes || 'multiple'} scribes in selected regions`

        this.$nextTick(() => this.drawPageOverlay())
      } catch (error) {
        console.error('Manual analysis error:', error)
        this.loadingMessage = 'Analysis failed'
        this.loadingDetail  = error.message || 'Unknown error occurred'
        throw error
      } finally {
        this.isAnalyzing = false
      }
    },

    analyzeAgain() {
      this.resetAnalysis()
    },

    // ---------- Results helpers / previews ----------
    onAnalyzedImageLoad() {
      this.drawPageOverlay()
    },
    highlightScribe(scribeName) {
      this.highlightedScribe = scribeName
    },
    handleImageError(event) {
      console.error('Failed to load image:', event.target.src)
      event.target.style.display = 'none'
    },
    onScribeSampleError(event) {
      console.error('Failed to load scribe sample image:', event.target.src)
      event.target.style.display = 'none'
      const container = event.target.parentElement
      if (container && !container.querySelector('.sample-error')) {
        const errorMsg = document.createElement('div')
        errorMsg.className = 'sample-error'
        errorMsg.textContent = 'Image not available'
        container.appendChild(errorMsg)
      }
    },

    lineScreenshotsFor(change) {
      try {
        const shots = (this.results?.line_screenshots || [])
          .filter(ls => {
            const ln = ls.lineNumber || ls.line_number
            return typeof ln === 'number' &&
              ln >= (change.start_line ?? change.line_number ?? 1) &&
              ln <= (change.end_line ?? change.line_number ?? 1)
          })
          .map(ls => ls.screenshot || ls.image || ls.data)
          .filter(Boolean)

        if (shots.length <= 3) return shots
        const mid = Math.floor(shots.length / 2)
        const last = shots.length - 1
        return [shots[0], shots[mid], shots[last]]
      } catch (e) {
        console.warn('Failed to derive line screenshots for change', change, e)
        return []
      }
    },

    previewImagesFor(change) {
      const ocrShots = this.lineScreenshotsFor(change)
      if (ocrShots && ocrShots.length) return ocrShots
      const segImgs = this.lineSegmentImagesFor(change)
      return segImgs || []
    },

    lineSegmentImagesFor(change) {
      const idx = change && typeof change.__index === 'number' ? change.__index : null
      if (idx == null) return []
      return this.segmentPreviews[idx] || []
    },

    captureLineScreenshot(change, index) {
      try {
        const imgs = this.generateFallbackPreviews(change)
        if (imgs && imgs.length) {
          this.$set ? this.$set(this.segmentPreviews, index, imgs) : (this.segmentPreviews[index] = imgs)
        }
      } catch (e) {
        console.warn('captureLineScreenshot failed', e)
      }
    },

    generateFallbackPreviews(change) {
      try {
        const imgEl = this.$refs.manuscriptImage
        if (!imgEl || !imgEl.complete || imgEl.naturalWidth === 0) return []

        const totalLines = this.results?.statistics?.total_lines || this.results?.total_lines || 30
        const startLineIndex = Math.max(0, (change.start_line || 1) - 1)
        const endLineIndex = Math.max(startLineIndex, (change.end_line || (startLineIndex + 1)) - 1)

        const splits = (endLineIndex > startLineIndex + 1)
          ? [[startLineIndex, Math.floor((startLineIndex + endLineIndex) / 2)],
             [Math.floor((startLineIndex + endLineIndex) / 2) + 1, endLineIndex]]
          : [[startLineIndex, endLineIndex]]

        const out = []
        const W = imgEl.naturalWidth
        const H = imgEl.naturalHeight
        const topMargin = 0.08
        const bottomMargin = 0.12
        const textAreaHeight = 1 - topMargin - bottomMargin
        const lineSpacing = textAreaHeight / totalLines

        for (const [sIdx, eIdx] of splits) {
          const startY = topMargin + ((sIdx - 0.6) * lineSpacing)
          const endY   = topMargin + ((eIdx + 1.6) * lineSpacing)
          const cropX = 0.02, cropWidth = 0.96
          const cropY = Math.max(0, startY)
          const cropHeight = Math.min(1 - cropY, endY - startY)

          const sx = Math.round(cropX * W)
          const sy = Math.round(cropY * H)
          const sw = Math.round(cropWidth * W)
          const sh = Math.round(cropHeight * H)
          if (sw <= 4 || sh <= 4) continue

          const canvas = document.createElement('canvas')
          const cw = 600
          const ch = Math.max(140, Math.round(cw * (sh / sw)))
          canvas.width = cw
          canvas.height = ch
          const ctx = canvas.getContext('2d')
          ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, cw, ch)
          out.push(canvas.toDataURL('image/png'))
        }
        return out
      } catch (e) {
        console.warn('Fallback preview generation failed', e)
        return []
      }
    },

    // ---------- Copy / text helpers ----------
    formatLineRange(start, end) {
      const s = Number(start ?? 1)
      const e = Number(end ?? s)
      return (e && e !== s) ? `lines ${s}–${e}` : `line ${s}`
    },
    lastRangeForScribe(name, uptoIndex) {
      if (!this.results?.scribe_changes) return null
      for (let i = uptoIndex - 1; i >= 0; i--) {
        const c = this.results.scribe_changes[i]
        if (c && c.scribe === name) {
          const s = c.start_line ?? c.line_number ?? 1
          const e = c.end_line ?? s
          return this.formatLineRange(s, e)
        }
      }
      return null
    },
    isScribeReturn(name, uptoIndex) {
      return !!this.lastRangeForScribe(name, uptoIndex)
    },
    explain(change, index) {
      const s = change.start_line ?? change.line_number ?? 1
      const e = change.end_line ?? s
      const rangeText = this.formatLineRange(s, e)
      const lines = []

      const prevChange = index > 0 && Array.isArray(this.results?.scribe_changes)
        ? this.results.scribe_changes[index - 1]
        : null

      if (index === 0 || change.is_initial === true) {
        lines.push(`Initial hand: ${change.scribe}. Writes ${rangeText}.`)
      } else {
        const prevRange = this.lastRangeForScribe(change.scribe, index)
        if (prevRange) {
          lines.push(`Scribe ${change.scribe} returns — previously ${prevRange}. Now ${rangeText}.`)
        } else {
          lines.push(`New hand detected: ${change.scribe} takes over ${rangeText}.`)
        }
      }

      const featureNarrative = this.describeFeatureNarrative(change.features, prevChange?.features)
      if (featureNarrative) {
        lines.push(featureNarrative)
      }

      if (typeof change.confidence === 'number' && !change.is_initial) {
        lines.push(this.describeConfidence(change.confidence))
      }

      return lines.join('\n')
    },

    describeConfidence(raw) {
      const value = Math.max(0, Math.min(100, Math.round(raw)))
      let tier = 'moderate support'
      if (value >= 85) tier = 'strong support'
      else if (value < 60) tier = 'lower confidence'
      return `Confidence: ${value}% (${tier}).`
    },

    describeFeatureNarrative(features, prevFeatures) {
      if (!features || typeof features !== 'object') {
        return null
      }

      const comparisons = this.buildFeatureComparisons(features, prevFeatures)
      if (comparisons.length) {
        return `Compared with the previous hand, ${comparisons.slice(0, 2).join('; ')}.`
      }

      const cues = this.buildFeatureCues(features)
      if (cues.length) {
        return `Visual cues: ${cues.slice(0, 3).join(', ')}.`
      }

      return 'Visual cues: noticeable shifts in stroke weight, spacing, and rhythm.'
    },

    buildFeatureComparisons(current, previous = {}) {
      if (!previous || typeof previous !== 'object') return []
      const phrases = []
      const keys = this.featurePriorityList()
      keys.forEach(key => {
        const curr = current?.[key]
        const prev = previous?.[key]
        if (curr == null || prev == null) return
        const phrase = this.describeFeatureDifference(key, prev, curr)
        if (phrase) phrases.push(phrase)
      })
      return phrases
    },

    buildFeatureCues(features) {
      const phrases = []
      const keys = this.featurePriorityList()
      keys.forEach(key => {
        const value = features?.[key]
        if (value == null) return
        const phrase = this.describeFeatureValue(key, value)
        if (phrase) phrases.push(phrase)
      })
      return phrases
    },

    featurePriorityList() {
      return [
        'inkColor', 'ink_colour', 'ink_tone',
        'slant', 'slant_angle', 'slantAngle', 'slant_consistency',
        'baseline_straightness', 'baselineStraightness',
        'letterSpacing', 'letter_spacing',
        'word_spacing', 'wordSpacing',
        'handSize',
        'style',
        'stroke_texture', 'stroke_texture_variance',
        'avg_stroke_width', 'stroke_width_variance',
        'pressure_avg', 'pressure_variance',
        'curvature_avg', 'angularity_score',
        'letter_height_avg', 'letter_height_variance'
      ]
    },

    describeFeatureDifference(key, prev, curr) {
      if (typeof curr === 'string' && typeof prev === 'string') {
        if (curr.toLowerCase() === prev.toLowerCase()) return null
        return `${this.friendlyFeatureName(key)} shifts from ${prev.toLowerCase()} to ${curr.toLowerCase()}`
      }
      if (typeof curr === 'number' && typeof prev === 'number') {
        const delta = curr - prev
        if (!Number.isFinite(delta)) return null
        const threshold = this.featureDifferenceThreshold(key, prev)
        if (Math.abs(delta) < threshold) return null
        const direction = delta > 0 ? 'increases' : 'drops'
        const numericText = this.formatNumericPair(key, prev, curr)
        return `${this.friendlyFeatureName(key)} ${direction} ${numericText}`
      }
      return null
    },

    describeFeatureValue(key, value) {
      if (typeof value === 'string') {
        return this.describeStringFeature(key, value)
      }
      if (typeof value === 'number') {
        return this.describeNumericFeature(key, value)
      }
      return null
    },

    describeStringFeature(key, value) {
      const v = value.toLowerCase()
      const name = this.friendlyFeatureName(key)
      switch (key) {
        case 'inkColor':
        case 'ink_colour':
        case 'ink_tone':
          return `${name} leans ${v}`
        case 'letterSpacing':
        case 'letter_spacing':
          return `${name} appears ${v}`
        case 'style':
          return `overall style feels ${v}`
        case 'handSize':
          return `hand size reads as ${v}`
        default:
          return `${name} looks ${v}`
      }
    },

    describeNumericFeature(key, value) {
      if (!Number.isFinite(value)) return null
      switch (key) {
        case 'slant':
        case 'slant_angle':
        case 'slantAngle': {
          const angle = Math.round(value)
          const lean = angle > 0 ? 'right' : angle < 0 ? 'left' : 'upright'
          return `slant angle leans ${lean} (~${Math.abs(angle)}°)`
        }
        case 'slant_consistency': {
          const tier = value >= 0.85 ? 'very consistent' : value >= 0.7 ? 'steady' : 'varied'
          return `slant consistency is ${tier} (${value.toFixed(2)})`
        }
        case 'baseline_straightness':
        case 'baselineStraightness': {
          const tier = value >= 0.9 ? 'level baselines' : value >= 0.75 ? 'mostly steady baselines' : 'wavering baselines'
          return `${tier} (${value.toFixed(2)})`
        }
        case 'avg_stroke_width':
          return `stroke width averages ${value.toFixed(2)} px`
        case 'stroke_width_variance':
          return `stroke width variation at ${value.toFixed(2)}`
        case 'pressure_avg': {
          const tier = value >= 0.65 ? 'firm pressure' : value >= 0.45 ? 'medium pressure' : 'light pressure'
          return `${tier} (${value.toFixed(2)})`
        }
        case 'pressure_variance':
          return `pressure modulation ${value.toFixed(2)}`
        case 'curvature_avg':
          return `stroke curvature averages ${value.toFixed(2)}`
        case 'angularity_score':
          return `angularity score ${value.toFixed(2)}`
        case 'letter_spacing':
        case 'letterSpacing':
          return `letter spacing metric ${value.toFixed(2)}`
        case 'word_spacing':
        case 'wordSpacing':
          return `word spacing metric ${value.toFixed(2)}`
        case 'letter_height_avg':
          return `average letter height ${value.toFixed(1)} px`
        case 'letter_height_variance':
          return `letter height variance ${value.toFixed(2)}`
        default:
          return `${this.friendlyFeatureName(key)} ${value.toFixed(2)}`
      }
    },

    friendlyFeatureName(key) {
      const map = {
        inkColor: 'ink tone',
        ink_colour: 'ink tone',
        ink_tone: 'ink tone',
        slant: 'slant angle',
        slant_angle: 'slant angle',
        slantAngle: 'slant angle',
        slant_consistency: 'slant consistency',
        baseline_straightness: 'baseline straightness',
        baselineStraightness: 'baseline straightness',
        letterSpacing: 'letter spacing',
        letter_spacing: 'letter spacing',
        word_spacing: 'word spacing',
        wordSpacing: 'word spacing',
        handSize: 'hand size',
        style: 'style',
        avg_stroke_width: 'stroke width',
        stroke_width_variance: 'stroke width variance',
        pressure_avg: 'pressure',
        pressure_variance: 'pressure variation',
        curvature_avg: 'stroke curvature',
        angularity_score: 'angularity',
        letter_height_avg: 'letter height',
        letter_height_variance: 'letter height variance'
      }
      if (map[key]) return map[key]
      return key.replace(/[_\W]+/g, ' ').trim()
    },

    featureDifferenceThreshold(key, prevValue) {
      const absolute = {
        slant: 2,
        slant_angle: 2,
        slantAngle: 2,
        baseline_straightness: 0.05,
        baselineStraightness: 0.05,
        pressure_avg: 0.05,
        pressure_variance: 0.05,
        avg_stroke_width: 0.15,
        stroke_width_variance: 0.1,
        letter_spacing: 0.3,
        word_spacing: 0.5,
        letterSpacing: 0.3,
        wordSpacing: 0.5,
        letter_height_avg: 0.8,
        letter_height_variance: 0.2
      }
      if (absolute[key] != null) return absolute[key]
      const base = Math.abs(prevValue) || 1
      return Math.max(0.05 * base, 0.05)
    },

    formatNumericPair(key, prev, curr) {
      if (['slant', 'slant_angle', 'slantAngle'].includes(key)) {
        return `(from ${Math.round(prev)}° to ${Math.round(curr)}°)`
      }
      if (['letter_height_avg', 'avg_stroke_width'].includes(key)) {
        return `(from ${prev.toFixed(1)} to ${curr.toFixed(1)} px)`
      }
      return `(from ${prev.toFixed(2)} to ${curr.toFixed(2)})`
    },

    transformBackendResults(data) {
      // Preserve original fields; normalize scribe_changes and tack on indices for preview cache
      const normalized = Array.isArray(data?.scribe_changes)
        ? data.scribe_changes.map((ch, idx) => ({
            ...ch,
            __index: idx,
            is_initial: ch.is_initial === true || idx === 0
          }))
        : []
      return { ...data, scribe_changes: normalized }
    },

    // ---------- Overlay ----------
    drawPageOverlay() {
      try {
        const canvas = this.$refs.pageOverlay
        const image  = this.$refs.manuscriptImage
        if (!canvas || !image) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Size canvas to displayed image box
        canvas.width  = image.clientWidth
        canvas.height = image.clientHeight
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        if (!this.debugOverlayEnabled) return

        // Map natural-image pixel coords -> displayed coords within object-fit: contain box
        const natW = image.naturalWidth || 1
        const natH = image.naturalHeight || 1
        const box  = this.getDisplayedContentBox(image)
        const scaleX = box.width  / natW
        const scaleY = box.height / natH

        ctx.save()
        ctx.translate(0, 0)

        // Draw manual selection regions (if any ran)
        if (Array.isArray(this.lastPayloadRegions) && this.lastPayloadRegions.length) {
          ctx.strokeStyle = 'rgba(220,38,38,0.95)' // red
          ctx.lineWidth = 2
          ctx.fillStyle = 'rgba(220,38,38,0.15)'
          this.lastPayloadRegions.forEach(r => {
            const x = Math.round(box.offX + r.x * scaleX)
            const y = Math.round(box.offY + r.y * scaleY)
            const w = Math.round(r.w * scaleX)
            const h = Math.round(r.h * scaleY)
            ctx.strokeRect(x, y, w, h)
            ctx.fillRect(x, y, w, h)
          })
        }

        // Optionally: draw backend-provided regions if present
        if (Array.isArray(this.results?.regions) && this.results.regions.length) {
          ctx.strokeStyle = 'rgba(59,130,246,0.95)' // blue
          ctx.lineWidth = 2
          this.results.regions.forEach(({ x, y, width, height }) => {
            const rx = Math.round(box.offX + (x || 0) * scaleX)
            const ry = Math.round(box.offY + (y || 0) * scaleY)
            const rw = Math.round((width  || 0) * scaleX)
            const rh = Math.round((height || 0) * scaleY)
            ctx.strokeRect(rx, ry, rw, rh)
          })
        }
        ctx.restore()
      } catch (e) {
        console.warn('drawPageOverlay failed', e)
      }
    },

    // ---------- Export ----------
    async exportPDF() {
      try {
        const el = this.$refs.exportWrapper || this.$el.querySelector('.results-section')
        if (!el) return
        const { jsPDF } = await import('jspdf')
        const html2canvas = (await import('html2canvas')).default
        const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
        const pdf = new jsPDF('p', 'pt', 'a4')
        const pageWidth = pdf.internal.pageSize.getWidth()
        const pageHeight = pdf.internal.pageSize.getHeight()
        const margin = 24
        const contentWidthPt = pageWidth - margin * 2
        const scale = contentWidthPt / canvas.width
        const contentHeightPt = canvas.height * scale
        const pageContentHeightPt = pageHeight - margin * 2

        if (contentHeightPt <= pageContentHeightPt) {
          const imgData = canvas.toDataURL('image/png')
          pdf.addImage(imgData, 'PNG', margin, margin, contentWidthPt, contentHeightPt)
        } else {
          const pageCanvasHeightPx = Math.floor(pageContentHeightPt / scale)
          let y = 0
          while (y < canvas.height) {
            const sliceHeight = Math.min(pageCanvasHeightPx, canvas.height - y)
            const sliceCanvas = document.createElement('canvas')
            sliceCanvas.width = canvas.width
            sliceCanvas.height = sliceHeight
            const sctx = sliceCanvas.getContext('2d')
            sctx.drawImage(canvas, 0, y, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)
            const sliceImg = sliceCanvas.toDataURL('image/png')
            const sliceHeightPt = sliceHeight * scale
            if (y > 0) pdf.addPage()
            pdf.addImage(sliceImg, 'PNG', margin, margin, contentWidthPt, sliceHeightPt)
            y += sliceHeight
          }
        }
        pdf.save(`scribe-analysis-page-${this.currentPage || 1}.pdf`)
      } catch (e) {
        console.error(e)
        alert('Failed to export PDF')
      }
    },

    // ---------- Reset helpers ----------
    _resetPreparedAndDrawing() {
      this.preparedJobId = null
      this.preparedPageUrl = null
      this.regions = []
      this.liveBox = null
      this.lastPayloadRegions = []
      this.canDraw = false
      this.drawActive = false
      this.results = null
      this.analysisCompleted = false
      this.segmentPreviews = Object.create(null)
      this.$nextTick(() => this.drawPageOverlay())
    },
  }
}
</script>


<style scoped>
/* New Two-Step Flow Styles */
.scribe-modal{
  position: fixed; inset: 0;
  background: hsl(var(--foreground) / 0.35);
  display:flex; align-items:center; justify-content:center;
  z-index: var(--z-modal, 500);
}
.scribe-card{
  width: min(980px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  overflow: auto;
  background: hsl(var(--background));
  border-radius: var(--radius-lg, 14px);
  box-shadow: var(--shadow-modal, 0 18px 34px rgba(0,0,0,.22));
  padding: 16px 18px 18px;
}
.scribe-header{
  display:flex; align-items:center; justify-content:space-between;
  margin-bottom: 8px;
  background: hsl(var(--card));
  padding: 12px 18px;
  border-radius: var(--radius-lg, 14px) var(--radius-lg, 14px) 0px 0px;
  margin: -16px -18px 0px -18px;
  border-bottom: 1px solid hsl(var(--border));
  position: relative;
  overflow: hidden;
}

.scribe-header > * {
  position: relative;
  z-index: 2;
}

/* Add separator between header and content */
.scribe-header + .steps {
  border-top: 1px solid hsl(var(--border));
  margin-top: 16px !important;
  padding-top: 8px;
}

.scribe-header h3{
  margin:0;
  font-size: 22px;
  color: hsl(var(--primary));
  font-weight: 700;
  letter-spacing: 0.5px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.pharaonic-icon {
  width: 32px;
  height: 32px;
  transition: all 0.3s ease;
}
.pharaonic-icon:hover {
  transform: scale(1.05);
}
.pharosight-text {
  font-weight: 700;
  color: hsl(var(--primary));
  font-size: 20px;
  letter-spacing: 1px;
}
.icon-btn{
  border:none;
  background: hsl(var(--muted));
  cursor:pointer;
  font-size:20px;
  color: hsl(var(--foreground));
  transition: all 0.2s ease;
  padding: 6px 8px;
  border-radius: var(--radius-md, 6px);
  border: 1px solid hsl(var(--border));
}
.icon-btn:hover {
  background: hsl(var(--primary) / 0.1);
  border-color: hsl(var(--primary));
  transform: scale(1.1);
}

.steps{
  display:flex; align-items:center; gap:10px; margin:8px 0 16px;
}
.step{
  display:flex; align-items:center; gap:8px;
  padding:8px 10px; border-radius:10px; background:hsl(var(--primary) / 0.1); color:hsl(var(--primary));
  font-weight:600; opacity:.7;
}
.step.active{ opacity:1; background:hsl(var(--primary) / 0.15); }
.step span{
  width:22px; height:22px; border-radius:50%; background:hsl(var(--primary)); color:hsl(var(--primary-foreground));
  display:inline-flex; align-items:center; justify-content:center; font-size:12px;
}
.line{ height:1px; flex:1; background:hsl(var(--border)); }

.step-pane{ padding: 8px 2px 2px; }
.helper{ color:hsl(var(--muted-foreground)); margin:6px  0 12px; }

.method-grid{
  display:grid; grid-template-columns: repeat(3, 1fr); gap:12px;
}
.method-card{
  border:2px solid hsl(var(--border)); border-radius:var(--radius-lg, 12px); padding:14px;
  text-align:left; background:hsl(var(--muted)); cursor:pointer;
  transition: all 0.2s ease;
}
.method-card:hover{ border-color:hsl(var(--primary) / 0.5); background:hsl(var(--primary) / 0.05); }
.method-card.selected{ border-color:hsl(var(--primary)); box-shadow:0 0 0 2px hsl(var(--primary) / 0.2); background:hsl(var(--primary) / 0.1); }
.method-card.disabled{ cursor:not-allowed; filter:grayscale(1); opacity:.6; }
.method-title{ font-weight:700; color:hsl(var(--foreground)); }
.method-sub{ color:hsl(var(--muted-foreground)); font-size:13px; margin-top:3px; }
.hourglass{ opacity:.85; }

.draw-wrap{ margin-top: 12px; }
.json-upload-wrap{ margin-top: 12px; }

.upload-section {
  margin-bottom: 16px;
}

.upload-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
  margin-bottom: 8px;
}

.upload-area {
  border: 2px dashed hsl(var(--border));
  border-radius: var(--radius-lg, 12px);
  padding: 32px;
  text-align: center;
  background: hsl(var(--muted));
  transition: all 0.2s ease;
  cursor: pointer;
}

.upload-area:hover {
  border-color: hsl(var(--primary));
  background: hsl(var(--primary) / 0.05);
}

.upload-area.dragover {
  border-color: hsl(var(--primary));
  background: hsl(var(--primary) / 0.1);
  transform: scale(1.02);
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.upload-icon {
  font-size: 48px;
  opacity: 0.7;
}

.upload-text {
  color: hsl(var(--muted-foreground));
  font-size: 14px;
  margin: 0;
}

.file-selected {
  color: hsl(142 76% 36%);
  display: flex;
  align-items: center;
  gap: 8px;
}

.error-message {
  margin-top: 12px;
  padding: 12px;
  background: hsl(var(--destructive) / 0.1);
  border: 1px solid hsl(var(--destructive) / 0.3);
  border-radius: var(--radius-md, 8px);
  color: hsl(var(--destructive));
  font-size: 13px;
}

.json-info {
  margin-top: 12px;
  padding: 12px;
  background: hsl(var(--primary) / 0.1);
  border: 1px solid hsl(var(--primary) / 0.3);
  border-radius: var(--radius-md, 8px);
  font-size: 13px;
  color: hsl(var(--foreground));
}

.json-info p {
  margin: 4px 0;
}

.json-info strong {
  font-weight: 600;
  color: hsl(var(--primary));
}

.warning-message {
  margin-top: 12px;
  padding: 12px;
  background: hsl(45 90% 95%);
  border: 1px solid hsl(45 80% 70%);
  border-radius: var(--radius-md, 8px);
  font-size: 13px;
  color: hsl(30 80% 35%);
}

.dark .warning-message {
  background: hsl(45 50% 20%);
  border-color: hsl(45 60% 40%);
  color: hsl(45 80% 70%);
}

.warning-message strong {
  display: block;
  margin-bottom: 4px;
  color: inherit;
}

.warning-message p {
  margin: 0;
}

.json-preview-wrap {
  margin-top: 16px;
}

.preview-label {
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
  margin-bottom: 8px;
}

.json-box {
  border-color: hsl(var(--primary)) !important;
  background: hsl(var(--primary) / 0.15) !important;
}

.draw-toolbar{
 
  display:flex; align-items:center; gap:10px; margin-bottom:8px;
}
.spacer{ flex:1; }
.pill{
  background:hsl(var(--primary) / 0.1); color:hsl(var(--primary)); border:1px solid hsl(var(--primary) / 0.3);
  border-radius:999px; padding:6px 10px; font-weight:600; cursor:pointer;
  transition: all 0.2s ease;
}
.pill:hover{ background:hsl(var(--primary) / 0.15); border-color:hsl(var(--primary) / 0.5); }
.pill:disabled{ opacity:.5; cursor:not-allowed; }

.draw-stage{
  position: relative;
  background:hsl(var(--muted));
  border:1px solid hsl(var(--border)); border-radius:var(--radius-lg, 12px);
  height: 420px;             /* fixed viewport; image will contain-fit */
  overflow:hidden;
}
.draw-img{ width:100%; height:100%; object-fit: contain; user-select:none; }

.box{
  position:absolute;
  border:2px solid hsl(142 70% 45%);
  background: hsl(142 70% 45% / 0.18);
  border-radius: var(--radius-md, 6px);
  pointer-events:none;
}
.box.live{
  border-style:dashed;
  background: hsl(var(--primary) / 0.15);
  border-color: hsl(var(--primary));
}

.hint{ color:hsl(var(--muted-foreground)); font-size:12px; margin-top:8px; }

.actions{
  display:flex; justify-content:space-between; align-items: center; gap:10px; margin-top:16px;
}
.action-right { display: flex; gap: 10px; }
.ghost{
  background:hsl(var(--background)); border:1px solid hsl(var(--border)); color:hsl(var(--foreground));
  border-radius:var(--radius-md, 10px); padding:10px 14px; cursor:pointer;
  transition: all 0.2s ease;
}
.ghost:hover{ background:hsl(var(--muted)); }
.primary{
  background:hsl(var(--primary)); color:hsl(var(--primary-foreground)); border:1px solid hsl(var(--primary));
  border-radius:var(--radius-md, 10px); padding:10px 14px;
  font-weight:700; cursor:pointer;
  transition: all 0.2s ease;
}
.primary:hover{ filter:brightness(0.95); }
.secondary{
  background:hsl(var(--muted-foreground)); color:hsl(var(--background)); border:1px solid hsl(var(--muted-foreground));
  border-radius:var(--radius-md, 10px); padding:10px 14px;
  font-weight:600; cursor:pointer;
}
.primary:disabled{ opacity:.6; cursor:not-allowed; }

.tuning-section { margin-bottom: 16px; }
.results-section { margin-bottom: 16px; }
.results-header h4 { margin: 0 0 8px 0; color:hsl(var(--foreground)); }
.results-summary {
  display: flex; gap: 16px; margin-bottom: 16px;
}
.metric { display: flex; flex-direction: column; }
.metric-label { font-size: 12px; color: hsl(var(--muted-foreground)); }
.metric-value { font-weight: 600; color: hsl(var(--foreground)); }

.scribe-results { margin-top: 16px; }
.detected-scribes h5 { margin: 0 0 12px 0; color: hsl(var(--foreground)); }
.scribe-item {
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md, 8px);
  padding: 12px;
  margin-bottom: 8px;
}
.scribe-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  margin-bottom: 8px; 
}
.scribe-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: hsl(var(--primary));
}
.scribe-range {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--primary) / 0.15);
  padding: 2px 6px;
  border-radius: var(--radius-sm, 4px);
}
.scribe-explanation {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
  line-height: 1.4;
  white-space: pre-line;
}
.scribe-features {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.feature-tag {
  font-size: 11px;
  background: hsl(var(--accent) / 0.15);
  color: hsl(var(--accent));
  padding: 2px 6px;
  border-radius: 12px;
}

/* Legacy popup styles (for backwards compatibility) */
.scribe-popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: hsl(var(--foreground) / 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.scribe-popup-container {
  width: 90%;
  max-width: 1200px;
  height: 85%;
  background: hsl(var(--card));
  border-radius: var(--radius-lg, 12px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-modal, 0 25px 50px -12px rgba(0, 0, 0, 0.25));
}

.popup-header {
  background: hsl(var(--card));
  color: hsl(var(--primary));
  padding: 1.75rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid hsl(var(--border));
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.popup-header h3 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.close-button {
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  color: hsl(var(--foreground));
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm, 4px);
  transition: all 0.2s ease;
}

.close-button:hover {
  background: hsl(var(--primary) / 0.1);
  border-color: hsl(var(--primary));
  color: hsl(var(--primary));
  transform: scale(1.05);
}

.popup-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.left-panel {
  flex: 1;
  background: hsl(var(--muted));
  border-right: 1px solid hsl(var(--border));
  overflow: visible; /* Allow arrows to extend beyond panel */
  position: relative;
  padding: 0;
  margin: 0;
}

.image-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  padding: 0;
  margin: 0;
}

.manuscript-image {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* Line Screenshot Styles */
.line-screenshot-container {
  position: relative;
  margin-bottom: 12px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.line-screenshot {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 8px;
  background: #f8f9fa;
  border: 2px solid #e9ecef;
}

.screenshot-overlay {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.line-range {
  color: #ffc107;
}

.image-placeholder {
  text-align: center;
  color: #6c757d;
  padding: 2rem;
}

.page-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.page-indicator i {
  font-size: 4rem;
  color: #007bff;
  opacity: 0.7;
}

.page-indicator h4 {
  margin: 0;
  font-size: 1.5rem;
  color: #2c3e50;
}

.page-indicator p {
  margin: 0;
  font-size: 1rem;
  color: #6c757d;
}

.loading-text {
  margin-top: 1rem !important;
  font-style: italic;
  font-size: 0.9rem !important;
  color: #007bff !important;
}

.right-panel {
  flex: 1;
  background: white;
  overflow-y: auto;
  margin-left: -80px; /* Allow space for arrows from left panel */
  padding-left: 80px; /* Restore content padding */
  z-index: 5;
}

.analysis-section {
  padding: 1.5rem;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.controls-section {
  margin-bottom: 1.5rem;
}

.analyze-button {
  background: #007bff;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
  width: 100%;
}

.analyze-btn {
  background: linear-gradient(45deg, #6f42c1, #8b5fbf);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(111, 66, 193, 0.3);
}

.analyze-btn:hover:not(:disabled) {
  background: linear-gradient(45deg, #5a36a3, #7148a1);
  box-shadow: 0 4px 12px rgba(111, 66, 193, 0.4);
  transform: translateY(-1px);
}

.analyze-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.debug-btn {
  background: #17a2b8;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  margin-left: 10px;
  transition: background 0.2s ease;
}

.debug-btn:hover {
  background: #138496;
}

.analyze-button:hover:not(:disabled) {
  background: #0056b3;
}

.analyze-button:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.loading-section {
  text-align: center;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.results-section {
  flex: 1;
}

.results-section h4 {
  color: #2c3e50;
  margin-bottom: 1rem;
  font-size: 1.1rem;
}

/* PDF layout: analyzed page + results side-by-side */
.pdf-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.pdf-left {
  flex: 1;
  max-width: 45%;
}

.pdf-right {
  flex: 1.4;
}

.analyzed-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.analyzed-card-header {
  padding: 10px 12px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  font-weight: 600;
  color: #374151;
}

.analyzed-card-body {
  padding: 10px;
}

.page-stage {
  position: relative;
  width: 100%;
}

.page-overlay {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2;
}

.pdf-page-image {
  display: block;
  width: 100%;
  height: auto;
  background: #fff;
  object-fit: contain;
  border-radius: 6px;
  /* Removed border from image */
  border: none;
}

/* Added border to the container */
.analyzed-card {
  border: 1px solid #e5e7eb;
}

.scribe-item {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  border-left: 4px solid #1e40af;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.scribe-item.highlighted {
  border-left-color: #007bff !important;
  background: rgba(0, 123, 255, 0.1) !important;
  box-shadow: 0 0 15px rgba(0, 123, 255, 0.3);
  transform: scale(1.02);
}

.scribe-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.scribe-title {
  margin: 0;
  color: #f4d03f; /* gold like header */
  font-size: 1.2rem;
  font-weight: 800;
  text-shadow: 0 1px 3px rgba(0,0,0,0.7), 0 0 6px rgba(244, 208, 63, 0.25);
}

.scribe-range {
  font-size: 0.9rem;
  color: #6c757d;
  font-weight: 500;
}

.scribe-confidence {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  padding: 0.3rem 0.8rem;
  border-radius: 16px;
  font-size: 0.8rem;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
  white-space: nowrap;
}

.scribe-return {
  background: linear-gradient(135deg, #ffd700, #ffa500);
  color: #1a1a1a;
  padding: 0.3rem 0.8rem;
  border-radius: 16px;
  font-size: 0.8rem;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(255, 215, 0, 0.3);
  white-space: nowrap;
  margin-left: 0.5rem;
}

.scribe-samples {
  margin: 1rem 0;
  padding: 1rem;
  background: rgba(249, 250, 251, 0.8);
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.samples-title {
  margin: 0 0 0.75rem 0;
  font-size: 0.9rem;
  color: #374151;
  font-weight: 600;
}


/* Fix sample thumbnails rendering as black rectangles */
.samples-gallery {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: flex-start;
  max-width: 100%;
}

.sample-image-container {
  position: relative;
  flex: 0 0 auto;
  background: transparent;
  border: none;
  border-radius: 0;
  overflow: hidden;            /* prevent bleed while allowing natural sizing */
  box-shadow: none;
  max-width: 280px;            /* cap width so tiles don't overflow */
}

.sample-image {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 180px;           /* keep tall images contained */
  background: transparent;
  border: none;
  transition: transform 0.2s ease;
  cursor: pointer;
}

.sample-image:hover {
  transform: scale(1.02);
}

/* Dedicated preview sizing (for OCR/fallback previews) */
.preview-image-container {
  position: relative;
  flex: 0 0 auto;
  background: transparent;
  border: none;
  border-radius: 0;
  overflow: hidden;            /* keep content inside tile */
  box-shadow: none;
  max-width: 280px;            /* cap width per tile */
}

.preview-image {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 180px;           /* keep tall previews within view */
  background: transparent;
}

.sample-error {
  padding: 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
  font-size: 0.8rem;
  text-align: center;
}

.sample-image:hover {
  transform: scale(1.05);
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.sample-error {
  font-size: 0.8rem;
  color: #6b7280;
  padding: 0.5rem;
  text-align: center;
  background: #f3f4f6;
  border-radius: 4px;
  border: 1px dashed #d1d5db;
}

.confidence {
  background: #1e40af;
  color: white;
  padding: 0.4rem 0.8rem;
  border-radius: 16px;
  font-size: 0.85rem;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(30, 64, 175, 0.3);
}

.location {
  font-size: 0.9rem;
  color: #6c757d;
  margin: 1rem 0 0.5rem 0;
  font-style: italic;
  font-weight: 500;
}

.explanation {
  font-size: 0.95rem;
  color: #495057;
  margin: 0 0 1rem 0;
  line-height: 1.5;
  background: rgba(30, 64, 175, 0.05);
  padding: 0.8rem;
  border-radius: 8px;
  border-left: 3px solid #fbbf24;
}

.additional-scribes h5 {
  color: #2c3e50;
  margin: 1.5rem 0 1rem 0;
  font-size: 1rem;
}

.statistics-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e9ecef;
}

.statistics-section h5 {
  color: #2c3e50;
  margin-bottom: 1rem;
  font-size: 1rem;
}

.stat-grid {
  display: grid;
  gap: 0.75rem;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 4px;
}

.stat-label {
  color: #6c757d;
  font-size: 0.9rem;
}

.stat-value {
  font-weight: 600;
  color: #2c3e50;
}

/* Disclaimer Styling */
.analysis-disclaimer {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  border-left: 3px solid #6c757d;
}

.analysis-disclaimer h6 {
  color: #495057;
  margin: 0 0 0.75rem 0;
  font-size: 0.9rem;
  font-weight: 600;
}

.disclaimer-text {
  color: #495057;
  font-size: 0.85rem;
  line-height: 1.5;
  margin: 0 0 0.75rem 0;
}

.disclaimer-factors {
  color: #495057;
  font-size: 0.8rem;
  line-height: 1.4;
  margin: 0 0 0.75rem 0;
  padding-left: 1rem;
}

.disclaimer-factors li {
  margin-bottom: 0.4rem;
}

.disclaimer-factors strong {
  color: #343a40;
  font-weight: 600;
}

.disclaimer-conclusion {
  color: #495057;
  font-size: 0.8rem;
  line-height: 1.4;
  margin: 0;
  font-style: italic;
  border-top: 1px solid #dee2e6;
  padding-top: 0.75rem;
}

.no-results, .initial-state {
  text-align: center;
  color: #6c757d;
  padding: 2rem;
  font-style: italic;
}

/* Responsive Design */
@media (max-width: 768px) {
  .popup-content {
    flex-direction: column;
  }
  
  .left-panel {
    flex: 0 0 40%;
    border-right: none;
    border-bottom: 1px solid #e9ecef;
  }
  
  .right-panel {
    flex: 1;
  }
  
  .scribe-popup-container {
    width: 95%;
    height: 90%;
  }
}
/* Scribe preview samples styling */
.scribe-previews {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin: 8px 0 12px;
}

.scribe-shot {
  display: block;
  width: 160px;
  max-width: 30%;
  aspect-ratio: 5 / 2;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12);
  border: 1px solid rgba(147, 51, 234, 0.1);
  background: rgba(255, 255, 255, 0.05);
}

.scribe-shot:hover {
  transform: scale(1.02);
  transition: transform 0.2s ease;
}

/* Ensure scribe modal has highest z-index */
.scribe-popup-overlay {
  z-index: 7000 !important;
}

.scribe-popup-container {
  z-index: 7001 !important;
}

.export-btn { margin-left: 8px; }
.params {
  display: grid;
  grid-template-columns: repeat(3, minmax(180px, 1fr));
  gap: 8px;
  margin-top: 8px;
}
.params label { display:flex; align-items:center; gap:8px; font-size: 0.9rem; }
.param-val { opacity: 0.7; }

/* Pharaonic Theme Styles */
.pharaonic-header {
  background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%);
  border-bottom: 4px solid #fbbf24;
  position: relative;
  overflow: hidden;
  box-shadow: inset 0 -2px 10px rgba(251, 191, 36, 0.2);
}

.pharaonic-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: 
    /* Visible pharaonic geometric patterns */
    radial-gradient(circle at 20% 30%, rgba(251, 191, 36, 0.25) 2px, transparent 3px),
    radial-gradient(circle at 80% 70%, rgba(251, 191, 36, 0.2) 2px, transparent 3px),
    radial-gradient(circle at 50% 20%, rgba(251, 191, 36, 0.15) 1px, transparent 2px),
    radial-gradient(circle at 30% 80%, rgba(251, 191, 36, 0.15) 1px, transparent 2px),
    /* Pharaonic zigzag patterns */
    repeating-linear-gradient(
      45deg,
      transparent,
      transparent 15px,
      rgba(251, 191, 36, 0.12) 15px,
      rgba(251, 191, 36, 0.12) 18px,
      transparent 18px,
      transparent 30px
    ),
    repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 20px,
      rgba(251, 191, 36, 0.08) 20px,
      rgba(251, 191, 36, 0.08) 23px,
      transparent 23px,
      transparent 40px
    ),
    /* Pharaonic border pattern with hieroglyph-like lines */
    linear-gradient(
      to right,
      rgba(251, 191, 36, 0.2) 0%,
      rgba(251, 191, 36, 0.1) 5%,
      transparent 15%,
      transparent 85%,
      rgba(251, 191, 36, 0.1) 95%,
      rgba(251, 191, 36, 0.2) 100%
    ),
    /* Additional ancient Egyptian inspired pattern */
    repeating-linear-gradient(
      90deg,
      transparent,
      transparent 8px,
      rgba(251, 191, 36, 0.06) 8px,
      rgba(251, 191, 36, 0.06) 10px
    );
  background-size: 60px 60px, 80px 80px, 40px 40px, 50px 50px, 30px 30px, 35px 35px, 100% 100%, 20px 20px;
  pointer-events: none;
}

.pharaonic-title {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
  z-index: 2;
}

.pharaonic-icon {
  height: 52px;
  width: auto;
  object-fit: contain;
  filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.3));
}

.pharosight-text {
  color: #fbbf24;
  font-size: 1.5rem;
  font-weight: 700;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.3));
  margin-right: 12px;
}

.title-text {
  color: #ffffff;
  font-weight: 700;
  font-size: 1.3rem;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

.page-info {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 600;
  border: 1px solid rgba(251, 191, 36, 0.3);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* Professional Parameter Controls */
.params-container {
  background: hsl(var(--muted));
  border-radius: 12px;
  padding: 20px;
  margin: 16px 0;
  border: 2px solid hsl(var(--border));
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.params-title {
  color: hsl(var(--primary));
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0 0 16px 0;
  text-align: center;
  padding-bottom: 8px;
  border-bottom: 2px solid hsl(var(--primary) / 0.5);
}

.params-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.param-group {
  background: hsl(var(--card));
  padding: 16px;
  border-radius: 8px;
  border: 1px solid hsl(var(--border));
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
}

.param-group:hover {
  border-color: hsl(var(--primary) / 0.5);
  box-shadow: 0 4px 12px hsl(var(--primary) / 0.1);
  transform: translateY(-1px);
}

.param-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: hsl(var(--foreground));
  margin-bottom: 8px;
  font-size: 0.95rem;
}

.info-icon {
  color: hsl(var(--muted-foreground));
  cursor: help;
  font-size: 0.9rem;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: hsl(var(--muted));
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  transition: all 0.2s ease;
  position: relative;
}

.info-icon:hover {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  transform: scale(1.1);
}

/* Advanced Tooltips */
.info-icon::after {
  content: attr(data-tooltip-content);
  position: absolute;
  top: 50%;
  left: calc(100% + 15px);
  transform: translateY(-50%);
  background: hsl(var(--popover));
  color: hsl(var(--popover-foreground));
  padding: 12px;
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  border: 2px solid hsl(var(--primary));
  font-size: 0.75rem;
  line-height: 1.3;
  width: 280px;
  white-space: normal;
  z-index: 999999 !important;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
  pointer-events: none;
  font-weight: normal;
}

/* Tooltip backdrop */
.info-icon:hover::after {
  backdrop-filter: blur(2px);
}

.info-icon::before {
  content: '';
  position: absolute;
  top: 50%;
  left: calc(100% + 9px);
  transform: translateY(-50%);
  border: 6px solid transparent;
  border-right-color: hsl(var(--primary));
  z-index: 1000000 !important;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
}

.info-icon:hover::after,
.info-icon:hover::before {
  opacity: 1;
  visibility: visible;
}

/* Sensitivity tooltip */
.info-icon[data-tooltip="sensitivity"]::after {
  content: "🎯 SENSITIVITY (Z-THRESHOLD)\A\AControls how sensitive the algorithm is to detecting handwriting changes between scribes.\A\A📉 LOWER VALUES (1.2-2.0): Detect more subtle differences, may find more scribe changes but could create false positives.\A\A📈 HIGHER VALUES (2.5-3.0): Only detect major handwriting differences, more conservative but fewer false alarms.\A\A🎚️ RANGE: 1.2 to 3.0\A💡 RECOMMENDED: 2.0-2.5 for most manuscripts";
  white-space: pre-line;
}

/* Min Gap tooltip */
.info-icon[data-tooltip="min_gap"]::after {
  content: "📏 MINIMUM GAP (LINES)\A\AMinimum number of lines required between detected scribe changes.\A\A📉 LOWER VALUES (1-3): Allow scribe changes with fewer lines in between, detects rapid alternations.\A\A📈 HIGHER VALUES (4-10): Require more separation between changes, reduces noise from brief interruptions.\A\A🎚️ RANGE: 1 to 10 lines\A💡 RECOMMENDED: 2-4 for typical manuscripts\A⚠️ Too low may detect every small variation";
  white-space: pre-line;
}

/* Min Run tooltip */
.info-icon[data-tooltip="min_run"]::after {
  content: "✍️ MINIMUM RUN (LINES)\A\AMinimum number of consecutive lines a scribe must write to be considered a separate scribe.\A\A📉 LOWER VALUES (1-2): Detect brief scribe contributions, good for collaborative writing.\A\A📈 HIGHER VALUES (3-10): Only identify substantial scribe contributions, filters out corrections.\A\A🎚️ RANGE: 1 to 10 lines\A💡 RECOMMENDED: 2-3 for most cases\A⚠️ Too high may miss legitimate scribe changes";
  white-space: pre-line;
}

/* Illumination Fraction tooltip */
.info-icon[data-tooltip="illum_frac"]::after {
  content: "💡 ILLUMINATION FRACTION\A\AControls illumination correction during image preprocessing to handle uneven lighting.\A\A📉 LOWER VALUES (0.1-0.3): Minimal correction, preserves original contrast but may keep shadows.\A\A📈 HIGHER VALUES (0.4-0.8): Strong correction, removes shadows but may over-brighten.\A\A🎚️ RANGE: 0.1 to 0.8\A💡 RECOMMENDED: 0.2-0.4 for most manuscripts\A⚠️ Too high may wash out ink details";
  white-space: pre-line;
}

/* Sauvola Window tooltip */
.info-icon[data-tooltip="sauvola_window"]::after {
  content: "🖼️ SAUVOLA WINDOW SIZE\A\AWindow size for Sauvola binarization (converting grayscale to black/white).\A\A📉 SMALLER VALUES (15-25): Better for fine details and thin strokes, may be noisy.\A\A📈 LARGER VALUES (35-51): Smoother results, better for thick writing, may lose fine details.\A\A🎚️ RANGE: 15+ (odd numbers only)\A💡 RECOMMENDED: 25-35 for most manuscripts\A⚠️ Must be odd number for algorithm";
  white-space: pre-line;
}

/* Algorithm tooltip */
.info-icon[data-tooltip="algorithm"]::after {
  content: "⚙️ DETECTION ALGORITHM\A\A🤖 AUTO: Automatically selects best algorithm based on manuscript characteristics (RECOMMENDED).\A\A⛰️ PEAKS: Fast peak-detection algorithm, good for clear handwriting differences.\A\A🔬 RUPTURES: Rigorous change-point detection, more accurate but slower processing.\A\A💡 RECOMMENDED: Use 'Auto' unless you have specific requirements\A⚡ PEAKS: Fastest processing\A🎯 RUPTURES: Most accurate results";
  white-space: pre-line;
}

.input-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.range-input, .number-input, .select-input {
  flex: 1;
  padding: 8px 12px;
  border: 2px solid hsl(var(--border));
  border-radius: 6px;
  font-size: 0.95rem;
  transition: all 0.2s ease;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}

.range-input:focus, .number-input:focus, .select-input:focus {
  outline: none;
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 3px hsl(var(--primary) / 0.1);
}

.param-value {
  min-width: 45px;
  padding: 4px 8px;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.9rem;
  text-align: center;
}

/* Pharaonic Buttons */
.pharaonic-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.pharaonic-btn.primary {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border: 2px solid hsl(var(--primary));
}

.pharaonic-btn.primary:hover {
  background: hsl(var(--primary) / 0.9);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px hsl(var(--primary) / 0.3);
}

.pharaonic-btn.secondary {
  background: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
  border: 2px solid hsl(var(--secondary));
}

.pharaonic-btn.secondary:hover {
  background: hsl(var(--secondary) / 0.9);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px hsl(var(--secondary) / 0.3);
}

.pharaonic-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
}

.pharaonic-btn.small {
  padding: 8px 16px;
  font-size: 0.85rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.pharaonic-btn.small:hover {
  box-shadow: 0 4px 12px hsl(var(--primary) / 0.2);
  transform: translateY(-1px);
}

/* Results Header */
.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.results-header h4 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
}

.results-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.toolbar-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 20px;
}

/* Pharaonic Loading Animation */
.pharaonic-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  border-radius: 12px;
  margin: 20px;
  border: 3px solid #fbbf24;
  box-shadow: 0 8px 24px rgba(251, 191, 36, 0.2);
}

.pharaonic-spinner {
  position: relative;
  width: 80px;
  height: 80px;
  margin-bottom: 24px;
}

.ankh-spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
  color: #fbbf24;
  font-size: 2.5rem;
  animation: pharaonicPulse 1.5s ease-in-out infinite;
}

.ankh-spinner::before {
  content: '☥';
  display: block;
  text-align: center;
  filter: drop-shadow(0 0 10px rgba(251, 191, 36, 0.5));
}

.hieroglyph-ring {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 3px solid transparent;
  border-top: 3px solid #fbbf24;
  border-right: 3px solid #1e40af;
  border-radius: 50%;
  animation: pharaonicRotate 2s linear infinite;
}

.loading-text {
  text-align: center;
}

.loading-text h4 {
  color: #1e40af;
  font-size: 1.2rem;
  font-weight: 700;
  margin: 0 0 8px 0;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.loading-detail {
  color: #6b7280;
  font-size: 0.95rem;
  margin: 0;
  font-style: italic;
}

@keyframes pharaonicRotate {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes pharaonicPulse {
  0%, 100% { 
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  50% { 
    transform: translate(-50%, -50%) scale(1.1);
    opacity: 0.8;
  }
}

</style>
