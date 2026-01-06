# JSON Upload Feature for PharoSight Scribe Detection

## Overview
Added the ability to upload COCO-format JSON annotation files containing line detections, which are then used for scribe detection analysis.

## Changes Made

### Frontend (ScribeDetectionPopup.vue)

#### 1. New Mode: JSON Upload
- Replaced the disabled "Import from Segmentation" button with an active "Import JSON Annotations" option
- Added a new mode: `'json'` alongside `'auto'` and `'manual'`

#### 2. Data Properties Added
```javascript
uploadedJsonFile: null,      // Stores the uploaded JSON file object
jsonParseError: null,        // Error message if JSON parsing fails
isDraggingFile: false,       // Tracks drag-and-drop state
jsonSourceWidth: null,       // Image width from JSON metadata
jsonSourceHeight: null,      // Image height from JSON metadata
```

#### 3. New Methods

**`handleFileSelect(event)`**
- Handles file selection from input element
- Calls `processJsonFile()` with the selected file

**`handleFileDrop(event)`**
- Handles drag-and-drop file upload
- Validates file type before processing

**`processJsonFile(file)`**
- Reads and parses the JSON file
- Extracts line detections using `parseCocoAnnotations()`
- Stores regions and image dimensions
- Provides user feedback on success/error

**`parseCocoAnnotations(data)`**
- Parses COCO-format JSON structure
- Filters annotations by "line" categories (category_id: 1 by default)
- Sorts lines by y-position (top to bottom) for proper reading order
- Extracts bounding boxes in format: `[x, y, width, height]`

#### 4. Updated Methods

**`selectMode(modeType)`**
- Clears JSON upload state when switching away from JSON mode
- Maintains existing behavior for auto/manual modes

**`runDetection()`**
- Added JSON mode handling
- Maps JSON regions to payload format: `{x, y, w, h}`
- Uses `jsonSourceWidth` and `jsonSourceHeight` for coordinate normalization
- Calls `analyzeScribesWithRegions()` with JSON-provided regions

#### 5. UI Components Added

**JSON Upload Area**
- Drag-and-drop zone with visual feedback
- File browser button
- Shows uploaded filename when selected
- Displays line count after successful parse
- Error messages for invalid JSON

**Styling**
- `.json-upload-wrap` - Container styling
- `.upload-area` - Drop zone with hover/drag states
- `.upload-content` - Centered upload UI
- `.file-selected` - Success indicator
- `.error-message` - Error display styling
- `.json-info` - File info display

### Backend (simple_backend.py)

#### Updated Mode Handling
- Changed `mode == "manual"` checks to `mode in ("manual", "json")`
- Both modes use identical region-driven analysis pipeline
- Added logging to distinguish between manual drawing and JSON import

#### Key Changes
1. **Region Parsing**: Accepts regions from both manual drawing and JSON upload
2. **Normalization**: Applies same coordinate transformation for both modes
3. **Analysis Pipeline**: Reuses existing manual region analysis code
4. **Logging**: Enhanced to show mode type and region count

## Usage

### JSON File Format
The system expects COCO-format JSON with the following structure:

```json
{
  "images": [
    {
      "id": 1,
      "file_name": "manuscript_page.jpg",
      "width": 859,
      "height": 962
    }
  ],
  "annotations": [
    {
      "id": 1,
      "image_id": 1,
      "category_id": 1,
      "bbox": [16.54, 496.79, 165.48, 18.94],
      "score": 0.811
    }
  ],
  "categories": [
    {
      "id": 1,
      "name": "Line Detection_object",
      "supercategory": "Line Detection"
    }
  ]
}
```

### Workflow
1. User opens Scribe Detection popup
2. Selects "Import JSON Annotations" mode
3. Uploads/drops a COCO-format JSON file
4. System parses line detections (category_id: 1)
5. Displays count of detected lines
6. User proceeds to "Tune & Run" step
7. Backend performs scribe analysis on JSON-provided regions
8. Results displayed with bounding boxes overlaid on manuscript

## Benefits
- **No Manual Drawing**: Users can leverage existing line detection models
- **Batch Processing**: Import detection results from YOLO or other models
- **Consistency**: Uses same proven analysis pipeline as manual mode
- **Flexibility**: Accepts any COCO-compatible annotation file

## Technical Notes
- Bounding boxes use COCO format: `[x, y, width, height]`
- Coordinates are normalized to match processed image dimensions
- Lines sorted by y-position to maintain reading order
- Falls back to category_id: 1 if no "line" category found
- Validation ensures image metadata exists in JSON
