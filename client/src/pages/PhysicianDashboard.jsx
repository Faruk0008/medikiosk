import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  AlertTriangle,
  Edit3,
  Check,
  GitCommit,
  FileText,
  User,
  Keyboard,
  ArrowLeft,
  ChevronLeft,
  ChevronRight
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
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'detail' for < lg screens

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
      pushToast({
        title: 'Clinical Summary Signed',
        description: `Case ${selectedCase._id.slice(-6)} reviewed & signed off.`,
        type: 'success'
      });
    } catch (err) {
      pushToast({ title: 'Sign-off failed', description: err.message, type: 'error' });
    }
  }

  return (
    <div className="max-w-apple mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 sm:pb-6 hairline-b">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#0071e3]">
            Clinical Workspace
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tightHeading mt-0.5">
            {t('physician.title')}
          </h1>
        </div>

        {/* Desktop Keyboard Shortcuts Hint + Touch Controls */}
        <div className="flex items-center gap-2">
          <div className="hidden lg:inline-flex items-center gap-2 text-xs text-apple-textSecondary bg-apple-bgSecondary px-3.5 py-2 rounded-full hairline-border">
            <Keyboard className="w-3.5 h-3.5 text-[#0071e3]" />
            <span>{t('physician.shortcutsHint')}</span>
          </div>

          {/* Touch-Friendly Action Toolbar */}
          <div className="inline-flex items-center gap-1.5 p-1 rounded-full bg-apple-bgSecondary hairline-border">
            <button
              type="button"
              onClick={() => setSelectedIdx(prev => Math.max(0, prev - 1))}
              disabled={selectedIdx === 0}
              title="Previous Case (K)"
              className="p-1.5 min-h-[36px] min-w-[36px] rounded-full hover:bg-apple-surface text-apple-textSecondary disabled:opacity-30 flex items-center justify-center transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-medium px-1 text-apple-text">
              {filteredCases.length > 0 ? `${selectedIdx + 1}/${filteredCases.length}` : '0/0'}
            </span>
            <button
              type="button"
              onClick={() => setSelectedIdx(prev => Math.min(filteredCases.length - 1, prev + 1))}
              disabled={selectedIdx >= filteredCases.length - 1}
              title="Next Case (J)"
              className="p-1.5 min-h-[36px] min-w-[36px] rounded-full hover:bg-apple-surface text-apple-textSecondary disabled:opacity-30 flex items-center justify-center transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Pane: Searchable & Filterable Case List */}
        <Card
          className={`lg:col-span-4 p-4 space-y-4 ${
            mobileView === 'detail' ? 'hidden lg:block' : 'block'
          }`}
        >
          <div className="flex items-center gap-2 rounded-full bg-apple-bgSecondary hairline-border px-3.5 py-2 min-h-[44px]">
            <Search className="w-4 h-4 text-apple-textSecondary shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setSelectedIdx(0);
              }}
              placeholder={t('physician.searchPlaceholder')}
              className="w-full bg-transparent text-[16px] sm:text-xs text-apple-text placeholder:text-apple-textSecondary focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {['all', 'submitted', 'reviewed'].map(st => (
                <Chip
                  key={st}
                  active={statusFilter === st}
                  onClick={() => {
                    setStatusFilter(st);
                    setSelectedIdx(0);
                  }}
                >
                  {st.charAt(0).toUpperCase() + st.slice(1)}
                </Chip>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {['all', 'allopathic', 'ayush'].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setModeFilter(m);
                    setSelectedIdx(0);
                  }}
                  className={`text-xs px-2.5 py-1 min-h-[32px] rounded-full transition ${
                    modeFilter === m
                      ? 'bg-apple-text text-apple-bg font-semibold'
                      : 'text-apple-textSecondary hover:text-apple-text'
                  }`}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Case List Scroll Area */}
          <div className="space-y-2 max-h-[calc(100dvh-22rem)] overflow-y-auto pr-1">
            {loading ? (
              <div className="space-y-3 p-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : filteredCases.length === 0 ? (
              <p className="text-xs text-apple-textSecondary text-center py-8">
                {t('physician.noCases')}
              </p>
            ) : (
              filteredCases.map((c, idx) => {
                const active = idx === selectedIdx;
                const hasRedFlags = (c.redFlags || []).length > 0;
                return (
                  <div
                    key={c._id}
                    onClick={() => {
                      setSelectedIdx(idx);
                      setMobileView('detail');
                    }}
                    className={`p-3.5 rounded-[18px] cursor-pointer transition hairline-border min-h-[44px] ${
                      active
                        ? 'bg-[#0071e3] text-white border-[#0071e3] shadow-sm'
                        : 'bg-apple-bgSecondary hover:bg-apple-surface text-apple-text'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-semibold truncate max-w-[170px] ${active ? 'text-white' : ''}`}>
                        {c.patientName || 'Patient'}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                          active
                            ? 'bg-white/20 text-white'
                            : 'bg-apple-surface text-apple-textSecondary'
                        }`}
                      >
                        {c.mode.toUpperCase()}
                      </span>
                    </div>

                    <p
                      className={`text-xs mt-1.5 font-medium truncate ${
                        active ? 'text-white/95' : 'text-apple-text'
                      }`}
                    >
                      {c.history?.chiefComplaint || 'No chief complaint recorded'}
                    </p>

                    <div className="mt-2.5 flex items-center justify-between text-[11px]">
                      <span className={active ? 'text-white/80' : 'text-apple-textSecondary'}>
                        Priority {c.priority}
                      </span>
                      {hasRedFlags && (
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            active
                              ? 'bg-white text-[#ff3b30]'
                              : 'bg-[#ff3b30]/15 text-[#ff3b30]'
                          }`}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {c.redFlags.length} Flags
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Right Pane: Auto-Structured Clinical Summary + Inline Editor */}
        <Card
          className={`lg:col-span-8 p-5 sm:p-8 space-y-6 ${
            mobileView === 'list' ? 'hidden lg:block' : 'block'
          }`}
        >
          {/* Mobile Back to Cases Button */}
          <div className="lg:hidden pb-3 hairline-b flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMobileView('list')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0071e3] min-h-[44px] py-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Case List</span>
            </button>
            <span className="text-xs text-apple-textSecondary font-mono">
              Case {selectedIdx + 1} of {filteredCases.length}
            </span>
          </div>

          {!selectedCase ? (
            <div className="text-center py-20 text-apple-textSecondary space-y-2">
              <User className="w-8 h-8 mx-auto opacity-50" />
              <p className="text-sm font-medium">Select a patient case to review structured findings.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Patient Banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 hairline-b">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-semibold tracking-tightHeading">
                      {selectedCase.patientName}
                    </h2>
                    <span className="text-xs uppercase font-mono px-2.5 py-0.5 rounded-full bg-apple-bgSecondary text-apple-textSecondary">
                      {selectedCase.mode}
                    </span>
                  </div>
                  <p className="text-xs text-apple-textSecondary mt-1">
                    ABHA: {selectedCase.patientAbhaId || 'Not linked'} • Case ID: {selectedCase._id}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditingField(prev => (prev ? null : 'history.chiefComplaint'))}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{editingField ? 'Done Editing (E)' : 'Edit Fields (E)'}</span>
                  </Button>

                  <Button size="sm" onClick={() => setConfirmSheetOpen(true)}>
                    <Check className="w-3.5 h-3.5" />
                    <span>Accept & Sign Off (A)</span>
                  </Button>
                </div>
              </div>

              {/* Red-Flag Banner */}
              {selectedCase.redFlags?.length > 0 && (
                <div className="p-4 rounded-[18px] bg-[#ff3b30]/10 border border-[#ff3b30]/30 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#ff3b30] uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Clinical Red Flags Detected ({selectedCase.redFlags.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {selectedCase.redFlags.map((rf, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-1.5 rounded-full bg-apple-surface hairline-border text-xs text-[#ff3b30] font-medium"
                      >
                        <strong>{rf.code}:</strong> {rf.name} ({rf.rationale})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 8-Section Standard Clinical Intake Summary */}
              <div className="space-y-5">
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
                      className="w-full rounded-[14px] bg-apple-bgSecondary hairline-border px-4 py-2.5 text-[16px] sm:text-base font-semibold"
                    />
                  ) : (
                    <p className="text-base sm:text-lg font-semibold text-apple-text">
                      {draftEdits['history.chiefComplaint']}
                    </p>
                  )}
                </div>

                {/* 2-6. Standard Clinical Sections Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-apple-bgSecondary p-4 sm:p-5 rounded-[20px] text-sm">
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
                        placeholder="Associations / details"
                        className="w-full rounded-[10px] bg-apple-surface hairline-border px-3 py-1.5 text-[16px] sm:text-xs"
                      />
                    ) : (
                      <p className="text-xs sm:text-sm text-apple-text">
                        {selectedCase.history?.hpi?.character || '—'} at {selectedCase.history?.hpi?.site || 'site'}. Radiation: {selectedCase.history?.hpi?.radiation || 'None'}. Severity: {selectedCase.history?.hpi?.severity}/10.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-apple-textSecondary">
                      3. Past Medical & Surgical
                    </p>
                    <p className="text-xs sm:text-sm text-apple-text">
                      {(selectedCase.history?.pastMedicalSurgical || []).join(', ') || 'None recorded'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-apple-textSecondary">
                      4. Drug & Allergy Profile
                    </p>
                    <p className="text-xs sm:text-sm text-apple-text">
                      {(selectedCase.history?.drugAllergy || []).join(', ') || 'No known drug allergies (NKDA)'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-apple-textSecondary">
                      5. Family & Personal History
                    </p>
                    <p className="text-xs sm:text-sm text-apple-text">
                      Diet: {selectedCase.history?.personal?.diet || 'Standard'} • Sleep: {selectedCase.history?.personal?.sleep || 'Normal'}
                    </p>
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-apple-textSecondary">
                      6. Review of Systems (ROS)
                    </p>
                    <p className="text-xs sm:text-sm text-apple-text">
                      Cardio: {selectedCase.history?.reviewOfSystems?.cardiovascular || 'Normal'} • Resp: {selectedCase.history?.reviewOfSystems?.respiratory || 'Normal'} • GI: {selectedCase.history?.reviewOfSystems?.gastrointestinal || 'Normal'} • Neuro: {selectedCase.history?.reviewOfSystems?.neurological || 'Normal'}
                    </p>
                  </div>
                </div>

                {/* 7. Ayush Dashavidha Pariksha */}
                {selectedCase.mode === 'ayush' && (
                  <div className="p-4 sm:p-5 rounded-[20px] bg-apple-bgSecondary space-y-2">
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
                            className="w-full rounded bg-apple-surface hairline-border px-2 py-1 text-[16px] sm:text-xs"
                          />
                        ) : (
                          <strong>{draftEdits['history.dashavidhaPariksha.vikriti'] || '—'}</strong>
                        )}
                      </div>
                      <div>
                        <span className="text-apple-textSecondary">Agni: </span>
                        <strong>{selectedCase.history?.dashavidhaPariksha?.aharaShakti || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-apple-textSecondary">Sara: </span>
                        <strong>{selectedCase.history?.dashavidhaPariksha?.sara || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-apple-textSecondary">Sattva: </span>
                        <strong>{selectedCase.history?.dashavidhaPariksha?.sattva || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-apple-textSecondary">Vaya: </span>
                        <strong>{selectedCase.history?.dashavidhaPariksha?.vaya || '—'}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* 8. Prior Investigations & Lab Timeline */}
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
                          className="p-3 rounded-[14px] bg-apple-bgSecondary text-xs font-mono space-y-1"
                        >
                          <div className="flex items-center justify-between text-apple-textSecondary">
                            <span>Field: {ed.field}</span>
                            <span>{new Date(ed.when).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-[#ff3b30] line-through">Old: {JSON.stringify(ed.old)}</p>
                          <p className="text-[#34c759]">New: {JSON.stringify(ed.new)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Confirmation & Amend Sheet */}
      <Sheet
        open={confirmSheetOpen}
        onClose={() => setConfirmSheetOpen(false)}
        title={t('physician.confirmReviewTitle')}
      >
        <div className="space-y-6">
          <p className="text-xs sm:text-sm text-apple-textSecondary">
            Review your clinical amendments before writing the permanent diff trail to the database.
          </p>

          <div className="p-4 rounded-[16px] bg-apple-bgSecondary space-y-2 text-xs">
            <p className="font-semibold text-apple-text">Pending Amendments:</p>
            {Object.entries(draftEdits).map(([k, v]) => (
              <div key={k} className="flex justify-between font-mono">
                <span className="text-apple-textSecondary truncate max-w-[150px] sm:max-w-[180px]">{k}:</span>
                <span className="font-semibold text-apple-text truncate max-w-[150px] sm:max-w-[180px]">{String(v)}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-4">
            <Button size="lg" className="w-full sm:flex-1" onClick={handleAcceptAndSignOff}>
              <Check className="w-4 h-4" />
              <span>Confirm & Sign Off</span>
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => setConfirmSheetOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
