import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';

export const CurrentChainDistanceHeatmap = ({ chromosomeCurrentSampleDistanceVector }) => {
    const containerRef = useRef(null);
    const svgRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    const uniqueGradientId = useMemo(() => `legend-gradient-current-distance-${Math.random().toString(36).substr(2, 9)}`, []);
    useEffect(() => {
        const resizeObserver = new ResizeObserver(entries => {
            if (entries[0]) {
                const { width } = entries[0].contentRect;
                const legendHeight = 30;
                const size = Math.max(width, 100);
                setDimensions({
                    width: size,
                    height: size + legendHeight
                });
            }
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        if (!dimensions.width || !chromosomeCurrentSampleDistanceVector) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const flattened = chromosomeCurrentSampleDistanceVector.flat();
        const maxValue = d3.max(flattened) || 1;
        const minValue = d3.min(flattened) || 0;

        const size = dimensions.width;

        const [numRows, numCols] = [
            chromosomeCurrentSampleDistanceVector.length,
            chromosomeCurrentSampleDistanceVector[0].length
        ];
        const maxDim = Math.max(numRows, numCols);
        const cellSize = size / maxDim;

        const heatmap = svg.append("g")
            .attr("transform", `translate(
                ${(size - cellSize * numCols) / 2}, 
                ${(size - cellSize * numRows) / 2}
            )`);

        const xScale = d3.scaleBand()
            .domain(d3.range(numCols).map(String))
            .range([0, cellSize * numCols])
            .padding(0.05);

        const yScale = d3.scaleBand()
            .domain(d3.range(numRows).map(String))
            .range([cellSize * numRows, 0])
            .padding(0.05);

        const colorScale = d3.scaleSequential(t => d3.interpolateReds(1 - t))
            .domain([minValue, maxValue * 0.4]);

        heatmap.selectAll()
            .data(chromosomeCurrentSampleDistanceVector)
            .enter().selectAll("rect")
            .data((row, i) => row.map((value, j) => ({ value, i, j })))
            .enter().append("rect")
            .attr("x", d => xScale(String(d.j)))
            .attr("y", d => yScale(String(d.i)))
            .attr("width", xScale.bandwidth())
            .attr("height", yScale.bandwidth())
            .attr("fill", d => colorScale(d.value));

        const legend = svg.append("g")
            .attr("transform", `translate(0, ${size + 5})`);

        const gradient = legend.append("defs")
            .append("linearGradient")
            .attr("id", uniqueGradientId)
            .attr("x1", "0%").attr("x2", "100%");

        gradient.selectAll("stop")
            .data([
                { offset: "0%", color: colorScale(minValue) },
                { offset: "100%", color: colorScale(maxValue) }
            ]).enter().append("stop")
            .attr("offset", d => d.offset)
            .attr("stop-color", d => d.color);

        legend.append("rect")
            .attr("width", size)
            .attr("height", 10)
            .style("fill", `url(#${uniqueGradientId})`);

        legend.append("text")
            .attr("y", 20)
            .attr("fill", "white") 
            .style("font-size", "10px")
            .text(minValue.toFixed(2));

        legend.append("text")
            .attr("x", size)
            .attr("y", 20)
            .attr("fill", "white") 
            .style("text-anchor", "end")
            .style("font-size", "10px")
            .text(maxValue.toFixed(2));

    }, [chromosomeCurrentSampleDistanceVector, dimensions]);

    return (
        <div ref={containerRef} style={{ width: '100%', height: 'auto' }}>
            <svg
                ref={svgRef}
                width={dimensions.width}
                height={dimensions.height}
            />
        </div>
    );
};