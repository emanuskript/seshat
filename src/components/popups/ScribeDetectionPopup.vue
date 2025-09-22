<template>
  <div v-if="isVisible" class="scribe-modal" @click.self="closePopup">
    <div class="scribe-card">
      <header class="scribe-header">
        <div class="header-left">
          <img :src="require('@/assets/pharosight_icon_no_text.png')" alt="PharoSight" class="pharaonic-icon" />
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
            <div class="method-sub">Recommended • Detect lines automatically</div>
          </button>

          <!-- Option 2 -->
          <button class="method-card"
                  :class="{selected: mode==='manual'}"
                  @click="selectMode('manual')">
            <div class="method-title">Manual Line Pick</div>
            <div class="method-sub">Draw boxes on the lines you want</div>
          </button>

          <!-- Option 3 (disabled) -->
          <button class="method-card disabled" disabled>
            <div class="method-title">Import from Segmentation</div>
            <div class="method-sub">Coming soon <span class="hourglass">⏳</span></div>
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
          <div class="draw-stage"
               ref="drawStage"
               @mousedown="onDrawStart"
               @mousemove="onDrawMove"
               @mouseup="onDrawEnd"
               @mouseleave="onDrawEnd">
            <img v-if="currentPageImage" :src="currentPageImage" alt="Manuscript page"
                 class="draw-img" draggable="false" />
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

        <footer class="actions">
          <button class="ghost" @click="closePopup">Cancel</button>
          <button class="primary"
                  :disabled="mode===null"
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

          <!-- Results content would go here - keeping existing structure -->
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
                <p class="scribe-explanation">{{ change.explanation }}</p>
                
                <!-- Scribe Sample Images -->
                <div v-if="change.samples && change.samples.length > 0" class="scribe-samples">
                  <h6 class="samples-title">Sample Handwriting:</h6>
                  <div class="samples-gallery">
                    <div v-for="(sample, sampleIndex) in change.samples" :key="sampleIndex" class="sample-image-container">
                      <img :src="`http://localhost:5001${sample}`" 
                           :alt="`${change.scribe} handwriting sample ${sampleIndex + 1}`"
                           class="sample-image"
                           @error="onScribeSampleError">
                    </div>
                  </div>
                </div>
                
                <!-- Alternative: Use scribe_samples from results if samples not in change object -->
                <div v-else-if="results.scribe_samples && results.scribe_samples[change.scribe]" class="scribe-samples">
                  <h6 class="samples-title">Sample Handwriting:</h6>
                  <div class="samples-gallery">
                    <div v-for="(sample, sampleIndex) in results.scribe_samples[change.scribe]" :key="sampleIndex" class="sample-image-container">
                      <img :src="`http://localhost:5001${sample}`" 
                           :alt="`${change.scribe} handwriting sample ${sampleIndex + 1}`"
                           class="sample-image"
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
export default {
  name: 'ScribeDetectionPopup',
  props: {
    currentPage: {
      type: Number,
      default: 1
    },
    totalPages: {
      type: Number,
      default: 1
    },
    currentPageImage: {
      type: String,
      default: null
    }
  },
  data() {
    return {
      isVisible: false,
      isAnalyzing: false,
      analysisCompleted: false,
      results: null,
      segmentationOverlay: null, // Store overlay image URL
      totalLinesEstimate: 25, // Default estimate for line visualization
      highlightedScribe: null,
      loadingMessage: 'Analyzing handwriting patterns...',
      loadingDetail: 'Initializing scribe detection algorithm',
      params: {
        z_thresh: 2.5,    // Increased default threshold for better accuracy
        min_gap: 3,       // Increased to reduce false positives
        min_run: 3,       // Increased for more stable segments
        illum_frac: 0.035,
        sauvola_window: 31,
        algo: 'auto'
      },
      // New two-step flow data
      step: 1,
      mode: null, // 'auto' or 'manual'
      allowEmptyManual: false,
      // Manual drawing state
      regions: [],
      drawActive: false,
      liveBox: null,
      stageRect: null
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
          
          // Add a small delay to ensure DOM is fully rendered
          setTimeout(() => {
            this.$nextTick(() => {
              // Use OCR line screenshots if available, otherwise fall back to canvas
              if (newResults.line_screenshots && newResults.line_screenshots.length > 0) {
                console.log('Using OCR-extracted line screenshots:', newResults.line_screenshots.length)
                console.log('Sample line screenshot:', newResults.line_screenshots[0])
                this.displayOcrLineScreenshots(newResults)
              } else {
                console.log('No OCR screenshots available, using canvas method')
                console.log('line_screenshots field:', newResults.line_screenshots)
                // Capture screenshots for each scribe change using canvas
                newResults.scribe_changes.forEach((change, index) => {
                  this.captureLineScreenshot(change, index)
                })
              }
            })
          }, 100)
        }
      },
      immediate: true
    }
  },
  computed: {
    hasResults() {
      return this.results && (this.results.primary_scribe || (this.results.scribe_changes && this.results.scribe_changes.length > 0))
    },
    backendBase() {
      return 'http://localhost:5001'
    },
    runButtonDisabled() {
      const disabled = this.isAnalyzing || (this.mode === 'manual' && this.regions.length === 0)
      console.log('Run button disabled:', {
        disabled,
        isAnalyzing: this.isAnalyzing,
        mode: this.mode,
        regionsLength: this.regions.length,
        step: this.step
      })
      return disabled
    }
  },
  methods: {
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
      this.drawActive = false
      this.liveBox = null
    },

    // Two-step flow methods
    goStep(stepNum) {
      this.step = stepNum
    },

    selectMode(modeType) {
      this.mode = modeType
    },

    // Manual drawing methods
    stageBounds() {
      if (!this.$refs.drawStage) return null
      this.stageRect = this.$refs.drawStage.getBoundingClientRect()
      return this.stageRect
    },

    toStage(e) {
      const r = this.stageBounds()
      if (!r) return {x: 0, y: 0}
      return { 
        x: Math.max(0, e.clientX - r.left), 
        y: Math.max(0, e.clientY - r.top) 
      }
    },

    onDrawStart(e) {
      if (this.mode !== 'manual' || !this.drawActive) return
      const {x, y} = this.toStage(e)
      this.liveBox = { x, y, w: 0, h: 0 }
    },

    onDrawMove(e) {
      if (!this.liveBox) return
      const {x, y} = this.toStage(e)
      this.liveBox = {
        x: Math.min(x, this.liveBox.x),
        y: Math.min(y, this.liveBox.y),
        w: Math.abs(x - this.liveBox.x),
        h: Math.abs(y - this.liveBox.y),
      }
    },

    onDrawEnd() {
      if (!this.liveBox) return
      const {w, h} = this.liveBox
      if (w > 6 && h > 6) {
        this.regions.push({...this.liveBox})
      }
      this.liveBox = null
    },

    toggleDraw() {
      this.drawActive = !this.drawActive
    },

    clearRegions() {
      this.regions = []
    },

    boxStyle(r) {
      return {
        left: `${r.x}px`,
        top: `${r.y}px`,
        width: `${r.w}px`, 
        height: `${r.h}px`,
      }
    },

    // Updated detection method
    async runDetection() {
      console.log('runDetection called!', {
        mode: this.mode,
        regions: this.regions,
        regionsLength: this.regions.length,
        isAnalyzing: this.isAnalyzing
      })
      
      // FORCE COMPLETE STATE RESET before each analysis
      this.analysisCompleted = false
      this.results = null
      this.segmentationOverlay = null
      this.highlightedScribe = null
      console.log('State forcefully reset for new analysis')
      
      try {
        if (this.mode === 'auto') {
          console.log('Running AUTO mode detection...')
          // Use existing auto detection
          await this.analyzeScribes()
        } else {
          console.log('Running MANUAL mode detection with regions...')
          // Manual mode with regions
          const imgEl = this.$refs.drawStage?.querySelector('img')
          let payloadRegions = this.regions
          
          // Scale regions to original image size if needed
          if (imgEl && imgEl.naturalWidth && imgEl.naturalHeight) {
            const scaleX = imgEl.naturalWidth / imgEl.clientWidth
            const scaleY = imgEl.naturalHeight / imgEl.clientHeight
            payloadRegions = this.regions.map(r => ({
              x: Math.round(r.x * scaleX),
              y: Math.round(r.y * scaleY),
              w: Math.round(r.w * scaleX),
              h: Math.round(r.h * scaleY),
            }))
            console.log('Scaled regions:', payloadRegions)
          }
          
          await this.analyzeScribesWithRegions(payloadRegions)
        }
      } catch (error) {
        console.error('Detection error:', error)
      }
    },

    async analyzeScribesWithRegions(regions) {
      console.log('=== MANUAL MODE ANALYSIS START ===')
      console.log('Mode: MANUAL (Selected Regions)')
      console.log('Regions count:', regions.length)
      console.log('Regions detail:', regions)
      console.log('Parameters:', this.params)
      console.log('Timestamp:', new Date().toISOString())
      
      if (this.isAnalyzing) {
        console.log('Already analyzing, returning')
        return
      }
      
      this.isAnalyzing = true
      this.analysisCompleted = false
      this.results = null
      this.segmentationOverlay = null
      this.loadingMessage = 'Preparing manuscript image...'
      this.loadingDetail = 'Processing image for manual analysis'
      
      try {
        console.log('Starting manual scribe analysis with regions:', regions)

        if (!this.currentPageImage) {
          throw new Error('No page image available for analysis')
        }
        
        console.log('Current page image:', this.currentPageImage)
        
        this.loadingMessage = 'Fetching manuscript data...'
        this.loadingDetail = 'Converting image format'
        
        // Fetch the image and convert to blob for upload
        console.log('Fetching image...')
        const imageResponse = await fetch(this.currentPageImage)
        if (!imageResponse.ok) {
          throw new Error('Failed to fetch page image')
        }
        const imageBlob = await imageResponse.blob()
        console.log('Image blob created:', imageBlob.size, 'bytes')
        
        this.loadingMessage = 'Configuring manual analysis...'
        this.loadingDetail = 'Setting up detection for selected regions'
        
        // Create FormData for upload with manual mode
        const formData = new FormData()
        formData.append('image', imageBlob, 'manuscript_page.jpg')
        formData.append('mode', 'manual')
        formData.append('regions', JSON.stringify(regions))
        if (this.params.z_thresh) formData.append('z_thresh', String(this.params.z_thresh))
        formData.append('min_gap', String(this.params.min_gap))
        formData.append('min_run', String(this.params.min_run))
        formData.append('illum_frac', String(this.params.illum_frac))
        formData.append('sauvola_window', String(this.params.sauvola_window))
        formData.append('algo', this.params.algo)
        
        console.log('FormData prepared with:', {
          mode: 'manual',
          regions: regions,
          params: this.params
        })
        
        this.loadingMessage = 'Analyzing selected regions...'
        this.loadingDetail = 'Running scribe detection on manual selections'
        
        // Call the Python backend with aggressive cache-busting
        console.log('Calling backend at http://localhost:5001/analyze...')
        const timestamp = Date.now() + Math.random()  // Extra random for uniqueness
        const response = await fetch(`http://localhost:5001/analyze?t=${timestamp}&mode=manual`, {
          method: 'POST',
          body: formData,
          cache: 'no-cache',  // Disable caching
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        })
        
        console.log('Backend response status:', response.status, response.statusText)
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error('Backend error response:', errorText)
          throw new Error(`Analysis failed: ${response.status} ${response.statusText}\n${errorText}`)
        }
        
        const data = await response.json()
        console.log('Manual analysis complete:', data)
        
        this.results = data
        if (data.segmentation_overlay) {
          this.segmentationOverlay = `${this.backendBase}${data.segmentation_overlay}`
        }
        
        this.analysisCompleted = true
        this.loadingMessage = 'Analysis complete!'
        this.loadingDetail = `Detected ${data.statistics?.total_scribes || 'multiple'} scribes in selected regions`
        
      } catch (error) {
        console.error('Manual analysis error:', error)
        this.loadingMessage = 'Analysis failed'
        this.loadingDetail = error.message || 'Unknown error occurred'
        throw error
      } finally {
        console.log('Setting isAnalyzing to false')
        this.isAnalyzing = false
      }
    },
    
    analyzeAgain() {
      this.resetAnalysis()
      // This will show the parameter controls again since hasResults will be false
    },
    
    onImageLoad() {
      console.log('Manuscript image loaded successfully')
    },
    
    highlightScribe(scribeName) {
      this.highlightedScribe = scribeName
    },
    
    handleImageError(event) {
      console.error('Failed to load scribe sample image:', event.target.src)
      event.target.style.display = 'none'
    },
    
    onScribeSampleError(event) {
      console.error('Failed to load scribe sample image:', event.target.src)
      event.target.style.display = 'none'
      // Optionally, show a placeholder or error message
      const container = event.target.parentElement
      if (container && !container.querySelector('.sample-error')) {
        const errorMsg = document.createElement('div')
        errorMsg.className = 'sample-error'
        errorMsg.textContent = 'Image not available'
        container.appendChild(errorMsg)
      }
    },
    
    isScribeReturn(scribeName, currentIndex) {
      // Check if this scribe appeared earlier in the list
      if (!this.results?.scribe_changes || currentIndex === 0) return false
      
      for (let i = 0; i < currentIndex; i++) {
        if (this.results.scribe_changes[i].scribe === scribeName) {
          return true
        }
      }
      return false
    },
    
    handleImageLoad(event) {
      console.log('Scribe sample image loaded successfully:', event.target.src)
    },
    
    displayOcrLineScreenshots(results) {
      console.log('Displaying OCR line screenshots')
      console.log('Available screenshots:', results.line_screenshots?.length || 0)
      
      // If no OCR screenshots, use canvas method
      if (!results.line_screenshots || results.line_screenshots.length === 0) {
        console.log('No OCR screenshots available, using canvas fallback')
        return
      }
      
      // Update each canvas with the corresponding screenshot
      results.scribe_changes.forEach((change, index) => {
        // Find the canvas for this scribe change
        this.$nextTick(() => {
          const canvas = this.$refs[`lineCanvas${index}`]
          if (!canvas || !canvas[0]) {
            console.warn(`Canvas ref not found for index ${index}`)
            return
          }
          
          // Find OCR screenshots for this scribe change
          const relatedScreenshots = results.line_screenshots.filter(lineData => 
            lineData.lineNumber >= change.start_line && lineData.lineNumber <= change.end_line
          )
          
          console.log(`Scribe change ${change.scribe}: found ${relatedScreenshots.length} related screenshots`)
          
          if (relatedScreenshots.length > 0) {
            // Use the first related screenshot
            const lineData = relatedScreenshots[0]
            const ctx = canvas[0].getContext('2d')
            
            // Create an image from the base64 data
            const img = new Image()
            img.onload = () => {
              // Clear the canvas
              ctx.clearRect(0, 0, canvas[0].width, canvas[0].height)
              
              // Draw the screenshot image
              ctx.drawImage(img, 0, 0, canvas[0].width, canvas[0].height)
              
              console.log(`Successfully displayed screenshot for line ${lineData.lineNumber}`)
            }
            
            img.onerror = () => {
              console.error(`Failed to load screenshot for line ${lineData.lineNumber}`)
              // Draw error indicator
              ctx.fillStyle = '#ff0000'
              ctx.fillRect(0, 0, canvas[0].width, canvas[0].height)
              ctx.fillStyle = '#ffffff'
              ctx.font = '12px Arial'
              ctx.fillText('Image Load Error', 10, 30)
            }
            
            // Set the image source to trigger loading
            img.src = lineData.screenshot
          }
        })
      })
      
      console.log('OCR line screenshots display complete')
    },
    
    captureLineScreenshot(change, index) {
      // Use a longer timeout to ensure everything is rendered
      setTimeout(() => {
        this.$nextTick(() => {
          const canvas = this.$refs[`lineCanvas${index}`]
          if (!canvas || !canvas[0]) {
            console.warn(`Canvas ref not found for index ${index}`)
            return
          }
          
          const ctx = canvas[0].getContext('2d')
          const manuscriptImg = this.$refs.manuscriptImage
          
          if (!manuscriptImg) {
            console.warn('Manuscript image ref not found')
            return
          }
          
          // Wait for image to be fully loaded and visible
          if (!manuscriptImg.complete || manuscriptImg.naturalWidth === 0) {
            console.log('Image not ready, retrying in 500ms...')
            setTimeout(() => this.captureLineScreenshot(change, index), 500)
            return
          }
          
          const imgNaturalWidth = manuscriptImg.naturalWidth
          const imgNaturalHeight = manuscriptImg.naturalHeight
          
          console.log(`Image dimensions: ${imgNaturalWidth}x${imgNaturalHeight}`)
          console.log(`Capturing lines ${change.start_line}-${change.end_line} for ${change.scribe}`)
          
          if (imgNaturalWidth === 0 || imgNaturalHeight === 0) {
            console.warn('Image dimensions not available, retrying...')
            setTimeout(() => this.captureLineScreenshot(change, index), 500)
            return
          }
          
          // Use the actual total lines from results
          const totalLines = this.results?.statistics?.total_lines || 30
          console.log(`Total lines in document: ${totalLines}`)
          
          // More precise positioning based on manuscript structure
          const topMargin = 0.08 // 8% top margin
          const bottomMargin = 0.12 // 12% bottom margin  
          const textAreaHeight = 1 - topMargin - bottomMargin
          
          // Calculate line spacing
          const lineSpacing = textAreaHeight / totalLines
          
          // Calculate positions for the specific lines with padding
          const startLineIndex = Math.max(0, change.start_line - 1)
          const endLineIndex = Math.min(totalLines - 1, change.end_line - 1)
          
          // Add padding above and below the target lines
          const paddingLines = 1.0
          const startY = topMargin + ((startLineIndex - paddingLines) * lineSpacing)
          const endY = topMargin + ((endLineIndex + paddingLines + 1) * lineSpacing)
          
          // Crop area calculations - wider area to capture full lines
          const cropX = 0.02 // 2% left margin
          const cropWidth = 0.96 // 96% width to include full lines
          const cropY = Math.max(0, startY)
          const cropHeight = Math.min(1 - cropY, endY - startY)
          
          console.log(`Crop percentages - x:${cropX}, y:${cropY}, w:${cropWidth}, h:${cropHeight}`)
          
          // Convert to pixel coordinates
          const sourceX = Math.round(cropX * imgNaturalWidth)
          const sourceY = Math.round(cropY * imgNaturalHeight)
          const sourceWidth = Math.round(cropWidth * imgNaturalWidth)
          const sourceHeight = Math.round(cropHeight * imgNaturalHeight)
          
          console.log(`Source pixels: x=${sourceX}, y=${sourceY}, w=${sourceWidth}, h=${sourceHeight}`)
          
          // Ensure we have valid dimensions
          if (sourceWidth <= 0 || sourceHeight <= 0) {
            console.error('Invalid crop dimensions calculated')
            return
          }
          
          // Set canvas dimensions
          const canvasWidth = 400
          const aspectRatio = sourceWidth / sourceHeight
          const canvasHeight = Math.max(60, Math.round(canvasWidth / aspectRatio))
          
          canvas[0].width = canvasWidth
          canvas[0].height = canvasHeight
          
          // Clear canvas
          ctx.clearRect(0, 0, canvasWidth, canvasHeight)
          
          try {
            // Draw the cropped section
            ctx.drawImage(
              manuscriptImg,
              sourceX, sourceY, sourceWidth, sourceHeight,
              0, 0, canvasWidth, canvasHeight
            )
            
            // Add a border to help visualize the crop
            ctx.strokeStyle = 'rgba(220, 20, 60, 0.8)'
            ctx.lineWidth = 2
            ctx.strokeRect(1, 1, canvasWidth - 2, canvasHeight - 2)
            
            // Add line indicators
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)'
            ctx.lineWidth = 1
            
            // Draw lines to indicate where each text line should be
            for (let i = startLineIndex; i <= endLineIndex; i++) {
              const relativeY = ((topMargin + (i * lineSpacing)) - cropY) / cropHeight
              const lineY = relativeY * canvasHeight
              
              if (lineY >= 0 && lineY <= canvasHeight) {
                ctx.beginPath()
                ctx.moveTo(10, lineY)
                ctx.lineTo(canvasWidth - 10, lineY)
                ctx.stroke()
                
                // Add line number
                ctx.fillStyle = 'rgba(255, 0, 0, 0.8)'
                ctx.font = '10px Arial'
                ctx.fillText(`${i + 1}`, 5, lineY - 2)
              }
            }
            
            console.log(`✓ Successfully captured screenshot for lines ${change.start_line}-${change.end_line}`)
            
          } catch (error) {
            console.error('Failed to capture line screenshot:', error)
            // Draw a detailed error placeholder
            ctx.fillStyle = '#f8f9fa'
            ctx.fillRect(0, 0, canvasWidth, canvasHeight)
            
            ctx.fillStyle = '#dc3545'
            ctx.font = 'bold 14px Arial'
            ctx.textAlign = 'center'
            ctx.fillText('Capture Failed', canvasWidth / 2, canvasHeight / 2 - 20)
            
            ctx.fillStyle = '#6c757d'
            ctx.font = '12px Arial'
            ctx.fillText(`Lines ${change.start_line}-${change.end_line}`, canvasWidth / 2, canvasHeight / 2)
            ctx.fillText(change.scribe, canvasWidth / 2, canvasHeight / 2 + 20)
          }
        })
      }, 200) // Initial delay to ensure DOM is ready
    },
    
    // Debug method to help calibrate line positioning
    showLineGrid() {
      const manuscriptImg = this.$refs.manuscriptImage
      if (!manuscriptImg || !manuscriptImg.complete) return
      
      // Create a temporary overlay to show all line positions
      const overlay = document.createElement('canvas')
      const ctx = overlay.getContext('2d')
      
      overlay.style.position = 'absolute'
      overlay.style.top = '0'
      overlay.style.left = '0'
      overlay.style.width = '100%'
      overlay.style.height = '100%'
      overlay.style.pointerEvents = 'none'
      overlay.style.zIndex = '1000'
      
      manuscriptImg.parentElement.appendChild(overlay)
      
      // Set canvas size to match image
      const rect = manuscriptImg.getBoundingClientRect()
      overlay.width = rect.width
      overlay.height = rect.height
      
      // Draw line grid
      const totalLines = 30
      const topMargin = 0.10
      const bottomMargin = 0.15
      const textAreaHeight = 1 - topMargin - bottomMargin
      const lineSpacing = textAreaHeight / totalLines
      
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)'
      ctx.lineWidth = 1
      
      for (let i = 0; i < totalLines; i++) {
        const y = (topMargin + (i * lineSpacing)) * overlay.height
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(overlay.width, y)
        ctx.stroke()
        
        // Add line number
        ctx.fillStyle = 'red'
        ctx.font = '12px Arial'
        ctx.fillText(`Line ${i + 1}`, 5, y - 2)
      }
      
      // Remove overlay after 5 seconds
      setTimeout(() => {
        overlay.remove()
      }, 5000)
    },
    
    async analyzeScribes() {
      if (this.isAnalyzing) return
      
      console.log('=== AUTO MODE ANALYSIS START ===')
      console.log('Mode: AUTO (PharoSight)')
      console.log('Parameters:', this.params)
      console.log('Timestamp:', new Date().toISOString())
      
      this.isAnalyzing = true
      this.analysisCompleted = false
      this.results = null
      this.segmentationOverlay = null // Reset overlay
      this.loadingMessage = 'Preparing manuscript image...'
      this.loadingDetail = 'Processing image for analysis'
      
      try {
        console.log('Starting scribe analysis...')

        if (!this.currentPageImage) {
          throw new Error('No page image available for analysis')
        }
        
        this.loadingMessage = 'Fetching manuscript data...'
        this.loadingDetail = 'Converting image format'
        
        // Fetch the image and convert to blob for upload
        const imageResponse = await fetch(this.currentPageImage)
        if (!imageResponse.ok) {
          throw new Error('Failed to fetch page image')
        }
        const imageBlob = await imageResponse.blob()
        
        this.loadingMessage = 'Configuring analysis parameters...'
        this.loadingDetail = 'Setting up detection algorithms'
        
        // Create FormData for upload (+ params)
        const formData = new FormData()
        formData.append('image', imageBlob, 'manuscript_page.jpg')
        formData.append('mode', 'auto')  // Explicitly set auto mode
        if (this.params.z_thresh) formData.append('z_thresh', String(this.params.z_thresh))
        formData.append('min_gap', String(this.params.min_gap))
        formData.append('min_run', String(this.params.min_run))
        formData.append('illum_frac', String(this.params.illum_frac))
        formData.append('sauvola_window', String(this.params.sauvola_window))
        formData.append('algo', this.params.algo)
        
        this.loadingMessage = 'Analyzing handwriting patterns...'
        this.loadingDetail = 'Running scribe detection algorithms'
        
        // Call the Python backend with aggressive cache-busting
        const timestamp = Date.now() + Math.random()  // Extra random for uniqueness
        const response = await fetch(`http://localhost:5001/analyze?t=${timestamp}&mode=auto`, {
          method: 'POST',
          body: formData,
          cache: 'no-cache',  // Disable caching
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        })
        
        if (!response.ok) {
          throw new Error(`Analysis failed: ${response.statusText}`)
        }
        
        this.loadingMessage = 'Processing results...'
        this.loadingDetail = 'Identifying unique scribes'
        
        const data = await response.json()
        console.log('Raw backend response:', {
          scribe_changes: data.scribe_changes?.length || 0,
          line_screenshots: data.line_screenshots?.length || 0,
          scribe_samples: Object.keys(data.scribe_samples || {}).length,
          ocr_available: data.ocr_available,
          total_lines: data.total_lines
        })
        
        // Transform backend response to frontend format
        this.results = this.transformBackendResults(data)
        console.log('Analysis results transformed:', this.results)
        
      } catch (error) {
        console.error('Analysis failed:', error)
        alert(`Scribe analysis failed: ${error.message}`)
        
      } finally {
        this.isAnalyzing = false
        this.analysisCompleted = true
      }
    },
    
    transformBackendResults(data) {
      const scribeChanges = data.scribe_changes || []
      const totalLines = data.total_lines || 30
      
      // Store the segmentation overlay URL
      if (data.segmentation_overlay) {
        this.segmentationOverlay = `http://localhost:5001${data.segmentation_overlay}`
        console.log('Segmentation overlay available:', this.segmentationOverlay)
      }
      
      // Use the backend scribe changes directly - no more "primary scribe" creation
      const transformedChanges = scribeChanges.map((change) => ({
        scribe: change.scribe || `Scribe at line ${change.line_number}`,
        confidence: change.confidence || 0.7,
        start_line: change.start_line || change.line_number,
        end_line: change.end_line || (change.line_number + 1),
        explanation: change.explanation || "Handwriting change detected through analysis.",
        samples: change.samples || []
      }))
      
      // Calculate statistics
      const totalScribes = transformedChanges.length
      const avgConfidence = transformedChanges.length > 0 
        ? transformedChanges.reduce((sum, s) => sum + s.confidence, 0) / totalScribes
        : 0.8
      
      console.log('Transformed results:', {
        scribe_changes: transformedChanges,
        total_scribes: totalScribes,
        line_screenshots: data.line_screenshots?.length || 0
      })

      return {
        scribe_changes: transformedChanges,
        line_screenshots: data.line_screenshots || [],
        ocr_available: data.ocr_available,
        statistics: {
          total_scribes: totalScribes,
          overall_confidence: avgConfidence,
          analysis_time: 1500,
          total_lines: totalLines
        }
      }
    },

    async exportPDF() {
      try {
        const el = this.$el.querySelector('.results-section')
        if (!el) return
        const { jsPDF } = await import('jspdf')
        const html2canvas = (await import('html2canvas')).default
        const canvas = await html2canvas(el, { scale: 2 })
        const imgData = canvas.toDataURL('image/png')
        const pdf = new jsPDF('p', 'pt', 'a4')
        const pageWidth = pdf.internal.pageSize.getWidth()
        const pageHeight = pdf.internal.pageSize.getHeight()
        // fit within margins
        const margin = 24
        const w = pageWidth - margin * 2
        const h = canvas.height * (w / canvas.width)
        pdf.addImage(imgData, 'PNG', margin, margin, w, Math.min(h, pageHeight - margin*2))
        pdf.save(`scribe-analysis-page-${this.currentPage || 1}.pdf`)
      } catch (e) {
        console.error(e)
        alert('Failed to export PDF')
      }
    }
  }
}
</script>

