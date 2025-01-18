import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export const GeneList = ({ cellLineName, chromosomeName, geneList, currentChromosomeSequence, minDimension, geneName, setGeneName, setGeneSize }) => {
    const svgRef = useRef();
    const containerRef = useRef();
    const [scrollEnabled, setScrollEnabled] = useState(false);
    const tooltipRef = useRef();
    const initialHeightRef = useRef(null);

    const fetchChromosomeSizeByGeneName = (value) => {
        fetch("/getChromosSizeByGeneName", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ gene_name: value })
        })
            .then(res => res.json())
            .then(data => {
                const displayStart = Math.max(data.start_location, currentChromosomeSequence.start);
                const displayEnd = Math.min(data.end_location, currentChromosomeSequence.end);
                setGeneSize({ start: displayStart, end: displayEnd });
            })
    }

    async function fetchepigeneticTrackData() {
        if (cellLineName && chromosomeName && currentChromosomeSequence) {
            const response = await fetch("/getepigeneticTrackData", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    cell_line: cellLineName,
                    chromosome_name: chromosomeName,
                    sequences: currentChromosomeSequence
                })
            });
            if (response.ok) {
                return await response.json();
            } else {
                console.error('Failed to fetch epigenetic track data');
                return null;
            }
        }
        return null;
    }


    useEffect(() => {
        async function fetchDataAndRender() {
            const epigeneticTrackData = await fetchepigeneticTrackData();

            if (!epigeneticTrackData) {
                console.warn("Epigenetic track data is null or undefined");
                return;
            }

            const margin = { top: 20, right: 10, bottom: 0, left: 60 };

            let width = containerRef.current.offsetWidth;
            // let width = minDimension;
            let height = containerRef.current.offsetHeight;

            const svg = d3.select(svgRef.current);
            svg.selectAll("*").remove();

            const { start, end } = currentChromosomeSequence;
            const step = 5000;
            const adjustedStart = Math.floor(start / step) * step;
            const adjustedEnd = Math.ceil(end / step) * step;

            const axisValues = Array.from(
                { length: Math.floor((adjustedEnd - adjustedStart) / step) + 1 },
                (_, i) => adjustedStart + i * step
            );

            // Map genes to the range of currentChromosomeSequence
            const genesToRender = geneList
                .filter((gene) =>
                    gene.start_location <= end && gene.end_location >= start
                )
                .map((gene) => ({
                    ...gene,
                    displayStart: Math.max(gene.start_location, start),
                    displayEnd: Math.min(gene.end_location, end),
                }));

            const xAxisScale = d3.scaleBand()
                .domain(axisValues)
                .range([margin.left, minDimension - margin.right])
                .padding(0.1);

            const xScaleLinear = d3.scaleLinear()
                .domain([adjustedStart, adjustedEnd])
                .range([margin.left, minDimension - margin.right]);

            // Calculate height based on the number of layers
            const layerHeight = 20;

            // Calculate gene ranges and prevent overlap
            const layers = [];
            genesToRender.forEach((gene) => {
                let placed = false;
                for (const layer of layers) {
                    if (
                        !layer.some(
                            (g) => g.displayStart < gene.displayEnd && g.displayEnd > gene.displayStart
                        )
                    ) {
                        layer.push(gene);
                        placed = true;
                        break;
                    }
                }
                if (!placed) layers.push([gene]);
            });

            // Store the initial height once
            if (initialHeightRef.current === null) {
                initialHeightRef.current = height;
            }

            const geneListHeight = (layers.length - 1) * layerHeight + (layerHeight - 4) + margin.top;
            const epigeneticTrackHeight = Object.keys(epigeneticTrackData).length * (layerHeight + 10) + (Object.keys(epigeneticTrackData).length - 1) * 4;
            // Check if scrolling is needed based on total height
            const totalHeight = geneListHeight + epigeneticTrackHeight + 20;

            if (totalHeight > initialHeightRef.current) {
                setScrollEnabled(true);
                height = totalHeight;
            } else {
                setScrollEnabled(false);
            }

            // Calculate the range of the current chromosome sequence
            const range = currentChromosomeSequence.end - currentChromosomeSequence.start;

            // Dynamically determine the tick count based on the range
            let tickCount;
            if (range < 1000000) {
                tickCount = Math.max(Math.floor(range / 20000), 5);
            } else if (range >= 1000000 && range <= 10000000) {
                tickCount = Math.max(Math.floor(range / 50000), 5);
            } else {
                tickCount = 30;
            }

            tickCount = Math.min(tickCount, 30);

            // Add x-axis tick lines
            const axis = d3.axisBottom(xAxisScale)
                .tickValues(axisValues.filter((_, i) => i % tickCount === 0))
                .tickFormat(() => "")
                .tickSize(-height);

            svg.attr("width", width).attr("height", height);

            svg.append('g')
                .attr('transform', `translate(${(width - minDimension) / 2}, ${height})`)
                .call(axis)
                .selectAll("line")
                .attr("stroke", "#DCDCDC");

            svg.selectAll('.domain').attr('stroke', '#DCDCDC');

            // Gene sequences
            layers.forEach((layer, layerIndex) => {
                svg
                    .selectAll(`.gene-layer-${layerIndex}`)
                    .data(layer)
                    .enter()
                    .append("rect")
                    .attr('transform', `translate(${(width - minDimension) / 2}, 0)`)
                    .attr("x", (d) => xScaleLinear(d.displayStart))
                    .attr("y", margin.top + layerIndex * layerHeight)
                    .attr("width", (d) => xScaleLinear(d.displayEnd) - xScaleLinear(d.displayStart))
                    .attr("height", layerHeight - 4)
                    .attr("fill", (d) => (d.symbol === geneName ? "#ff5733" : "#69b3a2"))
                    .attr("stroke", "#333")
                    .attr("stroke-width", 0.2)
                    .style("transition", "all 0.3s ease")
                    .on("click", (event, d) => {
                        setGeneName(d.symbol);
                        fetchChromosomeSizeByGeneName(d.symbol);
                    })
                    .on("mouseover", (event, d) => {
                        d3.select(event.target).style("stroke-width", 1);

                        const tooltip = d3.select(tooltipRef.current);
                        tooltip.style("opacity", 0.8)
                            .style("visibility", "visible")
                            .html(`
                                <strong>Gene Symbol:</strong> ${d.symbol || d.gene_name}<br>
                                <strong>Chromosome:</strong> Chr ${d.chromosome}<br>
                                <strong>Start:</strong> ${d.displayStart}<br>
                                <strong>End:</strong> ${d.displayEnd}
                            `)
                            .style("left", `${event.pageX + 10}px`)
                            .style("top", `${event.pageY - 20}px`);
                    })
                    .on("mouseout", (event) => {
                        d3.select(event.target).style("stroke-width", 0.2);
                        const tooltip = d3.select(tooltipRef.current);
                        tooltip.style("opacity", 0).style("visibility", "hidden");
                    });
            });

            // Epigenetic tracks
            Object.keys(epigeneticTrackData).forEach((key, keyIndex) => {
                const maxValue = Math.max(...epigeneticTrackData[key].map(obj => obj.signal_value));

                // get the range of the current histogram
                const startRange = xScaleLinear(currentChromosomeSequence.start);
                const endRange = xScaleLinear(currentChromosomeSequence.end);

                let previousEndX = startRange;

                const yScale = d3.scaleLinear().domain([0, maxValue]).range([layerHeight - 1, 0]);

                const yAxis = d3.axisLeft(yScale).tickValues([0, maxValue]).tickFormat(d3.format(".1f"));

                svg.append("g")
                    .attr("transform", `translate(${startRange + (width - minDimension) / 2}, ${margin.top + 20 + geneListHeight + 4 + keyIndex * (layerHeight + 10) - layerHeight})`)
                    .call(yAxis)
                    .call(g => g.selectAll(".domain")
                        .style("stroke", "#999")
                        .style("stroke-width", "1px")
                    )
                    .call(g => g.selectAll("line").remove())
                    .call(g => g.selectAll("text")
                        .attr("x", -8)
                        .style("font-size", "8px")
                        .style("fill", "#333")
                        .style('text-anchor', 'end')
                    );

                svg.append("text")
                    .attr("x", (width - minDimension) / 2 + 5)
                    .attr("y", margin.top + 20 + geneListHeight + 4 + keyIndex * (layerHeight + 10) - layerHeight + 15)
                    .attr("text-anchor", "middle")
                    .style("font-size", "10px")
                    .text(epigeneticTrackData[key][0].epigenetic)
                    .style("fill", "black");

                epigeneticTrackData[key].forEach((track, trackIndex) => {
                    const { start_value, end_value, peak, signal_value } = track;

                    const startX = xScaleLinear(start_value);
                    const endX = xScaleLinear(end_value);
                    const peakX = xScaleLinear(start_value + peak);

                    const clampedStartX = Math.max(startX, startRange);
                    const clampedEndX = Math.min(endX, endRange);

                    const signalScale = d3.scaleLinear().domain([0, maxValue]).range([0.5, layerHeight - 4]);
                    const yPos = margin.top + 20 + geneListHeight + 4 + keyIndex * (layerHeight + 10);

                    if (clampedStartX > previousEndX) {
                        svg.append("rect")
                            .attr('transform', `translate(${(width - minDimension) / 2}, 0)`)
                            .attr("x", previousEndX)
                            .attr("y", yPos - signalScale(0))
                            .attr("width", clampedStartX - previousEndX)
                            .attr("height", signalScale(0))
                            .attr("fill", "#333");
                    }

                    svg.append("rect")
                        .attr('transform', `translate(${(width - minDimension) / 2}, 0)`)
                        .attr("x", clampedStartX)
                        .attr("y", yPos - signalScale(signal_value))
                        .attr("width", clampedEndX - clampedStartX)
                        .attr("height", signalScale(signal_value))
                        .attr("fill", "#FF6347");

                    previousEndX = clampedEndX;
                });

                // if the previous end is less than the end of the range, draw the remaining missing area
                if (previousEndX < endRange) {
                    const missingSignalHeight = 0.5;
                    svg.append("rect")
                        .attr('transform', `translate(${(width - minDimension) / 2}, 0)`)
                        .attr("x", previousEndX)
                        .attr("y", margin.top + 20 + geneListHeight + 4 + keyIndex * (layerHeight + 10) - 0.5)
                        .attr("width", endRange - previousEndX)
                        .attr("height", missingSignalHeight)
                        .attr("fill", "#333");
                }
            });

            svg.append("text")
                .attr("x", width - minDimension - margin.right - 20)
                .attr("y", geneListHeight / 2)
                .attr("text-anchor", "middle")
                .style("font-size", "12px")
                .text("Gene List")
                .style("fill", "black");
        }

        fetchDataAndRender();
    }, [geneList, currentChromosomeSequence, geneName]);

    return (
        <div
            ref={containerRef}
            style={{
                width: "100%",
                height: "28%",
                borderRight: "1px solid #eaeaea",
                borderTop: "1px solid #eaeaea",
                boxSizing: "border-box",
                overflowY: scrollEnabled ? "auto" : "hidden",
                overflowX: "hidden",
            }}
        >
            <svg ref={svgRef}></svg>
            <div
                ref={tooltipRef}
                style={{
                    position: "absolute",
                    background: "white",
                    padding: "5px 12px",
                    border: "1px solid #d9d9d9",
                    borderRadius: 5,
                    opacity: 0,
                    fontSize: "12px",
                    padding: "5px",
                    borderRadius: "4px",
                    pointerEvents: "none",
                    visibility: "hidden",
                    zIndex: 10,
                    textAlign: "left",
                    transition: "opacity 0.4s ease, visibility 0.4s linear 0.4s",
                }}
            ></div>
        </div>
    );
};
