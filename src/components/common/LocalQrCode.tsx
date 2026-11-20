import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface LocalQrCodeProps {
  value: string;
  size?: number;
  alt?: string;
  className?: string;
  fgColor?: string;
  bgColor?: string;
  darkColor?: string;
  lightColor?: string;
}

export const LocalQrCode: React.FC<LocalQrCodeProps> = ({
  value,
  size = 160,
  alt = 'QR Code Local',
  className = '',
  fgColor,
  bgColor,
  darkColor,
  lightColor,
}) => {
  const resolvedDark = darkColor || fgColor || '#0f172a';
  const resolvedLight = lightColor || bgColor || '#ffffff';
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    const payload = (value || '3C_CORP_EMPTY').slice(0, 1200);
    QRCode.toDataURL(payload, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: resolvedDark,
        light: resolvedLight,
      },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [value, size, resolvedDark, resolvedLight]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`bg-white flex items-center justify-center text-[10px] font-mono text-slate-400 ${className}`}
      >
        QR...
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt={alt}
      className={className}
    />
  );
};
