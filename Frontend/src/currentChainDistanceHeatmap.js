import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';

export const CurrentChainDistanceHeatmap = ({ 
    chromosomeCurrentSampleDistanceVector, 
    onHeatmapHover = () => {},
    hoveredHeatmapCoord = null 
}) => {
    const containerRef = useRef(null);
    const svgRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const rectsRef = useRef(null);
    const colorScaleRef = useRef(null);

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

    // Build heatmap once per data/size change
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
        colorScaleRef.current = colorScale;

        const dataFlat = chromosomeCurrentSampleDistanceVector.flatMap((row, i) => row.map((value, j) => ({ value, i, j })));

        const rects = heatmap.selectAll("rect")
            .data(dataFlat)
            .enter().append("rect")
            .attr("x", d => xScale(String(d.j)))
            .attr("y", d => yScale(String(d.i)))
            .attr("width", xScale.bandwidth())
            .attr("height", yScale.bandwidth())
            .attr("fill", d => colorScale(d.value))
            .style("cursor", "pointer");

        // Add invisible overlay for better mouse detection
        const overlay = heatmap.append("rect")
            .attr("width", cellSize * numCols)
            .attr("height", cellSize * numRows)
            .attr("fill", "transparent")
            .style("cursor", "pointer");

        let currentHoveredCell = null;

        // Mouse move handler for the entire heatmap area
        const handleMouseMove = function(event) {
            const [mouseX, mouseY] = d3.pointer(event, this);
            
            // Calculate which cell the mouse is over
            const col = Math.floor(mouseX / cellSize);
            const row = Math.floor((cellSize * numRows - mouseY) / cellSize);
            
            // Check bounds
            if (col >= 0 && col < numCols && row >= 0 && row < numRows) {
                // Limit hover interaction to around the diagonal
                // Only allow hover if the distance from diagonal is within a reasonable range
                const diagonalDistance = Math.abs(row - col);
                const maxDiagonalDistance = Math.min(numRows, numCols) * 0.05;
                
                if (diagonalDistance <= maxDiagonalDistance) {
                    const newCell = { row, col };
                    
                    // Only trigger if we've moved to a different cell
                    if (!currentHoveredCell || currentHoveredCell.row !== row || currentHoveredCell.col !== col) {
                        currentHoveredCell = newCell;
                        onHeatmapHover(row, col);
                    }
                } else {
                    // Allow hovering anywhere on the heatmap, not just near diagonal
                    const newCell = { row, col };
                    
                    // Only trigger if we've moved to a different cell
                    if (!currentHoveredCell || currentHoveredCell.row !== row || currentHoveredCell.col !== col) {
                        currentHoveredCell = newCell;
                        onHeatmapHover(row, col);
                    }
                }
            }
        };

        const handleMouseLeave = function() {
            currentHoveredCell = null;
            onHeatmapHover(null, null);
        };

        // Attach events to the overlay
        overlay
            .on("mousemove", handleMouseMove)
            .on("mouseleave", handleMouseLeave);

        rectsRef.current = rects;

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

    // Lightweight highlight update without rebuilding SVG
    useEffect(() => {
        if (!rectsRef.current || !colorScaleRef.current) return;
        const colorScale = colorScaleRef.current;
        rectsRef.current
            .attr("fill", d => {
                const isExactMatch = hoveredHeatmapCoord && (hoveredHeatmapCoord.row === d.i && hoveredHeatmapCoord.col === d.j);
                const isRowOrColMatch = hoveredHeatmapCoord && (hoveredHeatmapCoord.row === d.i || hoveredHeatmapCoord.col === d.j);
                
                if (isExactMatch) {
                    return '#E25822'; // Orange for the exact hovered cell
                } else if (isRowOrColMatch) {
                    return '#FFB366'; // Lighter orange for related cells (same row or column)
                } else {
                    return colorScale(d.value);
                }
            })
            .attr("stroke", d => {
                const isExactMatch = hoveredHeatmapCoord && (hoveredHeatmapCoord.row === d.i && hoveredHeatmapCoord.col === d.j);
                const isRowOrColMatch = hoveredHeatmapCoord && (hoveredHeatmapCoord.row === d.i || hoveredHeatmapCoord.col === d.j);
                
                if (isExactMatch) {
                    return '#FFF';
                } else if (isRowOrColMatch) {
                    return '#333';
                } else {
                    return 'none';
                }
            })
            .attr("stroke-width", d => {
                const isExactMatch = hoveredHeatmapCoord && (hoveredHeatmapCoord.row === d.i && hoveredHeatmapCoord.col === d.j);
                const isRowOrColMatch = hoveredHeatmapCoord && (hoveredHeatmapCoord.row === d.i || hoveredHeatmapCoord.col === d.j);
                
                if (isExactMatch) {
                    return 3;
                } else if (isRowOrColMatch) {
                    return 1;
                } else {
                    return 0;
                }
            });
    }, [hoveredHeatmapCoord]);

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