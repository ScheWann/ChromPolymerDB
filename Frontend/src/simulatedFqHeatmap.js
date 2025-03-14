import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

export const SimulatedFqHeatmap = ({ data, cellSpacing = 2 }) => {
    const containerRef = useRef(null);

    const [dimensions, setDimensions] = useState({
        width: 0,
        height: 0,
        svgWidth: 0,
        svgHeight: 0,
    });
    const [heatmapData, setHeatmapData] = useState([]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                setDimensions((prev) => ({ ...prev, width, height }));
            }
        });
        resizeObserver.observe(container);

        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        if (
            data &&
            data.length > 0 &&
            data[0].length > 0 &&
            dimensions.width > 0 &&
            dimensions.height > 0
        ) {
            const numRows = data.length;
            const numCols = data[0].length;
            const cellSizeX =
                (dimensions.width - (numCols - 1) * cellSpacing) / numCols;
            const cellSizeY =
                (dimensions.height - (numRows - 1) * cellSpacing) / numRows;
            const cellSize = Math.min(cellSizeX, cellSizeY);

            const svgWidth = numCols * cellSize + (numCols - 1) * cellSpacing;
            const svgHeight = numRows * cellSize + (numRows - 1) * cellSpacing;


            const flatData = data.flat();
            const minValue = d3.min(flatData);
            const maxValue = d3.max(flatData);

            const colorScale = d3
                .scaleSequential(t => d3.interpolateReds((1 - t) * 0.9 + 0.1))
                .domain([minValue, maxValue]);

            const cells = data.map((row, rowIndex) =>
                row.map((value, colIndex) => {
                    const fillColor = colorScale(value);
                    const x = colIndex * (cellSize + cellSpacing);
                    const y = (numRows - rowIndex - 1) * (cellSize + cellSpacing);
                    return { x, y, fillColor, value, rowIndex, colIndex, cellSize };
                })
            );

            setHeatmapData(cells);
            setDimensions((prev) => ({ ...prev, svgWidth, svgHeight }));
        }
    }, [data, dimensions.width, dimensions.height, cellSpacing]);

    return (
        <div
            ref={containerRef}
            style={{ width: '100%', height: '100%', position: 'relative' }}
        >
            {heatmapData.length > 0 && (
                <svg width={dimensions.svgWidth} height={dimensions.svgHeight}>
                    {heatmapData.flat().map((cell) => (
                        <rect
                            key={`cell-${cell.rowIndex}-${cell.colIndex}`}
                            x={cell.x}
                            y={cell.y}
                            width={cell.cellSize}
                            height={cell.cellSize}
                            fill={cell.fillColor}
                        />
                    ))}
                </svg>
            )}
        </div>
    );
};