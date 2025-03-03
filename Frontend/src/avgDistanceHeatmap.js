import React, { useEffect, useState, useRef } from "react";
import { InputNumber, Slider } from "antd";
import * as d3 from "d3";

export const AvgDistanceHeatmap = ({ chromosome3DAvgMatrixData }) => {
    const containerRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 600, height: 650 });
    const [colorScaleRange, setColorScaleRange] = useState([0, 0]);
    const [dataMin, setDataMin] = useState(0);
    const [dataMax, setDataMax] = useState(0);

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

        const allValues = chromosome3DAvgMatrixData.flat();
        const min = d3.min(allValues);
        const max = d3.max(allValues);
        setDataMin(min);
        setDataMax(max);
        setColorScaleRange([min, max]);
    }, [chromosome3DAvgMatrixData]);

    useEffect(() => {
        if (!chromosome3DAvgMatrixData.length) return;

        const svgWidth = dimensions.width;
        const svgHeight = dimensions.height;
        const margin = { top: 40, right: 40, bottom: 100, left: 60 };

        const numRows = chromosome3DAvgMatrixData.length;
        const numCols = chromosome3DAvgMatrixData[0].length;
        const cellWidth = (svgWidth - margin.left - margin.right) / numCols;
        const cellHeight = (svgHeight - margin.top - margin.bottom) / numRows;

        const allValues = chromosome3DAvgMatrixData.flat();
        const dataMin = d3.min(allValues);
        const dataMax = d3.max(allValues);
        const dataMid = (dataMin + dataMax) / 2;

        const colorScale = d3
            .scaleSequential(t => d3.interpolateReds(1 - t))
            .domain([colorScaleRange[0], (colorScaleRange[0] + colorScaleRange[1]) / 2, colorScaleRange[1]]);

        const svg = d3.select("#distance-heatmap-svg");
        svg.selectAll("*").remove();

        const g = svg
            .append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`);

        const defs = svg.append("defs");
        const gradient = defs.append("linearGradient")
            .attr("id", "legend-gradient")
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "0%");

        gradient
            .selectAll("stop")
            .data([
                { offset: "0%", color: colorScale(dataMin) },
                { offset: "50%", color: colorScale(dataMid) },
                { offset: "100%", color: colorScale(dataMax) }
            ])
            .enter()
            .append("stop")
            .attr("offset", d => d.offset)
            .attr("stop-color", d => d.color);

        const xScale = d3.scaleBand()
            .domain(d3.range(numCols))
            .range([0, numCols * cellWidth])
            .padding(0.01);

        const yScale = d3.scaleBand()
            .domain(d3.range(numRows).reverse())
            .range([0, numRows * cellHeight])
            .padding(0.01);

        g.selectAll("rect")
            .data(allValues)
            .enter()
            .append("rect")
            .attr("x", (d, i) => (i % numCols) * cellWidth)
            .attr("y", (d, i) => (numRows - 1 - Math.floor(i / numCols)) * cellHeight)
            .attr("width", cellWidth)
            .attr("height", cellHeight)
            .attr("fill", d => colorScale(d));

        // axis
        const xAxis = d3.axisBottom(xScale)
            .tickValues(xScale.domain().filter((d, i) => i % Math.ceil(numCols / 10) === 0))
            .tickFormat(d => `${d + 1}`);

        g.append("g")
            .attr("transform", `translate(0, ${numRows * cellHeight})`)
            .call(xAxis)
            .selectAll("text")
            .style("text-anchor", "middle");

        const yAxis = d3.axisLeft(yScale)
            .tickValues(yScale.domain().filter((d, i) => i % Math.ceil(numRows / 10) === 0))
            .tickFormat(d => `${d + 1}`);
        g.append("g").call(yAxis);

        const legendWidth = numCols * cellWidth;
        const legendY = margin.top + numRows * cellHeight + 30;

        svg.append("rect")
            .attr("x", margin.left)
            .attr("y", legendY)
            .attr("width", legendWidth)
            .attr("height", 20)
            .style("fill", "url(#legend-gradient)");

        // legend scale
        const legendScale = d3.scaleLinear()
            .domain([colorScaleRange[0], colorScaleRange[1]])
            .range([0, legendWidth]);

        const legendAxis = d3.axisBottom(legendScale)
            .ticks(5);

        svg.append("g")
            .attr("transform", `translate(${margin.left}, ${legendY + 20})`)
            .call(legendAxis);

        svg.append("text")
            .attr("x", svgWidth / 2)
            .attr("y", svgHeight - 40)
            .attr("text-anchor", "middle")
            .style("font-size", "14px")

        svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -svgHeight / 2)
            .attr("y", 30)
            .attr("text-anchor", "middle")
            .style("font-size", "14px")

    }, [chromosome3DAvgMatrixData, dimensions, colorScaleRange]);

    return (
        <div ref={containerRef} style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center" }}>
            <svg
                id="distance-heatmap-svg"
                width={dimensions.width}
                height={dimensions.height}
            ></svg>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                    alignItems: 'center',
                    justifyContent: 'center',
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
    );
};