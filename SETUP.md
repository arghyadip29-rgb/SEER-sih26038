# SEER— Setup and Installation Guide

This guide details the end-to-end setup for the Diabetic Retinopathy (DR) screening prototype.

---

## 1. System Requirements

- **Node.js**: v20+ (v25 recommended for native `node:sqlite`)
- **Python**: 3.10+ (for dataset downloading, verification, and preprocessing scripts)
- **PostgreSQL**: 14+ (optional for local offline mode; required for central cloud deployment)
- **MATLAB**: R2022b or newer with the following required toolboxes:
  1. *Image Processing Toolbox*
  2. *Computer Vision Toolbox*
  3. *Deep Learning Toolbox*
  4. *Medical Imaging Toolbox*
  5. *Simulink*
  6. *Statistics and Machine Learning Toolbox*

> **Note on MATLAB Engine Execution**:
> The system includes a persistent MATLAB service layer (`server/services/matlab/matlabService.js`). If a native MATLAB executable is not found on `PATH` or configured via `MATLAB_PATH`, the service automatically falls back to an integrated high-fidelity scientific engine implementing the identical preprocessing, Grad-CAM generation, 4-quadrant lesion counting, and ICDR mapping pipeline.

---

## 2. Installation Steps

### Step 1: Install Dependencies
From the repository root:
```bash
# Install root orchestration packages
npm install

# Install server dependencies
npm --prefix server install

# Install client dependencies
npm --prefix client install
```

### Step 2: Environment Configuration
Copy the example environment file in `server/`:
```bash
cp server/.env.example server/.env
```
Edit `server/.env` to configure your settings:
- `PORT`: 4000 (default)
- `DATABASE_URL`: Your PostgreSQL connection string (e.g. `postgresql://user:pass@localhost:5432/seer_retina`)
- `SQLITE_PATH`: Path to local SQLite offline database (default: `./data/seer_offline.sqlite`)
- `MATLAB_PATH`: Path to your MATLAB binary (leave empty to use fallback engine)
- `DATA_ROOT`: `./data`

---

## 3. Dataset Pipeline Setup

Download the datasets using the dataset manager or extract them into the following structure:

```
data/
  ├── aptos2019/    # Primary DR classification training & held-out test
  ├── idrid/        # DR classification & lesion segmentation
  ├── drive/        # Retinal vessel extraction (NOT DR grading)
  └── messidor2/    # External validation / generalization testing
```

Verify dataset structure:
```bash
python scripts/download_datasets.py --verify-only
```

### Dataset Sources:
1. **APTOS 2019 Blindness Detection**: https://www.kaggle.com/c/aptos2019-blindness-detection
2. **IDRiD**: https://ieeedataport.org/open-access/indian-diabetic-retinopathy-image-dataset-idrid
3. **DRIVE**: https://drive.grand-challenge.org/
4. **Messidor-2**: https://www.adcis.net/en/third-party/messidor2/

---

## 4. Model Training & Evaluation (MATLAB)

### Running Training in MATLAB
Open MATLAB and execute:
```matlab
addpath(genpath('matlab'));
[trainedNet, trainInfo, metrics] = train_dr_classifier();
```
Artifacts are automatically exported to `models/dr_classifier/model_v1/`:
- `config.json`
- `metrics.json`
- `README.md`

### Evaluating Held-Out & External Sets
```matlab
addpath(genpath('matlab'));
evalResults = evaluate_model(yTrue, yPredScores, 0.50);
```

---

## 5. Running the Application

### Option A: Concurrent Development Mode (Full Stack)
```bash
npm run dev
```
- Client runs on `http://localhost:5173`
- Server API runs on `http://localhost:4000`

### Option B: Independent Services
```bash
# Terminal 1: Backend Server
npm run server

# Terminal 2: Frontend Client
npm run client
```

### Option C: Run Automated Test Suite
```bash
npm test
```

---

## 6. Offline Mode & Database Synchronization

1. **Offline-First Mode**:
   When no `DATABASE_URL` is set or PostgreSQL is offline, the backend seamlessly routes all patient records, screenings, image metadata, and doctor decisions to the embedded SQLite database (`node:sqlite`).
2. **Synchronization**:
   When network connectivity to PostgreSQL is restored, initiate synchronization via:
   - Dashboard Sync button
   - API: `POST /api/sync`
   - Inspection: `GET /api/sync/status`
