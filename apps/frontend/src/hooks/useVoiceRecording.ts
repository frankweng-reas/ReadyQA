'use client'

import { useState, useRef, useEffect } from 'react'
import { analyzeAudio } from '@/utils/audio-analysis'

interface UseVoiceRecordingOptions {
  chatbotId: string | undefined
  enabled: boolean
  onTranscriptionComplete: (text: string) => void
}

interface UseVoiceRecordingReturn {
  isRecording: boolean
  recordingTime: number
  isTranscribing: boolean
  voiceError: string | null
  formatRecordingTime: (seconds: number) => string
  handleVoiceButtonClick: () => void
  startRecording: () => Promise<void>
  stopRecording: () => void
  clearError: () => void
}

export function useVoiceRecording({
  chatbotId,
  enabled,
  onTranscriptionComplete
}: UseVoiceRecordingOptions): UseVoiceRecordingReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState<number>(0)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)

  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const formatRecordingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true)
    setVoiceError(null)

    try {
      console.log('[useVoiceRecording] 開始轉錄音頻，音頻大小:', audioBlob.size, 'bytes')
      
      const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' })
      
      if (!chatbotId) {
        throw new Error('無法上傳音頻：缺少 chatbot ID')
      }
      
      const formData = new FormData()
      formData.append('file', audioFile)
      formData.append('chatbotId', chatbotId)
      formData.append('prompt', '使用者可能會中英夾雜，請保留英文單字，避免音譯。')
      formData.append('denoise', 'true')
      
      console.log('[useVoiceRecording] 發送轉錄請求，chatbotId:', chatbotId)

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
      const response = await fetch(`${API_URL}/audio/transcribe`, {
        method: 'POST',
        body: formData
      })

      console.log('[useVoiceRecording] 轉錄 API 回應狀態:', response.status, response.statusText)

      if (!response.ok) {
        let errorMessage = `轉錄失敗: ${response.status}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.message || errorMessage
          console.error('[useVoiceRecording] API 錯誤回應:', errorData)
        } catch (e) {
          const errorText = await response.text().catch(() => '')
          console.error('[useVoiceRecording] API 錯誤文字:', errorText)
          if (errorText) {
            errorMessage = errorText
          }
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log('[useVoiceRecording] 轉錄 API 回應數據:', {
        success: data.success,
        hasText: !!data.text,
        textLength: data.text?.length || 0
      })
      
      if (!data) {
        throw new Error('轉錄 API 返回空數據')
      }
      
      if (!data.success) {
        throw new Error(data.error || '轉錄失敗，請重試')
      }
      
      if (!data.text || typeof data.text !== 'string') {
        throw new Error('轉錄返回的文字格式不正確')
      }
      
      const transcribedText = data.text.trim()
      if (!transcribedText) {
        throw new Error('轉錄返回空文字，請檢查音頻格式或重試')
      }
      
      console.log('[useVoiceRecording] 轉錄成功，文字:', transcribedText)
      
      onTranscriptionComplete(transcribedText)
    } catch (err: any) {
      const errorMessage = err?.message || '轉錄過程中發生錯誤，請重試'
      console.error('[useVoiceRecording] 轉錄錯誤:', err)
      
      setVoiceError(errorMessage)
      
      setTimeout(() => {
        setVoiceError(null)
      }, 5000)
    } finally {
      setIsTranscribing(false)
    }
  }

  const checkMicrophonePermission = async (): Promise<{ available: boolean; error?: string }> => {
    const isSecure = window.isSecureContext || 
                     window.location.protocol === 'https:' || 
                     window.location.hostname === 'localhost' ||
                     window.location.hostname === '127.0.0.1'
    
    if (!isSecure) {
      return {
        available: false,
        error: '語音功能需要在 HTTPS 環境下使用，請使用 HTTPS 訪問此頁面'
      }
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return {
        available: false,
        error: '您的瀏覽器不支持語音錄音功能，請使用現代瀏覽器（Chrome、Firefox、Edge 等）'
      }
    }

    if (!window.MediaRecorder) {
      return {
        available: false,
        error: '您的瀏覽器不支持 MediaRecorder API，請使用現代瀏覽器'
      }
    }

    try {
      if (navigator.permissions && navigator.permissions.query) {
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName })
        
        if (permissionStatus.state === 'denied') {
          return {
            available: false,
            error: '麥克風權限已被拒絕，請在瀏覽器設置中允許此網站訪問麥克風'
          }
        }
      }
    } catch (e) {
      console.warn('無法檢查權限狀態（將直接請求權限）:', e)
    }

    return { available: true }
  }

  const startRecording = async () => {
    if (!enabled) return
    
    setVoiceError(null)
    
    try {
      const checkResult = await checkMicrophonePermission()
      if (!checkResult.available) {
        alert(checkResult.error || '無法訪問麥克風')
        return
      }

      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: { ideal: 16000 },
        channelCount: { ideal: 1 },
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: audioConstraints 
      })
      streamRef.current = stream

      let mimeType = 'audio/webm;codecs=opus'
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm'
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4'
        } else {
          mimeType = ''
        }
      }

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' })
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }
        
        const audioAnalysis = await analyzeAudio(audioBlob)
        
        if (audioAnalysis.duration < 0.5) {
          setVoiceError('錄音時間太短，請再試一次')
          setIsTranscribing(false)
          setTimeout(() => setVoiceError(null), 3000)
          return
        }
        
        if (audioAnalysis.isEmpty) {
          setVoiceError('我無法判讀你的語音，請再試一次')
          setIsTranscribing(false)
          setTimeout(() => setVoiceError(null), 3000)
          return
        }
        
        await transcribeAudio(audioBlob)
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1
          if (newTime >= 60) {
            stopRecording()
            return 60
          }
          return newTime
        })
      }, 1000)
    } catch (err: any) {
      console.error('錄音錯誤:', err)
      setIsRecording(false)
      
      let errorMessage = '無法訪問麥克風'
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = '麥克風權限被拒絕，請在瀏覽器設置中允許此網站訪問麥克風'
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = '未找到麥克風設備，請確認麥克風已連接'
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = '麥克風被其他應用程序佔用，請關閉其他使用麥克風的應用後重試'
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = '麥克風不支持所需的音頻格式'
      } else if (err.name === 'SecurityError') {
        errorMessage = '安全錯誤：語音功能需要在 HTTPS 環境下使用'
      } else if (err.message) {
        errorMessage = err.message
      }
      
      alert(errorMessage)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
      
      setTimeout(() => {
        setRecordingTime(0)
      }, 500)
    }
  }

  const handleVoiceButtonClick = () => {
    if (!enabled) return

    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const clearError = () => {
    setVoiceError(null)
  }

  return {
    isRecording,
    recordingTime,
    isTranscribing,
    voiceError,
    formatRecordingTime,
    handleVoiceButtonClick,
    startRecording,
    stopRecording,
    clearError
  }
}

