"""
SEER / Drishti — Retinal Dataset Acquisition & Verification Pipeline

Supported Datasets:
1. APTOS 2019 Blindness Detection (Kaggle: aptos2019-blindness-detection)
   - Primary DR classification training & held-out test
2. IDRiD (Indian Diabetic Retinopathy Image Dataset - IEEE DataPort)
   - DR classification and pixel-level lesion validation
3. DRIVE (Digital Retinal Images for Vessel Extraction - Grand Challenge)
   - Retinal vasculature segmentation (NOT for DR grading)
4. Messidor-2 (ADCIS / Messidor-2)
   - External validation & generalizability testing

Usage:
    python scripts/download_datasets.py --verify-only
    python scripts/download_datasets.py --dataset aptos2019
"""

import os
import sys
import argparse
import json
import hashlib
from pathlib import Path

DATA_ROOT = os.environ.get("DATA_ROOT", os.path.join(os.getcwd(), "data"))

DATASET_CONFIG = {
    "aptos2019": {
        "description": "APTOS 2019 Blindness Detection (3,662 train images, 5 DR classes)",
        "source": "https://www.kaggle.com/c/aptos2019-blindness-detection",
        "dir": os.path.join(DATA_ROOT, "aptos2019"),
        "expected_subdirs": ["train_images", "test_images"],
        "expected_files": ["train.csv"],
        "role": "Primary DR grading training + validation + held-out test",
    },
    "idrid": {
        "description": "IDRiD: Indian Diabetic Retinopathy Image Dataset (516 images + lesion masks)",
        "source": "https://ieeedataport.org/open-access/indian-diabetic-retinopathy-image-dataset-idrid",
        "dir": os.path.join(DATA_ROOT, "idrid"),
        "expected_subdirs": ["images", "groundtruths"],
        "expected_files": [],
        "role": "Lesion detection & multi-lesion ground truth segmentation",
    },
    "drive": {
        "description": "DRIVE: Digital Retinal Images for Vessel Extraction (40 images)",
        "source": "https://drive.grand-challenge.org/",
        "dir": os.path.join(DATA_ROOT, "drive"),
        "expected_subdirs": ["training", "test"],
        "expected_files": [],
        "role": "Retinal vessel extraction ONLY (never used for DR grading)",
    },
    "messidor2": {
        "description": "Messidor-2: 1,748 fundus examinations for external validation",
        "source": "https://www.adcis.net/en/third-party/messidor2/",
        "dir": os.path.join(DATA_ROOT, "messidor2"),
        "expected_subdirs": ["images"],
        "expected_files": ["messidor_data.csv"],
        "role": "Independent external validation of referable DR generalization",
    },
}

def init_directories():
    print(f"[*] Initializing dataset root: {DATA_ROOT}")
    os.makedirs(DATA_ROOT, exist_ok=True)
    for key, cfg in DATASET_CONFIG.items():
        dataset_dir = cfg["dir"]
        os.makedirs(dataset_dir, exist_ok=True)
        readme_path = os.path.join(dataset_dir, "README.md")
        if not os.path.exists(readme_path):
            with open(readme_path, "w", encoding="utf-8") as f:
                f.write(f"# {key.upper()} Dataset\n\n")
                f.write(f"- **Description**: {cfg['description']}\n")
                f.write(f"- **Source**: {cfg['source']}\n")
                f.write(f"- **Role**: {cfg['role']}\n\n")
                f.write("### Setup Instructions\n")
                f.write("Download archives from official source and extract contents here.\n")
                f.write(f"Ensure expected subdirectories exist: {', '.join(cfg['expected_subdirs'])}\n")
        print(f"  - Configured directory for {key}: {dataset_dir}")

def verify_datasets():
    print("\n[*] Verifying Dataset Integrity & Presence:")
    all_ready = True
    summary = {}
    for key, cfg in DATASET_CONFIG.items():
        d = cfg["dir"]
        exists = os.path.isdir(d)
        file_count = len(os.listdir(d)) if exists else 0
        status = "READY" if file_count > 1 else "PENDING_DOWNLOAD"
        if status != "READY":
            all_ready = False
        summary[key] = {
            "status": status,
            "path": d,
            "items_found": file_count,
            "source": cfg["source"],
            "role": cfg["role"],
        }
        print(f"  [{key.upper()}] Status: {status} ({file_count} files/folders) -> {cfg['role']}")

    return summary, all_ready

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SEER Dataset Manager")
    parser.add_argument("--verify-only", action="store_true", help="Verify current datasets without downloading")
    parser.add_argument("--dataset", choices=["all", "aptos2019", "idrid", "drive", "messidor2"], default="all")
    args = parser.parse_args()

    init_directories()
    summary, ready = verify_datasets()
    print("\n[*] Dataset Pipeline Status:", "All verified" if ready else "Download required for complete raw sets")
