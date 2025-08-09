import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Typography, Card, Tag, Button, Dropdown, Drawer } from 'antd';
import { ProfileOutlined, ExperimentOutlined, FolderViewOutlined } from '@ant-design/icons';
import { TutorialDrawer } from './tutorial.js';

const data = [
    { name: 'The 4D Nucleome (4DN) Data Portal', value: 20 },
    { name: 'The ENCODE Portal', value: 17 },
    { name: 'Gene Expression Omnibus (GEO)', value: 13 }
];

const antColors = [
    '#1890ff', // blue
    '#52c41a', // green
    '#faad14', // orange
    '#f5222d', // red
    '#13c2c2', // cyan
    '#722ed1', // purple
    '#eb2f96'  // pink
];

const colors = d3.scaleOrdinal(antColors);
const { Title, Text } = Typography;

export const ProjectIntroduction = ({ exampleDataItems, setCellLineName, setChromosomeName, setSelectedChromosomeSequence, setStartInputValue, setEndInputValue }) => {
    const chartRef = useRef(null);
    const [drawerVisible, setDrawerVisible] = useState(false);

    useEffect(() => {
        if (!chartRef.current) return;

        const container = d3.select(chartRef.current);
        container.selectAll('*').remove();

        const wrapper = container.append('div')
            .style('display', 'flex')
            .style('align-items', 'center');

        const width = 300;
        const height = 200;
        const radius = Math.min(width, height) / 2 - 10;

        const svg = wrapper.append('svg')
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', `translate(${width / 2},${height / 2})`);

        const pie = d3.pie()
            .value(d => d.value)
            .sort(null);

        const arc = d3.arc()
            .innerRadius(0)
            .outerRadius(radius);

        const arcs = svg.selectAll('arc')
            .data(pie(data))
            .enter()
            .append('g');

        arcs.append('path')
            .attr('d', arc)
            .attr('fill', (d, i) => colors(i))
            .transition()
            .duration(1000)
            .attrTween('d', function (d) {
                const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
                return t => arc(interpolate(t));
            });

        const legend = wrapper.append('div')
            .style('margin-left', '20px');

        data.forEach((d, i) => {
            const legendItem = legend.append('div')
                .style('display', 'flex')
                .style('align-items', 'center')
                .style('margin', '5px 0');

            legendItem.append('div')
                .style('width', '12px')
                .style('height', '12px')
                .style('background-color', colors(i))
                .style('margin-right', '8px');

            legendItem.append('div')
                .html(`${d.name}: <strong style="font-weight:600">${d.value} datasets</strong>`);
        });

        return () => {
            container.selectAll('*').remove();
        };
    }, []);

    const onClickExampleDataItem = ({ key }) => {
        // Find the example data item by key
        const exampleItem = exampleDataItems.find(item => item.key === key);
        if (exampleItem) {
            setCellLineName(exampleItem.cellLine);
            setChromosomeName(exampleItem.chromosome);
            setSelectedChromosomeSequence({ start: exampleItem.start, end: exampleItem.end });
            setStartInputValue(exampleItem.start.toString());
            setEndInputValue(exampleItem.end.toString());
        }
    }

    return (
        <div style={{ width: 1200, margin: '0 auto', padding: '24px' }}>
            <Title
                level={2}
                style={{ color: '#1890ff', textAlign: 'center', marginBottom: '32px' }}
            >
                <ExperimentOutlined /> ChromPolymerDB
            </Title>

            <Card
                title={
                    <div style={{ width: '100%', textAlign: 'center', justifyContent: 'center', position: 'relative' }}>
                        <Title
                            level={4}
                            style={{
                                margin: 0,
                                position: 'absolute',
                                left: '50%',
                                top: '50%',
                                transform: 'translateX(-50%) translateY(-50%)'
                            }}>
                            Introduction
                        </Title>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                            <span style={{ fontWeight: 'bold' }}>Tutorial: </span>
                                <ProfileOutlined
                                    className='projectTutorial'
                                    style={{
                                        fontSize: '28px',
                                        color: '#333',
                                        transition: 'color 0.3s'
                                    }}
                                    onClick={() => setDrawerVisible(true)}
                                />
                        </div>
                    </div>
                }
                style={{ width: '100%', marginBottom: 16 }}
                header={{ padding: '0 24px', background: '#fff' }}
                body={{ padding: 24 }}
            >
                <div style={{ width: "100%", textAlign: 'left', marginBottom: '10px' }}>
                    <Text style={{ fontSize: '1rem', lineHeight: 1.5 }}>
                        The three-dimensional (3D) organization of chromatin is well known to play an essential role in a wide range of biological functions. A deeper understanding of chromatin structures is crucial for decoding critical biology processes. To support the exploration of chromatin architecture, we developed ChromPolymerDB, a publicly accessible, high-resolution database of single-cell 3D chromatin structures reconstructed using polymer physics-based modeling of Hi-C data. This database covers a substantial number of single-cell chromatin structures at 5 kb resolution across 50 diverse human cell types and experimental conditions. It provides an interactive web interface with integrated spatial and structural analysis tools, enables multi-omics integration with gene expression, epigenetic marks, and other regulatory elements, and allows comparative analysis to identify structural rewiring events—such as enhancer hub emergence or loop remodeling—across conditions, developmental stages, or disease states. These innovations make ChromPolymerDB a powerful tool for researchers investigating the interplay between chromatin architecture and gene regulation and performing comparative 3D genomics.
                    </Text>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <Button style={{ width: "30%", color: 'white', backgroundColor: '#9d4edd', border: 'none' }} color='pink' variant="outlined" icon={<ProfileOutlined />} iconPosition="end" onClick={() => setDrawerVisible(true)} >
                        Tutorial
                    </Button>

                    <TutorialDrawer
                        visible={drawerVisible}
                        onClose={() => setDrawerVisible(false)}
                    />

                    {/* example data showing button */}
                    <Dropdown menu={{ items: exampleDataItems, onClick: onClickExampleDataItem }} placement="bottom" arrow>
                        <Button style={{ width: "30%" }} type='primary' variant="outlined" icon={<FolderViewOutlined />} iconPosition="end">
                            Example Data
                        </Button>
                    </Dropdown>
                </div>

                <Title level={5}>Key Features</Title>

                <Card
                    variant="outlined"
                    style={{ background: '#f0f5ff', width: '100%' }}
                    body={{ padding: 12 }}
                >
                    <Tag color='pink' style={{ fontSize: 15, padding: "5px 10px 5px 10px", marginBottom: 5 }}>Analyze non-random chromatin interactions with epigenetic track annotation</Tag>
                    <Tag color='purple' style={{ fontSize: 15, padding: "5px 10px 5px 10px", marginBottom: 5 }}>Visualize constructed 3D chromatin structures</Tag>
                    <Tag color='blue' style={{ fontSize: 15, padding: "5px 10px 5px 10px", marginBottom: 5 }}>Compare 3D structures across cell types</Tag>
                    <Tag color='green' style={{ fontSize: 15, padding: "5px 10px 5px 10px", marginBottom: 5 }}>Highlight and annotate selected genomic regions</Tag>
                    <Tag color='cyan' style={{ fontSize: 15, padding: "5px 10px 5px 10px", marginBottom: 5 }}>3D physical distance</Tag>
                </Card>

                <img src='graphical_abstract.png' style={{ width: '75%', marginTop: 30 }}></img>
                {/* <Title level={5}>Data Coverage</Title> */}

                {/* <div
                    ref={chartRef}
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginTop: 30
                    }}
                /> */}
            </Card>
        </div>
    );
};
