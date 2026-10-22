import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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

  useEffect(() => {
    const handleScroll = () => {
      const elements = document.querySelectorAll('[data-journey-index]');
      elements.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top >= 80 && rect.top <= window.innerHeight * 0.55) {
          setActiveStep(Number(el.getAttribute('data-journey-index')));
        }
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
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
    <div className="bg-apple-bg text-apple-text">
      {/* Hero Section */}
      <section id="overview" className="py-24 sm:py-36 px-4 sm:px-6">
        <div className="max-w-apple mx-auto text-center">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-[#0071e3] mb-4"
          >
            {t('landing.eyebrow')}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="text-4xl sm:text-6xl md:text-[72px] font-semibold tracking-tightHero leading-[1.06] max-w-4xl mx-auto"
          >
            {t('landing.heroTitle')}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="mt-6 text-lg sm:text-xl text-apple-textSecondary max-w-2xl mx-auto font-normal leading-relaxed"
          >
            {t('landing.heroSub')}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
          >
            <Button size="lg" onClick={handlePrimaryAction}>
              <span>{t('landing.ctaPrimary')}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => navigate(user ? '/app/physician' : '/login')}
            >
              {t('landing.ctaSecondary')}
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Big Stat Band */}
      <section className="py-20 bg-apple-bgSecondary hairline-t hairline-b px-4 sm:px-6">
        <div className="max-w-apple mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="space-y-2">
            <p className="text-5xl sm:text-6xl font-semibold tracking-tightHero text-apple-text">
              <AnimatedNumber value={140.3} decimals={1} suffix="x" />
            </p>
            <p className="text-base font-semibold text-apple-text">{t('landing.stat1Label')}</p>
            <p className="text-sm text-apple-textSecondary">{t('landing.stat1Sub')}</p>
          </div>
          <div className="space-y-2">
            <p className="text-5xl sm:text-6xl font-semibold tracking-tightHero text-[#0071e3]">
              <AnimatedNumber value={0} decimals={0} />
            </p>
            <p className="text-base font-semibold text-apple-text">{t('landing.stat2Label')}</p>
            <p className="text-sm text-apple-textSecondary">{t('landing.stat2Sub')}</p>
          </div>
          <div className="space-y-2">
            <p className="text-5xl sm:text-6xl font-semibold tracking-tightHero text-[#34c759]">
              <AnimatedNumber value={78} decimals={0} suffix="%" />
            </p>
            <p className="text-base font-semibold text-apple-text">{t('landing.stat3Label')}</p>
            <p className="text-sm text-apple-textSecondary">{t('landing.stat3Sub')}</p>
          </div>
        </div>
      </section>

      {/* Sticky Scroll 5-Step Patient Journey */}
      <section id="journey" className="py-28 px-4 sm:px-6">
        <div className="max-w-apple mx-auto">
          <div className="max-w-2xl mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0071e3] mb-2">
              End-to-End Clinical Flow
            </p>
            <h2 className="text-3xl sm:text-5xl font-semibold tracking-tightHeading">
              {t('landing.journeyHeader')}
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-6 space-y-24">
              {JOURNEY_STEPS.map((item, idx) => {
                const active = idx === activeStep;
                return (
                  <div
                    key={item.id}
                    data-journey-index={idx}
                    onClick={() => setActiveStep(idx)}
                    className={`cursor-pointer transition-opacity duration-300 ${
                      active ? 'opacity-100' : 'opacity-40 hover:opacity-70'
                    }`}
                  >
                    <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#0071e3] mb-3">
                      <span>Step {item.step}</span>
                      <span>•</span>
                      <span>{item.label}</span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-semibold tracking-tightHeading mb-3">
                      {item.title}
                    </h3>
                    <p className="text-base text-apple-textSecondary leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="lg:col-span-6 lg:sticky lg:top-24">
              <Card className="p-8 sm:p-10 min-h-[360px] flex flex-col justify-between bg-apple-bgSecondary">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-apple-textSecondary">
                    Step {currentStepObj.step} — {currentStepObj.label}
                  </span>
                  <div className="h-10 w-10 rounded-full bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center">
                    <StepIcon className="w-5 h-5" />
                  </div>
                </div>

                <motion.div
                  key={currentStepObj.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  className="my-8 p-6 rounded-[20px] bg-apple-surface hairline-border shadow-apple space-y-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-apple-textSecondary">
                    {currentStepObj.previewTitle}
                  </p>
                  <p className="text-xl sm:text-2xl font-semibold text-apple-text">
                    {currentStepObj.previewMetric}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {currentStepObj.previewPills.map(pill => (
                      <span
                        key={pill}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-apple-bgSecondary text-apple-text"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#34c759]" />
                        {pill}
                      </span>
                    ))}
                  </div>
                </motion.div>

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
      <section id="capabilities" className="py-28 bg-apple-bgSecondary hairline-t px-4 sm:px-6">
        <div className="max-w-apple mx-auto">
          <div className="max-w-2xl mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0071e3] mb-2">
              CSE494 NoSQL Architecture
            </p>
            <h2 className="text-3xl sm:text-5xl font-semibold tracking-tightHeading">
              {t('landing.bentoHeader')}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <Card className="md:col-span-7 p-8 sm:p-10 flex flex-col justify-between">
              <div className="space-y-3">
                <Database className="w-6 h-6 text-[#0071e3]" />
                <h3 className="text-2xl font-semibold tracking-tightHeading">
                  Polymorphic Clinical Document Model
                </h3>
                <p className="text-sm sm:text-base text-apple-textSecondary leading-relaxed">
                  Allopathic HPI and Ayurvedic ten-fold Dashavidha Pariksha coexist in a single collection with embedded history, redFlags, and physicianEdits—enforced at the storage engine layer via MongoDB $jsonSchema.
                </p>
              </div>
              <div className="mt-8 pt-6 hairline-t flex flex-wrap gap-3 text-xs font-mono text-apple-textSecondary">
                <span>Embedded 1:1 History</span>
                <span>•</span>
                <span>Referenced 1:N Documents</span>
                <span>•</span>
                <span>M:N Physician Assignments</span>
              </div>
            </Card>

            <div className="md:col-span-5 rounded-[24px] bg-[#1d1d1f] text-[#f5f5f7] p-8 sm:p-10 flex flex-col justify-between shadow-apple">
              <div className="space-y-3">
                <AlertTriangle className="w-6 h-6 text-[#ff3b30]" />
                <h3 className="text-2xl font-semibold tracking-tightHeading">
                  Clinical Red-Flag Engine
                </h3>
                <p className="text-sm text-[#98989d] leading-relaxed">
                  Automatically detects Acute Coronary Syndrome, Stroke FAST deficits, Hemorrhage, Anaphylaxis, Meningism, and critical lab values the moment a case is submitted.
                </p>
              </div>
              <div className="mt-8 pt-6 border-t border-white/10 text-xs font-mono text-[#ff9f0a]">
                Priority Queue • {'{ status: 1, priority: -1, createdAt: 1 }'}
              </div>
            </div>

            <Card className="md:col-span-5 p-8 sm:p-10 flex flex-col justify-between">
              <div className="space-y-3">
                <ShieldCheck className="w-6 h-6 text-[#34c759]" />
                <h3 className="text-xl font-semibold tracking-tightHeading">
                  DPDP Act 2023 Consent Ledger
                </h3>
                <p className="text-sm text-apple-textSecondary leading-relaxed">
                  Every consent toggle writes a timestamped audit entry. Revoking data capture immediately blocks new clinical intake.
                </p>
              </div>
              <div className="mt-6 text-xs text-apple-textSecondary font-mono">
                GET /api/consent-history/:patientId
              </div>
            </Card>

            <Card className="md:col-span-7 p-8 sm:p-10 flex flex-col justify-between">
              <div className="space-y-3">
                <Gauge className="w-6 h-6 text-[#0071e3]" />
                <h3 className="text-xl font-semibold tracking-tightHeading">
                  Covered Queries & Multi-Stage Aggregations
                </h3>
                <p className="text-sm text-apple-textSecondary leading-relaxed">
                  Live hospital telemetry powered by $group, $dateToString, $unwind, $lookup, and $unionWith pipelines—plus covered index queries examining zero collection documents.
                </p>
              </div>
              <div className="mt-6 text-xs text-apple-textSecondary font-mono">
                PROJECTION_COVERED • totalDocsExamined: 0
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="py-12 px-4 sm:px-6 hairline-t text-xs text-apple-textSecondary">
        <div className="max-w-apple mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>MediKiosk Prototype • Smart India Hackathon 2026 (SIH26047) • Ministry of Ayush / AIIA</p>
          <p>CSE494 Intelligent NoSQL Databases • MongoDB Community</p>
        </div>
      </footer>
    </div>
  );
}
