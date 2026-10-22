const ruleset = require('./redFlagRules.json');

function buildCaseCorpus(history = {}) {
  const parts = [
    history.chiefComplaint || '',
    history.hpi?.site || '',
    history.hpi?.onset || '',
    history.hpi?.character || '',
    history.hpi?.radiation || '',
    history.hpi?.associations || '',
    history.hpi?.timeCourse || '',
    history.hpi?.exacerbatingRelieving || '',
    ...(Array.isArray(history.pastMedicalSurgical) ? history.pastMedicalSurgical : []),
    ...(Array.isArray(history.drugAllergy) ? history.drugAllergy : []),
    ...(history.reviewOfSystems ? Object.values(history.reviewOfSystems) : []),
    ...(history.dashavidhaPariksha ? Object.values(history.dashavidhaPariksha) : [])
  ];
  return parts.join(' ').toLowerCase();
}

function parseReferenceRange(refRangeStr, testName = '') {
  if (typeof refRangeStr === 'string' && refRangeStr.trim()) {
    const clean = refRangeStr.trim();
    const rangeMatch = clean.match(/^(-?\d+(?:\.\d+)?)\s*[-–to]+\s*(-?\d+(?:\.\d+)?)$/i);
    if (rangeMatch) {
      return { min: parseFloat(rangeMatch[1]), max: parseFloat(rangeMatch[2]) };
    }
    const ltMatch = clean.match(/^<=?\s*(-?\d+(?:\.\d+)?)$/);
    if (ltMatch) {
      return { min: -Infinity, max: parseFloat(ltMatch[1]) };
    }
    const gtMatch = clean.match(/^>=?\s*(-?\d+(?:\.\d+)?)$/);
    if (gtMatch) {
      return { min: parseFloat(gtMatch[1]), max: Infinity };
    }
  }
  const key = String(testName || '').trim().toLowerCase();
  if (ruleset.standardLabRanges[key]) {
    return {
      min: ruleset.standardLabRanges[key].min,
      max: ruleset.standardLabRanges[key].max
    };
  }
  return null;
}

function evaluateLabInvestigations(investigations = []) {
  if (!Array.isArray(investigations)) return { investigations: [], abnormalCount: 0, criticalLabs: [] };
  let abnormalCount = 0;
  const criticalLabs = [];

  const evaluated = investigations.map(item => {
    const numVal = Number(item.value);
    const bounds = parseReferenceRange(item.refRange, item.name);
    let abnormal = Boolean(item.abnormal);
    let direction = 'NORMAL';

    if (bounds && !Number.isNaN(numVal)) {
      if (numVal < bounds.min) {
        abnormal = true;
        direction = 'LOW';
      } else if (numVal > bounds.max) {
        abnormal = true;
        direction = 'HIGH';
      } else {
        abnormal = false;
        direction = 'NORMAL';
      }
    }

    const std = ruleset.standardLabRanges[String(item.name || '').trim().toLowerCase()];
    if (std && !Number.isNaN(numVal)) {
      if (numVal < std.criticalLow || numVal > std.criticalHigh) {
        criticalLabs.push({
          name: item.name,
          value: numVal,
          unit: item.unit,
          refRange: item.refRange
        });
      }
    }

    if (abnormal) abnormalCount++;

    return {
      ...item,
      value: numVal,
      abnormal,
      direction
    };
  });

  return {
    investigations: evaluated,
    abnormalCount,
    criticalLabs
  };
}

function evaluateCaseRedFlags(caseData = {}, patientInvestigations = []) {
  const history = caseData.history || {};
  const corpus = buildCaseCorpus(history);
  const severityScore = Number(history.hpi?.severity || 5);
  const triggeredFlags = [];

  for (const rule of ruleset.rules) {
    let matched = false;

    if (rule.matchType === 'compound_and') {
      const hasPrimary = rule.primaryKeywords.some(kw => corpus.includes(kw.toLowerCase()));
      const hasSecondary = rule.secondaryKeywords.some(kw => corpus.includes(kw.toLowerCase()));
      matched = hasPrimary && hasSecondary;
    } else if (rule.matchType === 'any') {
      matched = rule.keywords.some(kw => corpus.includes(kw.toLowerCase()));
    } else if (rule.matchType === 'severity_threshold') {
      matched = severityScore >= rule.minSeverity;
    }

    if (matched) {
      triggeredFlags.push({
        ruleId: rule.ruleId,
        code: rule.code,
        name: rule.name,
        category: rule.category,
        severity: rule.severity,
        priorityBoost: rule.priorityBoost,
        rationale: rule.rationale,
        detectedAt: new Date()
      });
    }
  }

  const labEval = evaluateLabInvestigations(patientInvestigations);
  if (labEval.abnormalCount > 0) {
    const isCriticalLab = labEval.criticalLabs.length > 0;
    triggeredFlags.push({
      ruleId: 'RF_LAB_ABNORMAL_07',
      code: isCriticalLab ? 'LAB_CRITICAL_VALUE' : 'LAB_OUT_OF_RANGE',
      name: isCriticalLab
        ? `Critical Laboratory Derangement (${labEval.criticalLabs.map(l => l.name).join(', ')})`
        : `Abnormal Lab Investigation Values (${labEval.abnormalCount} abnormal)`,
      category: 'Laboratory',
      severity: isCriticalLab ? 'critical' : 'moderate',
      priorityBoost: isCriticalLab ? 35 : Math.min(20, labEval.abnormalCount * 5),
      rationale: `Detected ${labEval.abnormalCount} out-of-range lab test(s) against reference ranges.`,
      detectedAt: new Date()
    });
  }

  const basePriority = Math.min(30, Math.max(5, Math.round(severityScore * 3)));
  const totalBoost = triggeredFlags.reduce((acc, rf) => acc + (rf.priorityBoost || 0), 0);
  const priority = Math.min(100, basePriority + totalBoost);

  return {
    redFlags: triggeredFlags,
    priority,
    labEvaluation: labEval
  };
}

module.exports = {
  ruleset,
  parseReferenceRange,
  evaluateLabInvestigations,
  evaluateCaseRedFlags
};
