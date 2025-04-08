import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { Button, Tooltip, Switch, Dropdown, Modal, Table, Spin, InputNumber, Space, Slider, Input } from 'antd';
import { DownloadOutlined, SearchOutlined } from "@ant-design/icons";
import { IgvViewer } from './igvViewer.js';
import Highlighter from 'react-highlight-words';
import "./Styles/heatmapTriangle.css";
import * as htmlToImage from 'html-to-image';
import { jsPDF } from "jspdf";
// import { TriangleGeneList } from './triangleGeneList.js';

export const HeatmapTriangle = ({ cellLineName, chromosomeName, geneName, currentChromosomeSequence, geneList, totalChromosomeSequences, currentChromosomeData, changeColorByInput, fqRawcMode, colorScaleRange, changeColorScale, igvMountStatus }) => {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const axisSvgRef = useRef(null);
    const brushSvgRef = useRef(null);

    const [minCanvasDimension, setMinCanvasDimension] = useState(0);
    const [brushedTriangleRange, setBrushedTriangleRange] = useState({ start: 0, end: 0 });
    const [fullTriangleVisible, setFullTriangleVisible] = useState(false);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [trackTableModalVisible, setTrackTableModalVisible] = useState(false);
    const [trackDataSource, setTrackDataSource] = useState([]);
    const [selectedTrackData, setSelectedTrackData] = useState([]);
    const [trackKey, setTrackKey] = useState(null);
    const [uploadTrackData, setUploadTrackData] = useState({ name: "", trackUrl: "" });
    const [canvasUnitRectSize, setCanvasUnitRectSize] = useState(0);

    // Track table search
    const [searchText, setSearchText] = useState('');
    const [searchedColumn, setSearchedColumn] = useState('');
    const searchInput = useRef(null);

    // Download fucction dropdown menu items
    const downloadItems = [
        {
            key: '1',
            label: 'Download PNG',
        },
        {
            key: '2',
            label: 'Download PDF',
        }
    ]

    // Tracks dropdown menu items
    const trackItems = [
        {
            key: '1',
            label: 'ENCODE Signals - ChIP'
        },
        {
            key: '2',
            label: 'ENCODE Signals - Other'
        },
        {
            key: '3',
            label: 'ENCODE Other'
        },
        {
            key: '4',
            label: 'Local Tracks'
        }
        // {
        //     key: '4',
        //     label: '4DN tracks'
        // }
    ];

    const getColumnSearchProps = (dataIndex) => ({
        filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters, close }) => (
            <div
                style={{
                    padding: 8,
                }}
                onKeyDown={(e) => e.stopPropagation()}
            >
                <Input
                    ref={searchInput}
                    placeholder={`Search ${dataIndex}`}
                    value={selectedKeys[0]}
                    onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                    onPressEnter={() => handleSearch(selectedKeys, confirm, dataIndex)}
                    style={{
                        marginBottom: 8,
                        display: 'block',
                    }}
                />
                <Space>
                    <Button
                        type="primary"
                        variant="outlined"
                        onClick={() => handleSearch(selectedKeys, confirm, dataIndex)}
                        icon={<SearchOutlined />}
                        size="small"
                        style={{
                            width: 90,
                        }}
                    >
                        Search
                    </Button>
                    <Button
                        onClick={() => clearFilters && handleReset(clearFilters)}
                        size="small"
                        style={{
                            width: 90,
                        }}
                    >
                        Reset
                    </Button>
                    <Button
                        type="link"
                        size="small"
                        onClick={() => {
                            close();
                        }}
                    >
                        close
                    </Button>
                </Space>
            </div>
        ),
        filterIcon: (filtered) => (
            <SearchOutlined
                style={{
                    margin: 0,
                    color: filtered ? '#1677ff' : undefined,
                }}
            />
        ),
        onFilter: (value, record) =>
            record[dataIndex].toString().toLowerCase().includes(value.toLowerCase()),
        filterDropdownProps: {
            onOpenChange(open) {
                if (open) {
                    setTimeout(() => searchInput.current?.select(), 100);
                }
            },
        },
        render: (text) =>
            searchedColumn === dataIndex ? (
                <Highlighter
                    highlightStyle={{
                        backgroundColor: '#ffc069',
                        padding: 0,
                    }}
                    searchWords={[searchText]}
                    autoEscape
                    textToHighlight={text ? text.toString() : ''}
                />
            ) : (
                text
            ),
    });

    const trackTableColumns = [
        {
            title: "Biosample",
            dataIndex: "Biosample",
            key: "Biosample",
            width: 150,
            sorter: (a, b) => a.Biosample.localeCompare(b.Biosample),
            sortDirections: ["ascend", "descend"],
            ...getColumnSearchProps('Biosample'),
            onHeaderCell: () => ({
                style: {
                    fontSize: "12px",
                    fontWeight: "bold",
                    textAlign: "center",
                    height: "50px",
                    lineHeight: "50px",
                    padding: 0,
                    backgroundColor: "#f8f8f8",
                },
            }),
        },
        {
            title: "AssayType",
            dataIndex: "AssayType",
            key: "AssayType",
            width: 120,
            sorter: (a, b) => a.AssayType.localeCompare(b.AssayType),
            sortDirections: ["ascend", "descend"],
            ...getColumnSearchProps('AssayType'),
            onHeaderCell: () => ({
                style: {
                    fontSize: "12px",
                    fontWeight: "bold",
                    textAlign: "center",
                    height: "50px",
                    lineHeight: "50px",
                    padding: 0,
                    backgroundColor: "#f8f8f8",
                },
            }),
        },
        {
            title: "Target",
            dataIndex: "Target",
            key: "Target",
            width: 120,
            sorter: (a, b) => a.Target.localeCompare(b.Target),
            sortDirections: ["ascend", "descend"],
            ...getColumnSearchProps('Target'),
            onHeaderCell: () => ({
                style: {
                    fontSize: "12px",
                    fontWeight: "bold",
                    textAlign: "center",
                    height: "50px",
                    lineHeight: "50px",
                    padding: 0,
                },
            }),
        },
        {
            title: "BioRep",
            dataIndex: "BioRep",
            key: "BioRep",
            width: 120,
            sorter: (a, b) => a.BioRep.localeCompare(b.BioRep),
            sortDirections: ["ascend", "descend"],
            ...getColumnSearchProps('BioRep'),
            onHeaderCell: () => ({
                style: {
                    fontSize: "12px",
                    fontWeight: "bold",
                    textAlign: "center",
                    height: "50px",
                    lineHeight: "50px",
                    padding: 0,
                },
            }),
        },
        {
            title: "TechRep",
            dataIndex: "TechRep",
            key: "TechRep",
            width: 120,
            sorter: (a, b) => a.TechRep.localeCompare(b.TechRep),
            sortDirections: ["ascend", "descend"],
            ...getColumnSearchProps('TechRep'),
            onHeaderCell: () => ({
                style: {
                    fontSize: "12px",
                    fontWeight: "bold",
                    textAlign: "center",
                    height: "50px",
                    lineHeight: "50px",
                    padding: 0,
                },
            }),
        },
        {
            title: "OutputType",
            dataIndex: "OutputType",
            key: "OutputType",
            width: 120,
            sorter: (a, b) => a.OutputType.localeCompare(b.OutputType),
            sortDirections: ["ascend", "descend"],
            ...getColumnSearchProps('OutputType'),
            onHeaderCell: () => ({
                style: {
                    fontSize: "12px",
                    fontWeight: "bold",
                    textAlign: "center",
                    height: "50px",
                    lineHeight: "50px",
                    padding: 0,
                },
            }),
        },
        {
            title: "Format",
            dataIndex: "Format",
            key: "Format",
            width: 120,
            sorter: (a, b) => a.Format.localeCompare(b.Format),
            sortDirections: ["ascend", "descend"],
            ...getColumnSearchProps('Format'),
            onHeaderCell: () => ({
                style: {
                    fontSize: "12px",
                    fontWeight: "bold",
                    textAlign: "center",
                    height: "50px",
                    lineHeight: "50px",
                    padding: 0,
                },
            }),
        },
        {
            title: "Lab",
            dataIndex: "Lab",
            key: "Lab",
            width: 120,
            sorter: (a, b) => a.Lab.localeCompare(b.Lab),
            sortDirections: ["ascend", "descend"],
            ...getColumnSearchProps('Lab'),
            onHeaderCell: () => ({
                style: {
                    fontSize: "12px",
                    fontWeight: "bold",
                    textAlign: "center",
                    height: "50px",
                    lineHeight: "50px",
                    padding: 0,
                },
            }),
        },
        {
            title: "Accession",
            dataIndex: "Accession",
            key: "Accession",
            width: 120,
            sorter: (a, b) => a.Accession.localeCompare(b.Accession),
            sortDirections: ["ascend", "descend"],
            ...getColumnSearchProps('Accession'),
            onHeaderCell: () => ({
                style: {
                    fontSize: "12px",
                    fontWeight: "bold",
                    textAlign: "center",
                    height: "50px",
                    lineHeight: "50px",
                    padding: 0,
                },
            }),
        },
        {
            title: "Experiment",
            dataIndex: "Experiment",
            key: "Experiment",
            width: 150,
            sorter: (a, b) => a.Experiment.localeCompare(b.Experiment),
            sortDirections: ["ascend", "descend"],
            ...getColumnSearchProps('Experiment'),
            onHeaderCell: () => ({
                style: {
                    fontSize: "12px",
                    fontWeight: "bold",
                    textAlign: "center",
                    height: "50px",
                    lineHeight: "50px",
                    padding: 0,
                },
            }),
        },
    ];

    const trackTableColumns4DN = [
        {
            title: "Project",
            dataIndex: "Project",
            key: "Project",
            width: 100,
            sorter: (a, b) => a.Project.localeCompare(b.Project),
            sortDirections: ["ascend", "descend"],
            onHeaderCell: () => ({
                style: {
                    fontSize: "12px",
                    fontWeight: "bold",
                    textAlign: "center",
                    height: "50px",
                    lineHeight: "50px",
                    padding: 0,
                    backgroundColor: "#f8f8f8",
                },
            }),
        },
        {
            title: "Type",
            dataIndex: "Type",
            key: "Type",
            width: 120,
            sorter: (a, b) => a.Type.localeCompare(b.Type),
            sortDirections: ["ascend", "descend"],
            onHeaderCell: () => ({
                style: {
                    fontSize: "12px",
                    fontWeight: "bold",
                    textAlign: "center",
                    height: "50px",
                    lineHeight: "50px",
                    padding: 0,
                },
            }),
        },
        {
            title: "Biosource",
            dataIndex: "Biosource",
            key: "Biosource",
            width: 80,
            sorter: (a, b) => a.Biosource.localeCompare(b.Biosource),
            sortDirections: ["ascend", "descend"],
            onHeaderCell: () => ({
                style: {
                    fontSize: "12px",
                    fontWeight: "bold",
                    textAlign: "center",
                    height: "50px",
                    lineHeight: "50px",
                    padding: 0,
                },
            }),
        },
        {
            title: "Assay",
            dataIndex: "Assay",
            key: "Assay",
            width: 80,
            sorter: (a, b) => a.Assay.localeCompare(b.Assay),
            sortDirections: ["ascend", "descend"],
            onHeaderCell: () => ({
                style: {
                    fontSize: "12px",
                    fontWeight: "bold",
                    textAlign: "center",
                    height: "50px",
                    lineHeight: "50px",
                    padding: 0,
                },
            }),
        },
        {
            title: "Replicate",
            dataIndex: "Replicate",
            key: "Replicate",
            width: 120,
            sorter: (a, b) => a.Replicate.localeCompare(b.Replicate),
            sortDirections: ["ascend", "descend"],
            onHeaderCell: () => ({
                style: {
                    fontSize: "12px",
                    fontWeight: "bold",
                    textAlign: "center",
                    height: "50px",
                    lineHeight: "50px",
                    padding: 0,
                },
            }),
        },
        {
            title: "Dataset",
            dataIndex: "Dataset",
            key: "Dataset",
            width: 100,
            sorter: (a, b) => a.Dataset.localeCompare(b.Dataset),
            sortDirections: ["ascend", "descend"],
            onHeaderCell: () => ({
                style: {
                    fontSize: "12px",
                    fontWeight: "bold",
                    textAlign: "center",
                    height: "50px",
                    lineHeight: "50px",
                    padding: 0,
                },
            }),
        },
        {
            title: "Description",
            dataIndex: "name",
            key: "Description",
            width: 100,
            sorter: (a, b) => a.name.localeCompare(b.name),
            sortDirections: ["ascend", "descend"],
            onHeaderCell: () => ({
                style: {
                    fontSize: "12px",
                    fontWeight: "bold",
                    textAlign: "center",
                    height: "50px",
                    lineHeight: "50px",
                    padding: 0,
                },
            }),
        },
        {
            title: "Lab",
            dataIndex: "Lab",
            key: "Lab",
            width: 120,
            sorter: (a, b) => a.Lab.localeCompare(b.Lab),
            sortDirections: ["ascend", "descend"],
            onHeaderCell: () => ({
                style: {
                    fontSize: "12px",
                    fontWeight: "bold",
                    textAlign: "center",
                    height: "50px",
                    lineHeight: "50px",
                    padding: 0,
                },
            }),
        },
        {
            title: "Publication",
            dataIndex: "Publication",
            key: "Publication",
            width: 120,
            sorter: (a, b) => a.Publication.localeCompare(b.Publication),
            sortDirections: ["ascend", "descend"],
            onHeaderCell: () => ({
                style: {
                    fontSize: "12px",
                    fontWeight: "bold",
                    textAlign: "center",
                    height: "50px",
                    lineHeight: "50px",
                    padding: 0,
                },
            }),
        },
        {
            title: "Accession",
            dataIndex: "Accession",
            key: "Accession",
            width: 120,
            sorter: (a, b) => a.Accession.localeCompare(b.Accession),
            sortDirections: ["ascend", "descend"],
            onHeaderCell: () => ({
                style: {
                    fontSize: "12px",
                    fontWeight: "bold",
                    textAlign: "center",
                    height: "50px",
                    lineHeight: "50px",
                    padding: 0,
                },
            }),
        }
    ];

    const modalStyles = {
        body: {
            height: trackKey === '4' ? '75%' : '90%',
            display: 'flex',
            alignItems: 'center',
        },
        content: {
            height: trackKey === '4' ? '25vh' : '80vh',
            padding: trackKey === '4' ? "50px 10px 10px 10px" : "40px 10px 0px 10px"
        }
    };

    const handleSearch = (selectedKeys, confirm, dataIndex) => {
        confirm();
        setSearchText(selectedKeys[0]);
        setSearchedColumn(dataIndex);
    };

    const handleReset = (clearFilters) => {
        clearFilters();
        setSearchText('');
    };

    const uploadTrackChange = (e) => {
        const { name, value } = e.target;
        setUploadTrackData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const downloadImage = () => {
        const container = containerRef.current;
        if (!container) return;

        container.style.overflow = 'visible';
        const width = container.scrollWidth;
        const height = container.scrollHeight;

        htmlToImage.toPng(container, {
            width,
            height,
            filter: (node) => {
                if (node.id === 'triangle-control-button-group') {
                    return false;
                }
                return true;
            },
            style: {
                backgroundColor: 'white',
            },
        })
            .then((dataUrl) => {
                const link = document.createElement('a');
                link.download = 'heatmap-igv.png';
                link.href = dataUrl;
                link.click();
            })
            .catch((error) => {
                console.error('oops, something went wrong!', error);
            });
    };

    const downloadPdf = () => {
        const container = containerRef.current;
        if (!container) return;

        container.style.overflow = 'visible';
        const width = container.scrollWidth;
        const height = container.scrollHeight;

        htmlToImage.toPng(container, {
            width,
            height,
            filter: (node) => {
                if (node.id === 'triangle-control-button-group') {
                    return false;
                }
                return true;
            },
            style: {
                backgroundColor: 'white',
            },
        })
            .then((dataUrl) => {
                const pdf = new jsPDF('l', 'pt', [width, height]);
                pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
                pdf.save('heatmap-igv.pdf');
            })
            .catch((error) => {
                console.error('Wrong', error);
            });
    };


    const switchChange = () => {
        setFullTriangleVisible(!fullTriangleVisible);
        setBrushedTriangleRange({ start: 0, end: 0 });
    };

    const closeTrackTableModal = () => {
        setTrackTableModalVisible(false);
        setUploadTrackData({ name: "", trackUrl: "" });
        setSearchedColumn('');
        setSearchText('');
    };

    const trackTableProcessing = (key, data) => {
        const rows = data.split('\n').filter(row => row.trim() !== '');
        const headers = rows[0].split('\t');
        let targetColumns;

        if (key !== '4') {
            targetColumns = [
                'Biosample', 'AssayType', 'Target', 'BioRep', 'TechRep', 'OutputType', 'Format', 'Lab', 'Accession', 'Experiment', 'HREF'
            ];
        } else {
            targetColumns = [
                'Project', 'Assembly', 'Type', 'Biosource', 'Assay', 'Replicate', 'Dataset', 'name', 'Lab', 'Publication', 'Accession', 'url', 'Experiment', 'color', 'altColor'
            ];
        }

        return rows.slice(1).map((row, index) => {
            const columns = row.split('\t');

            const dataObj = targetColumns.reduce((acc, col, i) => {
                const colIndex = headers.indexOf(col);
                if (colIndex !== -1) {
                    acc[col] = columns[colIndex];
                }
                return acc;
            }, {});

            return {
                key: index + 1,
                ...dataObj
            };
        }).filter(obj => Object.keys(obj).length > 1);
    };

    const rowSelection = {
        onChange: (selectedRowKeys, selectedRows) => {
            setSelectedTrackData(selectedRows);
        },
        fixed: 'left',
    };

    const onClickTrackItem = ({ key }) => {
        setTrackTableModalVisible(true);
        setTrackKey(key);
        setTrackDataSource([]);

        // ENCODE Signals - ChIP
        if (key === '1') {
            fetch('https://s3.amazonaws.com/igv.org.app/encode/GRCh38.signals.chip.txt')
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.text();
                })
                .then(data => {
                    setTrackDataSource(trackTableProcessing(key, data));
                    setTrackTableModalVisible(true);
                })
                .catch(error => {
                    console.error('Error fetching data:', error);
                });
        }

        // ENCODE Signals - Other
        if (key === '2') {
            fetch('https://s3.amazonaws.com/igv.org.app/encode/GRCh38.signals.other.txt')
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.text();
                })
                .then(data => {
                    setTrackDataSource(trackTableProcessing(key, data));
                    setTrackTableModalVisible(true);
                })
                .catch(error => {
                    console.error('Error fetching data:', error);
                });
        }

        // ENCODE Other
        if (key === '3') {
            fetch('https://s3.amazonaws.com/igv.org.app/encode/GRCh38.other.txt')
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.text();
                })
                .then(data => {
                    setTrackDataSource(trackTableProcessing(key, data));
                    setTrackTableModalVisible(true);
                })
                .catch(error => {
                    console.error('Error fetching data:', error);
                });
        }
    };

    const onClickDownloadItem = ({ key }) => {
        if (key === '1') {
            console.log("download png");
            downloadImage();
        }

        if (key === '2') {
            console.log("download pdf");
            downloadPdf();
        }
    }

    const confirmTrackSelection = () => {
        setTrackTableModalVisible(false);
        setUploadTrackData({ name: "", trackUrl: "" });
    };

    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                setContainerSize({ width, height });
            }
        });

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            observer.disconnect();
        };
    }, []);

    useEffect(() => {
        if (!containerSize.width && !containerSize.height) return;

        setBrushedTriangleRange({ start: 0, end: 0 });

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        const margin = { top: 5, right: 5, bottom: 5, left: 5 };
        const parentWidth = containerSize.width;
        const parentHeight = containerSize.height;

        const width = (Math.min(parentWidth, parentHeight) - margin.left - margin.right);
        const height = (Math.min(parentWidth, parentHeight) - margin.top - margin.bottom);

        canvas.width = width * Math.sqrt(2);
        canvas.height = height / Math.sqrt(2);

        setMinCanvasDimension(canvas.width);
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Apply rotation transformation
        context.scale(1, -1)
        context.translate(canvas.width / 2, -canvas.height * 2);
        context.rotate(Math.PI / 4);

        const { start, end } = currentChromosomeSequence;
        const maxRectSize = 10;
        const step = 5000;
        const adjustedStart = Math.floor(start / step) * step;
        const adjustedEnd = Math.ceil(end / step) * step;

        const axisValues = Array.from(
            { length: Math.floor((adjustedEnd - adjustedStart) / step) + 1 },
            (_, i) => adjustedStart + i * step
        );

        const xScale = d3.scaleLinear()
            .domain([currentChromosomeSequence.start, currentChromosomeSequence.end])
            .range([0, width - margin.left - margin.right]);

        const yScale = d3.scaleLinear()
            .domain([currentChromosomeSequence.start, currentChromosomeSequence.end])
            .range([height - margin.top - margin.bottom, 0]);

        const transformedXScale = d3.scaleLinear()
            .domain([d3.min(axisValues), d3.max(axisValues)])
            .range([0, canvas.width]);

        const colorScale = d3.scaleSequential(
            t => d3.interpolateReds(t * 0.8 + 0.2)
        ).domain(colorScaleRange);

        const invertPosition = (scale, value) => {
            return scale.invert(value);
        };

        const fqMap = new Map();
        currentChromosomeData.forEach(d => {
            fqMap.set(`X:${d.ibp}, Y:${d.jbp}`, { fq: d.fq, fdr: d.fdr, rawc: d.rawc });
        });

        const hasData = (ibp, jbp) => {
            const inRange = totalChromosomeSequences.some(seq =>
                ibp >= seq.start && ibp <= seq.end &&
                jbp >= seq.start && jbp <= seq.end
            );

            return inRange;
        };

        axisValues.forEach(ibp => {
            axisValues.forEach(jbp => {
                const { fq, fdr, rawc } = fqMap.get(`X:${ibp}, Y:${jbp}`) || { fq: -1, fdr: -1, rawc: -1 };

                const x = margin.left + xScale(jbp);
                const y = margin.top + yScale(ibp);
                let rectWidth = xScale(ibp + step) - xScale(ibp);
                let rectHeight = yScale(jbp) - yScale(jbp + step);

                if (rectWidth > maxRectSize || rectHeight > maxRectSize) {
                    const scaleFactor = Math.min(maxRectSize / rectWidth, maxRectSize / rectHeight);
                    const adjustedStep = step * scaleFactor;

                    rectWidth = xScale(ibp + adjustedStep) - xScale(ibp);
                    rectHeight = yScale(jbp) - yScale(jbp + adjustedStep);
                }

                rectWidth = Math.round(rectWidth);
                rectHeight = Math.round(rectHeight);
                setCanvasUnitRectSize(rectWidth);

                if (!fullTriangleVisible) {
                    context.fillStyle = !hasData(ibp, jbp) ? 'white' : (fdr > 0.05 || (fdr === -1 && fq === -1 && rawc === -1)) ? 'white' : colorScale(fqRawcMode ? fq : rawc);
                } else {
                    context.fillStyle = !hasData(ibp, jbp) ? 'white' : (jbp <= ibp) ? 'white' : colorScale(fqRawcMode ? fq : rawc);
                }
                context.fillRect(x, y, rectWidth, rectHeight);
            });
        });

        const updateAxisWithBrushRange = (start, end) => {
            const startX = transformedXScale(start);
            const endX = transformedXScale(end);

            axisSvg.selectAll('.range-line').remove();

            axisSvg.append("line")
                .attr('class', 'range-line')
                .attr("x1", startX + margin.left)
                .attr("y1", 0)
                .attr("x2", startX + margin.left)
                .attr("y2", 50)
                .attr("stroke", "#C0C0C0")
                .attr("stroke-width", 3);

            axisSvg.append("line")
                .attr('class', 'range-line')
                .attr("x1", endX + margin.left)
                .attr("y1", 0)
                .attr("x2", endX + margin.left)
                .attr("y2", 50)
                .attr("stroke", "#C0C0C0")
                .attr("stroke-width", 3);
        };

        const brushSvg = d3.select(brushSvgRef.current)
            .attr('width', canvas.width)
            .attr('height', canvas.height);

        brushSvg.selectAll('*').remove();

        const clickableArea = [
            [canvas.width / 2, margin.top],
            [0, canvas.height],
            [canvas.width, canvas.height - margin.bottom],
        ];

        // Limit the clickable area to the triangle
        brushSvg.append('polygon')
            .attr('points', clickableArea.map(d => d.join(',')).join(' '))
            .attr('fill', 'transparent')

        // Draw a brushed triangle area on click
        brushSvg.on('click', (e) => {
            const [mouseX, mouseY] = d3.pointer(e);

            brushSvg.selectAll('.triangle').remove();

            const snappedX = Math.floor(mouseX / canvasUnitRectSize) * canvasUnitRectSize + canvasUnitRectSize / 2;
            const snappedY = Math.floor(mouseY / canvasUnitRectSize) * canvasUnitRectSize;

            if (d3.polygonContains(clickableArea, [snappedX, snappedY])) {
                const offsetlength = (canvasUnitRectSize * Math.sqrt(2)) / 2;
                const length = canvas.height - snappedY - offsetlength;
                const pointBottomLeft = [Math.max(snappedX - length, 0), Math.min(snappedY + length, canvas.height - offsetlength)];
                const pointBottomRight = [Math.min(snappedX + length, canvas.width), Math.min(snappedY + length, canvas.height - offsetlength)];

                const trianglePoints = [
                    [snappedX, snappedY],
                    pointBottomLeft,
                    pointBottomRight,
                ];

                const brushedTriangleRangeStart = invertPosition(transformedXScale, snappedX - length);
                const brushedTriangleRangeEnd = invertPosition(transformedXScale, snappedX + length);

                brushSvg.append('polygon')
                    .attr('class', 'triangle')
                    .attr('points', trianglePoints.map(d => d.join(',')).join(' '))
                    .attr('fill', '#808080')
                    .attr('opacity', 0.5);

                updateAxisWithBrushRange(brushedTriangleRangeStart, brushedTriangleRangeEnd);
                setBrushedTriangleRange({ start: brushedTriangleRangeStart, end: brushedTriangleRangeEnd });
            } else {
                setBrushedTriangleRange({ start: 0, end: 0 });
                axisSvg.selectAll('.range-line').remove();
            }
        });

        const axisSvg = d3.select(axisSvgRef.current)
            .attr('width', canvas.width + margin.left + margin.right)

        axisSvg.selectAll('*').remove();

        // X-axis
        axisSvg.append('g')
            .attr("transform", "translate(2, 0)")
            .call(d3.axisBottom(transformedXScale)
                .tickFormat(d => (d / 1e6).toFixed(3) + 'M'))
            .selectAll("text")
            .style("text-anchor", "middle")
            .attr("dx", "0em")
            .attr("dy", "1em");
    }, [currentChromosomeData, fullTriangleVisible, currentChromosomeSequence, containerSize, colorScaleRange, fqRawcMode, canvasUnitRectSize]);

    return (
        <div ref={containerRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', width: '100%', height: '100%' }}>
            <div id='triangle-control-button-group'
                style={{
                    position: 'absolute',
                    top: 20,
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    width: '100%',
                }}>
                <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', alignItems: 'center' }}>
                    <span style={{ marginRight: 5 }}>Scale: </span>
                    <InputNumber size='small' style={{ width: 50 }} controls={false} value={colorScaleRange[0]} min={0} max={200} onChange={changeColorByInput("min")} />
                    <Slider range={{ draggableTrack: true }} style={{ width: 250 }} min={0} max={fqRawcMode ? 1 : 200} step={fqRawcMode ? 0.1 : 1} onChange={changeColorScale} value={colorScaleRange} />
                    <InputNumber size='small' style={{ width: 50 }} controls={false} value={colorScaleRange[1]} min={0} max={200} onChange={changeColorByInput("max")} />
                </div>
                <Switch
                    checkedChildren="Non Random Interaction"
                    unCheckedChildren="All HiC"
                    checked={!fullTriangleVisible}
                    onChange={switchChange}
                    style={{
                        backgroundColor: fullTriangleVisible ? '#ED9121' : '#74C365',
                    }}
                />
                <Dropdown
                    menu={{
                        items: trackItems,
                        onClick: onClickTrackItem,
                    }}
                    placement="bottom"
                >
                    <Button size='small'>Tracks</Button>
                </Dropdown>
                <Modal
                    width={"50vw"}
                    height={trackKey === '4' ? "20vh" : "20vh"}
                    open={trackTableModalVisible}
                    onCancel={closeTrackTableModal}
                    styles={modalStyles}
                    footer={[
                        <Button key="back" onClick={closeTrackTableModal}>
                            Cancel
                        </Button>,
                        <Button color="primary" variant="outlined" key="submit" type="primary" onClick={confirmTrackSelection}>
                            OK
                        </Button>
                    ]}
                >
                    {trackKey === '4' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', margin: '0px 20px 0px 20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                                <span style={{ marginRight: '8px', fontWeight: 'bold', width: '100px' }}>
                                    Name
                                </span>
                                <Input name="name" value={uploadTrackData.name} onChange={uploadTrackChange} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                                <span style={{ marginRight: '8px', fontWeight: 'bold', width: '100px' }}>
                                    Track URL:
                                </span>
                                <Input name="trackUrl" value={uploadTrackData.trackUrl} onChange={uploadTrackChange} />
                            </div>
                        </div>
                    ) : trackDataSource.length === 0 ? (
                        <Spin
                            spinning={true}
                            size="large"
                            style={{ width: '100%', height: '100%', margin: 0 }}
                        />
                    ) : (
                        <Table
                            bordered={true}
                            dataSource={trackDataSource}
                            columns={trackTableColumns}
                            rowSelection={{ ...rowSelection }}
                            pagination={{
                                style: {
                                    marginTop: '12px',
                                    marginBottom: '12px',
                                },
                            }}
                            scroll={{
                                x: "max-content",
                                y: "50vh",
                            }}
                        />
                    )}
                </Modal>
                <Tooltip title="Download non-random interaction data">
                    <Dropdown
                        menu={{
                            items: downloadItems,
                            onClick: onClickDownloadItem,
                        }}
                        placement="bottom"
                    >
                        <Button
                            size='small'
                            style={{
                                fontSize: 15,
                                cursor: "pointer",
                                marginRight: 20
                            }}
                            icon={<DownloadOutlined />}
                        />
                    </Dropdown>
                </Tooltip>
            </div>
            <canvas ref={canvasRef} style={{ marginTop: 65 }} />
            <svg ref={brushSvgRef} style={{ position: 'absolute', zIndex: 2, pointerEvents: 'all', marginTop: 65 }} />
            <svg ref={axisSvgRef} style={{ height: '50px', flexShrink: 0 }} />
            {/* {minCanvasDimension > 0 && (
                <TriangleGeneList
                    brushedTriangleRange={brushedTriangleRange}
                    cellLineName={cellLineName}
                    chromosomeName={chromosomeName}
                    geneList={geneList}
                    currentChromosomeSequence={currentChromosomeSequence}
                    minCanvasDimension={minCanvasDimension}
                    geneName={geneName}
                />
            )} */}
            {minCanvasDimension > 0 && (
                <IgvViewer
                    uploadTrackData={uploadTrackData}
                    trackKey={trackKey}
                    selectedTrackData={selectedTrackData}
                    minCanvasDimension={minCanvasDimension}
                    cellLineName={cellLineName}
                    chromosomeName={chromosomeName}
                    brushedTriangleRange={brushedTriangleRange}
                    currentChromosomeSequence={currentChromosomeSequence}
                    igvMountStatus={igvMountStatus}
                />
            )}
        </div>
    );
};
