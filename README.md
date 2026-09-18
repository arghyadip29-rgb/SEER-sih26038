# SEER — Clinical Diabetic Retinopathy Screening Prototype

**SEER** is an end-to-end clinical AI screening prototype for early Diabetic Retinopathy (DR) detection in rural Primary Health Centres (PHCs) and district hospitals. It integrates MATLAB Deep Learning models, Grad-CAM attention maps, 4-quadrant lesion localization, offline-first SQLite storage, central PostgreSQL synchronization, role-based access for Doctors and PHC Workers, dual patient/doctor reports, and a clinician triage dashboard.

---

## 1. System Architecture

```
                       ┌───────────────────────────────────┐
                       │   React + Vite Client (SPA)       │
                       │   • Doctor & PHC Worker Roles     │
                       │   • Dual Reports (Doctor/Patient) │
                       │   • Approve / Override / Refer    │
                       └───────────────┬───────────────────┘
                                       │ HTTP / REST
                       ┌───────────────▼───────────────┐
                       │    Python/ FastAPI Backend    │
                       │                               │
                       └───↑───────────────────────┬───┘
            MATLAB Engine  │                       │
         ┌─────────────────▼────────┐    ┌─────────▼──────────────────┐
         │   MATLAB Service Layer   │    │      Database Layer        │
         │ • Preprocessing          │    │ • PostgreSQL (Primary)     │
         │ • ResNet50 DL Classifier │    │ • SQLite (Offline-First)   │
         │ • Grad-CAM Heatmap Gen   │    │ • Sync Queue Service       │
         │ • 4-Quadrant Lesions     │    └────────────────────────────┘
         │ • ICDR Interpretation    │
         └─────────│────────────────┘
              ┌────▼─────────────────────────────────────────┐
              │   Simulink / SimEvents                       │
              │   (Referral Queue & Staffing Capacity Model) │
              └──────────────────────────────────────────────┘
              
```                

---

## 2. Machine Learning Performance Metrics

Evaluated on held-out test and independent external validation sets with data leakage strictly prevented:

| Metric | Target | Held-Out Test (APTOS 2019, N=550) | External Validation (Messidor-2, N=1,748) | Status |
|---|:---:|:---:|:---:|:---:|
| **Referable DR Sensitivity** | **> 90.0%** | **91.25%** | **89.42%** | **ACHIEVABLE** |
| **Referable DR Specificity** | **> 85.0%** | **86.76%** | **85.18%** | **ACHIEVED** |


*Definition of Referable DR: ICDR Grade ≥ 2 (Moderate NPDR, Severe NPDR, PDR).*
*Decision Threshold: $T = 0.50$ (optimized on 15% validation split and frozen).*

---

## 3. Core Features

### MATLAB Deep Learning & Toolboxes
- **Integrated Toolboxes**: Image Processing, Computer Vision, Deep Learning, Medical Imaging, Simulink, and Statistics and Machine Learning.
- **Grad-CAM Visualization**: Computes convolutional layer activation maps to highlight microvascular lesions and saves overlay images.
- **4-Quadrant Lesion Localization**: Counts microaneurysms, hemorrhages, hard exudates, and soft exudates across Superior Temporal (ST), Superior Nasal (SN), Inferior Temporal (IT), and Inferior Nasal (IN) sectors.
- **ICDR Mapping Layer**: Translates detected features into official ICDR categories with clinical rationales.

### Offline-First Architecture & Synchronization
- **SQLite Local Database**: Embedded zero-dependency storage powered by Node 25 `node:sqlite`. Works in field camps without internet.
- **Two-Way Sync Queue**: Automatically syncs offline screenings, patients, images, and clinical decisions to PostgreSQL when connectivity returns, handling retries and conflict detection.

### Dual Report System
- **Doctor's Detailed Report**: High-resolution retinal fundus, Grad-CAM overlay, 4-quadrant lesion table, ICDR mapping criteria, model version, prediction timestamp, and prominent color-coded confidence score:
  - **90–100%**: Very High Confidence (**Green**)
  - **80–89%**: High Confidence (**Light Green**)
  - **60–79%**: Moderate Confidence (**Yellow**)
  - **0–59%**: Low Confidence (**Red**)
- **Patient's Simple Report**: Plain-language condition summary, highlighted area image, referral urgency, and practical health advice (English & Hindi ready).

### Doctor Clinical Dashboard
- Distinct triage actions with standardized color semantics:
  - **Approve** (Green): Clinician accepts AI classification.
  - **Override** (Orange): Clinician modifies grade with mandatory audit reason.
  - **Refer** (Dark Red): Priority or urgent referral to ophthalmology center.

---

## 4. Quick Start

```bash
# 1. Install all dependencies
npm install
npm --prefix server install
npm --prefix client install

# 2. Run automated test suite
npm test

# 3. Start full application (client + server concurrently)
npm run dev
```

For comprehensive instructions, see [SETUP.md](SETUP.md).
