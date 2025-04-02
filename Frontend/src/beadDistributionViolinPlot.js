import React, { useRef, useEffect, useState } from 'react';
import { Spin, Empty } from 'antd';
import * as d3 from 'd3';

export const BeadDistributionViolinPlot = ({ distributionData, selectedSphereList, loading, cellLineDict }) => {
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
        if (
            !dimensions.width ||
            !dimensions.height ||
            Object.keys(selectedSphereList).length < 2 ||
            Object.keys(distributionData).length === 0 ||
            loading
        )
            return;

        d3.select(svgRef.current).selectAll("*").remove();

        const svg = d3.select(svgRef.current)
            .attr("width", dimensions.width)
            .attr("height", dimensions.height);

        const margin = { top: 20, right: 20, bottom: 25, left: 45 },
            width = dimensions.width - margin.left - margin.right,
            height = dimensions.height - margin.top - margin.bottom;

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // distributionData’s keys
        const distKeys = Object.keys(distributionData);
        if (distKeys.length === 0) return;
        const categories = Object.keys(distributionData[distKeys[0]]);

        const xScale = d3.scaleBand()
            .domain(categories)
            .range([0, width])
            .padding(0.2);

        const colorScale = d3.scaleOrdinal()
            .domain(distKeys)
            .range(d3.schemeCategory10);

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
                const dataArray = distributionData[key][category] || [];
                if (!Array.isArray(dataArray) || dataArray.length === 0) return;
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
        const numKeys = distKeys.length;
        const segmentWidth = violinWidth / numKeys;
        const halfWidthScale = d3.scaleLinear()
            .domain([0, maxDensity])
            .range([0, segmentWidth / 2]);

        g.append("clipPath")
            .attr("id", "clip")
            .append("rect")
            .attr("width", violinWidth)
            .attr("height", height);

        // calculate beadPairs‘ pairKey and distance
        const beadPairs = [];
        const beadKeys = Object.keys(selectedSphereList);
        for (let i = 0; i < beadKeys.length; i++) {
            for (let j = i + 1; j < beadKeys.length; j++) {
                const key1 = beadKeys[i];
                const key2 = beadKeys[j];

                // generate pairKey like "6-36", take the smaller and larger combination
                const minKey = Math.min(Number(key1), Number(key2));
                const maxKey = Math.max(Number(key1), Number(key2));
                const pairKey = `${minKey}-${maxKey}`;
                const bead1 = selectedSphereList[key1];
                const bead2 = selectedSphereList[key2];

                const cellLine = bead1.cell_line || (bead1.position && bead1.position.cell_line);

                const distance = Math.sqrt(
                    Math.pow(bead2.position.x - bead1.position.x, 2) +
                    Math.pow(bead2.position.y - bead1.position.y, 2) +
                    Math.pow(bead2.position.z - bead1.position.z, 2)
                );
                beadPairs.push({ pairKey, distance, cellLine });
            }
        }

        categories.forEach(category => {
            const categoryGroup = g.append("g")
                .attr("transform", `translate(${xScale(category)},0)`)
                .attr("clip-path", "url(#clip)");

            distKeys.forEach((key, keyIndex) => {
                const density = densitiesByCategory[category][key];
                if (!density) return;

                const center = keyIndex * segmentWidth + segmentWidth / 2;

                const area = d3.area()
                    .curve(d3.curveCatmullRom)
                    .x0(d => (center - halfWidthScale(d[1])))
                    .x1(d => (center + halfWidthScale(d[1])))
                    .y(d => yScale(d[0]));

                categoryGroup.append("path")
                    .datum(density)
                    .attr("fill", colorScale(key))
                    .attr("stroke", "none")
                    .attr("opacity", 0.7)
                    .attr("d", area);

                // find matching beadPairs(pairKey === category && cellLine === key)
                const matchingBeadPairs = beadPairs.filter(bp => bp.pairKey === category && bp.cellLine === key);
                matchingBeadPairs.forEach(bp => {
                    const densityData = densitiesByCategory[category][key];
                    if (densityData) {
                        const bisect = d3.bisector(d => d[0]).left;
                        const i = bisect(densityData, bp.distance);
                        let markerDensity;
                        if (i === 0) {
                            markerDensity = densityData[0][1];
                        } else if (i >= densityData.length) {
                            markerDensity = densityData[densityData.length - 1][1];
                        } else {
                            const d0 = densityData[i - 1];
                            const d1 = densityData[i];
                            const t = (bp.distance - d0[0]) / (d1[0] - d0[0]);
                            markerDensity = d0[1] + t * (d1[1] - d0[1]);
                        }
                        const markerLineHalfLength = halfWidthScale(markerDensity);

                        const x1 = center - markerLineHalfLength;
                        const x2 = center + markerLineHalfLength;
                        const yPos = yScale(bp.distance);
                        categoryGroup.append("line")
                            .attr("x1", x1)
                            .attr("x2", x2)
                            .attr("y1", yPos)
                            .attr("y2", yPos)
                            .attr("stroke", "purple")
                            .attr("stroke-width", 2);
                    }
                });
            });
        });

        const yAxis = d3.axisLeft(yScale).ticks(5);
        g.append("g").call(yAxis);

        const xAxis = d3.axisBottom(xScale);
        g.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(xAxis);

        const legend = svg.append("g")
            .attr("transform", `translate(${width - margin.right}, ${margin.top})`);

        distKeys.forEach((key, index) => {
            const legendRow = legend.append("g")
                .attr("transform", `translate(0, ${index * 20})`);

            legendRow.append("rect")
                .attr("width", 15)
                .attr("height", 15)
                .attr("fill", colorScale(key));

            legendRow.append("text")
                .attr("x", 20)
                .attr("y", 12)
                .attr("font-size", "12px")
                .text(cellLineDict[key]);
        });

    }, [dimensions, distributionData, selectedSphereList, loading]);

    return (
        <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
            {Object.keys(selectedSphereList).length > 1 ? (
                loading ? (
                    <Spin spinning={true} style={{ width: '100%', height: '100%' }} />
                ) : (
                    <svg ref={svgRef}></svg>
                )
            ) : (
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No beads found"
                    style={{ width: '100%', height: '100%' }}
                />
            )}
        </div>
    );
};
