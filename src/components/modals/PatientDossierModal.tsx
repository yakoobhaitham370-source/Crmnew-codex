import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText,
  X,
  HeartPulse,
  Image as ImageIcon,
  Calendar,
  Printer,
  Copy,
  MessageSquare,
  Plus,
  Trash2,
  ExternalLink,
  ShieldAlert,
  ZoomIn,
  UploadCloud,
  CheckCircle2,
  HardDrive,
  User,
} from 'lucide-react';
import QRCode from 'qrcode';
import { Patient, Medication, VitalsEntry, LabScan, FollowUpEntry, RefillRecord, RefillReservation } from '../../types/pharmacy';
import { MedicationRefillTimeline } from '../medications/MedicationRefillTimeline';
import {
  getDrugScheduleSuggestion,
} from '../../data/drugDatabase';
import {
  formatYMD,
  formatPhoneForWhatsApp,
  calculatePatientAge,
  generateThermalSlipText,
} from '../../utils/pharmacyCalculations';
import { uploadScanImageToDrive } from '../../services/apiService';
import { PatientAdherenceVitalsChart } from '../charts/PatientAdherenceVitalsChart';
import { ImagePreviewModal } from './ImagePreviewModal';
import { saveScanImage, getScanImage, enrichPatientScans, deleteScanImage } from '../../utils/scanStorage';
import { duplicatePhonePatients, normalizeDigits, patientPhoneKey, validatePatientRecord, localDateKey, type RecordIssue } from '../../utils/patientRecords';
import { compressMedicalImage } from '../../utils/imageCompressor';

