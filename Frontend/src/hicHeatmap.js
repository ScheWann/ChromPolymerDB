import React, { useEffect, useRef, useState } from 'react';
import { Button, InputNumber, Modal, Tooltip, Slider, Select, Spin, Empty, Switch } from "antd";
import { DownloadOutlined, RollbackOutlined, FullscreenOutlined, ExperimentOutlined, LaptopOutlined, MinusOutlined, MergeOutlined, CloseOutlined } from "@ant-design/icons";
import { GeneList } from './geneList.js';
import { HeatmapTriangle } from './heatmapTriangle.js';
import { MergedCellLinesHeatmap } from './mergedCellLinesHeatmap.js';
import "./Styles/canvasHeatmap.css";
import * as d3 from 'd3';

export const Heatmap = ({ comparisonHeatmapId, cellLineName, chromosomeName, chromosomeData, currentChromosomeSequence, setCurrentChromosomeSequence, selectedChromosomeSequence, totalChromosomeSequences, geneList, setSelectedChromosomeSequence, setChromosome3DExampleID, setChromosome3DLoading, setGeneName, geneName, geneSize, setChromosome3DExampleData, setGeneSize, formatNumber, cellLineList, setChromosome3DCellLineName, removeComparisonHeatmap, setSelectedSphereLists, isExampleMode, fetchExistChromos3DData, exampleDataSet, progressPolling, updateComparisonHeatmapCellLine, comparisonHeatmapUpdateTrigger, setChromosome3DComponents, setChromosome3DComponentIndex, comparisonHeatmapList, isBintuMode = false, bintuStep = 30000,
    // Bintu control props
    selectedBintuCluster, setSelectedBintuCluster, tempBintuCellId, setTempBintuCellId, handleBintuHeatmapSubmit, bintuCellClusters = [], bintuHeatmapLoading = false, onCloseBintuHeatmap }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const brushSvgRef = useRef(null);
    const axisSvgRef = useRef(null);
    const colorScaleRef = useRef(null);
    const [minDimension, setMinDimension] = useState(0);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [halfHeatMapModalVisible, setHalfHeatMapModalVisible] = useState(false);
    const [mergedCellLinesHeatmapModalVisible, setMergedCellLinesHeatmapModalVisible] = useState(false);
    const [colorScaleRange, setColorScaleRange] = useState([0, 0.3]);
    const [igvMountStatus, setIgvMountStatus] = useState(false);
    const [independentHeatmapCellLine, setIndependentHeatmapCellLine] = useState(comparisonHeatmapId ? null : cellLineName)
    const [independentHeatmapData, setIndependentHeatmapData] = useState(chromosomeData);
    const [currentChromosomeData, setCurrentChromosomeData] = useState(independentHeatmapData);
    const [independentHeatmapLoading, setIndependentHeatmapLoading] = useState(false);
    const [fqRawcMode, setFqRawcMode] = useState(true);
    const [sourceRecords, setSourceRecords] = useState([]);
    const drewColorRef = useRef(false); // Track if any colored cell drawn (Bintu)

    // Sync internal data when Bintu mode chromosomeData changes
    useEffect(() => {
        if (isBintuMode) {
            setIndependentHeatmapData(chromosomeData || []);
        }
    }, [chromosomeData, isBintuMode]);

    // Debug first row for Bintu
    useEffect(() => {
        if (isBintuMode && independentHeatmapData && independentHeatmapData.length) {
            // eslint-disable-next-line no-console
            console.debug('[BintuHeatmap] Received rows:', independentHeatmapData.length, 'Example:', independentHeatmapData[0]);
        }
    }, [isBintuMode, independentHeatmapData]);

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
        // Update the parent component about the cell line change
        if (comparisonHeatmapId && updateComparisonHeatmapCellLine) {
            updateComparisonHeatmapCellLine(comparisonHeatmapId, value);
        }
    }

    const fetchComparisonChromosomeData = (compared_cell_line) => {
        setIndependentHeatmapLoading(true);
        fetch("/api/getChromosData", {
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

    const fetchExampleChromos3DData = (cell_line, sample_id, componentId = null) => {
        if (cell_line && chromosomeName && selectedChromosomeSequence) {
            // Use the correct sequence based on context
            const sequenceToUse = componentId ? selectedChromosomeSequence : currentChromosomeSequence;

            // Use the correct cache key pattern
            const cacheKey = componentId
                ? `${cell_line}-COMPARISON-${chromosomeName}-${sequenceToUse.start}-${sequenceToUse.end}-${sample_id}`
                : `${cell_line}-${chromosomeName}-${sequenceToUse.start}-${sequenceToUse.end}-${sample_id}`;

            // Set loading state before making the request
            if (componentId && setChromosome3DComponents) {
                setChromosome3DComponents(prev =>
                    prev.map(comp =>
                        comp.id === componentId
                            ? { ...comp, loading: true }
                            : comp
                    )
                );
            } else {
                setChromosome3DLoading(true);
            }

            fetch("/api/getChromosome3DData", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    cell_line: cell_line,
                    chromosome_name: chromosomeName,
                    sequences: sequenceToUse,
                    sample_id: sample_id
                })
            })
                .then(res => res.json())
                .then(data => {
                    if (componentId && setChromosome3DComponents) {
                        // Update the specific component's data
                        setChromosome3DComponents(prev =>
                            prev.map(comp =>
                                comp.id === componentId
                                    ? {
                                        ...comp,
                                        data: {
                                            ...comp.data,
                                            [cacheKey]: data["position_data"],
                                            [cacheKey + "_avg_matrix"]: data["avg_distance_data"],
                                            [cacheKey + "_fq_data"]: data["fq_data"],
                                            [cacheKey + "sample_distance_vector"]: data["sample_distance_vector"]
                                        },
                                        loading: false
                                    }
                                    : comp
                            )
                        );
                    } else {
                        // For main heatmap, store in global state
                        setChromosome3DExampleData(prev => ({
                            ...prev,
                            [cacheKey]: data["position_data"],
                            [cacheKey + "_avg_matrix"]: data["avg_distance_data"],
                            [cacheKey + "_fq_data"]: data["fq_data"],
                            [cacheKey + "sample_distance_vector"]: data["sample_distance_vector"]
                        }));
                        setChromosome3DExampleID(sample_id);
                        setChromosome3DLoading(false);
                    }
                })
                .catch(error => {
                    console.error('Error fetching chromosome 3D data:', error);
                    // Reset loading state on error
                    if (componentId && setChromosome3DComponents) {
                        setChromosome3DComponents(prev =>
                            prev.map(comp =>
                                comp.id === componentId
                                    ? { ...comp, loading: false }
                                    : comp
                            )
                        );
                    } else {
                        setChromosome3DLoading(false);
                    }
                });
        } else {
            console.error('fetchExampleChromos3DData: Missing required parameters');
        }
    };

    const generate3DChromosome = () => {
        // Only set global state for the main heatmap
        if (!comparisonHeatmapId) {
            setSelectedChromosomeSequence(currentChromosomeSequence);
            setSelectedSphereLists({ [cellLineName]: {} });
        }

        // If this is the main heatmap (not a comparison), use the existing global 3D system
        if (!comparisonHeatmapId) {
            if (!isExampleMode(independentHeatmapCellLine, chromosomeName, currentChromosomeSequence)) {
                fetchExampleChromos3DData(independentHeatmapCellLine, 0);
                progressPolling(independentHeatmapCellLine, chromosomeName, currentChromosomeSequence, 0, false);
            } else {
                const bestSampleID = exampleDataSet[`${independentHeatmapCellLine}-${chromosomeName}-${currentChromosomeSequence.start}-${currentChromosomeSequence.end}`];
                fetchExistChromos3DData(true, bestSampleID, independentHeatmapCellLine, null);
            }
            setChromosome3DCellLineName(independentHeatmapCellLine);
        } else {
            // For comparison heatmaps, create a new independent 3D component
            if (setChromosome3DComponents && setChromosome3DComponentIndex) {
                const newComponentId = Date.now();
                const newComponent = {
                    id: newComponentId,
                    cellLine: independentHeatmapCellLine,
                    sampleID: 0,
                    data: {},
                    loading: true,
                    downloadSpinner: false
                };

                setChromosome3DComponents(prev => [...prev, newComponent]);
                setChromosome3DComponentIndex(prev => prev + 1);

                if (!isExampleMode(independentHeatmapCellLine, chromosomeName, selectedChromosomeSequence)) {
                    fetchExampleChromos3DData(independentHeatmapCellLine, 0, newComponentId);
                    progressPolling(independentHeatmapCellLine, chromosomeName, selectedChromosomeSequence, 0, false);
                } else {
                    const bestSampleID = exampleDataSet[`${independentHeatmapCellLine}-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}`];
                    fetchExistChromos3DData(true, bestSampleID, independentHeatmapCellLine, newComponentId);
                }
            }
        }
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

    // Handle updates triggered by parent component
    useEffect(() => {
        if (comparisonHeatmapId && comparisonHeatmapUpdateTrigger && independentHeatmapCellLine) {
            // Fetch new data when update is triggered
            fetchComparisonChromosomeData(independentHeatmapCellLine);
        }
    }, [comparisonHeatmapUpdateTrigger]);

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

    // Load dataset metadata from public/source.json (robust to non-array JSON)
    useEffect(() => {
        let cancelled = false;
        fetch('/source.json')
            .then(async (res) => {
                const text = await res.text();
                try {
                    const parsed = JSON.parse(text);
                    if (!cancelled) setSourceRecords(Array.isArray(parsed) ? parsed : [parsed]);
                } catch (e) {
                    try {
                        const parsed = JSON.parse(`[${text}]`);
                        if (!cancelled) setSourceRecords(Array.isArray(parsed) ? parsed : []);
                    } catch (e2) {
                        console.error('Failed to parse /source.json', e2);
                    }
                }
            })
            .catch((err) => console.error('Failed to load /source.json', err));
        return () => { cancelled = true; };
    }, []);

    const matchedSource = React.useMemo(() => {
        if (!sourceRecords || sourceRecords.length === 0) return null;
        const candidates = [
            chromosomeName,
            independentHeatmapCellLine || cellLineName,
            cellLineName,
        ].filter(Boolean);
        for (const key of candidates) {
            const found = sourceRecords.find(
                (r) => String(r.id).toLowerCase() === String(key).toLowerCase()
            );
            if (found) return found;
        }
        return null;
    }, [sourceRecords, chromosomeName, independentHeatmapCellLine, cellLineName]);

    useEffect(() => {
        if ((!containerSize.width && !containerSize.height) || independentHeatmapData.length === 0) return;

        const parentWidth = containerSize.width;
        const parentHeight = containerSize.height;
        const margin = { top: 45, right: 20, bottom: 40, left: 60 };

        setMinDimension(Math.min(parentWidth, parentHeight));
        const width = Math.min(parentWidth, parentHeight) - margin.left - margin.right;
        const height = Math.min(parentWidth, parentHeight) - margin.top - margin.bottom;

        const zoomedChromosomeData = independentHeatmapData.filter(item => {
            if (isBintuMode) {
                const { x, y } = item;
                return x >= currentChromosomeSequence.start && x <= currentChromosomeSequence.end &&
                    y >= currentChromosomeSequence.start && y <= currentChromosomeSequence.end;
            } else {
                const { ibp, jbp } = item;
                return ibp >= currentChromosomeSequence.start && ibp <= currentChromosomeSequence.end &&
                    jbp >= currentChromosomeSequence.start && jbp <= currentChromosomeSequence.end;
            }
        });

        setCurrentChromosomeData(zoomedChromosomeData);

        // Draw canvas
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        canvas.width = width + margin.left + margin.right;
        canvas.height = height + margin.top + margin.bottom;

        context.clearRect(0, 0, canvas.width, canvas.height);

        const { start, end } = currentChromosomeSequence;
        const step = isBintuMode ? bintuStep : 5000;
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

        // Unified color scale (Reds) for both modes. For Bintu we derive dynamic domain from distances.
        const redInterpolator = t => d3.interpolateReds(t * 0.8 + 0.2);
        let legendDomain;
        let colorScale;
        if (isBintuMode) {
            const extent = d3.extent(zoomedChromosomeData, d => d.value);
            if (extent[0] === undefined) {
                legendDomain = [0, 1];
            } else if (extent[0] === extent[1]) {
                legendDomain = [extent[0], extent[0] + 1];
            } else {
                legendDomain = extent;
            }
            colorScale = d3.scaleSequential(redInterpolator).domain(legendDomain);
        } else {
            legendDomain = colorScaleRange;
            colorScale = d3.scaleSequential(redInterpolator).domain(colorScaleRange);
        }

        const dataMap = new Map();

        if (isBintuMode) {
            // For Bintu mode, map distance values directly
            zoomedChromosomeData.forEach(d => {
                dataMap.set(`X:${d.x}, Y:${d.y}`, { value: d.value });
                dataMap.set(`X:${d.y}, Y:${d.x}`, { value: d.value }); // Symmetrical
            });
        } else {
            // For regular mode, use the existing fq/fdr/rawc mapping
            zoomedChromosomeData.forEach(d => {
                dataMap.set(`X:${d.ibp}, Y:${d.jbp}`, { fq: d.fq, fdr: d.fdr, rawc: d.rawc });
                dataMap.set(`X:${d.jbp}, Y:${d.ibp}`, { fq: d.fq, fdr: d.fdr, rawc: d.rawc });
            });
        }

        const hasData = (ibp, jbp) => {
            const inRange = totalChromosomeSequences.some(seq =>
                ibp >= seq.start && ibp <= seq.end &&
                jbp >= seq.start && jbp <= seq.end
            );
            return inRange;
        };

        // Draw heatmap using Canvas
        drewColorRef.current = false;
        axisValues.forEach(ibp => {
            axisValues.forEach(jbp => {
                const x = margin.left + xScale(jbp);
                const y = margin.top + yScale(ibp);
                const cellWidth = xScale.bandwidth();
                const cellHeight = yScale.bandwidth();

                let fillColor;

                if (isBintuMode) {
                    const data = dataMap.get(`X:${ibp}, Y:${jbp}`) || dataMap.get(`X:${jbp}, Y:${ibp}`);
                    if (!hasData(ibp, jbp)) {
                        fillColor = 'white';
                    } else if (!data) {
                        fillColor = 'white';
                    } else {
                        // Use distance value for coloring (closer distances = darker colors)
                        fillColor = colorScale(data.value);
                    }
                } else {
                    const { fq, fdr, rawc } = dataMap.get(`X:${ibp}, Y:${jbp}`) || dataMap.get(`X:${jbp}, Y:${ibp}`) || { fq: -1, fdr: -1, rawc: -1 };
                    fillColor = !hasData(ibp, jbp) ? 'white' : (jbp <= ibp && (fdr > 0.05 || (fdr === -1 && rawc === -1))) ? 'white' : colorScale(fqRawcMode ? fq : rawc);
                }

                context.fillStyle = fillColor;
                context.fillRect(x, y, cellWidth, cellHeight);
                if (isBintuMode && fillColor !== 'white') drewColorRef.current = true;
            });
        });

        // Fallback: direct paint using data coordinates if all white
        if (isBintuMode && !drewColorRef.current && zoomedChromosomeData.length > 0) {
            // eslint-disable-next-line no-console
            console.debug('[BintuHeatmap] Fallback paint engaged.');
            zoomedChromosomeData.forEach(d => {
                const gx = Math.floor(d.x / bintuStep) * bintuStep;
                const gy = Math.floor(d.y / bintuStep) * bintuStep;
                if (!xScale(gx) && xScale(gx) !== 0) return;
                if (!yScale(gy) && yScale(gy) !== 0) return;
                const x = margin.left + xScale(gx);
                const y = margin.top + yScale(gy);
                context.fillStyle = colorScale(Math.min(d.value, 1000));
                context.fillRect(x, y, xScale.bandwidth(), yScale.bandwidth());
            });
        }

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

        tickCount = Math.min(tickCount, 80);

        // X-axis
        axisSvg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top + height})`)
            .call(d3.axisBottom(xScale)
                .tickValues(axisValues.filter((_, i) => i % tickCount === 0))
                .tickFormat(d => {
                    if (d >= 1000000) {
                        return `${(d / 1000000).toFixed(1)}M`;
                    }
                    if (d > 10000 && d < 1000000) {
                        return `${(d / 10000).toFixed(1)}W`;
                    }
                    return d;
                }))
            .selectAll("text")
            // .style("text-anchor", "center")
            // .attr("dx", "0em")
            // .attr("dy", "1em");
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
                        return `${(d / 1000000).toFixed(1)}M`;
                    }
                    if (d > 10000 && d < 1000000) {
                        return `${(d / 10000).toFixed(1)}W`;
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
        const gradientMin = legendDomain[0];
        const gradientMax = legendDomain[1];
        for (let i = 0; i <= numStops; i++) {
            const t = i / numStops;
            gradient.append('stop')
                .attr('offset', `${t * 100}%`)
                .attr('stop-color', colorScale(gradientMin + t * (gradientMax - gradientMin)));
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
            .text(gradientMin);

        colorScaleSvg.append('text')
            .attr('x', 10)
            .attr('y', (parentHeight - height / 1.2) / 2 - 5)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .attr('fill', '#333')
            .text(gradientMax);

        // Brush for selecting range (disabled in Bintu mode)
        if (!isBintuMode) {
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
        }

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

    const closeBintuHeatmap = () => {
        console.log('Closing Bintu heatmap');
        // if (!isBintuMode) return;
        // if (comparisonHeatmapId && removeComparisonHeatmap) {
        //     removeComparisonHeatmap(comparisonHeatmapId);
        //     return;
        // }
        // if (typeof onCloseBintuHeatmap === 'function') {
        //     onCloseBintuHeatmap();
        //     return;
        // }
        // try {
        //     window.location.assign('/projectIntroduction');
        // } catch (e) {
        //     // best-effort fallback
        //     window.location.href = '/projectIntroduction';
        // }
    };

    return (
        <div className='heatmapContainer' style={{ display: 'flex', flexDirection: 'column', width: '40vw', minWidth: '40vw', height: '100%', position: 'relative' }}>
            <div ref={containerRef} style={{
                width: '100%', height: '72%', borderRight: "1px solid #eaeaea", position: 'relative', display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
            }}>
                <div style={{
                    position: 'absolute', top: 0, right: 0, zIndex: 10, display: 'flex', gap: '10px', width: '100%', justifyContent: 'space-between', padding: "5px 0 5px 0", borderBottom: "1px solid #eaeaea", alignItems: 'center'
                }}>
                    <Tooltip
                        title={
                            matchedSource ? (
                                <div style={{ color: 'black' }}>
                                    <div>
                                        <span style={{ fontWeight: 600 }}>{matchedSource.id}</span> — {matchedSource.name}
                                    </div>
                                    {/* {matchedSource.system && (
                                        <div>System: {matchedSource.system}</div>
                                    )} */}
                                    {(matchedSource.source || matchedSource.Accession) && (
                                        <div>
                                            {matchedSource.source}
                                            {matchedSource.source && matchedSource.Accession ? ': ' : ''}
                                            {matchedSource.Accession}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <span style={{ color: 'black' }}>No metadata found</span>
                            )
                        }
                        color='white'
                        placement="bottomLeft"
                        overlayInnerStyle={{ width: 'max-content', whiteSpace: 'nowrap', maxWidth: 'none' }}
                    >
                        <div style={{ fontSize: 12, fontWeight: 'bold', marginLeft: 10, cursor: "pointer" }}>
                            {!comparisonHeatmapId && (
                                <>
                                    <span style={{ marginRight: 3 }}>{isBintuMode ? 'Bintu' : cellLineName}</span>
                                    {/* Show dash only when not in Bintu pre-selection state */}
                                    {(!isBintuMode || (selectedBintuCluster && tempBintuCellId)) && (
                                        <span style={{ marginRight: 3 }}>-</span>
                                    )}
                                </>
                            )}
                            {/* Hide chromosome and range when Bintu selection not made yet */}
                            {(!isBintuMode || (selectedBintuCluster && tempBintuCellId)) && (
                                <>
                                    <span style={{ marginRight: 3 }}>{chromosomeName}</span>
                                    <span style={{ marginRight: 3 }}>:</span>
                                    <span style={{ marginRight: 5 }}>{formatNumber(currentChromosomeSequence.start)}</span>
                                    <span style={{ marginRight: 5 }}>~</span>
                                    <span>{formatNumber(currentChromosomeSequence.end)}</span>
                                </>
                            )}
                        </div>
                    </Tooltip>
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                        {isBintuMode && (
                            <>
                                <Select
                                    placeholder="Cluster"
                                    size='small'
                                    style={{ width: 150 }}
                                    value={selectedBintuCluster}
                                    onChange={setSelectedBintuCluster}
                                    options={bintuCellClusters}
                                    optionFilterProp='label'
                                />
                                <InputNumber
                                    size='small'
                                    style={{ width: 90 }}
                                    min={1}
                                    placeholder='Cell ID'
                                    value={tempBintuCellId}
                                    onChange={setTempBintuCellId}
                                />
                                <Button
                                    type='primary'
                                    size='small'
                                    disabled={!selectedBintuCluster || !tempBintuCellId}
                                    loading={bintuHeatmapLoading}
                                    onClick={handleBintuHeatmapSubmit}
                                >Load</Button>
                            </>
                        )}
                        {!isBintuMode && (
                            <Tooltip
                                title={<span style={{ color: 'black' }}>fq/rawc value of the heatmap</span>}
                                color='white'
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
                        )}
                        {!comparisonHeatmapId && !isBintuMode && (
                            <Tooltip
                                title={<span style={{ color: 'black' }}>FoldRec interactions pairwise comparison</span>}
                                color='white'
                            >
                                <Button
                                    size='small'
                                    style={{
                                        fontSize: 12,
                                        cursor: "pointer",
                                    }}
                                    icon={<MergeOutlined />}
                                    onClick={() => setMergedCellLinesHeatmapModalVisible(true)}
                                />
                            </Tooltip>
                        )}
                        {!isBintuMode && (
                            <Tooltip
                                title={<span style={{ color: 'black' }}>Restore the original heatmap</span>}
                                color='white'
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
                        )}
                        {!isBintuMode && (
                            <Tooltip
                                title={<span style={{ color: 'black' }}>Expand the heatmap view</span>}
                                color='white'
                            >
                                <Button
                                    size='small'
                                    style={{
                                        fontSize: 12,
                                        cursor: "pointer",
                                    }}
                                    disabled={independentHeatmapData.length === 0}
                                    icon={<FullscreenOutlined />}
                                    onClick={openHalfHeatMapModal}
                                />
                            </Tooltip>
                        )}
                        <Tooltip
                            title={<span style={{ color: 'black' }}>Download non-random interaction data</span>}
                            color='white'
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
                        {isBintuMode && (
                            <Tooltip title={<span style={{ color: 'black' }}>Close this heatmap</span>} color='white'>
                                <Button
                                    size='small'
                                    style={{ 
                                        fontSize: 12,
                                        cursor: 'pointer',
                                        marginRight: 5
                                    }}
                                    icon={<MinusOutlined />}
                                    onClick={closeBintuHeatmap}
                                />
                            </Tooltip>
                        )}
                        {comparisonHeatmapId && !isBintuMode && (
                            <>
                                <Tooltip
                                    title={
                                        <span style={{ color: 'black' }}>
                                            Generate a new heatmap based on the comparison cell line<br />
                                            {independentHeatmapCellLine ?
                                                <>Selected: <span style={{ color: '#3457D5', fontWeight: 'bold' }}>{cellLineList.find(cl => cl.value === independentHeatmapCellLine)?.label || independentHeatmapCellLine}</span></> :
                                                <>Selected: <span style={{ color: '#3457D5', fontWeight: 'bold' }}>None</span></>
                                            }
                                        </span>
                                    }
                                    color='white'
                                    placement="topLeft"
                                >
                                    <Select
                                        value={independentHeatmapCellLine}
                                        style={{
                                            width: 100,
                                        }}
                                        size="small"
                                        onChange={comparisonCellLineChange}
                                        options={cellLineList}
                                        optionRender={(option) => (
                                            <Tooltip title={<span style={{ color: 'black' }}>{option.label}</span>} color='white' placement="right">
                                                <div>{option.label}</div>
                                            </Tooltip>
                                        )}
                                    />
                                </Tooltip>
                                <Tooltip
                                    title={<span style={{ color: 'black' }}>Close the comparison heatmap</span>}
                                    color='white'
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
                        {!isBintuMode && (
                            <Tooltip
                                title={
                                    <span style={{ color: 'black' }}>
                                        Generate 3D chromosome structure for shown locus.<br />
                                    </span>
                                }
                                color='white'
                            >
                                <Button size='small' color="primary" variant="outlined" onClick={generate3DChromosome} style={{ marginRight: 5, fontSize: 12 }}>
                                    3D Structure
                                </Button>
                            </Tooltip>
                        )}
                    </div>
                </div>
                {independentHeatmapLoading ? (
                    <Spin spinning={true} size="large" style={{ width: '40vw', height: '100%', borderRight: "1px solid #eaeaea", margin: 0 }} />
                ) : (
                    independentHeatmapData.length > 0 ? (
                        <>
                            <canvas ref={canvasRef} style={{ position: 'absolute', zIndex: 0 }} />
                            <svg ref={axisSvgRef} style={{ position: 'absolute', zIndex: 1, pointerEvents: 'none' }} />
                            {!isBintuMode && (
                                <svg ref={brushSvgRef} style={{ position: 'absolute', zIndex: 2, pointerEvents: 'all' }} />
                            )}
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
                                    step={fqRawcMode ? 0.1 : 1}
                                    onChange={changeColorScale}
                                    value={colorScaleRange}
                                    tooltip={{
                                        formatter: (value) => value,
                                        color: 'white',
                                        overlayInnerStyle: {
                                            color: 'black',
                                            fontWeight: '500'
                                        }
                                    }}
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

                            {/* half triangle heatmap Modal */}
                            <Modal
                                destroyOnHidden={true}
                                open={halfHeatMapModalVisible}
                                onCancel={closeHalfHeatMapModal}
                                footer={null}
                                width="60vw"
                                maskClosable={false}
                                keyboard={false}
                                style={{
                                    top: 0,
                                    padding: 0,
                                    maxWidth: '60vw',
                                    margin: '0 auto'
                                }}
                                styles={{
                                    body: {
                                        overflow: 'auto',
                                        height: '100vh',
                                        padding: 0,
                                        margin: 0
                                    },
                                    content: {
                                        height: '100vh',
                                        padding: 0,
                                        margin: 0,
                                        maxWidth: '60vw'
                                    }
                                }}
                            >
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
                                    isExampleMode={isExampleMode}
                                />
                            </Modal>

                            {/* Merged two heatmaps into one Modal */}
                            <Modal destroyOnHidden={true} open={mergedCellLinesHeatmapModalVisible} onCancel={() => setMergedCellLinesHeatmapModalVisible(false)} footer={null} width={"60vw"} styles={modalStyles} style={{ minWidth: "1000px" }} >
                                <MergedCellLinesHeatmap
                                    cellLineName={independentHeatmapCellLine}
                                    chromosomeName={chromosomeName}
                                    totalChromosomeSequences={totalChromosomeSequences}
                                    currentChromosomeSequence={currentChromosomeSequence}
                                    independentHeatmapData={independentHeatmapData}
                                    fqRawcMode={fqRawcMode}
                                    setFqRawcMode={setFqRawcMode}
                                    cellLineList={cellLineList}
                                    colorScaleRange={colorScaleRange}
                                    setColorScaleRange={setColorScaleRange}
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
