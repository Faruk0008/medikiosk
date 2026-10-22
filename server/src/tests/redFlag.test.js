const { evaluateCaseRedFlags, evaluateLabInvestigations, ruleset } = require('../services/redFlag');

describe('Phase 4: Red-Flag Engine & Abnormal-Lab Flagger Unit Tests (Unit VI)', () => {
  test('Ruleset contains all 6 core clinical red-flag rules and standard lab ranges', () => {
    expect(ruleset.rules).toHaveLength(6);
    expect(Object.keys(ruleset.standardLabRanges).length).toBeGreaterThanOrEqual(8);
  });

  test('Rule 1 (RF_ACS_01): Triggers on Chest Pain + Dyspnoea / Shortness of Breath', () => {
    const result = evaluateCaseRedFlags({
      history: {
        chiefComplaint: 'Severe crushing chest pain since 2 hours',
        hpi: { associations: 'Associated with acute dyspnoea and profuse sweating', radiation: 'Radiating to left arm', severity: 8 }
      }
    });
    expect(result.redFlags.map(r => r.code)).toContain('CARDIO_DYSPNOEA');
    expect(result.priority).toBeGreaterThanOrEqual(65);
  });

  test('Rule 2 (RF_STROKE_02): Triggers on Stroke FAST signs (facial droop, slurred speech, limb weakness)', () => {
    const result = evaluateCaseRedFlags({
      history: {
        chiefComplaint: 'Sudden onset facial droop and slurred speech',
        hpi: { associations: 'Right upper limb weakness (Pakshaghata)', severity: 8 }
      }
    });
    expect(result.redFlags.map(r => r.code)).toContain('NEURO_FAST_STROKE');
    expect(result.priority).toBeGreaterThanOrEqual(70);
  });

  test('Rule 3 (RF_HEMORRHAGE_03): Triggers on Severe Bleeding / Hematemesis / Raktapitta', () => {
    const result = evaluateCaseRedFlags({
      history: { chiefComplaint: 'Two episodes of vomiting blood (hematemesis) and severe bleeding', hpi: { severity: 7 } }
    });
    expect(result.redFlags.map(r => r.code)).toContain('HEMORRHAGE_SHOCK');
  });

  test('Rule 4 (RF_ANAPHYLAXIS_04): Triggers on Anaphylaxis / Tongue Swelling / Stridor', () => {
    const result = evaluateCaseRedFlags({
      history: {
        chiefComplaint: 'Acute tongue swelling and stridor after taking antibiotic',
        hpi: { associations: 'Hives with breathing difficulty', severity: 9 }
      }
    });
    const codes = result.redFlags.map(r => r.code);
    expect(codes).toContain('ALLERGY_ANAPHYLAXIS');
    expect(codes).toContain('CRITICAL_PAIN_SCORE');
    expect(result.priority).toBe(100);
  });

  test('Rule 5 (RF_SEPSIS_MENINGISM_05): Triggers on High Fever + Neck Stiffness / Altered Sensorium', () => {
    const result = evaluateCaseRedFlags({
      history: {
        chiefComplaint: 'High fever for 3 days',
        hpi: { associations: 'Severe neck stiffness and altered sensorium (confusion)', severity: 7 }
      }
    });
    expect(result.redFlags.map(r => r.code)).toContain('INFECT_MENINGISM');
  });

  test('Rule 6 (RF_SEVERE_PAIN_06): Triggers when HPI pain severity >= 9/10', () => {
    const result = evaluateCaseRedFlags({
      history: { chiefComplaint: 'Acute renal colic flank pain', hpi: { severity: 9 } }
    });
    expect(result.redFlags.map(r => r.code)).toContain('CRITICAL_PAIN_SCORE');
  });

  test('Low-acuity routine case triggers 0 red flags and keeps baseline priority', () => {
    const result = evaluateCaseRedFlags({
      history: {
        chiefComplaint: 'Mild seasonal coryza for 2 days',
        hpi: { character: 'Clear nasal discharge', associations: 'Mild sneezing', severity: 2 }
      }
    });
    expect(result.redFlags).toHaveLength(0);
    expect(result.priority).toBeLessThanOrEqual(15);
  });

  test('Abnormal-Lab Flagger accurately compares values against reference ranges and flags critical values', () => {
    const labEval = evaluateLabInvestigations([
      { name: 'Hemoglobin', value: 6.4, unit: 'g/dL', refRange: '12.0-17.5' },
      { name: 'Potassium', value: 6.5, unit: 'mEq/L', refRange: '3.5-5.1' },
      { name: 'Fasting Blood Sugar', value: 92, unit: 'mg/dL', refRange: '70-100' },
      { name: 'HbA1c', value: 8.4, unit: '%', refRange: '<= 5.6' }
    ]);

    expect(labEval.abnormalCount).toBe(3);
    expect(labEval.investigations[0].abnormal).toBe(true);
    expect(labEval.investigations[0].direction).toBe('LOW');
    expect(labEval.investigations[1].abnormal).toBe(true);
    expect(labEval.investigations[1].direction).toBe('HIGH');
    expect(labEval.investigations[2].abnormal).toBe(false);
    expect(labEval.investigations[3].abnormal).toBe(true);
    expect(labEval.criticalLabs.length).toBeGreaterThanOrEqual(2);
  });
});