// Internal Scan Card subcomponent with reliable IndexedDB + Google Drive resolution
const ScanCard: React.FC<{
  scan: LabScan;
  lang: 'ar' | 'en';
  onPreview: (scan: LabScan) => void;
  onDelete: (scanId: string) => void;
}> = ({ scan, lang, onPreview, onDelete }) => {
  const [imgSrc, setImgSrc] = useState<string>(scan.dataUrl || scan.previewUrl || scan.thumbnailUrl || scan.driveUrl || '');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;
    if (scan.dataUrl && scan.dataUrl.length > 50) {
      setImgSrc(scan.dataUrl);
      return;
    }

    if (scan.id) {
      getScanImage(scan.id).then(cached => {
        if (active && cached && cached.length > 50) {
          setImgSrc(cached);
        }
      });
    }

    if (scan.previewUrl) {
      setImgSrc(scan.previewUrl);
    } else if (scan.fileId) {
      setImgSrc(`https://lh3.googleusercontent.com/d/${scan.fileId}`);
    } else if (scan.driveUrl) {
      const match = scan.driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        setImgSrc(`https://lh3.googleusercontent.com/d/${match[1]}`);
      }
    }

    return () => {
      active = false;
    };
  }, [scan.id, scan.dataUrl, scan.previewUrl, scan.driveUrl, scan.fileId]);

  return (
    <div className="border border-stroke hover:border-brand rounded-[4px] overflow-hidden bg-canvas group relative transition-colors duration-150 flex flex-col">
      {/* Image Thumbnail Container */}
      <div
        onClick={() => onPreview({ ...scan, dataUrl: imgSrc || scan.dataUrl })}
        className="relative h-40 bg-canvas cursor-pointer overflow-hidden flex items-center justify-center group"
        title={lang === 'ar' ? 'اضغط للمعاينة بالدقة الكاملة' : 'Click for full-res preview'}
      >
        {imgSrc && !hasError ? (
          <img
            src={imgSrc}
            alt={scan.title || 'Scan'}
            onError={() => {
              if (!hasError && scan.fileId && !imgSrc.includes('thumbnail')) {
                setImgSrc(`https://drive.google.com/thumbnail?id=${scan.fileId}&sz=w2000`);
                setHasError(true);
              } else {
                setHasError(true);
              }
            }}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5 text-neutral-500">
            <ImageIcon className="w-8 h-8 text-neutral-600" />
            <span className="text-[10px] text-neutral-500">{lang === 'ar' ? 'انقر للمعاينة' : 'Click to inspect'}</span>
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <span className="px-3 py-1.5 rounded-[4px] bg-brand text-on-brand font-bold text-xs flex items-center gap-1.5">
            <ZoomIn className="w-4 h-4" />
            <span>{lang === 'ar' ? 'معاينة بالدقة الكاملة' : 'Full Preview'}</span>
          </span>
        </div>

        {/* Storage badge */}
        <div className="absolute top-2 left-2">
          {scan.driveUrl ? (
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-success-bg text-success-fg border border-success-border font-bold flex items-center gap-1">
              <span>☁️ Drive</span>
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-brand-subtle text-brand border border-brand font-bold flex items-center gap-1">
              <span>💾 Full Res</span>
            </span>
          )}
        </div>
      </div>

      {/* Card Footer Details */}
      <div className="p-2.5 bg-surface border-t border-stroke flex-1 flex flex-col justify-between gap-2">
        <div>
          <div className="font-bold text-xs text-neutral-200 truncate" title={scan.title}>
            {scan.title || (lang === 'ar' ? 'وصفة طبية' : 'Prescription Scan')}
          </div>
          <div className="text-[10px] text-neutral-400 flex items-center justify-between mt-1">
            <span>{scan.date}</span>
            {scan.fileSize && <span className="font-mono text-neutral-500">{scan.fileSize}</span>}
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-stroke gap-1">
          <button
            type="button"
            onClick={() => onPreview({ ...scan, dataUrl: imgSrc || scan.dataUrl })}
            className="text-[11px] font-bold text-brand hover:text-brand flex items-center gap-1"
          >
            <ZoomIn className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'معاينة' : 'Preview'}</span>
          </button>

          <div className="flex items-center gap-1">
            {scan.driveUrl && (
              <a
                href={scan.driveUrl}
                target="_blank"
                rel="noreferrer"
                title={lang === 'ar' ? 'فتح في Google Drive' : 'Open in Google Drive'}
                className="p-1 rounded text-neutral-400 hover:text-fg hover:bg-neutral-800 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              type="button"
              onClick={() => onDelete(scan.id!)}
              title={lang === 'ar' ? 'حذف الصورة' : 'Delete'}
              className="p-1 rounded text-critical-fg hover:text-critical-fg hover:bg-critical-bg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface PatientDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  patients: Patient[];
  onOpenExistingPatient: (patientId: string) => void;
  initialTab?: string;
  followUps?: FollowUpEntry[];
  reservations: RefillReservation[];
  onManageReservation: (id: string) => void;
  pharmacyName: string;
  gasUrl: string;
  lang: 'ar' | 'en';
  onSavePatient: (patient: Patient) => void;
  onDeletePatient?: (patientId: string) => void;
  onOpenHouseholdModal: (familyTag: string) => void;
  onOpenNewFollowUp?: () => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const PatientDossierModal: React.FC<PatientDossierModalProps> = ({
  isOpen,
  onClose,
  patient,
  patients,
  onOpenExistingPatient,
  initialTab = 'demographics',
  followUps = [],
  reservations,
  onManageReservation,
  pharmacyName,
  gasUrl,
  lang,
  onSavePatient,
  onDeletePatient,
  onOpenHouseholdModal,
  onOpenNewFollowUp,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recordIssues, setRecordIssues] = useState<RecordIssue[]>([]);
  const [sharedPhoneAcknowledged, setSharedPhoneAcknowledged] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Patient>({
    id: '',
    name: '',
    phone: '',
    dob: '',
    age: 0,
    gender: 'M',
    familyTag: '',
    loyaltyPoints: 0,
    allergies: '',
    notes: '',
    medications: [],
    vitals: [],
    scans: [],
    createdAt: new Date().toISOString(),
    isArchived: false,
  });

  // Vitals inputs
  const [newSys, setNewSys] = useState('');
  const [newDia, setNewDia] = useState('');
  const [newSugar, setNewSugar] = useState('');
  const [newMisc, setNewMisc] = useState('');

  // Thermal QR code
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Scan upload & In-app preview state
  const [isUploadingScan, setIsUploadingScan] = useState(false);
  const [previewingScan, setPreviewingScan] = useState<LabScan | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Track loaded patient ID and open state to prevent flickering and re-render loops
  const lastLoadedPatientIdRef = useRef<string | null>(null);
  const isCurrentlyOpenRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      isCurrentlyOpenRef.current = false;
      lastLoadedPatientIdRef.current = null;
      return;
    }

    const currentPatientKey = patient?.id || '__NEW_PATIENT__';

    // Only re-initialize form state when modal transitions from closed to open, or target patient changes
    if (!isCurrentlyOpenRef.current || lastLoadedPatientIdRef.current !== currentPatientKey) {
      isCurrentlyOpenRef.current = true;
      lastLoadedPatientIdRef.current = currentPatientKey;

      if (patient) {
        setFormData({
          ...patient,
          medications: patient.medications ? [...patient.medications] : [],
          vitals: patient.vitals ? [...patient.vitals] : [],
          scans: patient.scans ? [...patient.scans] : [],
        });

        // Hydrate all scans from IndexedDB safely without resetting other fields
        enrichPatientScans(patient).then(enriched => {
          if (enriched && Array.isArray(enriched.scans) && enriched.scans.length > 0) {
            setFormData(prev => {
              if (prev.id !== patient.id) return prev;
              return {
                ...prev,
                scans: enriched.scans,
              };
            });
          }
        });
      } else {
        setFormData({
          id: 'PT-' + crypto.randomUUID(),
          name: '',
          phone: '',
          dob: '',
          age: 0,
          gender: 'M',
          familyTag: '',
          loyaltyPoints: 0,
          allergies: '',
          notes: '',
          medications: [
            {
              name: '',
              lastDispenseDate: formatYMD(new Date()),
              daysSupply: 30,
              timing: 'morning',
              mealRelation: 'after_meal',
            },
          ],
          vitals: [],
          scans: [],
          createdAt: new Date().toISOString(),
          isArchived: false,
        });
      }

      setRecordIssues([]);
      setSharedPhoneAcknowledged(false);
      setActiveTab(initialTab || 'demographics');
    }
  }, [isOpen, patient?.id, initialTab]);

  // Generate QR Code when thermal slip tab is opened
  useEffect(() => {
    if (activeTab === 'thermal' && formData.name) {
      const summary = `PATIENT: ${formData.name} | TEL: ${formData.phone} | MEDS: ${(formData.medications || []).map(m => m.name).filter(Boolean).join(', ')}`;
      QRCode.toDataURL(summary, { margin: 1, width: 140 }, (err, url) => {
        if (!err && url) setQrDataUrl(url);
      });
    }
  }, [activeTab, formData.name, formData.phone, formData.medications]);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('button, input')?.focus());
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') || []).filter(el => el.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKeyboard);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', handleKeyboard); previousFocus?.focus(); };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const age = calculatePatientAge(val);
    setFormData(prev => ({ ...prev, dob: val, age }));
  };

  const handleAddMedication = () => {
    setFormData(prev => ({
      ...prev,
      medications: [
        ...prev.medications,
        {
          name: '',
          lastDispenseDate: formatYMD(new Date()),
          daysSupply: 30,
          timing: 'morning',
          mealRelation: 'after_meal',
        },
      ],
    }));
  };

  const handleRemoveMedication = (index: number) => {
    setFormData(prev => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index),
    }));
  };

  const handleMedChange = (index: number, field: keyof Medication, val: any) => {
    setFormData(prev => {
      const copy = [...prev.medications];
      copy[index] = { ...copy[index], [field]: val };

      if (field === 'name' && val) {
        const suggestion = getDrugScheduleSuggestion(val);
        copy[index].timing = suggestion.timing;
        copy[index].mealRelation = suggestion.mealRelation;
      }
      return { ...prev, medications: copy };
    });
  };

  const handleUpdateMedRefillHistory = (medIndex: number, newHistory: RefillRecord[]) => {
    setFormData(prev => {
      const copy = [...prev.medications];
      if (copy[medIndex]) {
        copy[medIndex] = {
          ...copy[medIndex],
          refillHistory: newHistory,
        };
      }
      return { ...prev, medications: copy };
    });
  };

  const handleAddVitals = () => {
    if (!newSys && !newSugar) {
      onShowToast(lang === 'ar' ? 'يرجى إدخال الضغط أو السكر على الأقل' : 'Enter BP or Glucose', 'error');
      return;
    }

    const sysNum = parseInt(newSys, 10);
    const diaNum = parseInt(newDia, 10);
    const sugarNum = parseInt(newSugar, 10);

    const bpStr = newSys && newDia ? `${newSys}/${newDia}` : newSys ? `${newSys}/—` : '—';
    const entry: VitalsEntry = {
      id: 'v-' + Date.now(),
      date: new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US'),
      bp: bpStr,
      systolic: isNaN(sysNum) ? undefined : sysNum,
      diastolic: isNaN(diaNum) ? undefined : diaNum,
      sugar: newSugar || '—',
      glucose: isNaN(sugarNum) ? undefined : sugarNum,
      misc: newMisc || (lang === 'ar' ? 'قراءة روتينية' : 'Routine Reading'),
      assessment:
        sysNum && sysNum >= 140
          ? (lang === 'ar' ? 'ضغط مرتفع (يحتاج متابعة)' : 'High BP (Follow up)')
          : sugarNum && sugarNum >= 180
          ? (lang === 'ar' ? 'سكر مرتفع (يحتاج ضبط)' : 'High Glucose (Adjust)')
          : (lang === 'ar' ? 'ضمن النطاق المقبول' : 'Within normal limits'),
    };

    setFormData(prev => ({
      ...prev,
      vitals: [entry, ...(prev.vitals || [])],
    }));

    setNewSys('');
    setNewDia('');
    setNewSugar('');
    setNewMisc('');
    onShowToast(lang === 'ar' ? 'تم تسجيل القراءة الحيوية بنجاح' : 'Vitals logged', 'success');
  };

  const handleScanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingScan(true);
    try {
      // High-performance client-side medical compression (keeps crystal-clear text, drops 10MB -> ~300KB)
      const compressed = await compressMedicalImage(file, 1600, 0.82);
      const base64 = compressed.base64;
      const scanId = 'scan-' + Date.now();
      const fileSizeStr = compressed.fileSizeStr;

      // 1. Immediately save to IndexedDB (virtually unlimited quota)
      await saveScanImage(scanId, base64, {
        title: file.name,
        patientId: formData.id,
        size: fileSizeStr,
      });

      // 2. Create initial local scan
      const newScan: LabScan = {
        id: scanId,
        date: new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US'),
        title: file.name,
        dataUrl: base64,
        fileSize: fileSizeStr,
        uploadStatus: gasUrl ? 'uploading' : 'local_only',
      };

      setFormData(prev => ({
        ...prev,
        scans: [newScan, ...(prev.scans || [])],
      }));

      setIsUploadingScan(false);
      onShowToast(
        lang === 'ar'
          ? `تم حفظ صورة الوصفة بنجاح (${fileSizeStr})`
          : `Prescription scan saved (${fileSizeStr})`,
        'success'
      );

      // 3. Asynchronously upload optimized image to Google Drive if gasUrl is set
      if (gasUrl) {
        try {
          const driveRes = await uploadScanImageToDrive(
            gasUrl,
            formData.id || formData.name || 'Patient',
            file.name,
            base64
          );

          if (driveRes && driveRes.success) {
            setFormData(prev => ({
              ...prev,
              scans: (prev.scans || []).map(s =>
                s.id === scanId
                  ? {
                      ...s,
                      driveUrl: driveRes.fileUrl,
                      previewUrl: driveRes.previewUrl || driveRes.fileUrl,
                      thumbnailUrl: driveRes.thumbnailUrl,
                      fileId: driveRes.fileId,
                      uploadStatus: 'saved_to_drive',
                    }
                  : s
              ),
            }));

            onShowToast(
              lang === 'ar'
                ? 'تم رفع وحفظ الصورة بنجاح على Google Drive بدقتها الكاملة ☁️'
                : 'Full-res scan uploaded to Google Drive successfully ☁️',
              'success'
            );
          }
        } catch (driveErr) {
          console.warn('Google Drive scan upload background error:', driveErr);
        }
      }
    } catch (err: any) {
      console.error('Scan processing error:', err);
      setIsUploadingScan(false);
      onShowToast(
        lang === 'ar' ? 'حدث خطأ أثناء معالجة الصورة' : 'Error processing image',
        'error'
      );
    }
  };

  const handleDeleteScan = async (scanId: string) => {
    await deleteScanImage(scanId);
    setFormData(prev => ({
      ...prev,
      scans: (prev.scans || []).filter(s => s.id !== scanId),
    }));
    onShowToast(lang === 'ar' ? 'تم حذف الصورة' : 'Scan removed', 'info');
  };

  const duplicates = duplicatePhonePatients(formData, patients);


  const handleSave = () => {
    const issues = validatePatientRecord(formData);
    if (duplicates.length && !sharedPhoneAcknowledged) issues.push({ field: 'phone', tab: 'demographics', en: 'Review the matching records and acknowledge the shared phone number before saving.', ar: 'راجع الملفات المطابقة وأكد مشاركة رقم الهاتف قبل الحفظ.' });
    setRecordIssues(issues);
    if (issues.length) {
      setActiveTab(issues[0].tab);
      requestAnimationFrame(() => document.getElementById(`record-${issues[0].field}`)?.focus());
      return;
    }
    const finalPatient: Patient = {
      ...formData,
      name: formData.name.trim().replace(/\s+/g, ' '),
      phone: normalizeDigits(formData.phone).trim(),
      allergies: formData.allergies?.trim(),
      familyTag: formData.familyTag?.trim(),
      medications: formData.medications.filter(m => m.name.trim()).map(m => ({ ...m, name: m.name.trim() })),
    };
    onSavePatient(finalPatient);
    onClose();
  };

  const thermalSlipText = generateThermalSlipText(formData, pharmacyName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="patient-record-title" className="bg-surface border border-stroke rounded-[4px] max-w-4xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="p-4 bg-subtle border-b border-stroke flex items-center justify-between">
          <div id="patient-record-title" className="font-semibold text-base text-fg flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand" />
            <span>
              {formData.name
                ? `${lang === 'ar' ? 'الملف السريري:' : 'Clinical Dossier:'} ${formData.name}`
                : lang === 'ar'
                ? 'تسجيل مريض مزمن جديد'
                : 'New Chronic Patient Dossier'}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label={lang === 'ar' ? 'إغلاق ملف المريض' : 'Close patient record'}
            className="p-1 rounded-[4px] text-neutral-400 hover:text-fg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <section aria-label={lang === 'ar' ? 'ملخص الملف' : 'Record summary'} className="border-b border-stroke px-4 py-2 text-xs space-y-1.5">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted">
            <span className="font-mono break-all">{formData.id}</span>
            <span>{lang === 'ar' ? 'الأدوية المسجلة:' : 'Recorded medications:'} <strong className="font-mono text-fg">{formData.medications.filter(m => m.name.trim()).length}</strong></span>
            <span>{lang === 'ar' ? 'المتابعات المفتوحة:' : 'Open follow-ups:'} <strong className="font-mono text-fg">{followUps.filter(f => f.patientId === formData.id && !f.resolved).length}</strong></span>
          </div>
          {reservations.some(r => r.patientId === formData.id && !['collected', 'cancelled'].includes(r.status)) && <div className="flex flex-wrap items-center gap-2 text-xs"><strong>{lang === 'ar' ? 'الحجوزات المفتوحة:' : 'Open reservations:'}</strong>{reservations.filter(r => r.patientId === formData.id && !['collected', 'cancelled'].includes(r.status)).map(r => <button key={r.id} className="text-brand underline underline-offset-2" onClick={() => onManageReservation(r.id)}>{r.medications.map(m => m.name).join(', ')} · <time className="font-mono" dateTime={r.pickupDate}>{r.pickupDate}</time></button>)}</div>}
          <div className={`flex items-start gap-2 p-2 border rounded-[4px] ${formData.allergies?.trim() ? 'bg-brand-subtle border-brand text-fg' : 'bg-warning-bg border-warning-border text-warning-fg'}`}>
            <ShieldAlert className="size-4 shrink-0" />
            <span><strong>{lang === 'ar' ? 'الحساسيات:' : 'Allergies:'}</strong> {formData.allergies?.trim() || (lang === 'ar' ? 'غير مسجلة — تحقق مع المريض قبل الصرف.' : 'Not recorded — verify with the patient before dispensing.')}</span>
          </div>
        </section>

        {/* Dossier Tabs */}
        <div className="bg-surface border-b border-stroke px-4 flex items-center gap-1 overflow-x-auto text-xs font-semibold">
          {[
            { id: 'demographics', labelAr: '1. البيانات والعائلة', labelEn: '1. Demographics' },
            { id: 'regimen', labelAr: '2. الأدوية ومخطط الصرف ⏱️', labelEn: '2. Regimen & Refill Timelines ⏱️' },
            { id: 'analytics', labelAr: '3. مخطط الالتزام والمؤشرات 📈', labelEn: '3. Adherence & Vitals Chart 📈' },
            { id: 'vitals', labelAr: '4. سجل الضغط والسكر', labelEn: '4. Vitals & Labs' },
            { id: 'scans', labelAr: '5. صور الروشتات والتحاليل 📷', labelEn: '5. Rx & Lab Scans 📷' },
            { id: 'schedule', labelAr: '6. جدول تناول الدواء', labelEn: '6. Pill Organizer' },
            { id: 'thermal', labelAr: '7. البطاقة الفورية', labelEn: '7. Thermal Pocket Slip' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-3 border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-brand text-brand bg-subtle/40 font-bold'
                  : 'border-transparent text-neutral-400 hover:text-fg '
              }`}
            >
              {lang === 'ar' ? tab.labelAr : tab.labelEn}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {recordIssues.length > 0 && <div id="record-errors" role="alert" className="bg-critical-bg text-critical-fg border border-critical-border rounded-[4px] p-3 space-y-1">
            <p className="font-semibold">{lang === 'ar' ? 'صحح البيانات التالية قبل الحفظ:' : 'Correct these fields before saving:'}</p>
            <ul className="list-disc ps-4">{recordIssues.map((issue, i) => <li key={`${issue.field}-${i}`}><button className="text-start underline underline-offset-2" onClick={() => { setActiveTab(issue.tab); requestAnimationFrame(() => document.getElementById(`record-${issue.field}`)?.focus()); }}>{lang === 'ar' ? issue.ar : issue.en}</button></li>)}</ul>
          </div>}
          {duplicates.length > 0 && <div className="bg-warning-bg text-warning-fg border border-warning-border rounded-[4px] p-3 space-y-2">
            <p className="font-semibold">{lang === 'ar' ? 'رقم الهاتف مستخدم في ملفات أخرى' : 'This phone number matches existing records'}</p>
            <p>{lang === 'ar' ? 'افتح الملف الصحيح لتجنب التكرار. يمكن لأفراد العائلة مشاركة الرقم بعد التأكيد.' : 'Open the correct record to avoid a duplicate. Family members can share a number after acknowledgement.'}</p>
            <div className="flex flex-wrap gap-2">{duplicates.map(p => <button key={p.id} className="underline font-semibold underline-offset-2 break-all text-start" onClick={() => onOpenExistingPatient(p.id)}>{p.name} · {p.id}{p.isArchived ? (lang === 'ar' ? ' (مؤرشف)' : ' (archived)') : ''}</button>)}</div>
            <label className="flex items-start gap-2"><input type="checkbox" checked={sharedPhoneAcknowledged} onChange={e => setSharedPhoneAcknowledged(e.target.checked)} />{lang === 'ar' ? 'راجعت الملفات وأؤكد أن مشاركة الرقم مقصودة.' : 'I reviewed these records and confirm this shared number is intentional.'}</label>
          </div>}
          {/* TAB: RECHARTS LONGITUDINAL ADHERENCE & VITALS VISUALIZATION */}
          {activeTab === 'analytics' && (
            <PatientAdherenceVitalsChart
              patient={formData}
              followUps={followUps}
              lang={lang}
              onOpenNewFollowUp={() => {
                onClose();
                if (onOpenNewFollowUp) onOpenNewFollowUp();
              }}
              onShowToast={onShowToast}
            />
          )}

          {/* TAB 1: DEMOGRAPHICS */}
          {activeTab === 'demographics' && (
            <div className="space-y-4">
              {/* Family Alignment Notification Banner */}
              {formData.familyTag && (
                <div className="bg-brand-subtle border border-brand p-3.5 rounded-[4px] flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-sm text-brand flex items-center gap-1.5">
                      <span>👨‍👩‍👧‍👦</span>
                      <span>{lang === 'ar' ? 'المريض مرتبط بعائلة:' : 'Linked Family:'} {formData.familyTag}</span>
                    </div>
                    <div className="text-[11px] text-neutral-300 mt-0.5">
                      {lang === 'ar'
                        ? 'يمكنك توحيد مواعيد صرف وصيدلية أفراد العائلة في رحلة واحدة وحساب الحبات الناقصة.'
                        : 'Coordinate refills for the entire family in one visit using bridge dose calculation.'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenHouseholdModal(formData.familyTag!);
                    }}
                    className="px-3 py-1.5 rounded-[4px] bg-brand hover:bg-brand-hover text-on-brand font-bold text-xs transition-colors whitespace-nowrap"
                  >
                    {lang === 'ar' ? 'توحيد صرف العائلة ⚡' : 'Household Sync ⚡'}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="record-name" className="font-semibold text-neutral-300">
                    {lang === 'ar' ? 'الاسم الكامل للمريض *' : 'Full Name *'}
                  </label>
                  <input
                    type="text"
                    id="record-name"
                    aria-describedby={recordIssues.length ? 'record-errors' : undefined}
                    aria-invalid={recordIssues.some(issue => issue.field === 'name')}
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder={lang === 'ar' ? 'مثال: أحمد عبد الله الجبوري' : 'e.g. John Doe'}
                    className="w-full bg-canvas border border-stroke text-fg rounded-[4px] p-2.5 outline-none focus:border-brand font-semibold"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="record-phone" className="font-semibold text-neutral-300">
                    {lang === 'ar' ? 'رقم الهاتف (مع رمز الدولة لـ WhatsApp / SMS) *' : 'Phone (WhatsApp/SMS) *'}
                  </label>
                  <input
                    type="tel"
                    id="record-phone"
                    aria-describedby={recordIssues.length ? 'record-errors' : undefined}
                    aria-invalid={recordIssues.some(issue => issue.field === 'phone')}
                    value={formData.phone}
                    onChange={e => { setSharedPhoneAcknowledged(false); setFormData({ ...formData, phone: e.target.value }); }}
                    placeholder="07700000000 / +964..."
                    className="w-full bg-canvas border border-stroke text-fg rounded-[4px] p-2.5 outline-none focus:border-brand font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="record-dob" className="font-semibold text-neutral-300">
                    {lang === 'ar' ? 'تاريخ الميلاد' : 'Date of Birth'}
                  </label>
                  <input
                    type="date"
                    id="record-dob"
                    aria-describedby={recordIssues.length ? 'record-errors' : undefined}
                    aria-invalid={recordIssues.some(issue => issue.field === 'dob')}
                    max={localDateKey()}
                    value={formData.dob || ''}
                    onChange={handleDobChange}
                    className="w-full bg-canvas border border-stroke text-fg rounded-[4px] p-2.5 outline-none focus:border-brand font-mono"
                  />
                  {formData.age ? (
                    <span className="text-[11px] text-brand font-semibold">
                      {lang === 'ar' ? `العمر المحسوب: ${formData.age} سنة` : `Age: ${formData.age} years`}
                    </span>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <label htmlFor="record-gender" className="font-semibold text-neutral-300">
                    {lang === 'ar' ? 'الجنس' : 'Gender'}
                  </label>
                  <select
                    id="record-gender"
                    value={formData.gender || 'M'}
                    onChange={e => setFormData({ ...formData, gender: e.target.value as any })}
                    className="w-full bg-canvas border border-stroke text-fg rounded-[4px] p-2.5 outline-none focus:border-brand"
                  >
                    <option value="M">{lang === 'ar' ? 'ذكر' : 'Male'}</option>
                    <option value="F">{lang === 'ar' ? 'أنثى' : 'Female'}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="record-family" className="font-semibold text-neutral-300">
                    {lang === 'ar' ? 'رمز العائلة (Family Tag)' : 'Family Tag'}
                  </label>
                  <input
                    type="text"
                    id="record-family"
                    value={formData.familyTag || ''}
                    onChange={e => setFormData({ ...formData, familyTag: e.target.value })}
                    placeholder={lang === 'ar' ? 'مثال: عائلة_الجبوري' : 'e.g. Smith_Family'}
                    className="w-full bg-canvas border border-stroke text-fg rounded-[4px] p-2.5 outline-none focus:border-brand"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="record-loyalty" className="font-semibold text-neutral-300">
                    {lang === 'ar' ? 'نقاط الولاء (Loyalty Points)' : 'Loyalty Points'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    id="record-loyalty"
                    value={formData.loyaltyPoints || 0}
                    onChange={e => setFormData({ ...formData, loyaltyPoints: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-canvas border border-stroke text-fg rounded-[4px] p-2.5 outline-none focus:border-brand font-mono font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="record-allergies" className="font-semibold text-critical-fg">
                  {lang === 'ar' ? 'الحساسيات الدوائية المعروفة (Allergies)' : 'Known Drug Allergies'}
                </label>
                <input
                  type="text"
                  id="record-allergies"
                    value={formData.allergies || ''}
                  onChange={e => setFormData({ ...formData, allergies: e.target.value })}
                  placeholder="مثال: Penicillin, Sulfa, Aspirin..."
                  className="w-full bg-canvas border border-critical-border text-critical-fg rounded-[4px] p-2.5 outline-none focus:border-critical-border"
                />
              </div>

              <button type="button" className="text-brand underline underline-offset-2 text-xs" onClick={() => setFormData({ ...formData, allergies: lang === 'ar' ? 'لا توجد حساسيات دوائية معروفة' : 'No known drug allergies' })}>{lang === 'ar' ? 'تأكيد عدم وجود حساسيات دوائية معروفة' : 'Confirm no known drug allergies'}</button>

              <div className="space-y-1">
                <label htmlFor="record-notes" className="font-semibold text-neutral-300">
                  {lang === 'ar' ? 'التاريخ المرضي والملاحظات السريرية' : 'Clinical History & Medical Notes'}
                </label>
                <textarea
                  rows={3}
                  id="record-notes"
                    value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={lang === 'ar' ? 'تاريخ الإصابة، أمراض مصاحبة (ضغط، سكري، كلى)...' : 'Medical history, chronic conditions, special notes...'}
                  className="w-full bg-canvas border border-stroke text-fg rounded-[4px] p-2.5 outline-none focus:border-brand"
                />
              </div>
            </div>
          )}

          {/* TAB 2: REGIMEN & REFILL TIMELINES */}
          {activeTab === 'regimen' && (
            <div className="space-y-4">
              {/* Meds List header */}
              <div className="flex items-center justify-between pt-1">
                <span className="font-bold text-sm text-fg">
                  {lang === 'ar' ? 'الأدوية المزمنة المقررة ومخطط الصرف:' : 'Prescribed Chronic Regimen & Refill Timelines:'}
                </span>
                <button
                  type="button"
                  onClick={handleAddMedication}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-[4px] bg-brand hover:bg-brand-hover text-on-brand font-bold text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'إضافة دواء' : 'Add Medication'}</span>
                </button>
              </div>

              {/* Meds items */}
              <div className="space-y-4">
                {formData.medications.length === 0 && (
                  <div className="p-8 text-center bg-canvas rounded-[4px] border border-dashed border-stroke space-y-2">
                    <p className="text-neutral-400 text-xs">
                      {lang === 'ar'
                        ? 'لا توجد أدوية مسجلة بعد. اضغط على "إضافة دواء" لإدراج الأدوية ومتابعة خط زمني دقيق لمواعيد الصرف والالتزام الدوائي.'
                        : 'No medications recorded yet. Click "Add Medication" to track regimen and adherence timelines.'}
                    </p>
                  </div>
                )}

                {formData.medications.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-[4px] bg-canvas border border-stroke space-y-2.5 transition-colors duration-150"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                      <div className="sm:col-span-5 space-y-1">
                        <label className="text-[10px] text-neutral-400 font-semibold">{lang === 'ar' ? 'اسم الدواء (العلامة التجارية)' : 'Brand Name'}</label>
                        <input
                          type="text"
                          id={`record-med-${idx}-name`}
                          aria-label={`${lang === 'ar' ? 'الدواء' : 'Medication name'} ${idx + 1}`}
                          aria-describedby={recordIssues.length ? 'record-errors' : undefined}
                    aria-invalid={recordIssues.some(issue => issue.field === `med-${idx}-name`)}
                          value={m.name}
                          onChange={e => handleMedChange(idx, 'name', e.target.value)}
                          placeholder="Glucophage, Concor, Lipitor..."
                          className="w-full bg-surface border border-stroke p-2 rounded-[4px] text-fg font-bold text-xs outline-none focus:border-brand"
                        />
                      </div>

                      <div className="sm:col-span-3 space-y-1">
                        <label className="text-[10px] text-neutral-400 font-semibold">{lang === 'ar' ? 'تاريخ آخر صرف' : 'Last Dispense'}</label>
                        <input
                          type="date"
                          id={`record-med-${idx}-date`}
                          aria-label={`${lang === 'ar' ? 'الدواء' : 'Last dispense date'} ${idx + 1}`}
                          aria-describedby={recordIssues.length ? 'record-errors' : undefined}
                    aria-invalid={recordIssues.some(issue => issue.field === `med-${idx}-date`)}
                          value={m.lastDispenseDate}
                          max={localDateKey()}
                          onChange={e => handleMedChange(idx, 'lastDispenseDate', e.target.value)}
                          className="w-full bg-surface border border-stroke p-2 rounded-[4px] text-fg text-xs font-mono outline-none focus:border-brand"
                        />
                      </div>

                      <div className="sm:col-span-3 space-y-1">
                        <label className="text-[10px] text-neutral-400 font-semibold">{lang === 'ar' ? 'مدة الصرف بالأيام' : 'Supply (days)'}</label>
                        <input
                          type="number"
                          min={1}
                          max={365}
                          id={`record-med-${idx}-supply`}
                          aria-label={`${lang === 'ar' ? 'الدواء' : 'Supply in days'} ${idx + 1}`}
                          aria-describedby={recordIssues.length ? 'record-errors' : undefined}
                    aria-invalid={recordIssues.some(issue => issue.field === `med-${idx}-supply`)}
                          value={m.daysSupply}
                          onChange={e => handleMedChange(idx, 'daysSupply', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full bg-surface border border-stroke p-2 rounded-[4px] text-fg text-xs font-bold text-center outline-none focus:border-brand"
                        />
                      </div>

                      <div className="sm:col-span-1 flex justify-end pt-4">
                        <button
                          type="button"
                          onClick={() => handleRemoveMedication(idx)}
                          className="p-1.5 rounded-[4px] text-neutral-400 hover:text-critical-fg hover:bg-neutral-800 transition-colors cursor-pointer"
                          title={lang === 'ar' ? 'حذف الدواء' : 'Delete Medication'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Visual Timeline of Previous Refill Dates & Adherence Analysis */}
                    {m.name.trim() && (
                      <MedicationRefillTimeline
                        medication={m}
                        lang={lang}
                        onUpdateRefillHistory={newHistory => handleUpdateMedRefillHistory(idx, newHistory)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: VITALS */}
          {activeTab === 'vitals' && (
            <div className="space-y-4">
              <div className="bg-canvas p-4 rounded-[4px] border border-stroke space-y-3">
                <div className="font-bold text-sm text-fg flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-critical-fg" />
                  <span>{lang === 'ar' ? 'تسجيل قراءة سريرية حية جديدة' : 'Record New Vital Signs'}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-400 font-semibold">{lang === 'ar' ? 'الانقباضي (Systolic)' : 'Systolic'}</label>
                    <input
                      type="number"
                      placeholder="120"
                      value={newSys}
                      onChange={e => setNewSys(e.target.value)}
                      className="w-full bg-surface border border-stroke p-2 rounded-[4px] text-fg text-xs text-center font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-400 font-semibold">{lang === 'ar' ? 'الانبساطي (Diastolic)' : 'Diastolic'}</label>
                    <input
                      type="number"
                      placeholder="80"
                      value={newDia}
                      onChange={e => setNewDia(e.target.value)}
                      className="w-full bg-surface border border-stroke p-2 rounded-[4px] text-fg text-xs text-center font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-400 font-semibold">{lang === 'ar' ? 'السكر (mg/dL)' : 'Glucose'}</label>
                    <input
                      type="number"
                      placeholder="110"
                      value={newSugar}
                      onChange={e => setNewSugar(e.target.value)}
                      className="w-full bg-surface border border-stroke p-2 rounded-[4px] text-fg text-xs text-center font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-400 font-semibold">{lang === 'ar' ? 'HbA1c / نبض / وزن' : 'HbA1c / Pulse'}</label>
                    <input
                      type="text"
                      placeholder="HbA1c: 6.8% / 72 bpm"
                      value={newMisc}
                      onChange={e => setNewMisc(e.target.value)}
                      className="w-full bg-surface border border-stroke p-2 rounded-[4px] text-fg text-xs"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddVitals}
                  className="px-4 py-2 rounded-[4px] bg-brand hover:bg-brand-hover text-on-brand font-bold text-xs transition-colors"
                >
                  {lang === 'ar' ? '🩺 حفظ القراءة السريرية' : 'Log Clinical Entry'}
                </button>
              </div>

              {/* Vitals History Table */}
              <div className="border border-stroke rounded-[4px] overflow-hidden">
                <table className="w-full text-right dir-rtl text-xs">
                  <thead className="bg-subtle text-neutral-300 font-bold border-b border-stroke">
                    <tr>
                      <th className="py-2.5 px-3">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                      <th className="py-2.5 px-3">{lang === 'ar' ? 'ضغط الدم (BP)' : 'BP'}</th>
                      <th className="py-2.5 px-3">{lang === 'ar' ? 'السكر (mg/dL)' : 'Sugar'}</th>
                      <th className="py-2.5 px-3">{lang === 'ar' ? 'مؤشرات إضافية' : 'Misc'}</th>
                      <th className="py-2.5 px-3">{lang === 'ar' ? 'التقييم' : 'Assessment'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stroke text-neutral-200">
                    {(formData.vitals || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-neutral-400">
                          {lang === 'ar' ? 'لا توجد قراءات سابقة مسجلة.' : 'No recorded vitals yet.'}
                        </td>
                      </tr>
                    ) : (
                      formData.vitals!.map((v, i) => (
                        <tr key={i} className="hover:bg-neutral-800/30">
                          <td className="py-2.5 px-3 font-mono text-neutral-400">{v.date}</td>
                          <td className="py-2.5 px-3 font-bold font-mono text-brand">{v.bp}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-warning-fg">{v.sugar}</td>
                          <td className="py-2.5 px-3 text-neutral-300">{v.misc}</td>
                          <td className="py-2.5 px-3">
                            <span className="text-[11px] font-semibold text-success-fg bg-success-bg px-2 py-0.5 rounded border border-success-border">
                              {v.assessment || 'مستقر'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: SCANS & PURE FULL RESOLUTION PRESCRIPTIONS */}
          {activeTab === 'scans' && (
            <div className="space-y-4">
              <div className="bg-canvas p-4 rounded-[4px] border border-stroke space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-fg flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-brand" />
                    <span>
                      {lang === 'ar'
                        ? 'إرفاق وحفظ صورة الروشتة أو التحليل بدقة كاملة (Full Resolution Scan)'
                        : 'Attach & Save Prescription or Lab Scan (Full Resolution)'}
                    </span>
                  </div>
                  {isUploadingScan && (
                    <span className="text-xs text-brand font-bold flex items-center gap-1.5">
                      <UploadCloud className="w-3.5 h-3.5 animate-spin" />
                      <span>{lang === 'ar' ? 'جارِ معالجة ورفع الصورة...' : 'Uploading full-res scan...'}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleScanUpload}
                    className="block w-full text-xs text-neutral-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-[4px] file:border-0 file:text-xs file:font-bold file:bg-brand file:text-fg hover:file:bg-brand-subtle cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-400 flex-wrap gap-2">
                  <span>
                    {lang === 'ar'
                      ? 'يتم تخزين الصورة بنقائها وجودتها الكاملة مع حفظ رابطها المباشر في Google Sheet و Google Drive.'
                      : 'Stored with direct URLs saved in Google Sheet & Google Drive.'}
                  </span>
                  {gasUrl ? (
                    <span className="text-success-fg flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{lang === 'ar' ? 'المزامنة مع Google Drive والشيت مفعلة ☁️' : 'Drive & Sheet Sync Active'}</span>
                    </span>
                  ) : (
                    <span className="text-warning-fg flex items-center gap-1">
                      <HardDrive className="w-3 h-3" />
                      <span>{lang === 'ar' ? 'حفظ محلي بدقة كاملة (أدخل رابط Apps Script للحفظ في Drive)' : 'Local storage (Set Apps Script URL for Drive sync)'}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Gallery Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-300">
                  <span>{lang === 'ar' ? 'معرض الوصفات والتحاليل المخزنة:' : 'Stored Prescriptions & Lab Scans:'}</span>
                  <span className="text-neutral-500 font-normal">
                    {(formData.scans || []).length} {lang === 'ar' ? 'صورة' : 'images'}
                  </span>
                </div>

                {(formData.scans || []).length === 0 ? (
                  <div className="border border-dashed border-stroke rounded-[4px] p-8 text-center text-neutral-500 space-y-2">
                    <ImageIcon className="w-8 h-8 mx-auto text-neutral-600" />
                    <p className="text-xs">
                      {lang === 'ar'
                        ? 'لا توجد صور روشتات أو تحاليل مرفقة لهذا المريض بعد.'
                        : 'No prescription or lab scans attached yet.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-brand hover:text-brand font-bold hover:underline inline-block"
                    >
                      {lang === 'ar' ? '+ اضغط هنا لاختيار صورة' : '+ Click to choose an image'}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                    {(formData.scans || []).map((s, i) => (
                      <ScanCard
                        key={s.id || i}
                        scan={s}
                        lang={lang}
                        onPreview={setPreviewingScan}
                        onDelete={handleDeleteScan}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: PILL SCHEDULE ORGANIZER */}
          {activeTab === 'schedule' && (
            <div className="space-y-4">
              <div className="bg-canvas p-4 rounded-[4px] border border-stroke">
                <div className="font-bold text-sm text-fg flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-brand" />
                  <span>{lang === 'ar' ? 'جدول المواعيد وعلاقة الدواء بوجبات الطعام (Pill Organizer)' : 'Daily Medication Schedule'}</span>
                </div>
                <p className="text-xs text-neutral-400 mt-1">
                  {lang === 'ar'
                    ? 'تنظيم أوقات تناول الأدوية وتفادي تعارض امتصاصها مع الطعام.'
                    : 'Synchronized daily dosing instructions.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Morning */}
                <div className="bg-canvas p-3.5 rounded-[4px] border border-stroke space-y-2">
                  <div className="font-bold text-warning-fg flex items-center gap-1.5 text-xs">
                    <span>☀️</span>
                    <span>{lang === 'ar' ? 'الصباح / الإفطار' : 'Morning / Breakfast'}</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    {formData.medications
                      .filter(m => m.timing === 'morning' || m.timing === 'bid' || !m.timing)
                      .map((m, i) => (
                        <div key={i} className="p-2 rounded bg-surface border border-stroke">
                          <strong className="text-fg block">{m.name}</strong>
                          <span className="text-[10px] text-neutral-400">
                            {m.mealRelation === 'before_meal' ? (lang === 'ar' ? 'قبل الإفطار بـ 30 دقيقة' : '30 min before breakfast') : (lang === 'ar' ? 'مع أو بعد الإفطار' : 'With or after breakfast')}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Noon */}
                <div className="bg-canvas p-3.5 rounded-[4px] border border-stroke space-y-2">
                  <div className="font-bold text-brand flex items-center gap-1.5 text-xs">
                    <span>🌤️</span>
                    <span>{lang === 'ar' ? 'الظهيرة / الغداء' : 'Noon / Lunch'}</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    {formData.medications
                      .filter(m => m.timing === 'noon')
                      .map((m, i) => (
                        <div key={i} className="p-2 rounded bg-surface border border-stroke">
                          <strong className="text-fg block">{m.name}</strong>
                          <span className="text-[10px] text-neutral-400">{lang === 'ar' ? 'بعد الغداء' : 'After lunch'}</span>
                        </div>
                      ))}
                    {formData.medications.filter(m => m.timing === 'noon').length === 0 && (
                      <span className="text-neutral-500 text-[11px]">{lang === 'ar' ? 'لا توجد جرعات ظهيرة' : 'No noon doses'}</span>
                    )}
                  </div>
                </div>

                {/* Evening */}
                <div className="bg-canvas p-3.5 rounded-[4px] border border-stroke space-y-2">
                  <div className="font-bold text-warning-fg flex items-center gap-1.5 text-xs">
                    <span>🌅</span>
                    <span>{lang === 'ar' ? 'المساء / العشاء' : 'Evening / Dinner'}</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    {formData.medications
                      .filter(m => m.timing === 'bid' || m.timing === 'evening')
                      .map((m, i) => (
                        <div key={i} className="p-2 rounded bg-surface border border-stroke">
                          <strong className="text-fg block">{m.name}</strong>
                          <span className="text-[10px] text-neutral-400">{lang === 'ar' ? 'مع العشاء' : 'With dinner'}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Bedtime */}
                <div className="bg-canvas p-3.5 rounded-[4px] border border-stroke space-y-2">
                  <div className="font-bold text-brand flex items-center gap-1.5 text-xs">
                    <span>🌙</span>
                    <span>{lang === 'ar' ? 'قبل النوم' : 'Bedtime'}</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    {formData.medications
                      .filter(m => m.timing === 'bedtime')
                      .map((m, i) => (
                        <div key={i} className="p-2 rounded bg-surface border border-stroke">
                          <strong className="text-fg block">{m.name}</strong>
                          <span className="text-[10px] text-neutral-400">{lang === 'ar' ? 'قبل النوم مباشرة' : 'At bedtime'}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: POCKET THERMAL SLIP */}
          {activeTab === 'thermal' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-sm text-fg">
                  {lang === 'ar' ? 'البطاقة الطبية الفورية (Pocket Thermal Slip & QR)' : 'Pocket Thermal Slip & QR'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(thermalSlipText);
                      onShowToast(lang === 'ar' ? 'تم نسخ نص البطاقة الطبية' : 'Copied slip', 'success');
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-[4px] bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'نسخ النص' : 'Copy'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const clean = formatPhoneForWhatsApp(formData.phone);
                      window.open(`https://wa.me/${clean}?text=${encodeURIComponent(thermalSlipText)}`, '_blank');
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-[4px] bg-success-bg hover:bg-success-bg text-fg text-xs font-semibold"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-[4px] bg-brand hover:bg-brand-hover text-on-brand text-xs font-semibold"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'طباعة إيصال' : 'Print Slip'}</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <pre
                  id="thermal-slip-print"
                  className="flex-1 bg-white text-black p-4 font-mono text-xs rounded-[4px] border border-neutral-300 shadow-inner overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[380px]"
                >
                  {thermalSlipText}
                </pre>

                {qrDataUrl && (
                  <div className="bg-white p-3 rounded-[4px] border border-neutral-300 flex flex-col items-center gap-2 shrink-0">
                    <img src={qrDataUrl} alt="Patient QR Code" className="w-28 h-28" />
                    <span className="text-[10px] text-neutral-700 font-mono font-bold">
                      {formData.name.split(' ')[0]} - QR
                    </span>
                  </div>
                )}
              </div>

              {/* Danger Zone: Permanent Patient Deletion */}
              {patient?.id && (
                <div className="p-4 rounded-[4px] bg-critical-bg border border-critical-border space-y-3 mt-6">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-critical-fg font-bold text-xs">
                      <ShieldAlert className="w-4 h-4 text-critical-fg" />
                      <span>{lang === 'ar' ? 'منطقة العمليات الحساسة (Danger Zone)' : 'Danger Zone'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-[4px] bg-critical-bg hover:bg-critical-bg text-fg font-bold text-xs transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'حذف ملف المريض نهائياً' : 'Delete Patient Permanently'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-neutral-300 leading-relaxed">
                    {lang === 'ar'
                      ? 'سيؤدي حذف هذا الملف إلى إزالة كافة بيانات المريض وقائمة أدويته وسجلات الضغط والسكر والمتابعات السريرية المرتبطة به نهائياً.'
                      : 'Deleting this patient will permanently remove their records, active regimens, vitals logs, and linked clinical follow-ups.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="p-4 bg-subtle border-t border-stroke flex items-center justify-between gap-3">
          {patient?.id && activeTab === 'thermal' ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-[4px] bg-critical-bg hover:bg-critical-bg text-critical-fg border border-critical-border text-xs font-semibold transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-critical-fg" />
              <span>{lang === 'ar' ? 'حذف المريض' : 'Delete Patient'}</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-[4px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-[4px] bg-brand hover:bg-brand-hover text-on-brand text-xs font-bold transition-colors cursor-pointer"
            >
              {lang === 'ar' ? '💾 حفظ الملف السريري' : 'Save Dossier'}
            </button>
          </div>
        </div>
      </div>

      {/* Permanent Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4">
          <div className="bg-surface border border-critical-border rounded-[4px] max-w-md w-full p-5 space-y-4">
            <div className="flex items-center gap-3 text-critical-fg">
              <div className="p-2.5 rounded-[4px] bg-critical-bg border border-critical-border">
                <ShieldAlert className="w-6 h-6 text-critical-fg" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-fg">
                  {lang === 'ar' ? 'تأكيد حذف ملف المريض نهائياً' : 'Confirm Permanent Deletion'}
                </h3>
                <span className="text-[11px] text-neutral-400">
                  {formData.name} ({formData.phone})
                </span>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed bg-canvas p-3 rounded-[4px] border border-neutral-800">
              {lang === 'ar'
                ? 'هل أنت متأكد من رغبتك في حذف هذا الملف بشكل نهائي؟ سيتم حذف جميع بيانات المريض، والأدوية المزمنة، وسجلات الضغط والسكر، والمتابعات السريرية المرتبطة به ولا يمكن استرجاعها.'
                : 'Are you sure you want to permanently delete this patient dossier? All personal data, chronic medications, vitals history, and clinical follow-ups will be permanently deleted.'}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-[4px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  if (onDeletePatient && patient?.id) {
                    onDeletePatient(patient.id);
                  }
                  onClose();
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-[4px] bg-critical-bg hover:bg-critical-bg text-fg text-xs font-bold transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{lang === 'ar' ? 'نعم، حذف نهائي' : 'Yes, Delete Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Full-Resolution Image Lightbox / Preview Modal */}
      {previewingScan && (
        <ImagePreviewModal
          scan={previewingScan}
          patientName={formData.name}
          patientId={formData.id}
          gasUrl={gasUrl}
          lang={lang}
          onClose={() => setPreviewingScan(null)}
          onDelete={handleDeleteScan}
          onUpdateScan={(updatedScan) => {
            setFormData(prev => ({
              ...prev,
              scans: (prev.scans || []).map(s => s.id === updatedScan.id ? updatedScan : s),
            }));
            setPreviewingScan(updatedScan);
          }}
        />
      )}
    </div>
  );
};
