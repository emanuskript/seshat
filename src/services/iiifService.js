/**
 * Minimal IIIF manifest parser (v2 + v3 tolerant)
 * Returns an array of image URLs (full size).
 */
export async function fetchIIIFImages(manifestUrl) {
  const res = await fetch(manifestUrl);
  if (!res.ok) throw new Error(`Failed to fetch IIIF manifest: ${res.status}`);
  const manifest = await res.json();

  // v2: sequences[0].canvases[*].images[0].resource.service['@id']/full/full/0/default.jpg
  const canvasesV2 = manifest?.sequences?.[0]?.canvases;
  if (Array.isArray(canvasesV2) && canvasesV2.length) {
    const urls = canvasesV2
      .map((c) => c?.images?.[0]?.resource?.service?.["@id"])
      .filter(Boolean)
      .map((id) => `${id}/full/full/0/default.jpg`);
    if (urls.length) return urls;
  }

  // v3: items[*].items[0].body.service[0].id or items[*].items[0].body.service.id
  const canvasesV3 = manifest?.items;
  if (Array.isArray(canvasesV3) && canvasesV3.length) {
    const urls = canvasesV3
      .map((canvas) => {
        const annoPage = canvas?.items?.[0];
        const anno = annoPage?.items?.[0];
        const body = anno?.body;
        const service = Array.isArray(body?.service) ? body.service[0] : body?.service;
        const id = service?.["@id"] || service?.id;
        return id ? `${id}/full/full/0/default.jpg` : null;
      })
      .filter(Boolean);
    if (urls.length) return urls;
  }

  // Fallback: try any painting body with id that looks like an image
  const fallback = canvasesV3?.map((canvas) => {
    const annoPage = canvas?.items?.[0];
    const anno = annoPage?.items?.[0];
    const body = anno?.body;
    const id = body?.id;
    return id || null;
  }).filter(Boolean);

  return fallback && fallback.length ? fallback : [];
}

/**
 * Fetch IIIF image info.json to get tile configuration
 * @param {string} serviceId - The IIIF image service base URL
 * @returns {Promise<Object|null>} Image info including tile support
 */
export async function fetchImageInfo(serviceId) {
  try {
    const infoUrl = `${serviceId}/info.json`;
    const response = await fetch(infoUrl);
    if (!response.ok) return null;

    const info = await response.json();
    return {
      width: info.width,
      height: info.height,
      tileSupported: !!(info.tiles && info.tiles.length > 0),
      tiles: info.tiles || null,
      scaleFactors: info.tiles?.[0]?.scaleFactors || null,
      formats: info.profile?.[1]?.formats || ['jpg'],
      qualities: info.profile?.[1]?.qualities || ['default'],
      // Return the full info.json for OpenSeadragon
      rawInfo: info
    };
  } catch (e) {
    console.warn('Could not fetch image info:', e);
    return null;
  }
}

/**
 * Extract the IIIF service ID from a full image URL
 * @param {string} imageUrl - Full IIIF image URL (e.g., .../full/full/0/default.jpg)
 * @returns {string|null} The service ID or null
 */
export function extractServiceId(imageUrl) {
  if (!imageUrl) return null;
  // Remove the IIIF image API parameters to get the service ID
  const match = imageUrl.match(/^(.+?)\/full\/.+$/);
  return match ? match[1] : null;
}

/**
 * Build tile source configuration for OpenSeadragon
 * @param {string} serviceId - The IIIF image service base URL
 * @param {Object} imageInfo - Info from fetchImageInfo
 * @returns {Object} OpenSeadragon-compatible tile source
 */
export function buildTileSource(serviceId, imageInfo) {
  if (imageInfo?.tileSupported) {
    // Return IIIF info.json for OpenSeadragon (it natively understands IIIF)
    return imageInfo.rawInfo;
  }

  // Fallback: simple image source for non-tiled images
  return {
    type: 'image',
    url: `${serviceId}/full/full/0/default.jpg`
  };
}
