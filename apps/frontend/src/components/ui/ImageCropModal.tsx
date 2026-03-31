'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface ImageCropModalProps {
  image: string;
  onCropComplete: (croppedImageBlob: Blob) => void;
  onCancel: () => void;
}

export default function ImageCropModal({ image, onCropComplete, onCancel }: ImageCropModalProps) {
  const t = useTranslations('design');
  const tCommon = useTranslations('common');
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<'3:2' | '3:3' | '3:4' | '3:5'>('3:4');
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [bgColor, setBgColor] = useState<'black' | 'white'>('black');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // 加载图片并获取原始尺寸
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
      console.log('🔵 [ImageCrop] 原始图片尺寸:', img.naturalWidth, 'x', img.naturalHeight);
    };
    img.src = image;
  }, [image]);

  // 获取裁切框尺寸（基于比例）
  const getCropBoxSize = () => {
    const containerWidth = 600; // 预览区域宽度
    const containerHeight = 600; // 预览区域高度
    
    let width, height;
    switch (aspectRatio) {
      case '3:2':
        width = 450;
        height = 300;
        break;
      case '3:3':
        width = 400;
        height = 400;
        break;
      case '3:4':
        width = 375;
        height = 500;
        break;
      case '3:5':
        width = 360;
        height = 600;
        break;
      default:
        width = 375;
        height = 500;
    }
    
    return { width, height };
  };

  const cropBoxSize = getCropBoxSize();

  // 鼠标按下开始拖动
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  // 鼠标移动
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  // 鼠标释放
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 鼠标滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.001;
    const newScale = Math.min(Math.max(0.2, scale + delta), 1.5);
    setScale(newScale);
  };

  // 裁切并保存
  const handleConfirm = async () => {
    if (!containerRef.current || !imageSize.width) return;

    setIsProcessing(true);
    try {
      // 容器中心点
      const containerRect = containerRef.current.getBoundingClientRect();
      const containerCenterX = containerRect.width / 2;
      const containerCenterY = containerRect.height / 2;

      // 裁切框在容器中的位置（中心对齐）
      const cropBoxLeft = containerCenterX - cropBoxSize.width / 2;
      const cropBoxTop = containerCenterY - cropBoxSize.height / 2;

      // 图片在容器中的实际显示尺寸（考虑缩放）
      const displayWidth = imageSize.width * scale;
      const displayHeight = imageSize.height * scale;

      // 图片左上角在容器中的位置
      const imageLeft = containerCenterX + position.x - displayWidth / 2;
      const imageTop = containerCenterY + position.y - displayHeight / 2;

      // 裁切框相对于图片的位置
      const cropRelativeX = cropBoxLeft - imageLeft;
      const cropRelativeY = cropBoxTop - imageTop;

      // 转换为原始图片坐标
      const cropX = cropRelativeX / scale;
      const cropY = cropRelativeY / scale;
      const cropWidth = cropBoxSize.width / scale;
      const cropHeight = cropBoxSize.height / scale;

      console.log('🔵 [Crop] 裁切区域（原图坐标）:', {
        x: cropX,
        y: cropY,
        width: cropWidth,
        height: cropHeight,
      });

      // 使用 Canvas 裁切
      const croppedBlob = await cropImage(image, cropX, cropY, cropWidth, cropHeight);
      console.log('✅ [Crop] 裁切完成, blob size:', croppedBlob.size);
      
      onCropComplete(croppedBlob);
    } catch (error) {
      console.error('[ImageCropModal] crop failed:', error);
      alert(t('imageCrop.cropFailed'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Canvas 裁切函数
  const cropImage = (imageSrc: string, x: number, y: number, width: number, height: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('无法创建 Canvas context'));
          return;
        }

        // 确保裁切区域在图片范围内
        const safeX = Math.max(0, Math.min(x, img.width));
        const safeY = Math.max(0, Math.min(y, img.height));
        const safeWidth = Math.min(width, img.width - safeX);
        const safeHeight = Math.min(height, img.height - safeY);

        canvas.width = safeWidth;
        canvas.height = safeHeight;

        // 绘制裁切区域
        ctx.drawImage(
          img,
          safeX, safeY, safeWidth, safeHeight,
          0, 0, safeWidth, safeHeight
        );

        // 转换为 Blob
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas 转换失败'));
          }
        }, 'image/jpeg', 0.95);
      };
      
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = imageSrc;
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-75 p-4 image-crop-modal-scroll">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col image-crop-modal-scroll my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-2 border-b shrink-0">
          <h3 className="text-base font-semibold text-gray-900">{t('imageCrop.title')}</h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 -m-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Preview Area */}
        <div
          ref={containerRef}
          className="relative flex-1 overflow-hidden min-h-0"
          style={{ 
            minHeight: '600px',
            backgroundColor: bgColor === 'black' ? '#1a1a1a' : '#ffffff'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* 右上角背景切換按鈕 */}
          <div className="absolute top-4 right-4 z-50">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setBgColor(prev => prev === 'white' ? 'black' : 'white');
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition-all shadow-lg"
              style={{ backgroundColor: 'white' }}
              title={bgColor === 'white' ? t('switchToBlackBg') : t('switchToWhiteBg')}
            >
              {bgColor === 'white' ? (
                <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>
          
          {/* 图片 */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              cursor: isDragging ? 'grabbing' : 'grab',
            }}
          >
            <img
              ref={imageRef}
              src={image}
              alt={t('imageCrop.previewAlt')}
              draggable={false}
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                maxWidth: 'none',
                userSelect: 'none',
              }}
            />
          </div>

          {/* 裁切框遮罩 */}
          <div className="absolute inset-0 pointer-events-none">
            {/* 四周遮罩 */}
            <div className="absolute inset-0 bg-black bg-opacity-50" 
              style={{
                clipPath: `polygon(
                  0% 0%, 
                  0% 100%, 
                  calc(50% - ${cropBoxSize.width / 2}px) 100%, 
                  calc(50% - ${cropBoxSize.width / 2}px) calc(50% - ${cropBoxSize.height / 2}px),
                  calc(50% + ${cropBoxSize.width / 2}px) calc(50% - ${cropBoxSize.height / 2}px),
                  calc(50% + ${cropBoxSize.width / 2}px) calc(50% + ${cropBoxSize.height / 2}px),
                  calc(50% - ${cropBoxSize.width / 2}px) calc(50% + ${cropBoxSize.height / 2}px),
                  calc(50% - ${cropBoxSize.width / 2}px) 100%,
                  100% 100%,
                  100% 0%
                )`
              }}
            />
            
            {/* 裁切框边框 */}
            <div
              className="absolute border-2 border-white shadow-lg"
              style={{
                left: '50%',
                top: '50%',
                width: `${cropBoxSize.width}px`,
                height: `${cropBoxSize.height}px`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {/* 网格线 */}
              <div className="absolute inset-0">
                <div className="absolute top-1/3 left-0 right-0 border-t border-white opacity-50" />
                <div className="absolute top-2/3 left-0 right-0 border-t border-white opacity-50" />
                <div className="absolute left-1/3 top-0 bottom-0 border-l border-white opacity-50" />
                <div className="absolute left-2/3 top-0 bottom-0 border-l border-white opacity-50" />
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="px-6 py-4 border-t bg-gray-50">
          {/* 比例選擇 + 縮放控制（同一排） */}
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">{t('imageCrop.aspectRatio')}</label>
              <div className="flex space-x-2">
                <button
                  onClick={() => setAspectRatio('3:2')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    aspectRatio === '3:2'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {t('imageCrop.ratioLandscape')}
                </button>
                <button
                  onClick={() => setAspectRatio('3:3')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    aspectRatio === '3:3'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {t('imageCrop.ratioSquare')}
                </button>
                <button
                  onClick={() => setAspectRatio('3:4')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    aspectRatio === '3:4'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {t('imageCrop.ratioPortrait')}
                </button>
                <button
                  onClick={() => setAspectRatio('3:5')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    aspectRatio === '3:5'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {t('imageCrop.ratioTallPortrait')}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <label className="text-sm font-medium text-gray-700">
                {t('imageCrop.zoom', { percent: Math.round(scale * 100) })}
              </label>
              <input
                type="range"
                min={0.2}
                max={1.5}
                step={0.01}
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="w-32"
              />
            </div>
          </div>

          {/* 按鈕 */}
          <div className="flex items-center justify-end space-x-3">
            <button
              onClick={onCancel}
              disabled={isProcessing}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {tCommon('cancel')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('imageCrop.processing')}
                </>
              ) : (
                t('imageCrop.confirmCrop')
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
