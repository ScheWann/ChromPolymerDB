import React, { useEffect, useRef, useState } from 'react';
import { Button, InputNumber, Modal, Tooltip, Slider, Select, Spin, Empty, Switch } from "antd";
import { DownloadOutlined, RollbackOutlined, FullscreenOutlined, ExperimentOutlined, LaptopOutlined, MinusOutlined } from "@ant-design/icons";
import { GeneList } from './geneList.js';
import { HeatmapTriangle } from './heatmapTriangle.js';
import "./Styles/canvasHeatmap.css";
import * as d3 from 'd3';

export const Heatmap = ({ cellLineDict, comparisonHeatmapId, cellLineName, chromosomeName, chromosomeData, currentChromosomeSequence, setCurrentChromosomeSequence, selectedChromosomeSequence, totalChromosomeSequences, geneList, setSelectedChromosomeSequence, chromosome3DExampleID, setChromosome3DLoading, setGeneName, geneName, geneSize, setChromosome3DExampleData, setComparisonCellLine3DLoading, setComparisonCellLine3DData, setGeneSize, formatNumber, cellLineList, setChromosome3DCellLineName, removeComparisonHeatmap }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const brushSvgRef = useRef(null);
    const axisSvgRef = useRef(null);
    const colorScaleRef = useRef(null);
    const [minDimension, setMinDimension] = useState(0);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [halfHeatMapModalVisible, setHalfHeatMapModalVisible] = useState(false);
    const [colorScaleRange, setColorScaleRange] = useState([0, 0.8]);
    const [igvMountStatus, setIgvMountStatus] = useState(false);
    const [independentHeatmapCellLine, setIndependentHeatmapCellLine] = useState(cellLineName)
    const [independentHeatmapData, setIndependentHeatmapData] = useState(chromosomeData);
    const [currentChromosomeData, setCurrentChromosomeData] = useState(independentHeatmapData);
    const [independentHeatmapLoading, setIndependentHeatmapLoading] = useState(false);
    const [fqRawcMode, setFqRawcMode] = useState(true);

    const modalStyles = {
        body: {
            overflowY: 'auto',
            maxHeight: '80vh'
        },
        content: {
            height: '80vh',
            padding: "30px 10px 20px 10px"
        }
    };

    const download = () => {
        if (independentHeatmapData) {
            const filteredData = independentHeatmapData.filter(row => row.fdr < 0.05);

            if (filteredData.length === 0) {
                alert("no suitable data (fdr < 0.05)");
                return;
            }

            const csvData = filteredData.map(row =>
                `${row.cell_line},${row.chrid},${row.ibp},${row.jbp},${row.fq},${row.fdr},${row.rawc}`
            ).join('\n');

            const header = 'cell_line,chrid,ibp,jbp,fq,fdr,rawc\n';
            const csvContent = header + csvData;

            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `${chromosomeName}.${selectedChromosomeSequence.start}.${selectedChromosomeSequence.end}.csv`;
            link.click();

            URL.revokeObjectURL(url);
        }
    };

    const comparisonCellLineChange = (value) => {
        setIndependentHeatmapCellLine(value);
        fetchComparisonChromosomeData(value);
    }

    const fetchComparisonChromosomeData = (compared_cell_line) => {
        setIndependentHeatmapLoading(true);
        fetch("/getChromosData", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ cell_line: compared_cell_line, chromosome_name: chromosomeName, sequences: selectedChromosomeSequence })
        })
            .then(res => res.json())
            .then(data => {
                setIndependentHeatmapData(data);
                setIndependentHeatmapLoading(false);
            });
    };

    const fetchExampleChromos3DData = (cell_line, sample_id, sampleChange, isComparison) => {
        if (cell_line && chromosomeName && selectedChromosomeSequence) {
            const cacheKey = `${cell_line}-${chromosomeName}-${currentChromosomeSequence.start}-${currentChromosomeSequence.end}-${sample_id}`;

            fetch("/getExampleChromos3DData", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    cell_line: cell_line,
                    chromosome_name: chromosomeName,
                    sequences: currentChromosomeSequence,
                    sample_id: sample_id
                })
            })
                .then(res => res.json())
                .then(data => {
                    if (isComparison) {
                        setComparisonCellLine3DData(prev => ({
                            ...prev,
                            [cacheKey]: data["position_data"],
                            [cacheKey + "_avg_matrix"]: data["avg_distance_data"],
                            [cacheKey + "_fq_data"]: data["fq_data"],
                            [cacheKey + "sample_distance_vector"]: data["sample_distance_vector"]
                        }));
                        setComparisonCellLine3DLoading(false);
                    } else {
                        setChromosome3DExampleData(prev => ({
                            ...prev,
                            [cacheKey]: data["position_data"],
                            [cacheKey + "_avg_matrix"]: data["avg_distance_data"],
                            [cacheKey + "_fq_data"]: data["fq_data"],
                            [cacheKey + "sample_distance_vector"]: data["sample_distance_vector"]
                        }));
                        if (sampleChange === "submit") {
                            setChromosome3DLoading(false);
                        }
                    }
                });
        }
    };

    const generate3DChromosome = () => {
        setSelectedChromosomeSequence(currentChromosomeSequence);
        setChromosome3DLoading(true);
        fetchExampleChromos3DData(independentHeatmapCellLine, chromosome3DExampleID, "submit", false);
        setChromosome3DCellLineName(independentHeatmapCellLine);
    };

    const openHalfHeatMapModal = () => {
        setHalfHeatMapModalVisible(true);
        setIgvMountStatus(true);
    }

    const closeHalfHeatMapModal = () => {
        setHalfHeatMapModalVisible(false);
        setIgvMountStatus(false);
    }

    const changeColorScale = (value) => {
        setColorScaleRange(value);
    }

    const changeColorByInput = (type) => (value) => {
        if (type === "min") {
            setColorScaleRange([Math.min(value, colorScaleRange[1]), colorScaleRange[1]]);
        } else {
            setColorScaleRange([colorScaleRange[0], Math.max(value, colorScaleRange[0])]);
        }
    };

    const changeFqRawcMode = () => {
        setFqRawcMode(!fqRawcMode);
        if (fqRawcMode) {
            setColorScaleRange([0, 30]);
        } else {
            setColorScaleRange([0, 0.8]);
        }
    }

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
        if ((!containerSize.width && !containerSize.height) || independentHeatmapData.length === 0) return;

        const parentWidth = containerSize.width;
        const parentHeight = containerSize.height;
        const margin = { top: 45, right: 0, bottom: 45, left: 60 };

        setMinDimension(Math.min(parentWidth, parentHeight));
        const width = Math.min(parentWidth, parentHeight) - margin.left - margin.right;
        const height = Math.min(parentWidth, parentHeight) - margin.top - margin.bottom;

        const zoomedChromosomeData = independentHeatmapData.filter(item => {
            const { ibp, jbp } = item;
            return ibp >= currentChromosomeSequence.start && ibp <= currentChromosomeSequence.end &&
                jbp >= currentChromosomeSequence.start && jbp <= currentChromosomeSequence.end;
        });

        setCurrentChromosomeData(zoomedChromosomeData);

        // Draw canvas
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

        const fqMap = new Map();

        zoomedChromosomeData.forEach(d => {
            fqMap.set(`X:${d.ibp}, Y:${d.jbp}`, { fq: d.fq, fdr: d.fdr, rawc: d.rawc });
            fqMap.set(`X:${d.jbp}, Y:${d.ibp}`, { fq: d.fq, fdr: d.fdr, rawc: d.rawc });
        });

        const hasData = (ibp, jbp) => {
            const inRange = totalChromosomeSequences.some(seq =>
                ibp >= seq.start && ibp <= seq.end &&
                jbp >= seq.start && jbp <= seq.end
            );

            return inRange;
        };

        // Draw heatmap using Canvas
        axisValues.forEach(ibp => {
            axisValues.forEach(jbp => {
                const { fq, fdr, rawc } = fqMap.get(`X:${ibp}, Y:${jbp}`) || fqMap.get(`X:${jbp}, Y:${ibp}`) || { fq: -1, fdr: -1, rawc: -1 };

                const x = margin.left + xScale(jbp);
                const y = margin.top + yScale(ibp);
                const width = xScale.bandwidth();
                const height = yScale.bandwidth();

                context.fillStyle = !hasData(ibp, jbp) ? 'white' : (jbp <= ibp && (fdr > 0.05 || (fdr === -1 && rawc === -1))) ? 'white' : colorScale(fqRawcMode ? fq : rawc);
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

        // Brush for selecting range
        const brushSvg = d3.select(brushSvgRef.current)
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);

        brushSvg.selectAll('*').remove();

        brushSvg.append('g')
            .attr('class', 'brush')
            .call(d3.brushX()
                .extent([[margin.left, margin.top], [width + margin.left, height + margin.top]])
                .on('end', ({ selection }) => {
                    if (!selection) {
                        setCurrentChromosomeSequence(selectedChromosomeSequence);
                        return;
                    }

                    const [x0, x1] = selection;
                    const brushedX = axisValues.filter(val => {
                        const pos = margin.left + xScale(val) + xScale.bandwidth() / 2;
                        return pos >= x0 && pos <= x1;
                    });
                    setCurrentChromosomeSequence({ start: brushedX[0], end: brushedX[brushedX.length - 1] });
                })
            );

        let adjustedGeneStart, adjustedGeneEnd;

        if (geneSize) {
            adjustedGeneStart = Math.floor(geneSize.start / step) * step;
            adjustedGeneEnd = Math.ceil(geneSize.end / step) * step;
        }

        // Draw gene range lines if geneSize exists
        if (geneSize && geneSize.start !== null && geneSize.end !== null && xScale(adjustedGeneStart) !== undefined && xScale(adjustedGeneEnd) !== undefined) {
            const geneStartPos = margin.left + xScale(adjustedGeneStart);
            const geneEndPos = margin.left + xScale(adjustedGeneEnd);

            axisSvg.append('line')
                .attr('class', 'gene-line')
                .attr('x1', geneStartPos)
                .attr('x2', geneStartPos)
                .attr('y1', margin.top)
                .attr('y2', margin.top + height)
                .attr('stroke', '#999')
                .attr('stroke-width', 2);

            axisSvg.append('line')
                .attr('class', 'gene-line')
                .attr('x1', geneEndPos)
                .attr('x2', geneEndPos)
                .attr('y1', margin.top)
                .attr('y2', margin.top + height)
                .attr('stroke', '#999')
                .attr('stroke-width', 2);
        } else {
            axisSvg.selectAll('.gene-line').remove();
        }
    }, [minDimension, currentChromosomeSequence, geneSize, colorScaleRange, containerSize, independentHeatmapData, fqRawcMode]);

    return (
        <div className='heatmapContainer' style={{ display: 'flex', flexDirection: 'column', width: '40vw', height: '100%', position: 'relative' }}>
            <div ref={containerRef} style={{
                width: '100%', height: '72%', borderRight: "1px solid #eaeaea", position: 'relative', display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
            }}>
                <div style={{
                    position: 'absolute', top: 0, right: 0, zIndex: 10, display: 'flex', gap: '10px', width: '100%', justifyContent: 'space-between', padding: "5px 0 5px 0", borderBottom: "1px solid #eaeaea", alignItems: 'center'
                }}>
                    <div style={{ fontSize: 12, fontWeight: 'bold', marginLeft: 10 }}>
                        {!comparisonHeatmapId && (
                            <>
                                <span style={{ marginRight: 3 }}>{cellLineDict[cellLineName]}</span>
                                <span style={{ marginRight: 3 }}>-</span>
                            </>
                        )}
                        <span style={{ marginRight: 3 }}>{chromosomeName}</span>
                        <span style={{ marginRight: 3 }}>:</span>
                        <span style={{ marginRight: 5 }}>{formatNumber(currentChromosomeSequence.start)}</span>
                        <span style={{ marginRight: 5 }}>~</span>
                        <span>{formatNumber(currentChromosomeSequence.end)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                        <Tooltip
                            title="fq/rawc value of the heatmap"
                            color='white'
                            overlayInnerStyle={{
                                color: 'black'
                            }}
                        >
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
                        </Tooltip>
                        <Tooltip
                            title="Restore the original heatmap"
                            color='white'
                            overlayInnerStyle={{
                                color: 'black'
                            }}
                        >
                            <Button
                                size='small'
                                style={{
                                    fontSize: 12,
                                    cursor: "pointer",
                                }}
                                icon={<RollbackOutlined />}
                                onClick={() => setCurrentChromosomeSequence(selectedChromosomeSequence)}
                            />
                        </Tooltip>
                        <Tooltip
                            title="Expand the heatmap view"
                            color='white'
                            overlayInnerStyle={{
                                color: 'black'
                            }}
                        >
                            <Button
                                size='small'
                                style={{
                                    fontSize: 12,
                                    cursor: "pointer",
                                }}
                                icon={<FullscreenOutlined />}
                                onClick={openHalfHeatMapModal}
                            />
                        </Tooltip>
                        <Tooltip
                            title="Download non-random interaction data"
                            color='white'
                            overlayInnerStyle={{
                                color: 'black'
                            }}
                        >
                            <Button
                                size='small'
                                style={{
                                    fontSize: 12,
                                    cursor: "pointer",
                                }}
                                icon={<DownloadOutlined />}
                                onClick={download}
                            />
                        </Tooltip>
                        {comparisonHeatmapId && (
                            <>
                                <Tooltip
                                    title="Generate a new heatmap based on the comparison cell line"
                                    color='white'
                                    overlayInnerStyle={{
                                        color: 'black'
                                    }}
                                >
                                    <Select
                                        value={independentHeatmapCellLine}
                                        style={{
                                            minWidth: 100,
                                            maxWidth: 150,
                                        }}
                                        size="small"
                                        onChange={comparisonCellLineChange}
                                        options={cellLineList}
                                    />
                                </Tooltip>
                                <Tooltip
                                    title="Close the comparison heatmap"
                                    color='white'
                                    overlayInnerStyle={{
                                        color: 'black'
                                    }}
                                >
                                    <Button
                                        size='small'
                                        style={{
                                            fontSize: 12,
                                            cursor: "pointer",
                                        }}
                                        icon={<MinusOutlined />}
                                        onClick={() => removeComparisonHeatmap(comparisonHeatmapId)}
                                    />
                                </Tooltip>
                            </>
                        )}
                        <Tooltip
                            title={
                                <span>
                                    Generate 3D chromosome structure based on in view.<br />
                                    <span style={{ color: '#3457D5', fontWeight: 'bold' }}>Note:</span> The chromosome structure generated within
                                    <span style={{ color: '#3457D5', fontWeight: 'bold' }}> 10 minutes </span> is the same.
                                </span>
                            }
                            color='white'
                            overlayInnerStyle={{
                                color: 'black'
                            }}
                        >
                            <Button size='small' color="primary" variant="outlined" onClick={generate3DChromosome} style={{ marginRight: 5, fontSize: 12 }}>
                                Generate
                            </Button>
                        </Tooltip>
                    </div>
                </div>
                {independentHeatmapLoading ? (
                    <Spin spinning={true} size="large" style={{ width: '40vw', height: '100%', borderRight: "1px solid #eaeaea", margin: 0 }} />
                ) : (
                    independentHeatmapData.length > 0 ? (
                        <>
                            <canvas ref={canvasRef} style={{ position: 'absolute', zIndex: 0 }} />
                            <svg ref={axisSvgRef} style={{ position: 'absolute', zIndex: 1, pointerEvents: 'none' }} />
                            <svg ref={brushSvgRef} style={{ position: 'absolute', zIndex: 2, pointerEvents: 'all' }} />
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
                                    step={fqRawcMode ? 0.1: 1}
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
                            <LaptopOutlined style={{ position: 'absolute', top: 45, left: `calc((100% - ${minDimension}px) / 2 + 60px + 10px)`, fontSize: 15, border: '1px solid #999', borderRadius: 5, padding: 5 }} />
                            <ExperimentOutlined style={{ position: 'absolute', bottom: 50, right: `calc((100% - ${minDimension}px) / 2 + 20px)`, fontSize: 15, border: '1px solid #999', borderRadius: 5, padding: 5 }} />
                            <Modal open={halfHeatMapModalVisible} onCancel={closeHalfHeatMapModal} footer={null} style={{ minWidth: "1000px" }} width={"60vw"} styles={modalStyles} >
                                <HeatmapTriangle
                                    geneList={geneList}
                                    cellLineName={independentHeatmapCellLine}
                                    chromosomeName={chromosomeName}
                                    totalChromosomeSequences={totalChromosomeSequences}
                                    currentChromosomeData={currentChromosomeData}
                                    currentChromosomeSequence={currentChromosomeSequence}
                                    geneName={geneName}
                                    fqRawcMode={fqRawcMode}
                                    colorScaleRange={colorScaleRange}
                                    igvMountStatus={igvMountStatus}
                                    changeColorByInput={changeColorByInput}
                                    changeColorScale={changeColorScale}
                                />
                            </Modal>
                        </>
                    ) : (
                        <Empty
                            className='heatmapContainer'
                            style={{ width: '40vw', height: '100%', margin: 0 }}
                            description="No Heatmap Data"
                        />
                    )
                )}
            </div>
            {minDimension > 0 && independentHeatmapData.length > 0 && (
                <GeneList
                    geneList={geneList}
                    cellLineName={independentHeatmapCellLine}
                    chromosomeName={chromosomeName}
                    currentChromosomeSequence={currentChromosomeSequence}
                    minDimension={minDimension}
                    geneName={geneName}
                    setCurrentChromosomeSequence={setCurrentChromosomeSequence}
                    setGeneName={setGeneName}
                    setGeneSize={setGeneSize}
                />
            )}
        </div>
    );
};
