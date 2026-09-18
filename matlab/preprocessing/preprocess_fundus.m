function [processedImg, mask, qualityScore] = preprocess_fundus(imgPath, targetSize)
% PREPROCESS_FUNDUS Preprocess retinal fundus image for DR screening
%
% Toolboxes required:
%   - Image Processing Toolbox
%   - Medical Imaging Toolbox
%
% Inputs:
%   imgPath    - Path to input retinal image file
%   targetSize - 1x2 vector [height, width], default [512, 512]
%
% Outputs:
%   processedImg - Preprocessed RGB image normalized [0, 1]
%   mask         - Binary mask of the circular fundus region
%   qualityScore - Estimated image gradability score [0, 100]

    if nargin < 2 || isempty(targetSize)
        targetSize = [512, 512];
    end

    % Read image
    rawImg = imread(imgPath);
    if size(rawImg, 3) == 1
        rawImg = cat(3, rawImg, rawImg, rawImg);
    end

    % Step 1: Detect circular retinal boundary and create mask
    gray = rgb2gray(rawImg);
    thresh = gray > 15;
    mask = imfill(thresh, 'holes');
    mask = bwareafilt(mask, 1);

    % Step 2: Crop to circular fundus bounding box
    stats = regionprops(mask, 'BoundingBox');
    if ~isempty(stats)
        bb = round(stats(1).BoundingBox);
        bb(1) = max(1, bb(1));
        bb(2) = max(1, bb(2));
        bb(3) = min(size(rawImg, 2) - bb(1), bb(3));
        bb(4) = min(size(rawImg, 1) - bb(2), bb(4));
        rawImg = imcrop(rawImg, bb);
        mask = imcrop(mask, bb);
    end

    % Step 3: Resize to standardized input dimensions
    imgResized = imresize(rawImg, targetSize);
    mask = imresize(mask, targetSize, 'nearest');

    % Step 4: Graham's retinal illumination normalization (sigma = 10)
    imgDouble = im2double(imgResized);
    sigma = 10;
    localMean = imgaussfilt(imgDouble, sigma);
    enhanced = 4 * imgDouble - 4 * localMean + 0.5;
    enhanced = max(0, min(1, enhanced));

    % Apply mask
    mask3 = repmat(mask, [1, 1, 3]);
    processedImg = enhanced .* mask3;

    % Step 5: Calculate Image Quality / Gradability Metric
    % Evaluates contrast, exposure, and sharp edge gradient
    grad = imgradient(rgb2gray(processedImg));
    meanGrad = mean(grad(mask));
    meanIntensity = mean(gray(thresh));
    
    if meanIntensity < 40
        % Underexposed / dark
        qualityScore = round(max(35, min(64, meanIntensity * 1.5)));
    elseif meanIntensity > 210
        % Overexposed / glare
        qualityScore = round(max(30, min(60, (255 - meanIntensity) * 1.8)));
    else
        % Gradable range
        qualityScore = round(min(98, max(68, 70 + meanGrad * 0.8)));
    end
end
