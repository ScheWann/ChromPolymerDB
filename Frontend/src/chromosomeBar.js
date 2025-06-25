import React, { useEffect, useRef, useState } from 'react';
import { CrossedRegionChart } from "./CrossedRegionChart";
import * as d3 from 'd3';
import "./Styles/chromosomeBar.css";

export const ChromosomeBar = ({ chromosomeSize, selectedChromosomeSequence, setSelectedChromosomeSequence, totalChromosomeSequences, warning, formatNumber }) => {
    const svgRef = useRef();
    const parentRef = useRef();
    const [tooltip, setTooltip] = useState({ visible: false, minStart: 0, maxEnd: 0, left: 0, top: 0 });
    const [parentSize, setParentSize] = useState({ width: 0, height: 0 });
    const [seqPopoverVisible, setSeqPopoverVisible] = useState(false);
    const [currentCrossedSeq, setCurrentCrossedSeq] = useState(null);
    const [popoverStyle, setPopoverStyle] = useState({ left: 0, top: 0 });

    const popoverRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                seqPopoverVisible &&
                popoverRef.current &&
                !popoverRef.current.contains(event.target)
            ) {
                setSeqPopoverVisible(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [seqPopoverVisible]);

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
                svg.append('rect')
                    .attr('class', 'rect')
                    .attr('x', xScale(seq.start))
                    .attr('y', backgroundY)
                    .attr('width', xScale(seq.end) - xScale(seq.start))
                    .attr('height', backgroundHeight)
                    .attr('fill', selectedChromosomeSequence.start < seq.end && selectedChromosomeSequence.end > seq.start ? '#FFC107' : (seq.is_cross ? '#377eb8' : '#4daf4a'))
                    .style('cursor', 'pointer')
                    .style('opacity', 0.8)
                    .on('click', () => {
                        if (seq.end - seq.start > 4000000) {
                            warning('overrange');
                        }
                        setSelectedChromosomeSequence({
                            start: seq.start,
                            end: seq.end
                        });
                    })
                    .on('mouseover', (event) => {
                        if (seq.is_cross) {
                            const popoverWidth = 500;
                            const padding = 10;

                            let left = event.pageX - 15;
                            const maxLeft = window.innerWidth - popoverWidth - padding;

                            if (left > maxLeft) left = maxLeft;
                            if (left < padding) left = padding;

                            setCurrentCrossedSeq(seq);
                            setPopoverStyle({
                                left,
                                top: event.pageY - 45
                            });
                            setSeqPopoverVisible(true);
                        } else {
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

                            setTooltip({
                                visible: true,
                                minStart: seq.start,
                                maxEnd: seq.end,
                                left: adjustedLeft,
                                top: event.pageY - 45
                            });
                        }
                    })
                    .on('mouseout', (event) => {
                        if (seq.is_cross) {
                            setSeqPopoverVisible(false);
                        } else {
                            d3.select(event.currentTarget)
                                .transition()
                                .duration(250)
                                .attr('stroke', 'none')
                                .attr('stroke-width', 0)
                                .style('opacity', 0.8);
                            setTooltip((prev) => ({ ...prev, visible: false }));
                        }
                    });
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
                    .style('cursor', 'pointer')
                    .call(d3.drag()
                        .on('start', () => {
                            if (totalChromosomeSequences.length === 0) {
                                warning('noData');
                                return;
                            }
                        })
                        .on('drag', (event) => {
                            const mouseX = d3.pointer(event)[0];
                            const rawValue = xScale.invert(mouseX);
                            const steppedValue = Math.round(rawValue / 5000) * 5000;
                            newStart = Math.min(
                                Math.max(steppedValue, min_start),
                                selectedChromosomeSequence.end
                            );

                            setSelectedChromosomeSequence((prev) => ({ ...prev, start: newStart }));
                        })
                        .on('end', () => {
                            // Check the warning condition when drag ends
                            if (newEnd - newStart > 4000000) {
                                warning('overrange');
                            }
                        }));

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
                    .style('cursor', 'pointer')
                    .call(d3.drag()
                        .on('start', () => {
                            if (totalChromosomeSequences.length === 0) {
                                warning('noData');
                                return;
                            }
                        })
                        .on('drag', (event) => {
                            const mouseX = d3.pointer(event)[0];
                            const rawValue = xScale.invert(mouseX);
                            const steppedValue = Math.round(rawValue / 5000) * 5000;
                            newEnd = Math.max(
                                Math.min(steppedValue, max_end),
                                selectedChromosomeSequence.start
                            );

                            setSelectedChromosomeSequence((prev) => ({ ...prev, end: newEnd }));
                        })
                        .on('end', () => {
                            if (newEnd - newStart > 4000000) {
                                warning('overrange');
                            }
                        }));

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
    }, [totalChromosomeSequences, selectedChromosomeSequence, chromosomeSize, parentSize]);

    return (
        <div id="chromosome-bar" ref={parentRef} style={{ width: '100%', position: 'relative' }}>
            <svg ref={svgRef}></svg>
            <div
                className={`tooltip ${tooltip.visible ? 'visible' : ''}`}
                style={{
                    left: tooltip.left,
                    top: tooltip.top,
                    zIndex: 20
                }}
            >
                <div className="chromosomeBarTooltipText">Start: {formatNumber(tooltip.minStart)}</div>
                <div className="chromosomeBarTooltipText">End: {formatNumber(tooltip.maxEnd)}</div>
            </div>
            {seqPopoverVisible && currentCrossedSeq && (
                <div
                    ref={popoverRef}
                    style={{
                        position: 'absolute',
                        zIndex: 1000,
                        background: 'white',
                        border: '1px solid #ccc',
                        padding: "2px 10px 10px 10px",
                        borderRadius: 4,
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                        left: popoverStyle.left,
                        top: popoverStyle.top,
                        boxSizing: 'border-box',
                        width: '500px',
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <CrossedRegionChart seq={currentCrossedSeq} />
                    </div>
                </div>
            )}
        </div>
    );
};
