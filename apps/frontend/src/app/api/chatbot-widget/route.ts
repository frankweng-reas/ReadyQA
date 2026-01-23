import { NextRequest, NextResponse } from 'next/server';

/**
 * Chatbot Widget JavaScript 檔案
 * 提供浮動按鈕和 iframe 嵌入功能
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin') || 
    request.headers.get('referer')?.split('/').slice(0, 3).join('/') ||
    'http://localhost:3000';

  const widgetScript = `
(function() {
  'use strict';
  
  // 取得當前 script tag 的 data attributes
  const currentScript = document.currentScript || 
    document.querySelector('script[data-chatbot-id]');
  
  if (!currentScript) {
    console.error('[ChatbotWidget] 找不到 script tag');
    return;
  }
  
  const chatbotId = currentScript.getAttribute('data-chatbot-id');
  const position = currentScript.getAttribute('data-position') || 'bottom-right';
  const bubbleColor = currentScript.getAttribute('data-bubble-color') || '#ffffff';
  let bubbleImage = currentScript.getAttribute('data-bubble-image');
  const bubbleAnimation = currentScript.getAttribute('data-bubble-animation') || 'none';
  const containerWidth = currentScript.getAttribute('data-width') || '400px';
  const containerHeight = currentScript.getAttribute('data-height') || '600px';
  
  console.log('[ChatbotWidget] 容器大小設定:', {
    width: containerWidth,
    height: containerHeight,
    'data-width': currentScript.getAttribute('data-width'),
    'data-height': currentScript.getAttribute('data-height')
  });
  
  if (!chatbotId) {
    console.error('[ChatbotWidget] 缺少 data-chatbot-id');
    return;
  }
  
  // 取得 origin（從 script src 或 window.location）
  const scriptSrc = currentScript.src;
  const origin = scriptSrc ? scriptSrc.split('/').slice(0, 3).join('/') : window.location.origin;
  const chatbotUrl = origin + '/zh-TW/chatbot/' + chatbotId;
  
  // 處理圖片路徑：轉換為正確的 URL
  if (bubbleImage) {
    // 如果是相對路徑（以 /uploads/ 開頭）
    if (bubbleImage.startsWith('/uploads/')) {
      // 開發環境：localhost 時，後端通常在 8000 端口
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        const apiUrl = window.location.port === '3000' 
          ? window.location.protocol + '//' + window.location.hostname + ':8000'
          : origin; // 如果前端不是 3000，假設後端在同一個 origin
        bubbleImage = apiUrl + bubbleImage;
        console.log('[ChatbotWidget] 開發環境，轉換相對路徑為:', bubbleImage);
      } else {
        // 生產環境：假設後端和前端在同一個域名，圖片直接使用相對路徑
        // 或者如果後端在不同端口，從 script src 推斷
        // 這裡假設生產環境前端和後端在同一個域名
        bubbleImage = origin + bubbleImage;
        console.log('[ChatbotWidget] 生產環境，使用相對路徑:', bubbleImage);
      }
    }
    // 如果是完整 URL 但指向前端端口，嘗試轉換為後端
    else if (bubbleImage.includes('localhost:3000/uploads/') || bubbleImage.includes(':3000/uploads/')) {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        bubbleImage = bubbleImage.replace(':3000', ':8000').replace('localhost:3000', 'localhost:8000');
        console.log('[ChatbotWidget] 轉換前端 URL 為後端 URL:', bubbleImage);
      } else {
        // 生產環境：移除端口號，使用同域名
        bubbleImage = bubbleImage.replace(/:3000/g, '').replace(/:8000/g, '');
        console.log('[ChatbotWidget] 生產環境，移除端口號:', bubbleImage);
      }
    }
    // 如果已經是完整的正確 URL，直接使用
  }
  
  // 判斷背景顏色亮度，決定圖標顏色
  function getIconColor(bgColor) {
    // 如果是白色或淺色，使用深色圖標
    if (bgColor === '#ffffff' || bgColor === 'white' || bgColor === '#fff') {
      return '#333333'; // 深灰色
    }
    // 簡單的亮度判斷（將 hex 轉為 RGB 並計算亮度）
    const hex = bgColor.replace('#', '');
    if (hex.length === 3) {
      // 簡化格式 #fff -> #ffffff
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness > 128 ? '#333333' : '#ffffff';
    } else if (hex.length === 6) {
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness > 128 ? '#333333' : '#ffffff';
    }
    // 默認使用白色
    return '#ffffff';
  }
  
  const iconColor = getIconColor(bubbleColor);
  
  // 創建浮動按鈕
  const button = document.createElement('div');
  button.id = 'chatbot-widget-button';
  button.style.cssText = \`
    position: fixed;
    \${position === 'bottom-right' ? 'bottom: 20px; right: 20px;' : ''}
    \${position === 'bottom-left' ? 'bottom: 20px; left: 20px;' : ''}
    \${position === 'top-right' ? 'top: 20px; right: 20px;' : ''}
    \${position === 'top-left' ? 'top: 20px; left: 20px;' : ''}
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background-color: \${bubbleColor};
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease;
    \${bubbleAnimation === 'bounce' ? 'animation: bounce 2s infinite;' : ''}
  \`;
  
  // 按鈕內容（圖片或預設圖標）
  if (bubbleImage) {
    console.log('[ChatbotWidget] 載入圖片:', bubbleImage);
    const img = document.createElement('img');
    img.src = bubbleImage;
    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; border-radius: 50%;';
    img.onload = function() {
      console.log('[ChatbotWidget] 圖片載入成功');
    };
    img.onerror = function() {
      console.error('[ChatbotWidget] 圖片載入失敗:', bubbleImage);
      // 圖片載入失敗，清除圖片並使用預設圖標
      button.innerHTML = '';
      button.style.backgroundColor = bubbleColor; // 保留背景顏色
      button.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="' + iconColor + '" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
    };
    button.appendChild(img);
  } else {
    console.log('[ChatbotWidget] 未設定圖片，使用預設圖標');
    button.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="' + iconColor + '" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  }
  
  // Hover 效果
  button.addEventListener('mouseenter', function() {
    this.style.transform = 'scale(1.1)';
  });
  button.addEventListener('mouseleave', function() {
    this.style.transform = 'scale(1)';
  });
  
  // 創建 iframe 容器
  let iframeContainer = null;
  let isOpen = false;
  let isToggling = false; // 防止重複觸發
  
  function toggleChatbot() {
    console.log('[ChatbotWidget] toggleChatbot called, isOpen:', isOpen, 'isToggling:', isToggling);
    
    // 防止重複觸發
    if (isToggling) {
      console.log('[ChatbotWidget] Already toggling, ignoring');
      return;
    }
    
    isToggling = true;
    
    if (isOpen) {
      // 關閉
      console.log('[ChatbotWidget] Closing chatbot');
      if (iframeContainer) {
        iframeContainer.style.opacity = '0';
        iframeContainer.style.transform = 'scale(0.9)';
        setTimeout(function() {
          if (iframeContainer && iframeContainer.parentNode) {
            iframeContainer.remove();
            iframeContainer = null;
          }
          isOpen = false;
          isToggling = false;
          console.log('[ChatbotWidget] Closed');
        }, 200);
      } else {
        isOpen = false;
        isToggling = false;
      }
    } else {
      // 打開
      console.log('[ChatbotWidget] Opening chatbot');
      
      // 如果已經存在容器，先移除
      if (iframeContainer && iframeContainer.parentNode) {
        iframeContainer.remove();
      }
      
      iframeContainer = document.createElement('div');
      iframeContainer.id = 'chatbot-widget-container';
      iframeContainer.style.cssText = \`
        position: fixed;
        \${position === 'bottom-right' ? 'bottom: 90px; right: 20px;' : ''}
        \${position === 'bottom-left' ? 'bottom: 90px; left: 20px;' : ''}
        \${position === 'top-right' ? 'top: 90px; right: 20px;' : ''}
        \${position === 'top-left' ? 'top: 90px; left: 20px;' : ''}
        width: \${containerWidth};
        height: \${containerHeight};
        max-width: calc(100vw - 40px);
        max-height: calc(100vh - 100px);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        z-index: 9998;
        overflow: hidden;
        background: white;
        opacity: 0;
        transform: scale(0.9);
        transition: opacity 0.2s ease, transform 0.2s ease;
      \`;
      
      const iframe = document.createElement('iframe');
      iframe.src = chatbotUrl;
      iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
      iframe.setAttribute('frameborder', '0');
      
      // 關閉按鈕
      const closeButton = document.createElement('button');
      closeButton.innerHTML = '×';
      closeButton.style.cssText = \`
        position: absolute;
        top: 10px;
        right: 10px;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.5);
        color: white;
        border: none;
        cursor: pointer;
        font-size: 24px;
        line-height: 1;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
      \`;
      closeButton.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        toggleChatbot();
      });
      
      iframeContainer.appendChild(iframe);
      iframeContainer.appendChild(closeButton);
      document.body.appendChild(iframeContainer);
      
      // 立即設置狀態，避免重複觸發
      isOpen = true;
      
      // 觸發動畫
      requestAnimationFrame(function() {
        if (iframeContainer) {
          iframeContainer.style.opacity = '1';
          iframeContainer.style.transform = 'scale(1)';
        }
        isToggling = false;
        console.log('[ChatbotWidget] Opened');
      });
    }
  }
  
  // 按鈕點擊事件（阻止冒泡）
  button.addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    toggleChatbot();
  }, true); // 使用 capture phase 確保優先執行
  
  // 添加動畫
  if (bubbleAnimation === 'bounce') {
    const style = document.createElement('style');
    style.textContent = \`
      @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
    \`;
    document.head.appendChild(style);
  }
  
  // 添加到頁面
  document.body.appendChild(button);
  
  console.log('[ChatbotWidget] Widget 已載入，chatbotId:', chatbotId);
})();
`;

  return new NextResponse(widgetScript, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
