import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Check,
  ChevronRight,
  ChevronLeft,
  UploadCloud,
  Plus,
  Trash2,
  ShieldCheck,
  Clock,
  AlertTriangle,
  FileText,
  Activity,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, Tooltip, YAxis } from 'recharts';
import questionTree from '../data/questionTree.json';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import {
  Button,
  Card,
  Segmented,
  Chip,
  Toggle,
  Skeleton
} from '../components/ui/Primitives';

function checkAbnormalClient(val, rangeStr) {
  const num = Number(val);
  if (Number.isNaN(num) || !rangeStr) return false;
  const m = String(rangeStr).trim().match(/^(-?\d+(?:\.\d+)?)\s*[-–to]+\s*(-?\d+(?:\.\d+)?)$/i);
  if (m) {
    return num < parseFloat(m[1]) || num > parseFloat(m[2]);
  }
  return false;
}

export default function PatientPortal() {
  const { patient, setPatient } = useAuth();
  const { lang, t } = useI18n();
  const { pushToast } = useToast();

  const [subTab, setSubTab] = useState('interview');
  const [mode, setMode] = useState('ayush');
  const [stepIdx, setStepIdx] = useState(0);
  const [inReviewStep, setInReviewStep] = useState(false);

  const [draftCaseId, setDraftCaseId] = useState(null);
  const [saveState, setSaveState] = useState('idle');
  const [listening, setListening] = useState(false);
  const [voiceNote, setVoiceNote] = useState('');

  const [history, setHistory] = useState({
    chiefComplaint: '',
    hpi: {
      site: '',
      onset: '',
      character: '',
      radiation: '',
      associations: '',
      timeCourse: '',
      exacerbatingRelieving: '',
      severity: 5
    },
    pastMedicalSurgical: 'Hypertension',
    drugAllergy: 'None',
    family: 'No significant familial disorder',
    personal: {
      diet: 'Sattvika vegetarian',
      sleep: '7 hours',
      bowelBladder: 'Regular',
      addictions: 'None',
      occupation: 'Professional'
    },
    reviewOfSystems: {
      cardiovascular: 'Normal',
      respiratory: 'Normal',
      gastrointestinal: 'Normal',
      neurological: 'Normal',
      musculoskeletal: 'Normal',
      general: 'Alert'
    },
    dashavidhaPariksha: {
      prakriti: 'Vata-Pitta Prakriti',
      vikriti: 'Tridoshaja with Ama predominance',
      sara: 'Madhyama',
      samhanana: 'Madhyama',
      pramana: '68 kg / 170 cm',
      satmya: 'Sarvarasa',
      sattva: 'Madhyama Sattva',
      aharaShakti: 'Mandagni (Low digestive capacity, coated tongue)',
      vyayamaShakti: 'Madhyama',
      vaya: 'Madhyama'
    }
  });

  // Document Upload State
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFileMeta, setUploadedFileMeta] = useState(null);
  const [docType, setDocType] = useState('labReport');
  const [diagnosesInput, setDiagnosesInput] = useState('Amavata, Subclinical Hypothyroidism');
  const [medications, setMedications] = useState([
    { name: 'Simhanada Guggulu', dose: '500mg BID' },
    { name: 'Rasnasaptaka Kwatha', dose: '15mL BID' }
  ]);
  const [investigations, setInvestigations] = useState([
    { name: 'ESR', value: 48, unit: 'mm/hr', refRange: '0-20' },
    { name: 'Hemoglobin', value: 13.4, unit: 'g/dL', refRange: '12.0-17.5' }
  ]);
  const [rawText, setRawText] = useState('AIIA Clinical Pathology Panel — Elevated ESR consistent with active Ama inflammation.');
  const [docSubmittedSuccess, setDocSubmittedSuccess] = useState(false);

  // Timeline State
  const [timelineData, setTimelineData] = useState([]);
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [expandedTimelineId, setExpandedTimelineId] = useState(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Consent State
  const [consentHistory, setConsentHistory] = useState([]);

  // Filter active steps based on adaptive branching conditions
  const activeSteps = useMemo(() => {
    const ccLower = (history.chiefComplaint || '').toLowerCase();
    const isChestPain = ccLower.includes('chest') || ccLower.includes('hridshoola') || ccLower.includes('retrosternal');
    return questionTree.steps.filter(s => {
      if (s.condition === 'chest_pain') return isChestPain;
      if (s.condition === 'ayush_mode') return mode === 'ayush';
      return true;
    });
  }, [history.chiefComplaint, mode]);

  const currentQuestion = activeSteps[Math.min(stepIdx, activeSteps.length - 1)];

  // Autosave Draft every 4 seconds when chiefComplaint has at least 3 chars
  useEffect(() => {
    if (!patient?._id || !history.chiefComplaint || history.chiefComplaint.trim().length < 3) return;
    setSaveState('saving');
    const timer = setTimeout(async () => {
      try {
        const formattedHistory = {
          ...history,
          pastMedicalSurgical: String(history.pastMedicalSurgical || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean),
          drugAllergy: String(history.drugAllergy || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean),
          family: String(history.family || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        };
        if (!draftCaseId) {
          const created = await apiRequest('/api/cases', {
            method: 'POST',
            body: {
              patientId: patient._id,
              mode,
              status: 'draft',
              history: formattedHistory
            }
          });
          setDraftCaseId(created._id);
        } else {
          await apiRequest(`/api/cases/${draftCaseId}`, {
            method: 'PATCH',
            body: { mode, history: formattedHistory }
          });
        }
        setSaveState('saved');
      } catch {
        setSaveState('idle');
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [history, mode, patient, draftCaseId]);

  // Keyboard Enter/Esc navigation inside interview
  useEffect(() => {
    if (subTab !== 'interview') return;
    const onKey = e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleNextStep();
        }
        return;
      }
      if (e.key === 'Escape') {
        handlePrevStep();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Load Timeline & Consent History when switching subTabs
  useEffect(() => {
    if (!patient?._id) return;
    if (subTab === 'timeline') {
      setLoadingTimeline(true);
      apiRequest(`/api/documents/patient/${patient._id}/timeline`)
        .then(res => setTimelineData(res.timeline || []))
        .catch(() => {})
        .finally(() => setLoadingTimeline(false));
    } else if (subTab === 'consent') {
      apiRequest(`/api/consent-history/${patient._id}`)
        .then(res => setConsentHistory(res.history || []))
        .catch(() => {});
    }
  }, [subTab, patient]);

  function handleNextStep() {
    if (inReviewStep) return;
    if (stepIdx < activeSteps.length - 1) {
      setStepIdx(prev => prev + 1);
    } else {
      setInReviewStep(true);
    }
  }

  function handlePrevStep() {
    if (inReviewStep) {
      setInReviewStep(false);
    } else if (stepIdx > 0) {
      setStepIdx(prev => prev - 1);
    }
  }

  function handleVoiceDictation(onResultText) {
    setVoiceNote('');
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setVoiceNote(t('patient.voiceUnsupported'));
      pushToast({
        title: 'Voice Dictation Fallback',
        description: t('patient.voiceUnsupported'),
        type: 'info'
      });
      return;
    }
    try {
      const recognition = new SpeechRec();
      recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
      recognition.interimResults = false;
      setListening(true);
      recognition.onresult = event => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript) onResultText(transcript);
        setListening(false);
      };
      recognition.onerror = () => {
        setListening(false);
      };
      recognition.onend = () => {
        setListening(false);
      };
      recognition.start();
    } catch {
      setListening(false);
      setVoiceNote(t('patient.voiceUnsupported'));
    }
  }

  async function handleSubmitFinalCase() {
    if (!patient?._id) return;
    try {
      const formattedHistory = {
        ...history,
        pastMedicalSurgical: String(history.pastMedicalSurgical || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
        drugAllergy: String(history.drugAllergy || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
        family: String(history.family || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      };

      let targetId = draftCaseId;
      if (!targetId) {
        const created = await apiRequest('/api/cases', {
          method: 'POST',
          body: {
            patientId: patient._id,
            mode,
            status: 'draft',
            history: formattedHistory
          }
        });
        targetId = created._id;
      }

      const submitted = await apiRequest(`/api/cases/${targetId}/submit`, {
        method: 'POST'
      });

      pushToast({
        title: 'Clinical Case Submitted',
        description: `Priority Score: ${submitted.priority}/100 • Red Flags: ${submitted.redFlags?.length || 0}`,
        type: submitted.redFlags?.length ? 'error' : 'success'
      });

      setDraftCaseId(null);
      setInReviewStep(false);
      setStepIdx(0);
      setSubTab('timeline');
    } catch (err) {
      pushToast({ title: 'Submission Error', description: err.message, type: 'error' });
    }
  }

  async function handleSaveDocument(e) {
    e.preventDefault();
    if (!patient?._id) return;
    try {
      const created = await apiRequest('/api/documents', {
        method: 'POST',
        body: {
          patientId: patient._id,
          docType,
          extracted: {
            diagnoses: diagnosesInput.split(',').map(s => s.trim()).filter(Boolean),
            medications: medications.filter(m => m.name.trim()),
            investigations: investigations
              .filter(i => i.name.trim())
              .map(i => ({
                name: i.name.trim(),
                value: Number(i.value),
                unit: i.unit.trim() || 'unit',
                refRange: i.refRange.trim() || '0-100'
              }))
          },
          rawText
        }
      });

      const abnCount = (created.extracted?.investigations || []).filter(i => i.abnormal).length;
      setDocSubmittedSuccess(true);
      setTimeout(() => setDocSubmittedSuccess(false), 3000);

      pushToast({
        title: 'Medical Document Structured',
        description: abnCount
          ? `${abnCount} abnormal investigation value(s) flagged in red.`
          : 'All lab investigations within normal reference range.',
        type: abnCount ? 'error' : 'success'
      });
    } catch (err) {
      pushToast({ title: 'Document Upload Failed', description: err.message, type: 'error' });
    }
  }

  async function handleToggleConsent(field, nextVal) {
    if (!patient?._id) return;
    const optimistic = {
      ...patient.consent,
      [field]: nextVal,
      updatedAt: new Date().toISOString()
    };
    setPatient({ ...patient, consent: optimistic });

    try {
      const updated = await apiRequest(`/api/patients/${patient._id}/consent`, {
        method: 'PATCH',
        body: {
          dataCapture: optimistic.dataCapture,
          sharing: optimistic.sharing,
          note: `Patient toggled ${field} to ${nextVal ? 'Enabled' : 'Revoked'}`
        }
      });
      setPatient(updated);
      const histRes = await apiRequest(`/api/consent-history/${patient._id}`);
      setConsentHistory(histRes.history || []);
      pushToast({
        title: 'Privacy Preference Saved',
        description: 'Recorded in immutable DPDP Act consent ledger.',
        type: 'success'
      });
    } catch (err) {
      pushToast({ title: 'Consent Update Failed', description: err.message, type: 'error' });
    }
  }

  // Build lab sparkline series from timeline documents
  const labSeriesMap = useMemo(() => {
    const map = {};
    const docs = timelineData.filter(e => e.entryType === 'document');
    for (const d of [...docs].reverse()) {
      for (const inv of d.extracted?.investigations || []) {
        if (!map[inv.name]) map[inv.name] = [];
        map[inv.name].push({
          date: new Date(d.date).toLocaleDateString(),
          value: Number(inv.value),
          unit: inv.unit,
          refRange: inv.refRange,
          abnormal: inv.abnormal
        });
      }
    }
    return map;
  }, [timelineData]);

  const progressPct = inReviewStep ? 100 : Math.round(((stepIdx + 1) / activeSteps.length) * 100);
  const circumference = 2 * Math.PI * 20;
  const strokeDashoffset = circumference - (progressPct / 100) * circumference;

  return (
    <div className="max-w-apple mx-auto px-4 sm:px-6 py-10 space-y-10">
      {/* Sub-navigation bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 hairline-b">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#0071e3]">
            Patient Health Portal
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tightHeading mt-0.5">
            {patient?.userId?.name || 'Clinical Intake & Personal Health Record'}
          </h1>
        </div>

        <Segmented
          idPrefix="patient_subtab"
          options={[
            { value: 'interview', label: t('patient.tabs.interview') },
            { value: 'documents', label: t('patient.tabs.documents') },
            { value: 'timeline', label: t('patient.tabs.timeline') },
            { value: 'consent', label: t('patient.tabs.consent') }
          ]}
          value={subTab}
          onChange={setSubTab}
        />
      </div>

      {/* TAB 1: FULL-SCREEN ONE-QUESTION-PER-SCREEN INTERVIEW */}
      {subTab === 'interview' && (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Segmented
              idPrefix="intake_mode"
              options={[
                { value: 'ayush', label: t('patient.modeAyush') },
                { value: 'allopathic', label: t('patient.modeAllopathic') }
              ]}
              value={mode}
              onChange={val => {
                setMode(val);
                setStepIdx(0);
                setInReviewStep(false);
              }}
            />

            <div className="flex items-center gap-4">
              {saveState !== 'idle' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-apple-textSecondary">
                  <Check className="w-3.5 h-3.5 text-[#34c759]" />
                  {saveState === 'saving' ? t('patient.autosaveSaving') : t('patient.autosaveSaved')}
                </span>
              )}

              <div className="relative h-12 w-12 flex items-center justify-center">
                <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    stroke="var(--border-hairline)"
                    strokeWidth="3.5"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    stroke="#0071e3"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-300"
                  />
                </svg>
                <span className="absolute text-[11px] font-semibold">{progressPct}%</span>
              </div>
            </div>
          </div>

          <Card className="p-8 sm:p-14 min-h-[460px] flex flex-col justify-between">
            <AnimatePresence mode="wait">
              {!inReviewStep && currentQuestion ? (
                <motion.div
                  key={currentQuestion.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  className="space-y-8"
                >
                  <div className="space-y-2">
                    <span className="text-xs font-mono uppercase tracking-wider text-[#0071e3]">
                      Question {stepIdx + 1} of {activeSteps.length}
                    </span>
                    <h2 className="text-2xl sm:text-4xl font-semibold tracking-tightHeading leading-tight">
                      {lang === 'hi' ? currentQuestion.titleHi : currentQuestion.titleEn}
                    </h2>
                    <p className="text-sm sm:text-base text-apple-textSecondary">
                      {lang === 'hi' ? currentQuestion.subtitleHi : currentQuestion.subtitleEn}
                    </p>
                  </div>

                  {/* Step Type 1: Chief Complaint / Radiation / Associations */}
                  {currentQuestion.type === 'text_with_chips' && (
                    <div className="space-y-5">
                      <div className="flex flex-wrap gap-2.5">
                        {currentQuestion.chips.map(chip => {
                          const currentVal =
                            currentQuestion.id === 'chiefComplaint'
                              ? history.chiefComplaint
                              : currentQuestion.id === 'socrates_radiation'
                              ? history.hpi.radiation
                              : history.hpi.associations;
                          return (
                            <Chip
                              key={chip}
                              active={currentVal === chip}
                              onClick={() => {
                                if (currentQuestion.id === 'chiefComplaint') {
                                  setHistory({ ...history, chiefComplaint: chip });
                                } else if (currentQuestion.id === 'socrates_radiation') {
                                  setHistory({ ...history, hpi: { ...history.hpi, radiation: chip } });
                                } else {
                                  setHistory({ ...history, hpi: { ...history.hpi, associations: chip } });
                                }
                              }}
                            >
                              {chip}
                            </Chip>
                          );
                        })}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="text"
                          value={
                            currentQuestion.id === 'chiefComplaint'
                              ? history.chiefComplaint
                              : currentQuestion.id === 'socrates_radiation'
                              ? history.hpi.radiation
                              : history.hpi.associations
                          }
                          onChange={e => {
                            const val = e.target.value;
                            if (currentQuestion.id === 'chiefComplaint') {
                              setHistory({ ...history, chiefComplaint: val });
                            } else if (currentQuestion.id === 'socrates_radiation') {
                              setHistory({ ...history, hpi: { ...history.hpi, radiation: val } });
                            } else {
                              setHistory({ ...history, hpi: { ...history.hpi, associations: val } });
                            }
                          }}
                          placeholder="Type your response here..."
                          className="flex-1 rounded-[18px] bg-apple-bgSecondary hairline-border px-5 py-3.5 text-base sm:text-lg text-apple-text focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
                        />

                        <Button
                          variant="secondary"
                          onClick={() =>
                            handleVoiceDictation(transcript => {
                              if (currentQuestion.id === 'chiefComplaint') {
                                setHistory(prev => ({ ...prev, chiefComplaint: transcript }));
                              } else if (currentQuestion.id === 'socrates_radiation') {
                                setHistory(prev => ({ ...prev, hpi: { ...prev.hpi, radiation: transcript } }));
                              } else {
                                setHistory(prev => ({ ...prev, hpi: { ...prev.hpi, associations: transcript } }));
                              }
                            })
                          }
                        >
                          {listening ? <MicOff className="w-4 h-4 text-[#ff3b30]" /> : <Mic className="w-4 h-4 text-[#0071e3]" />}
                          <span>{listening ? t('patient.voiceListening') : t('patient.voiceStart')}</span>
                        </Button>
                      </div>
                      {voiceNote && <p className="text-xs text-apple-textSecondary">{voiceNote}</p>}
                    </div>
                  )}

                  {/* Step Type 2: Site & Onset */}
                  {currentQuestion.type === 'dual_text_chips' && (
                    <div className="space-y-5">
                      <div className="flex flex-wrap gap-2.5">
                        {currentQuestion.chips.map(pair => {
                          const [sitePart, onsetPart] = pair.split('•').map(s => s.trim());
                          const active = history.hpi.site === sitePart && history.hpi.onset === onsetPart;
                          return (
                            <Chip
                              key={pair}
                              active={active}
                              onClick={() =>
                                setHistory({
                                  ...history,
                                  hpi: { ...history.hpi, site: sitePart, onset: onsetPart }
                                })
                              }
                            >
                              {pair}
                            </Chip>
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input
                          type="text"
                          value={history.hpi.site}
                          onChange={e => setHistory({ ...history, hpi: { ...history.hpi, site: e.target.value } })}
                          placeholder="Anatomical Site (e.g. Central chest, Bilateral knees)"
                          className="rounded-[18px] bg-apple-bgSecondary hairline-border px-5 py-3.5 text-base text-apple-text"
                        />
                        <input
                          type="text"
                          value={history.hpi.onset}
                          onChange={e => setHistory({ ...history, hpi: { ...history.hpi, onset: e.target.value } })}
                          placeholder="Onset & Duration (e.g. Sudden 1 hour ago)"
                          className="rounded-[18px] bg-apple-bgSecondary hairline-border px-5 py-3.5 text-base text-apple-text"
                        />
                      </div>
                    </div>
                  )}

                  {/* Step Type 3: Severity Slider */}
                  {currentQuestion.type === 'severity_slider' && (
                    <div className="space-y-6 py-4">
                      <div className="flex items-baseline justify-between">
                        <span className="text-6xl font-semibold tracking-tightHero text-[#0071e3]">
                          {history.hpi.severity}
                          <span className="text-2xl text-apple-textSecondary font-normal"> / 10</span>
                        </span>
                        <span
                          className={`px-3.5 py-1 rounded-full text-xs font-semibold ${
                            history.hpi.severity >= 8
                              ? 'bg-[#ff3b30]/15 text-[#ff3b30]'
                              : history.hpi.severity >= 5
                              ? 'bg-[#ff9f0a]/15 text-[#ff9f0a]'
                              : 'bg-[#34c759]/15 text-[#34c759]'
                          }`}
                        >
                          {history.hpi.severity >= 8
                            ? 'Severe / High Acuity'
                            : history.hpi.severity >= 5
                            ? 'Moderate Discomfort'
                            : 'Mild Discomfort'}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={history.hpi.severity}
                        onChange={e =>
                          setHistory({
                            ...history,
                            hpi: { ...history.hpi, severity: Number(e.target.value) }
                          })
                        }
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-apple-bgSecondary accent-[#0071e3]"
                      />
                      <div className="flex justify-between text-xs text-apple-textSecondary">
                        <span>1 — Minimal</span>
                        <span>5 — Moderate</span>
                        <span>10 — Critical Emergency</span>
                      </div>
                    </div>
                  )}

                  {/* Step Type 4: Past History & Drug Allergies */}
                  {currentQuestion.type === 'past_and_allergy' && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-apple-textSecondary">
                          Past Medical / Surgical Conditions
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {currentQuestion.chips.map(c => (
                            <Chip
                              key={c}
                              active={history.pastMedicalSurgical === c}
                              onClick={() => setHistory({ ...history, pastMedicalSurgical: c })}
                            >
                              {c}
                            </Chip>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={history.pastMedicalSurgical}
                          onChange={e => setHistory({ ...history, pastMedicalSurgical: e.target.value })}
                          className="w-full mt-2 rounded-[16px] bg-apple-bgSecondary hairline-border px-4 py-3 text-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-apple-textSecondary">
                          Known Drug or Food Allergies
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {currentQuestion.allergyChips.map(c => (
                            <Chip
                              key={c}
                              active={history.drugAllergy === c}
                              onClick={() => setHistory({ ...history, drugAllergy: c })}
                            >
                              {c}
                            </Chip>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={history.drugAllergy}
                          onChange={e => setHistory({ ...history, drugAllergy: e.target.value })}
                          className="w-full mt-2 rounded-[16px] bg-apple-bgSecondary hairline-border px-4 py-3 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {/* Step Type 5: Ayush Dashavidha Pariksha Pair */}
                  {currentQuestion.type === 'ayush_pair' && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-apple-textSecondary">
                          Primary Parameter
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {currentQuestion.chips.map(c => {
                            const key = currentQuestion.id === 'ayush_prakriti_vikriti' ? 'prakriti' : 'aharaShakti';
                            return (
                              <Chip
                                key={c}
                                active={history.dashavidhaPariksha[key] === c}
                                onClick={() =>
                                  setHistory({
                                    ...history,
                                    dashavidhaPariksha: { ...history.dashavidhaPariksha, [key]: c }
                                  })
                                }
                              >
                                {c}
                              </Chip>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-apple-textSecondary">
                          Secondary Parameter
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {currentQuestion.secondaryChips.map(c => {
                            const key = currentQuestion.id === 'ayush_prakriti_vikriti' ? 'vikriti' : 'sattva';
                            return (
                              <Chip
                                key={c}
                                active={history.dashavidhaPariksha[key] === c}
                                onClick={() =>
                                  setHistory({
                                    ...history,
                                    dashavidhaPariksha: { ...history.dashavidhaPariksha, [key]: c }
                                  })
                                }
                              >
                                {c}
                              </Chip>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                /* REVIEW SCREEN BEFORE SUBMIT */
                <motion.div
                  key="review_screen"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div>
                    <span className="text-xs font-mono uppercase tracking-wider text-[#34c759]">
                      Ready for Submission
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-semibold tracking-tightHeading mt-1">
                      {t('patient.reviewTitle')}
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-apple-bgSecondary p-6 rounded-[20px] text-sm">
                    <div>
                      <p className="text-xs text-apple-textSecondary">Clinical Mode</p>
                      <p className="font-semibold uppercase">{mode}</p>
                    </div>
                    <div>
                      <p className="text-xs text-apple-textSecondary">Chief Complaint</p>
                      <p className="font-semibold">{history.chiefComplaint || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-apple-textSecondary">Location & Onset</p>
                      <p className="font-medium">
                        {history.hpi.site || '—'} • {history.hpi.onset || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-apple-textSecondary">Associations & Severity</p>
                      <p className="font-medium">
                        {history.hpi.associations || 'None'} (VAS {history.hpi.severity}/10)
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-apple-textSecondary">Past History & Allergies</p>
                      <p className="font-medium">
                        {history.pastMedicalSurgical} • Allergies: {history.drugAllergy}
                      </p>
                    </div>
                    {mode === 'ayush' && (
                      <div>
                        <p className="text-xs text-apple-textSecondary">Dashavidha Pariksha</p>
                        <p className="font-medium">
                          {history.dashavidhaPariksha.prakriti} • {history.dashavidhaPariksha.vikriti}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="pt-8 mt-8 hairline-t flex items-center justify-between">
              <Button
                variant="secondary"
                onClick={handlePrevStep}
                disabled={stepIdx === 0 && !inReviewStep}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>{t('patient.prevStep')}</span>
              </Button>

              {!inReviewStep ? (
                <Button onClick={handleNextStep}>
                  <span>{t('patient.nextStep')}</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmitFinalCase} size="lg">
                  <Check className="w-4 h-4" />
                  <span>{t('patient.submitBtn')}</span>
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: DOCUMENT UPLOAD & DYNAMIC EXTRACTED FORM */}
      {subTab === 'documents' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <Card className="lg:col-span-5 p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tightHeading">
                Prior Medical Document Capture
              </h2>
              <p className="text-xs sm:text-sm text-apple-textSecondary">
                Drop a prescription, laboratory report, or discharge summary to attach metadata, and verify the structured clinical values on the right.
              </p>
            </div>

            <div
              onDragOver={e => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={e => {
                e.preventDefault();
                setDragActive(false);
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  setUploadedFileMeta({
                    name: file.name,
                    sizeKb: (file.size / 1024).toFixed(1),
                    type: file.type || 'application/pdf'
                  });
                }
              }}
              className={`rounded-[20px] border-2 border-dashed p-8 text-center transition ${
                dragActive ? 'border-[#0071e3] bg-[#0071e3]/5' : 'border-apple-border bg-apple-bgSecondary'
              }`}
            >
              <UploadCloud className="w-10 h-10 text-[#0071e3] mx-auto mb-3" />
              <p className="text-sm font-medium text-apple-text">
                Drag and drop report file here, or browse
              </p>
              <p className="text-xs text-apple-textSecondary mt-1">
                Supports PDF, JPG, PNG clinical reports
              </p>
              <label className="mt-4 inline-block cursor-pointer px-4 py-2 rounded-full bg-apple-surface hairline-border text-xs font-medium">
                Select File
                <input
                  type="file"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setUploadedFileMeta({
                        name: file.name,
                        sizeKb: (file.size / 1024).toFixed(1),
                        type: file.type || 'application/pdf'
                      });
                    }
                  }}
                />
              </label>
            </div>

            {uploadedFileMeta && (
              <div className="p-4 rounded-[16px] bg-apple-bgSecondary flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-5 h-5 text-[#0071e3] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{uploadedFileMeta.name}</p>
                    <p className="text-[11px] text-apple-textSecondary">
                      {uploadedFileMeta.sizeKb} KB • {uploadedFileMeta.type}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-medium text-[#34c759]">Attached</span>
              </div>
            )}
          </Card>

          <Card className="lg:col-span-7 p-8">
            <form onSubmit={handleSaveDocument} className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h3 className="text-lg font-semibold tracking-tightHeading">
                  Structured Clinical Entities
                </h3>
                <Segmented
                  idPrefix="doc_type"
                  options={[
                    { value: 'labReport', label: 'Lab Report' },
                    { value: 'prescription', label: 'Prescription' },
                    { value: 'dischargeSummary', label: 'Discharge Summary' }
                  ]}
                  value={docType}
                  onChange={setDocType}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-apple-textSecondary mb-2">
                  Extracted Diagnoses (comma-separated)
                </label>
                <input
                  type="text"
                  value={diagnosesInput}
                  onChange={e => setDiagnosesInput(e.target.value)}
                  className="w-full rounded-[14px] bg-apple-bgSecondary hairline-border px-4 py-2.5 text-sm"
                />
              </div>

              {/* Dynamic Medications Rows */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-apple-textSecondary">
                    Medications ({medications.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setMedications([...medications, { name: '', dose: '' }])}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#0071e3]"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Medication
                  </button>
                </div>
                {medications.map((med, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Medication name (e.g. Simhanada Guggulu)"
                      value={med.name}
                      onChange={e => {
                        const next = [...medications];
                        next[idx].name = e.target.value;
                        setMedications(next);
                      }}
                      className="flex-1 rounded-[12px] bg-apple-bgSecondary hairline-border px-3 py-2 text-xs sm:text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Dosage (e.g. 500mg BID)"
                      value={med.dose}
                      onChange={e => {
                        const next = [...medications];
                        next[idx].dose = e.target.value;
                        setMedications(next);
                      }}
                      className="w-40 rounded-[12px] bg-apple-bgSecondary hairline-border px-3 py-2 text-xs sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setMedications(medications.filter((_, i) => i !== idx))}
                      className="p-2 text-apple-textSecondary hover:text-[#ff3b30]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Dynamic Lab Investigations Rows with Live Abnormal Red Highlight */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-apple-textSecondary">
                    Laboratory Investigations ({investigations.length})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setInvestigations([
                        ...investigations,
                        { name: '', value: '', unit: 'mg/dL', refRange: '70-100' }
                      ])
                    }
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#0071e3]"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Lab Row
                  </button>
                </div>
                {investigations.map((inv, idx) => {
                  const isAbn = checkAbnormalClient(inv.value, inv.refRange);
                  return (
                    <div
                      key={idx}
                      className={`grid grid-cols-12 gap-2 items-center p-2.5 rounded-[14px] transition ${
                        isAbn
                          ? 'bg-[#ff3b30]/10 border border-[#ff3b30]/40'
                          : 'bg-apple-bgSecondary hairline-border'
                      }`}
                    >
                      <input
                        type="text"
                        placeholder="Test (e.g. ESR)"
                        value={inv.name}
                        onChange={e => {
                          const next = [...investigations];
                          next[idx].name = e.target.value;
                          setInvestigations(next);
                        }}
                        className="col-span-4 bg-transparent text-xs sm:text-sm font-medium focus:outline-none"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Value"
                        value={inv.value}
                        onChange={e => {
                          const next = [...investigations];
                          next[idx].value = e.target.value;
                          setInvestigations(next);
                        }}
                        className={`col-span-2 bg-transparent text-xs sm:text-sm font-semibold focus:outline-none ${
                          isAbn ? 'text-[#ff3b30]' : 'text-apple-text'
                        }`}
                      />
                      <input
                        type="text"
                        placeholder="Unit"
                        value={inv.unit}
                        onChange={e => {
                          const next = [...investigations];
                          next[idx].unit = e.target.value;
                          setInvestigations(next);
                        }}
                        className="col-span-2 bg-transparent text-xs text-apple-textSecondary focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Ref (0-20)"
                        value={inv.refRange}
                        onChange={e => {
                          const next = [...investigations];
                          next[idx].refRange = e.target.value;
                          setInvestigations(next);
                        }}
                        className="col-span-3 bg-transparent text-xs font-mono text-apple-textSecondary focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setInvestigations(investigations.filter((_, i) => i !== idx))}
                        className="col-span-1 flex justify-end text-apple-textSecondary hover:text-[#ff3b30]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-4 hairline-t">
                {docSubmittedSuccess ? (
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#34c759]">
                    <Check className="w-4 h-4" /> Saved to MedicalDocument Collection
                  </span>
                ) : (
                  <span className="text-xs text-apple-textSecondary">
                    Abnormal values are auto-flagged in red.
                  </span>
                )}
                <Button type="submit">Save Medical Record</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* TAB 3: UNIFIED HEALTH TIMELINE + LAB SPARKLINES */}
      {subTab === 'timeline' && (
        <div className="space-y-8">
          {Object.keys(labSeriesMap).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(labSeriesMap)
                .slice(0, 3)
                .map(([testName, points]) => {
                  const latest = points[points.length - 1];
                  return (
                    <Card key={testName} className="p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-apple-textSecondary">
                          {testName} Trend
                        </span>
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                            latest?.abnormal
                              ? 'bg-[#ff3b30]/15 text-[#ff3b30]'
                              : 'bg-[#34c759]/15 text-[#34c759]'
                          }`}
                        >
                          {latest?.value} {latest?.unit}
                        </span>
                      </div>
                      <div className="h-20">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={points}>
                            <YAxis domain={['auto', 'auto']} hide />
                            <Tooltip
                              contentStyle={{
                                borderRadius: 12,
                                border: '1px solid var(--border-hairline)',
                                fontSize: 12
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="value"
                              stroke={latest?.abnormal ? '#ff3b30' : '#0071e3'}
                              strokeWidth={2.5}
                              dot={{ r: 3 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="text-[11px] text-apple-textSecondary font-mono">
                        Reference Range: {latest?.refRange} {latest?.unit}
                      </p>
                    </Card>
                  );
                })}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Chip active={timelineFilter === 'all'} onClick={() => setTimelineFilter('all')}>
              All Events ({timelineData.length})
            </Chip>
            <Chip active={timelineFilter === 'case'} onClick={() => setTimelineFilter('case')}>
              Clinical Cases
            </Chip>
            <Chip active={timelineFilter === 'document'} onClick={() => setTimelineFilter('document')}>
              Lab & Prescriptions
            </Chip>
          </div>

          {loadingTimeline ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="relative pl-6 border-l border-apple-border space-y-6">
              {timelineData
                .filter(ev => timelineFilter === 'all' || ev.entryType === timelineFilter)
                .map(ev => {
                  const expanded = expandedTimelineId === ev._id;
                  return (
                    <Card
                      key={ev._id}
                      onClick={() => setExpandedTimelineId(expanded ? null : ev._id)}
                      className="p-6 cursor-pointer hover:shadow-appleHover"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-9 w-9 rounded-full flex items-center justify-center ${
                              ev.entryType === 'case'
                                ? 'bg-[#0071e3]/10 text-[#0071e3]'
                                : 'bg-[#34c759]/10 text-[#34c759]'
                            }`}
                          >
                            {ev.entryType === 'case' ? (
                              <Activity className="w-4 h-4" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <p className="text-base font-semibold text-apple-text">{ev.title}</p>
                            <p className="text-xs text-apple-textSecondary">
                              {new Date(ev.date).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}{' '}
                              • {ev.entryType.toUpperCase()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {ev.priority !== undefined && (
                            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-apple-bgSecondary">
                              Priority {ev.priority}
                            </span>
                          )}
                          {expanded ? (
                            <ChevronUp className="w-4 h-4 text-apple-textSecondary" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-apple-textSecondary" />
                          )}
                        </div>
                      </div>

                      {expanded && (
                        <div className="mt-4 pt-4 hairline-t text-xs sm:text-sm text-apple-textSecondary space-y-2">
                          {ev.entryType === 'case' ? (
                            <>
                              <p>
                                <strong className="text-apple-text">HPI:</strong> {ev.history?.hpi?.site || '—'} •{' '}
                                {ev.history?.hpi?.associations || '—'}
                              </p>
                              {ev.redFlags?.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {ev.redFlags.map((rf, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#ff3b30]/15 text-[#ff3b30] text-xs font-medium"
                                    >
                                      <AlertTriangle className="w-3 h-3" /> {rf.code}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {(ev.extracted?.investigations || []).map((inv, idx) => (
                                <span
                                  key={idx}
                                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    inv.abnormal
                                      ? 'bg-[#ff3b30]/15 text-[#ff3b30]'
                                      : 'bg-apple-bgSecondary text-apple-text'
                                  }`}
                                >
                                  {inv.name}: {inv.value} {inv.unit} (Ref {inv.refRange})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: APPLE PRIVACY CONSENT CENTER + TIMESTAMPED AUDIT LEDGER */}
      {subTab === 'consent' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <Card className="lg:col-span-7 p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#34c759]/15 text-[#34c759] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tightHeading">
                  {t('patient.consentTitle')}
                </h2>
                <p className="text-xs text-apple-textSecondary">{t('patient.consentSubtitle')}</p>
              </div>
            </div>

            <div className="divide-y divide-apple-border">
              <Toggle
                checked={patient?.consent?.dataCapture ?? true}
                onChange={val => handleToggleConsent('dataCapture', val)}
                label={t('patient.dataCaptureTitle')}
                description={t('patient.dataCaptureDesc')}
              />
              <Toggle
                checked={patient?.consent?.sharing ?? false}
                onChange={val => handleToggleConsent('sharing', val)}
                label={t('patient.sharingTitle')}
                description={t('patient.sharingDesc')}
              />
            </div>
          </Card>

          <Card className="lg:col-span-5 p-8 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-apple-textSecondary">
              <Clock className="w-4 h-4 text-[#0071e3]" />
              <span>{t('patient.consentAuditTitle')}</span>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {consentHistory.map((item, idx) => (
                <div key={idx} className="p-3.5 rounded-[16px] bg-apple-bgSecondary space-y-1 text-xs">
                  <div className="flex items-center justify-between font-semibold text-apple-text">
                    <span>
                      Capture: {item.dataCapture ? 'Granted' : 'Revoked'} • Sharing:{' '}
                      {item.sharing ? 'Granted' : 'Revoked'}
                    </span>
                    <span className="text-[11px] font-mono text-apple-textSecondary">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-apple-textSecondary">{item.note}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
