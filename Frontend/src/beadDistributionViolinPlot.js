import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Spin, Empty, Dropdown, Tooltip, Button, Modal } from 'antd';
import { DownloadOutlined, ExpandOutlined } from "@ant-design/icons";
import jsPDF from 'jspdf';
import * as d3 from 'd3';

export const BeadDistributionViolinPlot = ({ distributionData, selectedSphereList, loading, chromosomeName, currentChromosomeSequence, cellLineName }) => {
    const containerRef = useRef();
    const svgRef = useRef();
    const modalSvgRef = useRef();
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);
    const [modalDimensions, setModalDimensions] = useState({ width: 1000, height: 600 });
    const [pValuesByCategory, setPValuesByCategory] = useState({});
    const [pLoading, setPLoading] = useState(false);

    // Calculate bead information for display
    const beadInfo = useMemo(() => {
        if (!chromosomeName || !currentChromosomeSequence || Object.keys(selectedSphereList).length === 0) {
            return null;
        }

        const step = 5000; // Each bead represents a 5000bp range
        const newStart = currentChromosomeSequence.start;
        const beadIndices = Object.keys(selectedSphereList).map(key => parseInt(key)).sort((a, b) => a - b);

        // Calculate each bead's individual range
        const beadRanges = beadIndices.map(index => {
            const startCoord = newStart + index * step;
            const endCoord = startCoord + step;
            return { index, startCoord, endCoord };
        });

        return {
            chromosome: chromosomeName,
            beadRanges: beadRanges
        };
    }, [chromosomeName, currentChromosomeSequence, selectedSphereList]);

    const downloadItems = [
        {
            key: '1',
            label: 'Download PNG',
        },
        {
            key: '2',
            label: 'Download PDF',
        }
    ]

    const showModal = () => {
        setIsModalVisible(true);
        setModalLoading(true);
    };

    const handleModalCancel = () => {
        setIsModalVisible(false);
        setModalLoading(false);
    };

    const handleModalAfterOpen = () => {
        // Draw the plot after the modal is fully opened
        if (modalSvgRef.current) {
            // Get the actual container dimensions to ensure consistency
            const modalContainer = modalSvgRef.current.parentElement;
            const modalWidth = modalContainer ? modalContainer.clientWidth : 1000;
            const modalHeight = modalContainer ? modalContainer.clientHeight : 600;
            
            // Update modal dimensions state
            setModalDimensions({ width: modalWidth, height: modalHeight });
            
            drawViolinPlot(modalSvgRef.current, modalWidth, modalHeight, true);
            // Turn off loading after plot is drawn
            setTimeout(() => {
                setModalLoading(false);
            }, 100);
        }
    };

    const onClickDownloadItem = ({ key }) => {
        if (key === '1') {
            downloadImage();
        }

        if (key === '2') {
            downloadPDF();
        }
    }

    const downloadImage = () => {
        const svgElement = svgRef.current;
        if (!svgElement) return;

        const scaleFactor = 5
        const width = svgElement.clientWidth;
        const height = svgElement.clientHeight;

        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgElement);
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);

        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = width * scaleFactor;
            canvas.height = height * scaleFactor;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.setTransform(scaleFactor, 0, 0, scaleFactor, 0, 0);
            ctx.drawImage(image, 0, 0);

            canvas.toBlob(blob => {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "violin_plot.png";
                a.click();
                URL.revokeObjectURL(url);
            }, "image/png");
        };
        image.src = url;
    };


    const downloadPDF = () => {
        const svgElement = svgRef.current;
        if (!svgElement) return;

        const scaleFactor = 5;
        const width = svgElement.clientWidth;
        const height = svgElement.clientHeight;

        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgElement);
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);

        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = width * scaleFactor;
            canvas.height = height * scaleFactor;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.setTransform(scaleFactor, 0, 0, scaleFactor, 0, 0);
            ctx.drawImage(image, 0, 0);

            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF({
                orientation: width > height ? 'landscape' : 'portrait',
                unit: 'px',
                format: [width, height]
            });
            pdf.addImage(imgData, 'PNG', 0, 0, width, height);
            pdf.save("violin_plot.pdf");
            URL.revokeObjectURL(url);
        };
        image.src = url;
    };

    const downloadModalImage = () => {
        const svgElement = modalSvgRef.current;
        if (!svgElement) return;

        const scaleFactor = 5
        const width = svgElement.clientWidth;
        const height = svgElement.clientHeight;

        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgElement);
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);

        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = width * scaleFactor;
            canvas.height = height * scaleFactor;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.setTransform(scaleFactor, 0, 0, scaleFactor, 0, 0);
            ctx.drawImage(image, 0, 0);

            canvas.toBlob(blob => {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "violin_plot_modal.png";
                a.click();
                URL.revokeObjectURL(url);
            }, "image/png");
        };
        image.src = url;
    };

    const downloadModalPDF = () => {
        const svgElement = modalSvgRef.current;
        if (!svgElement) return;

        const scaleFactor = 5;
        const width = svgElement.clientWidth;
        const height = svgElement.clientHeight;

        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgElement);
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);

        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = width * scaleFactor;
            canvas.height = height * scaleFactor;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.setTransform(scaleFactor, 0, 0, scaleFactor, 0, 0);
            ctx.drawImage(image, 0, 0);

            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF({
                orientation: width > height ? 'landscape' : 'portrait',
                unit: 'px',
                format: [width, height]
            });
            pdf.addImage(imgData, 'PNG', 0, 0, width, height);
            pdf.save("violin_plot_modal.pdf");
            URL.revokeObjectURL(url);
        };
        image.src = url;
    };

    const onClickModalDownloadItem = ({ key }) => {
        if (key === '1') {
            downloadModalImage();
        }

        if (key === '2') {
            downloadModalPDF();
        }
    };

    // Fetch p-values from backend when we have multiple groups
    useEffect(() => {
        const distKeys = Object.keys(distributionData || {});
        if (distKeys.length < 2) {
            setPValuesByCategory({});
            return;
        }
        setPLoading(true);
        // Sanitize payload (ensure arrays of numbers)
        const payload = {};
        distKeys.forEach(g => {
            payload[g] = {};
            const cats = distributionData[g] || {};
            Object.keys(cats).forEach(cat => {
                const arr = Array.isArray(cats[cat]) ? cats[cat].filter(v => Number.isFinite(v)) : [];
                payload[g][cat] = arr;
            });
        });

        fetch('/api/getBeadDistributionPValues', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(res => res.json())
            .then(data => {
                setPValuesByCategory(data || {});
                setPLoading(false);
            })
            .catch(() => {
                setPValuesByCategory({});
                setPLoading(false);
            });
    }, [distributionData]);

    const drawViolinPlot = (svgElement, plotWidth, plotHeight, isModal = false) => {
        if (
            !plotWidth ||
            !plotHeight ||
            Object.keys(selectedSphereList).length < 1 ||
            Object.keys(distributionData).length === 0 ||
            loading
        )
            return;

        d3.select(svgElement).selectAll("*").remove();

        const svg = d3.select(svgElement)
            .attr("width", plotWidth)
            .attr("height", plotHeight);

        // distributionData 的 keys
        const distKeys = Object.keys(distributionData);
        if (distKeys.length === 0) return;
        const categories = Object.keys(distributionData[distKeys[0]])
            .sort((a, b) => {
                // Convert to numbers for proper numerical sorting
                const numA = parseInt(a, 10);
                const numB = parseInt(b, 10);
                return numA - numB;
            });

        // Calculate dynamic bottom margin for non-modal based on number of categories
        const categoryCount = categories.length;
        const needsRotatedLabels = !isModal && categoryCount > 6;
        const dynamicBottomMargin = !isModal ? 
            (needsRotatedLabels ? 60 : Math.max(40, categoryCount * 2 + 25)) : 100;
        
        const margin = isModal
            ? { top: 30, right: 30, bottom: 100, left: 60 }
            : { top: 20, right: 20, bottom: dynamicBottomMargin, left: 45 },
            width = plotWidth - margin.left - margin.right,
            height = plotHeight - margin.top - margin.bottom;

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Use consistent padding for both main and modal views
        const padding = isModal ? 0.15 : 0.2;
        const xScale = d3.scaleBand()
            .domain(categories)
            .range([0, width])
            .padding(padding);

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

        // Create unique clip path ID to avoid conflicts between main and modal plots
        const clipId = `clip-${Math.random().toString(36).substr(2, 9)}`;
        g.append("clipPath")
            .attr("id", clipId)
            .append("rect")
            .attr("width", violinWidth)
            .attr("height", height);

        // violin plot
        categories.forEach(category => {
            const categoryGroup = g.append("g")
                .attr("transform", `translate(${xScale(category)},0)`)
                .attr("clip-path", `url(#${clipId})`);

            distKeys.forEach((cellLine, keyIndex) => {
                const dataArray = distributionData[cellLine][category] || [];
                if (!Array.isArray(dataArray) || dataArray.length === 0) return;

                const density = densitiesByCategory[category][cellLine];
                if (!density) return;

                const center = keyIndex * segmentWidth + segmentWidth / 2;

                const area = d3.area()
                    .curve(d3.curveCatmullRom)
                    .x0(d => (center - halfWidthScale(d[1])))
                    .x1(d => (center + halfWidthScale(d[1])))
                    .y(d => yScale(d[0]));

                categoryGroup.append("path")
                    .datum(density)
                    .attr("fill", colorScale(cellLine))
                    .attr("stroke", "none")
                    .attr("opacity", 0.7)
                    .attr("d", area);

                // median line
                const median = d3.median(dataArray);
                if (median !== undefined) {
                    const bisect = d3.bisector(d => d[0]).left;
                    const i = bisect(density, median);
                    let medianDensity;
                    if (i === 0) {
                        medianDensity = density[0][1];
                    } else if (i >= density.length) {
                        medianDensity = density[density.length - 1][1];
                    } else {
                        const d0 = density[i - 1];
                        const d1 = density[i];
                        const t = (median - d0[0]) / (d1[0] - d0[0]);
                        medianDensity = d0[1] + t * (d1[1] - d0[1]);
                    }
                    const lineHalfLength = halfWidthScale(medianDensity);
                    const x1 = center - lineHalfLength;
                    const x2 = center + lineHalfLength;
                    const yMedian = yScale(median);
                    categoryGroup.append("line")
                        .attr("x1", x1)
                        .attr("x2", x2)
                        .attr("y1", yMedian)
                        .attr("y2", yMedian)
                        .attr("stroke", "#333")
                        .attr("stroke-width", 2);
                }
            });
        });

        const xAxis = d3.axisBottom(xScale);
        const yAxis = d3.axisLeft(yScale).ticks(5);

        // Apply axis with styling based on modal state
        const xAxisGroup = g.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(xAxis);

        const yAxisGroup = g.append("g")
            .call(yAxis);

        // Style axis text based on modal state and category count
        const axisFontSize = isModal ? "18px" : "12px";
        const xAxisText = xAxisGroup.selectAll("text");
        
        if (needsRotatedLabels) {
            // Rotate x-axis labels for better readability when there are many categories
            xAxisText
                .style("text-anchor", "end")
                .style("font-size", "10px")
                .attr("dx", "-.8em")
                .attr("dy", ".15em")
                .attr("transform", "rotate(-45)");
        } else if (!isModal && categoryCount > 4) {
            // For moderate number of categories, reduce font size
            xAxisText.style("font-size", "10px");
        } else {
            xAxisText.style("font-size", axisFontSize);
        }
        
        yAxisGroup.selectAll("text").style("font-size", axisFontSize);

        const labelFontSize = isModal ? "20px" : "12px";

        if (isModal) {
            const xLabelY = margin.top + height + 23;
            svg.append("text")
                .attr("transform", `translate(${margin.left + width + 23}, ${xLabelY})`)
                .attr("text-anchor", "end")
                .attr("font-weight", "bold")
                .attr("font-size", labelFontSize)
                .text("Beads");
        } else {
            // Calculate label position based on whether labels are rotated and margin size
            const labelOffset = needsRotatedLabels ? 15 : 8;
            svg.append("text")
                .attr("transform", `translate(${margin.left + width / 2}, ${margin.top + height + margin.bottom - labelOffset})`)
                .attr("text-anchor", "middle")
                .attr("font-weight", "bold")
                .attr("font-size", labelFontSize)
                .text("Beads");
        }

        if (isModal) {
            svg.append("text")
                .attr("transform", `translate(${margin.left - 45}, ${margin.top + height / 2})rotate(-90)`)
                .attr("text-anchor", "middle")
                .attr("font-weight", "bold")
                .attr("font-size", labelFontSize)
                .text("Distance");
        } else {
            svg.append("text")
                .attr("transform", `translate(${margin.left / 3.5}, ${margin.top + height / 2})rotate(-90)`)
                .attr("text-anchor", "middle")
                .attr("font-weight", "bold")
                .attr("font-size", labelFontSize)
                .text("Distance");
        }

        // legend
        const legendFontSize = isModal ? "18px" : "10px";
        const legendSpacing = isModal ? 25 : 15;
        const legendRectSize = isModal ? 18 : 12;

        if (isModal) {
            // For modal: place legend under x-axis in a single horizontal row
            const legend = svg.append("g")
                .attr("transform", `translate(${margin.left}, ${margin.top + height + 35})`);

            const legendItemWidth = 150; // Approximate width per legend item
            const totalLegendWidth = distKeys.length * legendItemWidth;
            const startX = (width - totalLegendWidth) / 2; // Center the legend horizontally

            distKeys.forEach((cellLine, index) => {
                const legendRow = legend.append("g")
                    .attr("transform", `translate(${startX + index * legendItemWidth}, 0)`);

                legendRow.append("rect")
                    .attr("width", legendRectSize)
                    .attr("height", legendRectSize)
                    .attr("fill", colorScale(cellLine));

                legendRow.append("text")
                    .attr("x", legendRectSize + 5)
                    .attr("y", legendRectSize - 3)
                    .attr("font-size", legendFontSize)
                    .attr("font-weight", "bold")
                    .text(cellLine);
            });
        } else {
            // For regular view: keep the vertical legend on the right
            const legend = svg.append("g")
                .attr("transform", `translate(${margin.left + margin.right}, ${margin.top})`);

            distKeys.forEach((cellLine, index) => {
                const legendRow = legend.append("g")
                    .attr("transform", `translate(-15, ${index * legendSpacing})`);

                legendRow.append("rect")
                    .attr("width", legendRectSize)
                    .attr("height", legendRectSize)
                    .attr("fill", colorScale(cellLine));

                legendRow.append("text")
                    .attr("x", legendRectSize + 3)
                    .attr("y", legendRectSize - 3)
                    .attr("font-size", legendFontSize)
                    .attr("font-weight", "bold")
                    .text(cellLine);
            });
        }

        // ===============================
        // Significance lines and stars
        // ===============================
        const starFontSize = isModal ? "16px" : "10px";
        const starSpacing = isModal ? 18 : 12;
        const baseY = 6;

        if (isModal && Object.keys(pValuesByCategory || {}).length > 0 && numKeys >= 2) {
            categories.forEach(category => {
                const overlayGroup = g.append("g")
                    .attr("transform", `translate(${xScale(category)},0)`);

                let pairIdx = 0;
                for (let a = 0; a < numKeys - 1; a++) {
                    for (let b = a + 1; b < numKeys; b++) {
                        const gA = distKeys[a];
                        const gB = distKeys[b];
                        const key = gA <= gB ? `${gA}|${gB}` : `${gB}|${gA}`;
                        const pmap = pValuesByCategory[category] || {};
                        const p = pmap[key];
                        const ySig = baseY + pairIdx * starSpacing;
                        const centerA = a * segmentWidth + segmentWidth / 2;
                        const centerB = b * segmentWidth + segmentWidth / 2;
                        overlayGroup.append("line")
                            .attr("x1", centerA)
                            .attr("x2", centerB)
                            .attr("y1", ySig)
                            .attr("y2", ySig)
                            .attr("stroke", "#555")
                            .attr("stroke-width", 1);
                        if (p !== null && p !== undefined && Number.isFinite(p)) {
                            //     const stars = p < 0.001 ? "***" : (p < 0.01 ? "**" : (p < 0.05 ? "*" : "n.s."));
                            //     if (stars) {
                            //         overlayGroup.append("text")
                            //             .attr("x", (centerA + centerB) / 2)
                            //             .attr("y", ySig - 2)
                            //             .attr("text-anchor", "middle")
                            //             .attr("font-size", starFontSize)
                            //             .attr("font-weight", "bold")
                            //             .text(stars);
                            //     }
                            // }
                            const label = p.toPrecision(3);
                            overlayGroup.append("text")
                                .attr("x", (centerA + centerB) / 2)
                                .attr("y", ySig - 2)
                                .attr("text-anchor", "middle")
                                .attr("font-size", starFontSize)
                                .attr("font-weight", "bold")
                                .text(label);
                        }
                        pairIdx += 1;
                    }
                }
            });
        }
    };


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

    // Modal resize observer
    useEffect(() => {
        if (!isModalVisible) return;
        
        const modalObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.contentRect && modalSvgRef.current) {
                    const newDimensions = {
                        width: entry.contentRect.width,
                        height: entry.contentRect.height,
                    };
                    setModalDimensions(newDimensions);
                    // Redraw the plot with new dimensions
                    drawViolinPlot(modalSvgRef.current, newDimensions.width, newDimensions.height, true);
                }
            }
        });
        
        const modalContainer = modalSvgRef.current?.parentElement;
        if (modalContainer) {
            modalObserver.observe(modalContainer);
        }
        
        return () => {
            if (modalContainer) modalObserver.unobserve(modalContainer);
        };
    }, [isModalVisible, distributionData, selectedSphereList, pValuesByCategory]);

    useEffect(() => {
        drawViolinPlot(svgRef.current, dimensions.width, dimensions.height, false);
    }, [dimensions, distributionData, selectedSphereList, loading, pValuesByCategory]);

    return (
        <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
            {Object.keys(selectedSphereList).length > 0 ? (
                loading ? (
                    <Spin spinning={true} style={{ width: '100%', height: '100%' }} />
                ) : (
                    <>
                        <div style={{ position: "absolute", top: 10, right: 10, zIndex: 10, display: 'flex', gap: '8px' }}>
                            <Tooltip
                                title={<span style={{ color: 'black' }}>Zoom in</span>}
                                color='white'
                            >
                                <Button
                                    style={{
                                        fontSize: 15,
                                        cursor: "pointer",
                                    }}
                                    icon={<ExpandOutlined />}
                                    onClick={showModal}
                                />
                            </Tooltip>
                            <Tooltip
                                title={<span style={{ color: 'black' }}>Download the violin plot</span>}
                                color='white'
                            >
                                <Dropdown
                                    menu={{
                                        items: downloadItems,
                                        onClick: onClickDownloadItem,
                                    }}
                                    placement="bottom"
                                >
                                    <Button
                                        style={{
                                            fontSize: 15,
                                            cursor: "pointer",
                                        }}
                                        icon={<DownloadOutlined />}
                                    />
                                </Dropdown>
                            </Tooltip>
                        </div>
                        <svg ref={svgRef}></svg>
                        <Modal
                            title={
                                <div>
                                    <div style={{ fontSize: '18px' }}>Bead Distribution Violin Plot</div>
                                    {beadInfo && (
                                        <div style={{ fontSize: '16px', fontWeight: 'normal', color: '#666', marginTop: '4px' }}>
                                            <strong>{beadInfo.chromosome}</strong> {' '}
                                            {beadInfo.beadRanges.map((bead, index) => (
                                                <span key={bead.index}>
                                                    <strong>{bead.index}</strong>: {bead.startCoord.toLocaleString()}-{bead.endCoord.toLocaleString()}
                                                    {index < beadInfo.beadRanges.length - 1 && (
                                                        <span style={{ margin: '0 8px' }}>  |  </span>
                                                    )}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            }
                            open={isModalVisible}
                            onCancel={handleModalCancel}
                            afterOpenChange={(open) => {
                                if (open) {
                                    handleModalAfterOpen();
                                }
                            }}
                            footer={null}
                            width={1040}
                            centered
                        >
                            <div style={{ width: '1000px', height: '600px', position: 'relative', overflow: 'hidden' }}>
                                {modalLoading && (
                                    <div style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                        zIndex: 10
                                    }}>
                                        <Spin size="large" />
                                    </div>
                                )}
                                <div style={{ position: "absolute", top: 10, right: 10, zIndex: 10, display: 'flex', gap: '8px' }}>
                                    <Tooltip
                                        title={<span style={{ color: 'black' }}>Download the violin plot</span>}
                                        color='white'
                                    >
                                        <Dropdown
                                            menu={{
                                                items: downloadItems,
                                                onClick: onClickModalDownloadItem,
                                            }}
                                            placement="bottom"
                                        >
                                            <Button
                                                style={{
                                                    fontSize: 15,
                                                    cursor: "pointer",
                                                }}
                                                icon={<DownloadOutlined />}
                                            />
                                        </Dropdown>
                                    </Tooltip>
                                </div>
                                <svg ref={modalSvgRef}></svg>
                            </div>
                        </Modal>
                    </>
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
