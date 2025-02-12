import React, { useState } from 'react';
import {
    Collapse,
    Typography,
    Tabs,
    Card,
    Row,
    Col,
    Tag,
    Space
} from 'antd';
import {
    CodeOutlined,
    DatabaseOutlined,
    EyeOutlined,
    ExperimentOutlined,
    FileExcelOutlined,
    LinkOutlined
} from '@ant-design/icons';

const { Panel } = Collapse;
const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

export const ProjectIntroduction = () => {

    return (
        <div style={{ width: 1200, margin: '0 auto', padding: '24px' }}>
            <Title
                level={2}
                style={{ color: '#1890ff', textAlign: 'center', marginBottom: '50px' }}
            >
                <ExperimentOutlined /> ChromPolymerDB
            </Title>

            {/* Project Overview */}
            <Collapse
                expandIconPosition="end"
                defaultActiveKey={['overview']}
                style={{ width: '100%' }}
            >
                <Panel
                    key="overview"
                    header={
                        <div style={{ width: '100%', textAlign: 'center', position: 'relative' }}>
                            <Title level={4} style={{ margin: 0 }}>
                                Introduction
                            </Title>
                            <div
                                style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: '50%',
                                    transform: 'translateY(-50%)'
                                }}
                            >
                                <LinkOutlined style={{ fontSize: '16px' }} />
                            </div>
                        </div>
                    }
                >
                    <div style={{ width: "100%", textAlign: 'left', marginBottom: '10px' }}>
                        <Text italic>
                            The spatial organization of the genome plays a fundamental role in gene regulation, replication, and other biological processes. High-throughput chromosome conformation capture (Hi-C) techniques have advanced our understanding of genome architecture, but they primarily produce 2D, population-averaged data, limiting insights into individual cell chromatin structures. To bridge this gap, this project introduces a computational method and web-based platform designed for <Text mark>high-resolution visualization and analysis of single-cell 3D chromatin conformations.</Text>
                        </Text>
                    </div>

                    <Title level={5}>Key Features</Title>
                    <Card bordered={false} style={{ background: '#f0f5ff', width: '100%' }}>
                                <Tag color='pink'>High-resolution visualization</Tag>
                                <Tag color='purple'>Single-cell 3D chromatin conformations analysis</Tag>
                                <Tag color='blue'>Interactive visualization of chromatin interactions and structural heterogeneity</Tag>
                                <Tag color='green'>Distance measurement</Tag>
                                <Tag color='cyan'>Cross-cell type comparions</Tag>
                                <Tag color='red'>Distance Measurement</Tag>
                                <Tag color='orange'>Data Export</Tag>
                    </Card>
                </Panel>
            </Collapse>
        </div>
    );
};
