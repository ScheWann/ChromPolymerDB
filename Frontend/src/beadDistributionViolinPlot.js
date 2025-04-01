import React, { useRef, useEffect, useState } from 'react';
import { Spin, Empty } from 'antd';
import * as d3 from 'd3';

export const BeadDistributionViolinPlot = ({ distributionData, selectedSphereList, loading }) => {
    const containerRef = useRef();
    const svgRef = useRef();
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.contentRect) {
                    setDimensions({
                        width: entry.contentRect.width,
                        height: entry.contentRect.height,
                    });
                }
            }
        });
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }
        return () => {
            if (containerRef.current) observer.unobserve(containerRef.current);
        };
    }, []);

    useEffect(() => {
        if (!dimensions.width || !dimensions.height) return;

        d3.select(svgRef.current).selectAll("*").remove();

        const svg = d3.select(svgRef.current)
            .attr("width", dimensions.width)
            .attr("height", dimensions.height);

        const margin = { top: 20, right: 30, bottom: 30, left: 50 },
            width = dimensions.width - margin.left - margin.right,
            height = dimensions.height - margin.top - margin.bottom;

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const distKeys = Object.keys(distributionData);
        if (distKeys.length === 0) return;
        const categories = Object.keys(distributionData[distKeys[0]]);

        const xScale = d3.scaleBand()
            .domain(categories)
            .range([0, width])
            .padding(0.2);

        function kernelDensityEstimator(kernel, X) {
            return function (V) {
                return X.map(x => [x, d3.mean(V, v => kernel(x - v))]);
            };
        }
        function kernelEpanechnikov(k) {
            return function (v) {
                v = v / k;
                return Math.abs(v) <= 1 ? 0.75 * (1 - v * v) / k : 0;
            };
        }

        let maxDensity = 0;
        const densitiesByCategory = {};
        let globalDensityMin = Infinity;
        let globalDensityMax = -Infinity;

        categories.forEach(category => {
            densitiesByCategory[category] = {};
            distKeys.forEach(key => {
                const dataArray = distributionData[key][category];
                const localMin = d3.min(dataArray);
                const localMax = d3.max(dataArray);
                const xTicks = d3.scaleLinear().domain([localMin, localMax]).nice().ticks(40);
                const kde = kernelDensityEstimator(kernelEpanechnikov(7), xTicks);
                const density = kde(dataArray);
                densitiesByCategory[category][key] = density;
                const localMaxDensity = d3.max(density, d => d[1]);
                if (localMaxDensity > maxDensity) maxDensity = localMaxDensity;
                const densityXMin = d3.min(density, d => d[0]);
                const densityXMax = d3.max(density, d => d[0]);
                if (densityXMin < globalDensityMin) globalDensityMin = densityXMin;
                if (densityXMax > globalDensityMax) globalDensityMax = densityXMax;
            });
        });

        const yScale = d3.scaleLinear()
            .domain([globalDensityMin, globalDensityMax])
            .range([height, 0])
            .nice();

        const violinWidth = xScale.bandwidth();
        const xDensityScale = d3.scaleLinear()
            .domain([0, maxDensity])
            .range([0, violinWidth / 2]);

        g.append("clipPath")
            .attr("id", "clip")
            .append("rect")
            .attr("width", violinWidth)
            .attr("height", height);

        categories.forEach(category => {
            const categoryGroup = g.append("g")
                .attr("transform", `translate(${xScale(category)},0)`)
                .attr("clip-path", "url(#clip)");

            distKeys.forEach((key, index) => {
                const density = densitiesByCategory[category][key];
                const area = d3.area()
                    .curve(d3.curveCatmullRom)
                    .x0(d => {
                        return index === 0
                            ? violinWidth / 2 - xDensityScale(d[1])
                            : violinWidth / 2;
                    })
                    .x1(d => {
                        return index === 0
                            ? violinWidth / 2
                            : violinWidth / 2 + xDensityScale(d[1]);
                    })
                    .y(d => yScale(d[0]));

                const sphereKeys = Object.keys(selectedSphereList);
                const fillColor = sphereKeys[index]
                    ? selectedSphereList[sphereKeys[index]].color
                    : "#ccc";

                categoryGroup.append("path")
                    .datum(density)
                    .attr("fill", fillColor)
                    .attr("stroke", "none")
                    .attr("d", area);
            });
        });

        const yAxis = d3.axisLeft(yScale).ticks(5);
        g.append("g").call(yAxis);

        const xAxis = d3.axisBottom(xScale);
        g.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(xAxis);

    }, [dimensions, distributionData, selectedSphereList]);

    return (
        <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
            <svg ref={svgRef}></svg>
        </div>
    );
};
