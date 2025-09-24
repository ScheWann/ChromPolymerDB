import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

import { calculateAxisValues, calculateTickValues, formatTickLabel } from './utils/axisUtils';

export const GeneList = ({ geneList, currentChromosomeSequence, minDimension, geneName, setGeneName, setGeneSize, step = 5000, isBintuMode = false, zoomedChromosomeData = [] }) => {
    const svgRef = useRef();
    const containerRef = useRef();
    const [scrollEnabled, setScrollEnabled] = useState(false);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const tooltipRef = useRef();
    const initialHeightRef = useRef(null);

    const fetchChromosomeSizeByGeneName = (value) => {
        fetch("/api/getChromosomeSizeByGeneName", {
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
                setGeneSize({ start: displayStart, end: displayEnd, orientation: data.orientation });
            })
    }

    // async function fetchepigeneticTrackData() {
    //     if (cellLineName && chromosomeName && currentChromosomeSequence) {
    //         const response = await fetch("/getepigeneticTrackData", {
    //             method: 'POST',
    //             headers: {
    //                 'Content-Type': 'application/json',
    //             },
    //             body: JSON.stringify({
    //                 cell_line: cellLineName,
    //                 chromosome_name: chromosomeName,
    //                 sequences: currentChromosomeSequence
    //             })
    //         });
    //         if (response.ok) {
    //             return await response.json();
    //         } else {
    //             console.error('Failed to fetch epigenetic track data');
    //             return null;
    //         }
    //     }
    //     return null;
    // }


    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                setContainerSize({ width, height });
            }
        });

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            observer.disconnect();
        };
    }, []);

    useEffect(() => {
        if (!containerSize.width && !containerSize.height) return;

        async function fetchDataAndRender() {
            // const epigeneticTrackData = await fetchepigeneticTrackData();

            // if (!epigeneticTrackData) {
            //     console.warn("Epigenetic track data is null or undefined");
            //     return;
            // }

            const margin = { top: 20, right: 20, bottom: 0, left: 60 };

            let width = containerSize.width;
            let height = containerSize.height;

            const svg = d3.select(svgRef.current);
            svg.selectAll("*").remove();

            // Use shared axis utilities for consistency with heatmap
            const axisValues = calculateAxisValues(currentChromosomeSequence, step, isBintuMode, zoomedChromosomeData);
            const { tickValues } = calculateTickValues(axisValues, minDimension, currentChromosomeSequence, isBintuMode);

            // Map genes to the range of currentChromosomeSequence
            const { start, end } = currentChromosomeSequence;
            const genesToRender = geneList
                .filter((gene) =>
                    gene.start_location <= end && gene.end_location >= start
                )
                .map((gene) => ({
                    ...gene,
                    displayStart: Math.max(gene.start_location, start),
                    displayEnd: Math.min(gene.end_location, end),
                }));

            const adjustedStart = Math.floor(start / step) * step;
            const adjustedEnd = Math.ceil(end / step) * step;

            const xAxisScale = d3.scaleBand()
                .domain(axisValues)
                .range([margin.left, minDimension - margin.right])
                .padding(0.1);

            const xScaleLinear = d3.scaleLinear()
                .domain([adjustedStart, adjustedEnd])
                .range([margin.left, minDimension - margin.right]);

            // Calculate height based on the number of layers
            const layerHeight = 35; // Increased to accommodate text below rectangles

            // Helper function to estimate text width more accurately
            const estimateTextWidth = (text, fontSize = 10) => {
                if (!text) return 0;
                // Create a temporary text element to measure actual width
                const tempText = svg.append("text")
                    .style("font-size", `${fontSize}px`)
                    .style("font-family", "Arial, sans-serif")
                    .style("visibility", "hidden")
                    .text(text);
                const textWidth = tempText.node().getBBox().width;
                tempText.remove();
                return textWidth + 4; // Add small padding
            };

            // Calculate gene ranges and prevent overlap (considering both rectangles and text)
            const layers = [];
            
            // First, calculate text bounds for all genes
            const genesWithTextBounds = genesToRender.map((gene) => {
                const geneText = gene.symbol || gene.gene_name || '';
                const textWidth = estimateTextWidth(geneText);
                const geneCenterPixels = xScaleLinear((gene.displayStart + gene.displayEnd) / 2);
                const textStart = geneCenterPixels - textWidth / 2;
                const textEnd = geneCenterPixels + textWidth / 2;
                
                return {
                    ...gene,
                    textStart,
                    textEnd,
                    textWidth,
                    geneCenterPixels
                };
            });

            // Sort genes by start position to process them in order
            genesWithTextBounds.sort((a, b) => a.displayStart - b.displayStart);

            genesWithTextBounds.forEach((gene) => {
                let placed = false;

                for (const layer of layers) {
                    const hasOverlap = layer.some((g) => {
                        // Check rectangle overlap in pixel space
                        const geneRectStart = xScaleLinear(gene.displayStart);
                        const geneRectEnd = xScaleLinear(gene.displayEnd);
                        const gRectStart = xScaleLinear(g.displayStart);
                        const gRectEnd = xScaleLinear(g.displayEnd);
                        const rectOverlap = geneRectStart < gRectEnd && geneRectEnd > gRectStart;
                        
                        // Check text overlap with minimum spacing buffer
                        const minSpacing = 8; // Minimum pixels between text labels
                        const textOverlap = (gene.textStart - minSpacing) < g.textEnd && (gene.textEnd + minSpacing) > g.textStart;
                        
                        // If either rectangles or text overlap, there's a conflict
                        return rectOverlap || textOverlap;
                    });

                    if (!hasOverlap) {
                        layer.push(gene);
                        placed = true;
                        break;
                    }
                }
                
                // If no existing layer can accommodate this gene, create a new layer
                if (!placed) {
                    layers.push([gene]);
                }
            });

            // Store the initial height once
            if (initialHeightRef.current === null) {
                initialHeightRef.current = height;
            }

            const geneListHeight = (layers.length - 1) * layerHeight + layerHeight + margin.top;
            // const epigeneticTrackHeight = Object.keys(epigeneticTrackData).length * (layerHeight + 10) + (Object.keys(epigeneticTrackData).length - 1) * 4;
            
            // Check if scrolling is needed based on total height
            // const totalHeight = geneListHeight + epigeneticTrackHeight + 20;
            const totalHeight = geneListHeight + 20;

            if (totalHeight > initialHeightRef.current) {
                setScrollEnabled(true);
                height = totalHeight;
            } else {
                setScrollEnabled(false);
            }

            // Calculate the range of the current chromosome sequence
            const range = currentChromosomeSequence.end - currentChromosomeSequence.start;

            // Add x-axis tick lines using shared tick values for consistency with heatmap
            const axis = d3.axisBottom(xAxisScale)
                .tickValues(tickValues)
                .tickFormat(() => "")
                .tickSize(-height);

            svg.attr("width", width).attr("height", height);

            svg.append('g')
                .attr('transform', `translate(${(width - minDimension) / 2}, ${height})`)
                .call(axis)
                .selectAll("line")
                .attr("stroke", "#DCDCDC");

            svg.selectAll('.domain').attr('stroke', '#DCDCDC');

            let clickTimeout = null;

            // Gene sequences
            layers.forEach((layer, layerIndex) => {
                // Draw gene rectangles
                svg
                    .selectAll(`.gene-rect-layer-${layerIndex}`)
                    .data(layer)
                    .enter()
                    .append("rect")
                    .attr('transform', `translate(${(width - minDimension) / 2}, 0)`)
                    .attr("x", (d) => xScaleLinear(d.displayStart))
                    .attr("y", margin.top + layerIndex * layerHeight)
                    .attr("width", (d) => xScaleLinear(d.displayEnd) - xScaleLinear(d.displayStart))
                    .attr("height", 16) // Fixed height for rectangles
                    .attr("fill", "#69b3a2")
                    .attr("stroke", "#333")
                    .attr("stroke-width", 0.2)
                    .style("transition", "all 0.3s ease")
                    .on("click", (event, d) => {
                        if (clickTimeout) clearTimeout(clickTimeout);

                        clickTimeout = setTimeout(() => {
                            setGeneName(d.symbol);
                            fetchChromosomeSizeByGeneName(d.symbol);
                            clickTimeout = null;
                        }, 100);
                    })
                    .on("dblclick", (event, d) => {
                        if (clickTimeout) {
                            clearTimeout(clickTimeout);
                            clickTimeout = null;
                        }
                        event.stopPropagation();
                        setGeneName(null);
                        setGeneSize({ start: null, end: null });
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
                            .style("top", `${event.pageY - 120}px`);
                    })
                    .on("mouseout", (event) => {
                        d3.select(event.target).style("stroke-width", 0.2);
                        const tooltip = d3.select(tooltipRef.current);
                        tooltip.style("opacity", 0).style("visibility", "hidden");
                    });

                // Draw gene labels below rectangles
                svg
                    .selectAll(`.gene-text-layer-${layerIndex}`)
                    .data(layer)
                    .enter()
                    .append("text")
                    .attr('transform', `translate(${(width - minDimension) / 2}, 0)`)
                    .attr("x", (d) => xScaleLinear((d.displayStart + d.displayEnd) / 2))
                    .attr("y", margin.top + layerIndex * layerHeight + 16 + 12) // Below rectangle + some spacing
                    .attr("text-anchor", "middle")
                    .style("font-size", "10px")
                    .style("font-family", "Arial, sans-serif")
                    .style("fill", (d) => (d.symbol === geneName ? "#ff5733" : "#333"))
                    .style("font-weight", (d) => (d.symbol === geneName ? "bold" : "normal"))
                    .style("cursor", "pointer")
                    .text((d) => d.symbol || d.gene_name || '')
                    .on("click", (event, d) => {
                        if (clickTimeout) clearTimeout(clickTimeout);

                        clickTimeout = setTimeout(() => {
                            setGeneName(d.symbol);
                            fetchChromosomeSizeByGeneName(d.symbol);
                            clickTimeout = null;
                        }, 100);
                    })
                    .on("dblclick", (event, d) => {
                        if (clickTimeout) {
                            clearTimeout(clickTimeout);
                            clickTimeout = null;
                        }
                        event.stopPropagation();
                        setGeneName(null);
                        setGeneSize({ start: null, end: null });
                    })
                    .on("mouseover", (event, d) => {
                        d3.select(event.target).style("font-weight", "bold");

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
                    .on("mouseout", (event, d) => {
                        d3.select(event.target).style("font-weight", (d.symbol === geneName ? "bold" : "normal"));
                        const tooltip = d3.select(tooltipRef.current);
                        tooltip.style("opacity", 0).style("visibility", "hidden");
                    });
            });

            // Epigenetic tracks
            // Object.keys(epigeneticTrackData).forEach((key, keyIndex) => {
            //     const maxValue = Math.max(...epigeneticTrackData[key].map(obj => obj.signal_value));

            //     // get the range of the current histogram
            //     const startRange = xScaleLinear(currentChromosomeSequence.start);
            //     const endRange = xScaleLinear(currentChromosomeSequence.end);

            //     let previousEndX = startRange;

            //     const yScale = d3.scaleLinear().domain([0, maxValue]).range([layerHeight - 1, 0]);

            //     const yAxis = d3.axisLeft(yScale).tickValues([0, maxValue]).tickFormat(d3.format(".1f"));

            //     svg.append("g")
            //         .attr("transform", `translate(${startRange + (width - minDimension) / 2}, ${margin.top + 20 + geneListHeight + 4 + keyIndex * (layerHeight + 10) - layerHeight})`)
            //         .call(yAxis)
            //         .call(g => g.selectAll(".domain")
            //             .style("stroke", "#999")
            //             .style("stroke-width", "1px")
            //         )
            //         .call(g => g.selectAll("line").remove())
            //         .call(g => g.selectAll("text")
            //             .attr("x", -8)
            //             .style("font-size", "8px")
            //             .style("fill", "#333")
            //             .style('text-anchor', 'end')
            //         );

            //     svg.append("text")
            //         .attr("x", (width - minDimension) / 2 + 5)
            //         .attr("y", margin.top + 20 + geneListHeight + 4 + keyIndex * (layerHeight + 10) - layerHeight + 15)
            //         .attr("text-anchor", "middle")
            //         .style("font-size", "10px")
            //         .text(epigeneticTrackData[key][0].epigenetic)
            //         .style("fill", "black");

            //     epigeneticTrackData[key].forEach((track, trackIndex) => {
            //         const { start_value, end_value, peak, signal_value } = track;

            //         const startX = xScaleLinear(start_value);
            //         const endX = xScaleLinear(end_value);
            //         const peakX = xScaleLinear(start_value + peak);

            //         const clampedStartX = Math.max(startX, startRange);
            //         const clampedEndX = Math.min(endX, endRange);

            //         const signalScale = d3.scaleLinear().domain([0, maxValue]).range([0.5, layerHeight - 4]);
            //         const yPos = margin.top + 20 + geneListHeight + 4 + keyIndex * (layerHeight + 10);

            //         if (clampedStartX > previousEndX) {
            //             svg.append("rect")
            //                 .attr('transform', `translate(${(width - minDimension) / 2}, 0)`)
            //                 .attr("x", previousEndX)
            //                 .attr("y", yPos - signalScale(0))
            //                 .attr("width", clampedStartX - previousEndX)
            //                 .attr("height", signalScale(0))
            //                 .attr("fill", "#333");
            //         }

            //         svg.append("rect")
            //             .attr('transform', `translate(${(width - minDimension) / 2}, 0)`)
            //             .attr("x", clampedStartX)
            //             .attr("y", yPos - signalScale(signal_value))
            //             .attr("width", clampedEndX - clampedStartX)
            //             .attr("height", signalScale(signal_value))
            //             .attr("fill", "#FF6347");

            //         previousEndX = clampedEndX;
            //     });

            //     // if the previous end is less than the end of the range, draw the remaining missing area
            //     if (previousEndX < endRange) {
            //         const missingSignalHeight = 0.5;
            //         svg.append("rect")
            //             .attr('transform', `translate(${(width - minDimension) / 2}, 0)`)
            //             .attr("x", previousEndX)
            //             .attr("y", margin.top + 20 + geneListHeight + 4 + keyIndex * (layerHeight + 10) - 0.5)
            //             .attr("width", endRange - previousEndX)
            //             .attr("height", missingSignalHeight)
            //             .attr("fill", "#333");
            //     }
            // });

            // svg.append("text")
            //     .attr("x", (width - minDimension) / 2 + 5)
            //     .attr("y", geneListHeight / 2)
            //     .attr("text-anchor", "middle")
            //     .style("font-size", "12px")
            //     .style("font-weight", "bold")
            //     .text("Gene List")
            //     .style("fill", "black");
        }

        fetchDataAndRender();
    }, [geneList, currentChromosomeSequence, geneName, containerSize, step, isBintuMode, zoomedChromosomeData]);

    return (
        <div
            ref={containerRef}
            style={{
                width: "100%",
                height: "28%",
                borderRight: "1px solid #eaeaea",
                borderTop: "1px solid #eaeaea",
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
