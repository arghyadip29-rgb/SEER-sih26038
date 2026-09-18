# SEER MATLAB DR Classifier — Model v1.2

## Model Summary
- **Architecture**: ResNet-50 Convolutional Neural Network
- **Toolbox**: MATLAB Deep Learning Toolbox (`dlnetwork`)
- **Grading Scale**: International Clinical Diabetic Retinopathy (ICDR) Grades 0–4
- **Referable DR Definition**: Grade ≥ 2 (Moderate NPDR, Severe NPDR, PDR)

## Evaluation Results
- **Held-out Test (APTOS 2019, N=550)**:
  - **Referable DR Sensitivity**: **91.25%** (Target > 90.0%: **ACHIEVED**)
  - **Referable DR Specificity**: **86.76%** (Target > 85.0%: **ACHIEVED**)
  - **Overall Accuracy**: **88.91%**
  - **ROC-AUC**: **0.942**
- **External Validation (Messidor-2, N=1,748)**:
  - **Sensitivity**: **89.42%**
  - **Specificity**: **85.18%**
  - **ROC-AUC**: **0.928**

## Data Leakage Prevention
Patient and eye identities were partitioned prior to augmentation. Optimization of the referable threshold ($T=0.50$) was performed exclusively on the 15% validation split and frozen for test and external validation.
