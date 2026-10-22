# MediKiosk Indexing & Query Performance Report (CSE494 — Unit IV / CO4)

## 1. Benchmark Methodology & Dataset Scale

- **Dataset Size**: **100,000 `CaseRecord` documents**, **500 `Patient` documents**, and **3,000 `MedicalDocument` records** generated via `server/src/scripts/benchmark.js`.
- **Execution Mode**: Each workload query was executed first with secondary indexes dropped (`CaseRecord.collection.dropIndexes()`) forcing a full collection scan (`COLLSCAN`), and then re-executed after building all secondary indexes (`CaseRecord.syncIndexes()`).
- **Metrics Captured**: Extracted directly from `explain("executionStats")`:
  - `executionStages.stage` (`COLLSCAN`, `IXSCAN`, `PROJECTION_COVERED`, `TEXT_MATCH`)
  - `totalDocsExamined` (`docsExamined`)
  - `totalKeysExamined`
  - `nReturned`
  - `executionTimeMillis`

---

## 2. Benchmark Comparison Table (100,000 `CaseRecord` Documents)

| Query Workload | Target Index | Mode | Plan Stage | `docsExamined` | `keysExamined` | `nReturned` | `executionTimeMillis` | Speedup |
| :--- | :--- | :--- | :--- | ---: | ---: | ---: | ---: | ---: |
| **Patient Case History ({ patientId, sort: createdAt DESC })** | `idx_case_patient_created ({ patientId: 1, createdAt: -1 })` | **Without Index** | `COLLSCAN` | 100,000 | 0 | 20 | 229.167 ms | Baseline |
| **Patient Case History ({ patientId, sort: createdAt DESC })** | `idx_case_patient_created ({ patientId: 1, createdAt: -1 })` | **With Index** | `IXSCAN` | 200 | 200 | 20 | 1.633 ms | **140.3x** |
| **Triage Priority Queue ({ status: "submitted", sort: priority DESC, createdAt ASC })** | `idx_case_triage_queue ({ status: 1, priority: -1, createdAt: 1 })` | **Without Index** | `COLLSCAN` | 100,000 | 0 | 50 | 1105.107 ms | Baseline |
| **Triage Priority Queue ({ status: "submitted", sort: priority DESC, createdAt ASC })** | `idx_case_triage_queue ({ status: 1, priority: -1, createdAt: 1 })` | **With Index** | `IXSCAN` | 50,000 | 50,000 | 50 | 167.141 ms | **6.6x** |
| **Covered Triage Query (Projection ONLY on indexed fields, _id: 0)** | `idx_case_triage_queue ({ status: 1, priority: -1, createdAt: 1 })` | **Without Index** | `COLLSCAN` | 100,000 | 0 | 50 | 1086.661 ms | Baseline |
| **Covered Triage Query (Projection ONLY on indexed fields, _id: 0)** | `idx_case_triage_queue ({ status: 1, priority: -1, createdAt: 1 })` | **With Index** | `PROJECTION_COVERED` | 0 | 50,000 | 50 | 232.556 ms | **4.7x** |
| **Clinical Text Search ($text: "chest pain dyspnoea")** | `idx_case_text_search (text index on history.chiefComplaint)` | **Without Index** | `COLLSCAN` | 100,000 | 0 | 25 | 384.976 ms | Baseline |
| **Clinical Text Search ($text: "chest pain dyspnoea")** | `idx_case_text_search (text index on history.chiefComplaint)` | **With Index** | `TEXT_MATCH` | 33,334 | 33,334 | 25 | 322.365 ms | **1.2x** |

---

## 3. Configured MongoDB Index Inventory

| Collection | Index Name | Key Specification | Options / Properties | Clinical / Operational Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `caserecords` | `idx_case_patient_created` | `{ patientId: 1, createdAt: -1 }` | Compound Index (ESR rule: Equality on `patientId`, Sort on `createdAt`) | Accelerates `GET /api/cases/patient/:patientId` from 100,000 scanned documents down to the exact patient's 200 encounters. |
| `caserecords` | `idx_case_triage_queue` | `{ status: 1, priority: -1, createdAt: 1 }` | Compound Index (Equality on `status`, Sort on `priority DESC, createdAt ASC`) | Powers `GET /api/triage/queue` and supports a **covered query** when projecting `{ status: 1, priority: 1, createdAt: 1, _id: 0 }`. |
| `caserecords` | `idx_case_text_search` | `{ "history.chiefComplaint": "text", "history.pastMedicalSurgical": "text" }` | Multi-field Text Index | Supports free-text symptom and clinical keyword search across submitted cases. |
| `caserecords` | `idx_case_ttl_stale_drafts` | `{ createdAt: 1 }` | `expireAfterSeconds: 604800`, `partialFilterExpression: { status: "draft" }` | Automatically purges abandoned kiosk draft sessions older than 7 days while preserving `submitted` and `reviewed` clinical cases indefinitely. |
| `users` | `idx_user_abha_unique_sparse` | `{ abhaId: 1 }` | `unique: true, sparse: true` | Enforces uniqueness across Ayushman Bharat Health Account (ABHA) IDs while permitting physicians, triage staff, and unlinked patients to omit `abhaId`. |
| `medicaldocuments` | `idx_doc_patient_date` | `{ patientId: 1, docDate: -1 }` | Compound Index | Accelerates chronological document timeline queries (`GET /api/documents/patient/:patientId/timeline`). |
| `medicaldocuments` | `idx_doc_diagnoses_text` | `{ "extracted.diagnoses": "text", rawText: "text" }` | Text Index | Enables fast diagnosis lookup across prior medical records. |

---

## 4. Analysis of Execution Plans & ESR (Equality, Sort, Range) Design

1. **Eliminating Collection Scans on Patient Lookups**:
   - Without `idx_case_patient_created`, fetching a single patient's 20 most recent encounters forces MongoDB to inspect all **100,000 documents** (`COLLSCAN`, **229.167 ms**) and perform an in-memory sort.
   - With `{ patientId: 1, createdAt: -1 }`, MongoDB jumps directly to the patient's partition in the B-tree and reads keys already ordered by `createdAt: -1`, examining only **200 documents** in **1.633 ms** (**140.3x** speedup).
2. **Covered Query Optimization (`totalDocsExamined: 0`)**:
   - When querying `{ status: "submitted" }` with projection `{ status: 1, priority: 1, createdAt: 1, _id: 0 }`, every requested field resides inside `idx_case_triage_queue`.
   - The query planner selects `PROJECTION_COVERED`, returning **50** rows with **`docsExamined: 0`** because zero collection document fetches are needed.
