import React, { useState, useEffect, useRef } from 'react';
import { InputNumber, Slider } from 'antd';
import * as d3 from 'd3';

export const SimulatedFqHeatmap = ({ chromosomefqData }) => {
    const containerRef = useRef(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });
    const [heatmapData, setHeatmapData] = useState([]);
    const [colorScaleRange, setColorScaleRange] = useState([0, 0.3]);
    const [dataMin, setDataMin] = useState(0);
    const [dataMax, setDataMax] = useState(0);

    const changeColorByInput = (type) => (value) => {
        setColorScaleRange((current) => {
            let newRange = [...current];
            if (type === "min") {
                newRange[0] = Math.max(Math.min(value, current[1]), dataMin);
            } else if (type === "max") {
                newRange[1] = Math.min(Math.max(value, current[0]), dataMax);
            }
            return newRange;
        });
    };

    const changeColorScale = (value) => {
        setColorScaleRange(value);
    };

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
            chromosomefqData[0].length > 0
        ) {
            const flatData = chromosomefqData.flat();
            const newDataMin = d3.min(flatData);
            const newDataMax = d3.max(flatData);
            setDataMin(newDataMin);
            setDataMax(newDataMax);
            setColorScaleRange((current) => {
                let lower = current[0];
                let upper = current[1];
                if (lower < newDataMin) {
                    lower = newDataMin;
                }
                if (upper > newDataMax) {
                    upper = newDataMax;
                }
                return [lower, upper];
            });
        }
    }, [chromosomefqData]);

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
            const cellSize = Math.min(containerSize.width / numCols, containerSize.height / numRows);
            const svgWidth = numCols * cellSize;
            const svgHeight = numRows * cellSize;

            const flatData = chromosomefqData.flat();
            const minValue = d3.min(flatData);
            const maxValue = d3.max(flatData);
            const colorScale = d3.scaleSequential(t => d3.interpolateReds(1 - t))
                .domain([colorScaleRange[0], colorScaleRange[1]]);

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
    }, [chromosomefqData, containerSize, colorScaleRange]);

    return (
        <div
            ref={containerRef}
            style={{
                width: '50%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                justifyContent: 'space-evenly',
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
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "5px",
                    alignItems: "center",
                    justifyContent: "center",
                    marginLeft: "10px"
                }}
            >
                <InputNumber
                    size="small"
                    style={{ width: 60 }}
                    controls={false}
                    value={colorScaleRange[1]}
                    min={colorScaleRange[0]}
                    max={dataMax}
                    onChange={changeColorByInput("max")}
                />
                <Slider
                    range={{ draggableTrack: true }}
                    vertical
                    style={{ height: 200 }}
                    step={0.1}
                    min={dataMin}
                    max={dataMax}
                    onChange={changeColorScale}
                    value={colorScaleRange}
                />
                <InputNumber
                    size="small"
                    style={{ width: 60 }}
                    controls={false}
                    value={colorScaleRange[0]}
                    min={dataMin}
                    max={colorScaleRange[1]}
                    onChange={changeColorByInput("min")}
                />
            </div>
        </div>
    );
};
