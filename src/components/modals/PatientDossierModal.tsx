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
import { Patient, Medication, VitalsEntry, LabScan, FollowUpEntry, RefillRecord } from '../../types/pharmacy';
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
    <div className="border border-[#383838] light:border-neutral-200 hover:border-blue-500/60 rounded-xl overflow-hidden bg-[#141414] light:bg-white group relative transition-all shadow-md flex flex-col">
      {/* Image Thumbnail Container */}
      <div
        onClick={() => onPreview({ ...scan, dataUrl: imgSrc || scan.dataUrl })}
        className="relative h-40 bg-[#0a0a0a] light:bg-neutral-100 cursor-pointer overflow-hidden flex items-center justify-center group"
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
            <ImageIcon className="w-8 h-8 text-neutral-600 light:text-neutral-400" />
            <span className="text-[10px] text-neutral-500">{lang === 'ar' ? 'انقر للمعاينة' : 'Click to inspect'}</span>
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <span className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg">
            <ZoomIn className="w-4 h-4" />
            <span>{lang === 'ar' ? 'معاينة بالدقة الكاملة' : 'Full Preview'}</span>
          </span>
        </div>

        {/* Storage badge */}
        <div className="absolute top-2 left-2">
          {scan.driveUrl ? (
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 font-bold backdrop-blur-sm flex items-center gap-1">
              <span>☁️ Drive</span>
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-950/80 text-blue-300 border border-blue-800/80 font-bold backdrop-blur-sm flex items-center gap-1">
              <span>💾 Full Res</span>
            </span>
          )}
        </div>
      </div>

      {/* Card Footer Details */}
      <div className="p-2.5 bg-[#1a1a1a] light:bg-neutral-50 border-t border-[#292929] light:border-neutral-200 flex-1 flex flex-col justify-between gap-2">
        <div>
          <div className="font-bold text-xs text-neutral-200 light:text-neutral-800 truncate" title={scan.title}>
            {scan.title || (lang === 'ar' ? 'وصفة طبية' : 'Prescription Scan')}
          </div>
          <div className="text-[10px] text-neutral-400 flex items-center justify-between mt-1">
            <span>{scan.date}</span>
            {scan.fileSize && <span className="font-mono text-neutral-500">{scan.fileSize}</span>}
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-[#2a2a2a] light:border-neutral-200 gap-1">
          <button
            type="button"
            onClick={() => onPreview({ ...scan, dataUrl: imgSrc || scan.dataUrl })}
            className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
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
                className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              type="button"
              onClick={() => onDelete(scan.id!)}
              title={lang === 'ar' ? 'حذف الصورة' : 'Delete'}
              className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors"
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
  initialTab?: string;
  followUps?: FollowUpEntry[];
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
  initialTab = 'demographics',
  followUps = [],
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
          id: 'PT-' + Date.now().toString().slice(-6),
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

  const handleScanUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingScan(true);
    const reader = new FileReader();
    reader.onload = async evt => {
      const base64 = evt.target?.result as string;
      const scanId = 'scan-' + Date.now();
      const fileSizeStr =
        file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.round(file.size / 1024)} KB`;

      // 1. Immediately save to IndexedDB (virtually unlimited quota)
      await saveScanImage(scanId, base64, {
        title: file.name,
        patientId: formData.id,
        size: fileSizeStr,
      });

      // 2. Create initial local scan with full resolution
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
          ? 'تم حفظ صورة الوصفة / التحليل بدقة كاملة'
          : 'Full resolution prescription scan saved',
        'success'
      );

      // 3. Asynchronously upload full-resolution pure image to Google Drive if gasUrl is set
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
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteScan = async (scanId: string) => {
    await deleteScanImage(scanId);
    setFormData(prev => ({
      ...prev,
      scans: (prev.scans || []).filter(s => s.id !== scanId),
    }));
    onShowToast(lang === 'ar' ? 'تم حذف الصورة' : 'Scan removed', 'info');
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      setActiveTab('demographics');
      onShowToast(lang === 'ar' ? 'يرجى إدخال اسم المريض' : 'Please enter patient name', 'error');
      return;
    }
    if (!formData.phone.trim()) {
      setActiveTab('demographics');
      onShowToast(lang === 'ar' ? 'يرجى إدخال رقم الهاتف' : 'Please enter phone number', 'error');
      return;
    }

    const cleanMeds = formData.medications.filter(m => m.name.trim());
    const finalPatient: Patient = {
      ...formData,
      medications: cleanMeds,
    };

    onSavePatient(finalPatient);
    onClose();
  };

  const thermalSlipText = generateThermalSlipText(formData, pharmacyName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="p-4 bg-[#292929] light:bg-neutral-100 border-b border-[#383838] light:border-neutral-200 flex items-center justify-between">
          <div className="font-extrabold text-base text-white light:text-neutral-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
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
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 light:hover:bg-neutral-200 light:hover:text-neutral-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dossier Tabs */}
        <div className="bg-[#191919] light:bg-neutral-200 border-b border-[#383838] light:border-neutral-300 px-4 flex items-center gap-1 overflow-x-auto text-xs font-semibold">
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
                  ? 'border-[#479ef5] text-[#479ef5] bg-[#292929]/40 light:bg-neutral-100 font-bold'
                  : 'border-transparent text-neutral-400 light:text-neutral-600 hover:text-white light:hover:text-neutral-900'
              }`}
            >
              {lang === 'ar' ? tab.labelAr : tab.labelEn}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
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
                <div className="bg-blue-950/40 light:bg-blue-50 border border-blue-600/50 light:border-blue-300 p-3.5 rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-sm text-blue-300 light:text-blue-700 flex items-center gap-1.5">
                      <span>👨‍👩‍👧‍👦</span>
                      <span>{lang === 'ar' ? 'المريض مرتبط بعائلة:' : 'Linked Family:'} {formData.familyTag}</span>
                    </div>
                    <div className="text-[11px] text-neutral-300 light:text-neutral-600 mt-0.5">
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
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition-colors whitespace-nowrap"
                  >
                    {lang === 'ar' ? 'توحيد صرف العائلة ⚡' : 'Household Sync ⚡'}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-neutral-300 light:text-neutral-700">
                    {lang === 'ar' ? 'الاسم الكامل للمريض *' : 'Full Name *'}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder={lang === 'ar' ? 'مثال: أحمد عبد الله الجبوري' : 'e.g. John Doe'}
                    className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 rounded-lg p-2.5 outline-none focus:border-blue-500 font-semibold"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-neutral-300 light:text-neutral-700">
                    {lang === 'ar' ? 'رقم الهاتف (مع رمز الدولة لـ WhatsApp / SMS) *' : 'Phone (WhatsApp/SMS) *'}
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="07700000000 / +964..."
                    className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 rounded-lg p-2.5 outline-none focus:border-blue-500 font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-neutral-300 light:text-neutral-700">
                    {lang === 'ar' ? 'تاريخ الميلاد' : 'Date of Birth'}
                  </label>
                  <input
                    type="date"
                    value={formData.dob || ''}
                    onChange={handleDobChange}
                    className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 rounded-lg p-2.5 outline-none focus:border-blue-500 font-mono"
                  />
                  {formData.age ? (
                    <span className="text-[11px] text-blue-400 light:text-blue-600 font-semibold">
                      {lang === 'ar' ? `العمر المحسوب: ${formData.age} سنة` : `Age: ${formData.age} years`}
                    </span>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-neutral-300 light:text-neutral-700">
                    {lang === 'ar' ? 'الجنس' : 'Gender'}
                  </label>
                  <select
                    value={formData.gender || 'M'}
                    onChange={e => setFormData({ ...formData, gender: e.target.value as any })}
                    className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 rounded-lg p-2.5 outline-none focus:border-blue-500"
                  >
                    <option value="M">{lang === 'ar' ? 'ذكر' : 'Male'}</option>
                    <option value="F">{lang === 'ar' ? 'أنثى' : 'Female'}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-neutral-300 light:text-neutral-700">
                    {lang === 'ar' ? 'رمز العائلة (Family Tag)' : 'Family Tag'}
                  </label>
                  <input
                    type="text"
                    value={formData.familyTag || ''}
                    onChange={e => setFormData({ ...formData, familyTag: e.target.value })}
                    placeholder={lang === 'ar' ? 'مثال: عائلة_الجبوري' : 'e.g. Smith_Family'}
                    className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 rounded-lg p-2.5 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-neutral-300 light:text-neutral-700">
                    {lang === 'ar' ? 'نقاط الولاء (Loyalty Points)' : 'Loyalty Points'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.loyaltyPoints || 0}
                    onChange={e => setFormData({ ...formData, loyaltyPoints: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 rounded-lg p-2.5 outline-none focus:border-blue-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-rose-400 light:text-rose-600">
                  {lang === 'ar' ? 'الحساسيات الدوائية المعروفة (Allergies)' : 'Known Drug Allergies'}
                </label>
                <input
                  type="text"
                  value={formData.allergies || ''}
                  onChange={e => setFormData({ ...formData, allergies: e.target.value })}
                  placeholder="مثال: Penicillin, Sulfa, Aspirin..."
                  className="w-full bg-[#141414] light:bg-neutral-50 border border-rose-900/50 light:border-rose-300 text-rose-300 light:text-rose-700 rounded-lg p-2.5 outline-none focus:border-rose-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-300 light:text-neutral-700">
                  {lang === 'ar' ? 'التاريخ المرضي والملاحظات السريرية' : 'Clinical History & Medical Notes'}
                </label>
                <textarea
                  rows={3}
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={lang === 'ar' ? 'تاريخ الإصابة، أمراض مصاحبة (ضغط، سكري، كلى)...' : 'Medical history, chronic conditions, special notes...'}
                  className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 rounded-lg p-2.5 outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* TAB 2: REGIMEN & REFILL TIMELINES */}
          {activeTab === 'regimen' && (
            <div className="space-y-4">
              {/* Meds List header */}
              <div className="flex items-center justify-between pt-1">
                <span className="font-bold text-sm text-white light:text-neutral-900">
                  {lang === 'ar' ? 'الأدوية المزمنة المقررة ومخطط الصرف:' : 'Prescribed Chronic Regimen & Refill Timelines:'}
                </span>
                <button
                  type="button"
                  onClick={handleAddMedication}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'إضافة دواء' : 'Add Medication'}</span>
                </button>
              </div>

              {/* Meds items */}
              <div className="space-y-4">
                {formData.medications.length === 0 && (
                  <div className="p-8 text-center bg-[#141414] light:bg-neutral-50 rounded-xl border border-dashed border-[#333] light:border-neutral-300 space-y-2">
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
                    className="p-3.5 rounded-xl bg-[#141414] light:bg-neutral-50 border border-[#2e2e2e] light:border-neutral-200 space-y-2.5 transition-all shadow-sm"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                      <div className="sm:col-span-5 space-y-1">
                        <label className="text-[10px] text-neutral-400 font-semibold">{lang === 'ar' ? 'اسم الدواء (العلامة التجارية)' : 'Brand Name'}</label>
                        <input
                          type="text"
                          value={m.name}
                          onChange={e => handleMedChange(idx, 'name', e.target.value)}
                          placeholder="Glucophage, Concor, Lipitor..."
                          className="w-full bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-300 p-2 rounded-lg text-white light:text-neutral-900 font-bold text-xs outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="sm:col-span-3 space-y-1">
                        <label className="text-[10px] text-neutral-400 font-semibold">{lang === 'ar' ? 'تاريخ آخر صرف' : 'Last Dispense'}</label>
                        <input
                          type="date"
                          value={m.lastDispenseDate}
                          onChange={e => handleMedChange(idx, 'lastDispenseDate', e.target.value)}
                          className="w-full bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-300 p-2 rounded-lg text-white light:text-neutral-900 text-xs font-mono outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="sm:col-span-3 space-y-1">
                        <label className="text-[10px] text-neutral-400 font-semibold">{lang === 'ar' ? 'الكمية (أيام / حبات)' : 'Supply (Days/Tabs)'}</label>
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={m.daysSupply}
                          onChange={e => handleMedChange(idx, 'daysSupply', parseInt(e.target.value, 10) || 30)}
                          className="w-full bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-300 p-2 rounded-lg text-white light:text-neutral-900 text-xs font-bold text-center outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="sm:col-span-1 flex justify-end pt-4">
                        <button
                          type="button"
                          onClick={() => handleRemoveMedication(idx)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 light:hover:bg-neutral-200 transition-colors cursor-pointer"
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
              <div className="bg-[#141414] light:bg-neutral-50 p-4 rounded-xl border border-[#2e2e2e] light:border-neutral-200 space-y-3">
                <div className="font-bold text-sm text-white light:text-neutral-900 flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-rose-400" />
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
                      className="w-full bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-300 p-2 rounded-lg text-white light:text-neutral-900 text-xs text-center font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-400 font-semibold">{lang === 'ar' ? 'الانبساطي (Diastolic)' : 'Diastolic'}</label>
                    <input
                      type="number"
                      placeholder="80"
                      value={newDia}
                      onChange={e => setNewDia(e.target.value)}
                      className="w-full bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-300 p-2 rounded-lg text-white light:text-neutral-900 text-xs text-center font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-400 font-semibold">{lang === 'ar' ? 'السكر (mg/dL)' : 'Glucose'}</label>
                    <input
                      type="number"
                      placeholder="110"
                      value={newSugar}
                      onChange={e => setNewSugar(e.target.value)}
                      className="w-full bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-300 p-2 rounded-lg text-white light:text-neutral-900 text-xs text-center font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-400 font-semibold">{lang === 'ar' ? 'HbA1c / نبض / وزن' : 'HbA1c / Pulse'}</label>
                    <input
                      type="text"
                      placeholder="HbA1c: 6.8% / 72 bpm"
                      value={newMisc}
                      onChange={e => setNewMisc(e.target.value)}
                      className="w-full bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-300 p-2 rounded-lg text-white light:text-neutral-900 text-xs"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddVitals}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition-colors"
                >
                  {lang === 'ar' ? '🩺 حفظ القراءة السريرية' : 'Log Clinical Entry'}
                </button>
              </div>

              {/* Vitals History Table */}
              <div className="border border-[#383838] light:border-neutral-200 rounded-xl overflow-hidden">
                <table className="w-full text-right dir-rtl text-xs">
                  <thead className="bg-[#292929] light:bg-neutral-100 text-neutral-300 light:text-neutral-700 font-bold border-b border-[#383838] light:border-neutral-200">
                    <tr>
                      <th className="py-2.5 px-3">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                      <th className="py-2.5 px-3">{lang === 'ar' ? 'ضغط الدم (BP)' : 'BP'}</th>
                      <th className="py-2.5 px-3">{lang === 'ar' ? 'السكر (mg/dL)' : 'Sugar'}</th>
                      <th className="py-2.5 px-3">{lang === 'ar' ? 'مؤشرات إضافية' : 'Misc'}</th>
                      <th className="py-2.5 px-3">{lang === 'ar' ? 'التقييم' : 'Assessment'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2e2e2e] light:divide-neutral-200 text-neutral-200 light:text-neutral-800">
                    {(formData.vitals || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-neutral-400">
                          {lang === 'ar' ? 'لا توجد قراءات سابقة مسجلة.' : 'No recorded vitals yet.'}
                        </td>
                      </tr>
                    ) : (
                      formData.vitals!.map((v, i) => (
                        <tr key={i} className="hover:bg-neutral-800/30 light:hover:bg-neutral-100/60">
                          <td className="py-2.5 px-3 font-mono text-neutral-400">{v.date}</td>
                          <td className="py-2.5 px-3 font-bold font-mono text-blue-400 light:text-blue-600">{v.bp}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-400 light:text-amber-600">{v.sugar}</td>
                          <td className="py-2.5 px-3 text-neutral-300 light:text-neutral-700">{v.misc}</td>
                          <td className="py-2.5 px-3">
                            <span className="text-[11px] font-semibold text-emerald-400 light:text-emerald-700 bg-emerald-950/40 light:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-800/40 light:border-emerald-300">
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
              <div className="bg-[#141414] light:bg-neutral-50 p-4 rounded-xl border border-[#2e2e2e] light:border-neutral-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-white light:text-neutral-900 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-400" />
                    <span>
                      {lang === 'ar'
                        ? 'إرفاق وحفظ صورة الروشتة أو التحليل بدقة كاملة (Full Resolution Scan)'
                        : 'Attach & Save Prescription or Lab Scan (Full Resolution)'}
                    </span>
                  </div>
                  {isUploadingScan && (
                    <span className="text-xs text-blue-400 font-bold flex items-center gap-1.5">
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
                    className="block w-full text-xs text-neutral-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-400 flex-wrap gap-2">
                  <span>
                    {lang === 'ar'
                      ? 'يتم تخزين الصورة بنقائها وجودتها الكاملة مع حفظ رابطها المباشر في Google Sheet و Google Drive.'
                      : 'Stored with direct URLs saved in Google Sheet & Google Drive.'}
                  </span>
                  {gasUrl ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{lang === 'ar' ? 'المزامنة مع Google Drive والشيت مفعلة ☁️' : 'Drive & Sheet Sync Active'}</span>
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <HardDrive className="w-3 h-3" />
                      <span>{lang === 'ar' ? 'حفظ محلي بدقة كاملة (أدخل رابط Apps Script للحفظ في Drive)' : 'Local storage (Set Apps Script URL for Drive sync)'}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Gallery Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-300 light:text-neutral-700">
                  <span>{lang === 'ar' ? 'معرض الوصفات والتحاليل المخزنة:' : 'Stored Prescriptions & Lab Scans:'}</span>
                  <span className="text-neutral-500 font-normal">
                    {(formData.scans || []).length} {lang === 'ar' ? 'صورة' : 'images'}
                  </span>
                </div>

                {(formData.scans || []).length === 0 ? (
                  <div className="border border-dashed border-[#383838] light:border-neutral-300 rounded-xl p-8 text-center text-neutral-500 space-y-2">
                    <ImageIcon className="w-8 h-8 mx-auto text-neutral-600 light:text-neutral-400" />
                    <p className="text-xs">
                      {lang === 'ar'
                        ? 'لا توجد صور روشتات أو تحاليل مرفقة لهذا المريض بعد.'
                        : 'No prescription or lab scans attached yet.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-blue-400 hover:text-blue-300 font-bold hover:underline inline-block"
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
              <div className="bg-[#141414] light:bg-neutral-50 p-4 rounded-xl border border-[#2e2e2e] light:border-neutral-200">
                <div className="font-bold text-sm text-white light:text-neutral-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
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
                <div className="bg-[#141414] light:bg-neutral-50 p-3.5 rounded-xl border border-[#2e2e2e] light:border-neutral-200 space-y-2">
                  <div className="font-bold text-amber-400 light:text-amber-600 flex items-center gap-1.5 text-xs">
                    <span>☀️</span>
                    <span>{lang === 'ar' ? 'الصباح / الإفطار' : 'Morning / Breakfast'}</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    {formData.medications
                      .filter(m => m.timing === 'morning' || m.timing === 'bid' || !m.timing)
                      .map((m, i) => (
                        <div key={i} className="p-2 rounded bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200">
                          <strong className="text-white light:text-neutral-900 block">{m.name}</strong>
                          <span className="text-[10px] text-neutral-400">
                            {m.mealRelation === 'before_meal' ? (lang === 'ar' ? 'قبل الإفطار بـ 30 دقيقة' : '30 min before breakfast') : (lang === 'ar' ? 'مع أو بعد الإفطار' : 'With or after breakfast')}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Noon */}
                <div className="bg-[#141414] light:bg-neutral-50 p-3.5 rounded-xl border border-[#2e2e2e] light:border-neutral-200 space-y-2">
                  <div className="font-bold text-blue-400 light:text-blue-600 flex items-center gap-1.5 text-xs">
                    <span>🌤️</span>
                    <span>{lang === 'ar' ? 'الظهيرة / الغداء' : 'Noon / Lunch'}</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    {formData.medications
                      .filter(m => m.timing === 'noon')
                      .map((m, i) => (
                        <div key={i} className="p-2 rounded bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200">
                          <strong className="text-white light:text-neutral-900 block">{m.name}</strong>
                          <span className="text-[10px] text-neutral-400">{lang === 'ar' ? 'بعد الغداء' : 'After lunch'}</span>
                        </div>
                      ))}
                    {formData.medications.filter(m => m.timing === 'noon').length === 0 && (
                      <span className="text-neutral-500 text-[11px]">{lang === 'ar' ? 'لا توجد جرعات ظهيرة' : 'No noon doses'}</span>
                    )}
                  </div>
                </div>

                {/* Evening */}
                <div className="bg-[#141414] light:bg-neutral-50 p-3.5 rounded-xl border border-[#2e2e2e] light:border-neutral-200 space-y-2">
                  <div className="font-bold text-orange-400 light:text-orange-600 flex items-center gap-1.5 text-xs">
                    <span>🌅</span>
                    <span>{lang === 'ar' ? 'المساء / العشاء' : 'Evening / Dinner'}</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    {formData.medications
                      .filter(m => m.timing === 'bid' || m.timing === 'evening')
                      .map((m, i) => (
                        <div key={i} className="p-2 rounded bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200">
                          <strong className="text-white light:text-neutral-900 block">{m.name}</strong>
                          <span className="text-[10px] text-neutral-400">{lang === 'ar' ? 'مع العشاء' : 'With dinner'}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Bedtime */}
                <div className="bg-[#141414] light:bg-neutral-50 p-3.5 rounded-xl border border-[#2e2e2e] light:border-neutral-200 space-y-2">
                  <div className="font-bold text-indigo-400 light:text-indigo-600 flex items-center gap-1.5 text-xs">
                    <span>🌙</span>
                    <span>{lang === 'ar' ? 'قبل النوم' : 'Bedtime'}</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    {formData.medications
                      .filter(m => m.timing === 'bedtime')
                      .map((m, i) => (
                        <div key={i} className="p-2 rounded bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200">
                          <strong className="text-white light:text-neutral-900 block">{m.name}</strong>
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
                <span className="font-bold text-sm text-white light:text-neutral-900">
                  {lang === 'ar' ? 'البطاقة الطبية الفورية (Pocket Thermal Slip & QR)' : 'Pocket Thermal Slip & QR'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(thermalSlipText);
                      onShowToast(lang === 'ar' ? 'تم نسخ نص البطاقة الطبية' : 'Copied slip', 'success');
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold"
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
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'طباعة إيصال' : 'Print Slip'}</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <pre
                  id="thermal-slip-print"
                  className="flex-1 bg-white text-black p-4 font-mono text-xs rounded-lg border border-neutral-300 shadow-inner overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[380px]"
                >
                  {thermalSlipText}
                </pre>

                {qrDataUrl && (
                  <div className="bg-white p-3 rounded-lg border border-neutral-300 flex flex-col items-center gap-2 shrink-0">
                    <img src={qrDataUrl} alt="Patient QR Code" className="w-28 h-28" />
                    <span className="text-[10px] text-neutral-700 font-mono font-bold">
                      {formData.name.split(' ')[0]} - QR
                    </span>
                  </div>
                )}
              </div>

              {/* Danger Zone: Permanent Patient Deletion */}
              {patient?.id && (
                <div className="p-4 rounded-xl bg-rose-950/30 light:bg-rose-50 border border-rose-800/40 light:border-rose-200 space-y-3 mt-6">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-rose-400 light:text-rose-700 font-bold text-xs">
                      <ShieldAlert className="w-4 h-4 text-rose-400 light:text-rose-600" />
                      <span>{lang === 'ar' ? 'منطقة العمليات الحساسة (Danger Zone)' : 'Danger Zone'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'حذف ملف المريض نهائياً' : 'Delete Patient Permanently'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-neutral-300 light:text-neutral-600 leading-relaxed">
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
        <div className="p-4 bg-[#292929] light:bg-neutral-100 border-t border-[#383838] light:border-neutral-200 flex items-center justify-between gap-3">
          {patient?.id && activeTab === 'thermal' ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>{lang === 'ar' ? 'حذف المريض' : 'Delete Patient'}</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-neutral-800 light:bg-neutral-200 hover:bg-neutral-700 light:hover:bg-neutral-300 text-neutral-300 light:text-neutral-800 text-xs font-semibold transition-colors"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-lg bg-[#0f6cbd] hover:bg-[#115ea3] text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
            >
              {lang === 'ar' ? '💾 حفظ الملف السريري' : 'Save Dossier'}
            </button>
          </div>
        </div>
      </div>

      {/* Permanent Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1f1f1f] border border-rose-800/60 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-full bg-rose-950/60 border border-rose-800/60">
                <ShieldAlert className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">
                  {lang === 'ar' ? 'تأكيد حذف ملف المريض نهائياً' : 'Confirm Permanent Deletion'}
                </h3>
                <span className="text-[11px] text-neutral-400">
                  {formData.name} ({formData.phone})
                </span>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed bg-[#141414] p-3 rounded-lg border border-neutral-800">
              {lang === 'ar'
                ? 'هل أنت متأكد من رغبتك في حذف هذا الملف بشكل نهائي؟ سيتم حذف جميع بيانات المريض، والأدوية المزمنة، وسجلات الضغط والسكر، والمتابعات السريرية المرتبطة به ولا يمكن استرجاعها.'
                : 'Are you sure you want to permanently delete this patient dossier? All personal data, chronic medications, vitals history, and clinical follow-ups will be permanently deleted.'}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors"
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
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
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
          lang={lang}
          onClose={() => setPreviewingScan(null)}
          onDelete={handleDeleteScan}
        />
      )}
    </div>
  );
};
