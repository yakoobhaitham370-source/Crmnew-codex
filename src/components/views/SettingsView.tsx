import React, { useState, useMemo } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  Download,
  Upload,
  AlertTriangle,
  RefreshCw,
  Check,
  Code,
  Copy,
  ExternalLink,
  X,
  Cloud,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Activity,
  FileCode,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Settings } from '../../types/pharmacy';
import { validateGasUrl, testSheetConnectionDetailed, GasDiagnosticResult } from '../../services/apiService';
import { APPS_SCRIPT_CODE } from '../../data/appsScriptTemplate';

interface SettingsViewProps {
  settings: Settings;
  lang: 'ar' | 'en';
  onSaveSettings: (settings: Settings) => void;
  onExportBackup: () => void;
  onImportBackup: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onResetDatabase: () => void;
  onTestSheetConnection: () => void;
  onPushLocalToSheet?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  lang,
  onSaveSettings,
  onExportBackup,
  onImportBackup,
  onResetDatabase,
  onTestSheetConnection,
  onPushLocalToSheet,
}) => {
  const [formData, setFormData] = useState<Settings>({ ...settings });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [scriptModalTab, setScriptModalTab] = useState<'code' | 'instructions' | 'faq'>('code');
  const [showNetlifyModal, setShowNetlifyModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Diagnostic testing state
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<GasDiagnosticResult | null>(null);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);

  // Live URL validation
  const urlValidation = useMemo(() => validateGasUrl(formData.gasUrl), [formData.gasUrl]);

  // Interactive diagnostic runner
  const handleRunDiagnostic = async () => {
    if (!formData.gasUrl || !formData.gasUrl.trim()) return;
    setIsDiagnosing(true);
    setShowDiagnosticModal(true);
    try {
      const res = await testSheetConnectionDetailed(formData.gasUrl);
      setDiagnosticResult(res);
      if (res.success) {
        onTestSheetConnection();
      }
    } catch (err: any) {
      setDiagnosticResult({
        success: false,
        message: err.message || 'فشل الاتصال',
        tip: 'تحقق من اتصال الإنترنت ومن نسخ الرابط كاملاً.',
      });
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleFixDevUrl = () => {
    if (urlValidation.normalizedUrl) {
      setFormData({ ...formData, gasUrl: urlValidation.normalizedUrl });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl p-5 shadow-sm">
        <div className="font-extrabold text-lg text-white light:text-neutral-900 flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-blue-400" />
          <span>{lang === 'ar' ? 'الإعدادات العامة والربط السحابي وقوالب الرسائل' : 'Settings & Cloud Integration'}</span>
        </div>
        <p className="text-xs text-neutral-400 light:text-neutral-500 mt-1">
          {lang === 'ar'
            ? 'تخصيص اسم الصيدلية، ورابط مزامنة Google Sheet / Google Drive، وصيغ رسائل التذكير والمتابعة السريرية.'
            : 'Configure pharmacy branding, Google Sheet Web App endpoint, and customized WhatsApp & SMS messaging templates.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Pharmacy & Cloud */}
        <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="font-bold text-sm text-white light:text-neutral-900">
            {lang === 'ar' ? 'البيانات الأساسية والربط السحابي' : 'Basic & Cloud Configuration'}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300 light:text-neutral-700">
              {lang === 'ar' ? 'اسم الصيدلية أو المركز السريري' : 'Pharmacy / Clinic Brand Name'}
            </label>
            <input
              type="text"
              value={formData.pharmacyName}
              onChange={e => setFormData({ ...formData, pharmacyName: e.target.value })}
              className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 text-xs rounded-lg p-2.5 outline-none focus:border-blue-500"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-semibold text-neutral-300 light:text-neutral-700 flex items-center gap-1.5">
                <span>{lang === 'ar' ? 'رابط Google Apps Script Web App URL' : 'Google Apps Script Web App URL'}</span>
                <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-mono">/exec</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowScriptModal(true)}
                  className="text-[11px] font-bold text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/40 border border-amber-800/40 transition-colors"
                >
                  <Code className="w-3.5 h-3.5 text-amber-400" />
                  <span>{lang === 'ar' ? 'كود Apps Script السريع (Code.gs)' : 'Fast Apps Script & Guide'}</span>
                </button>

                {formData.gasUrl && (
                  <button
                    type="button"
                    onClick={handleRunDiagnostic}
                    disabled={isDiagnosing}
                    className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-950/40 border border-blue-800/40 hover:bg-blue-900/60 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isDiagnosing ? 'animate-spin' : ''}`} />
                    <span>{isDiagnosing ? (lang === 'ar' ? 'جارِ الفحص...' : 'Testing...') : (lang === 'ar' ? 'فحص واختبار الاتصال' : 'Test Sync')}</span>
                  </button>
                )}

                {formData.gasUrl && onPushLocalToSheet && (
                  <button
                    type="button"
                    onClick={onPushLocalToSheet}
                    className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-800/40 hover:bg-emerald-900/60 transition-colors cursor-pointer"
                    title={lang === 'ar' ? 'رفع وتصدير السجلات المحلية لتزويد الشيت' : 'Push local records to Google Sheet'}
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{lang === 'ar' ? 'تزويد الشيت محلياً' : 'Push Local Data'}</span>
                  </button>
                )}

                {formData.gasUrl && (
                  <button
                    type="button"
                    onClick={onResetDatabase}
                    className="text-[11px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/40 border border-rose-800/40 hover:bg-rose-900/60 transition-colors cursor-pointer"
                    title={lang === 'ar' ? 'تفريغ قاعدة البيانات ومسح شيت Google Sheet' : 'Reset Database & Google Sheet'}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>{lang === 'ar' ? 'تفريغ الشيت والموقع' : 'Reset DB & Sheet'}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <input
                type="url"
                value={formData.gasUrl}
                onChange={e => setFormData({ ...formData, gasUrl: e.target.value })}
                placeholder="https://script.google.com/macros/s/.../exec"
                className={`w-full bg-[#141414] light:bg-neutral-50 border text-white light:text-neutral-900 text-xs rounded-lg p-2.5 font-mono outline-none transition-colors ${
                  formData.gasUrl && !urlValidation.isValid
                    ? 'border-amber-500/80 focus:border-amber-500'
                    : 'border-[#383838] light:border-neutral-300 focus:border-blue-500'
                }`}
              />
              {formData.gasUrl && urlValidation.isValid && (
                <div className="absolute left-3 top-2.5 text-emerald-400 flex items-center gap-1 text-[11px]">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
            </div>

            {/* Smart Live Diagnostic Warnings */}
            {formData.gasUrl && !urlValidation.isValid && (
              <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/50 space-y-2 text-xs">
                <div className="flex items-start gap-2 text-amber-300 font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <span>{urlValidation.error || urlValidation.warning}</span>
                </div>
                {urlValidation.tip && (
                  <p className="text-neutral-300 text-[11px] leading-relaxed mr-6">
                    {urlValidation.tip}
                  </p>
                )}
                {urlValidation.warning?.includes('/dev') && (
                  <button
                    type="button"
                    onClick={handleFixDevUrl}
                    className="mr-6 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold text-[11px] rounded transition-colors"
                  >
                    {lang === 'ar' ? '⚡ تحويل الرابط تلقائياً إلى /exec' : 'Auto-fix URL to /exec'}
                  </button>
                )}
              </div>
            )}

            <div className="text-[11px] text-neutral-400 flex items-center justify-between">
              <span>
                {lang === 'ar'
                  ? 'يتيح المزامنة اللحظية مع Google Sheets وحفظ روابط صور الوصفات الطبية في Google Drive تلقائياً.'
                  : 'Enables real-time sync with Google Sheets and prescription storage in Google Drive.'}
              </span>
              <a
                href="/download/Code.gs"
                download="Code.gs"
                className="text-blue-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <Download className="w-3 h-3" />
                <span>{lang === 'ar' ? 'تحميل ملف Code.gs' : 'Download Code.gs'}</span>
              </a>
            </div>
          </div>
        </div>

        {/* Messaging Templates */}
        <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="font-bold text-sm text-white light:text-neutral-900">
            {lang === 'ar' ? 'قوالب الرسائل المخصصة (WhatsApp & SMS Templates)' : 'Automated Messaging Templates'}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300 light:text-neutral-700">
              {lang === 'ar' ? 'قالب تذكير صرف العلاج المزمن (WhatsApp)' : 'Chronic Refill Reminder Template (WhatsApp)'}
            </label>
            <textarea
              rows={3}
              value={formData.waTemplate}
              onChange={e => setFormData({ ...formData, waTemplate: e.target.value })}
              className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 text-xs rounded-lg p-2.5 outline-none focus:border-blue-500 leading-relaxed"
            />
            <div className="text-[10px] text-neutral-400">
              {lang === 'ar' ? 'المتغيرات المتاحة: {name}, {pharmacy}, {drug}, {date}' : 'Variables: {name}, {pharmacy}, {drug}, {date}'}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300 light:text-neutral-700">
              {lang === 'ar' ? 'قالب متابعة كورس المضاد الحيوي (Antibiotic Stewardship Check-in)' : 'Antibiotic Stewardship Check-in'}
            </label>
            <textarea
              rows={3}
              value={formData.waAbxTemplate}
              onChange={e => setFormData({ ...formData, waAbxTemplate: e.target.value })}
              className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 text-xs rounded-lg p-2.5 outline-none focus:border-blue-500 leading-relaxed"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300 light:text-neutral-700">
              {lang === 'ar' ? 'قالب متابعة العلاج المزمن الجديد (Chronic Milestones Check-in)' : 'Chronic Therapy Milestone Check-in'}
            </label>
            <textarea
              rows={3}
              value={formData.waChronicFollowTemplate}
              onChange={e => setFormData({ ...formData, waChronicFollowTemplate: e.target.value })}
              className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 text-xs rounded-lg p-2.5 outline-none focus:border-blue-500 leading-relaxed"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300 light:text-neutral-700">
              {lang === 'ar' ? 'قالب الرسائل النصية القصيرة (SMS Reminder Template)' : 'SMS Text Template'}
            </label>
            <textarea
              rows={2}
              value={formData.smsTemplate}
              onChange={e => setFormData({ ...formData, smsTemplate: e.target.value })}
              className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 text-xs rounded-lg p-2.5 outline-none focus:border-blue-500 leading-relaxed"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
          >
            {savedSuccess ? <Check className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
            <span>{savedSuccess ? (lang === 'ar' ? 'تم الحفظ بنجاح!' : 'Saved!') : (lang === 'ar' ? 'حفظ كافة الإعدادات' : 'Save Settings')}</span>
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onExportBackup}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'تصدير نسخة احتياطية (JSON)' : 'Export JSON Backup'}</span>
            </button>

            <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-semibold transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'استيراد نسخة احتياطية' : 'Import JSON'}</span>
              <input
                type="file"
                accept=".json"
                onChange={onImportBackup}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={onResetDatabase}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'تفريغ ومسح كافة البيانات' : 'Reset & Empty Database'}</span>
            </button>
          </div>
        </div>

        {/* Netlify Deployment Section */}
        <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-sm text-white light:text-neutral-900 flex items-center gap-2">
                  <span>{lang === 'ar' ? 'نشر الموقع واستضافته على Netlify مجاناً' : 'Deploy & Host on Netlify'}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 font-bold">
                    {lang === 'ar' ? 'جاهز للنشر بنقرة واحدة' : 'Production Ready'}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 light:text-neutral-500 mt-0.5">
                  {lang === 'ar'
                    ? 'تم تجهيز ملفات الاستضافة (dist) في حزمة مضغوطة جاهزة للسحب والإفلات على app.netlify.com/drop أو الرفع عبر GitHub.'
                    : 'The project is pre-built into dist.zip ready for instant drag-and-drop on Netlify Drop or GitHub.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowNetlifyModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-semibold transition-colors"
              >
                <HelpCircle className="w-4 h-4 text-teal-400" />
                <span>{lang === 'ar' ? 'دليل خطوات الاستضافة على Netlify' : 'View Netlify Guide'}</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* ========================================================================= */}
      {/* 1. Fast Google Apps Script Backend Code Modal                             */}
      {/* ========================================================================= */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#383838] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#383838] flex items-center justify-between bg-[#141414]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <Code className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-extrabold text-sm text-white flex items-center gap-2">
                    <span>{lang === 'ar' ? 'كود Google Apps Script السريع (Code.gs)' : 'Fast Google Apps Script Backend (Code.gs)'}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                      الإصدار 4.0.0 Ultra-Fast
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-400">
                    {lang === 'ar' ? 'كود مختصر وسريع جداً، ينظم الشيت تلقائياً ويحفظ صور الروشتات في Google Drive' : 'Clean & fast script with Google Drive photo links and structured tables'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center border-b border-[#383838] bg-[#161616] px-4 gap-2">
              <button
                type="button"
                onClick={() => setScriptModalTab('code')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
                  scriptModalTab === 'code'
                    ? 'border-amber-400 text-amber-300 bg-amber-500/5'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <FileCode className="w-4 h-4" />
                <span>{lang === 'ar' ? 'كود السكريبت (Code.gs)' : 'Script (Code.gs)'}</span>
              </button>

              <button
                type="button"
                onClick={() => setScriptModalTab('instructions')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
                  scriptModalTab === 'instructions'
                    ? 'border-blue-400 text-blue-300 bg-blue-500/5'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <HelpCircle className="w-4 h-4" />
                <span>{lang === 'ar' ? 'طريقة التركيب في دقيقة' : '1-Minute Setup'}</span>
              </button>

              <button
                type="button"
                onClick={() => setScriptModalTab('faq')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
                  scriptModalTab === 'faq'
                    ? 'border-emerald-400 text-emerald-300 bg-emerald-500/5'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{lang === 'ar' ? 'حلول سريعة' : 'Troubleshooting'}</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
              {scriptModalTab === 'code' && (
                <div className="space-y-3">
                  {/* Action Bar */}
                  <div className="flex items-center justify-between flex-wrap gap-2 p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                    <div className="flex items-center gap-2 text-neutral-300">
                      <span className="font-semibold">{lang === 'ar' ? 'الملف:' : 'File:'}</span>
                      <code className="text-amber-400 font-mono font-bold bg-black/40 px-2 py-0.5 rounded">Code.gs</code>
                      <span className="text-emerald-400 font-semibold">• سريع وخفيف جداً</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href="/download/Code.gs"
                        download="Code.gs"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'تحميل ملف Code.gs' : 'Download Code.gs'}</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(APPS_SCRIPT_CODE);
                          setCopiedCode(true);
                          setTimeout(() => setCopiedCode(false), 2500);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow transition-colors cursor-pointer"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedCode ? (lang === 'ar' ? 'تم نسخ الكود!' : 'Copied!') : (lang === 'ar' ? 'نسخ الكود' : 'Copy Code')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Code Container */}
                  <div className="relative border border-[#383838] rounded-xl overflow-hidden bg-[#0d0d0d]">
                    <pre className="p-4 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-[500px] leading-relaxed selection:bg-emerald-900 selection:text-white">
                      {APPS_SCRIPT_CODE}
                    </pre>
                  </div>
                </div>
              )}

              {scriptModalTab === 'instructions' && (
                <div className="space-y-4 text-neutral-200">
                  <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-800/40 space-y-2">
                    <div className="font-bold text-blue-300 text-sm flex items-center gap-2">
                      <span>🚀</span>
                      <span>{lang === 'ar' ? 'خطوات الربط والتفعيل في دقيقة واحدة:' : '1-Minute Setup Guide:'}</span>
                    </div>
                    <p className="text-neutral-300 leading-relaxed text-xs">
                      {lang === 'ar'
                        ? 'اتبع هذه الخطوات البسيطة لربط التطبيق مع Google Sheet الخاص بك:'
                        : 'Follow these simple steps to link the application with your Google Sheet:'}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-bold">1</span>
                        <span>{lang === 'ar' ? 'افتح جدول Google Sheet:' : 'Open Google Sheet:'}</span>
                      </div>
                      <p className="text-neutral-400 text-xs mr-7">
                        {lang === 'ar'
                          ? 'افتح جدول بيانات جديد من sheets.new، أو استخدم جدولك الحالي.'
                          : 'Open a new Google Sheet at sheets.new or use an existing one.'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-bold">2</span>
                        <span>{lang === 'ar' ? 'افتح محرر Apps Script:' : 'Open Apps Script:'}</span>
                      </div>
                      <p className="text-neutral-400 text-xs mr-7">
                        {lang === 'ar'
                          ? 'من القائمة العلوية داخل الشيت، اضغط على: الامتدادات (Extensions) > Apps Script.'
                          : 'In Google Sheets top menu, click Extensions > Apps Script.'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-bold">3</span>
                        <span>{lang === 'ar' ? 'لصق الكود وحفظه:' : 'Paste & Save Code:'}</span>
                      </div>
                      <p className="text-neutral-400 text-xs mr-7">
                        {lang === 'ar'
                          ? 'احذف أي كود موجود في Code.gs، والصق الكود من التبويب السابق، ثم اضغط على زر الحفظ (💾).'
                          : 'Replace code in Code.gs with this code and save (💾).'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-amber-950/20 border border-amber-800/40 rounded-xl space-y-2">
                      <div className="font-bold text-amber-300 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-500 text-black text-[11px] flex items-center justify-center font-bold">4</span>
                        <span>{lang === 'ar' ? 'نشر تطبيق الويب (New Deployment):' : 'Deploy as Web App:'}</span>
                      </div>
                      <div className="mr-7 space-y-1.5 text-neutral-300 text-xs">
                        <p>• اضغط في أعلى اليمين على <strong>Deploy (نشر)</strong> &gt; <strong>New deployment (نشر جديد)</strong>.</p>
                        <p>• اختر <strong>Web app (تطبيق ويب)</strong>.</p>
                        <p>• في <strong>Execute as</strong> اختر: <strong className="text-white">Me (أنا)</strong>.</p>
                        <p className="p-2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-200 font-bold">
                          ⚠️ في خانة "Who has access" اختر: "Anyone" (أي شخص).
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-bold">5</span>
                        <span>{lang === 'ar' ? 'منح الإذن ونسخ الرابط:' : 'Authorize & Copy URL:'}</span>
                      </div>
                      <p className="text-neutral-400 text-xs mr-7">
                        {lang === 'ar'
                          ? 'اضغط Deploy ثم Authorize access > اختر حساب Google > Advanced > سماح (Allow). انسخ الرابط المنتهي بـ /exec وضعه في إعدادات التطبيق.'
                          : 'Click Deploy, Authorize access, Allow, and copy the Web App URL.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {scriptModalTab === 'faq' && (
                <div className="space-y-3 text-neutral-200">
                  <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2">
                    <div className="font-bold text-amber-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{lang === 'ar' ? 'تأكد من اختيار "Anyone" عند النشر' : 'Ensure Access is set to Anyone'}</span>
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed">
                      {lang === 'ar'
                        ? 'إذا اخترت "Only myself" لن يتمكن الموقع من التواصل مع الشيت. تأكد من ضبط Who has access على Anyone.'
                        : 'Who has access must be set to Anyone.'}
                    </p>
                  </div>

                  <div className="p-4 bg-emerald-950/30 border border-emerald-800/40 rounded-xl space-y-2">
                    <div className="font-bold text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{lang === 'ar' ? 'تنظيم الشيت وروابط الصور التلقائي' : 'Automatic Sheet Layout & Image Links'}</span>
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed">
                      {lang === 'ar'
                        ? 'يقوم السكريبت الجديد بإنشاء أعمدة منسقة وواضحة، مع عمود مخصص لحفظ روابط صور الروشتات في Google Drive لتتمكن من فتحها مباشرة من الشيت بنقرة واحدة.'
                        : 'The new script formats columns automatically with direct clickable Google Drive photo links.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-[#141414] border-t border-[#383838] flex items-center justify-between">
              <a
                href="/download/Code.gs"
                download="Code.gs"
                className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'تحميل ملف Code.gs' : 'Download Code.gs'}</span>
              </a>

              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                className="px-5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. Interactive Cloud Connection Diagnostics Modal                         */}
      {/* ========================================================================= */}
      {showDiagnosticModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1f1f1f] border border-[#383838] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[#383838] flex items-center justify-between bg-[#191919]">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-400" />
                <span className="font-bold text-sm text-white">
                  {lang === 'ar' ? 'تقرير فحص وتشخيص الاتصال السحابي' : 'Cloud Connection Diagnostics Report'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowDiagnosticModal(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {isDiagnosing ? (
                <div className="py-8 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
                  <div className="font-bold text-white text-sm">
                    {lang === 'ar' ? 'جارِ فحص الاتصال بالخادم السحابي...' : 'Testing Cloud Connection...'}
                  </div>
                  <p className="text-neutral-400 text-xs">
                    {lang === 'ar' ? 'يتم اختبار الاستجابة والصلاحيات وقراءة السجلات.' : 'Verifying endpoint handshake and permissions.'}
                  </p>
                </div>
              ) : diagnosticResult ? (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                    diagnosticResult.success
                      ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-800/50 text-rose-200'
                  }`}>
                    {diagnosticResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <div className="font-bold text-sm">
                        {diagnosticResult.message}
                      </div>
                      {diagnosticResult.tip && (
                        <p className="text-xs text-neutral-300 leading-relaxed">
                          {diagnosticResult.tip}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Diagnostic Details Grid */}
                  <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2 font-mono text-[11px]">
                    <div className="flex items-center justify-between text-neutral-300">
                      <span className="text-neutral-500">صيغة الرابط (URL Format):</span>
                      <span className={urlValidation.isValid ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                        {urlValidation.isValid ? 'صحيح (Valid /exec)' : 'يحتاج مراجعة'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-neutral-300">
                      <span className="text-neutral-500">حالة الاستجابة (Handshake):</span>
                      <span className={diagnosticResult.success ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {diagnosticResult.success ? '200 OK (متصل)' : 'فشل الاتصال'}
                      </span>
                    </div>

                    {diagnosticResult.patientsCount !== undefined && (
                      <div className="flex items-center justify-between text-neutral-300">
                        <span className="text-neutral-500">سجلات المرضى في الشيت:</span>
                        <span className="text-blue-400 font-bold">{diagnosticResult.patientsCount} مريض</span>
                      </div>
                    )}

                    {diagnosticResult.followUpsCount !== undefined && (
                      <div className="flex items-center justify-between text-neutral-300">
                        <span className="text-neutral-500">المتابعات السريرية:</span>
                        <span className="text-blue-400 font-bold">{diagnosticResult.followUpsCount} متابعة</span>
                      </div>
                    )}

                    {diagnosticResult.spreadsheetName && (
                      <div className="flex items-center justify-between text-neutral-300">
                        <span className="text-neutral-500">اسم جدول البيانات:</span>
                        <span className="text-emerald-400 font-bold">{diagnosticResult.spreadsheetName}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions depending on result */}
                  {!diagnosticResult.success && (
                    <div className="flex items-center justify-between gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowDiagnosticModal(false);
                          setShowScriptModal(true);
                          setScriptModalTab('faq');
                        }}
                        className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-black font-bold text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <HelpCircle className="w-4 h-4" />
                        <span>{lang === 'ar' ? 'عرض حلول المشكلات في الدليل' : 'View Troubleshooting'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRunDiagnostic}
                        className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-xs"
                      >
                        {lang === 'ar' ? 'إعادة الفحص' : 'Retry'}
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="p-3 bg-[#191919] border-t border-[#383838] flex justify-end">
              <button
                type="button"
                onClick={() => setShowDiagnosticModal(false)}
                className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. Netlify Guide Modal                                                    */}
      {/* ========================================================================= */}
      {showNetlifyModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1f1f1f] border border-[#383838] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[#383838] flex items-center justify-between bg-[#191919]">
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-teal-400" />
                <span className="font-bold text-sm text-white">
                  {lang === 'ar' ? 'طريقة استضافة ونشر الموقع على Netlify' : 'How to Deploy on Netlify'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowNetlifyModal(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
              <div className="p-4 bg-teal-950/30 border border-teal-800/40 rounded-xl space-y-3">
                <span className="font-bold text-teal-300 text-sm flex items-center gap-1.5">
                  <span>⚡</span>
                  <span>{lang === 'ar' ? 'الربط المباشر عبر GitHub أو Netlify Drop' : 'Direct Deployment'}</span>
                </span>
                <p className="text-neutral-300 leading-relaxed">
                  {lang === 'ar'
                    ? 'المشروع مهيأ تماماً ليعمل كـ Single Page Application (SPA) فائقة السرعة على Netlify. عند ربط مستودع GitHub الخاص بك على Netlify، يتم البناء التلقائي عبر npm run build ونشر مجلد dist.'
                    : 'The app is fully optimized as a standalone SPA ready to deploy on Netlify with auto-builds.'}
                </p>
              </div>
            </div>

            <div className="p-3 bg-[#191919] border-t border-[#383838] flex justify-end">
              <button
                type="button"
                onClick={() => setShowNetlifyModal(false)}
                className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
