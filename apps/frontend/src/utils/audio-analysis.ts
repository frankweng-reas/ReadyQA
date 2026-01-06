export interface AudioAnalysisResult {
  isEmpty: boolean
  duration: number
  rms?: number
  maxAmplitude?: number
  silentRatio?: number
}

export async function analyzeAudio(audioBlob: Blob): Promise<AudioAnalysisResult> {
  if (typeof window === 'undefined') {
    throw new Error('音頻分析功能僅在瀏覽器環境中可用')
  }

  try {
    const arrayBuffer = await audioBlob.arrayBuffer()
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    
    const duration = audioBuffer.duration
    
    const channelData = audioBuffer.getChannelData(0)
    const length = channelData.length
    
    if (length === 0) {
      await audioContext.close()
      return { isEmpty: true, duration: 0 }
    }
    
    if (duration < 0.5) {
      await audioContext.close()
      return { isEmpty: true, duration }
    }
    
    let sumSquares = 0
    let maxAmplitude = 0
    let silentSamples = 0
    const SILENT_THRESHOLD = 0.005
    
    for (let i = 0; i < length; i++) {
      const sample = Math.abs(channelData[i])
      sumSquares += sample * sample
      maxAmplitude = Math.max(maxAmplitude, sample)
      
      if (sample < SILENT_THRESHOLD) {
        silentSamples++
      }
    }
    
    const rms = Math.sqrt(sumSquares / length)
    const silentRatio = silentSamples / length
    
    await audioContext.close()
    
    const hasLowVolume = rms < 0.015 && maxAmplitude < 0.06
    const isMostlySilent = silentRatio > 0.9
    
    const isEmpty = hasLowVolume || isMostlySilent
    
    console.log('[音頻分析]', {
      rms: rms.toFixed(6),
      maxAmplitude: maxAmplitude.toFixed(6),
      silentRatio: (silentRatio * 100).toFixed(1) + '%',
      duration: duration.toFixed(2) + 's',
      hasLowVolume,
      isMostlySilent,
      isEmpty
    })
    
    return { 
      isEmpty, 
      duration,
      rms,
      maxAmplitude,
      silentRatio
    }
  } catch (error) {
    console.error('[音頻分析錯誤]:', error)
    return { isEmpty: false, duration: 0 }
  }
}

