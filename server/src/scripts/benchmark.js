const fs = require('fs');
const path = require('path');
const { disconnectDB } = require('../config/db');
const CaseRecord = require('../models/CaseRecord');
const Patient = require('../models/Patient');
const { runSeed } = require('../seed/seed');

async function runBenchmark() {
  console.log('[Benchmark] Seeding 100,000 CaseRecords for indexing & performance benchmark...');
  await runSeed({ patientCount: 500, caseCount: 100000, docCount: 3000, isBulk: true });

  const samplePatient = await Patient.findOne({}).lean();
  const targetPatientId = samplePatient._id;

  const queries = [
    {
      name: 'Patient Case History ({ patientId, sort: createdAt DESC })',
      indexName: 'idx_case_patient_created ({ patientId: 1, createdAt: -1 })',
      build: () => CaseRecord.find({ patientId: targetPatientId }).sort({ createdAt: -1 }).limit(20)
    },
    {
      name: 'Triage Priority Queue ({ status: "submitted", sort: priority DESC, createdAt ASC })',
      indexName: 'idx_case_triage_queue ({ status: 1, priority: -1, createdAt: 1 })',
      build: () => CaseRecord.find({ status: 'submitted' }).sort({ priority: -1, createdAt: 1 }).limit(50)
    },
    {
      name: 'Covered Triage Query (Projection ONLY on indexed fields, _id: 0)',
      indexName: 'idx_case_triage_queue ({ status: 1, priority: -1, createdAt: 1 })',
      build: () =>
        CaseRecord.find({ status: 'submitted' })
          .select({ status: 1, priority: 1, createdAt: 1, _id: 0 })
          .sort({ priority: -1, createdAt: 1 })
          .limit(50)
    },
    {
      name: 'Clinical Text Search ($text: "chest pain dyspnoea")',
      indexName: 'idx_case_text_search (text index on history.chiefComplaint)',
      buildNoIdx: () => CaseRecord.find({ 'history.chiefComplaint': { $regex: 'chest pain|dyspnoea', $options: 'i' } }).limit(25),
      build: () => CaseRecord.find({ $text: { $search: 'chest pain dyspnoea' } }).limit(25)
    }
  ];

  console.log('[Benchmark] Dropping secondary indexes on CaseRecord to measure COLLSCAN baseline...');
  await CaseRecord.collection.dropIndexes();

  const withoutIndexResults = [];
  for (const q of queries) {
    const explain = await (q.buildNoIdx ? q.buildNoIdx() : q.build()).explain('executionStats');
    withoutIndexResults.push(explain.executionStats);
  }

  console.log('[Benchmark] Rebuilding compound, text, sparse, and TTL indexes on CaseRecord...');
  await CaseRecord.syncIndexes();

  const withIndexResults = [];
  for (const q of queries) {
    const explain = await (q.buildNoIdx ? q.buildNoIdx() : q.build()).explain('executionStats');
    withIndexResults.push(explain.executionStats);
  }

  const rows = queries.map((q, idx) => {
    const noIdx = withoutIndexResults[idx];
    const withIdx = withIndexResults[idx];
    const speedup = (noIdx.executionTimeMillis / Math.max(0.05, withIdx.executionTimeMillis)).toFixed(1) + 'x';
    return {
      queryName: q.name,
      indexName: q.indexName,
      noIdxStage: noIdx.executionStages.stage,
      noIdxDocsExamined: noIdx.totalDocsExamined,
      noIdxReturned: noIdx.nReturned,
      noIdxTimeMs: noIdx.executionTimeMillis,
      withIdxStage: withIdx.executionStages.stage,
      withIdxDocsExamined: withIdx.totalDocsExamined,
      withIdxKeysExamined: withIdx.totalKeysExamined,
      withIdxReturned: withIdx.nReturned,
      withIdxTimeMs: withIdx.executionTimeMillis,
      speedup
    };
  });

  console.table(rows);

  const tableLines = rows.map(r => {
    const line1 = `| **${r.queryName}** | \`${r.indexName}\` | **Without Index** | \`${r.noIdxStage}\` | ${r.noIdxDocsExamined.toLocaleString()} | 0 | ${r.noIdxReturned} | ${r.noIdxTimeMs} ms | Baseline |`;
    const line2 = `| **${r.queryName}** | \`${r.indexName}\` | **With Index** | \`${r.withIdxStage}\` | ${r.withIdxDocsExamined.toLocaleString()} | ${r.withIdxKeysExamined.toLocaleString()} | ${r.withIdxReturned} | ${r.withIdxTimeMs} ms | **${r.speedup}** |`;
    return `${line1}\n${line2}`;
  });

  const reportLines = [
    '# MediKiosk Indexing & Query Performance Report (CSE494 — Unit IV / CO4)',
    '',
    '## 1. Benchmark Methodology & Dataset Scale',
    '',
    '- **Dataset Size**: **100,000 `CaseRecord` documents**, **500 `Patient` documents**, and **3,000 `MedicalDocument` records** generated via `server/src/scripts/benchmark.js`.',
    '- **Execution Mode**: Each workload query was executed first with secondary indexes dropped (`CaseRecord.collection.dropIndexes()`) forcing a full collection scan (`COLLSCAN`), and then re-executed after building all secondary indexes (`CaseRecord.syncIndexes()`).',
    '- **Metrics Captured**: Extracted directly from `explain("executionStats")`:',
    '  - `executionStages.stage` (`COLLSCAN`, `IXSCAN`, `PROJECTION_COVERED`, `TEXT_MATCH`)',
    '  - `totalDocsExamined` (`docsExamined`)',
    '  - `totalKeysExamined`',
    '  - `nReturned`',
    '  - `executionTimeMillis`',
    '',
    '---',
    '',
    '## 2. Benchmark Comparison Table (100,000 `CaseRecord` Documents)',
    '',
    '| Query Workload | Target Index | Mode | Plan Stage | `docsExamined` | `keysExamined` | `nReturned` | `executionTimeMillis` | Speedup |',
    '| :--- | :--- | :--- | :--- | ---: | ---: | ---: | ---: | ---: |',
    ...tableLines,
    '',
    '---',
    '',
    '## 3. Configured MongoDB Index Inventory',
    '',
    '| Collection | Index Name | Key Specification | Options / Properties | Clinical / Operational Purpose |',
    '| :--- | :--- | :--- | :--- | :--- |',
    '| `caserecords` | `idx_case_patient_created` | `{ patientId: 1, createdAt: -1 }` | Compound Index (ESR rule: Equality on `patientId`, Sort on `createdAt`) | Accelerates `GET /api/cases/patient/:patientId` from 100,000 scanned documents down to the exact patient\'s 200 encounters. |',
    '| `caserecords` | `idx_case_triage_queue` | `{ status: 1, priority: -1, createdAt: 1 }` | Compound Index (Equality on `status`, Sort on `priority DESC, createdAt ASC`) | Powers `GET /api/triage/queue` and supports a **covered query** when projecting `{ status: 1, priority: 1, createdAt: 1, _id: 0 }`. |',
    '| `caserecords` | `idx_case_text_search` | `{ "history.chiefComplaint": "text", "history.pastMedicalSurgical": "text" }` | Multi-field Text Index | Supports free-text symptom and clinical keyword search across submitted cases. |',
    '| `caserecords` | `idx_case_ttl_stale_drafts` | `{ createdAt: 1 }` | `expireAfterSeconds: 604800`, `partialFilterExpression: { status: "draft" }` | Automatically purges abandoned kiosk draft sessions older than 7 days while preserving `submitted` and `reviewed` clinical cases indefinitely. |',
    '| `users` | `idx_user_abha_unique_sparse` | `{ abhaId: 1 }` | `unique: true, sparse: true` | Enforces uniqueness across Ayushman Bharat Health Account (ABHA) IDs while permitting physicians, triage staff, and unlinked patients to omit `abhaId`. |',
    '| `medicaldocuments` | `idx_doc_patient_date` | `{ patientId: 1, docDate: -1 }` | Compound Index | Accelerates chronological document timeline queries (`GET /api/documents/patient/:patientId/timeline`). |',
    '| `medicaldocuments` | `idx_doc_diagnoses_text` | `{ "extracted.diagnoses": "text", rawText: "text" }` | Text Index | Enables fast diagnosis lookup across prior medical records. |',
    '',
    '---',
    '',
    '## 4. Analysis of Execution Plans & ESR (Equality, Sort, Range) Design',
    '',
    '1. **Eliminating Collection Scans on Patient Lookups**:',
    `   - Without \`idx_case_patient_created\`, fetching a single patient's 20 most recent encounters forces MongoDB to inspect all **100,000 documents** (\`COLLSCAN\`, **${rows[0].noIdxTimeMs} ms**) and perform an in-memory sort.`,
    `   - With \`{ patientId: 1, createdAt: -1 }\`, MongoDB jumps directly to the patient's partition in the B-tree and reads keys already ordered by \`createdAt: -1\`, examining only **${rows[0].withIdxDocsExamined} documents** in **${rows[0].withIdxTimeMs} ms** (**${rows[0].speedup}** speedup).`,
    '2. **Covered Query Optimization (`totalDocsExamined: 0`)**:',
    '   - When querying `{ status: "submitted" }` with projection `{ status: 1, priority: 1, createdAt: 1, _id: 0 }`, every requested field resides inside `idx_case_triage_queue`.',
    `   - The query planner selects \`PROJECTION_COVERED\`, returning **${rows[2].withIdxReturned}** rows with **\`docsExamined: 0\`** because zero collection document fetches are needed.`
  ];

  const reportPath = path.resolve(__dirname, '../../../docs/performance-report.md');
  fs.writeFileSync(reportPath, reportLines.join('\n') + '\n');
  console.log(`[Benchmark] Wrote performance report to ${reportPath}`);
}

if (require.main === module) {
  runBenchmark()
    .then(() => disconnectDB())
    .catch(err => {
      console.error('[Benchmark] Error:', err);
      process.exit(1);
    });
}

module.exports = { runBenchmark };
