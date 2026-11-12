// AbsoJob chart palette — validated (lightness band, chroma floor, colour-blind separation,
// normal-vision floor) with the dataviz palette checker. Assign series in this fixed order;
// never cycle past six (fold extras into "Other"). Amber and light blue are below 3:1 on
// white, so charts using them keep a legend or direct labels.
export const CHART_SERIES = ["#2F6AA8", "#E0952A", "#1E9367", "#8A6FB0", "#5AA9E6", "#B42332"] as const;
export const CHART_GRID = "#E2E7EF";
export const CHART_AXIS = "#718096";
export const CHART_TEXT = "#27364B";
