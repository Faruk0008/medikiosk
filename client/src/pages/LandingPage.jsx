import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Fingerprint,
  MessageSquare,
  FileScan,
  Sparkles,
  Stethoscope,
  ShieldCheck,
  Database,
  Gauge,
  AlertTriangle,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { Button, Card, AnimatedNumber } from '../components/ui/Primitives';

const JOURNEY_STEPS = [
  {
    step: '01',
    id: 'identify',
    label: 'Identify',
    title: 'Zero-friction ABHA & consent onboarding.',
    description:
      'Patients authenticate with their 14-digit Ayushman Bharat Health Account (ABHA) ID or register in seconds, selecting English or Hindi and granting granular DPDP Act 2023 consent.',
    icon: Fingerprint,
    previewTitle: 'ABHA Identity & Consent Ledger',
    previewMetric: '14-2233-4455-6677 • Verified',
    previewPills: ['DPDP Act 2023 Compliant', 'Revocable Sharing', 'Sparse Unique Index']
  },
  {
    step: '02',
    id: 'converse',
    label: 'Converse',
    title: 'Adaptive SOCRATES & Dashavidha Pariksha interview.',
    description:
      'One focused question per screen. Mentioning chest pain automatically triggers cardiac SOCRATES probes; selecting Ayush mode captures Prakriti, Vikriti, Agni, and Sattva.',
    icon: MessageSquare,
    previewTitle: 'Adaptive Clinical Branching',
    previewMetric: 'SOCRATES + Dashavidha Pariksha',
    previewPills: ['Voice + Touch Input', 'Draft Autosave', '7-Day TTL Cleanup']
  },
  {
    step: '03',
    id: 'scan',
    label: 'Scan',
    title: 'Prior prescriptions & lab panels, structured.',
    description:
      'Patients upload prior lab reports and discharge summaries. Out-of-range values like elevated Troponin-I or ESR are automatically highlighted against clinical reference ranges.',
    icon: FileScan,
    previewTitle: 'Automated Lab Reference Flagger',
    previewMetric: 'Troponin-I: 0.85 ng/mL (Ref: 0–0.04)',
    previewPills: ['Critical High Flagged', 'Chronological Indexing', 'Medication Extraction']
  },
  {
    step: '04',
    id: 'summarize',
    label: 'Summarize',
    title: 'Real-time Red-Flag triage before the consultation.',
    description:
      'On submission, the Red-Flag Engine evaluates 6 acute emergency syndromes and lab derangements, computing a 0–100 priority score and routing critical cases to the top of the Triage Board.',
    icon: Sparkles,
    previewTitle: 'Triage Priority Queue (ESR Index)',
    previewMetric: 'Priority Score: 95 / 100 • CRITICAL',
    previewPills: ['RF_ACS_01 Triggered', 'Compound Index IXSCAN', '5s Live Sync']
  },
  {
    step: '05',
    id: 'consult',
    label: 'Consult',
    title: 'Physician review in seconds, with immutable audit logs.',
    description:
      'The attending physician reads a standardized clinical summary (Chief Complaint → HPI → ROS → Dashavidha Pariksha → Labs), amends findings inline, and signs off with field-level diff tracking.',
    icon: Stethoscope,
    previewTitle: 'Physician Amendment Diff Ledger',
    previewMetric: 'Status: Reviewed & Signed',
    previewPills: ['Inline Section Edit', 'Full Audit Trail', '$unionWith Timeline']
  }
];

