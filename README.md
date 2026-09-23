# SEER — Screening Engine using Explainable AI for Retinopathy
**SIH26038 | Theme: MedTech/BioTech/HealthTech | Team SeerSix | Team ID: 152786**

---

## 1. Overview

SEER is a MATLAB-centered, explainable diabetic retinopathy (DR) screening platform for rural/PHC deployment. It combines image quality checks, DR grading, lesion segmentation, Grad-CAM explainability, ICDR-aligned interpretation, doctor verification, and referral/follow-up tracking — not just a raw classification label.

## MATLAB Pipeline
Fundus Image → Quality Check → DR Classification (ResNet-50) + Lesion Segmentation (U-Net)
→ Grad-CAM → Evidence Fusion → ICDR Report → Doctor Verify (Approve/Override/Refer)
→ Referral Follow-up (PHC/ASHA tracking)


---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js, Next.js, Tailwind CSS |
| Backend | Python/FastAPI, MATLAB Compiler SDK |
| Classification | ResNet-50 |
| Segmentation | U-Net (DRIVE, IDRiD) |
| Explainability | Grad-CAM |
| MATLAB Toolboxes | Image Processing, Computer Vision, Deep Learning, Medical Imaging, Statistics & ML, Parallel Computing |
| Simulation | Simulink + SimEvents |
| Database | PostgreSQL (central), SQLite (offline) |

---
## 3. Detailed Architecture Diagram

┌──────────────────────────────────────────────────────────────────────────────┐
│                              SEER — SYSTEM ARCHITECTURE                      │
│                     SIH26038 | Team SeerSix | Team ID 152786                 │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  LAYER 1 — CLIENT / PRESENTATION                                             │
│  ┌────────────┐   ┌────────────────┐   ┌────────────────┐                    │
│  │  Patient   │   │  Doctor         │   │  PHC / ASHA     │                  │
│  │  Portal    │   │  Dashboard      │   │  Worker Portal  │                  │
│  └─────┬──────┘   └────────┬────────┘   └────────┬────────┘                  │
│        └────────────────────┴────────────────────┘                           │
│                              │                                               │
│               React.js + Next.js + Tailwind CSS                              │
└──────────────────────────────┼───────────────────────────────────────────────┘
                               │  REST / API calls
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  LAYER 2 — APPLICATION / API                                                 │
│                                                                              │
│   ┌───────────────────────┐        ┌────────────────────────────┐            │
│   │   Python / FastAPI    │◄──────►│   MATLAB Compiler SDK      │            │
│   │   (Auth, Routing,     │        │   (bridges MATLAB pipeline │            │
│   │   Business Logic,     │        │   to backend without full) │            │
│   │   Referral Engine)    │        │   MATLAB runtime)          │            │
│   └───────────┬───────────┘        └──────────────┬─────────────┘            │
└───────────────┼─────────────────────────────────────┼────────────────────────┘
                │                                     │
                ▼                                     ▼
┌────────────────────────────────┐   ┌───────────────────────────────────────────┐
│  LAYER 3 — DATA                │   │  LAYER 4 — MATLAB AI/ML PIPELINE          │
│                                │   │                                           │
│  ┌──────────────┐              │   │   Fundus Image Input                      │
│  │ PostgreSQL   │  (central)   │   │        │                                  │
│  └──────────────┘              │   │        ▼                                  │
│  ┌──────────────┐              │   │  ┌──────────────────────────┐             │
│  │ SQLite       │  (offline/   │   │  │ Image Quality Assessment │             │
│  │              │   edge PHC)  │   │  │ (blur, illumination,     │             │
│  └──────────────┘              │   │  │  contrast, FOV)          │             │
│                                │   │  └───────────┬──────────────┘             │
│  Stores: patients, screenings, │   │      Poor ─┐  │  Good                     │
│  referrals, follow-ups,        │   │  Retake ◄──┘  ▼                           │
│  doctor decisions              │   │        ┌─────────────┴─────────────┐      │
└────────────────────────────────┘   │        ▼                           ▼      │
                                      │  ┌────────────┐             ┌──────────┐│
                                      │  │ ResNet-50  │             │  U-Net   ││
                                      │  │ (DR Grade  │             │ (Lesion &││
                                      │  │  0–4)      │             │  Vessel  ││
                                      │  │            │             │  Masks)  ││
                                      │  └─────┬──────┘             └────┬─────┘│
                                      │        │      ┌──────────────┐  │       │
                                      │        ├─────►│  Grad-CAM    │◄─┤       │
                                      │        │      │ (Explainab.) │  │       │
                                      │        │      └──────┬───────┘  │       │
                                      │        └─────────────┼──────────┘       │
                                      │                       ▼                 │
                                      │              Evidence Fusion Engine     │
                                      │              (ICDR-aligned mapping)     │
                                      │                       │                 │
                                      │                       ▼                 │
                                      │            Explainable Clinical Report  │
                                      │                                         │
                                      │  MATLAB Toolboxes used:                 │
                                      │  Image Processing · Computer Vision ·   │
                                      │  Deep Learning · Medical Imaging ·      │
                                      │  Statistics & ML · Parallel Computing   │
                                      └────────────────┬────────────────────────┘
                                                       │
                                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  LAYER 5 — CLINICAL WORKFLOW                                                 │
