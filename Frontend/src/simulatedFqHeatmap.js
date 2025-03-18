import React, { useState, useEffect, useRef } from 'react';
import { InputNumber, Slider } from 'antd';
import * as d3 from 'd3';

export const SimulatedFqHeatmap = ({ chromosomefqData, selectedChromosomeSequence }) => {
    const containerRef = useRef(null);
    const xAxisRef = useRef(null);
    const yAxisRef = useRef(null);

    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });
    const [heatmapData, setHeatmapData] = useState([]);
    const [colorScaleRange, setColorScaleRange] = useState([0, 1]);
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
            const margin = { top: 10, right: 0, bottom: 20, left: 80 };
            const numRows = chromosomefqData.length;
            const numCols = chromosomefqData[0].length;

            const cellSize = Math.min(
                (containerSize.width - margin.left - margin.right) / numCols,
                (containerSize.height - margin.top - margin.bottom) / numRows
            );
            const heatmapWidth = numCols * cellSize;
            const heatmapHeight = numRows * cellSize;

            const totalSvgWidth = heatmapWidth + margin.left + margin.right;
            const totalSvgHeight = heatmapHeight + margin.top + margin.bottom;

            const { start, end } = selectedChromosomeSequence;
            const step = 5000;
            const adjustedStart = Math.floor(start / step) * step;
            const adjustedEnd = Math.ceil(end / step) * step;

            const axisValues = Array.from(
                { length: Math.floor((adjustedEnd - adjustedStart) / step) + 1 },
                (_, i) => adjustedStart + i * step
            );


            const xScale = d3.scaleBand()
                .domain(axisValues)
                .range([0, heatmapWidth])
                .padding(0.1);

            const yScale = d3.scaleBand()
                .domain(axisValues)
                .range([heatmapHeight, 0])
                .padding(0.1);


            let tickCount;
            const range = selectedChromosomeSequence.end - selectedChromosomeSequence.start;
            if (range < 1000000) {
                tickCount = Math.max(Math.floor(range / 20000), 5);
            } else if (range >= 1000000 && range <= 10000000) {
                tickCount = Math.max(Math.floor(range / 50000), 5);
            } else {
                tickCount = 30;
            }
            tickCount = Math.min(tickCount, 30);

            const tickFormats = d => {
                if (d >= 1000000) {
                    return `${(d / 1000000).toFixed(3)}M`;
                }
                if (d > 10000 && d < 1000000) {
                    return `${(d / 10000).toFixed(3)}W`;
                }
                return d;
            };

            const filteredTicks = axisValues.filter((_, i) => i % tickCount === 0);

            const flatData = chromosomefqData.flat();
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
            setSvgSize({ width: totalSvgWidth, height: totalSvgHeight });

            if (xAxisRef.current) {
                d3.select(xAxisRef.current)
                    .attr("transform", `translate(${margin.left}, ${heatmapHeight + margin.top})`)
                    .call(
                        d3.axisBottom(xScale)
                            .tickValues(filteredTicks)
                            .tickFormat(tickFormats)
                    );
            }

            if (yAxisRef.current) {
                d3.select(yAxisRef.current)
                    .attr("transform", `translate(${margin.left}, ${margin.top})`)
                    .call(
                        d3.axisLeft(yScale)
                            .tickValues(filteredTicks)
                            .tickFormat(tickFormats)
                    );
            }
        }
    }, [chromosomefqData, containerSize, colorScaleRange, selectedChromosomeSequence]);

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
                    <g transform={`translate(80, 10)`}>
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
                    </g>
                    <g className="x-axis" ref={xAxisRef} />
                    <g className="y-axis" ref={yAxisRef} />
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
