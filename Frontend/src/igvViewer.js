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
        'GM12878': [
            {
                name: "DNase-seq",
                url: "https://www.encodeproject.org/files/ENCFF960FMM/@@download/ENCFF960FMM.bigWig",
                format: "bigwig",
                color: "#79200D",
            },
            {
                name: "H3K27ac",
                url: "https://www.encodeproject.org/files/ENCFF798KYP/@@download/ENCFF798KYP.bigWig",
                format: "bigwig",
                color: "#E77B72"
            },
            {
                name: "H3K4me1",
                url: "https://www.encodeproject.org/files/ENCFF190RZM/@@download/ENCFF190RZM.bigWig",
                format: "bigwig",
                color: "#E88E33"
            },
            {
                name: "H3K4me3",
                url: "https://www.encodeproject.org/files/ENCFF975ARJ/@@download/ENCFF975ARJ.bigWig",
                format: "bigwig",
                color: "#578225"
            },
            {
                name: "H3K27me3",
                url: "https://www.encodeproject.org/files/ENCFF677PYB/@@download/ENCFF677PYB.bigWig",
                format: "bigwig",
                color: "#151A82"
            },
            {
                name: "RNA-seq",
                url: "https://www.encodeproject.org/files/ENCFF782HFV/@@download/ENCFF782HFV.bigWig",
                format: "bigwig",
                color: "#813BF5"
            },
            // {
            //     name: " ",
            //     url: "https://www.encodeproject.org/files/ENCFF944OWQ/@@download/ENCFF944OWQ.bigBed",
            //     format: "bigBed",
            // }
            
        ],
        'Calu3': [
            {
                name: "DNase-seq",
                url: "https://www.encodeproject.org/files/ENCFF097WPE/@@download/ENCFF097WPE.bigWig",
                format: "bigwig",
                color: "#79200D",
            },
            {
                name: "H3K27ac",
                url: "https://www.encodeproject.org/files/ENCFF722WOH/@@download/ENCFF722WOH.bigWig",
                format: "bigwig",
                color: "#E77B72"
            },
            {
                name: "H3K4me1",
                url: "https://www.encodeproject.org/files/ENCFF040YAL/@@download/ENCFF040YAL.bigWig",
                format: "bigwig",
                color: "#E88E33"
            },
            {
                name: "H3K4me3",
                url: "https://www.encodeproject.org/files/ENCFF528GFC/@@download/ENCFF528GFC.bigWig",
                format: "bigwig",
                color: "#578225"
            },
            {
                name: "H3K27me3",
                url: "https://www.encodeproject.org/files/ENCFF695JPQ/@@download/ENCFF695JPQ.bigWig",
                format: "bigwig",
                color: "#151A82"
            },
            {
                name: "RNA-seq",
                url: "https://www.encodeproject.org/files/ENCFF873UUS/@@download/ENCFF873UUS.bigWig",
                format: "bigwig",
                color: "#813BF5"
            },
            // {
            //     name: " ",
            //     url: "https://www.encodeproject.org/files/ENCFF700JVP/@@download/ENCFF700JVP.bigBed",
            //     format: "bigBed",
            // }
        ],
        'IMR90': [
            {
                name: "DNase-seq",
                url: "https://www.encodeproject.org/files/ENCFF971HXR/@@download/ENCFF971HXR.bigWig",
                format: "bigwig",
                color: "#79200D",
            },

            {
                name: "H3K27ac",
                url: "https://www.encodeproject.org/files/ENCFF803HKN/@@download/ENCFF803HKN.bigWig",
                format: "bigwig",
                color: "#E77B72"
            },
            {
                name: "H3K4me1",
                url: "https://www.encodeproject.org/files/ENCFF756VSW/@@download/ENCFF756VSW.bigWig",
                format: "bigwig",
                color: "#E88E33"
            },

            {
                name: "H3K4me3",
                url: "https://www.encodeproject.org/files/ENCFF811ZFE/@@download/ENCFF811ZFE.bigWig",
                format: "bigwig",
                color: "#578225"
            },
            {
                name: "H3K27me3",
                url: "https://www.encodeproject.org/files/ENCFF525KFC/@@download/ENCFF525KFC.bigWig",
                format: "bigwig",
                color: "#151A82"
            },
            {
                name: "RNA-seq",
                url: "https://www.encodeproject.org/files/ENCFF188MTB/@@download/ENCFF188MTB.bigWig",
                format: "bigwig",
                color: "#813BF5"
            },
        ],
        'monocytes':[
            {
                name: "DNase-seq",
                url: "https://www.encodeproject.org/files/ENCFF544SIY/@@download/ENCFF544SIY.bigWig",
                format: "bigwig",
                color: "#79200D",
            },
            {
                name: "H3K27ac",
                url: "https://www.encodeproject.org/files/ENCFF626UTP/@@download/ENCFF626UTP.bigWig",
                format: "bigwig",
                color: "#E77B72"
            },
            {
                name: "H3K4me1",
                url: "https://www.encodeproject.org/files/ENCFF864HZP/@@download/ENCFF864HZP.bigWig",
                format: "bigwig",
                color: "#E88E33"
            },
            {
                name: "H3K4me3",
                url: "https://www.encodeproject.org/files/ENCFF296KZJ/@@download/ENCFF296KZJ.bigWig",
                format: "bigwig",
                color: "#578225"
            },
            {
                name: "H3K27me3",
                url: "https://www.encodeproject.org/files/ENCFF702ZRF/@@download/ENCFF702ZRF.bigWig",
                format: "bigwig",
                color: "#151A82"
            },
            {
                name: "RNA-seq",
                url: "https://www.encodeproject.org/files/ENCFF853SNW/@@download/ENCFF853SNW.bigWig",
                format: "bigwig",
                color: "#813BF5"
            },
            // {
            //     name: " ",
            //     url: "https://www.encodeproject.org/files/ENCFF274NYA/@@download/ENCFF274NYA.bigBed",
            //     format: "bigBed",
            // },
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
                showCommandBar: false,
                reference: {
                    "id": "hg38",
                    "name": "Human (GRCh38/hg38)",
                    "fastaURL": "https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/hg38/hg38.fa",
                    "indexURL": "https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/hg38/hg38.fa.fai",
                    "cytobandURL": "https://s3.amazonaws.com/igv.broadinstitute.org/annotations/hg38/cytoBandIdeo.txt",
                    "tracks": [
                        {
                            name: "RefSeq All",
                            url: "https://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/ncbiRefSeq.txt.gz",
                            format: "refgene",
                            type: "annotation",
                            displayMode: "collapsed",
                            color: "blue"
                        }
                    ],
                },
                tracks: defaultTracks[cellLineName] || []
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

            // Add specific properties for BEDPE interaction tracks
            if (format === 'bedpe') {
                newTrack.type = "interact";
                newTrack.arcType = "Nested";
                newTrack.arcOrientation = "UP";
                newTrack.color = "rgb(109,122,250)";
            }
            
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