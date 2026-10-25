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
      <div className="bg-surface border border-stroke rounded-[4px] p-5">
        <div className="font-extrabold text-lg text-fg flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-brand" />
          <span>{lang === 'ar' ? 'الإعدادات العامة والربط السحابي وقوالب الرسائل' : 'Settings & Cloud Integration'}</span>
        </div>
        <p className="text-xs text-neutral-400 mt-1">
          {lang === 'ar'
            ? 'تخصيص اسم الصيدلية، ورابط مزامنة Google Sheet / Google Drive، وصيغ رسائل التذكير والمتابعة السريرية.'
            : 'Configure pharmacy branding, Google Sheet Web App endpoint, and customized WhatsApp & SMS messaging templates.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Pharmacy & Cloud */}
        <div className="bg-surface border border-stroke rounded-[4px] p-5 space-y-4">
          <div className="font-bold text-sm text-fg">
            {lang === 'ar' ? 'البيانات الأساسية والربط السحابي' : 'Basic & Cloud Configuration'}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300">
              {lang === 'ar' ? 'اسم الصيدلية أو المركز السريري' : 'Pharmacy / Clinic Brand Name'}
            </label>
            <input
              type="text"
              value={formData.pharmacyName}
              onChange={e => setFormData({ ...formData, pharmacyName: e.target.value })}
              className="w-full bg-canvas border border-stroke text-fg text-xs rounded-[4px] p-2.5 outline-none focus:border-brand"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <span>{lang === 'ar' ? 'رابط Google Apps Script Web App URL' : 'Google Apps Script Web App URL'}</span>
                <span className="px-1.5 py-0.5 rounded bg-brand-subtle0/20 text-brand text-[10px] font-mono">/exec</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowScriptModal(true)}
                  className="text-[11px] font-bold text-warning-fg hover:text-warning-fg hover:underline flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-warning-bg border border-warning-border transition-colors"
                >
                  <Code className="w-3.5 h-3.5 text-warning-fg" />
                  <span>{lang === 'ar' ? 'كود Apps Script السريع (Code.gs)' : 'Fast Apps Script & Guide'}</span>
                </button>

                {formData.gasUrl && (
                  <button
                    type="button"
                    onClick={handleRunDiagnostic}
                    disabled={isDiagnosing}
                    className="text-[11px] font-bold text-brand hover:text-brand flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-brand-subtle border border-brand hover:bg-brand-subtle transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isDiagnosing ? 'animate-spin' : ''}`} />
                    <span>{isDiagnosing ? (lang === 'ar' ? 'جارِ الفحص...' : 'Testing...') : (lang === 'ar' ? 'فحص واختبار الاتصال' : 'Test Sync')}</span>
                  </button>
                )}

                {formData.gasUrl && onPushLocalToSheet && (
                  <button
                    type="button"
                    onClick={onPushLocalToSheet}
                    className="text-[11px] font-bold text-success-fg hover:text-success-fg flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-success-bg border border-success-border hover:bg-success-bg transition-colors cursor-pointer"
                    title={lang === 'ar' ? 'رفع وتصدير السجلات المحلية لتزويد الشيت' : 'Push local records to Google Sheet'}
                  >
                    <Upload className="w-3.5 h-3.5 text-success-fg" />
                    <span>{lang === 'ar' ? 'تزويد الشيت محلياً' : 'Push Local Data'}</span>
                  </button>
                )}

                {formData.gasUrl && (
                  <button
                    type="button"
                    onClick={onResetDatabase}
                    className="text-[11px] font-bold text-critical-fg hover:text-critical-fg flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-critical-bg border border-critical-border hover:bg-critical-bg transition-colors cursor-pointer"
                    title={lang === 'ar' ? 'تفريغ قاعدة البيانات ومسح شيت Google Sheet' : 'Reset Database & Google Sheet'}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-critical-fg" />
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
                className={`w-full bg-canvas border text-fg text-xs rounded-[4px] p-2.5 font-mono outline-none transition-colors ${
                  formData.gasUrl && !urlValidation.isValid
                    ? 'border-warning-border focus:border-warning-border'
                    : 'border-stroke focus:border-brand'
                }`}
              />
              {formData.gasUrl && urlValidation.isValid && (
                <div className="absolute left-3 top-2.5 text-success-fg flex items-center gap-1 text-[11px]">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
            </div>

            {/* Smart Live Diagnostic Warnings */}
            {formData.gasUrl && !urlValidation.isValid && (
              <div className="p-3 rounded-[4px] bg-warning-bg border border-warning-border space-y-2 text-xs">
                <div className="flex items-start gap-2 text-warning-fg font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-warning-fg" />
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
                    className="mr-6 px-3 py-1 bg-warning-bg0 hover:bg-warning-bg text-black font-bold text-[11px] rounded transition-colors"
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
                className="text-brand hover:underline flex items-center gap-1 font-semibold"
              >
                <Download className="w-3 h-3" />
                <span>{lang === 'ar' ? 'تحميل ملف Code.gs' : 'Download Code.gs'}</span>
              </a>
            </div>
          </div>
        </div>

        {/* Messaging Templates */}
        <div className="bg-surface border border-stroke rounded-[4px] p-5 space-y-4">
          <div className="font-bold text-sm text-fg">
            {lang === 'ar' ? 'قوالب الرسائل المخصصة (WhatsApp & SMS Templates)' : 'Automated Messaging Templates'}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300">
              {lang === 'ar' ? 'قالب تذكير صرف العلاج المزمن (WhatsApp)' : 'Chronic Refill Reminder Template (WhatsApp)'}
            </label>
            <textarea
              rows={3}
              value={formData.waTemplate}
              onChange={e => setFormData({ ...formData, waTemplate: e.target.value })}
              className="w-full bg-canvas border border-stroke text-fg text-xs rounded-[4px] p-2.5 outline-none focus:border-brand leading-relaxed"
            />
            <div className="text-[10px] text-neutral-400">
              {lang === 'ar' ? 'المتغيرات المتاحة: {name}, {pharmacy}, {drug}, {date}' : 'Variables: {name}, {pharmacy}, {drug}, {date}'}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300">
              {lang === 'ar' ? 'قالب متابعة كورس المضاد الحيوي (Antibiotic Stewardship Check-in)' : 'Antibiotic Stewardship Check-in'}
            </label>
            <textarea
              rows={3}
              value={formData.waAbxTemplate}
              onChange={e => setFormData({ ...formData, waAbxTemplate: e.target.value })}
              className="w-full bg-canvas border border-stroke text-fg text-xs rounded-[4px] p-2.5 outline-none focus:border-brand leading-relaxed"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300">
              {lang === 'ar' ? 'قالب متابعة العلاج المزمن الجديد (Chronic Milestones Check-in)' : 'Chronic Therapy Milestone Check-in'}
            </label>
            <textarea
              rows={3}
              value={formData.waChronicFollowTemplate}
              onChange={e => setFormData({ ...formData, waChronicFollowTemplate: e.target.value })}
              className="w-full bg-canvas border border-stroke text-fg text-xs rounded-[4px] p-2.5 outline-none focus:border-brand leading-relaxed"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300">
              {lang === 'ar' ? 'قالب الرسائل النصية القصيرة (SMS Reminder Template)' : 'SMS Text Template'}
            </label>
            <textarea
              rows={2}
              value={formData.smsTemplate}
              onChange={e => setFormData({ ...formData, smsTemplate: e.target.value })}
              className="w-full bg-canvas border border-stroke text-fg text-xs rounded-[4px] p-2.5 outline-none focus:border-brand leading-relaxed"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 rounded-[4px] bg-brand hover:bg-brand-hover text-on-brand font-bold text-xs transition-colors cursor-pointer"
          >
            {savedSuccess ? <Check className="w-4 h-4 text-success-fg" /> : <Save className="w-4 h-4" />}
            <span>{savedSuccess ? (lang === 'ar' ? 'تم الحفظ بنجاح!' : 'Saved!') : (lang === 'ar' ? 'حفظ كافة الإعدادات' : 'Save Settings')}</span>
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onExportBackup}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[4px] bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'تصدير نسخة احتياطية (JSON)' : 'Export JSON Backup'}</span>
            </button>

            <label className="flex items-center gap-1.5 px-3 py-2 rounded-[4px] bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-semibold transition-colors cursor-pointer">
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
              className="flex items-center gap-1.5 px-3 py-2 rounded-[4px] bg-critical-bg hover:bg-critical-bg text-critical-fg border border-critical-border text-xs font-semibold transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'تفريغ ومسح كافة البيانات' : 'Reset & Empty Database'}</span>
            </button>
          </div>
        </div>

        {/* Netlify Deployment Section */}
        <div className="bg-surface border border-stroke rounded-[4px] p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-[4px] bg-teal-500/10 border border-teal-500/30 text-teal-400">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-sm text-fg flex items-center gap-2">
                  <span>{lang === 'ar' ? 'نشر الموقع واستضافته على Netlify مجاناً' : 'Deploy & Host on Netlify'}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-[4px] bg-teal-500/20 text-teal-300 border border-teal-500/30 font-bold">
                    {lang === 'ar' ? 'جاهز للنشر بنقرة واحدة' : 'Production Ready'}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
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
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-[4px] bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-semibold transition-colors"
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
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-surface border border-stroke rounded-[4px] w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-stroke flex items-center justify-between bg-canvas">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-[4px] bg-warning-bg0/10 border border-warning-border text-warning-fg">
                  <Code className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-extrabold text-sm text-fg flex items-center gap-2">
                    <span>{lang === 'ar' ? 'كود Google Apps Script السريع (Code.gs)' : 'Fast Google Apps Script Backend (Code.gs)'}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-success-bg0/20 text-success-fg font-bold border border-success-border">
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
                className="p-1.5 rounded-[4px] text-neutral-400 hover:text-fg hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center border-b border-stroke bg-surface px-4 gap-2">
              <button
                type="button"
                onClick={() => setScriptModalTab('code')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
                  scriptModalTab === 'code'
                    ? 'border-warning-border text-warning-fg bg-warning-bg0/5'
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
                    ? 'border-brand text-brand bg-brand-subtle0/5'
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
                    ? 'border-success-border text-success-fg bg-success-bg0/5'
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
                  <div className="flex items-center justify-between flex-wrap gap-2 p-3 rounded-[4px] bg-neutral-900 border border-neutral-800">
                    <div className="flex items-center gap-2 text-neutral-300">
                      <span className="font-semibold">{lang === 'ar' ? 'الملف:' : 'File:'}</span>
                      <code className="text-warning-fg font-mono font-bold bg-black/40 px-2 py-0.5 rounded">Code.gs</code>
                      <span className="text-success-fg font-semibold">• سريع وخفيف جداً</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href="/download/Code.gs"
                        download="Code.gs"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-success-bg hover:bg-success-bg text-fg font-bold text-xs shadow transition-colors"
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
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[4px] bg-blue-600 hover:bg-brand-subtle0 text-fg font-bold text-xs shadow transition-colors cursor-pointer"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5 text-success-fg" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedCode ? (lang === 'ar' ? 'تم نسخ الكود!' : 'Copied!') : (lang === 'ar' ? 'نسخ الكود' : 'Copy Code')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Code Container */}
                  <div className="relative border border-stroke rounded-[4px] overflow-hidden bg-canvas">
                    <pre className="p-4 text-[11px] font-mono text-success-fg overflow-x-auto max-h-[500px] leading-relaxed selection:bg-success-bg selection:text-fg">
                      {APPS_SCRIPT_CODE}
                    </pre>
                  </div>
                </div>
              )}

              {scriptModalTab === 'instructions' && (
                <div className="space-y-4 text-neutral-200">
                  <div className="p-4 rounded-[4px] bg-brand-subtle border border-brand space-y-2">
                    <div className="font-bold text-brand text-sm flex items-center gap-2">
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
                    <div className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-[4px] space-y-1">
                      <div className="font-bold text-fg flex items-center gap-2">
                        <span className="w-5 h-5 rounded-[4px] bg-blue-600 text-fg text-[11px] flex items-center justify-center font-bold">1</span>
                        <span>{lang === 'ar' ? 'افتح جدول Google Sheet:' : 'Open Google Sheet:'}</span>
                      </div>
                      <p className="text-neutral-400 text-xs mr-7">
                        {lang === 'ar'
                          ? 'افتح جدول بيانات جديد من sheets.new، أو استخدم جدولك الحالي.'
                          : 'Open a new Google Sheet at sheets.new or use an existing one.'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-[4px] space-y-1">
                      <div className="font-bold text-fg flex items-center gap-2">
                        <span className="w-5 h-5 rounded-[4px] bg-blue-600 text-fg text-[11px] flex items-center justify-center font-bold">2</span>
                        <span>{lang === 'ar' ? 'افتح محرر Apps Script:' : 'Open Apps Script:'}</span>
                      </div>
                      <p className="text-neutral-400 text-xs mr-7">
                        {lang === 'ar'
                          ? 'من القائمة العلوية داخل الشيت، اضغط على: الامتدادات (Extensions) > Apps Script.'
                          : 'In Google Sheets top menu, click Extensions > Apps Script.'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-[4px] space-y-1">
                      <div className="font-bold text-fg flex items-center gap-2">
                        <span className="w-5 h-5 rounded-[4px] bg-blue-600 text-fg text-[11px] flex items-center justify-center font-bold">3</span>
                        <span>{lang === 'ar' ? 'لصق الكود وحفظه:' : 'Paste & Save Code:'}</span>
                      </div>
                      <p className="text-neutral-400 text-xs mr-7">
                        {lang === 'ar'
                          ? 'احذف أي كود موجود في Code.gs، والصق الكود من التبويب السابق، ثم اضغط على زر الحفظ (💾).'
                          : 'Replace code in Code.gs with this code and save (💾).'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-warning-bg border border-warning-border rounded-[4px] space-y-2">
                      <div className="font-bold text-warning-fg flex items-center gap-2">
                        <span className="w-5 h-5 rounded-[4px] bg-warning-bg0 text-black text-[11px] flex items-center justify-center font-bold">4</span>
                        <span>{lang === 'ar' ? 'نشر تطبيق الويب (New Deployment):' : 'Deploy as Web App:'}</span>
                      </div>
                      <div className="mr-7 space-y-1.5 text-neutral-300 text-xs">
                        <p>• اضغط في أعلى اليمين على <strong>Deploy (نشر)</strong> &gt; <strong>New deployment (نشر جديد)</strong>.</p>
                        <p>• اختر <strong>Web app (تطبيق ويب)</strong>.</p>
                        <p>• في <strong>Execute as</strong> اختر: <strong className="text-fg">Me (أنا)</strong>.</p>
                        <p className="p-2 rounded bg-warning-bg0/20 border border-warning-border text-warning-fg font-bold">
                          ⚠️ في خانة "Who has access" اختر: "Anyone" (أي شخص).
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-[4px] space-y-1">
                      <div className="font-bold text-fg flex items-center gap-2">
                        <span className="w-5 h-5 rounded-[4px] bg-blue-600 text-fg text-[11px] flex items-center justify-center font-bold">5</span>
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
                  <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-[4px] space-y-2">
                    <div className="font-bold text-warning-fg flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{lang === 'ar' ? 'تأكد من اختيار "Anyone" عند النشر' : 'Ensure Access is set to Anyone'}</span>
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed">
                      {lang === 'ar'
                        ? 'إذا اخترت "Only myself" لن يتمكن الموقع من التواصل مع الشيت. تأكد من ضبط Who has access على Anyone.'
                        : 'Who has access must be set to Anyone.'}
                    </p>
                  </div>

                  <div className="p-4 bg-success-bg border border-success-border rounded-[4px] space-y-2">
                    <div className="font-bold text-success-fg flex items-center gap-2">
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
            <div className="p-3 bg-canvas border-t border-stroke flex items-center justify-between">
              <a
                href="/download/Code.gs"
                download="Code.gs"
                className="px-3.5 py-1.5 rounded-[4px] bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'تحميل ملف Code.gs' : 'Download Code.gs'}</span>
              </a>

              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                className="px-5 py-1.5 rounded-[4px] bg-blue-600 hover:bg-brand-subtle0 text-fg text-xs font-bold transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-surface border border-stroke rounded-[4px] w-full max-w-xl overflow-hidden">
            <div className="p-4 border-b border-stroke flex items-center justify-between bg-surface">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-brand" />
                <span className="font-bold text-sm text-fg">
                  {lang === 'ar' ? 'تقرير فحص وتشخيص الاتصال السحابي' : 'Cloud Connection Diagnostics Report'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowDiagnosticModal(false)}
                className="p-1 rounded-[4px] text-neutral-400 hover:text-fg hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {isDiagnosing ? (
                <div className="py-8 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-brand animate-spin mx-auto" />
                  <div className="font-bold text-fg text-sm">
                    {lang === 'ar' ? 'جارِ فحص الاتصال بالخادم السحابي...' : 'Testing Cloud Connection...'}
                  </div>
                  <p className="text-neutral-400 text-xs">
                    {lang === 'ar' ? 'يتم اختبار الاستجابة والصلاحيات وقراءة السجلات.' : 'Verifying endpoint handshake and permissions.'}
                  </p>
                </div>
              ) : diagnosticResult ? (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div className={`p-4 rounded-[4px] border flex items-start gap-3 ${
                    diagnosticResult.success
                      ? 'bg-success-bg border-success-border text-success-fg'
                      : 'bg-critical-bg border-critical-border text-critical-fg'
                  }`}>
                    {diagnosticResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-success-fg shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-critical-fg shrink-0 mt-0.5" />
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
                  <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-[4px] space-y-2 font-mono text-[11px]">
                    <div className="flex items-center justify-between text-neutral-300">
                      <span className="text-neutral-500">صيغة الرابط (URL Format):</span>
                      <span className={urlValidation.isValid ? 'text-success-fg font-bold' : 'text-warning-fg font-bold'}>
                        {urlValidation.isValid ? 'صحيح (Valid /exec)' : 'يحتاج مراجعة'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-neutral-300">
                      <span className="text-neutral-500">حالة الاستجابة (Handshake):</span>
                      <span className={diagnosticResult.success ? 'text-success-fg font-bold' : 'text-critical-fg font-bold'}>
                        {diagnosticResult.success ? '200 OK (متصل)' : 'فشل الاتصال'}
                      </span>
                    </div>

                    {diagnosticResult.patientsCount !== undefined && (
                      <div className="flex items-center justify-between text-neutral-300">
                        <span className="text-neutral-500">سجلات المرضى في الشيت:</span>
                        <span className="text-brand font-bold">{diagnosticResult.patientsCount} مريض</span>
                      </div>
                    )}

                    {diagnosticResult.followUpsCount !== undefined && (
                      <div className="flex items-center justify-between text-neutral-300">
                        <span className="text-neutral-500">المتابعات السريرية:</span>
                        <span className="text-brand font-bold">{diagnosticResult.followUpsCount} متابعة</span>
                      </div>
                    )}

                    {diagnosticResult.spreadsheetName && (
                      <div className="flex items-center justify-between text-neutral-300">
                        <span className="text-neutral-500">اسم جدول البيانات:</span>
                        <span className="text-success-fg font-bold">{diagnosticResult.spreadsheetName}</span>
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
                        className="px-3.5 py-2 rounded-[4px] bg-warning-bg hover:bg-warning-bg0 text-black font-bold text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <HelpCircle className="w-4 h-4" />
                        <span>{lang === 'ar' ? 'عرض حلول المشكلات في الدليل' : 'View Troubleshooting'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRunDiagnostic}
                        className="px-4 py-2 rounded-[4px] bg-neutral-800 hover:bg-neutral-700 text-fg font-semibold text-xs"
                      >
                        {lang === 'ar' ? 'إعادة الفحص' : 'Retry'}
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="p-3 bg-surface border-t border-stroke flex justify-end">
              <button
                type="button"
                onClick={() => setShowDiagnosticModal(false)}
                className="px-4 py-1.5 rounded-[4px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold"
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
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-surface border border-stroke rounded-[4px] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-stroke flex items-center justify-between bg-surface">
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-teal-400" />
                <span className="font-bold text-sm text-fg">
                  {lang === 'ar' ? 'طريقة استضافة ونشر الموقع على Netlify' : 'How to Deploy on Netlify'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowNetlifyModal(false)}
                className="p-1 rounded-[4px] text-neutral-400 hover:text-fg hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
              <div className="p-4 bg-teal-950/30 border border-teal-800/40 rounded-[4px] space-y-3">
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

            <div className="p-3 bg-surface border-t border-stroke flex justify-end">
              <button
                type="button"
                onClick={() => setShowNetlifyModal(false)}
                className="px-4 py-1.5 rounded-[4px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold"
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
