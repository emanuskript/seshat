/**
 * Scribe Detection Tour Steps
 *
 * Branches:
 * - 'common': Steps shown regardless of selected mode (intro steps)
 * - 'auto': Steps specific to PharoSight Auto mode
 * - 'manual': Steps specific to Manual Line Pick mode
 * - 'json': Steps specific to JSON Import mode
 * - 'step2': Steps shown in Step 2 (Tune & Run) regardless of mode
 */

export const scribeTourSteps = [
  // === COMMON INTRO STEPS ===
  {
    id: 'welcome',
    branch: 'common',
    title: 'Welcome to PharoSight',
    content: 'PharoSight is an AI-powered tool that detects different scribes (handwriting authors) in your manuscript. Let\'s walk through how to use it.',
    target: '[data-scribe-tour="header"]',
    placement: 'bottom',
    icon: 'sparkles'
  },
  {
    id: 'step-tabs',
    branch: 'common',
    title: 'Two-Step Workflow',
    content: 'The process has two steps: first, select how to segment the text lines, then tune parameters and run the analysis.',
    target: '[data-scribe-tour="steps"]',
    placement: 'bottom',
    icon: 'list-ordered'
  },
  {
    id: 'method-selection',
    branch: 'common',
    title: 'Choose Your Method',
    content: 'Select one of three input methods: Auto detection, Manual line drawing, or import existing JSON annotations. Each has its advantages.',
    target: '[data-scribe-tour="method-grid"]',
    placement: 'top',
    icon: 'layout-grid'
  },

  // === AUTO MODE STEPS ===
  {
    id: 'auto-selected',
    branch: 'auto',
    title: 'PharoSight Auto',
    content: 'Auto mode uses AI to automatically detect and segment text lines in your manuscript. Best for clean, well-preserved documents.',
    target: '.method-card.selected',
    placement: 'right',
    icon: 'wand-2'
  },
  {
    id: 'auto-next',
    branch: 'auto',
    title: 'Proceed to Analysis',
    content: 'Click "Next" to proceed to Step 2 where you can adjust parameters and run the scribe detection.',
    target: '[data-scribe-tour="actions"] .primary',
    placement: 'top',
    icon: 'arrow-right'
  },

  // === MANUAL MODE STEPS ===
  {
    id: 'manual-selected',
    branch: 'manual',
    title: 'Manual Line Pick',
    content: 'Manual mode gives you precise control. Draw boxes around specific text lines you want to compare. Recommended for best results.',
    target: '.method-card.selected',
    placement: 'right',
    icon: 'mouse-pointer-2'
  },
  {
    id: 'draw-toolbar',
    branch: 'manual',
    title: 'Drawing Controls',
    content: 'Use these controls to start/stop drawing and clear your selections. The counter shows how many line boxes you\'ve drawn.',
    target: '[data-scribe-tour="draw-toolbar"]',
    placement: 'bottom',
    icon: 'settings-2'
  },
  {
    id: 'draw-canvas',
    branch: 'manual',
    title: 'Draw Line Boxes',
    content: 'Click "Start Drawing", then click and drag on the image to draw a rectangle around each text line. Draw at least 2 lines for comparison.',
    target: '[data-scribe-tour="draw-stage"]',
    placement: 'top',
    icon: 'square-dashed'
  },
  {
    id: 'draw-hint',
    branch: 'manual',
    title: 'Pro Tip',
    content: 'For best results, draw tight boxes around individual text lines. You can always adjust or clear and redraw before running the analysis.',
    target: '.draw-wrap .hint',
    placement: 'top',
    icon: 'lightbulb'
  },
  {
    id: 'manual-next',
    branch: 'manual',
    title: 'Ready to Analyze',
    content: 'Once you\'ve drawn your line boxes, click "Next" to proceed to parameter tuning and run the analysis.',
    target: '[data-scribe-tour="actions"] .primary',
    placement: 'top',
    icon: 'arrow-right'
  },

  // === JSON MODE STEPS ===
  {
    id: 'json-selected',
    branch: 'json',
    title: 'Import JSON Annotations',
    content: 'If you have existing line detections in COCO format, you can import them directly. This is useful for pre-processed manuscripts.',
    target: '.method-card.selected',
    placement: 'right',
    icon: 'file-json'
  },
  {
    id: 'image-upload',
    branch: 'json',
    title: 'Upload Manuscript Image',
    content: 'First, upload the manuscript image that corresponds to your JSON annotations. Drag and drop or click to browse.',
    target: '[data-scribe-tour="image-upload"]',
    placement: 'bottom',
    icon: 'image'
  },
  {
    id: 'json-upload',
    branch: 'json',
    title: 'Upload Annotation JSON',
    content: 'Then upload the COCO-format JSON file containing the line bounding box annotations.',
    target: '[data-scribe-tour="json-upload"]',
    placement: 'bottom',
    icon: 'file-up'
  },
  {
    id: 'json-preview',
    branch: 'json',
    title: 'Preview Detected Lines',
    content: 'After uploading, you\'ll see a preview of the detected line regions overlaid on the manuscript. Verify they look correct.',
    target: '[data-scribe-tour="json-preview"]',
    placement: 'top',
    icon: 'eye',
    waitForSelector: true
  },
  {
    id: 'json-next',
    branch: 'json',
    title: 'Proceed to Analysis',
    content: 'Once both files are uploaded and the preview looks good, click "Next" to run the scribe detection.',
    target: '[data-scribe-tour="actions"] .primary',
    placement: 'top',
    icon: 'arrow-right'
  },

  // === STEP 2 STEPS ===
  {
    id: 'step2-intro',
    branch: 'step2',
    title: 'Tune & Run',
    content: 'Welcome to Step 2! Here you can adjust analysis parameters and run the scribe detection algorithm.',
    target: '[data-scribe-tour="steps"]',
    placement: 'bottom',
    icon: 'sliders-horizontal'
  },
  {
    id: 'results-overview',
    branch: 'step2',
    title: 'Analysis Results',
    content: 'After running the analysis, you\'ll see a summary showing the total number of detected scribes and overall confidence score.',
    target: '[data-scribe-tour="results-header"]',
    placement: 'bottom',
    icon: 'bar-chart-2',
    waitForSelector: true
  },
  {
    id: 'analyzed-page',
    branch: 'step2',
    title: 'Visual Analysis',
    content: 'The analyzed page shows each text line color-coded by scribe. Lines written by the same scribe share the same color.',
    target: '[data-scribe-tour="analyzed-card"]',
    placement: 'right',
    icon: 'palette',
    waitForSelector: true
  },
  {
    id: 'scribe-accordion',
    branch: 'step2',
    title: 'Scribe Details',
    content: 'Click on each scribe section to see detailed information: which lines they wrote, confidence scores, and writing characteristics.',
    target: '[data-scribe-tour="results-accordion"]',
    placement: 'left',
    icon: 'list-tree',
    waitForSelector: true
  },
  {
    id: 'export-options',
    branch: 'step2',
    title: 'Export & Actions',
    content: 'Export your results as a PDF report or JSON data. You can also re-run the analysis with different parameters.',
    target: '[data-scribe-tour="actions"]',
    placement: 'top',
    icon: 'download'
  },
  {
    id: 'complete',
    branch: 'step2',
    title: 'You\'re All Set!',
    content: 'You now know how to use PharoSight for scribe detection. Click the help button anytime to restart this tour.',
    target: null,
    placement: 'center',
    icon: 'check-circle'
  }
]

/**
 * Get steps filtered for a specific branch
 * @param {string} branch - 'common', 'auto', 'manual', 'json', or 'step2'
 * @returns {Array} - Filtered steps for the branch
 */
export function getStepsForBranch(branch) {
  // Common steps are always included in Step 1 branches
  const step1Branches = ['common', 'auto', 'manual', 'json']

  if (step1Branches.includes(branch)) {
    // For Step 1, include common steps plus branch-specific steps
    return scribeTourSteps.filter(step => {
      if (step.branch === 'common') return true
      if (step.branch === branch && branch !== 'common') return true
      return false
    })
  }

  if (branch === 'step2') {
    // For Step 2, only include step2 branch steps
    return scribeTourSteps.filter(step => step.branch === 'step2')
  }

  // Default to common steps only
  return scribeTourSteps.filter(step => step.branch === 'common')
}

/**
 * Get a step by its ID
 * @param {string} id - Step ID
 * @returns {Object|null} - Step object or null
 */
export function getStepById(id) {
  return scribeTourSteps.find(step => step.id === id) || null
}
