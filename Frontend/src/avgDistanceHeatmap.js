import React, { useEffect, useState, useRef } from "react";
import { InputNumber, Slider } from "antd";
import { SimulatedFqHeatmap } from "./simulatedFqHeatmap";
import * as d3 from "d3";

export const AvgDistanceHeatmap = ({ chromosomeData, chromosome3DAvgMatrixData, selectedChromosomeSequence, chromosomefqData }) => {
    const containerRef = useRef(null);
    const svgContainerRef = useRef(null);
    const canvasRef = useRef(null);
    const [svgDimensions, setSvgDimensions] = useState({ width: 600, height: 650 });
    const [colorScaleRange, setColorScaleRange] = useState([0, 0]);
    const [dataMin, setDataMin] = useState(0);
    const [dataMax, setDataMax] = useState(0);

    useEffect(() => {
        const container = svgContainerRef.current;
        if (!container) return;
        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                setSvgDimensions({ width, height });
            }
        });
        resizeObserver.observe(container);
        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        if (!chromosome3DAvgMatrixData.length) return;
        const allValues = chromosome3DAvgMatrixData.flat();
        const min = d3.min(allValues);
        const max = d3.max(allValues);
        setDataMin(min);
        setDataMax(max);
        setColorScaleRange([min, max * 0.8]);
    }, [chromosome3DAvgMatrixData]);

    const changeColorByInput = (type) => (value) => {
        let newRange = [...colorScaleRange];
        if (type === "min") {
            newRange[0] = Math.min(value, colorScaleRange[1]);
            newRange[0] = Math.max(newRange[0], dataMin);
        } else if (type === "max") {
            newRange[1] = Math.max(value, colorScaleRange[0]);
            newRange[1] = Math.min(newRange[1], dataMax);
        }
        setColorScaleRange(newRange);
    };

    const changeColorScale = (value) => {
        setColorScaleRange(value);
    };

    useEffect(() => {
        if (!chromosome3DAvgMatrixData.length) return;

        const { start, end } = selectedChromosomeSequence;
        const margin = { top: 10, right: 10, bottom: 40, left: 100 };
        const svgWidth = svgDimensions.width;
        const svgHeight = svgDimensions.height;

        const numRows = chromosome3DAvgMatrixData.length;
        const numCols = chromosome3DAvgMatrixData[0].length;

        const availableWidth = svgWidth - margin.left - margin.right;
        const availableHeight = svgHeight - margin.top - margin.bottom;
        const cellSize = Math.min(availableWidth / numCols, availableHeight / numRows);
        const heatmapWidth = numCols * cellSize;
        const heatmapHeight = numRows * cellSize;

        const allValues = chromosome3DAvgMatrixData.flat();
        const dataMinLocal = d3.min(allValues);
        const dataMaxLocal = d3.max(allValues);
        const dataMid = (dataMinLocal + dataMaxLocal) / 2;

        let tickCount;
        const step = 5000;
        const adjustedStart = Math.floor(start / step) * step;
        const adjustedEnd = Math.ceil(end / step) * step;
        const axisValues = Array.from(
            { length: Math.floor((adjustedEnd - adjustedStart) / step) + 1 },
            (_, i) => adjustedStart + i * step
        );
        const range = end - start;
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

        const colorScale = d3
            .scaleSequential(t => d3.interpolateReds(1 - t))
            .domain([colorScaleRange[0], colorScaleRange[1]]);

        const svg = d3.select("#distance-heatmap-svg");

        svg.attr("width", heatmapWidth + margin.left + margin.right).attr("height", svgHeight);
        svg.selectAll("*").remove();

        const g = svg
            .append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`);

        const legendWidth = 20;
        const legendMargin = 50;

        const defs = svg.append("defs");
        const gradient = defs.append("linearGradient")
            .attr("id", "legend-gradient")
            .attr("x1", "0%")
            .attr("y1", "100%")
            .attr("x2", "0%")
            .attr("y2", "0%");

        gradient
            .selectAll("stop")
            .data([
                { offset: "0%", color: colorScale(dataMinLocal) },
                { offset: "50%", color: colorScale(dataMid) },
                { offset: "100%", color: colorScale(dataMaxLocal) }
            ])
            .enter()
            .append("stop")
            .attr("offset", d => d.offset)
            .attr("stop-color", d => d.color);

        const xScale = d3.scaleBand()
            .domain(axisValues)
            .range([0, heatmapWidth])
            .padding(0.01);

        const yScale = d3.scaleBand()
            .domain(axisValues)
            .range([0, heatmapHeight])
            .padding(0.01);

        // Canvas绘制逻辑
        const canvas = canvasRef.current;
        if (canvas) {
            const dpr = window.devicePixelRatio || 1;
            canvas.width = heatmapWidth * dpr;
            canvas.height = heatmapHeight * dpr;
            canvas.style.width = `${heatmapWidth}px`;
            canvas.style.height = `${heatmapHeight}px`;
            canvas.style.position = 'absolute';
            canvas.style.left = `${margin.left}px`;
            canvas.style.top = `${margin.top}px`;

            const ctx = canvas.getContext('2d');
            ctx.scale(dpr, dpr);
            ctx.clearRect(0, 0, heatmapWidth, heatmapHeight);

            for (let i = 0; i < numRows; i++) {
                for (let j = 0; j < numCols; j++) {
                    const value = chromosome3DAvgMatrixData[i][j];
                    const x = j * cellSize;
                    const y = (numRows - 1 - i) * cellSize;
                    ctx.fillStyle = colorScale(value);
                    ctx.fillRect(x, y, cellSize, cellSize);
                }
            }
        }

        const xAxis = d3.axisBottom(xScale)
            .tickValues(filteredTicks)
            .tickFormat(tickFormats);

        g.append("g")
            .attr("transform", `translate(0, ${heatmapHeight})`)
            .call(xAxis)
            .selectAll("text")
            .style("text-anchor", "end")
            .attr("transform", "rotate(-45)");

        const yAxis = d3.axisLeft(yScale)
            .tickValues(filteredTicks)
            .tickFormat(tickFormats);

        g.append("g").call(yAxis);

        const legendX = margin.left - legendWidth - legendMargin;
        const legendY = margin.top;

        svg.append("rect")
            .attr("x", legendX)
            .attr("y", legendY)
            .attr("width", legendWidth)
            .attr("height", heatmapHeight)
            .style("fill", "url(#legend-gradient)");

        const legendScale = d3.scaleLinear()
            .domain([colorScaleRange[0], colorScaleRange[1]])
            .range([heatmapHeight, 0]);

        const legendAxis = d3.axisLeft(legendScale)
            .ticks(5);

        svg.append("g")
            .attr("transform", `translate(${legendX}, ${legendY})`)
            .call(legendAxis);

        svg.append("text")
            .attr("x", (margin.left + heatmapWidth) / 2)
            .attr("y", svgHeight - 40)
            .attr("text-anchor", "middle")
            .style("font-size", "14px");

        svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -svgHeight / 2)
            .attr("y", 30)
            .attr("text-anchor", "middle")
            .style("font-size", "14px");

    }, [chromosome3DAvgMatrixData, svgDimensions, colorScaleRange]);

    return (
        <div
            ref={containerRef}
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                justifyContent: "center"
            }}
        >
            <div style={{ display: "flex", width: "100%", justifyContent: "space-between" }}>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: 'center', alignItems: 'center', width: '50%', height: '100%' }}>
                    <div style={{ fontWeight: 'bold' }}>Average Distance Heatmap</div>
                    <div
                        ref={svgContainerRef}
                        style={{ display: "flex", alignItems: "center", overflow: "hidden", height: '100%', position: 'relative' }}
                    >
                        <svg
                            id="distance-heatmap-svg"
                        ></svg>
                        <canvas ref={canvasRef} />
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
                </div>
                <SimulatedFqHeatmap
                    chromosomeData={chromosomeData}
                    chromosomefqData={chromosomefqData}
                    selectedChromosomeSequence={selectedChromosomeSequence}
                />
            </div>
        </div>
    );
};