<style scoped>
/* New Two-Step Flow Styles */
.scribe-modal{
  position: fixed; inset: 0;
  background: rgba(0,0,0,.35);
  display:flex; align-items:center; justify-content:center;
  z-index: 7000; /* above any other popup */
}
.scribe-card{
  width: min(980px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  overflow: auto;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 18px 34px rgba(0,0,0,.22);
  padding: 16px 18px 18px;
}
.scribe-header{
  display:flex; align-items:center; justify-content:space-between;
  margin-bottom: 8px;
}
.scribe-header h3{ margin:0; font-size: 22px; }
.header-left { display: flex; align-items: center; gap: 8px; }
.pharaonic-icon { width: 24px; height: 24px; }
.pharosight-text { font-weight: 600; color: #3b82f6; }
.icon-btn{
  border:none; background:transparent; cursor:pointer; font-size:18px;
}

.steps{
  display:flex; align-items:center; gap:10px; margin:8px 0 16px;
}
.step{
  display:flex; align-items:center; gap:8px;
  padding:8px 10px; border-radius:10px; background:#eef2ff; color:#1f3aa1;
  font-weight:600; opacity:.7;
}
.step.active{ opacity:1; background:#e1e8ff; }
.step span{
  width:22px; height:22px; border-radius:50%; background:#3b82f6; color:#fff;
  display:inline-flex; align-items:center; justify-content:center; font-size:12px;
}
.line{ height:1px; flex:1; background:#e5e7eb; }

.step-pane{ padding: 8px 2px 2px; }
.helper{ color:#374151; margin:6px 0 12px; }

.method-grid{
  display:grid; grid-template-columns: repeat(3, 1fr); gap:12px;
}
.method-card{
  border:1px solid #cfe0ff; border-radius:12px; padding:14px;
  text-align:left; background:#f7faff; cursor:pointer;
  transition: transform .05s, filter .15s;
}
.method-card:hover{ filter:brightness(.98); }
.method-card.selected{ border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,.15) inset; }
.method-card.disabled{ cursor:not-allowed; filter:grayscale(1); opacity:.6; }
.method-title{ font-weight:700; color:#0f172a; }
.method-sub{ color:#475569; font-size:13px; margin-top:3px; }
.hourglass{ opacity:.85; }

.draw-wrap{ margin-top: 12px; }
.draw-toolbar{
  display:flex; align-items:center; gap:10px; margin-bottom:8px;
}
.spacer{ flex:1; }
.pill{
  background:#eef2ff; color:#1f3aa1; border:1px solid #cfe0ff;
  border-radius:999px; padding:6px 10px; font-weight:600; cursor:pointer;
}
.pill:disabled{ opacity:.5; cursor:not-allowed; }

.draw-stage{
  position: relative;
  background:#f5f7fb;
  border:1px solid #e5e7eb; border-radius:12px;
  height: 420px;             /* fixed viewport; image will contain-fit */
  overflow:hidden;
}
.draw-img{ width:100%; height:100%; object-fit: contain; user-select:none; }

.box{
  position:absolute; border:2px solid #22c55e; background: rgba(34,197,94,.18);
  border-radius:6px; pointer-events:none;
}
.box.live{ border-style:dashed; background: rgba(59,130,246,.15); border-color:#3b82f6; }

.hint{ color:#6b7280; font-size:12px; margin-top:8px; }

.actions{
  display:flex; justify-content:space-between; align-items: center; gap:10px; margin-top:16px;
}
.action-right { display: flex; gap: 10px; }
.ghost{
  background:#fff; border:1px solid #e5e7eb; color:#374151; border-radius:10px; padding:10px 14px;
}
.primary{
  background:#3b82f6; color:#fff; border:1px solid #2f62ea; border-radius:10px; padding:10px 14px;
  font-weight:700;
}
.secondary{
  background:#6b7280; color:#fff; border:1px solid #4b5563; border-radius:10px; padding:10px 14px;
  font-weight:600;
}
.primary:disabled{ opacity:.6; cursor:not-allowed; }

.tuning-section { margin-bottom: 16px; }
.results-section { margin-bottom: 16px; }
.results-header h4 { margin: 0 0 8px 0; }
.results-summary { 
  display: flex; gap: 16px; margin-bottom: 16px; 
}
.metric { display: flex; flex-direction: column; }
.metric-label { font-size: 12px; color: #6b7280; }
.metric-value { font-weight: 600; color: #1f2937; }

.scribe-results { margin-top: 16px; }
.detected-scribes h5 { margin: 0 0 12px 0; color: #1f2937; }
.scribe-item { 
  background: #f8fafc; 
  border: 1px solid #e2e8f0; 
  border-radius: 8px; 
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
  font-weight: 600; 
  color: #3b82f6; 
}
.scribe-range { 
  font-size: 12px; 
  color: #6b7280; 
  background: #e0e7ff; 
  padding: 2px 6px; 
  border-radius: 4px; 
}
.scribe-explanation { 
  margin: 0 0 8px 0; 
  font-size: 13px; 
  color: #4b5563; 
  line-height: 1.4; 
}
.scribe-features { 
  display: flex; 
  flex-wrap: wrap; 
  gap: 4px; 
}
.feature-tag { 
  font-size: 11px; 
  background: #ddd6fe; 
  color: #5b21b6; 
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
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.scribe-popup-container {
  width: 90%;
  max-width: 1200px;
  height: 85%;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.popup-header {
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%);
  color: #ffd700;
  padding: 1.75rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #ffd700;
  box-shadow: 0 2px 8px rgba(255, 215, 0, 0.2);
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
  color: #ffd700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.close-button {
  background: none;
  border: 1px solid #ffd700;
  color: #ffd700;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-button:hover {
  background: #ffd700;
  color: #1a1a1a;
  transform: scale(1.05);
}

.close-button:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.popup-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.left-panel {
  flex: 1;
  background: #f8f9fa;
  border-right: 1px solid #e9ecef;
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
  color: #1e40af;
  font-size: 1.2rem;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
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

.samples-gallery {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
}

.sample-image-container {
  position: relative;
  min-width: 80px;
  max-width: 200px;
  flex: 1;
}

.sample-image {
  width: 100%;
  height: auto;
  border-radius: 6px;
  border: 2px solid #d1d5db;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
  cursor: pointer;
}

.sample-image:hover {
  border-color: #6366f1;
  transform: scale(1.02);
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
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #020617 100%);
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
  background: #f8fafc;
  border-radius: 12px;
  padding: 20px;
  margin: 16px 0;
  border: 2px solid #e2e8f0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.params-title {
  color: #1e40af;
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0 0 16px 0;
  text-align: center;
  padding-bottom: 8px;
  border-bottom: 2px solid #fbbf24;
}

.params-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.param-group {
  background: white;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
}

.param-group:hover {
  border-color: #fbbf24;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.1);
  transform: translateY(-1px);
}

.param-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
  font-size: 0.95rem;
}

.info-icon {
  color: #6b7280;
  cursor: help;
  font-size: 0.9rem;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  transition: all 0.2s ease;
  position: relative;
}

.info-icon:hover {
  background: #fbbf24;
  color: white;
  transform: scale(1.1);
}

/* Advanced Tooltips */
.info-icon::after {
  content: attr(data-tooltip-content);
  position: absolute;
  top: 50%;
  left: calc(100% + 15px);
  transform: translateY(-50%);
  background: linear-gradient(145deg, #1e293b, #334155);
  color: white;
  padding: 12px;
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
  border: 2px solid #fbbf24;
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
  border-right-color: #fbbf24;
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
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  font-size: 0.95rem;
  transition: all 0.2s ease;
}

.range-input:focus, .number-input:focus, .select-input:focus {
  outline: none;
  border-color: #1e40af;
  box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.1);
}

.param-value {
  min-width: 45px;
  padding: 4px 8px;
  background: #1e40af;
  color: white;
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
  background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%);
  color: white;
  border: 2px solid #1d4ed8;
}

.pharaonic-btn.primary:hover {
  background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(30, 64, 175, 0.3);
}

.pharaonic-btn.secondary {
  background: linear-gradient(135deg, #059669 0%, #10b981 100%);
  color: white;
  border: 2px solid #047857;
}

.pharaonic-btn.secondary:hover {
  background: linear-gradient(135deg, #047857 0%, #059669 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(5, 150, 105, 0.3);
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
  box-shadow: 0 4px 12px rgba(30, 64, 175, 0.2);
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