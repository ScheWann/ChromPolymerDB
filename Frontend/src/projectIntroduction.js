import React, { useState } from 'react';
import {
    Collapse,
    Typography,
    Tabs,
    Card,
    Grid,
    Row,
    Col,
    Tag,
    Space,
    Button
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
    const [activeTechTab, setActiveTechTab] = useState('frontend');

    const techTabsHandler = (key) => {
        setActiveTechTab(key);
    };

    return (
        <div style={{ width: 1200, margin: '0 auto', padding: '24px' }}>
            <Title level={2} style={{ color: '#1890ff', marginBottom: '32px' }}>
                <ExperimentOutlined /> ChromPolymerDB
            </Title>

            {/* Project Overview */}
            <Collapse defaultActiveKey={['overview']} ghost>
                <Panel
                    header={
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <Title level={4} style={{ margin: 0 }}>Overview</Title>
                        </div>
                    }
                    key="overview"
                    extra={<LinkOutlined />}
                >
                    <Paragraph strong>
                        ChromPolymerDB bridges 2D Hi-C data and <Text mark>3D chromatin visualization</Text> through:
                    </Paragraph>

                    <Row gutter={[16, 16]}>
                        <Col xs={24} md={12}>
                            <Card bordered={false} style={{ background: '#f0f5ff' }}>
                                <Tag color='pink'>Single-cell 3D conformation modeling</Tag>
                                <Tag color='purple'>Interactive spatial analysis</Tag>
                                <Tag color='blue'>Cross-cell type comparisons</Tag>
                            </Card>
                        </Col>
                        <Col xs={24} md={12}>
                            <Card bordered={false} style={{ background: '#f0f5ff' }}>
                                <Text italic>
                                    "This platform integrates polymer physics with genomics to
                                    revolutionize chromatin structure analysis."
                                </Text>
                            </Card>
                        </Col>
                    </Row>
                </Panel>
            </Collapse>

            {/* Technical Architecture */}
            <Collapse style={{ marginTop: '24px' }}>
                <Panel
                    header={
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <Title level={4} style={{ margin: 0 }}>Technical Architecture</Title>
                        </div>
                    }
                    key="architecture"
                >
                    <Tabs activeKey={activeTechTab} onChange={techTabsHandler}>
                        <TabPane
                            key="frontend"
                            tab={
                                <span>
                                    <EyeOutlined /> Frontend
                                </span>
                            }
                        >
                            <Title level={5} style={{ marginTop: '16px' }}>Visualization Stack</Title>
                            <Space direction="vertical">
                                <Tag color="blue">React + Three.js</Tag>
                                <Tag color="cyan">Interactive 3D Manipulation</Tag>
                                <Tag color="green">Oncogene Highlighting</Tag>
                            </Space>
                        </TabPane>

                        <TabPane
                            key="backend"
                            tab={
                                <span>
                                    <CodeOutlined /> Backend
                                </span>
                            }
                        >
                            <Title level={5} style={{ marginTop: '16px' }}>Processing Pipeline</Title>
                            <Space direction="vertical">
                                <Tag color='purple'>Polymer physics simulation</Tag>
                                <Tag color='pink'>Flask API endpoints</Tag>
                            </Space>
                        </TabPane>

                        <TabPane
                            key="data"
                            tab={
                                <span>
                                    <DatabaseOutlined /> Data
                                </span>
                            }
                        >
                            <Title level={5} style={{ marginTop: '16px' }}>Data Management</Title>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Card size="small">
                                        <Text strong>Storage</Text>
                                        <p>PostgreSQL</p>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card size="small">
                                        <Text strong>Export</Text>
                                        <p><FileExcelOutlined /> CSV/JSON</p>
                                    </Card>
                                </Col>
                            </Row>
                        </TabPane>
                    </Tabs>
                </Panel>
            </Collapse>

            {/* Key Features */}
            <Collapse style={{ marginTop: '24px' }}>
                <Panel
                    header={
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <Title level={4} style={{ margin: 0 }}>Key Features</Title>
                        </div>
                    }
                    key="features"
                >
                    <Row gutter={[16, 16]}>
                        <Col xs={24} md={12}>
                            <Card
                                title="🧬 Structural Analysis"
                                headStyle={{ background: '#f6ffed' }}
                            >
                                <ul>
                                    <li>Single-cell modeling</li>
                                    <li>Population averaging</li>
                                    <li>Dynamic sampling</li>
                                </ul>
                            </Card>
                        </Col>

                        <Col xs={24} md={12}>
                            <Card
                                title="🔬 Comparative Tools"
                                headStyle={{ background: '#fffbe6' }}
                            >
                                <ul>
                                    <li>Healthy vs. Cancer</li>
                                    <li>3D heatmaps</li>
                                    <li>Gene co-localization</li>
                                </ul>
                            </Card>
                        </Col>
                    </Row>
                </Panel>
            </Collapse>
        </div>
    );
};
