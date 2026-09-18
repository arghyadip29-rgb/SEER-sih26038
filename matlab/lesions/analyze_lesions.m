function lesionResults = analyze_lesions(img, mask, optDiscCenter)
% ANALYZE_LESIONS Retinal lesion detection and 4-quadrant spatial distribution
%
% Toolboxes required:
%   - Image Processing Toolbox
%   - Computer Vision Toolbox
%
% Inputs:
%   img           - Preprocessed fundus image [H x W x 3]
%   mask          - Circular fundus mask
%   optDiscCenter - [x, y] coordinates of optic disc center (optional)
%
% Outputs:
%   lesionResults - Struct containing:
%       - counts: [struct of microaneurysms, hemorrhages, hard_exudates, soft_exudates]
%       - quadrantTable: cell array with lesion counts per quadrant:
%           Superior Temporal, Superior Nasal, Inferior Temporal, Inferior Nasal
%       - quadrantConvention: explanation of coordinate reference frame

    [H, W, ~] = size(img);
    if nargin < 2 || isempty(mask)
        mask = true(H, W);
    end
    if nargin < 3 || isempty(optDiscCenter)
        % Default macula/fovea center at image geometric center
        foveaCenter = [W / 2, H / 2];
    else
        foveaCenter = optDiscCenter;
    end

    % Extract green channel (highest contrast for retinal microvasculature)
    green = im2double(img(:, :, 2));

    % 1. Candidate Microaneurysms / Dot Hemorrhages via morphological top-hat
    seDisk = strel('disk', 3);
    topHat = imtophat(1 - green, seDisk);
    maCandidates = (topHat > 0.12) & mask;
    maCandidates = bwareafilt(maCandidates, [2, 45]); % Filter by pixel area

    % 2. Hard Exudates detection (high brightness in green & red, sharp borders)
    red = im2double(img(:, :, 1));
    exudateCand = (green > 0.65) & (red > 0.70) & mask;
    exudateCand = bwareafilt(exudateCand, [5, 250]);

    % 3. Retinal Hemorrhages (dark blotches, larger area)
    hemCand = (green < 0.28) & mask;
    hemCand = bwareafilt(hemCand, [50, 800]);

    % 4. Soft Exudates (Cotton Wool Spots - pale, ill-defined edges)
    softExudateCand = (green > 0.58) & (red > 0.60) & ~exudateCand & mask;
    softExudateCand = bwareafilt(softExudateCand, [40, 500]);

    % Spatial Quadrant Assignment based on fovea/center
    % Quadrants:
    %   ST (Superior Temporal): x < center_x & y < center_y (for OD right eye)
    %   SN (Superior Nasal):    x >= center_x & y < center_y
    %   IT (Inferior Temporal): x < center_x & y >= center_y
    %   IN (Inferior Nasal):    x >= center_x & y >= center_y
    [X, Y] = meshgrid(1:W, 1:H);
    qST = (X < foveaCenter(1)) & (Y < foveaCenter(2)) & mask;
    qSN = (X >= foveaCenter(1)) & (Y < foveaCenter(2)) & mask;
    qIT = (X < foveaCenter(1)) & (Y >= foveaCenter(2)) & mask;
    qIN = (X >= foveaCenter(1)) & (Y >= foveaCenter(2)) & mask;

    function [cTotal, cST, cSN, cIT, cIN] = countInQuadrants(binMap)
        cc = bwconncomp(binMap);
        props = regionprops(cc, 'Centroid');
        cTotal = cc.NumObjects;
        cST = 0; cSN = 0; cIT = 0; cIN = 0;
        for i = 1:cTotal
            pt = round(props(i).Centroid);
            if pt(2) <= H && pt(1) <= W && pt(2) >= 1 && pt(1) >= 1
                if qST(pt(2), pt(1)), cST = cST + 1;
                elseif qSN(pt(2), pt(1)), cSN = cSN + 1;
                elseif qIT(pt(2), pt(1)), cIT = cIT + 1;
                elseif qIN(pt(2), pt(1)), cIN = cIN + 1;
                end
            end
        end
    end

    [maTotal, maST, maSN, maIT, maIN] = countInQuadrants(maCandidates);
    [exTotal, exST, exSN, exIT, exIN] = countInQuadrants(exudateCand);
    [hemTotal, hemST, hemSN, hemIT, hemIN] = countInQuadrants(hemCand);
    [softTotal, softST, softSN, softIT, softIN] = countInQuadrants(softExudateCand);

    % Build standardized table structure
    quadrantTable = {
        'Microaneurysms', maTotal, sprintf('ST: %d, SN: %d, IT: %d, IN: %d', maST, maSN, maIT, maIN);
        'Hard Exudates', exTotal, sprintf('ST: %d, SN: %d, IT: %d, IN: %d', exST, exSN, exIT, exIN);
        'Retinal Hemorrhages', hemTotal, sprintf('ST: %d, SN: %d, IT: %d, IN: %d', hemST, hemSN, hemIT, hemIN);
        'Soft Exudates (CWS)', softTotal, sprintf('ST: %d, SN: %d, IT: %d, IN: %d', softST, softSN, softIT, softIN)
    };

    lesionResults = struct();
    lesionResults.microaneurysms = maTotal;
    lesionResults.hard_exudates = exTotal;
    lesionResults.retinal_hemorrhages = hemTotal;
    lesionResults.soft_exudates = softTotal;
    lesionResults.quadrantBreakdown = struct(...
        'ST', struct('ma', maST, 'ex', exST, 'hem', hemST, 'soft', softST), ...
        'SN', struct('ma', maSN, 'ex', exSN, 'hem', hemSN, 'soft', softSN), ...
        'IT', struct('ma', maIT, 'ex', exIT, 'hem', hemIT, 'soft', softIT), ...
        'IN', struct('ma', maIN, 'ex', exIN, 'hem', hemIN, 'soft', softIN) ...
    );
    lesionResults.table = quadrantTable;
    lesionResults.quadrantConvention = 'Superior Temporal (ST), Superior Nasal (SN), Inferior Temporal (IT), Inferior Nasal (IN) partitioned relative to retinal center';
end
