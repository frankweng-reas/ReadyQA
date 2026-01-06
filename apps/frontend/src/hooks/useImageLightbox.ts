'use client'

import { useState, useCallback } from 'react'

/**
 * 圖片 Lightbox Hook
 * 用於管理圖片點擊放大功能
 */
export function useImageLightbox() {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [allImages, setAllImages] = useState<string[]>([])
  
  const openLightbox = useCallback((index: number, images: string[]) => {
    if (images.length > 0) {
      setAllImages(images)
      setLightboxIndex(index >= 0 && index < images.length ? index : 0)
      setLightboxOpen(true)
    }
  }, [])
  
  const closeLightbox = useCallback(() => {
    setLightboxOpen(false)
  }, [])
  
  return {
    lightboxOpen,
    lightboxIndex,
    allImages,
    openLightbox,
    closeLightbox,
  }
}

