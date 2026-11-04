import { useState, useCallback } from 'react'
import { saveAsset } from '../services/api'

const STORAGE_KEY = 'cb_char_images'

function loadFromStorage(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveToStorage(data: Record<string, string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // quota exceeded — silently skip
  }
}

// key: `bouncy_happy`, value: data URL
export function useCharacterImages() {
  const [images, setImages] = useState<Record<string, string>>(loadFromStorage)

  const setImage = useCallback((assetId: string, dataUrl: string) => {
    setImages(prev => {
      const next = { ...prev, [assetId]: dataUrl }
      saveToStorage(next)
      return next
    })

    // Persist as real PNG via Express server
    // assetId format: "bouncy_happy", "pokpok_holding_book"
    const underscore = assetId.indexOf('_')
    if (underscore > 0) {
      const character = assetId.slice(0, underscore)
      const pose = assetId.slice(underscore + 1)
      saveAsset(`characters/${character}/${pose}.png`, dataUrl).then(ok => {
        if (!ok) console.warn(`[useCharacterImages] Server save failed for ${character}/${pose}.png — kept in localStorage only`)
      })
    }
  }, [])

  const removeImage = useCallback((assetId: string) => {
    setImages(prev => {
      const next = { ...prev }
      delete next[assetId]
      saveToStorage(next)
      return next
    })
  }, [])

  const getImage = useCallback((assetId: string): string | undefined => {
    return images[assetId]
  }, [images])

  return { images, setImage, removeImage, getImage }
}
