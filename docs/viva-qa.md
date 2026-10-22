# MediKiosk (CSE494) — 15 Viva-Voce Questions & Codebase-Grounded Answers

### Q1. Why did you embed `history`, `redFlags[]`, and `physicianEdits[]` inside `CaseRecord`, but reference `MedicalDocument` in a separate collection?
**Answer:** In MongoDB, data that is accessed together and has a bounded growth rate should be embedded, whereas high-growth or independently queried entities should be referenced:
- `history` (chief complaint, HPI, ROS, and Ayurvedic *Dashavidha Pariksha*) has a strict 1:1 relationship with a single clinical visit and is always read/written atomically with the case (~4 KB total).
- `redFlags[]` (0–6 rules) and `physicianEdits[]` (1–30 audit entries) are bounded 1:Few arrays that must be displayed immediately in the Triage Queue and Physician Review screens without extra `$lookup` joins.
- Conversely, a chronic care patient may upload hundreds of `MedicalDocument` records (lab reports, discharge summaries with long `rawText`) over years. Referencing `patientId` in a standalone `medicaldocuments` collection avoids approaching MongoDB's **16 MB BSON document limit** and allows independent `$unwind` analytics over lab investigations.

### Q2. Why do you enforce validation using BOTH Mongoose schemas AND MongoDB `$jsonSchema` validators?
**Answer:** Mongoose validation runs only in the Node.js application layer when methods like `.save()` or `Model.create()` are invoked. If a developer runs a raw driver command (`CaseRecord.collection.insertOne()`), a bulk migration script, or `mongosh`, Mongoose hooks are bypassed. By applying native `$jsonSchema` validators at server startup via `db.createCollection()` and `db.command({ collMod })` in `server/src/models/validators.js` with `validationLevel: "strict"` and `validationAction: "error"`, the MongoDB storage engine itself rejects invalid documents with error code `121` (`Document failed validation`).

### Q3. How are One-to-One, One-to-Many, and Many-to-Many relationships modeled in this codebase?
**Answer:**
1. **One-to-One (1:1)**: `User` ↔ `Patient` via a unique index on `Patient.userId` (`idx_patient_userid_unique`), and embedded 1:1 subdocuments (`CaseRecord.history`).
2. **One-to-Many (1:N)**: `Patient` → `CaseRecord` and `Patient` → `MedicalDocument` via indexed `patientId` ObjectId references (`{ patientId: 1, createdAt: -1 }` and `{ patientId: 1, docDate: -1 }`).
3. **Many-to-Many (M:N)**: `User (Physician)` ↔ `Patient` via the `PhysicianAssignment` junction collection (`server/src/models/PhysicianAssignment.js`), which stores `physicianId`, `patientId`, `department` (e.g., *Kayachikitsa*), and `assignmentRole` with a unique compound index `{ physicianId: 1, patientId: 1 }`.

### Q4. Explain the key order in the Triage Queue compound index `{ status: 1, priority: -1, createdAt: 1 }`.
**Answer:** It follows MongoDB's **ESR (Equality, Sort, Range)** rule:
1. **Equality (`status: 1`)**: `GET /api/triage/queue` filters by exact equality `{ status: "submitted" }`, narrowing the index partition immediately.
2. **Sort (`priority: -1, createdAt: 1`)**: Triage staff need the highest-priority emergencies first (`priority: -1`), and among ties, the patient who has been waiting the longest (`createdAt: 1`, FIFO). Because the index keys match the exact sort order, MongoDB returns results in index order without an in-memory blocking `SORT` stage.

### Q5. Why is `abhaId` on `User` indexed as `{ unique: true, sparse: true }`?
**Answer:** An ABHA ID (Ayushman Bharat Health Account) must be globally unique across patients who link one, but it is optional for patients and not applicable to physicians or triage staff. A standard `unique: true` index treats missing fields as `null`, causing the second user without an `abhaId` to fail with `E11000 duplicate key error (abhaId: null)`. Adding `sparse: true` (`idx_user_abha_unique_sparse`) instructs MongoDB to index only documents where `abhaId` exists, allowing any number of users to omit `abhaId` while enforcing uniqueness whenever present.

### Q6. How does the TTL index expire only stale drafts without deleting submitted or reviewed cases?
**Answer:** In `server/src/models/CaseRecord.js`, `idx_case_ttl_stale_drafts` is defined on `{ createdAt: 1 }` with `expireAfterSeconds: 604800` (7 days) AND `partialFilterExpression: { status: "draft" }`. Because it is a partial TTL index, MongoDB's background TTL monitor only indexes and expires documents where `status === "draft"`. Once a case is submitted (`status: "submitted"`) or reviewed (`status: "reviewed"`), it is excluded from the partial index and retained permanently.

### Q7. What is a Covered Query in MongoDB, and where is it demonstrated in MediKiosk?
**Answer:** A covered query is one in which every field in both the query filter and the projection is part of an index, and `_id` is explicitly excluded (`_id: 0`). In `GET /api/analytics/covered-query` (and `GET /api/triage/queue?covered=true`), we query `{ status: 'submitted' }` with `.select({ status: 1, priority: 1, createdAt: 1, _id: 0 })` and `.sort({ priority: -1, createdAt: 1 })`. Using `idx_case_triage_queue`, `explain("executionStats")` reports stage `PROJECTION_COVERED` and `totalDocsExamined: 0`, proving the query was satisfied 100% from the B-tree index in RAM without touching collection documents.

