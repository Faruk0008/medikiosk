import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  AlertTriangle,
  Edit3,
  Check,
  GitCommit,
  FileText,
  User,
  Keyboard
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import {
  Button,
  Card,
  Chip,
  Sheet,
  Skeleton
} from '../components/ui/Primitives';

export default function PhysicianDashboard() {
  const { t } = useI18n();
  const { pushToast } = useToast();

  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [editingField, setEditingField] = useState(null);
  const [draftEdits, setDraftEdits] = useState({});
  const [confirmSheetOpen, setConfirmSheetOpen] = useState(false);
  const [patientTimeline, setPatientTimeline] = useState([]);

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/api/cases?limit=50');
      setCases(res.data || []);
    } catch (err) {
      pushToast({ title: 'Failed to load cases', description: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const filteredCases = cases.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (modeFilter !== 'all' && c.mode !== modeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const cc = (c.history?.chiefComplaint || '').toLowerCase();
      const pn = (c.patientName || '').toLowerCase();
      if (!cc.includes(q) && !pn.includes(q)) return false;
    }
    return true;
  });

  const selectedCase = filteredCases[selectedIdx] || filteredCases[0] || null;

  useEffect(() => {
    if (!selectedCase) return;
    setDraftEdits({
      'history.chiefComplaint': selectedCase.history?.chiefComplaint || '',
      'history.hpi.site': selectedCase.history?.hpi?.site || '',
      'history.hpi.associations': selectedCase.history?.hpi?.associations || '',
      'history.dashavidhaPariksha.vikriti': selectedCase.history?.dashavidhaPariksha?.vikriti || ''
    });
    setEditingField(null);

    const pid = selectedCase.patientId?._id || selectedCase.patientId;
    if (pid) {
      apiRequest(`/api/documents/patient/${pid}/timeline`)
        .then(res => setPatientTimeline(res.documents || []))
        .catch(() => setPatientTimeline([]));
    }
  }, [selectedCase]);

  // Keyboard shortcuts: J (next case), K (prev case), E (toggle edit), A (open Accept/Amend sheet)
  useEffect(() => {
    const onKeyDown = e => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setSelectedIdx(prev => Math.min(filteredCases.length - 1, prev + 1));
      } else if (e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSelectedIdx(prev => Math.max(0, prev - 1));
      } else if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setEditingField(prev => (prev ? null : 'history.chiefComplaint'));
      } else if (e.key.toLowerCase() === 'a' && selectedCase) {
        e.preventDefault();
        setConfirmSheetOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filteredCases.length, selectedCase]);

  async function handleAcceptAndSignOff() {
    if (!selectedCase) return;
    try {
      const updated = await apiRequest(`/api/cases/${selectedCase._id}/review`, {
        method: 'PATCH',
        body: {
          updates: draftEdits
        }
      });

      setCases(prev => prev.map(c => (c._id === updated._id ? updated : c)));
      setConfirmSheetOpen(false);
      setEditingField(null);

      pushToast({
        title: 'Case Reviewed & Signed',
        description: `${updated.physicianEdits?.length || 0} amendment(s) logged in physicianEdits.`,
        type: 'success'
      });
    } catch (err) {
      pushToast({ title: 'Review Sign-Off Failed', description: err.message, type: 'error' });
    }
  }

  return (
    <div className="max-w-apple mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 hairline-b">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#0071e3]">
            Clinical Decision & Review
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tightHeading mt-0.5">
            {t('physician.title')}
          </h1>
        </div>
        <div className="inline-flex items-center gap-2 text-xs text-apple-textSecondary bg-apple-bgSecondary px-3.5 py-2 rounded-full hairline-border">
          <Keyboard className="w-3.5 h-3.5 text-[#0071e3]" />
          <span>{t('physician.shortcutsHint')}</span>
        </div>
      </div>

      {/* Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Pane: Searchable & Filterable Case List */}
        <Card className="lg:col-span-4 p-4 space-y-4">
          <div className="flex items-center gap-2 rounded-full bg-apple-bgSecondary hairline-border px-3.5 py-2">
            <Search className="w-4 h-4 text-apple-textSecondary shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setSelectedIdx(0);
              }}
              placeholder={t('physician.searchCases')}
              className="w-full bg-transparent text-xs sm:text-sm text-apple-text focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {['all', 'submitted', 'reviewed'].map(st => (
              <Chip
                key={st}
                active={statusFilter === st}
                onClick={() => {
                  setStatusFilter(st);
                  setSelectedIdx(0);
                }}
                className="!px-3 !py-1 !text-xs capitalize"
              >
                {st}
              </Chip>
            ))}
            {['ayush', 'allopathic'].map(m => (
              <Chip
                key={m}
                active={modeFilter === m}
                onClick={() => {
                  setModeFilter(modeFilter === m ? 'all' : m);
                  setSelectedIdx(0);
                }}
                className="!px-3 !py-1 !text-xs uppercase"
              >
                {m}
              </Chip>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-2 max-h-[68vh] overflow-y-auto pr-1">
              {filteredCases.map((c, idx) => {
                const active = selectedCase?._id === c._id;
                return (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => setSelectedIdx(idx)}
                    className={`w-full text-left p-4 rounded-[18px] transition hairline-border ${
                      active
                        ? 'bg-[#0071e3] text-white border-[#0071e3]'
                        : 'bg-apple-surface hover:bg-apple-bgSecondary text-apple-text'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-semibold flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {c.patientName || 'Registered Patient'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold ${
                          active
                            ? 'bg-white/20 text-white'
                            : c.priority >= 75
                            ? 'bg-[#ff3b30]/15 text-[#ff3b30]'
                            : 'bg-apple-bgSecondary text-apple-textSecondary'
                        }`}
                      >
                        P{c.priority} • {c.mode.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm font-semibold line-clamp-1">
                      {c.history?.chiefComplaint}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] opacity-80">
                      <span className="capitalize">{c.status}</span>
                      <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Right Pane: Structured Clinical Summary + Inline Edit + Diff Audit Trail */}
        <div className="lg:col-span-8 space-y-6">
          {selectedCase ? (
            <>
              {/* Red-Flag Alert Banner */}
              {selectedCase.redFlags?.length > 0 && (
                <div className="p-5 rounded-[22px] bg-[#ff3b30]/10 border border-[#ff3b30]/30 flex items-start gap-3.5">
                  <AlertTriangle className="w-5 h-5 text-[#ff3b30] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[#ff3b30]">
                      Clinical Red Flags Triggered (Priority {selectedCase.priority}/100)
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {selectedCase.redFlags.map((rf, i) => (
                        <span
                          key={i}
                          className="text-xs font-medium px-3 py-1 rounded-full bg-[#ff3b30] text-white"
                        >
                          {rf.code}: {rf.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <Card className="p-8 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-5 hairline-b">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-apple-textSecondary">
                      <span className="font-semibold text-apple-text">{selectedCase.patientName}</span>
                      {selectedCase.patientAbhaId && (
                        <span className="font-mono">• ABHA {selectedCase.patientAbhaId}</span>
                      )}
                      <span>• Mode: {selectedCase.mode.toUpperCase()}</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-semibold tracking-tightHeading mt-1">
                      Structured Clinical Summary
                    </h2>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setEditingField(editingField ? null : 'history.chiefComplaint')
                      }
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{editingField ? t('physician.doneEditing') : t('physician.editSection')}</span>
                    </Button>
                    <Button size="sm" onClick={() => setConfirmSheetOpen(true)}>
                      <Check className="w-3.5 h-3.5" />
                      <span>{t('physician.acceptAmend')}</span>
                    </Button>
                  </div>
                </div>

                {/* 1. Chief Complaint */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-apple-textSecondary">
                    1. Chief Complaint
                  </p>
                  {editingField ? (
                    <input
                      type="text"
                      value={draftEdits['history.chiefComplaint'] || ''}
                      onChange={e =>
                        setDraftEdits({ ...draftEdits, 'history.chiefComplaint': e.target.value })
                      }
                      className="w-full rounded-[14px] bg-apple-bgSecondary hairline-border px-4 py-2.5 text-base font-semibold"
                    />
                  ) : (
                    <p className="text-lg font-semibold text-apple-text">
                      {draftEdits['history.chiefComplaint']}
                    </p>
                  )}
                </div>

                {/* 2-6. Standard Clinical Sections Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-apple-bgSecondary p-5 rounded-[20px] text-sm">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-apple-textSecondary">
                      2. History of Present Illness (HPI)
                    </p>
                    {editingField ? (
                      <input
                        type="text"
                        value={draftEdits['history.hpi.associations'] || ''}
                        onChange={e =>
                          setDraftEdits({ ...draftEdits, 'history.hpi.associations': e.target.value })
                        }
                        className="w-full rounded-[10px] bg-apple-surface hairline-border px-3 py-1.5 text-xs"
                      />
                    ) : (
                      <p>
                        Site: {selectedCase.history?.hpi?.site || '—'} • Onset:{' '}
                        {selectedCase.history?.hpi?.onset || '—'} • Associations:{' '}
                        {draftEdits['history.hpi.associations'] || '—'} (VAS{' '}
                        {selectedCase.history?.hpi?.severity}/10)
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-apple-textSecondary">
                      3. Past Medical & Surgical
                    </p>
                    <p>{(selectedCase.history?.pastMedicalSurgical || []).join(', ') || 'None'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-apple-textSecondary">
                      4. Drug History & Allergies
                    </p>
                    <p>{(selectedCase.history?.drugAllergy || []).join(', ') || 'No known allergies'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-apple-textSecondary">
                      5. Family & Personal History
                    </p>
                    <p>
                      Diet: {selectedCase.history?.personal?.diet || '—'} • Sleep:{' '}
                      {selectedCase.history?.personal?.sleep || '—'}
                    </p>
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-apple-textSecondary">
                      6. Review of Systems (ROS)
                    </p>
                    <p>
                      CV: {selectedCase.history?.reviewOfSystems?.cardiovascular} • Resp:{' '}
                      {selectedCase.history?.reviewOfSystems?.respiratory} • Neuro:{' '}
                      {selectedCase.history?.reviewOfSystems?.neurological} • MSK:{' '}
                      {selectedCase.history?.reviewOfSystems?.musculoskeletal}
                    </p>
                  </div>
                </div>

                {/* 7. Ayush Dashavidha Pariksha */}
                {selectedCase.mode === 'ayush' && (
                  <div className="p-5 rounded-[20px] bg-apple-bgSecondary space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#0071e3]">
                      7. Ayurvedic Dashavidha Pariksha
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-apple-textSecondary">Prakriti: </span>
                        <strong>{selectedCase.history?.dashavidhaPariksha?.prakriti || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-apple-textSecondary">Vikriti: </span>
                        {editingField ? (
                          <input
                            type="text"
                            value={draftEdits['history.dashavidhaPariksha.vikriti'] || ''}
                            onChange={e =>
                              setDraftEdits({
                                ...draftEdits,
                                'history.dashavidhaPariksha.vikriti': e.target.value
                              })
                            }
                            className="rounded bg-apple-surface px-2 py-0.5 hairline-border"
                          />
                        ) : (
                          <strong>{draftEdits['history.dashavidhaPariksha.vikriti'] || '—'}</strong>
                        )}
                      </div>
                      <div>
                        <span className="text-apple-textSecondary">Agni: </span>
                        <strong>{selectedCase.history?.dashavidhaPariksha?.aharaShakti || '—'}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* 8. Prior Investigations Summary */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-apple-textSecondary">
                    8. Prior Investigations & Documents ({patientTimeline.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {patientTimeline
                      .flatMap(d => d.extracted?.investigations || [])
                      .slice(0, 8)
                      .map((inv, idx) => (
                        <span
                          key={idx}
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            inv.abnormal
                              ? 'bg-[#ff3b30]/15 text-[#ff3b30]'
                              : 'bg-apple-bgSecondary text-apple-text'
                          }`}
                        >
                          <FileText className="w-3 h-3 inline mr-1" />
                          {inv.name}: {inv.value} {inv.unit} (Ref {inv.refRange})
                        </span>
                      ))}
                  </div>
                </div>

                {/* Visual Diff View of Physician Edits */}
                {selectedCase.physicianEdits?.length > 0 && (
                  <div className="pt-5 hairline-t space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-apple-textSecondary">
                      <GitCommit className="w-4 h-4 text-[#0071e3]" />
                      <span>
                        {t('physician.auditTrail')} ({selectedCase.physicianEdits.length})
                      </span>
                    </div>
                    <div className="space-y-2">
                      {selectedCase.physicianEdits.map((ed, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-[16px] bg-apple-bgSecondary text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between font-mono text-[11px] text-apple-textSecondary">
                            <span>{ed.field}</span>
                            <span>{new Date(ed.when).toLocaleString()}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="line-through text-[#ff3b30] bg-[#ff3b30]/10 px-2 py-0.5 rounded">
                              {String(ed.old || 'empty')}
                            </span>
                            <span>→</span>
                            <span className="font-semibold text-[#34c759] bg-[#34c759]/10 px-2 py-0.5 rounded">
                              {String(ed.new)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </>
          ) : (
            <Card className="p-12 text-center text-apple-textSecondary">
              Select a clinical case from the left pane to begin review.
            </Card>
          )}
        </div>
      </div>

      {/* Confirmation Sheet for Physician Sign-Off */}
      <Sheet
        open={confirmSheetOpen}
        onClose={() => setConfirmSheetOpen(false)}
        title="Confirm Clinical Summary & Sign Off"
      >
        <div className="space-y-6">
          <p className="text-sm text-apple-textSecondary leading-relaxed">
            Signing off transitions this case to <strong>reviewed</strong> status and records any field modifications in the immutable <code>physicianEdits</code> array.
          </p>

          <div className="p-4 rounded-[18px] bg-apple-bgSecondary space-y-2 text-xs">
            <p>
              <strong>Patient:</strong> {selectedCase?.patientName}
            </p>
            <p>
              <strong>Chief Complaint:</strong> {draftEdits['history.chiefComplaint']}
            </p>
            <p>
              <strong>HPI Associations:</strong> {draftEdits['history.hpi.associations']}
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmSheetOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleAcceptAndSignOff}>
              Confirm & Sign
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
