import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Typography, Card, Tag, Button, Dropdown } from 'antd';
import { GithubOutlined, ExperimentOutlined, FolderViewOutlined } from '@ant-design/icons';

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

const exampleDataItems = [
    {
        key: 'GM',
        label: 'GM12878-Chr8-127300000-128300000',
    },
    {
        key: 'IMR',
        label: 'IMR90-Chr8-127300000-128300000',
    }
]

const colors = d3.scaleOrdinal(antColors);
const { Title, Text } = Typography;

export const ProjectIntroduction = ({ setCellLineName, setChromosomeName, setSelectedChromosomeSequence }) => {
    const chartRef = useRef(null);

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
        if (key === 'GM') {
            setCellLineName('GM');
        }

        if (key === 'IMR') {
            setCellLineName('IMR');
        }
        setChromosomeName('chr8');
        setSelectedChromosomeSequence({ start: 127300000, end: 128300000 });
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
                            <a
                                href="https://github.com/ldu3/ChromPolymerDB_tutorial"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <GithubOutlined
                                    style={{
                                        fontSize: '30px',
                                        color: '#333',
                                        transition: 'color 0.3s'
                                    }}
                                />
                            </a>
                        </div>
                    </div>
                }
                style={{ width: '100%', marginBottom: 16 }}
                header={{ padding: '0 24px', background: '#fff' }}
                body={{ padding: 24 }}
            >
                <div style={{ width: "100%", textAlign: 'left', marginBottom: '10px' }}>
                    <Text italic>
                        The spatial organization of the genome plays a fundamental role in gene regulation, replication, and other biological processes. High-throughput chromosome conformation capture (Hi-C) techniques have advanced our understanding of genome architecture, but they primarily produce 2D, population-averaged data, limiting insights into individual cell chromatin structures. To bridge this gap, this project introduces a computational method and web-based platform designed for <Text mark>high-resolution visualization and analysis of single-cell 3D chromatin conformations.</Text>
                    </Text>
                </div>

                {/* example data showing button */}
                <Dropdown menu={{ items: exampleDataItems, onClick: onClickExampleDataItem }} placement="bottom" arrow>
                    <Button style={{ width: "30%" }} type='primary' variant="outlined" icon={<FolderViewOutlined />} iconPosition="end">
                        Example Data
                    </Button>
                </Dropdown>

                <Title level={5}>Key Features</Title>

                <Card
                    bordered={false}
                    style={{ background: '#f0f5ff', width: '100%' }}
                    body={{ padding: 12 }}
                >
                    <Tag color='pink' style={{ fontSize: 15, padding: "5px 10px 5px 10px", marginBottom: 5 }}>Analyze non-random chromatin interactions with epigenetic track annotation</Tag>
                    <Tag color='purple' style={{ fontSize: 15, padding: "5px 10px 5px 10px", marginBottom: 5 }}>Visualize constructed 3D chromatin structures</Tag>
                    <Tag color='blue' style={{ fontSize: 15, padding: "5px 10px 5px 10px", marginBottom: 5 }}>Compare 3D structures across cell types</Tag>
                    <Tag color='green' style={{ fontSize: 15, padding: "5px 10px 5px 10px", marginBottom: 5 }}>Highlight and annotate selected genomic regions</Tag>
                    <Tag color='cyan' style={{ fontSize: 15, padding: "5px 10px 5px 10px", marginBottom: 5 }}>3D physical distance</Tag>
                </Card>

                <Title level={5}>Data Coverage</Title>

                <div
                    ref={chartRef}
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginTop: 30
                    }}
                />
            </Card>
        </div>
    );
};
