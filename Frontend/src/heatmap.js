import React, { useEffect } from 'react';
import * as d3 from 'd3';

export const Heatmap = ({ chromosomeData, selectedChromosomeSequence, totalChromosomeSequences }) => {
    useEffect(() => {
        const margin = { top: 10, right: 10, bottom: 50, left: 60 };
        const width = 700 - margin.left - margin.right;
        const height = 700 - margin.top - margin.bottom;

        d3.select('#heatmap').selectAll('*').remove();
        const svg = d3.select('#heatmap')
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        // Convert to numbers
        chromosomeData.forEach(d => {
            d.ibp = +d.ibp;
            d.jbp = +d.jbp;
            d.fq = +d.fq;
            d.fdr = +d.fdr;
        });

        // Define scales based on chromosomeSequence length and step size
        const { start, end } = selectedChromosomeSequence;
        const step = 5000;
        const adjustedStart = Math.floor(start / step) * step;
        const adjustedEnd = Math.ceil(end / step) * step;
        
        const axisValues = Array.from(
            { length: Math.floor((adjustedEnd - adjustedStart) / step) + 1 },
            (_, i) => adjustedStart + i * step
        );

        const colorScale = d3.scaleSequential(d3.interpolateYlOrBr)
            .domain([0, d3.max(chromosomeData, d => d.fq)]);

        const xScale = d3.scaleBand()
            .domain(axisValues)
            .range([0, width])
            .padding(0.1);

        const yScale = d3.scaleBand()
            .domain(axisValues)
            .range([height, 0])
            .padding(0.1);

        svg.append('g')
            .attr('transform', `translate(0, ${height})`)
            .call(d3.axisBottom(xScale)
                .tickValues(axisValues.filter((_, i) => i % 12 === 0))
                .tickFormat(d => {
                    if (d >= 1000000) {
                        return `${(d / 1000000).toFixed(2)}M`;
                    };
                    if (d > 10000 && d < 1000000) {
                        return `${(d / 10000).toFixed(2)}W`;
                    }
                    return d;
                }))
            .selectAll("text")
            .style("text-anchor", "end")
            .attr("transform", "rotate(-90)")
            .attr("dx", "-1em")
            .attr("dy", "-0.5em");

        svg.append('g')
            .call(d3.axisLeft(yScale)
                .tickValues(axisValues.filter((_, i) => i % 12 === 0))
                .tickFormat(d => {
                    if (d >= 1000000) {
                        return `${(d / 1000000).toFixed(2)}M`;
                    };
                    if (d > 10000 && d < 1000000) {
                        return `${(d / 10000).toFixed(2)}W`;
                    }
                    return d;
                }));

        // Create a mapping to account for symmetry
        const fqMap = new Map();

        chromosomeData.forEach(d => {
            fqMap.set(`X:${d.ibp}, Y:${d.jbp}`, { fq: d.fq, fdr: d.fdr });
            fqMap.set(`X:${d.jbp}, Y:${d.ibp}`, { fq: d.fq, fdr: d.fdr });
        });

        const hasData = (ibp, jbp) => {
            const inRange = totalChromosomeSequences.some(seq => 
                ibp >= seq.start && ibp <= seq.end && 
                jbp >= seq.start && jbp <= seq.end
            );
            // check fq and fdr exist and are not both 0
            const value = fqMap.get(`X:${ibp}, Y:${jbp}`) || fqMap.get(`X:${jbp}, Y:${ibp}`);
            const hasNonZeroData = value && (value.fq !== 0 || value.fdr !== 0);
            
            return inRange && hasNonZeroData;
        };

        svg.selectAll()
            .data(axisValues.flatMap(ibp => axisValues.map(jbp => {
                const value = fqMap.get(`X:${ibp}, Y:${jbp}`) || fqMap.get(`X:${jbp}, Y:${ibp}`) || { fq: 0, fdr: 0 };
                return {
                    ibp,
                    jbp,
                    fq: value.fq,
                    fdr: value.fdr
                };
            })))
            .enter()
            .append('rect')
            .attr('x', d => xScale(d.jbp))
            .attr('y', d => yScale(d.ibp))
            .attr('width', xScale.bandwidth())
            .attr('height', yScale.bandwidth())
            .on('mouseover', (event, d) => {
                console.log(d);
            })
            .style('fill', d => {
                if (!hasData(d.ibp, d.jbp)) {
                    return 'white';
                }
                if (d.jbp <= d.ibp && (d.fdr > 0.05 || (d.fdr === 0 && d.fq === 0))) {
                    return 'white';
                }
                return colorScale(d.fq);
            })
            .style('stroke', 'black')
            .style('stroke-width', 0.01);
    }, [chromosomeData, totalChromosomeSequences]);

    return <div id="heatmap" />;
};