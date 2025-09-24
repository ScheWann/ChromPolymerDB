import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Typography, Card, Tag, Button, Dropdown, Timeline } from 'antd';
import { ProfileOutlined, ExperimentOutlined, FolderViewOutlined, ClockCircleOutlined } from '@ant-design/icons';
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

export const ProjectIntroduction = ({ 
    exampleDataItems, 
    setCellLineName, 
    setChromosomeName, 
    setSelectedChromosomeSequence, 
    setStartInputValue, 
    setEndInputValue,
    handleAddBintuHeatmap,
    handleAddGseHeatmap
}) => {
    const chartRef = useRef(null);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [timelineItems, setTimelineItems] = useState([]);
    
    // Create dropdown-safe items (avoid passing unknown props like `cellLine` to DOM)
    const dropdownItems = exampleDataItems.map(({ key, label }) => ({ key, label }));
    
    // Create Bintu-specific dropdown items based on available Bintu datasets
    const bintuDropdownItems = [
        { key: 'bintu', label: 'Image Data (Bintu)' },
        { key: 'gse', label: 'Single-cell HiC Data' },
    ];

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

    useEffect(() => {
        fetch('/timeline.json')
            .then(res => res.json())
            .then(json => {
                const sorted = [...json].sort((a, b) => new Date(b.label) - new Date(a.label));
                setTimelineItems(sorted);
            })
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

    const onClickBintuDataItem = ({ key }) => {
        if (key === 'bintu' && handleAddBintuHeatmap) {
            handleAddBintuHeatmap();
        } else if (key === 'gse' && handleAddGseHeatmap) {
            handleAddGseHeatmap();
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
                {/* Introduction Text */}
                <div style={{ width: "100%", textAlign: 'left', marginBottom: '10px' }}>
                    <Text style={{ fontSize: '1rem', lineHeight: 1.5 }}>
                        The three-dimensional (3D) organization of chromatin plays a critical role in regulating gene expression and genomic processes like DNA replication, repair, and genome stability. Although these processes occur at the individual-cell level, most chromatin structure data are derived from population-averaged assays, such as Hi-C, obscuring the heterogeneity of single-cell conformations. To address this limitation, we developed a polymer physics-based modelling framework, the Sequential Bayesian Inference Framework (sBIF), that deconvolutes bulk Hi-C data to reconstruct single-cell 3D chromatin conformations. To support a broader use of sBIF, we created ChromPolymerDB, a publicly accessible, high-resolution database of single-cell chromatin structures inferred by sBIF. The database contains ~108 reconstructed 5 kb-resolution single cell structures, spanning over 60,000 genomic loci across 50 human cell types and experimental conditions. ChromPolymerDB features an interactive web interface with tools for 3D structural analysis and multi-omics integration. Users can explore associations between chromatin conformation and gene expression, epigenetic modifications, and regulatory elements. The platform also supports comparative analyses to identify structural changes across cell types, developmental stages, or disease contexts. ChromPolymerDB offers a unique resource for researchers studying the relationship between genome architecture and gene regulation, and for advancing comparative 3D genomics.
                    </Text>
                </div>

                {/* Tutorial and Example Data Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <Button style={{ width: "30%", color: 'white', backgroundColor: '#9d4edd', border: 'none' }} color='pink' variant="outlined" icon={<ProfileOutlined />} iconPosition="end" onClick={() => setDrawerVisible(true)} >
                        Tutorial
                    </Button>
                    <TutorialDrawer
                        visible={drawerVisible}
                        onClose={() => setDrawerVisible(false)}
                    />
                    <Dropdown menu={{ items: dropdownItems, onClick: onClickExampleDataItem }} placement="bottom" arrow>
                        <Button style={{ width: "30%" }} type='primary' variant="outlined" icon={<FolderViewOutlined />} iconPosition="end">
                            Example Data
                        </Button>
                    </Dropdown>
                </div>


                {/* Experimental Single-cell Hi-C Data */}
                <Title level={5}>Experimental Single-cell Hi-C Data</Title>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <Dropdown menu={{ items: bintuDropdownItems, onClick: onClickBintuDataItem }} placement="bottom" arrow>
                        <Button style={{ width: "30%" }} type='default' variant="outlined" icon={<FolderViewOutlined />} iconPosition="end">
                            Experimental Single-cell Hi-C Data
                        </Button>
                    </Dropdown>
                </div>


                {/* Key Features */}
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

                {/* Graphical Abstract */}
                <img src='graphical_abstract.png' style={{ width: '100%', marginTop: 30 }}></img>
                
                {/* News and Updates Timeline */}
                <Title level={5} style={{ marginTop: 30 }}>News and Updates</Title>
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <Timeline
                        mode="alternate"
                        className="project-intro-timeline"
                        style={{ width: '50%', marginTop: 20 }}
                        items={timelineItems.map(it => ({
                            color: it.color,
                            label: <span className="timeline-item-label">{it.label}</span>,
                                children: <div className="timeline-item-card">{it.text}</div>
                            }))}
                        />
                </div>

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
