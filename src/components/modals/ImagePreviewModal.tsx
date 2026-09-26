import React, { useState, useEffect } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Download,
  ExternalLink,
  Maximize2,
  Minimize2,
  Calendar,
  CloudCheck,
  HardDrive,
  FileText,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { LabScan } from '../../types/pharmacy';
import { getScanImage } from '../../utils/scanStorage';

interface ImagePreviewModalProps {
  scan: LabScan | null;
  patientName?: string;
  lang: 'ar' | 'en';
  onClose: () => void;
  onDelete?: (scanId: string) => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  scan,
  patientName,
  lang,
  onClose,
  onDelete,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Reset transform when scan changes
    setZoom(1);
    setRotation(0);
    setHasError(false);
    setIsLoading(true);

    let isMounted = true;

    const resolveImageSource = async () => {
      if (!scan) return;

      // 1. Direct in-memory full-resolution dataUrl
      if (scan.dataUrl && scan.dataUrl.length > 50) {
        if (isMounted) {
          setImageSrc(scan.dataUrl);
          setIsLoading(false);
        }
        return;
      }

      // 2. Try loading from IndexedDB
      if (scan.id) {
        try {
          const cached = await getScanImage(scan.id);
          if (isMounted && cached && cached.length > 50) {
            setImageSrc(cached);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn('IndexedDB resolve error:', e);
        }
      }

      // 3. Try Google Drive preview / thumbnail / fileUrl
      if (scan.previewUrl) {
        if (isMounted) {
          setImageSrc(scan.previewUrl);
          setIsLoading(false);
        }
        return;
      }

      if (scan.fileId) {
        if (isMounted) {
          setImageSrc(`https://lh3.googleusercontent.com/d/${scan.fileId}`);
          setIsLoading(false);
        }
        return;
      }

      if (scan.driveUrl) {
        const match = scan.driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          if (isMounted) {
            setImageSrc(`https://lh3.googleusercontent.com/d/${match[1]}`);
            setIsLoading(false);
          }
          return;
        }
        if (isMounted) {
          setImageSrc(scan.driveUrl);
          setIsLoading(false);
        }
        return;
      }

      if (isMounted) {
        setImageSrc('');
        setIsLoading(false);
        setHasError(true);
      }
    };

    resolveImageSource();

