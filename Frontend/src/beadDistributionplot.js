import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export const BeadDistributionPlot = ({
    distributionData,
    selectedSphereList,
    margin = { top: 20, right: 30, bottom: 30, left: 40 }
}) => {
    const containerRef = useRef(null);
    const svgRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 750, height: 400 });

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                setDimensions({ width, height });
            }
        });
        resizeObserver.observe(container);
        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    useEffect(() => {
        d3.select(svgRef.current).selectAll('*').remove();

        const { width, height } = dimensions;
        const svg = d3.select(svgRef.current)
            .attr('width', width)
            .attr('height', height);

        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;
        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const allValues = Object.values(distributionData).flat();
        const globalExtent = d3.extent(allValues);

        console.log(globalExtent, '?????');
        const binGenerator = d3.histogram()
            .domain(globalExtent)
            .thresholds(30);

        const binnedData = {};
        Object.keys(distributionData).forEach(key => {
            const sortedArr = distributionData[key].slice().sort((a, b) => a - b);
            const bins = binGenerator(sortedArr);
            binnedData[key] = bins;
        });

        const xScale = d3.scaleLinear()
            .domain(globalExtent)
            .range([0, plotWidth]);

        const maxCount = d3.max(Object.values(binnedData).flat(), bin => bin.length);
        const yScale = d3.scaleLinear()
            .domain([0, maxCount])
            .range([plotHeight, 0]);

        const xAxis = d3.axisBottom(xScale);
        const yAxis = d3.axisLeft(yScale);
        g.append('g')
            .attr('transform', `translate(0,${plotHeight})`)
            .call(xAxis);
        g.append('g')
            .call(yAxis);

        const keys = Object.keys(distributionData);
        const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(keys);

        const lineGenerator = d3.line()
            .x(bin => xScale((bin.x0 + bin.x1) / 2))
            .y(bin => yScale(bin.length))
            .curve(d3.curveMonotoneX);

        const areaGenerator = d3.area()
            .x(bin => xScale((bin.x0 + bin.x1) / 2))
            .y0(plotHeight)
            .y1(bin => yScale(bin.length))
            .curve(d3.curveMonotoneX);

        keys.forEach(key => {
            const bins = binnedData[key];

            g.append('path')
                .datum(bins)
                .attr('fill', colorScale(key))
                .attr('fill-opacity', 0.3)
                .attr('d', areaGenerator);

            g.append('path')
                .datum(bins)
                .attr('fill', 'none')
                .attr('stroke', colorScale(key))
                .attr('stroke-width', 2)
                .attr('d', lineGenerator);
        });

        keys.forEach(key => {
            const parts = key.split('-');
            if (parts.length === 2) {
                const [sphereA, sphereB] = parts;
                if (selectedSphereList[sphereA] && selectedSphereList[sphereB]) {
                    const posA = selectedSphereList[sphereA].position;
                    const posB = selectedSphereList[sphereB].position;
                    const normA = {
                        x: posA.x / 0.15,
                        y: posA.y / 0.15,
                        z: posA.z / 0.15
                    };
                    const normB = {
                        x: posB.x / 0.15,
                        y: posB.y / 0.15,
                        z: posB.z / 0.15
                    };

                    const distance = Math.sqrt(
                        Math.pow(normA.x - normB.x, 2) +
                        Math.pow(normA.y - normB.y, 2) +
                        Math.pow(normA.z - normB.z, 2)
                    );
                    console.log(distance);
                    g.append('line')
                        .attr('x1', xScale(distance))
                        .attr('x2', xScale(distance))
                        .attr('y1', 0)
                        .attr('y2', plotHeight)
                        .attr('stroke', colorScale(key))
                        .attr('stroke-dasharray', '4,4')
                        .attr('stroke-width', 2);
                }
            }
        });
    }, [distributionData, selectedSphereList, dimensions, margin]);

    return (
        <div ref={containerRef} style={{ width: '100%', height: '400px' }}>
            <svg ref={svgRef}></svg>
        </div>
    );
};
