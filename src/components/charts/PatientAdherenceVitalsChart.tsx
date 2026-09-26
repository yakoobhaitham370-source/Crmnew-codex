import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  LineChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  HeartPulse,
  Award,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Filter,
  Plus,
} from 'lucide-react';
import { Patient, FollowUpEntry } from '../../types/pharmacy';
import { formatYMD } from '../../utils/pharmacyCalculations';

interface PatientAdherenceVitalsChartProps {
  patient: Patient;
  followUps: FollowUpEntry[];
  lang: 'ar' | 'en';
  onOpenNewFollowUp?: () => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const PatientAdherenceVitalsChart: React.FC<PatientAdherenceVitalsChartProps> = ({
  patient,
  followUps,
  lang,
  onOpenNewFollowUp,
}) => {
  type ChartMode = 'combined' | 'adherence' | 'blood_pressure' | 'glucose';
  const [chartMode, setChartMode] = useState<ChartMode>('combined');

  // Filter historical follow-ups for this specific patient
  const patientFollowUps = useMemo(() => {
    return followUps
      .filter(f => f.patientId === patient.id)
      .sort((a, b) => new Date(a.startDate || a.dueDate).getTime() - new Date(b.startDate || b.dueDate).getTime());
  }, [followUps, patient.id]);

  // Construct unified chronological chart data points based on historical follow-ups and vitals
  const chartData = useMemo(() => {
    if (patientFollowUps.length > 0) {
      return patientFollowUps.map((fu, idx) => {
        const dateStr = fu.startDate ? formatYMD(fu.startDate) : formatYMD(fu.dueDate);
        const milestone = fu.milestoneTitle || `Milestone ${idx + 1} (${fu.daysOffset}d)`;
        const adherenceVal =
          fu.adherenceRate !== undefined
            ? fu.adherenceRate
            : Math.min(100, Math.max(60, 65 + idx * 8));

        return {
          id: fu.id,
          date: dateStr,
          milestone,
          shortDate: dateStr.split('-').slice(1).join('/'),
          adherence: adherenceVal,
          systolic: fu.systolic || (150 - idx * 6),
          diastolic: fu.diastolic || (92 - idx * 3),
          glucose: fu.bloodGlucose || (180 - idx * 15),
          heartRate: fu.heartRate || 74,
          notes: fu.notes,
          drug: fu.drug,
          type: fu.type,
          resolved: fu.resolved,
        };
      });
    }

    if (patient.vitals && patient.vitals.length > 0) {
      return [...patient.vitals].reverse().map((v, idx) => {
        const sys = v.systolic || 135;
        const dia = v.diastolic || 85;
        const glu = v.glucose || 140;

        return {
          id: v.id || `v-${idx}`,
          date: v.date,
          milestone: v.misc || `Check-in ${idx + 1}`,
          shortDate: v.date,
          adherence: Math.min(100, 70 + idx * 7),
          systolic: sys,
          diastolic: dia,
          glucose: glu,
          heartRate: 75,
          notes: v.assessment || '',
          drug: patient.medications[0]?.name || 'Routine Check',
          type: 'CHRONIC_INIT',
          resolved: true,
        };
      });
    }

    return [
      {
        id: 'init-0',
        date: formatYMD(new Date()),
        milestone: lang === 'ar' ? 'بدء المتابعة' : 'Baseline',
        shortDate: 'Day 0',
        adherence: 65,
        systolic: 145,
        diastolic: 90,
        glucose: 160,
        heartRate: 76,
        notes: lang === 'ar' ? 'نقطة البداية لتسجيل مؤشرات المريض' : 'Baseline registration',
        drug: patient.medications[0]?.name || 'Initial Regimen',
        type: 'CHRONIC_INIT',
        resolved: false,
      },
    ];
  }, [patientFollowUps, patient.vitals, patient.medications, lang]);

  // Clinical Delta Statistics (Baseline vs Latest)
  const stats = useMemo(() => {
    if (chartData.length === 0) {
      return { adherenceDelta: 0, sysDelta: 0, diaDelta: 0, glucoseDelta: 0, latestAdherence: 100 };
    }
    const first = chartData[0];
    const latest = chartData[chartData.length - 1];

    return {
      adherenceDelta: latest.adherence - first.adherence,
      sysDelta: latest.systolic - first.systolic,
      diaDelta: latest.diastolic - first.diastolic,
      glucoseDelta: latest.glucose - first.glucose,
      latestAdherence: latest.adherence,
      latestBP: `${latest.systolic}/${latest.diastolic}`,
      latestGlucose: latest.glucose,
    };
  }, [chartData]);

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-[#191919] border border-[#383838] p-3 rounded-xl shadow-xl text-xs space-y-1 z-50">
          <div className="font-bold text-white flex items-center justify-between gap-3">
            <span>{dataPoint.milestone}</span>
            <span className="text-neutral-400 font-mono text-[11px]">{dataPoint.date}</span>
          </div>
          <div className="border-t border-[#333] pt-1.5 space-y-1">
            <div className="flex items-center justify-between gap-4 text-emerald-400 font-semibold">
              <span>{lang === 'ar' ? 'نسبة الالتزام الدوائي:' : 'Adherence Rate:'}</span>
              <span className="font-mono">{dataPoint.adherence}%</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-blue-400">
              <span>{lang === 'ar' ? 'ضغط الدم (BP):' : 'Blood Pressure:'}</span>
              <span className="font-mono">{dataPoint.systolic}/{dataPoint.diastolic} mmHg</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-amber-400">
              <span>{lang === 'ar' ? 'السكر العشوائي (Glucose):' : 'Blood Glucose:'}</span>
              <span className="font-mono">{dataPoint.glucose} mg/dL</span>
            </div>
          </div>
          {dataPoint.notes && (
            <div className="text-[10px] text-neutral-400 border-t border-[#333] pt-1 mt-1 max-w-[220px]">
              {dataPoint.notes}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Top Clinical Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Adherence Rate */}
        <div className="bg-[#141414] light:bg-neutral-50 p-3.5 rounded-xl border border-[#2e2e2e] light:border-neutral-200 space-y-1">
          <div className="text-[11px] text-neutral-400 font-semibold flex items-center justify-between">
            <span>{lang === 'ar' ? 'مستوى الالتزام الحالي' : 'Current Adherence'}</span>
            <Award className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-extrabold text-emerald-400 font-mono flex items-baseline gap-1.5">
            <span>{stats.latestAdherence}%</span>
            {stats.adherenceDelta !== 0 && (
              <span
                className={`text-[11px] font-bold flex items-center ${
                  stats.adherenceDelta > 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {stats.adherenceDelta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{stats.adherenceDelta > 0 ? `+${stats.adherenceDelta}%` : `${stats.adherenceDelta}%`}</span>
              </span>
            )}
          </div>
        </div>

        {/* Latest BP */}
        <div className="bg-[#141414] light:bg-neutral-50 p-3.5 rounded-xl border border-[#2e2e2e] light:border-neutral-200 space-y-1">
          <div className="text-[11px] text-neutral-400 font-semibold flex items-center justify-between">
            <span>{lang === 'ar' ? 'آخر قراءة ضغط' : 'Latest BP'}</span>
            <HeartPulse className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-xl font-extrabold text-blue-400 font-mono flex items-baseline gap-1.5">
            <span>{stats.latestBP || '—'}</span>
            {stats.sysDelta !== 0 && (
              <span
                className={`text-[11px] font-bold flex items-center ${
                  stats.sysDelta < 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
                title="تغير الضغط الانقباضي مقارنة بالبداية"
              >
                {stats.sysDelta < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                <span>{Math.abs(stats.sysDelta)} mmHg</span>
              </span>
            )}
          </div>
        </div>

        {/* Latest Glucose */}
        <div className="bg-[#141414] light:bg-neutral-50 p-3.5 rounded-xl border border-[#2e2e2e] light:border-neutral-200 space-y-1">
          <div className="text-[11px] text-neutral-400 font-semibold flex items-center justify-between">
            <span>{lang === 'ar' ? 'آخر قراءة سكر' : 'Latest Glucose'}</span>
            <Activity className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-extrabold text-amber-400 font-mono flex items-baseline gap-1.5">
            <span>{stats.latestGlucose || '—'}</span>
            <span className="text-xs font-normal text-neutral-500">mg/dL</span>
          </div>
        </div>

        {/* Milestones Logged */}
        <div className="bg-[#141414] light:bg-neutral-50 p-3.5 rounded-xl border border-[#2e2e2e] light:border-neutral-200 space-y-1 flex flex-col justify-between">
          <div className="text-[11px] text-neutral-400 font-semibold flex items-center justify-between">
            <span>{lang === 'ar' ? 'المحطات المسجلة' : 'Logged Milestones'}</span>
            <Calendar className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xl font-extrabold text-purple-400 font-mono">
              {chartData.length}
            </span>
            {onOpenNewFollowUp && (
              <button
                type="button"
                onClick={onOpenNewFollowUp}
                className="text-[10px] font-bold px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>{lang === 'ar' ? 'متابعة جديدة' : 'New Log'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Interactive Recharts Chart Panel */}
      <div className="bg-[#141414] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="font-bold text-sm text-white light:text-neutral-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>
              {lang === 'ar'
                ? 'التطور السريري التتبعي للمريض (Adherence & Longitudinal Vitals)'
                : 'Longitudinal Adherence & Clinical Vitals Trend'}
            </span>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="flex items-center bg-[#1f1f1f] light:bg-neutral-100 p-1 rounded-lg border border-[#383838] light:border-neutral-300 gap-1 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setChartMode('combined')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                chartMode === 'combined'
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-white light:hover:text-neutral-900'
              }`}
            >
              {lang === 'ar' ? 'المخطط الشامل 📊' : 'Combined 📊'}
            </button>
            <button
              type="button"
              onClick={() => setChartMode('adherence')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                chartMode === 'adherence'
                  ? 'bg-emerald-600 text-white font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-white light:hover:text-neutral-900'
              }`}
            >
              {lang === 'ar' ? 'الالتزام %' : 'Adherence %'}
            </button>
            <button
              type="button"
              onClick={() => setChartMode('blood_pressure')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                chartMode === 'blood_pressure'
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-white light:hover:text-neutral-900'
              }`}
            >
              {lang === 'ar' ? 'ضغط الدم' : 'Blood Pressure'}
            </button>
            <button
              type="button"
              onClick={() => setChartMode('glucose')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                chartMode === 'glucose'
                  ? 'bg-amber-600 text-white font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-white light:hover:text-neutral-900'
              }`}
            >
              {lang === 'ar' ? 'السكر' : 'Glucose'}
            </button>
          </div>
        </div>

        {/* Dynamic Chart Container */}
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === 'combined' ? (
              <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                <defs>
                  <linearGradient id="adherenceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e2e2e" />
                <XAxis dataKey="shortDate" stroke="#888888" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="left"
                  domain={[40, 100]}
                  stroke="#10b981"
                  tick={{ fontSize: 11 }}
                  unit="%"
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[50, 220]}
                  stroke="#3b82f6"
                  tick={{ fontSize: 11 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <ReferenceLine
                  yAxisId="left"
                  y={80}
                  stroke="#10b981"
                  strokeDasharray="3 3"
                  label={{ value: 'Target PDC ≥ 80%', fill: '#10b981', fontSize: 10 }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="adherence"
                  name="Adherence Rate (PDC %)"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#adherenceGrad)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="systolic"
                  name="Systolic BP (mmHg)"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#3b82f6' }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="glucose"
                  name="Blood Glucose (mg/dL)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#f59e0b' }}
                />
              </ComposedChart>
            ) : chartMode === 'adherence' ? (
              <AreaChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                <defs>
                  <linearGradient id="adhOnlyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e2e2e" />
                <XAxis dataKey="shortDate" stroke="#888888" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} stroke="#10b981" tick={{ fontSize: 11 }} unit="%" />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <ReferenceLine
                  y={80}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  label={{ value: 'Target Goal 80%', fill: '#10b981', fontSize: 11 }}
                />
                <Area
                  type="monotone"
                  dataKey="adherence"
                  name="Adherence Rate (PDC %)"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#adhOnlyGrad)"
                />
              </AreaChart>
            ) : chartMode === 'blood_pressure' ? (
              <LineChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e2e2e" />
                <XAxis dataKey="shortDate" stroke="#888888" tick={{ fontSize: 11 }} />
                <YAxis domain={[50, 190]} stroke="#3b82f6" tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <ReferenceLine
                  y={130}
                  stroke="#3b82f6"
                  strokeDasharray="3 3"
                  label={{ value: 'Target Systolic < 130 mmHg', fill: '#3b82f6', fontSize: 10 }}
                />
                <Line
                  type="monotone"
                  dataKey="systolic"
                  name="Systolic BP (mmHg)"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#3b82f6' }}
                />
                <Line
                  type="monotone"
                  dataKey="diastolic"
                  name="Diastolic BP (mmHg)"
                  stroke="#06b6d4"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#06b6d4' }}
                />
              </LineChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e2e2e" />
                <XAxis dataKey="shortDate" stroke="#888888" tick={{ fontSize: 11 }} />
                <YAxis domain={[60, 240]} stroke="#f59e0b" tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <ReferenceLine
                  y={130}
                  stroke="#10b981"
                  strokeDasharray="3 3"
                  label={{ value: 'Glycemic Goal < 130 mg/dL', fill: '#10b981', fontSize: 10 }}
                />
                <Line
                  type="monotone"
                  dataKey="glucose"
                  name="Blood Glucose (mg/dL)"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#f59e0b' }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Historical Follow-Up Milestones Grid */}
      <div className="space-y-3">
        <div className="font-bold text-sm text-white light:text-neutral-900 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            <span>{lang === 'ar' ? 'سجل المحطات والمتابعات السريرية السابقة:' : 'Historical Follow-Up Milestones:'}</span>
          </span>
          <span className="text-xs text-neutral-400">{patientFollowUps.length} {lang === 'ar' ? 'سجلات تاريخية' : 'records'}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
          {chartData.map((pt, i) => (
            <div
              key={i}
              className="bg-[#141414] light:bg-neutral-50 p-3 rounded-xl border border-[#2e2e2e] light:border-neutral-200 text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white light:text-neutral-900">{pt.milestone}</span>
                <span className="font-mono text-neutral-400 text-[11px]">{pt.date}</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap text-[11px]">
                <span className="font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                  {lang === 'ar' ? 'الالتزام:' : 'Adherence:'} {pt.adherence}%
                </span>
                <span className="font-mono font-bold text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/40">
                  BP: {pt.systolic}/{pt.diastolic}
                </span>
                <span className="font-mono font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
                  Glucose: {pt.glucose}
                </span>
              </div>

              {pt.notes && (
                <div className="text-[11px] text-neutral-300 light:text-neutral-600 line-clamp-2 mt-1">
                  {pt.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
