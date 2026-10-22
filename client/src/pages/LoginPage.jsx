import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, ArrowRight, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { Button, Card, Input, Segmented } from '../components/ui/Primitives';

const DEMO_ACCOUNTS = [
  { role: 'patient', label: 'Patient', name: 'Aarav Sharma', email: 'patient@medikiosk.in', password: 'password123' },
  { role: 'physician', label: 'Physician', name: 'Dr. Charaka Vaidya', email: 'physician@medikiosk.in', password: 'password123' },
  { role: 'triage', label: 'Triage', name: 'Sister Anjali Verma', email: 'triage@medikiosk.in', password: 'password123' }
];

export default function LoginPage() {
  const { user, login, register } = useAuth();
  const { t } = useI18n();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [isRegister, setIsRegister] = useState(searchParams.get('mode') === 'register');
  const [role, setRole] = useState('patient');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('patient@medikiosk.in');
  const [password, setPassword] = useState('password123');
  const [abhaId, setAbhaId] = useState('');
  const [age, setAge] = useState('34');
  const [sex, setSex] = useState('male');
  const [address, setAddress] = useState('Sarita Vihar, New Delhi');
  const [error, setError] = useState('');
  const [shakeKey, setShakeKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      navigate(
        user.role === 'physician'
          ? '/app/physician'
          : user.role === 'triage'
          ? '/app/triage'
          : '/app/patient',
        { replace: true }
      );
    }
  }, [user, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (isRegister) {
        if (abhaId && !/^\d{2}-\d{4}-\d{4}-\d{4}$/.test(abhaId)) {
          throw new Error('ABHA ID must follow XX-XXXX-XXXX-XXXX format');
        }
        const payload = {
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          ...(abhaId.trim() ? { abhaId: abhaId.trim() } : {}),
          ...(role === 'patient'
            ? {
                demographics: {
                  age: Number(age) || 30,
                  sex,
                  address: address.trim() || 'New Delhi'
                }
              }
            : {})
        };
        const res = await register(payload);
        pushToast({
          title: 'Account created',
          description: `Welcome to MediKiosk, ${res.user.name}`,
          type: 'success'
        });
      } else {
        const res = await login(email.trim(), password);
        pushToast({
          title: 'Signed in',
          description: `${res.user.name} (${res.user.role.toUpperCase()})`,
          type: 'success'
        });
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
      setShakeKey(prev => prev + 1);
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemoAccount(demo) {
    setIsRegister(false);
    setRole(demo.role);
    setEmail(demo.email);
    setPassword(demo.password);
    setError('');
  }

  return (
    <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center px-4 py-16 bg-apple-bgSecondary">
      <motion.div
        key={shakeKey}
        animate={error ? { x: [0, -10, 10, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        <Card className="p-8 sm:p-10 space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto h-12 w-12 rounded-full bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center">
              <Activity className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tightHeading">
              {isRegister ? t('auth.createAccount') : t('auth.welcomeBack')}
            </h1>
            <p className="text-xs sm:text-sm text-apple-textSecondary">{t('auth.subtitle')}</p>
          </div>

          <div className="flex justify-center">
            <Segmented
              idPrefix="auth_role"
              options={[
                { value: 'patient', label: 'Patient' },
                { value: 'physician', label: 'Physician' },
                { value: 'triage', label: 'Triage' }
              ]}
              value={role}
              onChange={val => {
                setRole(val);
                if (!isRegister) {
                  const found = DEMO_ACCOUNTS.find(d => d.role === val);
                  if (found) {
                    setEmail(found.email);
                    setPassword(found.password);
                  }
                }
              }}
            />
          </div>

          {error && (
            <div className="p-3.5 rounded-[16px] bg-[#ff3b30]/10 border border-[#ff3b30]/30 text-xs font-medium text-[#ff3b30]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <Input
                label={t('auth.nameLabel')}
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            )}

            <Input
              label={t('auth.emailLabel')}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />

            <Input
              label={t('auth.passwordLabel')}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />

            {isRegister && role === 'patient' && (
              <div className="space-y-4 pt-1">
                <Input
                  label={t('auth.abhaLabel')}
                  value={abhaId}
                  onChange={e => setAbhaId(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label={t('auth.ageLabel')}
                    type="number"
                    value={age}
                    onChange={e => setAge(e.target.value)}
                    required
                  />
                  <div className="rounded-[16px] bg-apple-surface hairline-border px-4 py-2 flex flex-col justify-center">
                    <label className="text-[11px] font-medium text-apple-textSecondary">
                      {t('auth.sexLabel')}
                    </label>
                    <select
                      value={sex}
                      onChange={e => setSex(e.target.value)}
                      className="bg-transparent text-sm text-apple-text focus:outline-none"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <Input
                  label={t('auth.addressLabel')}
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  required
                />
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              <span>{isRegister ? t('auth.registerBtn') : t('auth.signInBtn')}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
              className="text-xs font-medium text-[#0071e3] hover:underline"
            >
              {isRegister ? t('auth.switchToLogin') : t('auth.switchToRegister')}
            </button>
          </div>

          <div className="pt-5 hairline-t space-y-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-apple-textSecondary">
              <KeyRound className="w-3.5 h-3.5" />
              <span>{t('auth.demoHeader')}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_ACCOUNTS.map(demo => (
                <button
                  key={demo.role}
                  type="button"
                  onClick={() => fillDemoAccount(demo)}
                  className={`px-3 py-2 rounded-[14px] text-left hairline-border transition ${
                    email === demo.email && !isRegister
                      ? 'bg-[#0071e3] text-white border-[#0071e3]'
                      : 'bg-apple-bgSecondary hover:opacity-90 text-apple-text'
                  }`}
                >
                  <p className="text-xs font-semibold">{demo.label}</p>
                  <p className="text-[10px] opacity-80 truncate">{demo.name}</p>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
