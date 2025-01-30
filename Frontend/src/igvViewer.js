import React, { useEffect, useState, useRef } from "react";
import igv from "../node_modules/igv/dist/igv.esm.js";
import * as d3 from "d3";


export const IgvViewer = ({ trackKey, selectedTrackData, cellLineName, chromosomeName, currentChromosomeSequence, brushedTriangleRange, minCanvasDimension, igvMountStatus }) => {
    const containerRef = useRef(null);
    const igvDivRef = useRef(null);
    const browserRef = useRef(null);
    const svgRef = useRef(null);

    const [igvHeight, setIgvHeight] = useState(0);

    const defaultTracks = {
        'GM': [
            {
                name: "ATAC-seq",
                url: "https://www.encodeproject.org/files/ENCFF667MDI/@@download/ENCFF667MDI.bigWig",
                format: "bigwig",
            },
            {
                name: "H3K4me3",
                url: "https://www.encodeproject.org/files/ENCFF975ARJ/@@download/ENCFF975ARJ.bigWig",
                format: "bigwig",
            },
            {
                name: "H3K27ac",
                url: "https://www.encodeproject.org/files/ENCFF087YCU/@@download/ENCFF087YCU.bigWig",
                format: "bigwig",
            },
            {
                name: "H3K27me3",
                url: "https://www.encodeproject.org/files/ENCFF211VQW/@@download/ENCFF211VQW.bigWig",
                format: "bigwig",
            }
        ],
        'K': [
            {
                name: "ATAC-seq",
                url: "https://www.encodeproject.org/files/ENCFF137KFY/@@download/ENCFF137KFY.bigWig",
                format: "bigwig",
            },
            {
                name: "H3K4me3",
                url: "https://www.encodeproject.org/files/ENCFF071GML/@@download/ENCFF071GML.bigWig",
                format: "bigwig",
            },
            {
                name: "H3K27ac",
                url: "https://www.encodeproject.org/files/ENCFF094XCU/@@download/ENCFF094XCU.bigWig",
                format: "bigwig",
            },
            {
                name: "H3K27me3",
                url: "https://www.encodeproject.org/files/ENCFF366NNJ/@@download/ENCFF366NNJ.bigWig",
                format: "bigwig",
            }
        ],
        'IMR': [
            {
                name: "ATAC-seq",
                url: "https://www.encodeproject.org/files/ENCFF770EAV/@@download/ENCFF770EAV.bigWig",
                format: "bigwig",
            },
            {
                name: "H3K4me3",
                url: "https://www.encodeproject.org/files/ENCFF811ZFE/@@download/ENCFF811ZFE.bigWig",
                format: "bigwig",
            },
            {
                name: "H3K27ac",
                url: "https://www.encodeproject.org/files/ENCFF803HKN/@@download/ENCFF803HKN.bigWig",
                format: "bigwig",
            },
            {
                name: "H3K27me3",
                url: "https://www.encodeproject.org/files/ENCFF525KFC/@@download/ENCFF525KFC.bigWig",
                format: "bigwig",
            }
        ]
    }

    const { start, end } = currentChromosomeSequence;
    const step = 5000;
    const adjustedStart = Math.floor(start / step) * step;
    const adjustedEnd = Math.ceil(end / step) * step;

    const axisValues = Array.from(
        { length: Math.floor((adjustedEnd - adjustedStart) / step) + 1 },
        (_, i) => adjustedStart + i * step
    );

    const xAxisScale = d3.scaleBand()
        .domain(axisValues)
        .range([0, minCanvasDimension])
        .padding(0.1);

    useEffect(() => {
        let observer = null;

        if (igvMountStatus) {
            const igvOptions = {
                genome: "hg38",
                locus: `${chromosomeName}:${currentChromosomeSequence.start}-${currentChromosomeSequence.end}`,
                showChromosomeWidget: false,
                showAllChromosomes: false,
                showNavigation: false,
                showIdeogram: false,
                panEnabled: false,
                tracks: defaultTracks[cellLineName],
            };

            igv.createBrowser(igvDivRef.current, igvOptions).then((igvBrowser) => {
                browserRef.current = igvBrowser;
            });

            observer = new MutationObserver(() => {
                const shadowHost = document.querySelector("#igv-div");
                if (shadowHost?.shadowRoot) {
                    console.log("shadowRoot could be visited", shadowHost.shadowRoot);
                    const igvColumn = shadowHost.shadowRoot.querySelector(".igv-column");
                    const igvViewPorts = shadowHost.shadowRoot.querySelectorAll(".igv-viewport");

                    if (igvColumn && igvViewPorts.length > 0) {
                        igvColumn.style.width = "100%";
                        if (igvViewPorts.length > 0) {
                            igvViewPorts.forEach(viewport => {
                                viewport.style.width = "100%";
                            })
                        };
                        observer.disconnect();
                    }
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });
        } else {
            if (browserRef.current) {
                igv.removeAllBrowsers();
                browserRef.current = null;
            }
            if (observer) {
                observer.disconnect();
            }
        }

        return () => {
            if (observer) {
                observer.disconnect();
            }
        };
    }, [chromosomeName, currentChromosomeSequence, igvMountStatus]);

    useEffect(() => {
        if (browserRef.current && selectedTrackData && trackKey) {
            if (trackKey === '4') {
                selectedTrackData.forEach((track) => {
                    const newTrack = {
                        url: track.url,
                        name: track.name,
                        format: 'bed',
                        type: track.Type,
                        color: track.color,
                        altColor: track.altColor,
                    };
                    browserRef.current.loadTrack(newTrack);
                });
            } else {
                selectedTrackData.forEach((track) => {
                    const newTrack = {
                        url: `https://www.encodeproject.org${track.HREF}`,
                        name: track.AssayType,
                        format: track.Format,
                    };

                    browserRef.current.loadTrack(newTrack);
                });
            }
        }
    }, [selectedTrackData, trackKey]);

    useEffect(() => {
        const svg = d3.select(svgRef.current);

        svg.selectAll("*").remove();

        svg.attr('class', 'brushed-triangle-range-overlay')
            .style('z-index', 100)
            .style('position', 'absolute')
            .style('height', 0)

        if (brushedTriangleRange.start && brushedTriangleRange.end) {
            const { start, end } = brushedTriangleRange;
            const startX = xAxisScale(start);
            const endX = xAxisScale(end);

            const svgHeight = d3.select(igvDivRef.current).node().getBoundingClientRect().height;
            const svgWidth = minCanvasDimension + 100;
            setIgvHeight(svgHeight);

            svg.style('width', svgWidth)
                .style('height', svgHeight)
                .style('bottom', -svgHeight / 2)
                .style('pointer-events', 'none')
                .attr('transform', `translate(0, 65)`);

            svg.append("line")
                .attr("class", "brushed-triangle-range")
                .attr('transform', `translate(50, 0)`)
                .attr("x1", startX)
                .attr("y1", 0)
                .attr("x2", startX)
                .attr("y2", svgHeight)
                .attr("stroke", "#C0C0C0")
                .attr("stroke-width", 3);

            svg.append("line")
                .attr("class", "brushed-triangle-range")
                .attr('transform', `translate(50, 0)`)
                .attr("x1", endX)
                .attr("y1", 0)
                .attr("x2", endX)
                .attr("y2", svgHeight)
                .attr("stroke", "#C0C0C0")
                .attr("stroke-width", 3);
        }
    }, [brushedTriangleRange]);

    return (
        <div ref={containerRef}
            style={{
                width: minCanvasDimension + 104,
                height: 325,
                display: "flex",
                justifyContent: "center",
            }}>
            <div
                id="igv-div"
                ref={igvDivRef}
                style={{ width: minCanvasDimension + 104, height: "100%", overflowY: "auto" }}
            ></div>
            <svg ref={svgRef} />
        </div>
    );
};