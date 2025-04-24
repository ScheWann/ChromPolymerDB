import React, { useEffect, useState, useRef } from "react";
import igv from "../node_modules/igv/dist/igv.esm.js";
import * as d3 from "d3";


export const IgvViewer = ({ trackKey, selectedTrackData, cellLineName, chromosomeName, currentChromosomeSequence, brushedTriangleRange, minCanvasDimension, igvMountStatus, uploadTrackData }) => {
    const containerRef = useRef(null);
    const igvDivRef = useRef(null);
    const browserRef = useRef(null);
    const svgRef = useRef(null);
    const loadedTracks = useRef(new Set());

    const [igvHeight, setIgvHeight] = useState(0);

    const defaultTracks = {
        'GM': [
            {
                name: "ATAC-seq",
                url: "https://www.encodeproject.org/files/ENCFF667MDI/@@download/ENCFF667MDI.bigWig",
                format: "bigwig",
                color: "blue",
            },
            {
                name: "H3K4me3",
                url: "https://www.encodeproject.org/files/ENCFF975ARJ/@@download/ENCFF975ARJ.bigWig",
                format: "bigwig",
                color: "green"
            },
            {
                name: "H3K27ac",
                url: "https://www.encodeproject.org/files/ENCFF087YCU/@@download/ENCFF087YCU.bigWig",
                format: "bigwig",
                color: "#008788"
            },
            {
                name: "H3K4me1",
                url: "https://www.encodeproject.org/files/ENCFF836XOQ/@@download/ENCFF836XOQ.bigWig",
                format: "bigwig",
                color: "#008788"
            },
            {
                name: "H3K27me3",
                url: "https://www.encodeproject.org/files/ENCFF211VQW/@@download/ENCFF211VQW.bigWig",
                format: "bigwig",
                color: "brown"
            },
        ],
        'K': [
            {
                name: "ATAC-seq",
                url: "https://www.encodeproject.org/files/ENCFF137KFY/@@download/ENCFF137KFY.bigWig",
                format: "bigwig",
                color: "blue",
            },
            {
                name: "H3K4me3",
                url: "https://www.encodeproject.org/files/ENCFF071GML/@@download/ENCFF071GML.bigWig",
                format: "bigwig",
                color: "green"
            },
            {
                name: "H3K27ac",
                url: "https://www.encodeproject.org/files/ENCFF094XCU/@@download/ENCFF094XCU.bigWig",
                format: "bigwig",
                color: "#008788"
            },
            {
                name: "H3K4me1",
                url: "https://www.encodeproject.org/files/ENCFF100FDI/@@download/ENCFF100FDI.bigWig",
                format: "bigwig",
                color: "#008788"
            },
            {
                name: "H3K27me3",
                url: "https://www.encodeproject.org/files/ENCFF366NNJ/@@download/ENCFF366NNJ.bigWig",
                format: "bigwig",
                color: "brown"
            }
        ],
        'IMR': [
            {
                name: "ATAC-seq",
                url: "https://www.encodeproject.org/files/ENCFF770EAV/@@download/ENCFF770EAV.bigWig",
                format: "bigwig",
                color: "blue",
            },
            {
                name: "H3K4me3",
                url: "https://www.encodeproject.org/files/ENCFF811ZFE/@@download/ENCFF811ZFE.bigWig",
                format: "bigwig",
                color: "green"
            },
            {
                name: "H3K27ac",
                url: "https://www.encodeproject.org/files/ENCFF803HKN/@@download/ENCFF803HKN.bigWig",
                format: "bigwig",
                color: "#008788"
            },
            {
                name: "H3K4me1",
                url: "https://www.encodeproject.org/files/ENCFF756VSW/@@download/ENCFF756VSW.bigWig",
                format: "bigwig",
                color: "#008788"
            },
            {
                name: "H3K27me3",
                url: "https://www.encodeproject.org/files/ENCFF525KFC/@@download/ENCFF525KFC.bigWig",
                format: "bigwig",
                color: "brown"
            },
        ]
    }

    const xAxisScale = d3.scaleLinear()
        .domain([currentChromosomeSequence.start, currentChromosomeSequence.end])
        .range([0, minCanvasDimension]);

    useEffect(() => {
        let observer = null;
        let isMounted = true;

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
                if (!isMounted) return;
                browserRef.current = igvBrowser;
            });

            observer = new MutationObserver(() => {
                const shadowHost = document.querySelector("#igv-div");

                if (shadowHost?.shadowRoot) {
                    console.log("shadowRoot could be visited", shadowHost.shadowRoot);

                    const igvColumn = shadowHost.shadowRoot.querySelector(".igv-column");

                    if (igvColumn) {
                        const igvViewPorts = igvColumn.querySelectorAll(".igv-viewport");

                        if (igvViewPorts.length > 0) {
                            igvColumn.style.width = minCanvasDimension + "px";
                            igvViewPorts.forEach(viewport => {
                                viewport.style.width = "100%";
                            });

                            observer.disconnect();
                        }
                    }
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });
        }

        return () => {
            isMounted = false;
            if (browserRef.current) {
                igv.removeAllBrowsers();
                browserRef.current = null;
            }
            if (observer) {
                observer.disconnect();
                observer = null;
            }
        };
    }, [chromosomeName, currentChromosomeSequence, igvMountStatus]);

    useEffect(() => {
        if (browserRef.current && selectedTrackData && trackKey) {
            selectedTrackData.forEach((track) => {
                if (!loadedTracks.current.has(track.HREF)) {
                    loadedTracks.current.add(track.HREF);
                    const newTrack = {
                        url: `https://www.encodeproject.org${track.HREF}`,
                        name: `${track.Biosample} ${track.Target}`,
                        format: track.Format,
                    };

                    browserRef.current.loadTrack(newTrack);
                }
            });
        }
    }, [selectedTrackData, trackKey]);

    useEffect(() => {
        if (browserRef.current && trackKey === '4' && uploadTrackData.name && uploadTrackData.trackUrl) {
            const format = uploadTrackData.trackUrl.split('.').pop().split('?')[0].toLowerCase();
            const newTrack = {
                url: uploadTrackData.trackUrl,
                name: uploadTrackData.name,
                format: `${format}`,
            };
            browserRef.current.loadTrack(newTrack);
        }
    }, [uploadTrackData, trackKey]);

    useEffect(() => {
        const svg = d3.select(svgRef.current);

        svg.selectAll("*").remove();

        svg.attr('class', 'brushed-triangle-range-overlay')
            .style('z-index', 100)
            .style('position', 'absolute')
            .style('height', 0)

        let shadowRoot = document.querySelector("#igv-div")?.shadowRoot;
        let igvContainerHeight = 0;

        if (shadowRoot) {
            const igvContainer = shadowRoot.querySelector(".igv-container");
            if (igvContainer) {
                igvContainerHeight = igvContainer.getBoundingClientRect().height;
            }
        }

        setIgvHeight(igvContainerHeight);

        if (brushedTriangleRange.start && brushedTriangleRange.end) {
            const { start, end } = brushedTriangleRange;
            const startX = xAxisScale(start);
            const endX = xAxisScale(end);

            const svgWidth = minCanvasDimension + 100;

            svg.style('width', svgWidth)
                .style('height', igvContainerHeight)
                .style('pointer-events', 'none');

            svg.append("line")
                .attr("class", "brushed-triangle-range")
                .attr('transform', `translate(50, 0)`)
                .attr("x1", startX)
                .attr("y1", 0)
                .attr("x2", startX)
                .attr("y2", igvContainerHeight)
                .attr("stroke", "#C0C0C0")
                .attr("stroke-width", 3);

            svg.append("line")
                .attr("class", "brushed-triangle-range")
                .attr('transform', `translate(50, 0)`)
                .attr("x1", endX)
                .attr("y1", 0)
                .attr("x2", endX)
                .attr("y2", igvContainerHeight)
                .attr("stroke", "#C0C0C0")
                .attr("stroke-width", 3);
        }
    }, [brushedTriangleRange, currentChromosomeSequence]);

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
                style={{ width: minCanvasDimension + 104, height: "100%", overflowY: "visible" }}
            ></div>
            <svg ref={svgRef} />
        </div>
    );
};