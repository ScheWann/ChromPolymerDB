import React, { useEffect, useRef } from "react";
import igv from '../node_modules/igv/dist/igv.esm.js';


export const IgvViewer = ({ cellLineName, chromosomeName, currentChromosomeSequence }) => {
    const igvDivRef = useRef(null);

    // Default tracks for the IGV browser
    const defaultTracks = {
        'GM' : [
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

    useEffect(() => {
        const igvOptions = {
            genome: "hg38",
            locus: `${chromosomeName}:${currentChromosomeSequence.start}-${currentChromosomeSequence.end}`,
            showChromosomeWidget: false,
            showAllChromosomes: false,
            showNavigation: false,
            showIdeogram: false,
            panEnabled: false, 
            showRuler: false,
            tracks: defaultTracks[cellLineName],
        };

        let browser;

        // Create the IGV browser
        igv.createBrowser(igvDivRef.current, igvOptions).then((igvBrowser) => {
            browser = igvBrowser;
        });

        // Cleanup on unmount
        return () => {
            if (browser) {
                browser.destroy();
            }
        };
    }, []);

    return (
        <div style={{ width: "100%" }}>
            <div
                id="igv-div"
                ref={igvDivRef}
                style={{ width: "100%", height: "100%" }}
            ></div>
        </div>
    );
};