│                                                                              │
│   Doctor Report ──► Doctor Verification ──► Approve / Override / Refer       │
│                                                       │                      │
│                                                       ▼                      │
│                                          Referral & Follow-up Tracking       │
│                                          (PHC/ASHA · overdue detection ·     │
│                                           escalation)                        │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  LAYER 6 — RESOURCE PLANNING / SIMULATION                                    │
│                                                                              │
│   Simulink + SimEvents                                                       │
│   Models: Image Arrival → AI Processing → Doctor Queue →                     │
│           Ophthalmologist Review → Referral/Clearance                        │
│                                                                              │
│   Simulated scale: 100,000 & 500,000 patients                                │
│   Assumed doctor capacity: ~25 sec/case → ~144 cases/hour                    │
└──────────────────────────────────────────────────────────────────────────────┘

---

## 4. Datasets

| Dataset | Role | N |
|---|---|---|
| APTOS 2019 | Train/Validation | 3662 total (3297 train / 365 val, 10% split) |
| Messidor-2 | External validation | 1744 matched images |
| DRIVE | Vessel segmentation | — |
| IDRiD | Lesion segmentation (MA/HE/EX/SE) | — |

**Referable DR definition:** Grade 0–1 = Non-referable · Grade 2–4 = Referable
`Sensitivity = TP/(TP+FN)` · `Specificity = TN/(TN+FP)`

---

## 5. Results

### 5.1 APTOS 2019 — 10% Validation (N=365)

| Metric | Result |
|---|---:|
| 5-class accuracy | **84.38%** |
| Grade 2+ Sensitivity | **97.97%** |
| Grade 2+ Specificity | **92.63%** |
| TP / TN / FP / FN | 145 / 201 / 16 / 3 |

**Confusion Matrix**
````text
              Predicted
True       0    1    2    3    4
0        174    3    3    0    0
1          5   19   13    0    0
2          2    0   96    1    1
3          0    0   12    7    0
4          0    1   14    2   12
````

### 5.2 Messidor-2 — Actual External Evaluation (N=1744)

| Metric | Result |
|---|---:|
| Grade 2+ Sensitivity | 90.37% |
| Grade 2+ Specificity | 85.39% |
| TP / TN / FP / FN | 413 / 1099 / 188 / 44 |

````text
              Predicted
True       0    1    2    3    4
0        900    0   50   40   27
1          0  199   30   20   21
2         20   17  310    0    0
3          3    2    0   70    0
4          1    1    0    0   33
````

## 6. Project Status

**Done:** ResNet-50 classification · APTOS pipeline · Grade 2+ evaluation · confusion matrices · Messidor-2 external eval · threshold analysis · Grad-CAM · Simulink/SimEvents resource modeling · doctor/PHC workflow design

**In progress:** U-Net vessel (DRIVE) & lesion (IDRiD) segmentation · lesion-evidence fusion · full MATLAB deployment integration · production frontend/backend integration

---

## Disclaimer
SEER is a research/prototype system to support DR screening and clinical decision support. It does not replace ophthalmological examination or clinical judgment. All AI findings require clinical verification.

**Team SeerSix | SIH26038**
````
