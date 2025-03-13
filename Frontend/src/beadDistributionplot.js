import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export const BeadDistributionPlot = ({
    distributionData,
    selectedSphereList,
    margin = { top: 20, right: 30, bottom: 30, left: 40 }
}) => {
    const containerRef = useRef(null);
    const svgRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 750, height: 450 });

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

            const areaPath = g.append('path')
                .datum(bins)
                .attr('data-key', key)
                .attr('fill', colorScale(key))
                .attr('fill-opacity', 0.3)
                .attr('d', areaGenerator)
                .style('cursor', 'pointer')
                .on('mouseover', function (event) {
                    const hoveredKey = d3.select(this).attr('data-key');
                    svg.selectAll('[data-key]')
                        .transition().duration(200)    
                        .attr('opacity', 0.1);
                    svg.selectAll(`[data-key="${hoveredKey}"]`)
                        .transition().duration(200)    
                        .attr('opacity', 1);

                    legend.selectAll('rect, text')
                        .attr('opacity', d => d === hoveredKey ? 1 : 0.1);
                })
                .on('mouseout', function () {
                    svg.selectAll('[data-key]')
                        .transition().duration(200)
                        .attr('opacity', 1);
                    legend.selectAll('rect, text').attr('opacity', 1);
                });

            const linePath = g.append('path')
                .datum(bins)
                .attr('data-key', key)
                .attr('fill', 'none')
                .attr('stroke', colorScale(key))
                .attr('stroke-width', 2)
                .attr('d', lineGenerator)
                .style('cursor', 'pointer')
                .on('mouseover', areaPath.on('mouseover'))
                .on('mouseout', areaPath.on('mouseout'));
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
                        .attr('data-key', key)
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

        const legend = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${height - margin.bottom + margin.top})`);

        const legendItemSize = 10;
        const legendSpacing = 4;
        const legendOffset = 20;

        keys.forEach((key, i) => {
            const legendRow = legend.append('g')
                .attr('transform', `translate(${i * legendOffset * 5}, 0)`)
                .attr('data-key', key)
                .on('mouseover', function () {
                    d3.selectAll('[data-key]')
                        .transition().duration(200)      
                        .attr('opacity', 0.1);
                    d3.selectAll(`[data-key='${key}']`)
                        .transition().duration(200)  
                        .attr('opacity', 1);
                })
                .on('mouseout', function () {
                    d3.selectAll('[data-key]')
                        .transition().duration(200)  
                        .attr('opacity', 1);
                });

            legendRow.append('rect')
                .attr('data-key', key)
                .attr('width', legendItemSize)
                .attr('height', legendItemSize)
                .attr('fill', colorScale(key));

            legendRow.append('text')
                .attr('data-key', key)
                .attr('x', legendItemSize + legendSpacing)
                .attr('y', legendItemSize)
                .attr('font-size', '12px')
                .attr('fill', '#000')
                .text(key);
        });
    }, [distributionData, selectedSphereList, dimensions, margin]);

    return (
        <div ref={containerRef} style={{ width: '100%', height: '450px' }}>
            <svg ref={svgRef}></svg>
        </div>
    );
};