### Q8. What speedup did you observe in `scripts/benchmark.js` on 100,000 `CaseRecord` documents?
**Answer:** On 100,000 seeded `CaseRecord` documents (`docs/performance-report.md`):
- **Patient Case History (`{ patientId, sort: createdAt DESC }`)**: Without index (`COLLSCAN`), MongoDB examined all **100,000 documents** in **229.17 ms**. With `idx_case_patient_created`, it used `IXSCAN`, examining only **200 documents** in **1.63 ms** — a **140.3x speedup**.
- **Covered Triage Query**: Reduced `docsExamined` from **100,000** (`COLLSCAN`) to **0** (`PROJECTION_COVERED`).

### Q9. How does the Patient Timeline aggregation merge `CaseRecord` and `MedicalDocument` collections?
**Answer:** In `getMergedPatientTimeline` (`server/src/controllers/analytics.controller.js`), the pipeline starts on `CaseRecord` with `$match: { patientId }`, enriches patient metadata via `$lookup`, normalizes the schema via `$project` (`entryType: "case"`, `eventDate: "$createdAt"`), and then executes `$unionWith` against `medicaldocuments` (which runs a sub-pipeline `$match: { patientId }` and `$project` with `entryType: "document"`, `eventDate: "$docDate"`). Finally, `$sort: { eventDate: -1 }` orders all clinical encounters and documents chronologically.

### Q10. Why is `$unwind` required in the Abnormal Lab Frequency and Weekly Red-Flag aggregations?
**Answer:** In `MedicalDocument`, `extracted.investigations` is an array of embedded lab test objects. Grouping directly on an array field would group by the entire array rather than individual lab tests. `{ $unwind: "$extracted.investigations" }` deconstructs the array so each investigation becomes an individual pipeline document, allowing `{ $match: { "extracted.investigations.abnormal": true } }` and `{ $group: { _id: "$extracted.investigations.name", abnormalCount: { $sum: 1 } } }` to count abnormal frequencies per test name.

### Q11. How does the Red-Flag Engine calculate priority scores on case submission?
**Answer:** When `POST /api/cases/:id/submit` is called, `evaluateCaseRedFlags()` in `server/src/services/redFlag.js` builds a normalized lowercase text corpus from `history` and evaluates 6 declarative rules in `redFlagRules.json` (`compound_and` for Chest Pain + Dyspnoea and Fever + Meningism, `any` keyword matching for Stroke FAST signs, Severe Bleeding, and Anaphylaxis, and `severity_threshold >= 9` for extreme pain), plus out-of-range lab checks from `evaluateLabInvestigations()`. It computes `basePriority = round(severity * 3)` (capped at 30) and adds each triggered rule's `priorityBoost`, clamping the final `priority` to `[0, 100]`.

### Q12. How does MediKiosk handle polymorphic Ayurvedic (*Dashavidha Pariksha*) vs. Allopathic case histories?
**Answer:** Both modes share core clinical history fields (`chiefComplaint`, `hpi`, `pastMedicalSurgical`, `drugAllergy`, `family`, `personal`, `reviewOfSystems`), discriminated by `mode: "allopathic" | "ayush"`. When `mode === "ayush"`, the embedded `history.dashavidhaPariksha` subdocument stores the ten classical Ayurvedic examination parameters (*Prakriti, Vikriti, Sara, Samhanana, Pramana, Satmya, Sattva, Ahara Shakti, Vyayama Shakti, Vaya*). MongoDB's flexible document model stores both modes in a single `caserecords` collection without schema migration overhead.

### Q13. How are Physician Edits audited when a physician reviews a case?
**Answer:** When a physician calls `PATCH /api/cases/:id/review` (`server/src/controllers/case.controller.js`), the controller compares each incoming field path (e.g., `history.chiefComplaint` or `history.dashavidhaPariksha.vikriti`) against the existing document value using dot-path traversal. For every modified field, it appends an audit subdocument `{ who: req.user._id, when: new Date(), field, old: oldVal, new: newVal }` to `physicianEdits[]` and transitions `status` to `"reviewed"`.

### Q14. How is Role-Based Access Control (RBAC) and patient data isolation enforced?
**Answer:** `authenticate` middleware (`server/src/middleware/auth.js`) verifies the JWT and attaches `req.user`. Route-level `authorize(...roles)` restricts endpoints (e.g., `PATCH /api/cases/:id/review` requires `physician`; `GET /api/triage/queue` requires `triage` or `physician`). Resource-level checks in controllers verify that when `req.user.role === "patient"`, the requested `patientId` belongs to `req.user._id`, returning `403 Forbidden` otherwise. Furthermore, physicians are blocked (`403`) from reading unsubmitted `draft` cases.

### Q15. How is cascading deletion implemented when a patient record is deleted?
**Answer:** MongoDB does not enforce relational `ON DELETE CASCADE` foreign keys automatically. Therefore, in `deletePatient` (`server/src/controllers/patient.controller.js`), before deleting the `Patient` document, the controller executes `Promise.all([CaseRecord.deleteMany({ patientId }), MedicalDocument.deleteMany({ patientId }), PhysicianAssignment.deleteMany({ patientId })])`, using the indexed `patientId` field on each child collection to remove all dependent records atomically at the application service layer.
