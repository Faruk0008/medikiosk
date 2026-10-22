# MediKiosk Schema Design & NoSQL Data Modeling (CSE494 — Unit III)

## 1. Domain Context & Workload Characterization (SIH26047)

**MediKiosk** is a patient case-taking and clinical triage prototype designed for the Ministry of Ayush / All India Institute of Ayurveda (AIIA) under Smart India Hackathon 2026 problem **SIH26047**. The database layer supports three primary operational personas:

1. **Patients**: Capture structured clinical history in either **Allopathic** or **Ayush (Dashavidha Pariksha)** mode, manage informed data-capture/sharing consent, and upload structured medical documents (prescriptions, lab reports, discharge summaries).
2. **Triage Staff**: Monitor a real-time priority queue of submitted cases sorted by clinical severity (`priority` descending, `createdAt` ascending) and inspect automatically triggered clinical red flags and abnormal laboratory values.
3. **Physicians**: Review structured clinical case summaries, make auditable field-level edits (`physicianEdits`), and inspect a unified chronological patient timeline combining clinical encounters and prior medical documents.

## 2. Embedding vs. Referencing Justification

| Entity / Sub-Entity | Modeling Strategy | Access Pattern & Co-Locality | Growth Rate & Cardinality | BSON 16 MB Document Limit Analysis |
| :--- | :--- | :--- | :--- | :--- |
| **`history` inside `CaseRecord`** (`chiefComplaint`, `hpi`, `pastMedicalSurgical`, `drugAllergy`, `family`, `personal`, `reviewOfSystems`, `dashavidhaPariksha`) | **EMBEDDED** (1:1 subdocument within `CaseRecord`) | Always read and written atomically with the `CaseRecord` during patient kiosk intake, red-flag evaluation, and physician case summary review. Embedding eliminates costly `$lookup` joins on the hottest read path. | Bounded 1:1 subdocument per clinical encounter. Fields are fixed-structure clinical questionnaires. | Typical embedded `history` payload is **2 KB – 6 KB** (< 0.04% of the 16 MB BSON limit). Zero risk of unbounded growth. |
| **`redFlags[]` & `physicianEdits[]` inside `CaseRecord`** | **EMBEDDED** (Bounded 1:Few array within `CaseRecord`) | Triage queue and physician review screens require immediate display of triggered red flags and the audit trail of physician modifications alongside the case summary. Atomic `$push` / `$set` updates ensure consistency without multi-document transactions. | Bounded 1:Few: A single case triggers 0–6 red flags and undergoes 1–30 physician edits before final sign-off (`status: "reviewed"`). | Each edit/flag entry is ~250 bytes; 30 edits + 6 flags consume **~9 KB**, well within the 16 MB limit. |
| **`MedicalDocument` (`patientId` ref to `Patient`)** | **REFERENCED** (1:Many standalone collection referencing `Patient._id`) | Documents (lab reports, prescriptions, discharge summaries) are uploaded asynchronously across a patient's lifetime, queried independently for abnormal lab analytics (`$unwind` on `extracted.investigations`), and merged on-demand for chronological timelines. | Unbounded / High-growth 1:Many: A chronic care patient may accumulate hundreds of lab reports and `rawText` payloads over years. | Keeping `MedicalDocument` in a separate collection prevents `Patient` or `CaseRecord` documents from bloating toward the 16 MB BSON ceiling as `rawText` and lab panels accumulate. |
| **`CaseRecord` (`patientId` ref to `Patient`)** | **REFERENCED** (1:Many standalone collection referencing `Patient._id`) | Queried independently by triage queue (`{ status: 1, priority: -1, createdAt: 1 }`), analytics aggregations, and per-patient paginated history (`{ patientId: 1, createdAt: -1 }`). | Unbounded 1:Many: Patients visit the clinic repeatedly over years. | Prevents unbounded array growth inside `Patient` and allows independent TTL indexing on stale draft cases. |

## 3. Relationship Cardinality Patterns in MediKiosk

### 3.1 One-to-One (1:1) — `User` ↔ `Patient` (and `CaseRecord` ↔ Embedded `history`)
- **Referenced 1:1 (`User` ↔ `Patient`)**: Authentication credentials (`email`, `passwordHash`, `role`, `abhaId`) live in `users`, while clinical demographics and revocable consent (`demographics`, `consent`) live in `patients` with a unique index on `userId` (`idx_patient_userid_unique`). Separating authentication from clinical demographics enforces principle-of-least-privilege and keeps auth middleware lightweight.
- **Embedded 1:1 (`CaseRecord.history`)**: Clinical intake sections (`hpi`, `reviewOfSystems`, `dashavidhaPariksha`) are strictly 1:1 with a clinical encounter and are embedded directly inside `CaseRecord`.

### 3.2 One-to-Many (1:N) — `Patient` → `CaseRecord` & `Patient` → `MedicalDocument`
- **Bounded 1:Few (Embedded)**: `CaseRecord.physicianEdits[]` and `CaseRecord.redFlags[]` embed small, bounded arrays directly inside the parent `CaseRecord`.
- **Unbounded 1:Many (Referenced)**: A single `Patient` can have dozens or hundreds of `CaseRecord` encounters and `MedicalDocument` uploads over their lifetime. Both child collections store `patientId: ObjectId` indexed via compound indexes (`{ patientId: 1, createdAt: -1 }` and `{ patientId: 1, docDate: -1 }`) to support fast chronological pagination and cascading deletes when a patient revokes/deletes their profile.

### 3.3 Many-to-Many (M:N) — `User (Physician)` ↔ `Patient` via `PhysicianAssignment`
- In an integrative hospital like AIIA, a single **Patient** may be co-managed by multiple **Physicians** across departments (e.g., a primary consultant in *Kayachikitsa*, a specialist in *Panchakarma*, and an *Emergency Triage* physician), while each **Physician** manages hundreds of **Patients**.
- Rather than embedding potentially unbounded arrays of ObjectIds on either side, MediKiosk models this M:N relationship using the `physicianassignments` junction collection (`server/src/models/PhysicianAssignment.js`), which also carries relationship attributes (`department`, `assignmentRole`, `active`, `assignedAt`) and enforces uniqueness on `{ physicianId: 1, patientId: 1 }`.

## 4. Dual-Layer Validation Architecture (Mongoose + MongoDB `$jsonSchema`)

MediKiosk enforces data integrity at three distinct layers:
1. **API Boundary (Zod)**: Validates incoming HTTP request payloads (`req.body`, `req.query`) in Express middleware before controller execution.
2. **Application ODM Layer (Mongoose Schema)**: Enforces types, defaults, required paths, enums, min/max bounds, and regex patterns (`abhaId`, `email`).
3. **Database Storage Engine Layer (`$jsonSchema` via `createCollection` / `collMod`)**: Applied at server startup in `server/src/models/validators.js` with `validationLevel: "strict"` and `validationAction: "error"`. Even if an external script or raw driver query bypasses Mongoose (`collection.insertOne`), MongoDB rejects non-conforming documents with error code `121` (`Document failed validation`).
