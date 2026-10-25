import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  FileText,
  Archive,
  Star,
  Filter,
  Download,
  Phone,
  LineChart,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { Patient } from '../../types/pharmacy';
import { calculatePDC } from '../../utils/pharmacyCalculations';
import { useDebounce } from '../../utils/useDebounce';

interface PatientsViewProps {
  patients: Patient[];
  lang: 'ar' | 'en';
  onOpenPatientModal: (patientId?: string, tab?: string) => void;
  onOpenHouseholdModal: (familyTag: string) => void;
  onArchivePatient: (patientId: string) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  // Global search props
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onClearSearch?: () => void;
  debouncedSearchQuery?: string;
}

export const PatientsView: React.FC<PatientsViewProps> = ({
  patients,
  lang,
  onOpenPatientModal,
  onOpenHouseholdModal,
  onArchivePatient,
  onShowToast,
  searchQuery,
  onSearchChange,
  onClearSearch,
  debouncedSearchQuery: externalDebouncedQuery,
}) => {
  const [localSearch, setLocalSearch] = useState('');
  const debouncedLocal = useDebounce(localSearch, 200);

  const effectiveSearch = searchQuery !== undefined ? searchQuery : localSearch;
  const effectiveDebouncedSearch =
    externalDebouncedQuery !== undefined ? externalDebouncedQuery : debouncedLocal;

  const handleSearchInput = (val: string) => {
    if (onSearchChange) {
      onSearchChange(val);
    } else {
      setLocalSearch(val);
    }
  };

  const handleClear = () => {
    if (onClearSearch) {
      onClearSearch();
    } else {
      setLocalSearch('');
    }
  };

  const [familyFilter, setFamilyFilter] = useState('ALL');
  const [adherenceFilter, setAdherenceFilter] = useState('ALL');

  // Pagination state
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const activePatients = useMemo(() => patients.filter(p => !p.isArchived), [patients]);

  const uniqueFamilies = useMemo(() => {
    const set = new Set<string>();
    activePatients.forEach(p => {
      if (p.familyTag && p.familyTag.trim()) set.add(p.familyTag.trim());
    });
    return Array.from(set);
  }, [activePatients]);

  const filteredPatients = useMemo(() => {
    const q = effectiveDebouncedSearch.toLowerCase().trim();
    const digitsOnly = q.replace(/\D/g, '');

    return activePatients.filter(p => {
      const phoneRaw = p.phone || '';
      const phoneDigits = phoneRaw.replace(/\D/g, '');
      const matchPhone =
        phoneRaw.toLowerCase().includes(q) ||
        (digitsOnly.length >= 2 && phoneDigits.includes(digitsOnly));

      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        matchPhone ||
        p.id.toLowerCase().includes(q) ||
        (p.familyTag && p.familyTag.toLowerCase().includes(q)) ||
        (p.notes && p.notes.toLowerCase().includes(q)) ||
        (p.allergies && p.allergies.toLowerCase().includes(q)) ||
        (p.medications || []).some(m => m.name.toLowerCase().includes(q));

      const matchFamily =
        familyFilter === 'ALL' ||
        (familyFilter === 'NO_FAMILY' && !p.familyTag) ||
        p.familyTag === familyFilter;

      const pdc = calculatePDC(p);
      const matchAdherence =
        adherenceFilter === 'ALL' ||
        (adherenceFilter === 'HIGH' && pdc >= 80) ||
        (adherenceFilter === 'LOW' && pdc < 80);

      return matchSearch && matchFamily && matchAdherence;
    });
  }, [activePatients, effectiveDebouncedSearch, familyFilter, adherenceFilter]);

  // Reset to first page when query or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [effectiveDebouncedSearch, familyFilter, adherenceFilter, pageSize]);

  // Total pages and sliced window
  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(filteredPatients.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedPatients = useMemo(() => {
    if (pageSize === -1) return filteredPatients;
    const startIdx = (validCurrentPage - 1) * pageSize;
    return filteredPatients.slice(startIdx, startIdx + pageSize);
  }, [filteredPatients, validCurrentPage, pageSize]);

  const startRecord = filteredPatients.length === 0 ? 0 : (validCurrentPage - 1) * (pageSize === -1 ? filteredPatients.length : pageSize) + 1;
  const endRecord = pageSize === -1 ? filteredPatients.length : Math.min(validCurrentPage * pageSize, filteredPatients.length);

  const handleExportCSV = () => {
    const headers = ['ID,Name,Phone,FamilyTag,Age,LoyaltyPoints,PDC,MedicationsCount'];
    const rows = filteredPatients.map(p =>
      `"${p.id}","${p.name}","${p.phone}","${p.familyTag || ''}","${p.age || ''}","${p.loyaltyPoints || 0}","${calculatePDC(p)}%","${(p.medications || []).length}"`
    );
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PharmPulse_Patients_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    onShowToast(lang === 'ar' ? 'تم تصدير سجل المرضى إلى ملف CSV' : 'Exported patients CSV', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-surface border border-stroke rounded-[4px] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="font-extrabold text-lg text-fg flex items-center gap-2">
              <Users className="w-5 h-5 text-brand" />
              <span>{lang === 'ar' ? 'دليل المرضى وسجلات العوائل المشتركة' : 'Patients Directory & Family Registry'}</span>
            </div>
            <div className="text-xs text-neutral-400 mt-1">
              {lang === 'ar'
                ? `إجمالي ${activePatients.length} ملف نشط، مقسمين على ${uniqueFamilies.length} عائلة مسجلة`
                : `${activePatients.length} active chronic patients across ${uniqueFamilies.length} families`}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'تصدير CSV' : 'Export CSV'}</span>
            </button>
            <button
              onClick={() => onOpenPatientModal()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[4px] text-xs font-bold bg-brand hover:bg-brand-hover text-on-brand transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'ar' ? 'تسجيل مريض جديد' : 'New Patient'}</span>
            </button>
          </div>
        </div>

        {/* Filter controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute right-3 top-3 pointer-events-none" />
            <input
              type="text"
              value={effectiveSearch}
              onChange={e => handleSearchInput(e.target.value)}
              placeholder={lang === 'ar' ? 'بحث بالاسم، الهاتف، التشخيص، الدواء...' : 'Search name, phone, diagnosis, drug...'}
              className="w-full bg-canvas border border-stroke text-fg text-xs rounded-[4px] px-8 py-2.5 outline-none focus:border-brand pr-9"
            />
            {effectiveSearch && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute left-3 top-3 text-neutral-400 hover:text-fg transition-colors cursor-pointer"
                title={lang === 'ar' ? 'مسح البحث' : 'Clear search'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Family Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-neutral-400 shrink-0" />
            <select
              value={familyFilter}
              onChange={e => setFamilyFilter(e.target.value)}
              className="w-full bg-canvas border border-stroke text-fg text-xs rounded-[4px] p-2.5 outline-none focus:border-brand"
            >
              <option value="ALL">{lang === 'ar' ? 'كل العوائل والأفراد' : 'All Families'}</option>
              <option value="NO_FAMILY">{lang === 'ar' ? 'المرضى بدون عائلة مسجلة' : 'Individual (No family)'}</option>
              {uniqueFamilies.map(f => (
                <option key={f} value={f}>
                  👨‍👩‍👧‍👦 {f}
                </option>
              ))}
            </select>
          </div>

          {/* Adherence Filter */}
          <select
            value={adherenceFilter}
            onChange={e => setAdherenceFilter(e.target.value)}
            className="w-full bg-canvas border border-stroke text-fg text-xs rounded-[4px] p-2.5 outline-none focus:border-brand"
          >
            <option value="ALL">{lang === 'ar' ? 'جميع مستويات الالتزام' : 'All Adherence Levels'}</option>
            <option value="HIGH">{lang === 'ar' ? 'ملتزمون ممتازون (PDC ≥ 80%)' : 'High Adherence (≥80%)'}</option>
            <option value="LOW">{lang === 'ar' ? 'معرضون للخطر (PDC < 80%)' : 'Low Adherence (<80%)'}</option>
          </select>
        </div>
      </div>

      {/* Active Search Filter Banner */}
      {effectiveDebouncedSearch.trim() && (
        <div className="bg-brand-subtle border border-brand rounded-[4px] px-4 py-2.5 flex items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2 text-brand font-medium">
            <Search className="w-4 h-4 text-brand shrink-0" />
            <span>
              {lang === 'ar'
                ? `تصفية نشطة للبحث عن: «${effectiveDebouncedSearch}» (${filteredPatients.length} مريض مطابق)`
                : `Active filter for: "${effectiveDebouncedSearch}" (${filteredPatients.length} matching)`}
            </span>
          </div>
          <button
            onClick={handleClear}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-brand-subtle hover:bg-brand-subtle text-brand border border-brand text-[11px] font-bold transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
            <span>{lang === 'ar' ? 'إلغاء التصفية' : 'Clear Filter'}</span>
          </button>
        </div>
      )}

      {/* Patients Table */}
      <div className="bg-surface border border-stroke rounded-[4px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right dir-rtl text-xs">
            <thead className="bg-subtle text-neutral-300 font-bold border-b border-stroke">
              <tr>
                <th className="py-3 px-4">{lang === 'ar' ? 'المعرف' : 'ID'}</th>
                <th className="py-3 px-4">{lang === 'ar' ? 'اسم المريض' : 'Patient Name'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'العمر / الجنس' : 'Age / Sex'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'رمز العائلة' : 'Family Tag'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'الهاتف' : 'Phone'}</th>
                <th className="py-3 px-4">{lang === 'ar' ? 'الأدوية النشطة' : 'Active Meds'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'الالتزام (PDC)' : 'Adherence'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'نقاط الولاء' : 'Loyalty'}</th>
                <th className="py-3 px-4 text-center">{lang === 'ar' ? 'إدارة الملف' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke text-neutral-200">
              {activePatients.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-14 text-neutral-400">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-[4px] bg-brand-subtle text-brand border border-brand flex items-center justify-center mx-auto shadow-inner">
                        <Users className="w-6 h-6" />
                      </div>
                      <div className="font-bold text-sm text-fg">
                        {lang === 'ar' ? 'دليل المرضى فارغ حالياً' : 'Patient Directory is Empty'}
                      </div>
                      <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
                        {lang === 'ar'
                          ? 'تم حذف البيانات النموذجية التجريبية بنجاح. يمكنك الآن البدء بتسجيل أول مريض حقيقي في الصيدلية.'
                          : 'Sample demo records have been removed. You can now register your first patient.'}
                      </p>
                      <button
                        onClick={() => onOpenPatientModal()}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-[4px] text-xs font-bold bg-brand hover:bg-brand-hover text-on-brand transition-colors duration-150 cursor-pointer mt-1"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{lang === 'ar' ? 'تسجيل مريض جديد الآن' : 'Add First Patient Now'}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-neutral-400">
                    {lang === 'ar' ? 'لا يوجد مرضى مطابقين لشروط البحث.' : 'No matching patients found.'}
                  </td>
                </tr>
              ) : (
                paginatedPatients.map(p => {
                  const pdc = calculatePDC(p);
                  return (
                    <tr key={p.id} className="hover:bg-neutral-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-neutral-400 text-[11px]">{p.id}</td>
                      <td className="py-3 px-4 font-bold text-fg">
                        <button
                          onClick={() => onOpenPatientModal(p.id)}
                          className="hover:text-brand text-right hover:underline transition-colors cursor-pointer"
                        >
                          {p.name}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-neutral-300">
                        {p.age ? `${p.age} سنة` : '—'} / {p.gender || '—'}
                      </td>
                      <td className="py-3 px-3">
                        {p.familyTag ? (
                          <button
                            onClick={() => onOpenHouseholdModal(p.familyTag!)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[11px] font-bold bg-brand-subtle text-brand border border-brand hover:bg-brand-subtle transition-colors cursor-pointer"
                          >
                            <span>👨‍👩‍👧‍👦</span>
                            <span>{p.familyTag}</span>
                          </button>
                        ) : (
                          <span className="text-neutral-500 text-[11px]">فردي</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-neutral-300">
                        {p.phone}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-fg">
                          {(p.medications || []).length} {lang === 'ar' ? 'أدوية' : 'meds'}
                        </span>
                        <div className="text-[11px] text-neutral-400 truncate max-w-[200px]">
                          {(p.medications || []).map(m => m.name).join(', ')}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block font-extrabold px-2 py-0.5 rounded text-[11px] ${
                            pdc >= 80
                              ? 'bg-success-bg text-success-fg border border-success-border'
                              : 'bg-critical-bg text-critical-fg border border-critical-border'
                          }`}
                        >
                          {pdc}%
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 font-bold text-warning-fg bg-warning-bg border border-warning-border px-2 py-0.5 rounded text-[11px]">
                          <Star className="w-3 h-3 fill-amber-400" />
                          <span>{p.loyaltyPoints || 0}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onOpenPatientModal(p.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-[4px] bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors font-semibold cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'الملف' : 'Dossier'}</span>
                          </button>
                          <button
                            onClick={() => onOpenPatientModal(p.id, 'analytics')}
                            title={lang === 'ar' ? 'عرض مخطط الالتزام والمؤشرات الحيوية' : 'View Adherence & Vitals Chart'}
                            className="p-1.5 rounded-[4px] bg-brand-subtle hover:bg-brand-subtle text-brand border border-brand transition-colors cursor-pointer"
                          >
                            <LineChart className="w-3.5 h-3.5 text-brand" />
                          </button>
                          {p.familyTag && (
                            <button
                              onClick={() => onOpenHouseholdModal(p.familyTag!)}
                              title={lang === 'ar' ? 'توحيد صرف العائلة' : 'Household Sync'}
                              className="p-1.5 rounded-[4px] bg-brand-subtle text-brand border border-brand hover:bg-brand-subtle transition-colors cursor-pointer"
                            >
                              👨‍👩‍👧‍👦
                            </button>
                          )}
                          <button
                            onClick={() => onArchivePatient(p.id)}
                            title={lang === 'ar' ? 'تحويل للأرشيف' : 'Archive'}
                            className="p-1.5 rounded-[4px] bg-neutral-800 text-neutral-400 hover:text-critical-fg border border-neutral-700 transition-colors cursor-pointer"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* High-Performance Pagination Footer */}
        {filteredPatients.length > 0 && (
          <div className="bg-subtle border-t border-stroke px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            {/* Range Counter & Page Size Selector */}
            <div className="flex items-center gap-3 text-neutral-300 flex-wrap">
              <span>
                {lang === 'ar'
                  ? `عرض ${startRecord} - ${endRecord} من إجمالي ${filteredPatients.length} مريض`
                  : `Showing ${startRecord}-${endRecord} of ${filteredPatients.length} patients`}
              </span>

              <div className="flex items-center gap-1.5 bg-surface border border-stroke rounded px-2 py-0.5">
                <span className="text-[11px] text-neutral-400">{lang === 'ar' ? 'لكل صفحة:' : 'Per page:'}</span>
                <select
                  value={pageSize}
                  onChange={e => setPageSize(Number(e.target.value))}
                  className="bg-transparent text-fg text-xs font-semibold outline-none cursor-pointer"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={-1}>{lang === 'ar' ? 'الكل (All)' : 'All'}</option>
                </select>
              </div>
            </div>

            {/* Page Buttons */}
            {pageSize !== -1 && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={validCurrentPage <= 1}
                  className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed border border-neutral-700 cursor-pointer transition-colors"
                  title={lang === 'ar' ? 'الصفحة الأولى' : 'First page'}
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={validCurrentPage <= 1}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed border border-neutral-700 font-semibold cursor-pointer transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'السابق' : 'Prev'}</span>
                </button>

                {/* Page Jump Selector */}
                <div className="flex items-center gap-1 px-2 font-bold text-neutral-300">
                  <span>{validCurrentPage}</span>
                  <span className="text-neutral-500">/</span>
                  <span>{totalPages}</span>
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={validCurrentPage >= totalPages}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed border border-neutral-700 font-semibold cursor-pointer transition-colors"
                >
                  <span>{lang === 'ar' ? 'التالي' : 'Next'}</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={validCurrentPage >= totalPages}
                  className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed border border-neutral-700 cursor-pointer transition-colors"
                  title={lang === 'ar' ? 'الصفحة الأخيرة' : 'Last page'}
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