    return () => {
      isMounted = false;
    };
  }, [scan]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.25, 4));
      if (e.key === '-') setZoom(z => Math.max(z - 0.25, 0.5));
      if (e.key === 'r' || e.key === 'R') setRotation(r => (r + 90) % 360);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!scan) return null;

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.5));
  const handleResetZoom = () => {
    setZoom(1);
    setRotation(0);
  };
  const handleRotateCw = () => setRotation(r => (r + 90) % 360);
  const handleRotateCcw = () => setRotation(r => (r - 90 + 360) % 360);

  const handleDownload = () => {
    if (!imageSrc) return;
    const a = document.createElement('a');
    a.href = imageSrc;
    a.download = `${patientName || 'Patient'}_${scan.title || 'scan'}_${scan.date}.jpg`.replace(/\s+/g, '_');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleImageError = () => {
    // If primary source failed, try alternative Drive thumbnail URL
    if (scan.fileId && !imageSrc.includes('thumbnail')) {
      setImageSrc(`https://drive.google.com/thumbnail?id=${scan.fileId}&sz=w2000`);
    } else {
      setHasError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-black/90 backdrop-blur-md animate-fade-in select-none">
      <div className={`bg-[#181818] border border-[#383838] rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200 ${
        isFullscreen ? 'w-full h-full' : 'max-w-5xl w-full h-[90vh]'
      }`}>
        {/* Top bar */}
        <div className="p-3.5 bg-[#222222] border-b border-[#383838] flex items-center justify-between gap-3 text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="w-5 h-5 text-blue-400 shrink-0" />
            <div className="min-w-0">
              <div className="font-extrabold text-sm truncate flex items-center gap-2">
                <span>{scan.title || (lang === 'ar' ? 'معاينة الصورة الأصلية' : 'Full Resolution Preview')}</span>
                {scan.fileSize && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700 font-mono">
                    {scan.fileSize}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-neutral-400 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-neutral-500" />
                  <span>{scan.date}</span>
                </span>
                {patientName && (
                  <span className="truncate text-blue-300">
                    {lang === 'ar' ? 'المريض:' : 'Patient:'} {patientName}
                  </span>
                )}
                {scan.driveUrl ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                    <CloudCheck className="w-3 h-3" />
                    <span>{lang === 'ar' ? 'محفوظ على Google Drive ☁️' : 'Saved in Google Drive'}</span>
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1">
                    <HardDrive className="w-3 h-3" />
                    <span>{lang === 'ar' ? 'محفوظ محلياً بدقة كاملة' : 'Local Storage'}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Control Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Zoom Controls */}
            <div className="bg-[#141414] border border-[#333333] rounded-lg p-0.5 flex items-center gap-0.5">
              <button
                type="button"
                onClick={handleZoomOut}
                title={lang === 'ar' ? 'تصغير (-)' : 'Zoom Out (-)'}
                className="p-1.5 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                title={lang === 'ar' ? 'إعادة ضبط الحجم' : 'Reset Scale'}
                className="px-2 py-1 text-[11px] font-mono font-bold text-neutral-300 hover:text-white hover:bg-neutral-800 rounded transition-colors"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                title={lang === 'ar' ? 'تكبير (+)' : 'Zoom In (+)'}
                className="p-1.5 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Rotation Controls */}
            <div className="bg-[#141414] border border-[#333333] rounded-lg p-0.5 flex items-center gap-0.5">
              <button
                type="button"
                onClick={handleRotateCcw}
                title={lang === 'ar' ? 'تدوير يساراً 90°' : 'Rotate Left 90°'}
                className="p-1.5 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleRotateCw}
                title={lang === 'ar' ? 'تدوير يميناً 90° (R)' : 'Rotate Right 90° (R)'}
                className="p-1.5 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            {/* Download Button */}
            <button
              type="button"
              onClick={handleDownload}
              title={lang === 'ar' ? 'تحميل الصورة الأصلية بالدقة الكاملة' : 'Download Original High-Res Image'}
              className="p-2 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/40 transition-colors flex items-center gap-1.5 text-xs font-bold"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{lang === 'ar' ? 'تحميل الأصل' : 'Download'}</span>
            </button>

            {/* Google Drive Link */}
            {scan.driveUrl && (
              <a
                href={scan.driveUrl}
                target="_blank"
                rel="noreferrer"
                title={lang === 'ar' ? 'فتح الملف في Google Drive' : 'Open in Google Drive'}
                className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition-colors flex items-center gap-1.5 text-xs"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden md:inline">Drive</span>
              </a>
            )}

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? (lang === 'ar' ? 'تصغير الشاشة' : 'Exit Fullscreen') : (lang === 'ar' ? 'ملء الشاشة' : 'Fullscreen')}
              className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              title={lang === 'ar' ? 'إغلاق (Esc)' : 'Close (Esc)'}
              className="p-2 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-600/40 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewport Area */}
        <div className="flex-1 overflow-auto bg-[#0d0d0d] relative flex items-center justify-center p-4 min-h-[300px]">
          {isLoading ? (
            <div className="text-center text-neutral-400 text-xs flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              <span>{lang === 'ar' ? 'جارِ جلب وتحميل الصورة بالدقة الكاملة...' : 'Loading full-resolution image...'}</span>
            </div>
          ) : imageSrc && !hasError ? (
            <div
              className="transition-transform duration-150 ease-out flex items-center justify-center max-w-full max-h-full"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
              }}
            >
              <img
                src={imageSrc}
                alt={scan.title || 'Medical Scan'}
                onError={handleImageError}
                className="max-w-full max-h-[78vh] object-contain rounded-lg shadow-2xl border border-neutral-800 pointer-events-auto"
                style={{ imageRendering: 'auto' }}
              />
            </div>
          ) : (
            <div className="text-center text-neutral-400 text-xs space-y-3 max-w-md p-6 bg-neutral-900/60 rounded-xl border border-neutral-800">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
              <div className="font-bold text-white text-sm">
                {lang === 'ar' ? 'تعذر عرض الصورة الأصلية' : 'Image Source Unavailable'}
              </div>
              <p className="text-neutral-400 text-[11px] leading-relaxed">
                {lang === 'ar'
                  ? 'تم تسجيل بيانات الوصفة ولكن لم يتم حفظ ملف الصورة في ذاكرة المتصفح الحالية. يرجى إعادة إرفاق الصورة بدقة كاملة.'
                  : 'Scan entry exists but image file is not present in local storage. Please re-attach the image.'}
              </p>
              {scan.driveUrl && (
                <a
                  href={scan.driveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'فتح الملف في Google Drive' : 'Open in Google Drive'}</span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="p-2.5 bg-[#1f1f1f] border-t border-[#383838] flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-3">
            <span>
              {lang === 'ar'
                ? '💡 نصيحة: يمكنك التكبير والتدوير لقراءة خط الطبيب بوضوح.'
                : '💡 Tip: Zoom & rotate to inspect doctor handwriting in detail.'}
            </span>
          </div>

          {onDelete && scan.id && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذه الصورة؟' : 'Delete this image?')) {
                  onDelete(scan.id!);
                  onClose();
                }
              }}
              className="text-rose-400 hover:text-rose-300 hover:underline font-semibold"
            >
              {lang === 'ar' ? 'حذف الصورة' : 'Delete Image'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
