'use client';

import { useState, useRef, useEffect } from 'react';

interface ColorInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export default function ColorInput({ value, onChange, label, className = '', disabled = false }: ColorInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 同步外部值變更（例如從顏色選擇器改變）
  useEffect(() => {
    setLocalValue(value);
    setError(''); // 清除錯誤
  }, [value]);

  // 清理 timeout
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    setError(''); // 清除錯誤提示
    // 清除錯誤訊息的 timeout
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    // 不要立即調用 onChange，等到 blur 驗證通過後再調用
  };

  const handleTextBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // 檢查是否為有效的 6 位十六進位顏色值
    if (/^#[0-9A-Fa-f]{6}$/.test(inputValue)) {
      // 有效：保存
      onChange(inputValue);
      setError('');
    } else {
      // 無效：顯示錯誤並恢復原值
      setError('無效的顏色值，請輸入 6 位十六進位顏色碼（例如：#0B3037）');
      setLocalValue(value);
      if (inputRef.current) {
        inputRef.current.value = value;
      }
      // 清除舊的 timeout
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      // 3 秒後自動清除錯誤訊息
      errorTimeoutRef.current = setTimeout(() => setError(''), 3000);
    }
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue);
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-base font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <div className="flex items-center space-x-3">
      <input
        type="color"
        value={value}
        onChange={handleColorChange}
        disabled={disabled}
        className="w-14 h-10 rounded-lg border-2 border-gray-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={handleTextChange}
        onBlur={handleTextBlur}
        disabled={disabled}
        className={`w-24 px-2 py-2 border rounded-lg focus:ring-2 focus:border-transparent font-mono text-sm disabled:opacity-50 disabled:bg-gray-100 disabled:cursor-not-allowed ${
          error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
        }`}
        placeholder="#000000"
        maxLength={7}
      />
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
