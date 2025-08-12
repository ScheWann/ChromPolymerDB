import React, { useRef, useEffect, useState } from 'react';
import { Spin, Empty, Dropdown, Tooltip, Button, Modal } from 'antd';
import { DownloadOutlined, ExpandOutlined } from "@ant-design/icons";
import jsPDF from 'jspdf';
import * as d3 from 'd3';

export const BeadDistributionViolinPlot = ({ distributionData, selectedSphereList, loading }) => {
    const containerRef = useRef();
    const svgRef = useRef();
    const modalSvgRef = useRef();
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);

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
            const modalWidth = 1000;
            const modalHeight = 600;
            drawViolinPlot(modalSvgRef.current, modalWidth, modalHeight);
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

    const drawViolinPlot = (svgElement, plotWidth, plotHeight) => {
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

        const margin = { top: 20, right: 20, bottom: 25, left: 45 },
            width = plotWidth - margin.left - margin.right,
            height = plotHeight - margin.top - margin.bottom;

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // distributionData 的 keys
        const distKeys = Object.keys(distributionData);
        if (distKeys.length === 0) return;
        const categories = Object.keys(distributionData[distKeys[0]]);

        const xScale = d3.scaleBand()
            .domain(categories)
            .range([0, width])
            .padding(0.2);

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

        g.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(xAxis);

        const yAxis = d3.axisLeft(yScale).ticks(5);

        g.append("g").call(yAxis);

        svg.append("text")
            .attr("transform", `translate(${margin.left + width}, ${margin.top + height + margin.bottom - 5})`)
            .attr("text-anchor", "middle")
            .attr("font-size", "12px")
            .text("Beads");

        svg.append("text")
            .attr("transform", `translate(${margin.left / 3}, ${margin.top + height / 2})rotate(-90)`)
            .attr("text-anchor", "middle")
            .attr("font-size", "12px")
            .text("Distance");

        // legend
        const legend = svg.append("g")
            .attr("transform", `translate(${margin.left + margin.right}, ${margin.top})`);

        distKeys.forEach((cellLine, index) => {
            const legendRow = legend.append("g")
                .attr("transform", `translate(-15, ${index * 15})`);

            legendRow.append("rect")
                .attr("width", 12)
                .attr("height", 12)
                .attr("fill", colorScale(cellLine));

            legendRow.append("text")
                .attr("x", 15)
                .attr("y", 9)
                .attr("font-size", "10px")
                .text(cellLine);
        });
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

    useEffect(() => {
        drawViolinPlot(svgRef.current, dimensions.width, dimensions.height);
    }, [dimensions, distributionData, selectedSphereList, loading]);

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
                            title="Bead Distribution Violin Plot"
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
                            <div style={{ width: '100%', height: '600px', overflow: 'auto', position: 'relative', overflow: 'hidden' }}>
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