export default function LandingPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);
  const interactionTimer = useRef(null);
  const journeyRef = useRef(null);
  const AUTO_CYCLE_MS = 3500;

  // Auto-cycle through steps
  useEffect(() => {
    if (userInteracted) return;
    const interval = setInterval(() => {
      setActiveStep(prev => (prev + 1) % JOURNEY_STEPS.length);
    }, AUTO_CYCLE_MS);
    return () => clearInterval(interval);
  }, [userInteracted]);

  // When user clicks a step, pause auto-cycle for 8 seconds then resume
  const handleStepClick = useCallback((idx) => {
    setActiveStep(idx);
    setUserInteracted(true);
    if (interactionTimer.current) clearTimeout(interactionTimer.current);
    interactionTimer.current = setTimeout(() => setUserInteracted(false), 8000);
  }, []);

  // Scroll-based step detection using IntersectionObserver
  useEffect(() => {
    const section = journeyRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const idx = Number(entry.target.getAttribute('data-journey-index'));
            if (!isNaN(idx)) {
              setActiveStep(idx);
              setUserInteracted(true);
              if (interactionTimer.current) clearTimeout(interactionTimer.current);
              interactionTimer.current = setTimeout(() => setUserInteracted(false), 5000);
            }
          }
        });
      },
      { root: null, rootMargin: '-30% 0px -30% 0px', threshold: 0.5 }
    );

    const items = section.querySelectorAll('[data-journey-index]');
    items.forEach((el) => observer.observe(el));

    return () => {
      items.forEach((el) => observer.unobserve(el));
      if (interactionTimer.current) clearTimeout(interactionTimer.current);
    };
  }, []);

  function handlePrimaryAction() {
    if (user) {
      navigate(user.role === 'physician' ? '/app/physician' : user.role === 'triage' ? '/app/triage' : '/app/patient');
    } else {
      navigate('/login?mode=register');
    }
  }

  const currentStepObj = JOURNEY_STEPS[activeStep] || JOURNEY_STEPS[0];
  const StepIcon = currentStepObj.icon;

  return (
    <div className="bg-apple-bg text-apple-text overflow-x-hidden">
      {/* Hero Section */}
      <section id="overview" className="py-20 sm:py-32 md:py-36 px-4 sm:px-6">
        <div className="max-w-apple mx-auto text-center">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-[#0071e3] mb-3 sm:mb-4"
          >
            {t('landing.eyebrow')}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="text-[clamp(2.25rem,6vw+0.5rem,4.5rem)] font-semibold tracking-tightHero leading-[1.06] max-w-4xl mx-auto"
          >
            {t('landing.heroTitle')}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="mt-5 sm:mt-6 text-base sm:text-xl text-apple-textSecondary max-w-2xl mx-auto font-normal leading-relaxed px-2"
          >
            {t('landing.heroSub')}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
            className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 max-w-xs sm:max-w-none mx-auto"
          >
            <Button size="lg" onClick={handlePrimaryAction} className="w-full sm:w-auto">
              <span>{t('landing.ctaPrimary')}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => navigate(user ? '/app/physician' : '/login')}
              className="w-full sm:w-auto"
            >
              {t('landing.ctaSecondary')}
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Big Stat Band */}
      <section className="py-14 sm:py-20 bg-apple-bgSecondary hairline-t hairline-b px-4 sm:px-6">
        <div className="max-w-apple mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10 text-center sm:text-left">
          <div className="space-y-1.5 sm:space-y-2">
            <p className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tightHero text-apple-text">
              <AnimatedNumber value={140.3} decimals={1} suffix="x" />
            </p>
            <p className="text-sm sm:text-base font-semibold text-apple-text">{t('landing.stat1Label')}</p>
            <p className="text-xs sm:text-sm text-apple-textSecondary">{t('landing.stat1Sub')}</p>
          </div>
          <div className="space-y-1.5 sm:space-y-2">
            <p className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tightHero text-[#0071e3]">
              <AnimatedNumber value={0} decimals={0} />
            </p>
            <p className="text-sm sm:text-base font-semibold text-apple-text">{t('landing.stat2Label')}</p>
            <p className="text-xs sm:text-sm text-apple-textSecondary">{t('landing.stat2Sub')}</p>
          </div>
          <div className="space-y-1.5 sm:space-y-2">
            <p className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tightHero text-[#34c759]">
              <AnimatedNumber value={78} decimals={0} suffix="%" />
            </p>
            <p className="text-sm sm:text-base font-semibold text-apple-text">{t('landing.stat3Label')}</p>
            <p className="text-xs sm:text-sm text-apple-textSecondary">{t('landing.stat3Sub')}</p>
          </div>
        </div>
      </section>

      {/* 5-Step Patient Journey (Stacked on Mobile, Sticky on Desktop) */}
      <section id="journey" className="py-20 sm:py-28 px-4 sm:px-6" ref={journeyRef}>
        <div className="max-w-apple mx-auto">
          <div className="max-w-2xl mb-12 sm:mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0071e3] mb-2">
              End-to-End Clinical Flow
            </p>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-semibold tracking-tightHeading">
              {t('landing.journeyHeader')}
            </h2>
          </div>

          {/* Step Progress Dots (Desktop) */}
          <div className="hidden lg:flex items-center gap-2 mb-10">
            {JOURNEY_STEPS.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => handleStepClick(idx)}
                className="group flex items-center gap-1.5 focus:outline-none"
                aria-label={`Go to step ${item.step}`}
              >
                <div className={`relative h-1.5 rounded-full transition-all duration-500 ${
                  idx === activeStep ? 'w-10 bg-[#0071e3]' : 'w-4 bg-apple-textSecondary/20 group-hover:bg-apple-textSecondary/40'
                }`}>
                  {idx === activeStep && !userInteracted && (
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full bg-[#0071e3]/60"
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: AUTO_CYCLE_MS / 1000, ease: 'linear' }}
                      key={`progress-${activeStep}`}
                    />
                  )}
                </div>
              </button>
            ))}
            <span className="ml-2 text-[11px] font-mono text-apple-textSecondary">
              {String(activeStep + 1).padStart(2, '0')} / {String(JOURNEY_STEPS.length).padStart(2, '0')}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
            {/* Step Descriptions */}
            <div className="lg:col-span-6 space-y-12 sm:space-y-20">
              {JOURNEY_STEPS.map((item, idx) => {
                const active = idx === activeStep;
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    data-journey-index={idx}
                    onClick={() => handleStepClick(idx)}
                    className={`cursor-pointer transition-all duration-500 ${
                      active ? 'opacity-100 translate-x-0' : 'opacity-40 hover:opacity-75'
                    }`}
                  >
                    <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#0071e3] mb-2 sm:mb-3">
                      <span>Step {item.step}</span>
                      <span>•</span>
                      <span>{item.label}</span>
                    </div>
                    <h3 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tightHeading mb-2 sm:mb-3">
                      {item.title}
                    </h3>
                    <p className="text-sm sm:text-base text-apple-textSecondary leading-relaxed">
                      {item.description}
                    </p>

                    {/* Mobile-only inline preview card */}
                    {active && (
                      <motion.div
                        className="block lg:hidden mt-5"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Card className="p-5 bg-apple-bgSecondary space-y-3">
                          <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-apple-textSecondary">
                            <span>{item.previewTitle}</span>
                            <Icon className="w-4 h-4 text-[#0071e3]" />
                          </div>
                          <p className="text-base sm:text-lg font-semibold text-apple-text">
                            {item.previewMetric}
                          </p>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {item.previewPills.map(pill => (
                              <span
                                key={pill}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-apple-surface text-apple-text hairline-border"
                              >
                                <CheckCircle2 className="w-3 h-3 text-[#34c759]" />
                                {pill}
                              </span>
                            ))}
                          </div>
                        </Card>
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop Sticky Preview Card */}
            <div className="hidden lg:block lg:col-span-6 lg:sticky lg:top-24">
              <Card className="p-8 sm:p-10 min-h-[360px] flex flex-col justify-between bg-apple-bgSecondary overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-apple-textSecondary">
                    Step {currentStepObj.step} — {currentStepObj.label}
                  </span>
                  <motion.div
                    className="h-10 w-10 rounded-full bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center"
                    key={`icon-${currentStepObj.id}`}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  >
                    <StepIcon className="w-5 h-5" />
                  </motion.div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStepObj.id}
                    initial={{ opacity: 0, y: 20, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                    className="my-8 p-6 rounded-[20px] bg-apple-surface hairline-border shadow-apple space-y-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-apple-textSecondary">
                      {currentStepObj.previewTitle}
                    </p>
                    <p className="text-xl sm:text-2xl font-semibold text-apple-text">
                      {currentStepObj.previewMetric}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {currentStepObj.previewPills.map((pill, pIdx) => (
                        <motion.span
                          key={pill}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: pIdx * 0.08 + 0.15 }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-apple-bgSecondary text-apple-text"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#34c759]" />
                          {pill}
                        </motion.span>
                      ))}
                    </div>
                  </motion.div>
                </AnimatePresence>

                <div className="flex items-center justify-between text-xs text-apple-textSecondary">
                  <span>SIH26047 • All India Institute of Ayurveda</span>
                  <span>MongoDB $jsonSchema Validated</span>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid of Capabilities */}
      <section id="capabilities" className="py-20 sm:py-28 bg-apple-bgSecondary hairline-t px-4 sm:px-6">
        <div className="max-w-apple mx-auto">
          <div className="max-w-2xl mb-10 sm:mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0071e3] mb-2">
              CSE494 NoSQL Architecture
            </p>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-semibold tracking-tightHeading">
              {t('landing.bentoHeader')}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 sm:gap-6">
            <Card className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between">
              <div className="space-y-3">
                <Database className="w-6 h-6 text-[#0071e3]" />
                <h3 className="text-xl sm:text-2xl font-semibold tracking-tightHeading">
                  Polymorphic Clinical Document Model
                </h3>
                <p className="text-sm sm:text-base text-apple-textSecondary leading-relaxed">
                  Allopathic HPI and Ayurvedic ten-fold Dashavidha Pariksha coexist in a single collection with embedded history, redFlags, and physicianEdits—enforced at the storage engine layer via MongoDB $jsonSchema.
                </p>
              </div>
              <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 hairline-t flex flex-wrap gap-2 sm:gap-3 text-xs font-mono text-apple-textSecondary">
                <span>Embedded 1:1 History</span>
                <span>•</span>
                <span>Referenced 1:N Documents</span>
                <span>•</span>
                <span>M:N Physician Assignments</span>
              </div>
            </Card>

            <div className="lg:col-span-5 rounded-[20px] sm:rounded-[24px] bg-[#1d1d1f] text-[#f5f5f7] p-6 sm:p-10 flex flex-col justify-between shadow-apple">
              <div className="space-y-3">
                <AlertTriangle className="w-6 h-6 text-[#ff3b30]" />
                <h3 className="text-xl sm:text-2xl font-semibold tracking-tightHeading">
                  Clinical Red-Flag Engine
                </h3>
                <p className="text-sm text-[#98989d] leading-relaxed">
                  Automatically detects Acute Coronary Syndrome, Stroke FAST deficits, Hemorrhage, Anaphylaxis, Meningism, and critical lab values the moment a case is submitted.
                </p>
              </div>
              <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-white/10 text-xs font-mono text-[#ff9f0a]">
                Priority Queue • {'{ status: 1, priority: -1, createdAt: 1 }'}
              </div>
            </div>

            <Card className="lg:col-span-5 p-6 sm:p-10 flex flex-col justify-between">
              <div className="space-y-3">
                <ShieldCheck className="w-6 h-6 text-[#34c759]" />
                <h3 className="text-lg sm:text-xl font-semibold tracking-tightHeading">
                  DPDP Act 2023 Consent Ledger
                </h3>
                <p className="text-sm text-apple-textSecondary leading-relaxed">
                  Every consent toggle writes a timestamped audit entry. Revoking data capture immediately blocks new clinical intake.
                </p>
              </div>
              <div className="mt-5 text-xs text-apple-textSecondary font-mono">
                GET /api/consent-history/:patientId
              </div>
            </Card>

            <Card className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between">
              <div className="space-y-3">
                <Gauge className="w-6 h-6 text-[#0071e3]" />
                <h3 className="text-lg sm:text-xl font-semibold tracking-tightHeading">
                  Covered Queries & Multi-Stage Aggregations
                </h3>
                <p className="text-sm text-apple-textSecondary leading-relaxed">
                  Live hospital telemetry powered by $group, $dateToString, $unwind, $lookup, and $unionWith pipelines—plus covered index queries examining zero collection documents.
                </p>
              </div>
              <div className="mt-5 text-xs text-apple-textSecondary font-mono">
                PROJECTION_COVERED • totalDocsExamined: 0
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="py-10 sm:py-12 px-4 sm:px-6 hairline-t text-xs text-apple-textSecondary">
        <div className="max-w-apple mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <p>MediKiosk Prototype • Smart India Hackathon 2026 (SIH26047) • Ministry of Ayush / AIIA</p>
          <p>CSE494 Intelligent NoSQL Databases • MongoDB Community</p>
        </div>
      </footer>
    </div>
  );
}
