import React, { useState, useEffect, useRef } from 'react';
import { InputNumber, Slider } from 'antd';
import * as d3 from 'd3';

export const SimulatedFqHeatmap = ({
    chromosomeData,
    chromosomefqData,
    selectedChromosomeSequence
}) => {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const svgLegendRef = useRef(null);
    const axisRef = useRef(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });
    const [simulatedColorScaleRange, setSimulatedColorScaleRange] = useState([0, 0.3]);
    const [simulatedDataMin, setSimulatedDataMin] = useState(0);
    const [simulatedDataMax, setSimulatedDataMax] = useState(0);
    const [layout, setLayout] = useState(null);

    const changeSimulatedColorByInput = (type) => (value) => {
        setSimulatedColorScaleRange((current) => {
            let newRange = [...current];
            if (type === "min") {
                newRange[0] = Math.max(Math.min(value, current[1]), simulatedDataMin);
            } else if (type === "max") {
                newRange[1] = Math.min(Math.max(value, current[0]), simulatedDataMax);
            }
            return newRange;
        });
    };

    const changeSimulatedColorScale = (value) => {
        setSimulatedColorScaleRange(value);
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
        const allData = [
            ...(chromosomefqData?.flat() || []),
            ...(chromosomeData?.map(d => d.fq) || [])
        ];
        if (allData.length === 0) return;

        const newMin = d3.min(allData);
        const newMax = d3.max(allData);
        setSimulatedDataMin(newMin);
        setSimulatedDataMax(newMax);
        setSimulatedColorScaleRange(prevRange => {
            if (prevRange[0] < newMin || prevRange[1] > newMax) {
                return [newMin, newMax];
            }
            return prevRange;
        });
    }, [chromosomefqData, chromosomeData]);

    useEffect(() => {
        if (!containerSize.width || !containerSize.height || !selectedChromosomeSequence) return;

        const margin = { top: 30, right: 0, bottom: 35, left: 120 };
        const legendWidth = 20;

        const { start, end } = selectedChromosomeSequence;
        const step = 5000;
        const adjustedStart = Math.floor(start / step) * step;
        const adjustedEnd = Math.ceil(end / step) * step;
        const axisValues = Array.from(
            { length: Math.floor((adjustedEnd - adjustedStart) / step) + 1 },
            (_, i) => adjustedStart + i * step
        );

        const availableWidth = containerSize.width - margin.left - margin.right - legendWidth;
        const availableHeight = containerSize.height - margin.top - margin.bottom;
        const maxSize = Math.min(availableWidth, availableHeight);
        const numCells = axisValues.length;
        const cellSize = maxSize / numCells;
        const heatmapSize = cellSize * numCells;

        setSvgSize({
            width: margin.left + heatmapSize + margin.right + legendWidth,
            height: margin.top + heatmapSize + margin.bottom
        });

        setLayout({
            margin,
            legendWidth,
            heatmapSize,
            cellSize,
            numCells,
            axisValues,
            step,
            adjustedStart,
        });
    }, [containerSize, selectedChromosomeSequence]);

    useEffect(() => {
        if (!layout || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const {
            margin,
            heatmapSize,
            cellSize,
            axisValues,
            step,
            adjustedStart,
        } = layout;

        const colorScale = d3.scaleSequential(d3.interpolateReds)
            .domain(simulatedColorScaleRange);

        let tickCount;
        const { start, end } = selectedChromosomeSequence;
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
        if (chromosomefqData) {
            ctx.save();
            ctx.translate(margin.left, margin.top);
            for (let i = 0; i < chromosomefqData.length; i++) {
                for (let j = 0; j <= i; j++) {
                    const value = chromosomefqData[i][j];
                    ctx.fillStyle = colorScale(value);
                    ctx.fillRect(
                        j * cellSize,
                        (chromosomefqData.length - i - 1) * cellSize,
                        cellSize,
                        cellSize
                    );
                }
            }
            ctx.restore();
        }

        if (chromosomeData) {
            ctx.save();
            ctx.translate(margin.left, margin.top);
            chromosomeData.forEach(d => {
                const i = Math.floor((d.ibp - adjustedStart) / step);
                const j = Math.floor((d.jbp - adjustedStart) / step);
                if (i < j && i >= 0 && j < axisValues.length) {
                    ctx.fillStyle = colorScale(d.fq);
                    ctx.fillRect(
                        j * cellSize,
                        (axisValues.length - i - 1) * cellSize,
                        cellSize,
                        cellSize
                    );
                }
            });
            ctx.restore();
        }

        const axisContainer = d3.select(axisRef.current);
        axisContainer.selectAll("*").remove();

        const xScale = d3.scaleBand()
            .domain(axisValues)
            .range([0, heatmapSize]);

        const xAxis = d3.axisBottom(xScale)
            .tickValues(filteredTicks)
            .tickFormat(tickFormats);

        axisContainer.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(${margin.left},${margin.top + heatmapSize})`)
            .call(xAxis)
            .selectAll("text")
            .style("text-anchor", "end")
            .attr("transform", "rotate(-45)");

        const yScale = d3.scaleBand()
            .domain([...axisValues].reverse())
            .range([0, heatmapSize]);

        const yAxis = d3.axisLeft(yScale)
            .tickValues(filteredTicks)
            .tickFormat(tickFormats);

        axisContainer.append("g")
            .attr("class", "y-axis")
            .attr("transform", `translate(${margin.left},${margin.top})`)
            .call(yAxis);
    }, [layout, chromosomefqData, chromosomeData, simulatedColorScaleRange]);

    useEffect(() => {
        if (!layout || !svgLegendRef.current) return;

        const svg = d3.select(svgLegendRef.current);
        svg.selectAll("*").remove();

        const { legendWidth, heatmapSize, margin } = layout;

        const gradient = svg.append("defs")
            .append("linearGradient")
            .attr("id", "legend-gradient")
            .attr("x1", "0%")
            .attr("x2", "0%")
            .attr("y1", "0%")
            .attr("y2", "100%");

        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d3.interpolateReds(simulatedColorScaleRange[0]));

        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", d3.interpolateReds(simulatedColorScaleRange[1]));

        svg.attr("transform", `translate(${-margin.left - margin.right - legendWidth - 60}, ${-margin.top + 10})`);
        svg.append("rect")
            .attr("x", legendWidth + 20)
            .attr("y", margin.top)
            .attr("width", legendWidth)
            .attr("height", heatmapSize)
            .attr("fill", "url(#legend-gradient)");

        const yScale = d3.scaleLinear()
            .domain([simulatedColorScaleRange[1], simulatedColorScaleRange[0]])
            .range([heatmapSize, 0]); 

        const yAxis = d3.axisLeft(yScale)
            .ticks(5)
            .tickSizeOuter(0);

        svg.append("g")
            .attr("transform", `translate(${legendWidth + 20}, ${margin.top})`)
            .call(yAxis);

    }, [layout, simulatedColorScaleRange]);

    return (
        <div ref={containerRef} style={{ width: '50%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
            <div style={{ fontWeight: 'bold'}}>Simulated fq Heatmap</div>
            <canvas
                ref={canvasRef}
                width={svgSize.width}
                height={svgSize.height}
                style={{ position: 'absolute', right: 80, top: 0 }}
            />
            <svg
                ref={axisRef}
                style={{
                    position: 'absolute',
                    right: 80,
                    top: 0,
                    width: svgSize.width,
                    height: svgSize.height,
                    pointerEvents: 'none'
                }}
            />
            <svg
                ref={svgLegendRef}
                style={{
                    width: layout?.legendWidth + 50,
                    height: svgSize.height
                }}
            />
            <div style={{
                position: 'absolute',
                right: 20,
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8
            }}>
                <InputNumber
                    size="small"
                    controls={false}
                    value={simulatedColorScaleRange[1]}
                    onChange={changeSimulatedColorByInput('max')}
                    step={0.1}
                    style={{ width: 60 }}
                />
                <Slider
                    vertical
                    range={{ draggableTrack: true }}
                    min={simulatedDataMin}
                    max={simulatedDataMax}
                    value={simulatedColorScaleRange}
                    onChange={changeSimulatedColorScale}
                    step={0.1}
                    style={{ height: 200 }}
                />
                <InputNumber
                    size="small"
                    controls={false}
                    value={simulatedColorScaleRange[0]}
                    onChange={changeSimulatedColorByInput('min')}
                    step={0.1}
                    style={{ width: 60 }}
                />
            </div>
        </div>
    );
};