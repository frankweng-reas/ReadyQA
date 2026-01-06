# 語音輸入功能設定指南

## ✅ 已完成的實作

### 1. Frontend
- ✅ `useVoiceRecording` Hook - 管理錄音狀態和轉錄
- ✅ `audio-analysis.ts` - 分析音頻品質（避免空錄音）
- ✅ `ChatbotWidget` 整合語音按鈕和UI

### 2. Backend
- ✅ `WhisperService` - 調用 OpenAI Whisper API
- ✅ `AudioController` - `/api/audio/transcribe` endpoint
- ✅ `AudioModule` - 模組整合

## 📦 需要安裝的套件

### Backend
```bash
cd apps/backend
npm install form-data node-fetch@2
```

## ⚙️ 環境變數設定

在 `.env.local` 中添加：

```env
# OpenAI Whisper API
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_PROVIDER=openai

# 或使用 Azure OpenAI（可選）
# OPENAI_PROVIDER=azure-openai
# AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
# AZURE_OPENAI_API_VERSION=2024-10-21
# WHISPER_DEPLOYMENT_NAME=whisper
```

## 🎯 功能特色

### 用戶體驗
- 🎤 **一鍵錄音** - 點擊麥克風圖示開始/停止
- ⏱️ **即時計時** - 顯示錄音時間（最長 60 秒）
- 🔴 **錄音指示** - 錄音時按鈕變紅並顯示計時器
- 🔄 **轉錄狀態** - Loading 動畫顯示轉錄中
- ✍️ **自動填入** - 轉錄完成後自動填入輸入框
- ❌ **錯誤提示** - 友善的錯誤訊息

### 技術優化
- 🎵 **音頻分析** - 自動檢測空錄音和音量過低
- 🔇 **降噪處理** - 回音消除、噪音抑制
- 🌐 **中英混合** - 使用 prompt 改善辨識準確度
- 🔒 **權限檢查** - 完整的麥克風權限處理
- 📱 **瀏覽器兼容** - 支援現代瀏覽器（Chrome、Firefox、Edge）

## 🚀 測試步驟

### 1. 安裝套件
```bash
cd apps/backend
npm install form-data node-fetch@2
```

### 2. 設定環境變數
在 `.env.local` 中添加 `OPENAI_API_KEY`

### 3. 重啟服務
```bash
# Backend
cd apps/backend
npm run dev

# Frontend
cd apps/frontend
npm run dev
```

### 4. 啟用語音功能
1. 進入設計頁面
2. 找到「輸入框設定」
3. 開啟「啟動語音」開關
4. 保存設定

### 5. 測試錄音
1. 在 chatbot 預覽中點擊麥克風按鈕
2. 允許麥克風權限
3. 開始說話
4. 點擊紅色按鈕或等待自動停止
5. 等待轉錄完成（約 2-5 秒）
6. 轉錄文字會自動填入輸入框

## 🎨 UI 狀態

### 按鈕狀態
- **閒置** - 灰色麥克風圖示
- **錄音中** - 紅色背景 + 方形圖示 + 計時器
- **轉錄中** - Loading 動畫
- **錯誤** - 紅色錯誤訊息（3-5 秒後自動消失）

### 錯誤處理
- 錄音時間太短（< 0.5 秒）
- 音量過低（空錄音）
- 麥克風權限被拒絕
- 麥克風設備未找到
- 麥克風被佔用
- 轉錄 API 錯誤

## 📝 API Endpoint

### POST `/api/audio/transcribe`

**Request (multipart/form-data):**
```
file: <audio file>
chatbotId: string
language: string (optional)
prompt: string (optional)
denoise: 'true' | 'false' (optional)
```

**Response:**
```json
{
  "success": true,
  "text": "轉錄的文字內容"
}
```

## 🔧 設定選項

### 音頻約束
```typescript
{
  echoCancellation: true,      // 回音消除
  noiseSuppression: true,      // 噪音抑制
  autoGainControl: true,       // 自動增益控制
  sampleRate: { ideal: 16000 },  // Whisper 推薦 16kHz
  channelCount: { ideal: 1 },    // 單聲道
}
```

### Whisper API 選項
- **language**: 'zh', 'en', 或不指定（自動檢測）
- **prompt**: 提示語，改善辨識準確度
- **provider**: 'openai' 或 'azure-openai'

## ⚠️ 注意事項

1. **HTTPS 要求** - 語音功能需要 HTTPS 或 localhost
2. **瀏覽器支援** - 需要現代瀏覽器（Chrome、Firefox、Edge）
3. **API 費用** - Whisper API 按秒計費（約 $0.006/分鐘）
4. **檔案大小** - 最大 25MB（約 30 分鐘音頻）
5. **錄音時長** - 自動限制 60 秒

## 🐛 常見問題

### Q: 點擊麥克風沒反應？
A: 檢查瀏覽器是否允許麥克風權限

### Q: 錯誤「需要 HTTPS」？
A: 在 localhost 開發時沒問題，部署時需要 HTTPS

### Q: 轉錄結果不準確？
A: 可以調整 `prompt` 參數來改善辨識

### Q: 支援哪些音頻格式？
A: WebM (Opus), MP4, WAV，瀏覽器會自動選擇

## 📚 參考資料

- [OpenAI Whisper API 文件](https://platform.openai.com/docs/guides/speech-to-text)
- [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

---

**實作完成！** 🎉 現在可以開始使用語音輸入功能了！

