import React, { useEffect, useState, useRef } from "react";
import igv from "../node_modules/igv/dist/igv.esm.js";
import * as d3 from "d3";


export const IgvViewer = ({ refreshIGV, setRefreshIGV, trackKey, selectedTrackData, cellLineName, chromosomeName, currentChromosomeSequence, brushedTriangleRange, minCanvasDimension, igvMountStatus, uploadTrackData }) => {
    const containerRef = useRef(null);
    const igvDivRef = useRef(null);
    const browserRef = useRef(null);
    const svgRef = useRef(null);
    const loadedTracks = useRef(new Set());
    const customTracks = useRef([]); // Store custom tracks to reload them
    const isMountedRef = useRef(true); // Track component mounting status

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
        isMountedRef.current = true;

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
                if (!isMountedRef.current) return;
                browserRef.current = igvBrowser;
                
                // Reload custom tracks after browser recreation
                if (customTracks.current.length > 0) {
                    customTracks.current.forEach(track => {
                        try {
                            if (browserRef.current && browserRef.current.loadTrack && isMountedRef.current) {
                                browserRef.current.loadTrack(track).catch(error => {
                                    console.warn('Failed to reload custom track:', error);
                                });
                            }
                        } catch (error) {
                            console.warn('Error reloading custom track:', error);
                        }
                    });
                }
            }).catch(error => {
                console.warn('Failed to create IGV browser:', error);
            });

            observer = new MutationObserver(() => {
                if (!isMountedRef.current) return;
                
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
            isMountedRef.current = false;
            if (browserRef.current) {
                igv.removeAllBrowsers();
                browserRef.current = null;
            }
            if (observer) {
                observer.disconnect();
                observer = null;
            }
            if (refreshIGV) {
                setRefreshIGV(false); // reset trigger
            }
        };
    }, [chromosomeName, currentChromosomeSequence, igvMountStatus, refreshIGV]);

    useEffect(() => {
        if (browserRef.current && selectedTrackData && trackKey && isMountedRef.current) {
            selectedTrackData.forEach((track) => {
                if (!loadedTracks.current.has(track.HREF)) {
                    loadedTracks.current.add(track.HREF);
                    const newTrack = {
                        url: `https://www.encodeproject.org${track.HREF}`,
                        name: `${track.Biosample} ${track.Target}`,
                        format: track.Format,
                    };

                    // Store the track for potential reload
                    customTracks.current.push(newTrack);
                    
                    // Add error handling for track loading
                    try {
                        if (browserRef.current && browserRef.current.loadTrack && isMountedRef.current) {
                            browserRef.current.loadTrack(newTrack).catch(error => {
                                console.warn('Failed to load track:', error);
                                // Remove from custom tracks if loading failed
                                const index = customTracks.current.findIndex(t => t.url === newTrack.url);
                                if (index > -1) {
                                    customTracks.current.splice(index, 1);
                                }
                            });
                        }
                    } catch (error) {
                        console.warn('Error loading track:', error);
                        // Remove from custom tracks if loading failed
                        const index = customTracks.current.findIndex(t => t.url === newTrack.url);
                        if (index > -1) {
                            customTracks.current.splice(index, 1);
                        }
                    }
                }
            });
        }
    }, [selectedTrackData, trackKey]);

    // Clear custom tracks when chromosome changes
    useEffect(() => {
        customTracks.current = [];
        loadedTracks.current.clear();
    }, [chromosomeName]);

    // Expose function to clear all custom tracks
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.clearIgvCustomTracks = () => {
                customTracks.current = [];
                loadedTracks.current.clear();
                if (browserRef.current) {
                    // Remove all tracks except the default ones
                    const tracks = browserRef.current.trackViews;
                    if (tracks) {
                        tracks.forEach(trackView => {
                            const track = trackView.track;
                            // Only remove custom tracks, keep default tracks
                            if (track.name && !defaultTracks[cellLineName].some(defaultTrack => defaultTrack.name === track.name)) {
                                browserRef.current.removeTrack(track);
                            }
                        });
                    }
                }
            };
        }
    }, [cellLineName]);

    useEffect(() => {
        if ((browserRef.current && trackKey === '4' || browserRef.current && trackKey === '5') && uploadTrackData.name && uploadTrackData.trackUrl && isMountedRef.current) {
            let format;
            if (trackKey === '4') {
                format = uploadTrackData.trackUrl.split('.').pop().split('?')[0].toLowerCase();
            } else {
                format = uploadTrackData.format
            }
            const newTrack = {
                url: uploadTrackData.trackUrl,
                name: uploadTrackData.name,
                format: `${format}`,
            };
            
            // Store the track for potential reload
            customTracks.current.push(newTrack);
            
            // Add error handling for track loading
            try {
                if (browserRef.current && browserRef.current.loadTrack && isMountedRef.current) {
                    browserRef.current.loadTrack(newTrack).catch(error => {
                        console.warn('Failed to load uploaded track:', error);
                        // Remove from custom tracks if loading failed
                        const index = customTracks.current.findIndex(t => t.url === newTrack.url);
                        if (index > -1) {
                            customTracks.current.splice(index, 1);
                        }
                    });
                }
            } catch (error) {
                console.warn('Error loading uploaded track:', error);
                // Remove from custom tracks if loading failed
                const index = customTracks.current.findIndex(t => t.url === newTrack.url);
                if (index > -1) {
                    customTracks.current.splice(index, 1);
                }
            }
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
                .attr("x1", Math.max(startX - 2, 0))
                .attr("y1", 0)
                .attr("x2", Math.max(startX - 2, 0))
                .attr("y2", igvContainerHeight)
                .attr("stroke", "#C0C0C0")
                .attr("stroke-width", 3)
                .style("opacity", 0.5);

            svg.append("line")
                .attr("class", "brushed-triangle-range")
                .attr('transform', `translate(50, 0)`)
                .attr("x1", Math.min(endX - 2, minCanvasDimension - 4))
                .attr("y1", 0)
                .attr("x2", Math.min(endX - 2, minCanvasDimension - 4))
                .attr("y2", igvContainerHeight)
                .attr("stroke", "#C0C0C0")
                .attr("stroke-width", 3)
                .style("opacity", 0.5);
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