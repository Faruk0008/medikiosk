import React, { useState, useEffect, useCallback } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  Clock
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import {
  Button,
  Card,
  Toggle,
  AnimatedNumber,
  Skeleton
} from '../components/ui/Primitives';

export default function TriageQueue() {
  const { t } = useI18n();
  const { pushToast } = useToast();

  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [minPriority, setMinPriority] = useState(0);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await apiRequest(`/api/triage/queue?limit=50&minPriority=${minPriority}`);
      setQueue(res.data || []);
    } catch {
      // silent retry on poll
    } finally {
      setLoading(false);
    }
  }, [minPriority]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(fetchQueue, 5000);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchQueue]);

  async function handleAcknowledge(caseId) {
    // Optimistic update
    setQueue(prev =>
      prev.map(item =>
        item._id === caseId ? { ...item, triageAcknowledged: true, triageAcknowledgedAt: new Date().toISOString() } : item
      )
    );
    try {
      await apiRequest(`/api/triage/${caseId}/acknowledge`, { method: 'PATCH' });
      pushToast({
        title: 'Case Acknowledged',
        description: 'Triage nurse acknowledgement timestamped.',
        type: 'success'
      });
    } catch (err) {
      pushToast({ title: 'Acknowledge Failed', description: err.message, type: 'error' });
      fetchQueue();
    }
  }

  const criticalCount = queue.filter(c => c.priority >= 75).length;
  const redFlagCount = queue.filter(c => (c.redFlags || []).length > 0).length;
  const unackCount = queue.filter(c => !c.triageAcknowledged).length;

  return (
    <div className="max-w-apple mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 hairline-b">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#ff3b30]">
            Real-Time Clinical Acuity
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tightHeading mt-0.5">
            {t('triage.title')}
          </h1>
          <p className="text-xs sm:text-sm text-apple-textSecondary mt-1">{t('triage.subtitle')}</p>
        </div>

        <div className="flex items-center gap-4">
          <Toggle
            checked={autoRefresh}
            onChange={setAutoRefresh}
            label={t('triage.autoRefresh')}
          />
          <Button variant="secondary" size="sm" onClick={fetchQueue}>
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync</span>
          </Button>
        </div>
      </div>

      {/* Count-Up KPI Band */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-5">
          <p className="text-xs text-apple-textSecondary">Active Queue</p>
          <p className="text-3xl font-semibold tracking-tightHeading mt-1">
            <AnimatedNumber value={queue.length} />
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-[#ff3b30] font-medium">Critical Priority (≥75)</p>
          <p className="text-3xl font-semibold tracking-tightHeading text-[#ff3b30] mt-1">
            <AnimatedNumber value={criticalCount} />
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-[#ff9f0a] font-medium">Red-Flagged Cases</p>
          <p className="text-3xl font-semibold tracking-tightHeading text-[#ff9f0a] mt-1">
            <AnimatedNumber value={redFlagCount} />
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-[#0071e3] font-medium">Awaiting Acknowledge</p>
          <p className="text-3xl font-semibold tracking-tightHeading text-[#0071e3] mt-1">
            <AnimatedNumber value={unackCount} />
          </p>
        </Card>
      </div>

      {/* Priority Filter Chips */}
      <div className="flex items-center gap-2">
        {[
          { label: 'All Submitted', min: 0 },
          { label: 'Moderate+ (≥45)', min: 45 },
          { label: 'Critical Only (≥75)', min: 75 }
        ].map(f => (
          <button
            key={f.min}
            type="button"
            onClick={() => setMinPriority(f.min)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition hairline-border ${
              minPriority === f.min
                ? 'bg-[#0071e3] text-white border-[#0071e3]'
                : 'bg-apple-surface text-apple-textSecondary hover:text-apple-text'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Animated Priority Queue List */}
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <LayoutGroup>
          <div className="space-y-3">
            {queue.map(item => {
              const isCritical = item.priority >= 75;
              const isModerate = item.priority >= 45 && item.priority < 75;
              return (
                <motion.div
                  key={item._id}
                  layout
                  transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                >
                  <Card
                    className={`p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isCritical && !item.triageAcknowledged
                        ? 'ring-1 ring-[#ff3b30]/50'
                        : ''
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Priority Score Badge with subtle pulse on unacknowledged critical cases */}
                      <div className="relative shrink-0">
                        {isCritical && !item.triageAcknowledged && (
                          <span className="animate-ping absolute inset-0 rounded-full bg-[#ff3b30]/40" />
                        )}
                        <div
                          className={`relative h-12 w-12 rounded-full flex flex-col items-center justify-center font-semibold text-xs ${
                            isCritical
                              ? 'bg-[#ff3b30] text-white'
                              : isModerate
                              ? 'bg-[#ff9f0a] text-white'
                              : 'bg-[#34c759]/15 text-[#34c759]'
                          }`}
                        >
                          <span className="text-[10px] opacity-80">PRI</span>
                          <span className="text-sm leading-none">{item.priority}</span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold text-apple-text">
                            {item.patientName || 'Outpatient'}
                          </span>
                          <span className="text-xs uppercase font-mono px-2.5 py-0.5 rounded-full bg-apple-bgSecondary text-apple-textSecondary">
                            {item.mode}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-apple-textSecondary">
                            <Clock className="w-3 h-3" />
                            {new Date(item.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>

                        <p className="text-sm sm:text-base text-apple-text font-medium">
                          {item.history?.chiefComplaint}
                        </p>

                        {item.redFlags?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {item.redFlags.map((rf, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#ff3b30]/15 text-[#ff3b30]"
                              >
                                <AlertTriangle className="w-3 h-3" />
                                {rf.code} • {rf.category}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end shrink-0">
                      {item.triageAcknowledged ? (
                        <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[#34c759]/15 text-[#34c759]">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{t('triage.acknowledged')}</span>
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant={isCritical ? 'danger' : 'primary'}
                          onClick={() => handleAcknowledge(item._id)}
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>{t('triage.acknowledge')}</span>
                        </Button>
                      )}
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </LayoutGroup>
      )}
    </div>
  );
}
