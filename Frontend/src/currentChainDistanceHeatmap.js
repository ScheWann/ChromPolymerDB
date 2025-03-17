import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export const CurrentChainDistanceHeatmap = ({ chromosomeCurrentSampleDistanceVector }) => {
    const containerRef = useRef(null);
    const svgRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const resizeObserver = new ResizeObserver(entries => {
            if (entries[0]) {
                const { width, height } = entries[0].contentRect;
                setDimensions({ width, height });
            }
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        if (!dimensions.width || !dimensions.height || !chromosomeCurrentSampleDistanceVector.length) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const flattened = chromosomeCurrentSampleDistanceVector.flat();
        const maxValue = d3.max(flattened) || 1;
        const minValue = d3.min(flattened) || 0;

        const xScale = d3
            .scaleBand()
            .domain(d3.range(chromosomeCurrentSampleDistanceVector[0].length).map(String))
            .range([0, dimensions.width])
            .padding(0.05);

        const yScale = d3
            .scaleBand()
            .domain(d3.range(chromosomeCurrentSampleDistanceVector.length).map(String))
            .range([dimensions.height, 0])
            .padding(0.05);

        const colorScale = d3
            .scaleSequential(t => d3.interpolateReds(1 - t))
            .domain([minValue, maxValue]);

        svg
            .selectAll()
            .data(chromosomeCurrentSampleDistanceVector)
            .enter()
            .selectAll('rect')
            .data((d, i) => d.map((value, j) => ({ value, i, j })))
            .enter()
            .append('rect')
            .attr('x', d => xScale(String(d.j)) || 0)
            .attr('y', d => yScale(String(d.i)) || 0)
            .attr('width', xScale.bandwidth())
            .attr('height', yScale.bandwidth())
            .attr('fill', d => colorScale(d.value))
            .attr('rx', 2)
            .attr('ry', 2);

    }, [chromosomeCurrentSampleDistanceVector, dimensions]);

    return (
        <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
            <svg
                ref={svgRef}
                width={dimensions.width}
                height={dimensions.height}
            />
        </div>
    );
};