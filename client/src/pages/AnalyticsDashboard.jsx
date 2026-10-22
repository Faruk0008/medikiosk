import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { Database, Activity, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { apiRequest } from '../api/client';
import { useI18n } from '../context/I18nContext';
import {
  Card,
  Segmented,
  AnimatedNumber,
  Skeleton
} from '../components/ui/Primitives';

export default function AnalyticsDashboard() {
  const { t } = useI18n();
  const [range, setRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ totalPatients: 0, totalCases: 0, totalDocuments: 0, submittedCases: 0 });
  const [casesPerDay, setCasesPerDay] = useState([]);
  const [topComplaints, setTopComplaints] = useState([]);
  const [abnormalLabs, setAbnormalLabs] = useState([]);
  const [weeklyFlags, setWeeklyFlags] = useState([]);
  const [coveredStats, setCoveredStats] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiRequest('/api/analytics/overview'),
      apiRequest('/api/analytics/cases-per-day'),
      apiRequest('/api/analytics/top-complaints'),
      apiRequest('/api/analytics/abnormal-labs'),
      apiRequest('/api/analytics/red-flags-per-week'),
      apiRequest('/api/analytics/covered-query')
    ])
      .then(([ov, cpd, tc, al, rf, cq]) => {
        setKpis(ov.kpis || { totalPatients: 0, totalCases: 0, totalDocuments: 0, submittedCases: 0 });
        setCasesPerDay(cpd.chartData || []);
        setTopComplaints(tc.data || []);
        setAbnormalLabs(al.data || []);
        setWeeklyFlags(rf.weeklyChart || []);
        setCoveredStats(cq.executionStats || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sliceCount = range === '7d' ? 7 : range === '30d' ? 30 : range === '6m' ? 180 : casesPerDay.length;
  const filteredDaily = casesPerDay.slice(-Math.max(1, sliceCount));

  return (
    <div className="max-w-apple mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 hairline-b">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#0071e3]">
            MongoDB Aggregation Pipelines (Unit IV / CO4)
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tightHeading mt-0.5">
            {t('analytics.title')}
          </h1>
          <p className="text-xs sm:text-sm text-apple-textSecondary mt-1">
            {t('analytics.subtitle')}
          </p>
        </div>

        <Segmented
          idPrefix="analytics_range"
          options={[
            { value: '7d', label: '7D' },
            { value: '30d', label: '30D' },
            { value: '6m', label: '6M' },
            { value: 'all', label: 'All' }
          ]}
          value={range}
          onChange={setRange}
        />
      </div>

      {/* KPI Band */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <p className="text-xs text-apple-textSecondary">Registered Patients</p>
          <p className="text-3xl font-semibold tracking-tightHeading mt-1">
            <AnimatedNumber value={kpis.totalPatients} />
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-xs text-apple-textSecondary">Total CaseRecords</p>
          <p className="text-3xl font-semibold tracking-tightHeading mt-1 text-[#0071e3]">
            <AnimatedNumber value={kpis.totalCases} />
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-xs text-apple-textSecondary">MedicalDocuments</p>
          <p className="text-3xl font-semibold tracking-tightHeading mt-1 text-[#34c759]">
            <AnimatedNumber value={kpis.totalDocuments} />
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-xs text-apple-textSecondary">Covered Query Docs Examined</p>
          <p className="text-3xl font-semibold tracking-tightHeading mt-1">
            <AnimatedNumber value={coveredStats?.totalDocsExamined ?? 0} />
          </p>
          <p className="text-[11px] font-mono text-apple-textSecondary mt-1">
            Stage: {coveredStats?.executionStages?.stage || 'PROJECTION_COVERED'}
          </p>
        </Card>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. Cases over time by Mode */}
          <Card className="p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold tracking-tightHeading">
                  Daily Case Volume by Clinical Mode
                </h2>
                <p className="text-xs text-apple-textSecondary font-mono">
                  $group + $dateToString (%Y-%m-%d)
                </p>
              </div>
              <Activity className="w-5 h-5 text-[#0071e3]" />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredDaily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-hairline)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 16,
                      border: '1px solid var(--border-hairline)',
                      backgroundColor: 'var(--surface-primary)'
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="ayush"
                    stroke="#0071e3"
                    fill="#0071e3"
                    fillOpacity={0.16}
                    strokeWidth={2}
                    name="Ayush (Dashavidha)"
                  />
                  <Area
                    type="monotone"
                    dataKey="allopathic"
                    stroke="#34c759"
                    fill="#34c759"
                    fillOpacity={0.14}
                    strokeWidth={2}
                    name="Allopathic"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* 2. Top 10 Chief Complaints */}
          <Card className="p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold tracking-tightHeading">
                  Top 10 Presenting Chief Complaints
                </h2>
                <p className="text-xs text-apple-textSecondary font-mono">
                  $group + $sort + $limit(10)
                </p>
              </div>
              <Database className="w-5 h-5 text-[#0071e3]" />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topComplaints} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-hairline)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="chiefComplaint"
                    width={165}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 16,
                      border: '1px solid var(--border-hairline)',
                      backgroundColor: 'var(--surface-primary)'
                    }}
                  />
                  <Bar dataKey="count" fill="#0071e3" radius={[0, 8, 8, 0]} name="Cases" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* 3. Abnormal Lab Frequency */}
          <Card className="p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold tracking-tightHeading">
                  Out-of-Range Laboratory Frequency
                </h2>
                <p className="text-xs text-apple-textSecondary font-mono">
                  $unwind(&quot;$extracted.investigations&quot;) + $match + $group
                </p>
              </div>
              <FileSpreadsheet className="w-5 h-5 text-[#ff3b30]" />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={abnormalLabs}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-hairline)" />
                  <XAxis dataKey="testName" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 16,
                      border: '1px solid var(--border-hairline)',
                      backgroundColor: 'var(--surface-primary)'
                    }}
                  />
                  <Bar
                    dataKey="abnormalCount"
                    fill="#ff3b30"
                    radius={[8, 8, 0, 0]}
                    name="Abnormal Results"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* 4. Weekly Red-Flag Trend */}
          <Card className="p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold tracking-tightHeading">
                  Weekly Red-Flag Emergency Trend
                </h2>
                <p className="text-xs text-apple-textSecondary font-mono">
                  $unwind(&quot;$redFlags&quot;) + $dateToString (%Y-W%V)
                </p>
              </div>
              <AlertCircle className="w-5 h-5 text-[#ff9f0a]" />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyFlags}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-hairline)" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 16,
                      border: '1px solid var(--border-hairline)',
                      backgroundColor: 'var(--surface-primary)'
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="critical"
                    stackId="rf"
                    fill="#ff3b30"
                    radius={[4, 4, 0, 0]}
                    name="Critical Severity"
                  />
                  <Bar
                    dataKey="high"
                    stackId="rf"
                    fill="#ff9f0a"
                    radius={[4, 4, 0, 0]}
                    name="High Severity"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
