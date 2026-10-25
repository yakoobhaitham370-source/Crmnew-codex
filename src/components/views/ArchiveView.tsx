import React from 'react';
import { Archive, RotateCcw } from 'lucide-react';
import { Patient } from '../../types/pharmacy';

interface ArchiveViewProps {
  patients: Patient[];
  lang: 'ar' | 'en';
  onRestorePatient: (patientId: string) => void;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({
  patients,
  lang,
  onRestorePatient,
}) => {
  const archived = patients.filter(p => p.isArchived);

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-stroke rounded-[4px] p-5 space-y-2">
        <div className="font-extrabold text-lg text-fg flex items-center gap-2">
          <Archive className="w-5 h-5 text-neutral-400" />
          <span>{lang === 'ar' ? 'سجل المرضى المؤرشفين' : 'Archived Patients Archive'}</span>
        </div>
        <p className="text-xs text-neutral-400">
          {lang === 'ar'
            ? 'الملفات التي تم تعطيلها مؤقتاً أو نقلها إلى الأرشيف مع إمكانية استعادتها بجميع سجلاتها بضغطة واحدة.'
            : 'Patients marked as inactive or archived. Can be restored anytime with all past vitals and regimens intact.'}
        </p>
      </div>

      <div className="bg-surface border border-stroke rounded-[4px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right dir-rtl text-xs">
            <thead className="bg-subtle text-neutral-300 font-bold border-b border-stroke">
              <tr>
                <th className="py-3 px-4">{lang === 'ar' ? 'المريض' : 'Patient'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'الهاتف' : 'Phone'}</th>
                <th className="py-3 px-4">{lang === 'ar' ? 'سبب الأرشفة' : 'Reason'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'تاريخ الأرشفة' : 'Archived Date'}</th>
                <th className="py-3 px-4 text-center">{lang === 'ar' ? 'استعادة' : 'Restore'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke text-neutral-200">
              {archived.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-neutral-400">
                    {lang === 'ar' ? 'الأرشيف فارغ حالياً.' : 'Archive is empty.'}
                  </td>
                </tr>
              ) : (
                archived.map(p => (
                  <tr key={p.id} className="hover:bg-neutral-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-fg">{p.name}</td>
                    <td className="py-3.5 px-3 font-mono text-neutral-400">{p.phone}</td>
                    <td className="py-3.5 px-4 text-neutral-300">{p.archiveReason || (lang === 'ar' ? 'تحويل إلى الأرشيف' : 'Archived')}</td>
                    <td className="py-3.5 px-3 font-mono text-neutral-400">{p.archivedDate || '—'}</td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => onRestorePatient(p.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-neutral-800 hover:bg-neutral-700 text-success-fg hover:text-success-fg border border-neutral-700 font-bold transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'استعادة الملف' : 'Restore'}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
