import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

export const SimulatedFqHeatmap = ({ chromosomefqData }) => {
    const containerRef = useRef(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });
    const [heatmapData, setHeatmapData] = useState([]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                setContainerSize({ width, height });
            }
        });

        resizeObserver.observe(container);

        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        if (
            chromosomefqData &&
            chromosomefqData.length > 0 &&
            chromosomefqData[0].length > 0 &&
            containerSize.width > 0 &&
            containerSize.height > 0
        ) {
            const numRows = chromosomefqData.length;
            const numCols = chromosomefqData[0].length;
            // 根据容器大小计算单元格尺寸，确保单元格正方形
            const cellSize = Math.min(containerSize.width / numCols, containerSize.height / numRows);
            const svgWidth = numCols * cellSize;
            const svgHeight = numRows * cellSize;

            // 使用d3计算数据的最小/最大值
            const flatData = chromosomefqData.flat();
            const minValue = d3.min(flatData);
            const maxValue = d3.max(flatData);
            const colorScale = d3.scaleSequential(t => d3.interpolateReds(1 - t))
                .domain([minValue, maxValue]);

            // 构造热图每个单元格的数据（将 y 坐标翻转，使其左下角为原点）
            const cells = chromosomefqData.map((row, rowIndex) =>
                row.map((value, colIndex) => ({
                    x: colIndex * cellSize,
                    y: (numRows - rowIndex - 1) * cellSize,
                    cellSize,
                    fillColor: colorScale(value),
                    value,
                    rowIndex,
                    colIndex,
                }))
            );

            setHeatmapData(cells);
            setSvgSize({ width: svgWidth, height: svgHeight });
        }
    }, [chromosomefqData, containerSize]);

    return (
        <div
            ref={containerRef}
            style={{
                width: '50%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            {heatmapData.length > 0 && (
                <svg width={svgSize.width} height={svgSize.height}>
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
