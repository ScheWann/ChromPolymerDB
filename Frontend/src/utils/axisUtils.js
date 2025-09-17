/**
 * Shared utilities for consistent axis configuration between heatmap and gene list
 */

/**
 * Calculate axis values for a given chromosome sequence and step size
 * @param {Object} currentChromosomeSequence - { start, end }
 * @param {number} step - Step size for axis values (e.g., 5000 for regular, 30000 for Bintu)
 * @param {boolean} isBintuMode - Whether in Bintu mode
 * @param {Array} zoomedChromosomeData - Data for Bintu mode (optional)
 * @returns {Array} Array of axis values
 */
export const calculateAxisValues = (currentChromosomeSequence, step = 5000, isBintuMode = false, zoomedChromosomeData = []) => {
    const { start, end } = currentChromosomeSequence;
    
    if (isBintuMode && zoomedChromosomeData.length > 0) {
        // For Bintu mode, use actual data positions instead of creating a continuous range
        const allPositions = new Set();
        zoomedChromosomeData.forEach(d => {
            allPositions.add(d.x);
            allPositions.add(d.y);
        });
        return Array.from(allPositions).sort((a, b) => a - b);
    } else {
        // For regular mode, use the continuous range approach
        const adjustedStart = Math.floor(start / step) * step;
        const adjustedEnd = Math.ceil(end / step) * step;
        return Array.from(
            { length: Math.floor((adjustedEnd - adjustedStart) / step) + 1 },
            (_, i) => adjustedStart + i * step
        );
    }
};

/**
 * Calculate tick values and step for consistent axis display
 * @param {Array} axisValues - Array of all axis values
 * @param {number} availableWidth - Available width for the axis
 * @param {Object} currentChromosomeSequence - { start, end }
 * @param {boolean} isBintuMode - Whether in Bintu mode
 * @returns {Object} { tickValues, tickStep }
 */
export const calculateTickValues = (axisValues, availableWidth, currentChromosomeSequence, isBintuMode = false) => {
    const nBins = axisValues.length;
    
    if (isBintuMode) {
        // For Bintu mode, use space-based calculation similar to heatmap
        const maxTicks = Math.min(nBins, Math.max(8, Math.floor(availableWidth / 45))); // ~1 label per 45px
        const tickStep = Math.max(1, Math.ceil(nBins / maxTicks));
        
        // Filter ticks with step, but avoid having the last tick too close to the previous one
        const baseTicks = axisValues.filter((_, i) => i % tickStep === 0);
        const lastIndex = nBins - 1;
        const lastSteppedIndex = baseTicks.length > 0 ? axisValues.indexOf(baseTicks[baseTicks.length - 1]) : -1;
        
        // Only add the last tick if it's not too close to the previous one
        // "Too close" means less than half of tickStep away
        const tickValues = (lastIndex - lastSteppedIndex >= Math.max(1, Math.floor(tickStep / 2))) 
            ? [...baseTicks, axisValues[lastIndex]]
            : baseTicks;
            
        return { tickValues, tickStep };
    } else {
        // For regular mode, use range-based calculation similar to gene list
        const range = currentChromosomeSequence.end - currentChromosomeSequence.start;
        let tickCount;
        
        if (range < 1000000) {
            tickCount = Math.max(Math.floor(range / 20000), 5);
        } else if (range >= 1000000 && range <= 10000000) {
            tickCount = Math.max(Math.floor(range / 50000), 5);
        } else {
            tickCount = 50;
        }
        
        tickCount = Math.min(tickCount, 30);
        
        const tickValues = axisValues.filter((_, i) => i % tickCount === 0);
        return { tickValues, tickStep: tickCount };
    }
};

/**
 * Format tick labels consistently across components
 * @param {number} value - The tick value to format
 * @returns {string} Formatted label
 */
export const formatTickLabel = (value) => {
    if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value > 10000 && value < 1000000) {
        return `${(value / 10000).toFixed(1)}W`;
    }
    return value.toString();
};