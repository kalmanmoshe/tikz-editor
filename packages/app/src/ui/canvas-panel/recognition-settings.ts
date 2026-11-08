/** Recognition tuning. Pixel values stay consistent as the canvas zoom changes. */
export const RECOGNITION_SETTINGS = {
  minInputPoints: 3,
  minOutlinePoints: 7,
  minShapeSizePx: 25,
  maxClosureGapRatio: 0.23,
  line: {
    maxLengthRatio: 1.12,
    minTolerancePx: 3,
    toleranceRatio: 0.055
  },
  rectangle: {
    maxMeanEdgeError: 0.045,
    cornerCoverageRatio: 0.18,
    maxLengthToSideSum: 2.6
  },
  ellipse: {
    maxMeanSquaredRadialError: 0.012,
    minLengthRatio: 0.75,
    maxLengthRatio: 1.25
  },
  polygon: {
    minCorners: 3,
    endpointMergeRatio: 0.10,
    maxCorners: 20,
    seedTolerancePx: 1.5,
    seedToleranceRatio: 0.012,
    minFitTolerancePx: 2.5,
    maxRootMeanSquaredErrorRatio: 0.025,
    maxPointErrorRatio: 0.10,
    maxLengthRatio: 1.20,
    minCornerTurnDegrees: 30,
    // Measure the drawn turn near each proposed corner, not across whole sides.
    cornerProbeSideRatio: 0.20,
    minDrawnToFittedTurnRatio: 0.55
  }
} as const;
