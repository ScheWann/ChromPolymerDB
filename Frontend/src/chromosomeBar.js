import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import "./Styles/chromosomeBar.css";

export const ChromosomeBar = ({ chromosomeSize, selectedChromosomeSequence, setSelectedChromosomeSequence, totalChromosomeSequences, startRef, endRef, formatNumber, totalOriginalChromosomeValidSequences, setStartInputValue, setEndInputValue }) => {
    const svgRef = useRef();
    const parentRef = useRef();
    // const [tooltip, setTooltip] = useState({ visible: false, minStart: 0, maxEnd: 0, left: 0, top: 0 });
    const [parentSize, setParentSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                setParentSize({ width, height });
            }
        });

        if (parentRef.current) {
            observer.observe(parentRef.current);
        }

        return () => {
            observer.disconnect();
        };
    }, []);

    useEffect(() => {
        if (!parentSize.width && !parentSize.height) return;

        if (selectedChromosomeSequence.start !== undefined && selectedChromosomeSequence.end !== undefined) {
            const min_start = chromosomeSize.start;
            const max_end = chromosomeSize.end;

            const seqs = totalChromosomeSequences;

            const margin = { top: 10, bottom: 20, left: 10, right: 10 };
            const width = parentSize.width - margin.left - margin.right;
            const height = 30;

            const xScale = d3.scaleLinear()
                .domain([min_start, max_end])
                .range([margin.left, width + margin.left]);

            const svg = d3.select(svgRef.current)
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom);

            svg.selectAll('*').remove();

            // Background rect
            const backgroundY = margin.top + height / 4;
            const backgroundHeight = height / 2;

            svg.append('rect')
                .attr('x', margin.left)
                .attr('y', backgroundY)
                .attr('width', width)
                .attr('height', backgroundHeight)
                .attr('stroke', '#999')
                .attr('stroke-width', 0.3)
                .attr('fill', '#F5F5F5');

            // Highlighted selection area
            svg.append('rect')
                .attr('x', xScale(selectedChromosomeSequence.start))
                .attr('y', backgroundY)
                .attr('width', xScale(selectedChromosomeSequence.end) - xScale(selectedChromosomeSequence.start))
                .attr('height', backgroundHeight)
                .attr('fill', '#FFE0B2');

            // Seqs rects
            seqs.forEach((seq) => {
                const seqStart = seq.start;
                const seqEnd = seq.end;
                const selectionStart = selectedChromosomeSequence.start;
                const selectionEnd = selectedChromosomeSequence.end;

                const overlapStart = Math.max(seqStart, selectionStart);
                const overlapEnd = Math.min(seqEnd, selectionEnd);

                svg.append('rect')
                    .attr('class', 'rect')
                    .attr('x', xScale(seq.start))
                    .attr('y', backgroundY)
                    .attr('width', xScale(seq.end) - xScale(seq.start))
                    .attr('height', backgroundHeight)
                    .attr('fill', '#4CAF50')
                    .style('cursor', 'pointer')
                    .style('opacity', 0.8)
                    .on('click', (event) => {
                        const mouseX = event.offsetX;
                        const clickedGenomicPos = xScale.invert(mouseX);

                        let nearest = null;
                        let minDistance = Infinity;

                        totalOriginalChromosomeValidSequences.forEach((range) => {
                            let distance = 0;
                            if (clickedGenomicPos < range.start) {
                                distance = range.start - clickedGenomicPos;
                            } else if (clickedGenomicPos > range.end) {
                                distance = clickedGenomicPos - range.end;
                            } else {
                                distance = 0;
                            }

                            if (distance < minDistance) {
                                minDistance = distance;
                                nearest = range;
                            }
                        });

                        startRef.current = nearest.start;
                        endRef.current = nearest.end;

                        setStartInputValue(nearest.start.toString());
                        setEndInputValue(nearest.end.toString());

                        setSelectedChromosomeSequence({
                            start: nearest.start,
                            end: nearest.end
                        });
                    })
                    .on('mouseover', (event) => {
                        d3.select(event.currentTarget)
                            .transition()
                            .duration(250)
                            .attr('stroke', '#333')
                            .attr('stroke-width', 2)
                            .style('opacity', 1);

                        const tooltipWidth = 150;
                        const tooltipX = event.pageX + 5;

                        const adjustedLeft = tooltipX + tooltipWidth > window.innerWidth
                            ? window.innerWidth - tooltipWidth - 10
                            : tooltipX;

                        // setTooltip({
                        //     visible: true,
                        //     minStart: seq.start,
                        //     maxEnd: seq.end,
                        //     left: adjustedLeft,
                        //     top: event.pageY - 50,
                        // });
                    })
                    .on('mouseout', (event) => {
                        d3.select(event.currentTarget)
                            .transition()
                            .duration(250)
                            .attr('stroke', 'none')
                            .attr('stroke-width', 0)
                            .style('opacity', 0.8);
                        // setTooltip((prev) => ({ ...prev, visible: false }));
                    });
                if (overlapStart < overlapEnd) {
                    const overlapX = xScale(overlapStart);
                    const overlapWidth = xScale(overlapEnd) - xScale(overlapStart);

                    svg.append('rect')
                        .attr('class', 'highlight-overlap')
                        .attr('x', overlapX)
                        .attr('y', backgroundY)
                        .attr('width', overlapWidth)
                        .attr('height', backgroundHeight)
                        .attr('fill', '#FFC107')
                        .attr('pointer-events', 'none')

                    svg.append('rect')
                        .attr('class', 'highlight-hover')
                        .attr('x', overlapX)
                        .attr('y', backgroundY)
                        .attr('width', overlapWidth)
                        .attr('height', backgroundHeight)
                        .attr('fill', 'transparent')
                        .style('cursor', 'pointer')
                        .on('mouseover', (event) => {
                            d3.select(event.currentTarget)
                                .transition()
                                .duration(250)
                                .attr('stroke', '#FFC107')
                                .attr('stroke-width', 3)
                                .style('opacity', 1);
                            const tooltipWidth = 150;
                            const tooltipX = event.pageX + 5;

                            const adjustedLeft = tooltipX + tooltipWidth > window.innerWidth
                                ? window.innerWidth - tooltipWidth - 10
                                : tooltipX;

                            // setTooltip({
                            //     visible: true,
                            //     minStart: overlapStart,
                            //     maxEnd: overlapEnd,
                            //     left: adjustedLeft,
                            //     top: event.pageY - 50,
                            //     type: 'overlap',
                            // });
                        })
                        .on('mouseout', (event) => {
                            d3.select(event.currentTarget)
                                .transition()
                                .duration(250)
                                .attr('stroke', 'none')
                                .attr('stroke-width', 0)
                                .style('opacity', 0.8);
                            // setTooltip((prev) => ({ ...prev, visible: false }));
                        });
                }
            });

            // Function to draw triangles and vertical lines
            const drawSelectionMarkers = () => {
                svg.selectAll('.triangle, .line-marker').remove();

                const triangleHeight = 10;
                const triangleY = backgroundY - triangleHeight;
                let newStart = selectedChromosomeSequence.start;
                let newEnd = selectedChromosomeSequence.end;

                // Start triangle and line
                svg.append('polygon')
                    .attr('class', 'triangle')
                    .attr('points', `${xScale(selectedChromosomeSequence.start)},${triangleY + triangleHeight} ${xScale(selectedChromosomeSequence.start) - 5},${triangleY} ${xScale(selectedChromosomeSequence.start) + 5},${triangleY}`)
                    .attr('fill', '#666')
                    .attr('stroke', '#666')
                    .attr('stroke-width', 1.5)
                    .style('z-index', 10)

                svg.append('line')
                    .attr('class', 'line-marker')
                    .attr('x1', xScale(selectedChromosomeSequence.start))
                    .attr('x2', xScale(selectedChromosomeSequence.start))
                    .attr('y1', backgroundY)
                    .attr('y2', backgroundY + backgroundHeight)
                    .attr('stroke', '#666')
                    .attr('stroke-width', 1.5);

                // End triangle and line
                svg.append('polygon')
                    .attr('class', 'triangle')
                    .attr('points', `${xScale(selectedChromosomeSequence.end)},${triangleY + triangleHeight} ${xScale(selectedChromosomeSequence.end) - 5},${triangleY} ${xScale(selectedChromosomeSequence.end) + 5},${triangleY}`)
                    .attr('fill', '#666')
                    .attr('stroke', '#666')
                    .attr('stroke-width', 1.5)
                    .style('z-index', 10)

                svg.append('line')
                    .attr('class', 'line-marker')
                    .attr('x1', xScale(selectedChromosomeSequence.end))
                    .attr('x2', xScale(selectedChromosomeSequence.end))
                    .attr('y1', backgroundY)
                    .attr('y2', backgroundY + backgroundHeight)
                    .attr('stroke', '#666')
                    .attr('stroke-width', 1.5);
            };

            drawSelectionMarkers();

            const xAxis = d3.axisBottom(xScale)
                .ticks(5)
                .tickFormat((d) => formatNumber(d));

            svg.append('g')
                .attr('class', 'x-axis')
                .attr('transform', `translate(0, ${height + margin.top})`)
                .call(xAxis);

            // Add labels above the bars for start and end
            svg.append('text')
                .attr('x', margin.left)
                .attr('y', margin.top)
                .attr('text-anchor', 'start')
                .attr('font-size', '12px')
                .attr('font-weight', 'bold')
                .attr('fill', '#333')
                .text(`${min_start}`);

            svg.append('text')
                .attr('x', width + margin.left)
                .attr('y', margin.top)
                .attr('text-anchor', 'end')
                .attr('font-size', '12px')
                .attr('font-weight', 'bold')
                .attr('fill', '#333')
                .text(`${formatNumber(max_end)}`);
        }
    }, [totalChromosomeSequences, selectedChromosomeSequence, chromosomeSize, parentSize, totalOriginalChromosomeValidSequences]);

    return (
        <div id="chromosome-bar" ref={parentRef} style={{ width: '100%', position: 'relative' }}>
            <svg ref={svgRef}></svg>
            {/* <div
                className={`tooltip ${tooltip.visible ? 'visible' : ''}`}
                style={{
                    left: tooltip.left,
                    top: tooltip.top,
                    zIndex: 20
                }}
            >
                <div className="chromosomeBarTooltipText"><strong>Start:</strong>{formatNumber(tooltip.minStart)}</div>
                <div className="chromosomeBarTooltipText"><strong>End:</strong>{formatNumber(tooltip.maxEnd)}</div>
            </div> */}
        </div>
    );
};