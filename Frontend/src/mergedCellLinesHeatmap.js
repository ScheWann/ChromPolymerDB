import React, { useRef, useState, useEffect } from 'react';
import * as d3 from 'd3';
import { Select, Switch, InputNumber, Slider } from "antd";

export const MergedCellLinesHeatmap = ({ cellLineName, chromosomeName, totalChromosomeSequences, currentChromosomeSequence, independentHeatmapData, fqRawcMode, cellLineList, setFqRawcMode, colorScaleRange, setColorScaleRange, changeColorByInput, changeColorScale }) => {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const axisSvgRef = useRef(null);
    const colorScaleRef = useRef(null);
    const [minDimension, setMinDimension] = useState(0);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [mergeCompareCellLine, setMergeCompareCellLine] = useState(null);
    const [mergeCompareChromosomeData, setMergeCompareChromosomeData] = useState([]);
    const [mergeCompareToalSequences, setMergeCompareTotalSequences] = useState([]);

    const changeFqRawcMode = () => {
        setFqRawcMode(!fqRawcMode);
        if (fqRawcMode) {
            setColorScaleRange([0, 30]);
        } else {
            setColorScaleRange([0, 0.8]);
        }
    }

    // automatic set the size of the chart
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                setContainerSize({ width, height });
            }
        });
        resizeObserver.observe(container);
        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        fetch('/api/getChromosSequence', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ cell_line: cellLineName, chromosome_name: chromosomeName })
        })
            .then(res => res.json())
            .then(data => {
                setMergeCompareTotalSequences(data);
            });

        fetch("/api/getChromosData", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ cell_line: mergeCompareCellLine, chromosome_name: chromosomeName, sequences: currentChromosomeSequence })
        })
            .then(res => res.json())
            .then(data => {
                setMergeCompareChromosomeData(data);
            });
    }, [mergeCompareCellLine]);

    useEffect(() => {
        if ((!containerSize.width && !containerSize.height) || independentHeatmapData.length === 0) return;

        const parentWidth = containerSize.width;
        const parentHeight = containerSize.height;
        const margin = { top: 45, right: 0, bottom: 60, left: 70 };

        setMinDimension(Math.min(parentWidth, parentHeight));
        const width = Math.min(parentWidth, parentHeight) - margin.left - margin.right;
        const height = Math.min(parentWidth, parentHeight) - margin.top - margin.bottom;

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        canvas.width = width + margin.left + margin.right;
        canvas.height = height + margin.top + margin.bottom;

        context.clearRect(0, 0, canvas.width, canvas.height);

        const { start, end } = currentChromosomeSequence;
        const step = 5000;
        const adjustedStart = Math.floor(start / step) * step;
        const adjustedEnd = Math.ceil(end / step) * step;

        const axisValues = Array.from(
            { length: Math.floor((adjustedEnd - adjustedStart) / step) + 1 },
            (_, i) => adjustedStart + i * step
        );

        const xScale = d3.scaleBand()
            .domain(axisValues)
            .range([0, width])
            .padding(0.1);

        const yScale = d3.scaleBand()
            .domain(axisValues)
            .range([height, 0])
            .padding(0.1);

        const colorScale = d3.scaleSequential(
            t => d3.interpolateReds(t * 0.8 + 0.2)
        ).domain(colorScaleRange);

        const independentMap = new Map();
        const mergeCompareMap = new Map();

        independentHeatmapData.forEach(d => {
            independentMap.set(`X:${d.ibp},Y:${d.jbp}`, d);
        });

        if (mergeCompareCellLine) {
            mergeCompareChromosomeData.forEach(d => {
                mergeCompareMap.set(`X:${d.ibp},Y:${d.jbp}`, d);
            });
        }

        // independentHeatmapData.forEach(d => {
        //     fqMap.set(`X:${d.ibp}, Y:${d.jbp}`, { fq: d.fq, fdr: d.fdr, rawc: d.rawc, cell_line: d.cell_line });
        // });

        // if (mergeCompareCellLine) {
        //     mergeCompareChromosomeData.forEach(d => {
        //         fqMap.set(`X:${d.jbp}, Y:${d.ibp}`, { fq: d.fq, fdr: d.fdr, rawc: d.rawc, cell_line: d.cell_line });
        //     });
        // }

        const hasData = (ibp, jbp, cellline) => {
            let inRange = false;
            if (cellline === cellLineName) {
                inRange = totalChromosomeSequences.some(seq =>
                    ibp >= seq.start && ibp <= seq.end &&
                    jbp >= seq.start && jbp <= seq.end
                );
            } else {
                inRange = mergeCompareToalSequences.some(seq =>
                    ibp >= seq.start && ibp <= seq.end &&
                    jbp >= seq.start && jbp <= seq.end
                );
            }
            return inRange;
        };

        // Draw heatmap using Canvas
        axisValues.forEach(ibp => {
            axisValues.forEach(jbp => {
                let dataPoint = null;

                if (jbp <= ibp) {
                    dataPoint = independentMap.get(`X:${ibp},Y:${jbp}`) || independentMap.get(`X:${jbp},Y:${ibp}`);
                }

                if (mergeCompareChromosomeData.length > 0 && jbp > ibp) {
                    dataPoint = mergeCompareMap.get(`X:${ibp},Y:${jbp}`) || mergeCompareMap.get(`X:${jbp},Y:${ibp}`);
                }

                const x = margin.left + xScale(jbp);
                const y = margin.top + yScale(ibp);
                const width = xScale.bandwidth();
                const height = yScale.bandwidth();

                if (dataPoint) {
                    const { fq, fdr, rawc } = dataPoint;
                    context.fillStyle = (fdr > 0.05 || (fdr === -1 && rawc === -1)) ? 'white' : colorScale(fqRawcMode ? fq : rawc);
                } else {
                    context.fillStyle = 'white';
                }

                context.fillRect(x, y, width, height);
            });
        });

        const axisSvg = d3.select(axisSvgRef.current)
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);

        axisSvg.selectAll('*').remove();

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

        // X-axis
        axisSvg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top + height})`)
            .call(d3.axisBottom(xScale)
                .tickValues(axisValues.filter((_, i) => i % tickCount === 0))
                .tickFormat(d => {
                    if (d >= 1000000) {
                        return `${(d / 1000000).toFixed(3)}M`;
                    }
                    if (d > 10000 && d < 1000000) {
                        return `${(d / 10000).toFixed(3)}W`;
                    }
                    return d;
                }))
            .selectAll("text")
            .style("text-anchor", "end")
            .attr("transform", "rotate(-45)")
            .attr("dx", "-1em")
            .attr("dy", "0em");

        // Y-axis
        axisSvg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`)
            .call(d3.axisLeft(yScale)
                .tickValues(axisValues.filter((_, i) => i % tickCount === 0))
                .tickFormat(d => {
                    if (d >= 1000000) {
                        return `${(d / 1000000).toFixed(3)}M`;
                    }
                    if (d > 10000 && d < 1000000) {
                        return `${(d / 10000).toFixed(3)}W`;
                    }
                    return d;
                }));

        axisSvg.append('text')
            .attr('transform', `rotate(-90)`)
            .attr('x', -margin.top - height / 2)
            .attr('y', 15)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .attr('fill', '#333')
            .style('font-weight', 'bold')
            .text(cellLineName);
        
        axisSvg.append('text')
            .attr('x', margin.left + width / 2)
            .attr('y', margin.top + height + 50)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .attr('fill', '#333')
            .style('font-weight', 'bold')
            .text(mergeCompareCellLine || '');

        // Color Scale
        const colorScaleSvg = d3.select(colorScaleRef.current)
            .attr('width', (parentWidth - minDimension) / 2)
            .attr('height', parentHeight);

        colorScaleSvg.selectAll('*').remove();

        const defs = colorScaleSvg.append('defs');
        const gradient = defs.append('linearGradient')
            .attr('id', 'colorGradient')
            .attr('x1', '0%')
            .attr('y1', '0%')
            .attr('x2', '100%')
            .attr('y2', '0%');

        const numStops = 10;
        for (let i = 0; i <= numStops; i++) {
            const t = i / numStops;
            gradient.append('stop')
                .attr('offset', `${t * 100}%`)
                .attr('stop-color', colorScale(colorScaleRange[0] + t * (colorScaleRange[1] - colorScaleRange[0])));
        }

        colorScaleSvg.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', height / 1.2)
            .attr('height', 20)
            .style('fill', 'url(#colorGradient)')
            .attr('transform', `translate(0, ${(parentHeight - height / 1.2) / 2 + height / 1.2}) rotate(-90, 0, 0)`);

        colorScaleSvg.append('text')
            .attr('x', 10)
            .attr('y', height / 1.2 + (parentHeight - height / 1.2) / 2 + 15)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .attr('fill', '#333')
            .text(colorScaleRange[0]);

        colorScaleSvg.append('text')
            .attr('x', 10)
            .attr('y', (parentHeight - height / 1.2) / 2 - 5)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .attr('fill', '#333')
            .text(colorScaleRange[1]);

    }, [colorScaleRange, containerSize, independentHeatmapData, currentChromosomeSequence, fqRawcMode, mergeCompareChromosomeData]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
            <div style={{ display: 'flex', width: '100%', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
                <Switch
                    size='small'
                    checkedChildren="fq"
                    unCheckedChildren="rawc"
                    checked={fqRawcMode}
                    style={{
                        backgroundColor: fqRawcMode ? '#74C365' : '#ED9121'
                    }}
                    onChange={changeFqRawcMode}
                />
                <span>Compared Cell Line:</span>
                <Select
                    value={mergeCompareCellLine}
                    style={{
                        minWidth: 300,
                    }}
                    size="small"
                    onChange={setMergeCompareCellLine}
                    options={cellLineList}
                />
            </div>
            <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <canvas ref={canvasRef} style={{ position: 'absolute', zIndex: 0 }} />
                <svg ref={axisSvgRef} style={{ position: 'absolute', zIndex: 1, pointerEvents: 'none' }} />
                <svg
                    ref={colorScaleRef}
                    style={{
                        position: 'absolute',
                        left: `calc((100% - ${minDimension}px) / 4)`,
                        top: '50%',
                        transform: 'translate(0%, -50%)',
                        zIndex: 0,
                        pointerEvents: 'none'
                    }}
                />
            </div>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                    width: `calc((100% - ${minDimension}px) / 2)`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'absolute',
                    right: `calc((100% - ${minDimension}px) / 4)`,
                    top: '50%',
                    transform: 'translate(50%, -50%)',
                }}
            >
                <InputNumber
                    size='small'
                    style={{ width: 60 }}
                    controls={false}
                    value={colorScaleRange[1]}
                    min={0}
                    max={fqRawcMode ? 1 : 200}
                    onChange={changeColorByInput("max")}
                />
                <Slider
                    range={{ draggableTrack: true }}
                    vertical
                    style={{ height: 200 }}
                    min={0}
                    max={fqRawcMode ? 1 : 200}
                    step={fqRawcMode ? 0.1 : 1}
                    onChange={changeColorScale}
                    value={colorScaleRange}
                />
                <InputNumber
                    size='small'
                    style={{ width: 60 }}
                    controls={false}
                    value={colorScaleRange[0]}
                    min={0}
                    max={fqRawcMode ? 1 : 200}
                    onChange={changeColorByInput("min")}
                />
            </div>
        </div>
    );
};