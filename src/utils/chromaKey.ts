/**
 * Fetches an image URL as a blob (bypasses browser cache + avoids CORS taint),
 * removes magenta (#FF00FF) pixels using canvas, and returns a transparent PNG
 * as a data URL.
 */
export function chromaKeyMagenta(imageUrl: string): Promise<string> {
  return fetch(imageUrl, { cache: 'no-store' })
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status} loading image: ${imageUrl}`)
      return r.blob()
    })
    .then(blob => new Promise<string>((resolve, reject) => {
      const objectUrl = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(objectUrl)
        try {
          const canvas = document.createElement('canvas')
          canvas.width  = img.naturalWidth
          canvas.height = img.naturalHeight
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0)

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const d = imageData.data
          const KR = 255, KG = 0, KB = 255   // magenta

          let removed = 0
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i + 1], b = d[i + 2]
            const dist = Math.sqrt((r - KR) ** 2 + (g - KG) ** 2 + (b - KB) ** 2)
            if (dist < 180) {
              // Hard cut up to 140, then short fade to 180 for anti-aliased edges
              d[i + 3] = dist < 140
                ? 0
                : Math.round(((dist - 140) / 40) * 255)
              removed++
            }
          }
          console.log(`[chromaKey] Processed ${canvas.width}×${canvas.height}, removed ${removed} magenta pixels`)

          ctx.putImageData(imageData, 0, 0)
          resolve(canvas.toDataURL('image/png'))
        } catch (e) {
          reject(e)
        }
      }
      img.onerror = (e) => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error(`Failed to load image blob: ${e}`))
      }
      img.src = objectUrl
    }))
}

/**
 * Runs chroma-key on the given URL, then saves the transparent PNG back to the
 * server (overwriting the raw magenta file). Returns the new file URL with a
 * cache-busting query string, keeping the project JSON small.
 */
export async function chromaKeyAndSave(
  imageUrl: string,
  projectId: string,
  topicId: string,
  imageKey: string,
): Promise<string> {
  console.log(`[chromaKey] Starting for ${imageKey}: ${imageUrl}`)
  const dataUrl = await chromaKeyMagenta(imageUrl)
  console.log(`[chromaKey] Canvas done, saving back to server…`)

  const res = await fetch('/api/save-processed-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, topicId, imageKey, dataUrl }),
  })
  if (!res.ok) {
    const body = await res.text()
    const msg = JSON.parse(body).error ?? body ?? 'Failed to save processed image'
    throw new Error(msg)
  }
  const { url } = await res.json()
  console.log(`[chromaKey] Saved transparent image → ${url}`)
  return url
}
