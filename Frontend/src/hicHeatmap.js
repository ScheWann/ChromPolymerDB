import React, { useEffect, useRef, useState } from 'react';
import { Button, InputNumber, Modal, Tooltip, Slider, Select, Spin, Empty, Switch, notification, Popover } from "antd";
import { DownloadOutlined, RollbackOutlined, FullscreenOutlined, ExperimentOutlined, LaptopOutlined, MinusOutlined, MergeOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { GeneList } from './geneList.js';
import { HeatmapTriangle } from './heatmapTriangle.js';
import { MergedCellLinesHeatmap } from './mergedCellLinesHeatmap.js';
import { calculateAxisValues, calculateTickValues, formatTickLabel } from './utils/axisUtils.js';
import "./Styles/canvasHeatmap.css";
import * as d3 from 'd3';

export const Heatmap = ({ comparisonHeatmapId, cellLineName, chromosomeName, chromosomeData, currentChromosomeSequence, setCurrentChromosomeSequence, selectedChromosomeSequence, totalChromosomeSequences, geneList, setSelectedChromosomeSequence, setChromosome3DExampleID, setChromosome3DLoading, setGeneName, geneName, geneSize, setChromosome3DExampleData, setGeneSize, formatNumber, cellLineList, setChromosome3DCellLineName, removeComparisonHeatmap, setSelectedSphereLists, isExampleMode, fetchExistChromos3DData, exampleDataSet, progressPolling, updateComparisonHeatmapCellLine, comparisonHeatmapUpdateTrigger, setChromosome3DComponents, setChromosome3DComponentIndex, comparisonHeatmapList, isBintuMode = false, bintuId = null, bintuStep = 30000,
    // Bintu control props
    selectedBintuCluster, setSelectedBintuCluster, tempBintuCellId, setTempBintuCellId, handleBintuHeatmapSubmit, bintuCellClusters = [], bintuHeatmapLoading = false, onCloseBintuHeatmap,
    // GSE control props
    isGseMode = false, gseId = null, selectedGseCellLine, setSelectedGseCellLine, selectedGseCell, setSelectedGseCell, selectedGseChrid, setSelectedGseChrid, gseCellLines = [], gseCellIds = [], gseChrIds = [], tempGseCellLineId, setTempGseCellLineId, tempGseCellId, setTempGseCellId, tempGseChrId, setTempGseChrId, handleGseHeatmapSubmit, gseHeatmapLoading = false, onCloseGseHeatmap, updateGseHeatmapResolution, gseResolutionValue = '5k',
    // GSE range control props
    gseStartValue = null, setGseStartValue, gseEndValue = null, setGseEndValue }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const brushSvgRef = useRef(null);
    const axisSvgRef = useRef(null);
    const colorScaleRef = useRef(null);
    const drewColorRef = useRef(false); // Track if any colored cell drawn (Bintu/GSE)

    // Title overflow handling: ellipsize when space is insufficient and show full title in tooltip
    const titleRef = useRef(null);

    const [isTitleTruncated, setIsTitleTruncated] = useState(false);
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
    const [bintuSourceRecords, setBintuSourceRecords] = useState([]);
    const [gseSourceRecords, setGseSourceRecords] = useState([]);
    // Local zoom state for GSE mode (since parent setter is a no-op for GSE panels)
    const [localGseSequence, setLocalGseSequence] = useState(currentChromosomeSequence);
    // GSE resolution selector state
    const [gseResolution, setGseResolution] = useState(gseResolutionValue);

    // Keep local GSE zoom in sync when inputs change (e.g., new dataset loaded)
    useEffect(() => {
        if (isGseMode) {
            setLocalGseSequence(currentChromosomeSequence);
        }
    }, [isGseMode, currentChromosomeSequence, chromosomeData]);

    // Use effective sequence depending on mode
    const effectiveSequence = isGseMode ? localGseSequence : currentChromosomeSequence;

    // Sync internal data when Bintu or GSE mode chromosomeData changes
    useEffect(() => {
        if (isBintuMode || isGseMode) {
            setIndependentHeatmapData(chromosomeData || []);
        }
    }, [chromosomeData, isBintuMode, isGseMode]);

    // Show notification for GSE mode when data is loaded
    useEffect(() => {
        if (isGseMode && chromosomeData && chromosomeData.length > 0) {
            // Use setTimeout to ensure the notification appears immediately after data is set
            const timeoutId = setTimeout(() => {
                notification.info({
                    message: 'GSE Heatmap Loaded',
                    description: 'Zoom in by dragging over the area you\'d like to explore.',
                    duration: 6,
                    style: {
                        zIndex: 9999
                    },
                    placement: 'topLeft',
                    pauseOnHover: true,
                    showProgress: true
                });
            }, 0);

            return () => clearTimeout(timeoutId);
        }
    }, [isGseMode, chromosomeData]);

    // Sync cell line name for GSE and Bintu modes
    useEffect(() => {
        if ((isBintuMode || isGseMode) && cellLineName && !comparisonHeatmapId) {
            setIndependentHeatmapCellLine(cellLineName);
        }
    }, [cellLineName, isBintuMode, isGseMode, comparisonHeatmapId]);

    // Set appropriate colorScaleRange for Bintu and GSE modes
    useEffect(() => {
        if (isBintuMode && independentHeatmapData && independentHeatmapData.length > 0) {
            // Default Bintu color scale upper bound to 800
            setColorScaleRange([0, 800]);
        } else if (isGseMode && independentHeatmapData && independentHeatmapData.length > 0) {
            // GSE is binary; keep [0,1]
            setColorScaleRange([0, 1]);
        } else if (!isBintuMode && !isGseMode && colorScaleRange[1] > 200) {
            // Reset to default non-Bintu/GSE range if switching modes
            setColorScaleRange([0, fqRawcMode ? 0.3 : 30]);
        }
    }, [isBintuMode, isGseMode, independentHeatmapData, fqRawcMode]);

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

    // Keep UI overlay (icons) aligned with the heatmap drawing area
    // Must match the margins used in the drawing effect below
    const HEATMAP_MARGINS = { top: 45, right: 20, bottom: 40, left: 60 };

    const download = async () => {
        if (!independentHeatmapData || independentHeatmapData.length === 0) return;

        if (isGseMode) {
            // For GSE mode, download CSV from Backend/GSE folder via API
            try {
                if (!selectedGseCellLine || !selectedGseCell) {
                    alert('Please complete GSE cell line and cell ID selections first.');
                    return;
                }
                const params = new URLSearchParams({
                    cell_line: selectedGseCellLine,
                    resolution: gseResolution,
                    cell_id: selectedGseCell
                });
                const res = await fetch(`/api/downloadGseCSV?${params.toString()}`);
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    const msg = errorData.error || 'Failed to download GSE CSV';
                    throw new Error(msg);
                }
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${selectedGseCellLine}_${gseResolution}_${selectedGseCell}.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            } catch (e) {
                console.error(e);
                alert('Download failed: ' + (e?.message || 'Unknown error'));
            }
            return;
        }

        if (isBintuMode) {
            // For Bintu mode, download the pre-generated CSV from Backend/Bintu folder via API
            try {
                if (!selectedBintuCluster) {
                    alert('Please select a Bintu dataset first.');
                    return;
                }
                const [cell_line, chrid, startStr, endStr] = selectedBintuCluster.split('_');
                const start_value = parseInt(startStr, 10);
                const end_value = parseInt(endStr, 10);
                const params = new URLSearchParams({ cell_line, chrid, start_value, end_value });
                const res = await fetch(`/api/downloadBintuCSV?${params.toString()}`);
                if (!res.ok) {
                    const msg = await res.text();
                    throw new Error(msg || 'Failed to download Bintu CSV');
                }
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${cell_line}_${chrid}-${Math.floor(start_value / 1e6)}-${Math.floor(end_value / 1e6)}Mb.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            } catch (e) {
                console.error(e);
                alert('Download failed: ' + (e?.message || 'Unknown error'));
            }
            return;
        }

        // Original non-Bintu/GSE download behavior: significant interactions CSV
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

    // Handle GSE resolution change
    const handleGseResolutionChange = (value) => {
        setGseResolution(value);
        // Update the parent state if the function is provided
        if (updateGseHeatmapResolution && gseId) {
            updateGseHeatmapResolution(gseId, value);
        }
    };

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

    // Load minimal Bintu/GSE metadata on demand
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                if (isBintuMode) {
                    const res = await fetch('/bintu_source.json');
                    const json = await res.json();
                    if (!cancelled) setBintuSourceRecords(Array.isArray(json) ? json : []);
                }
            } catch (e) {
                if (!cancelled) setBintuSourceRecords([]);
            }
            try {
                if (isGseMode) {
                    const res = await fetch('/gse_source.json');
                    const json = await res.json();
                    if (!cancelled) setGseSourceRecords(Array.isArray(json) ? json : []);
                }
            } catch (e) {
                if (!cancelled) setGseSourceRecords([]);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [isBintuMode, isGseMode]);

    const matchedSource = React.useMemo(() => {
        // Prefer Bintu metadata when in Bintu mode
        if (isBintuMode && bintuSourceRecords.length) {
            // Use explicit bintuId if provided; otherwise derive from selectedBintuCluster
            const deriveBintuId = () => {
                if (!selectedBintuCluster) return null;
                // Expect pattern: CELL_chrXX_start_end
                const parts = String(selectedBintuCluster).split('_');
                if (parts.length >= 4) {
                    const cell = parts[0];
                    const chr = parts[1];
                    const s = parseInt(parts[2], 10);
                    const e = parseInt(parts[3], 10);
                    if (!isNaN(s) && !isNaN(e)) {
                        const sMb = Math.floor(s / 1e6);
                        const eMb = Math.floor(e / 1e6);
                        return `${cell}_${chr}-${sMb}-${eMb}Mb`;
                    }
                }
                return null;
            };
            const candidateIds = [bintuId, deriveBintuId()].filter(Boolean);
            for (const cid of candidateIds) {
                const rec = bintuSourceRecords.find(r => String(r.id).toLowerCase() === String(cid).toLowerCase());
                if (rec) return rec;
            }
        }

        // Prefer GSE metadata when in GSE mode
        if (isGseMode && gseSourceRecords.length) {
            const candidateIds = [gseId].filter(Boolean);

            // Try exact id match first
            for (const cid of candidateIds) {
                const rec = gseSourceRecords.find(r => String(r.id).toLowerCase() === String(cid).toLowerCase());
                if (rec) return rec;
            }

            // Fallback: prefix by selectedGseCellLine_
            if (selectedGseCellLine) {
                const targetPrefix = String(selectedGseCellLine).trim().toLowerCase() + '_';
                const rec = gseSourceRecords.find(r => {
                    const recordId = String(r.id).trim().toLowerCase();

                    return recordId.startsWith(targetPrefix);
                });

                if (rec) return rec;

                // Additional fallback: try exact match without case sensitivity
                const exactRec = gseSourceRecords.find(r =>
                    String(r.id).trim().toLowerCase() === String(selectedGseCellLine).trim().toLowerCase()
                );
                if (exactRec) {
                    return exactRec;
                }
            }
        }

        // Fallback to existing non-random Hi-C source matching
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
    }, [isBintuMode, isGseMode, bintuId, gseId, selectedBintuCluster, selectedGseCellLine, bintuSourceRecords, gseSourceRecords, sourceRecords, chromosomeName, independentHeatmapCellLine, cellLineName]);

    useEffect(() => {
        if ((!containerSize.width && !containerSize.height) || independentHeatmapData.length === 0) return;

        const parentWidth = containerSize.width;
        const parentHeight = containerSize.height;
        const margin = HEATMAP_MARGINS;

        // Account for space needed by left legend and right controls
        const leftLegendWidth = !isGseMode ? 80 : 0; // Space for left legend (only for non-GSE modes)
        const rightControlsWidth = !isGseMode ? 120 : 0; // Space for right slider and input controls (only for non-GSE modes)

        // Calculate available space for heatmap after accounting for legends and controls
        const availableWidth = parentWidth - leftLegendWidth - rightControlsWidth;
        const availableHeight = parentHeight;

        const adjustedMinDimension = Math.min(availableWidth, availableHeight);
        setMinDimension(adjustedMinDimension);
        const width = adjustedMinDimension - margin.left - margin.right;
        const height = adjustedMinDimension - margin.top - margin.bottom;

        const zoomedChromosomeData = independentHeatmapData.filter(item => {
            if (isBintuMode) {
                const { x, y } = item;
                return x >= effectiveSequence.start && x <= effectiveSequence.end &&
                    y >= effectiveSequence.start && y <= effectiveSequence.end;
            } else if (isGseMode) {
                // In GSE mode, honor the brushed zoom region just like non-random HiC
                const { x, y } = item;
                return x >= effectiveSequence.start && x <= effectiveSequence.end &&
                    y >= effectiveSequence.start && y <= effectiveSequence.end;
            } else {
                const { ibp, jbp } = item;
                return ibp >= effectiveSequence.start && ibp <= effectiveSequence.end &&
                    jbp >= effectiveSequence.start && jbp <= effectiveSequence.end;
            }
        });

        setCurrentChromosomeData(zoomedChromosomeData);

        // Draw canvas
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        canvas.width = width + margin.left + margin.right;
        canvas.height = height + margin.top + margin.bottom;

        context.clearRect(0, 0, canvas.width, canvas.height);

        const { start, end } = effectiveSequence;
        const step = isBintuMode ? bintuStep : (isGseMode ? 5000 : 5000);

        // Use shared axis utilities for consistency with gene list
        const axisValues = calculateAxisValues(effectiveSequence, step, isBintuMode || isGseMode, zoomedChromosomeData);

        const xScale = d3.scaleBand()
            .domain(axisValues)
            .range([0, width])
            .padding(0.1);

        const yScale = d3.scaleBand()
            .domain(axisValues)
            .range([height, 0])
            .padding(0.1);

        // Color scale setup
        let legendDomain;
        let colorScale;
        if (isGseMode) {
            // GSE mode uses binary colors: white for 0, red for 1
            legendDomain = [0, 1];
            colorScale = (value) => {
                return value === 1 ? '#d73027' : '#ffffff'; // Red for 1, white for 0
            };
        } else if (isBintuMode) {
            // Bintu mode: reverse color scale - larger distances = lighter colors
            const redInterpolator = t => d3.interpolateReds((1 - t) * 0.8 + 0.2);
            legendDomain = colorScaleRange;
            colorScale = d3.scaleSequential(redInterpolator).domain(colorScaleRange);
        } else {
            // Regular mode with sequential red scale
            const redInterpolator = t => d3.interpolateReds(t * 0.8 + 0.2);
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
        } else if (isGseMode) {
            // For GSE mode, normalize fq values: >1 becomes 1, <=1 becomes 0, then use x/y from backend and 'value' holds fq
            zoomedChromosomeData.forEach(d => {
                const normalizedValue = d.value > 1 ? 1 : 0;
                dataMap.set(`X:${d.x}, Y:${d.y}`, { value: normalizedValue });
                dataMap.set(`X:${d.y}, Y:${d.x}`, { value: normalizedValue }); // Symmetrical
            });
        } else {
            // For regular mode, use the existing fq/fdr/rawc mapping
            zoomedChromosomeData.forEach(d => {
                dataMap.set(`X:${d.ibp}, Y:${d.jbp}`, { fq: d.fq, fdr: d.fdr, rawc: d.rawc });
                dataMap.set(`X:${d.jbp}, Y:${d.ibp}`, { fq: d.fq, fdr: d.fdr, rawc: d.rawc });
            });
        }

        const hasData = (ibp, jbp) => {
            if (isBintuMode || isGseMode) {
                // For Bintu and GSE modes, check if we have actual data at these positions
                return dataMap.has(`X:${ibp}, Y:${jbp}`) || dataMap.has(`X:${jbp}, Y:${ibp}`);
            } else {
                // For regular mode, check if positions are in valid ranges
                const inRange = totalChromosomeSequences.some(seq =>
                    ibp >= seq.start && ibp <= seq.end &&
                    jbp >= seq.start && jbp <= seq.end
                );
                return inRange;
            }
        };

        // Draw heatmap using Canvas
        // Optimize sparse modes (Bintu/GSE): only draw existing data points, not N^2 grid.
        drewColorRef.current = false;
        if (isBintuMode || isGseMode) {
            const bwX = xScale.bandwidth();
            const bwY = yScale.bandwidth();
            for (const d of zoomedChromosomeData) {
                const xKey = d.x;
                const yKey = d.y;
                // For GSE mode, use normalized binary value; for Bintu, use original value
                const value = isGseMode ? (d.value > 1 ? 1 : 0) : d.value;
                const xs = xScale(xKey);
                const ys = yScale(yKey);
                if ((xs || xs === 0) && (ys || ys === 0)) {
                    // Negative values should render white in Bintu; GSE 0 renders white
                    let fillColor;
                    if (isGseMode) {
                        fillColor = value === 1 ? colorScale(1) : '#ffffff';
                    } else { // Bintu mode
                        fillColor = (typeof value === 'number' && value >= 0) ? colorScale(value) : '#ffffff';
                    }
                    context.fillStyle = fillColor;
                    context.fillRect(margin.left + xs, margin.top + ys, bwX, bwY);
                    drewColorRef.current = true;
                }
                // Ensure symmetry without double lookup
                const xs2 = xScale(yKey);
                const ys2 = yScale(xKey);
                if ((xs2 || xs2 === 0) && (ys2 || ys2 === 0)) {
                    let fillColor2;
                    if (isGseMode) {
                        fillColor2 = value === 1 ? colorScale(1) : '#ffffff';
                    } else {
                        fillColor2 = (typeof value === 'number' && value >= 0) ? colorScale(value) : '#ffffff';
                    }
                    context.fillStyle = fillColor2;
                    context.fillRect(margin.left + xs2, margin.top + ys2, bwX, bwY);
                }
            }
            // Optionally, fill empty background lightly to visualize grid (skip for performance)
        } else {
            // Dense regular mode: keep banded grid fill with validity checks
            axisValues.forEach(ibp => {
                axisValues.forEach(jbp => {
                    const x = margin.left + xScale(jbp);
                    const y = margin.top + yScale(ibp);
                    const cellWidth = xScale.bandwidth();
                    const cellHeight = yScale.bandwidth();
                    const { fq, fdr, rawc } = dataMap.get(`X:${ibp}, Y:${jbp}`) || dataMap.get(`X:${jbp}, Y:${ibp}`) || { fq: -1, fdr: -1, rawc: -1 };
                    const fillColor = !hasData(ibp, jbp) ? 'white' : (jbp <= ibp && (fdr > 0.05 || (fdr === -1 && rawc === -1))) ? 'white' : colorScale(fqRawcMode ? fq : rawc);
                    context.fillStyle = fillColor;
                    context.fillRect(x, y, cellWidth, cellHeight);
                });
            });
        }

        const axisSvg = d3.select(axisSvgRef.current)
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);

        axisSvg.selectAll('*').remove();

        // Use shared tick calculation for consistency with gene list
        const sparseMode = isBintuMode || isGseMode;
        const { tickValues: xTickValues } = calculateTickValues(axisValues, width, effectiveSequence, sparseMode);
        const { tickValues: yTickValues } = calculateTickValues(axisValues, height, effectiveSequence, sparseMode);

        // X-axis
        axisSvg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top + height})`)
            .call(d3.axisBottom(xScale)
                .tickValues(xTickValues)
                .tickFormat(formatTickLabel))
            .selectAll("text")
            .style("text-anchor", "end")
            .attr("transform", "rotate(-45)")
            .attr("dx", "-1em")
            .attr("dy", "0em");

        // Y-axis
        axisSvg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`)
            .call(d3.axisLeft(yScale)
                .tickValues(yTickValues)
                .tickFormat(formatTickLabel));

        // Color Scale
        const colorScaleSvg = d3.select(colorScaleRef.current)
            .attr('width', leftLegendWidth)
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

        if (isGseMode) {
            // For GSE mode, create a simple binary gradient: white to red
            gradient.append('stop')
                .attr('offset', '0%')
                .attr('stop-color', '#ffffff'); // White for 0
            gradient.append('stop')
                .attr('offset', '100%')
                .attr('stop-color', '#d73027'); // Red for 1
        } else {
            // For other modes, use the sequential color scale
            for (let i = 0; i <= numStops; i++) {
                const t = i / numStops;
                gradient.append('stop')
                    .attr('offset', `${t * 100}%`)
                    .attr('stop-color', colorScale(gradientMin + t * (gradientMax - gradientMin)));
            }
        }

        const legendXOffset = 12;
        const legendGroup = colorScaleSvg.append('g')
            .attr('transform', `translate(${legendXOffset}, 0)`);

        legendGroup.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', height / 1.2)
            .attr('height', 20)
            .style('fill', 'url(#colorGradient)')
            .attr('transform', `translate(0, ${(parentHeight - height / 1.2) / 2 + height / 1.2}) rotate(-90, 0, 0)`);

        legendGroup.append('text')
            .attr('x', 10)
            .attr('y', height / 1.2 + (parentHeight - height / 1.2) / 2 + 15)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .attr('fill', '#333')
            .text(isBintuMode ? Math.ceil(gradientMax) : ((isBintuMode || isGseMode) ? Math.floor(gradientMin) : gradientMin));

        legendGroup.append('text')
            .attr('x', 10)
            .attr('y', (parentHeight - height / 1.2) / 2 - 5)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .attr('fill', '#333')
            .text(isBintuMode ? Math.floor(gradientMin) : ((isBintuMode || isGseMode) ? Math.ceil(gradientMax) : gradientMax));

        // Brush for selecting range (enabled for non-random HiC and GSE; disabled in Bintu)
        if (!isBintuMode) {
            const brushSvg = d3.select(brushSvgRef.current)
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom);

            brushSvg.selectAll('*').remove();

            const brush = d3.brushX()
                .extent([[margin.left, margin.top], [width + margin.left, height + margin.top]])
                .on('end', (event) => {
                    const { selection } = event;
                    // On clear selection, reset to initial region
                    if (!selection) {
                        if (isGseMode) {
                            setLocalGseSequence(selectedChromosomeSequence);
                        } else {
                            setCurrentChromosomeSequence(selectedChromosomeSequence);
                        }
                        return;
                    }

                    // Apply zoom only after the brush ends
                    const [x0, x1] = selection;
                    const brushedX = axisValues.filter(val => {
                        const pos = margin.left + xScale(val) + xScale.bandwidth() / 2;
                        return pos >= x0 && pos <= x1;
                    });
                    if (brushedX && brushedX.length > 0) {
                        const sorted = [...brushedX].sort((a, b) => a - b);
                        const nextRange = { start: sorted[0], end: sorted[sorted.length - 1] };
                        const cur = isGseMode ? localGseSequence : currentChromosomeSequence;
                        if (nextRange.start !== cur.start || nextRange.end !== cur.end) {
                            if (isGseMode) {
                                setLocalGseSequence(nextRange);
                            } else {
                                setCurrentChromosomeSequence(nextRange);
                            }
                        }
                    }
                });

            brushSvg.append('g')
                .attr('class', 'brush')
                .call(brush);
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
    }, [minDimension, effectiveSequence, geneSize, colorScaleRange, containerSize, independentHeatmapData, fqRawcMode, isBintuMode, isGseMode, localGseSequence]);

    const closeBintuHeatmap = () => {
        // Call the parent component's onCloseBintuHeatmap function if available
        if (onCloseBintuHeatmap) {
            onCloseBintuHeatmap();
        }
    };

    const closeGseHeatmap = () => {
        // Call the parent component's onCloseGseHeatmap function if available
        if (onCloseGseHeatmap) {
            onCloseGseHeatmap();
        }
    };

    // Natural sort for chromosome IDs (chr1..chr22, chrX, chrY, chrM/MT)
    const sortedGseChrIds = React.useMemo(() => {
        if (!Array.isArray(gseChrIds)) return gseChrIds;

        const chrLabelToRank = (label) => {
            const raw = (label ?? '').toString().trim();
            // normalize: remove leading 'chr' and spaces, lower-case
            const norm = raw.toLowerCase().replace(/^chr\s*/i, '').replace(/\s+/g, '');
            if (norm === 'x') return 23;
            if (norm === 'y') return 24;
            if (norm === 'm' || norm === 'mt') return 25;
            const n = parseInt(norm, 10);
            if (!Number.isNaN(n)) return n;
            // Unknown labels go to the end; keep stable order with secondary compare
            return Number.MAX_SAFE_INTEGER;
        };

        const arr = [...gseChrIds];
        arr.sort((a, b) => {
            const aLabel = (a?.label ?? a?.value ?? '').toString();
            const bLabel = (b?.label ?? b?.value ?? '').toString();
            const ra = chrLabelToRank(aLabel);
            const rb = chrLabelToRank(bLabel);
            if (ra !== rb) return ra - rb;
            // Secondary: localeCompare numeric to handle ties consistently
            return aLabel.localeCompare(bLabel, undefined, { numeric: true, sensitivity: 'base' });
        });
        return arr;
    }, [gseChrIds]);

    const getHeaderTitleString = () => {
        // Left label (cellline/source)
        let leftLabel = '';
        if (!comparisonHeatmapId) {
            if (isBintuMode) {
                leftLabel = (selectedBintuCluster ? (selectedBintuCluster.split('_')[0] || 'Bintu') : 'Bintu');
            } else if (isGseMode) {
                leftLabel = selectedGseCellLine ? `${selectedGseCellLine}` : 'Single-cell Hi-C';
            } else {
                leftLabel = independentHeatmapCellLine || cellLineName || '';
            }
        }

        // Whether to show dash and the range
        const showRange = ((!isBintuMode && !isGseMode) ||
            (isBintuMode && selectedBintuCluster && tempBintuCellId) ||
            (isGseMode && selectedGseCellLine && selectedGseCell && selectedGseChrid && chromosomeData && chromosomeData.length > 0));

        let title = '';
        if (!comparisonHeatmapId && leftLabel) {
            title += leftLabel;
            if (showRange) title += ' - ';
        }

        if (showRange) {
            const seq = isGseMode ? localGseSequence : currentChromosomeSequence;
            const startStr = formatNumber(seq?.start ?? 0);
            const endStr = formatNumber(seq?.end ?? 0);
            title += `${chromosomeName} : ${startStr} ~ ${endStr}`;
        }

        return title.trim();
    };

    useEffect(() => {
        const el = titleRef.current;
        if (!el) return;
        const check = () => {
            // Measure overflow to determine truncation state
            const truncated = el.scrollWidth > el.clientWidth;
            setIsTitleTruncated(truncated);
        };
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
        // Re-check when layout-driving deps change
    }, [
        comparisonHeatmapId,
        isBintuMode,
        isGseMode,
        selectedBintuCluster,
        tempBintuCellId,
        selectedGseCellLine,
        selectedGseCell,
        selectedGseChrid,
        chromosomeData,
        chromosomeName,
        currentChromosomeSequence,
        localGseSequence,
        independentHeatmapCellLine,
        cellLineName,
    ]);

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
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
                        <Tooltip
                            title={
                                <div style={{ color: 'black' }}>
                                    {isTitleTruncated && getHeaderTitleString() && (
                                        <div style={{ marginBottom: 6 }}>
                                            <span style={{ fontWeight: 600 }}>{getHeaderTitleString()}</span>
                                        </div>
                                    )}
                                    {matchedSource ? (
                                        <div>
                                            <div>
                                                <span style={{ fontWeight: 600 }}>{matchedSource.id}</span> — {matchedSource.name}
                                            </div>
                                            {(matchedSource.source || matchedSource.Accession) && (
                                                <div>
                                                    {matchedSource.source}
                                                    {matchedSource.source && matchedSource.Accession ? ': ' : ''}
                                                    {matchedSource.Accession}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <span>No metadata found</span>
                                    )}
                                </div>
                            }
                            color='white'
                            placement="bottomLeft"
                            overlayInnerStyle={{ width: 'max-content', whiteSpace: 'nowrap', maxWidth: 'none' }}
                        >
                            <div
                                ref={titleRef}
                                style={{
                                    fontSize: 12,
                                    fontWeight: 'bold',
                                    marginLeft: 10,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    // Ellipsis styles
                                    width: '100%',
                                    minWidth: 0,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {!comparisonHeatmapId && (
                                    <>
                                        <span style={{ marginRight: 3 }}>
                                            {isBintuMode ?
                                                (selectedBintuCluster ?
                                                    selectedBintuCluster.split('_')[0] || 'Bintu'
                                                    : 'Bintu'
                                                )
                                                : isGseMode ?
                                                    (selectedGseCellLine ?
                                                        `${selectedGseCellLine}`
                                                        : 'Single-cell Hi-C'
                                                    )
                                                    : independentHeatmapCellLine || cellLineName
                                            }
                                        </span>
                                        {/* Show dash only when data is available (avoid Bintu pre-load placeholder) */}
                                        {((!isBintuMode && !isGseMode) || (isBintuMode && selectedBintuCluster && tempBintuCellId && independentHeatmapData && independentHeatmapData.length > 0) || (isGseMode && selectedGseCellLine && selectedGseCell && selectedGseChrid && chromosomeData && chromosomeData.length > 0)) && (
                                            <span style={{ marginRight: 3 }}>-</span>
                                        )}
                                    </>
                                )}
                                {/* Show chromosome and range only when data is available (avoid Bintu pre-load placeholder) */}
                                {((!isBintuMode && !isGseMode) || (isBintuMode && selectedBintuCluster && tempBintuCellId && independentHeatmapData && independentHeatmapData.length > 0) || (isGseMode && selectedGseCellLine && selectedGseCell && selectedGseChrid && chromosomeData && chromosomeData.length > 0)) && (
                                    <>
                                        <span style={{ marginRight: 3 }}>{chromosomeName}</span>
                                        <span style={{ marginRight: 3 }}>:</span>
                                        <span style={{ marginRight: 5 }}>{formatNumber((isGseMode ? localGseSequence.start : currentChromosomeSequence.start))}</span>
                                        <span style={{ marginRight: 5 }}>~</span>
                                        <span>{formatNumber((isGseMode ? localGseSequence.end : currentChromosomeSequence.end))}</span>
                                    </>
                                )}
                            </div>
                        </Tooltip>
                    </div>
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexShrink: 0 }}>
                        {!isBintuMode && !isGseMode && (
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
                        {!comparisonHeatmapId && !isBintuMode && !isGseMode && (
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
                        {!isBintuMode && !isGseMode && (
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
                        {!isBintuMode && !isGseMode && (
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
                        {isGseMode && (
                            <Tooltip
                                title={<span style={{ color: 'black' }}>Restore full sequence range</span>}
                                color='white'
                            >
                                <Button
                                    size='small'
                                    style={{
                                        fontSize: 12,
                                        cursor: (gseHeatmapLoading || independentHeatmapLoading || !independentHeatmapData || independentHeatmapData.length === 0) ? 'not-allowed' : 'pointer',
                                    }}
                                    disabled={gseHeatmapLoading || independentHeatmapLoading || !independentHeatmapData || independentHeatmapData.length === 0}
                                    icon={<RollbackOutlined />}
                                    onClick={() => setLocalGseSequence(selectedChromosomeSequence)}
                                />
                            </Tooltip>
                        )}
                        <Tooltip
                            title={<span style={{ color: 'black' }}>
                                {isBintuMode ? 'Download Bintu CSV' :
                                    isGseMode ? 'Download GSE CSV' :
                                        'Download non-random interaction data'}
                            </span>}
                            color='white'
                        >
                            <Button
                                size='small'
                                disabled={independentHeatmapLoading || !independentHeatmapData || independentHeatmapData.length === 0}
                                style={{
                                    fontSize: 12,
                                    cursor: independentHeatmapLoading || !independentHeatmapData || independentHeatmapData.length === 0 ? 'not-allowed' : 'pointer',
                                }}
                                icon={<DownloadOutlined />}
                                onClick={download}
                            />
                        </Tooltip>
                        {isBintuMode && (
                            <>
                                <Select
                                    placeholder="Bintu Datasets"
                                    size='small'
                                    style={{ width: 150 }}
                                    value={selectedBintuCluster}
                                    onChange={setSelectedBintuCluster}
                                    options={bintuCellClusters}
                                    optionFilterProp='label'
                                    optionRender={(option) => (
                                        <Tooltip title={<span style={{ color: 'black' }}>{option.label}</span>} color='white' placement="right">
                                            <div>{option.label}</div>
                                        </Tooltip>
                                    )}
                                />
                                <InputNumber
                                    size='small'
                                    style={{ width: 60 }}
                                    min={1}
                                    placeholder='Cell ID'
                                    value={tempBintuCellId}
                                    onChange={setTempBintuCellId}
                                />
                                <Tooltip title={<span style={{ color: 'black' }}>Close this heatmap</span>} color='white'>
                                    <Button
                                        size='small'
                                        style={{
                                            fontSize: 12,
                                            cursor: 'pointer',
                                        }}
                                        icon={<MinusOutlined />}
                                        onClick={closeBintuHeatmap}
                                    />
                                </Tooltip>
                                <Button
                                    color='primary'
                                    size='small'
                                    variant="outlined"
                                    style={{ marginRight: 5 }}
                                    disabled={!selectedBintuCluster || !tempBintuCellId}
                                    loading={bintuHeatmapLoading}
                                    onClick={handleBintuHeatmapSubmit}
                                >Load</Button>
                            </>
                        )}
                        {isGseMode && (
                            <>
                                <Popover
                                    content={
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '200px' }}>
                                            <div>
                                                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>Cell line:</label>
                                                <Select
                                                    placeholder="Cell line"
                                                    size='small'
                                                    style={{ width: '100%' }}
                                                    value={selectedGseCellLine}
                                                    onChange={setSelectedGseCellLine}
                                                    options={gseCellLines}
                                                    optionFilterProp='label'
                                                    optionRender={(option) => (
                                                        <Tooltip title={<span style={{ color: 'black' }}>{option.label}</span>} color='white' placement="right">
                                                            <div>{option.label}</div>
                                                        </Tooltip>
                                                    )}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>Resolution:</label>
                                                <Select
                                                    placeholder="Resolution"
                                                    size='small'
                                                    style={{ width: '100%' }}
                                                    value={gseResolution}
                                                    onChange={handleGseResolutionChange}
                                                    options={[
                                                        { label: '5 kb', value: '5000' },
                                                        { label: '50 kb', value: '50000' },
                                                        { label: '100 kb', value: '100000' }
                                                    ]}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>Cell ID:</label>
                                                <Select
                                                    placeholder="Cell ID"
                                                    size='small'
                                                    style={{ width: '100%' }}
                                                    value={selectedGseCell}
                                                    onChange={setSelectedGseCell}
                                                    options={gseCellIds}
                                                    optionFilterProp='label'
                                                    optionRender={(option) => (
                                                        <Tooltip title={<span style={{ color: 'black' }}>{option.label}</span>} color='white' placement="right">
                                                            <div>{option.label}</div>
                                                        </Tooltip>
                                                    )}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>Chr ID:</label>
                                                <Select
                                                    placeholder="Chr ID"
                                                    size='small'
                                                    style={{ width: '100%' }}
                                                    value={selectedGseChrid}
                                                    onChange={setSelectedGseChrid}
                                                    options={sortedGseChrIds}
                                                    optionFilterProp='label'
                                                    optionRender={(option) => (
                                                        <Tooltip title={<span style={{ color: 'black' }}>{option.label}</span>} color='white' placement="right">
                                                            <div>{option.label}</div>
                                                        </Tooltip>
                                                    )}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', gap: '4px', alignItems: 'end' }}>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>Start:</label>
                                                    <InputNumber
                                                        placeholder="Start(Optional)"
                                                        size='small'
                                                        style={{ width: '100%' }}
                                                        value={gseStartValue}
                                                        onChange={setGseStartValue}
                                                        min={0}
                                                        max={300000000}
                                                        step={5000}
                                                    />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>End:</label>
                                                    <InputNumber
                                                        placeholder="End(Optional)"
                                                        size='small'
                                                        style={{ width: '100%' }}
                                                        value={gseEndValue}
                                                        onChange={setGseEndValue}
                                                        min={0}
                                                        max={300000000}
                                                        step={5000}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    }
                                    trigger="click"
                                    placement="bottomRight"
                                >
                                    <Button
                                        size='small'
                                        style={{
                                            fontSize: 12,
                                            cursor: 'pointer',
                                        }}
                                        icon={<UnorderedListOutlined />}
                                    />
                                </Popover>
                                <Tooltip title={<span style={{ color: 'black' }}>Close this heatmap</span>} color='white'>
                                    <Button
                                        size='small'
                                        style={{
                                            fontSize: 12,
                                            cursor: 'pointer',
                                        }}
                                        icon={<MinusOutlined />}
                                        onClick={closeGseHeatmap}
                                    />
                                </Tooltip>
                                <Button
                                    color='primary'
                                    size='small'
                                    variant="outlined"
                                    style={{ marginRight: 5 }}
                                    disabled={!selectedGseCellLine || !selectedGseCell || !selectedGseChrid || (gseStartValue && gseEndValue && gseStartValue >= gseEndValue)}
                                    loading={gseHeatmapLoading}
                                    onClick={handleGseHeatmapSubmit}
                                >Load</Button>
                            </>
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
                        {!isBintuMode && !isGseMode && (
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
                            <canvas ref={canvasRef} style={{
                                position: 'absolute',
                                zIndex: 0,
                                left: !isGseMode ? '80px' : '50%',
                                top: '50%',
                                transform: !isGseMode ? 'translate(0%, -50%)' : 'translate(-50%, -50%)'
                            }} />
                            <svg ref={axisSvgRef} style={{
                                position: 'absolute',
                                zIndex: 1,
                                pointerEvents: 'none',
                                left: !isGseMode ? '80px' : '50%',
                                top: '50%',
                                transform: !isGseMode ? 'translate(0%, -50%)' : 'translate(-50%, -50%)'
                            }} />
                            {(!isBintuMode) && (
                                <svg ref={brushSvgRef} style={{
                                    position: 'absolute',
                                    zIndex: 2,
                                    pointerEvents: 'all',
                                    left: !isGseMode ? '80px' : '50%',
                                    top: '50%',
                                    transform: !isGseMode ? 'translate(0%, -50%)' : 'translate(-50%, -50%)'
                                }} />
                            )}
                            {!isGseMode && (
                                <svg
                                    ref={colorScaleRef}
                                    style={{
                                        position: 'absolute',
                                        left: '10px',
                                        top: '50%',
                                        transform: 'translate(0%, -50%)',
                                        zIndex: 0,
                                        pointerEvents: 'none'
                                    }}
                                />
                            )}

                            {!isGseMode && (
                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '5px',
                                        width: '100px',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        position: 'absolute',
                                        right: '10px',
                                        top: '50%',
                                        transform: 'translate(0%, -50%)',
                                    }}
                                >
                                    <InputNumber
                                        size='small'
                                        style={{ width: 60 }}
                                        controls={false}
                                        value={colorScaleRange[1]}
                                        min={0}
                                        max={isBintuMode ?
                                            Math.ceil(d3.max(currentChromosomeData, d => d.value) || 1000) :
                                            (fqRawcMode ? 1 : 200)
                                        }
                                        onChange={changeColorByInput("max")}
                                    />
                                    <Slider
                                        range={{ draggableTrack: true }}
                                        vertical
                                        style={{ height: 200 }}
                                        min={0}
                                        max={isBintuMode ?
                                            Math.ceil(d3.max(currentChromosomeData, d => d.value) || 1000) :
                                            (fqRawcMode ? 1 : 200)
                                        }
                                        step={isBintuMode ? 1 : (fqRawcMode ? 0.1 : 1)}
                                        onChange={changeColorScale}
                                        value={colorScaleRange}
                                        tooltip={{
                                            formatter: (value) => isBintuMode ? Math.round(value) : value,
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
                                        max={isBintuMode ?
                                            Math.ceil(d3.max(currentChromosomeData, d => d.value) || 1000) :
                                            (fqRawcMode ? 1 : 200)
                                        }
                                        onChange={changeColorByInput("min")}
                                    />
                                </div>
                            )}
                            {!isBintuMode && !isGseMode && (
                                // Overlay sized and positioned exactly like the heatmap canvas
                                <div
                                    style={{
                                        position: 'absolute',
                                        zIndex: 3,
                                        pointerEvents: 'none',
                                        left: !isGseMode ? '80px' : '50%',
                                        top: '50%',
                                        transform: !isGseMode ? 'translate(0%, -50%)' : 'translate(-50%, -50%)',
                                        width: `${minDimension}px`,
                                        height: `${minDimension}px`,
                                    }}
                                >
                                    {/* Top-left corner inside the plot area (accounting for margins) */}
                                    <LaptopOutlined
                                        style={{
                                            position: 'absolute',
                                            top: `${HEATMAP_MARGINS.top + 5}px`,
                                            left: `${HEATMAP_MARGINS.left + 5}px`,
                                            fontSize: 15,
                                            border: '1px solid #999',
                                            borderRadius: 5,
                                            padding: 5,
                                            background: 'white',
                                        }}
                                    />
                                    {/* Bottom-right corner inside the plot area (accounting for margins) */}
                                    <ExperimentOutlined
                                        style={{
                                            position: 'absolute',
                                            bottom: `${HEATMAP_MARGINS.bottom + 5}px`,
                                            right: `${HEATMAP_MARGINS.right + 5}px`,
                                            fontSize: 15,
                                            border: '1px solid #999',
                                            borderRadius: 5,
                                            padding: 5,
                                            background: 'white',
                                        }}
                                    />
                                </div>
                            )}

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
                    currentChromosomeSequence={isGseMode ? localGseSequence : currentChromosomeSequence}
                    minDimension={minDimension}
                    geneName={geneName}
                    setCurrentChromosomeSequence={setCurrentChromosomeSequence}
                    setGeneName={setGeneName}
                    setGeneSize={setGeneSize}
                    // Use Bintu step size if in Bintu mode, GSE uses 5000 step
                    step={isBintuMode ? bintuStep : 5000}
                    // Pass Bintu-specific parameters for proper axis alignment
                    isBintuMode={isBintuMode || isGseMode}
                    zoomedChromosomeData={currentChromosomeData}
                    // Pass offset for proper alignment with heatmap
                    // GSE mode: no offset (centered), Bintu and Regular mode: 80px offset (left-aligned)
                    leftOffset={isGseMode ? 0 : 80}
                    // Pass GSE mode flag for proper coordinate system alignment
                    isGseMode={isGseMode}
                />
            )}
        </div>
    );
};
