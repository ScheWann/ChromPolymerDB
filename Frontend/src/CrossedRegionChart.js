import * as d3 from 'd3';
import React, { useEffect, useRef } from 'react';

export const CrossedRegionChart = ({ seq }) => {
    const ref = useRef();

    useEffect(() => {
        if (!seq) return;

        const width = 500;
        const rowSpacing = 8;
        const rectHeight = 4;
        const margin = { top: 10, right: 40, bottom: 20, left: 20 };
        const totalHeight = seq.crossed_regions.length * rowSpacing + margin.top + margin.bottom;
        const axisY = totalHeight - margin.bottom;

        const svg = d3.select(ref.current);
        svg.selectAll('*').remove();

        const x = d3.scaleLinear()
            .domain([seq.start, seq.end])
            .range([margin.left, width - margin.right]);

        svg.attr('width', width).attr('height', totalHeight);

        // x axis
        svg.append('g')
            .attr('transform', `translate(0, ${axisY})`)
            .call(d3.axisBottom(x).ticks(3));

        seq.crossed_regions.forEach((region, i) => {
            const clippedStart = Math.max(region.start, seq.start);
            const clippedEnd = Math.min(region.end, seq.end);

            if (clippedStart >= clippedEnd) return;

            svg.append('rect')
                .attr('x', x(clippedStart))
                .attr('y', axisY - (i + 1) * rowSpacing)
                .attr('width', Math.max(1, x(clippedEnd) - x(clippedStart)))
                .attr('height', rectHeight)
                .attr('fill', '#377eb8')
                .append('title')
                .text(`Start: ${region.start}, End: ${region.end}`);
        });
    }, [seq]);

    return <svg ref={ref}></svg>;
};
