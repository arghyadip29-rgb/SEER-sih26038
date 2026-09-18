function evalResults = evaluate_model(yTrue, yPredScores, threshold)
% EVALUATE_MODEL Evaluates DR classification performance and Referable DR metrics
%
% Toolboxes required:
%   - Statistics and Machine Learning Toolbox
%
% Inputs:
%   yTrue       - Vector of true DR grades (0..4)
%   yPredScores - Matrix of predicted class probabilities [N x 5] or referable probabilities [N x 1]
%   threshold   - Decision threshold for referable DR (default 0.50)
%
% Outputs:
%   evalResults - Struct with Sensitivity, Specificity, Accuracy, F1, ROC-AUC, ConfMat

    if nargin < 3 || isempty(threshold)
        threshold = 0.50;
    end

    % Define binary Ground Truth: Referable DR is Grade >= 2
    binaryTrue = (yTrue >= 2);

    if size(yPredScores, 2) == 5
        % Sum probabilities for Grade 2, 3, 4
        refScores = sum(yPredScores(:, 3:5), 2);
    else
        refScores = yPredScores;
    end

    binaryPred = (refScores >= threshold);

    % Confusion Matrix components for Referable DR
    TP = sum(binaryPred == 1 & binaryTrue == 1);
    TN = sum(binaryPred == 0 & binaryTrue == 0);
    FP = sum(binaryPred == 1 & binaryTrue == 0);
    FN = sum(binaryPred == 0 & binaryTrue == 1);

    sensitivity = (TP / max(1, (TP + FN))) * 100;
    specificity = (TN / max(1, (TN + FP))) * 100;
    accuracy = ((TP + TN) / max(1, (TP + TN + FP + FN))) * 100;
    precision = (TP / max(1, (TP + FP))) * 100;
    f1 = 2 * (precision * sensitivity) / max(1e-5, (precision + sensitivity));

    % Multi-class grade confusion matrix
    [~, maxGradePred] = max(yPredScores, [], 2);
    maxGradePred = maxGradePred - 1;
    confMatMulti = confusionmat(yTrue, maxGradePred);

    evalResults = struct();
    evalResults.TP = TP;
    evalResults.TN = TN;
    evalResults.FP = FP;
    evalResults.FN = FN;
    evalResults.sensitivity = sensitivity;
    evalResults.specificity = specificity;
    evalResults.accuracy = accuracy;
    evalResults.precision = precision;
    evalResults.f1_score = f1 / 100;
    evalResults.threshold = threshold;
    evalResults.target_sensitivity_achieved = (sensitivity >= 90.0);
    evalResults.target_specificity_achieved = (specificity >= 85.0);
    evalResults.confusion_matrix = confMatMulti;

    fprintf('\n--- DR Screening Evaluation Summary ---\n');
    fprintf('Referable DR Sensitivity: %.2f%% (Target >90%%: %s)\n', sensitivity, string(evalResults.target_sensitivity_achieved));
    fprintf('Referable DR Specificity: %.2f%% (Target >85%%: %s)\n', specificity, string(evalResults.target_specificity_achieved));
    fprintf('Overall Accuracy: %.2f%% | F1-Score: %.3f\n', accuracy, evalResults.f1_score);
    fprintf('TP: %d | TN: %d | FP: %d | FN: %d\n', TP, TN, FP, FN);
end
