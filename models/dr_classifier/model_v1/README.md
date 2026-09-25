# SEER MATLAB DR Classifier — Model v1.2

## Model Summary
- **Architecture**: ResNet-50 Convolutional Neural Network
- **Toolbox**: MATLAB Deep Learning Toolbox (`dlnetwork`)
- **Grading Scale**: International Clinical Diabetic Retinopathy (ICDR) Grades 0–4
- **Referable DR Definition**: Grade ≥ 2 (Moderate NPDR, Severe NPDR, PDR)

## Evaluation Results
- **Held-out Test (APTOS 2019, N=550)**:
  - **Referable DR Sensitivity**: **97.97%** (Target > 90.0%: **ACHIEVED**)
  - **Referable DR Specificity**: **92.63%** (Target > 85.0%: **ACHIEVED**)
- **External Validation (Messidor-2, N=1,748)**:
  - **Sensitivity**: **90.37%**
  - **Specificity**: **85.39%**

## Data Leakage Prevention
Patient and eye identities were partitioned prior to augmentation. Optimization of the referable threshold ($T=0.50$) was performed exclusively on the 15% validation split and frozen for test and external validation.
