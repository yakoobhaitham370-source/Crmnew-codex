import React, { useState, useEffect, useRef } from 'react';
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
  Upload,
  RefreshCw,
} from 'lucide-react';
import { LabScan } from '../../types/pharmacy';
import { getScanImage, saveScanImage } from '../../utils/scanStorage';
import { compressMedicalImage } from '../../utils/imageCompressor';
import { uploadScanImageToDrive } from '../../services/apiService';

interface ImagePreviewModalProps {
  scan: LabScan | null;
  patientName?: string;
  patientId?: string;
  gasUrl?: string;
  lang: 'ar' | 'en';
  onClose: () => void;
  onDelete?: (scanId: string) => void;
  onUpdateScan?: (updatedScan: LabScan) => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  scan,
  patientName,
  patientId,
  gasUrl,
  lang,
  onClose,
  onDelete,
  onUpdateScan,
}) => {
  const [currentScan, setCurrentScan] = useState<LabScan | null>(scan);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isReuploading, setIsReuploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentScan(scan);
  }, [scan]);

  useEffect(() => {
    // Reset transform when scan changes
    setZoom(1);
    setRotation(0);
    setHasError(false);
    setIsLoading(true);

    let isMounted = true;

    const resolveImageSource = async () => {
      if (!currentScan) return;

      // 1. Direct in-memory full-resolution dataUrl
      if (currentScan.dataUrl && currentScan.dataUrl.length > 50) {
        if (isMounted) {
          setImageSrc(currentScan.dataUrl);
          setIsLoading(false);
        }
        return;
      }

      // 2. Try loading from IndexedDB
      if (currentScan.id) {
        try {
          const cached = await getScanImage(currentScan.id);
          if (isMounted && cached && cached.length > 50) {
            setImageSrc(cached);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn('IndexedDB resolve error:', e);
        }
      }

      // 3. Extract Drive file ID if present
      let extractedId = currentScan.fileId;
      if (!extractedId && currentScan.driveUrl) {
        const match = currentScan.driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
                      currentScan.driveUrl.match(/id=([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          extractedId = match[1];
        }
      }

      // 4. Try preview URL
      if (currentScan.previewUrl) {
        if (isMounted) {
          setImageSrc(currentScan.previewUrl);
          setIsLoading(false);
        }
        return;
      }

      if (extractedId) {
        if (isMounted) {
          setImageSrc(`https://lh3.googleusercontent.com/d/${extractedId}`);
          setIsLoading(false);
        }
        return;
      }

      if (currentScan.driveUrl) {
        if (isMounted) {
          setImageSrc(currentScan.driveUrl);
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
  }, [currentScan]);

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

  if (!currentScan) return null;

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
    a.download = `${patientName || 'Patient'}_${currentScan.title || 'scan'}_${currentScan.date}.jpg`.replace(/\s+/g, '_');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleImageError = () => {
    let fileId = currentScan.fileId;
    if (!fileId && currentScan.driveUrl) {
      const match = currentScan.driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
                    currentScan.driveUrl.match(/id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) fileId = match[1];
    }

    // Try fallback endpoints in sequence
    if (fileId && !imageSrc.includes('thumbnail')) {
      setImageSrc(`https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`);
    } else if (fileId && !imageSrc.includes('export=view')) {
      setImageSrc(`https://drive.google.com/uc?export=view&id=${fileId}`);
    } else {
      setHasError(true);
    }
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsReuploading(true);
    try {
      const compressed = await compressMedicalImage(file, 1600, 0.82);
      const base64 = compressed.base64;
      const targetId = currentScan.id || 'scan-' + Date.now();
      const fileSizeStr = compressed.fileSizeStr;

      // 1. Save to local IndexedDB
      await saveScanImage(targetId, base64, {
        title: file.name,
        patientId: patientId || 'Patient',
        size: fileSizeStr,
      });

      let updated: LabScan = {
        ...currentScan,
        id: targetId,
        title: file.name,
        dataUrl: base64,
        fileSize: fileSizeStr,
        uploadStatus: gasUrl ? 'uploading' : 'local_only',
      };

      setCurrentScan(updated);
      setImageSrc(base64);
      setHasError(false);
      setIsLoading(false);

      if (onUpdateScan) {
        onUpdateScan(updated);
      }

      // 2. Upload to Google Drive if gasUrl is available
      if (gasUrl) {
        try {
          const driveRes = await uploadScanImageToDrive(
            gasUrl,
            patientId || patientName || 'Patient',
            file.name,
            base64
          );

          if (driveRes && (driveRes.success || driveRes.fileUrl)) {
            updated = {
              ...updated,
              driveUrl: driveRes.fileUrl,
              previewUrl: driveRes.previewUrl || driveRes.fileUrl,
              thumbnailUrl: driveRes.thumbnailUrl,
              fileId: driveRes.fileId,
              uploadStatus: 'saved_to_drive',
            };
            setCurrentScan(updated);
            if (onUpdateScan) {
              onUpdateScan(updated);
            }
          }
        } catch (driveErr) {
          console.warn('Google Drive scan re-upload error:', driveErr);
        }
      }
    } catch (err) {
      console.error('Failed to attach image:', err);
    } finally {
      setIsReuploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-black/90 backdrop-blur-md animate-fade-in select-none">
      {/* Hidden file input for direct attachment */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileAttach}
      />

      <div className={`bg-[#181818] border border-[#383838] rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200 ${
        isFullscreen ? 'w-full h-full' : 'max-w-5xl w-full h-[90vh]'
      }`}>
        {/* Top bar */}
        <div className="p-3.5 bg-[#222222] border-b border-[#383838] flex items-center justify-between gap-3 text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="w-5 h-5 text-blue-400 shrink-0" />
            <div className="min-w-0">
              <div className="font-extrabold text-sm truncate flex items-center gap-2">
                <span>{currentScan.title || (lang === 'ar' ? 'معاينة الصورة الأصلية' : 'Full Resolution Preview')}</span>
                {currentScan.fileSize && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700 font-mono">
                    {currentScan.fileSize}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-neutral-400 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-neutral-500" />
                  <span>{currentScan.date}</span>
                </span>
                {patientName && (
                  <span className="truncate text-blue-300">
                    {lang === 'ar' ? 'المريض:' : 'Patient:'} {patientName}
                  </span>
                )}
                {currentScan.driveUrl ? (
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
            {/* Direct Re-upload / Attach button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isReuploading}
              title={lang === 'ar' ? 'إرفاق أو استبدال ملف الصورة' : 'Attach or Replace Image File'}
              className="p-2 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 transition-colors flex items-center gap-1.5 text-xs font-bold"
            >
              {isReuploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {lang === 'ar' ? 'إرفاق / تغيير' : 'Attach / Replace'}
              </span>
            </button>

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
            {imageSrc && !hasError && (
              <button
                type="button"
                onClick={handleDownload}
                title={lang === 'ar' ? 'تحميل الصورة الأصلية بالدقة الكاملة' : 'Download Original High-Res Image'}
                className="p-2 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/40 transition-colors flex items-center gap-1.5 text-xs font-bold"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">{lang === 'ar' ? 'تحميل الأصل' : 'Download'}</span>
              </button>
            )}

            {/* Google Drive Link */}
            {currentScan.driveUrl && (
              <a
                href={currentScan.driveUrl}
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
                alt={currentScan.title || 'Medical Scan'}
                onError={handleImageError}
                className="max-w-full max-h-[78vh] object-contain rounded-lg shadow-2xl border border-neutral-800 pointer-events-auto"
                style={{ imageRendering: 'auto' }}
              />
            </div>
          ) : (
            <div className="text-center text-neutral-400 text-xs space-y-4 max-w-md p-6 bg-neutral-900/80 rounded-2xl border border-neutral-800 shadow-2xl">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <div className="font-bold text-white text-base mb-1">
                  {lang === 'ar' ? 'تعذر عرض الصورة الأصلية' : 'Image Source Unavailable'}
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  {lang === 'ar'
                    ? 'تم تسجيل بيانات الوصفة في النظام ولكن ملف الصورة غير موجود في ذاكرة هذا الجهاز. يمكنك إرفاق الصورة أو إعادة رفعها الآن بنقرة واحدة لحفظها سحابياً في Google Drive.'
                    : 'Scan record exists but file is not cached locally. Attach the photo now to store and sync it.'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isReuploading}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/25 transition-all"
                >
                  {isReuploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>{lang === 'ar' ? '📷 إرفاق / رفع الصورة الآن' : '📷 Attach Image Now'}</span>
                </button>

                {currentScan.driveUrl && (
                  <a
                    href={currentScan.driveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs border border-neutral-700 transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'Google Drive' : 'Google Drive'}</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="p-2.5 bg-[#1f1f1f] border-t border-[#383838] flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-3">
            <span>
              {lang === 'ar'
                ? '💡 نصيحة: يمكنك التكبير والتدوير لقراءة خط الطبيب بوضوح، أو إرفاق الصورة بدقة عالية.'
                : '💡 Tip: Zoom & rotate to inspect handwriting, or attach a new clear photo.'}
            </span>
          </div>

          {onDelete && currentScan.id && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذه الصورة؟' : 'Delete this image?')) {
                  onDelete(currentScan.id!);
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
