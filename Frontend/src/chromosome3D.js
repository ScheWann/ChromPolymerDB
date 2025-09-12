import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { jsPDF } from "jspdf";
import { OrbitControls } from '@react-three/drei';
import { Button, Tooltip, ColorPicker, Switch, InputNumber, Modal, Dropdown, Splitter, Drawer } from 'antd';
import { RollbackOutlined, ClearOutlined, DownloadOutlined, AreaChartOutlined } from "@ant-design/icons";
import { CurrentChainDistanceHeatmap } from './currentChainDistanceHeatmap';
import { Chromosome3DDistance } from './chromosome3DDistance';
import { SimulatedFqHeatmap } from "./simulatedFqHeatmap";
import "./Styles/chromosome3D.css";

// XYZ Axis Indicator Component
const AxisIndicator = ({ cameraRotation }) => {
    const SCALE = 1.5;  // ← change this to uniformly scale all dimensions
    const SEGMENTS = 8;

    const AXIS_LENGTH = 15 * SCALE;  // original 15
    const SHAFT_RADIUS = 0.5 * SCALE; // original 0.5
    const CONE_RADIUS = 2 * SCALE;   // original 2
    const CONE_HEIGHT = 4 * SCALE;   // original 4
    const TEXT_DISTANCE = 20 * SCALE;  // original 20
    const SPRITE_SCALE = 6 * SCALE;   // original 6

    const createTextSprite = (text, color, position) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 120;
        canvas.height = 120;

        context.fillStyle = color;
        context.font = 'bold 80px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 32, 32);

        const texture = new THREE.CanvasTexture(canvas);

        return (
            <sprite position={position} scale={[SPRITE_SCALE, SPRITE_SCALE, 1]}>
                <spriteMaterial map={texture} />
            </sprite>
        );
    };

    return (
        <group rotation={cameraRotation}>

            {/* X-axis */}
            <group>
                <mesh
                    position={[AXIS_LENGTH, 0, 0]}
                    rotation={[0, 0, -Math.PI / 2]}>
                    <coneGeometry args={[CONE_RADIUS, CONE_HEIGHT, SEGMENTS]} />
                    <meshBasicMaterial color="#117A65" />
                </mesh>
                <mesh
                    position={[AXIS_LENGTH / 2, 0, 0]}
                    rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry args={[SHAFT_RADIUS, SHAFT_RADIUS, AXIS_LENGTH, SEGMENTS]} />
                    <meshBasicMaterial color="#117A65" />
                </mesh>
                {createTextSprite('X', '#117A65', [TEXT_DISTANCE, 0, 0])}
            </group>

            {/* Y-axis */}
            <group>
                <mesh position={[0, AXIS_LENGTH, 0]}>
                    <coneGeometry args={[CONE_RADIUS, CONE_HEIGHT, SEGMENTS]} />
                    <meshBasicMaterial color="#B9770E" />
                </mesh>
                <mesh position={[0, AXIS_LENGTH / 2, 0]}>
                    <cylinderGeometry args={[SHAFT_RADIUS, SHAFT_RADIUS, AXIS_LENGTH, SEGMENTS]} />
                    <meshBasicMaterial color="#B9770E" />
                </mesh>
                {createTextSprite('Y', '#B9770E', [0, TEXT_DISTANCE, 0])}
            </group>

            {/* Z-axis */}
            <group>
                <mesh
                    position={[0, 0, AXIS_LENGTH]}
                    rotation={[Math.PI / 2, 0, 0]}>
                    <coneGeometry args={[CONE_RADIUS, CONE_HEIGHT, SEGMENTS]} />
                    <meshBasicMaterial color="#6C3483" />
                </mesh>
                <mesh
                    position={[0, 0, AXIS_LENGTH / 2]}
                    rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[SHAFT_RADIUS, SHAFT_RADIUS, AXIS_LENGTH, SEGMENTS]} />
                    <meshBasicMaterial color="#6C3483" />
                </mesh>
                {createTextSprite('Z', '#6C3483', [0, 0, TEXT_DISTANCE])}
            </group>
        </group>
    );
};

// Bead Index Label Component
const BeadIndexLabel = ({ beadIndex, position }) => {
    const textTexture = useMemo(() => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 128;

        // Clear canvas with transparent background
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Add background for better readability
        context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Add text
        context.fillStyle = '#FFFFFF';
        context.font = '60px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(`# ${beadIndex}`, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }, [beadIndex]);

    return (
        <sprite position={position} scale={[20, 10, 1]}>
            <spriteMaterial map={textTexture} />
        </sprite>
    );
};

export const Chromosome3D = ({ chromosome3DExampleData, validChromosomeValidIbpData, selectedChromosomeSequence, geneSize, formatNumber, celllineName, chromosomeName, currentChromosomeSequence, chromosomefqData, chromosomeCurrentSampleDistanceVector, selectedIndex, setSelectedIndex, selectedSphereList, setSelectedSphereList, handleColorChange, distributionData, setDistributionData, isExampleMode }) => {
    const scaleFactor = 0.15;
    const canvasRef = useRef();
    const controlsRef = useRef();
    const rendererRef = useRef();

    // Drawer (tutorial) related refs and state
    const canvasContainerRef = useRef();
    const colorPickerRef = useRef();
    const generateDistanceRef = useRef();
    const [drawerOpen, setDrawerOpen] = useState(false);

    const [hoveredIndex, setHoveredIndex] = useState(null);
    const [showChromosome3DDistance, setShowChromosome3DDistance] = useState(false);
    const [geneBeadSeq, setGeneBeadSeq] = useState([]);
    const [isFullGeneVisible, setIsFullGeneVisible] = useState(true);
    const [beadInfo, setBeadInfo] = useState({ chr: null, seq_start: null, seq_end: null, beadIndex: null, pairedBeadIndex: null })
    const [showBeadInfo, setShowBeadInfo] = useState(false)
    const [inputPositions, setInputPositions] = useState({ start: null, end: null });
    const [openAvgMatrixModal, setOpenAvgMatrixModal] = useState(false);
    const [chromosome3DBackgroundColor, setChromosome3DBackgroundColor] = useState('#333333');
    const [cameraRotation, setCameraRotation] = useState([0, 0, 0]);

    // Shared hover state for bidirectional highlighting
    const [hoveredHeatmapCoord, setHoveredHeatmapCoord] = useState(null);
    const [hoveredBeadsFromHeatmap, setHoveredBeadsFromHeatmap] = useState([]);
    // State for clicked heatmap coordinates
    const [clickedHeatmapCoord, setClickedHeatmapCoord] = useState(null);
    // Throttle/guard refs for smoother interaction
    const lastHoveredBeadIndexRef = useRef(null);
    const lastHoveredHeatmapCoordRef = useRef({ row: null, col: null });
    const beadHoverRafRef = useRef(null);
    const heatmapHoverRafRef = useRef(null);

    // Function to open the ColorPicker programmatically
    const [colorPickerOpen, setColorPickerOpen] = useState(false);

    // State for managing multiple color pickers when heatmap is clicked
    const [heatmapClickedBeads, setHeatmapClickedBeads] = useState([]);
    const [activeColorPickerIndex, setActiveColorPickerIndex] = useState(0);
    const [isProcessingHeatmapClick, setIsProcessingHeatmapClick] = useState(false);

    const openColorPicker = () => {
        setColorPickerOpen(true);
    };

    // Function to get the default color for a bead based on its position and properties
    const getDefaultBeadColor = (index) => {
        if (!processedChromosomeData || !processedChromosomeData[index]) {
            return '#00BFFF'; // fallback to blue
        }

        const isFirst = index === 0;
        const isLast = index === processedChromosomeData.length - 1;
        const isGeneBead = processedChromosomeData[index].isGeneBead;
        const orientation = processedChromosomeData[index].orientation;

        const isGeneStart = orientation === "plus"
            ? geneBeadSeq[0] === processedChromosomeData[index].marker
            : geneBeadSeq[geneBeadSeq.length - 1] === processedChromosomeData[index].marker;

        // Gene beads shows control
        const geneBeadRender =
            geneBeadSeq.length > 0 && isFullGeneVisible
                ? isGeneBead
                : isGeneStart;

        // Check if bead is in input range
        const beadMarker = processedChromosomeData[index].marker;
        const isInInputRange =
            inputPositions.start !== null &&
            inputPositions.end !== null &&
            beadMarker >= inputPositions.start &&
            beadMarker <= inputPositions.end;

        // Return the appropriate default color based on bead type
        if (isInInputRange) {
            return '#E25822'; // orange for input range
        } else if (geneBeadRender) {
            return '#FFD700'; // gold for gene beads
        } else if (isFirst) {
            return '#FFFFFF'; // white for first bead
        } else if (isLast) {
            return '#000000'; // black for last bead
        } else {
            return '#00BFFF'; // blue for regular beads
        }
    };

    // Close ColorPicker when selectedIndex changes to null
    useEffect(() => {
        if (selectedIndex === null) {
            setColorPickerOpen(false);
        }
    }, [selectedIndex]);

    // Cleanup heatmap click processing when component unmounts or data changes
    useEffect(() => {
        return () => {
            if (isProcessingHeatmapClick) {
                setIsProcessingHeatmapClick(false);
                setHeatmapClickedBeads([]);
                setActiveColorPickerIndex(0);
                setClickedHeatmapCoord(null);
            }
        };
    }, [chromosomeCurrentSampleDistanceVector]); // Reset when heatmap data changes

    // Handle ESC key to cancel heatmap click processing
    useEffect(() => {
        const handleKeyPress = (event) => {
            if (event.key === 'Escape' && isProcessingHeatmapClick) {
                setIsProcessingHeatmapClick(false);
                setHeatmapClickedBeads([]);
                setActiveColorPickerIndex(0);
                setColorPickerOpen(false);
                setSelectedIndex(null);
                setClickedHeatmapCoord(null);
            }
        };

        document.addEventListener('keydown', handleKeyPress);
        return () => {
            document.removeEventListener('keydown', handleKeyPress);
        };
    }, [isProcessingHeatmapClick]);

    // (Replaced tour with a simple Drawer tutorial showing an image)

    const step = 5000;
    const newStart = Math.ceil(selectedChromosomeSequence.start / step) * step;
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

    const modalStyles = {
        body: {
            height: '40vh'
        },
    };

    const presetColors = [
        {
            label: 'Theme Colors',
            colors: [
                '#ff4d4f', // Red
                '#ff7a45', // Orange
                '#ffc53d', // Yellow
                '#73d13d', // Green
                '#36cfc9', // Cyan
                '#40a9ff', // Blue
                '#9254de', // Purple
                '#000000', // Black
            ],
            key: 'custom',
        },
    ];

    useMemo(() => {
        if (geneSize.start > 0 && geneSize.end > 0) {
            const geneStart = Math.floor(geneSize.start / step) * step;
            const geneEnd = Math.ceil(geneSize.end / step) * step;
            const result = [];
            for (let i = geneStart; i <= geneEnd; i += step) {
                result.push(i);
            }
            setGeneBeadSeq(result);
        } else {
            setGeneBeadSeq([]);
        }
    }, [geneSize]);

    useEffect(() => {
        if (rendererRef.current && rendererRef.current.gl) {
            const { gl } = rendererRef.current;
            gl.setClearColor(new THREE.Color(chromosome3DBackgroundColor), 1);
        }
    }, [chromosome3DBackgroundColor]);

    const processedChromosomeData = useMemo(() => {
        return chromosome3DExampleData
            .slice()
            .sort((a, b) => a.pid - b.pid)
            .map((data, index) => {
                const marker = newStart + index * step; // Start ibp
                const isValid = validChromosomeValidIbpData.includes(marker); // Whether the current bead exists
                const isGeneBead = geneBeadSeq.includes(marker); // Whether the bead in the selected gene sequences
                const orientation = geneSize.orientation;

                return {
                    ...data,
                    orientation,
                    marker,
                    isValid,
                    isGeneBead
                };
            });
    }, [chromosome3DExampleData, validChromosomeValidIbpData, geneBeadSeq]);

    const coordinates = useMemo(() => {
        return processedChromosomeData.map((data) => {
            const x = data.x * scaleFactor;
            const y = data.y * scaleFactor;
            const z = data.z * scaleFactor;
            return new THREE.Vector3(x, y, z);
        });
    }, [processedChromosomeData]);

    const blendColors = (color1, color2) => {
        const color1Obj = new THREE.Color(color1);
        const color2Obj = new THREE.Color(color2);

        const blendedColor = new THREE.Color();
        blendedColor.r = (color1Obj.r + color2Obj.r) / 2;
        blendedColor.g = (color1Obj.g + color2Obj.g) / 2;
        blendedColor.b = (color1Obj.b + color2Obj.b) / 2;

        return blendedColor;
    }

    const onClickDownloadItem = ({ key }) => {
        if (key === '1') {
            downloadImage();
        }

        if (key === '2') {
            downloadPDF();
        }
    }

    const downloadImage = () => {
        if (rendererRef.current && rendererRef.current.gl) {
            const { gl, scene, camera } = rendererRef.current;
            const scale = 5;
            const width = window.innerWidth * scale;
            const height = window.innerHeight * scale;

            const exportCamera = camera.clone();
            exportCamera.aspect = width / height;
            exportCamera.updateProjectionMatrix();

            const renderTarget = new THREE.WebGLRenderTarget(width, height, {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat,
                samples: 8,
                stencilBuffer: false
            });
            renderTarget.texture.colorSpace = THREE.SRGBColorSpace;

            const originalRenderTarget = gl.getRenderTarget();
            const originalSize = gl.getSize(new THREE.Vector2());
            const originalPixelRatio = gl.getPixelRatio();

            gl.setRenderTarget(renderTarget);
            gl.setSize(width, height);
            gl.setPixelRatio(1);
            gl.setClearColor(new THREE.Color(chromosome3DBackgroundColor), 1);
            gl.clear();

            gl.render(scene, exportCamera);

            const buffer = new Uint8ClampedArray(width * height * 4);
            gl.readRenderTargetPixels(renderTarget, 0, 0, width, height, buffer);

            // flip element vertically
            flipY(buffer, width, height);

            // create a canvas element to convert the pixel data to an image
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = width;
            exportCanvas.height = height;
            const ctx = exportCanvas.getContext('2d');
            const imageData = new ImageData(buffer, width, height);
            ctx.putImageData(imageData, 0, 0);

            gl.setRenderTarget(originalRenderTarget);
            gl.setSize(originalSize.x, originalSize.y);
            gl.setPixelRatio(originalPixelRatio);

            // create a blob from the canvas and trigger a download
            exportCanvas.toBlob((blob) => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `chromosome_3d_${Date.now()}.png`;
                link.click();
            });

            renderTarget.dispose();
        }
    };

    const downloadPDF = () => {
        if (rendererRef.current && rendererRef.current.gl) {
            const { gl, scene, camera } = rendererRef.current;
            const scale = 5;
            const width = window.innerWidth * scale;
            const height = window.innerHeight * scale;

            const exportCamera = camera.clone();
            exportCamera.aspect = width / height;
            exportCamera.updateProjectionMatrix();

            const renderTarget = new THREE.WebGLRenderTarget(width, height, {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat,
                samples: 8,
                stencilBuffer: false
            });
            renderTarget.texture.colorSpace = THREE.SRGBColorSpace;

            const originalRenderTarget = gl.getRenderTarget();
            const originalSize = gl.getSize(new THREE.Vector2());
            const originalPixelRatio = gl.getPixelRatio();

            gl.setRenderTarget(renderTarget);
            gl.setSize(width, height);
            gl.setPixelRatio(1);
            gl.setClearColor(new THREE.Color(chromosome3DBackgroundColor), 1);
            gl.clear();

            gl.render(scene, exportCamera);

            const buffer = new Uint8ClampedArray(width * height * 4);
            gl.readRenderTargetPixels(renderTarget, 0, 0, width, height, buffer);

            flipY(buffer, width, height);

            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = width;
            exportCanvas.height = height;
            const ctx = exportCanvas.getContext('2d');
            const imageData = new ImageData(buffer, width, height);
            ctx.putImageData(imageData, 0, 0);

            gl.setRenderTarget(originalRenderTarget);
            gl.setSize(originalSize.x, originalSize.y);
            gl.setPixelRatio(originalPixelRatio);

            exportCanvas.toBlob((blob) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const imgData = reader.result;

                    const pdf = new jsPDF({
                        orientation: width > height ? 'landscape' : 'portrait',
                        unit: 'px',
                        format: [width, height]
                    });

                    pdf.addImage(imgData, 'PNG', 0, 0, width, height);
                    pdf.save(`chromosome_3d_${Date.now()}.pdf`);
                };
                reader.readAsDataURL(blob);
            });

            renderTarget.dispose();
        }
    };

    // fli[ the image vertically
    const flipY = (buffer, width, height) => {
        const bytesPerRow = width * 4;
        const halfHeight = Math.floor(height / 2);
        const temp = new Uint8ClampedArray(bytesPerRow);
        for (let y = 0; y < halfHeight; y++) {
            const topOffset = y * bytesPerRow;
            const bottomOffset = (height - y - 1) * bytesPerRow;

            temp.set(buffer.slice(topOffset, topOffset + bytesPerRow));
            buffer.copyWithin(topOffset, bottomOffset, bottomOffset + bytesPerRow);
            buffer.set(temp, bottomOffset);
        }
    }

    const handleInputLocation = (value, field) => {
        setInputPositions(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const resetView = () => {
        if (controlsRef.current) {
            controlsRef.current.reset();
        }
    };

    const resetSelectedBead = () => {
        setHoveredIndex(null);
        setSelectedIndex(null);
        setHoveredHeatmapCoord(null);
        setHoveredBeadsFromHeatmap([]);
        setSelectedSphereList((prev) =>
            Object.keys(prev).reduce((acc, key) => {
                acc[key] = {};
                return acc;
            }, {})
        );
        // Clear distribution data when beads are reset
        setDistributionData({});
    };

    const mapHeatmapCoordToBeads = (row, col) => {
        // Each heatmap cell corresponds to two beads: one at row index and one at col index
        return [row, col];
    };

    const mapBeadToHeatmapCoord = (beadIndex) => {
        return { row: beadIndex, col: beadIndex };
    };

    // Handler for heatmap hover events
    const handleHeatmapHover = (row, col) => {
        const prev = lastHoveredHeatmapCoordRef.current;
        if (prev && prev.row === row && prev.col === col) return;
        lastHoveredHeatmapCoordRef.current = { row, col };

        if (heatmapHoverRafRef.current) cancelAnimationFrame(heatmapHoverRafRef.current);
        heatmapHoverRafRef.current = requestAnimationFrame(() => {
            if (row !== null && col !== null) {
                setHoveredHeatmapCoord({ row, col });
                const beadIndices = mapHeatmapCoordToBeads(row, col);
                setHoveredBeadsFromHeatmap(beadIndices);

                // Show info for the primary bead (row index) and paired bead (col index)
                if (processedChromosomeData && processedChromosomeData[row]) {
                    setBeadInfo({
                        chr: processedChromosomeData[row].chrid,
                        seq_start: newStart + row * step,
                        seq_end: newStart + row * step + step,
                        beadIndex: row,
                        pairedBeadIndex: col
                    });
                    setShowBeadInfo(true);
                    setHoveredIndex(row);
                }
            } else {
                setHoveredHeatmapCoord(null);
                setHoveredBeadsFromHeatmap([]);
                setShowBeadInfo(false);
                setHoveredIndex(null);
            }
        });
    };

    // Handler for heatmap click events
    const handleHeatmapClick = (row, col) => {
        if (row === null || col === null || isProcessingHeatmapClick) return;

        // Set clicked coordinates for visual feedback
        setClickedHeatmapCoord({ row, col });

        // Get the bead indices that correspond to this heatmap cell
        const beadIndices = mapHeatmapCoordToBeads(row, col);

        // Filter out duplicate indices (when row === col)
        const uniqueBeadIndices = [...new Set(beadIndices)];

        // Filter out invalid bead indices
        const validBeadIndices = uniqueBeadIndices.filter(index =>
            index >= 0 && index < processedChromosomeData.length
        );

        if (validBeadIndices.length === 0) return;

        // Set up sequential color picker opening
        setHeatmapClickedBeads(validBeadIndices);
        setActiveColorPickerIndex(0);
        setIsProcessingHeatmapClick(true);

        // Select the first bead and open its color picker
        setSelectedIndex(validBeadIndices[0]);
        setColorPickerOpen(true);
    };

    // Handler for 3D bead hover events
    const handle3DBeadHover = (beadIndex) => {
        if (lastHoveredBeadIndexRef.current === beadIndex) return;
        lastHoveredBeadIndexRef.current = beadIndex;

        if (beadHoverRafRef.current) cancelAnimationFrame(beadHoverRafRef.current);
        beadHoverRafRef.current = requestAnimationFrame(() => {
            if (beadIndex !== null) {
                const heatmapCoord = mapBeadToHeatmapCoord(beadIndex);
                setHoveredHeatmapCoord(heatmapCoord);
                // Clear heatmap-triggered bead highlighting since we're now hovering directly on a bead
                setHoveredBeadsFromHeatmap([]);
            } else {
                setHoveredHeatmapCoord(null);
                setHoveredBeadsFromHeatmap([]);
            }
        });
    };

    const handleResetSelect = (index) => {
        if (selectedSphereList[celllineName]?.[index]?.color) {
            // Reset the sphere's color
            setSelectedSphereList((prev) => {
                const updatedList = { ...prev };
                if (updatedList[celllineName]) {
                    updatedList[celllineName] = { ...updatedList[celllineName] };
                    delete updatedList[celllineName][index];
                }
                return updatedList;
            });
        } else {
            setSelectedIndex(null);
        }
    };

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <div style={{
                width: 'calc(100% - 20px)',
                position: 'absolute',
                top: 10,
                right: 10,
                zIndex: 20,
                display: 'flex',
                flexDirection: 'column',
                pointerEvents: 'none'
            }}>
                {/* Container for buttons */}
                <div style={{
                    display: 'flex',
                    gap: '5px',
                    justifyContent: 'flex-end',
                    flexWrap: 'wrap',
                }}>
                    {/* location selection and gene switch function */}
                    <div className='buttonGroup' style={{ pointerEvents: 'auto' }}>
                        <span style={{ color: 'white', userSelect: 'none' }}>Locations: </span>
                        <InputNumber size='small' min={selectedChromosomeSequence.start} max={selectedChromosomeSequence.end} value={inputPositions.start} controls={false} placeholder='start' onChange={value => handleInputLocation(value, 'start')} />
                        <span style={{ color: 'white', userSelect: 'none' }}>~</span>
                        <InputNumber size='small' min={selectedChromosomeSequence.start} max={selectedChromosomeSequence.end} value={inputPositions.end} controls={false} placeholder='end' onChange={value => handleInputLocation(value, 'end')} />
                    </div>
                    {/* icon control group */}
                    <div className='buttonGroup' style={{ pointerEvents: 'auto' }}>
                        <Switch
                            checkedChildren="Genes"
                            unCheckedChildren="Promoter"
                            disabled={geneBeadSeq.length === 0}
                            checked={isFullGeneVisible}
                            style={{
                                backgroundColor: isFullGeneVisible ? '#DAA520' : '#262626'
                            }}
                            onChange={() => setIsFullGeneVisible(!isFullGeneVisible)}
                        />
                        <div ref={colorPickerRef} style={{ height: '24px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <ColorPicker
                                size='small'
                                value={selectedSphereList[celllineName]?.[selectedIndex]?.color || '#00BFFF'}
                                disabled={selectedIndex === null}
                                open={colorPickerOpen && selectedIndex !== null}
                                onOpenChange={(open) => {
                                    setColorPickerOpen(open);
                                    // If color picker is closed during heatmap click processing, stop the process
                                    if (!open && isProcessingHeatmapClick) {
                                        setIsProcessingHeatmapClick(false);
                                        setHeatmapClickedBeads([]);
                                        setActiveColorPickerIndex(0);
                                        setClickedHeatmapCoord(null);
                                    }
                                }}
                                presets={presetColors}
                                allowClear
                                panelRender={panel => (
                                    <div className="custom-panel">
                                        <div
                                            style={{
                                                fontSize: 12,
                                                color: 'rgba(0, 0, 0, 0.88)',
                                                lineHeight: '20px',
                                                marginBottom: 8,
                                            }}
                                        >
                                            {isProcessingHeatmapClick ? (
                                                <span>
                                                    Setting colors for <strong>{activeColorPickerIndex === 0 ? 'first' : 'second'}</strong> heatmap bead
                                                    <br />
                                                    Current bead index: <strong>{selectedIndex}</strong>
                                                    <br />
                                                    <em>Press <strong>ESC</strong> to cancel</em>
                                                </span>
                                            ) : (
                                                <span>Change the color of selected bead</span>
                                            )}
                                        </div>
                                        {panel}
                                    </div>
                                )}
                                onChange={(color) => {
                                    handleColorChange(color);

                                    // If we're processing a heatmap click, automatically proceed to next bead
                                    if (isProcessingHeatmapClick && heatmapClickedBeads.length > 0) {
                                        const nextIndex = activeColorPickerIndex + 1;

                                        if (nextIndex < heatmapClickedBeads.length) {
                                            // Move to next bead
                                            setActiveColorPickerIndex(nextIndex);
                                            setSelectedIndex(heatmapClickedBeads[nextIndex]);
                                            // Keep color picker open for the next bead
                                            setTimeout(() => setColorPickerOpen(true), 100);
                                        } else {
                                            // Finished with all beads
                                            setIsProcessingHeatmapClick(false);
                                            setHeatmapClickedBeads([]);
                                            setActiveColorPickerIndex(0);
                                            setColorPickerOpen(false);
                                            setSelectedIndex(null);
                                            setClickedHeatmapCoord(null);
                                        }
                                    }
                                }}
                                onClear={() => {
                                    if (selectedIndex !== null) {
                                        // Get the appropriate default color for this bead
                                        const defaultColor = getDefaultBeadColor(selectedIndex);
                                        // Create a color object that mimics the Ant Design color object
                                        const defaultColorObject = {
                                            toHexString: () => defaultColor
                                        };
                                        handleColorChange(defaultColorObject);

                                        // Handle sequential processing for clear action too
                                        if (isProcessingHeatmapClick && heatmapClickedBeads.length > 0) {
                                            const nextIndex = activeColorPickerIndex + 1;

                                            if (nextIndex < heatmapClickedBeads.length) {
                                                // Move to next bead
                                                setActiveColorPickerIndex(nextIndex);
                                                setSelectedIndex(heatmapClickedBeads[nextIndex]);
                                                // Keep color picker open for the next bead
                                                setTimeout(() => setColorPickerOpen(true), 100);
                                            } else {
                                                // Finished with all beads
                                                setIsProcessingHeatmapClick(false);
                                                setHeatmapClickedBeads([]);
                                                setActiveColorPickerIndex(0);
                                                setColorPickerOpen(false);
                                                setSelectedIndex(null);
                                                setClickedHeatmapCoord(null);
                                            }
                                        }
                                    }
                                }}
                            />
                        </div>
                        <Tooltip
                            title={<span style={{ color: 'black' }}>Clear the bead selections</span>}
                            color='white'
                        >
                            <Button
                                style={{
                                    fontSize: 15,
                                    cursor: "pointer",
                                }}
                                size='small'
                                icon={<ClearOutlined />}
                                onClick={resetSelectedBead}
                            />
                        </Tooltip>
                        <Tooltip
                            title={<span style={{ color: 'black' }}>Restore the original view</span>}
                            color='white'
                        >
                            <Button
                                style={{
                                    fontSize: 15,
                                    cursor: "pointer",
                                }}
                                size='small'
                                icon={<RollbackOutlined />}
                                onClick={resetView}
                            />
                        </Tooltip>
                        <Tooltip
                            title={<span style={{ color: 'black' }}>Download the 3D chromosome image</span>}
                            color='white'
                        >
                            <Dropdown
                                menu={{
                                    items: downloadItems,
                                    onClick: onClickDownloadItem,
                                }}
                                size='small'
                                placement="bottom"
                                popupRender={(menu) => (
                                    <div style={{ backgroundColor: 'white', borderRadius: 4 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'left', gap: 3, padding: '10px 0 0 15px' }}>
                                            <span style={{ userSelect: 'none' }}>Background Color: </span>
                                            <ColorPicker
                                                size="small"
                                                trigger='hover'
                                                value={chromosome3DBackgroundColor}
                                                style={{ marginRight: 15 }}
                                                onChange={(color) => {
                                                    setChromosome3DBackgroundColor(color.toHexString());
                                                }}
                                            />
                                        </div>
                                        {React.cloneElement(menu, { style: { boxShadow: 'none' } })}
                                    </div>
                                )}
                            >
                                <Button
                                    style={{
                                        fontSize: 15,
                                        cursor: "pointer",
                                    }}
                                    size='small'
                                    icon={<DownloadOutlined />}
                                />
                            </Dropdown>
                        </Tooltip>
                        <Tooltip
                            title={<span style={{ color: 'black' }}>Check the simulated Hi-C heatmap</span>}
                            color='white'
                        >
                            <Button
                                style={{
                                    fontSize: 15,
                                    cursor: "pointer",
                                }}
                                size='small'
                                icon={<AreaChartOutlined />}
                                onClick={() => setOpenAvgMatrixModal(true)}
                            />
                            <Modal
                                destroyOnHidden
                                width={"45vw"}
                                styles={modalStyles}
                                open={openAvgMatrixModal}
                                onCancel={() => setOpenAvgMatrixModal(false)}
                                footer={[
                                    <Button key="back" onClick={() => setOpenAvgMatrixModal(false)}>
                                        Close
                                    </Button>
                                ]}
                            >
                                {/* <AvgDistanceHeatmap
                                chromosome3DAvgMatrixData={chromosome3DAvgMatrixData}
                                selectedChromosomeSequence={selectedChromosomeSequence}
                                chromosomefqData={chromosomefqData}
                                chromosomeData={chromosomeData}
                            /> */}
                                <SimulatedFqHeatmap
                                    // chromosomeData={chromosomeData}
                                    celllineName={celllineName}
                                    chromosomeName={chromosomeName}
                                    chromosomefqData={chromosomefqData}
                                    selectedChromosomeSequence={selectedChromosomeSequence}
                                />
                            </Modal>
                        </Tooltip>
                        <Tooltip
                            title={<span style={{ color: 'black' }}>Generate pairwise distances for selected beads</span>}
                            color='white'
                        >
                            <div
                                ref={generateDistanceRef}
                                className={Object.keys(selectedSphereList[celllineName] || {}).length < 2 ? 'button-wrapper-disabled' : ''}
                                onClick={(e) => {
                                    const beadCount = Object.keys(selectedSphereList[celllineName] || {}).length;
                                    if (beadCount < 2) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setDrawerOpen(true);
                                    }
                                }}
                                style={{
                                    display: 'inline-block',
                                    cursor: Object.keys(selectedSphereList[celllineName] || {}).length < 2 ? 'pointer' : 'default'
                                }}
                            >
                                <Button
                                    className={`custom-button ${Object.keys(selectedSphereList[celllineName] || {}).length < 2 ? 'disabled' : ''}`}
                                    disabled={Object.keys(selectedSphereList[celllineName] || {}).length < 2}
                                    size='small'
                                    onClick={(e) => {
                                        if (Object.keys(selectedSphereList[celllineName] || {}).length >= 2) {
                                            setShowChromosome3DDistance(true);
                                        } else {
                                            e.preventDefault();
                                            e.stopPropagation();
                                        }
                                    }}>
                                    Generate Distance
                                </Button>
                            </div>
                        </Tooltip>
                    </div>
                </div>
                <div style={{
                    border: "1px solid #ccc",
                    display: "flex",
                    marginTop: 5,
                    backgroundColor: "white",
                    flexDirection: "column",
                    marginLeft: "auto",
                    fontSize: 10,
                    padding: 5,
                    borderRadius: 3,
                    gap: 5,
                    userSelect: 'none',
                    pointerEvents: 'auto'
                }}>
                    <div className='colorLegendWrapper'>
                        <div className='colorRect' style={{ backgroundColor: '#00BFFF' }} />
                        <span>Default Beads</span>
                    </div>
                    {/* <div className='colorLegendWrapper'>
                        <div className='colorRect' style={{ backgroundColor: '#FFFFFF'}} />
                        <span>Invalid Beads</span>
                    </div> */}
                    <div className='colorLegendWrapper'>
                        <div className='colorRect' style={{ backgroundColor: '#FFFFFF' }} />
                        <span>Start Bead</span>
                    </div>
                    <div className='colorLegendWrapper'>
                        <div className='colorRect' style={{ backgroundColor: '#000000' }} />
                        <span>End Bead</span>
                    </div>
                    <div className='colorLegendWrapper'>
                        <div className='colorRect' style={{ backgroundColor: '#E25822' }} />
                        <span>Selected Region</span>
                    </div>
                    <div className='colorLegendWrapper'>
                        <div className='colorRect' style={{ backgroundColor: '#FFD700' }} />
                        <span>Selected Gene Region</span>
                    </div>
                </div>
                {/* Beads hover on information */}
                {showBeadInfo && (
                    <div className={`beadInfoContainer ${showBeadInfo ? 'show' : 'hide'}`} style={{ userSelect: 'none', pointerEvents: 'auto' }}>
                        <div className='beadInfoText'>Chromosome: {beadInfo.chr}</div>
                        {beadInfo.pairedBeadIndex !== null && beadInfo.pairedBeadIndex !== beadInfo.beadIndex ? (
                            <>
                                <div className='beadInfoText'>Bead 1 Index: {beadInfo.beadIndex}</div>
                                <div className='beadInfoText'>Bead 1 Start: {formatNumber(beadInfo.seq_start)}</div>
                                <div className='beadInfoText'>Bead 1 End: {formatNumber(beadInfo.seq_end)}</div>
                                <br></br>
                                <div className='beadInfoText'>Bead 2 Index: {beadInfo.pairedBeadIndex}</div>
                                <div className='beadInfoText'>Bead 2 Start: {formatNumber(newStart + beadInfo.pairedBeadIndex * step)}</div>
                                <div className='beadInfoText'>Bead 2 End: {formatNumber(newStart + beadInfo.pairedBeadIndex * step + step)}</div>
                            </>
                        ) : (
                            <>
                                <div className='beadInfoText'>Bead Index: {beadInfo.beadIndex}</div>
                                <div className='beadInfoText'>Start: {formatNumber(beadInfo.seq_start)}</div>
                                <div className='beadInfoText'>End: {formatNumber(beadInfo.seq_end)}</div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {showChromosome3DDistance ? (
                <Splitter layout="vertical" style={{ height: '100%' }}>
                    <Splitter.Panel defaultSize="65%" min="45%" max="70%">
                        <div style={{ height: '100%', position: 'relative' }}>
                            {/* CurrentChainDistanceHeatmap positioned relative to the canvas panel */}
                            {(chromosomeCurrentSampleDistanceVector?.length ?? 0) > 0 && (
                                <div style={{ width: 200, aspectRatio: "1", position: 'absolute', bottom: 10, right: 10, zIndex: 10 }}>
                                    <CurrentChainDistanceHeatmap
                                        chromosomeCurrentSampleDistanceVector={chromosomeCurrentSampleDistanceVector}
                                        onHeatmapHover={handleHeatmapHover}
                                        onHeatmapClick={handleHeatmapClick}
                                        hoveredHeatmapCoord={hoveredHeatmapCoord}
                                        clickedHeatmapCoord={clickedHeatmapCoord}
                                    />
                                </div>
                            )}
                            <div ref={canvasContainerRef} style={{ width: '100%', height: '100%' }}>
                                <Canvas
                                    shadows
                                    ref={canvasRef}
                                    camera={{ position: [0, 0, 230], fov: 75, onUpdate: self => self.updateProjectionMatrix() }}
                                    style={{ width: '100%', height: '100%', backgroundColor: '#333' }}
                                    onCreated={({ gl, scene, camera }) => {
                                        rendererRef.current = { gl, scene, camera };
                                    }}
                                    gl={{
                                        antialias: true,
                                        powerPreference: "high-performance",
                                        toneMapping: THREE.ACESFilmicToneMapping,
                                        colorSpace: THREE.SRGBColorSpace
                                    }}
                                >
                                    <OrbitControls
                                        ref={controlsRef}
                                        enableZoom={true}
                                        enableRotate={true}
                                        enablePan={true}
                                        onChange={() => {
                                            if (controlsRef.current) {
                                                const euler = new THREE.Euler().setFromQuaternion(controlsRef.current.object.quaternion);
                                                setCameraRotation([euler.x, euler.y, euler.z]);
                                            }
                                        }}
                                    />
                                    <ambientLight intensity={1} />
                                    <directionalLight
                                        position={[10, 20, 10]}
                                        intensity={3}
                                        castShadow
                                    />
                                    <spotLight
                                        position={[30, 50, 50]}
                                        angle={0.3}
                                        penumbra={1}
                                        intensity={3}
                                        castShadow
                                    />
                                    {coordinates.map((coord, index) => {
                                        const isFirst = index === 0;
                                        const isLast = index === coordinates.length - 1;
                                        // const isValid = processedChromosomeData[index].isValid;
                                        const isGeneBead = processedChromosomeData[index].isGeneBead;
                                        const orientation = processedChromosomeData[index].orientation;

                                        const isGeneStart = orientation === "plus"
                                            ? geneBeadSeq[0] === processedChromosomeData[index].marker
                                            : geneBeadSeq[geneBeadSeq.length - 1] === processedChromosomeData[index].marker;

                                        // Gene beads shows control
                                        const geneBeadRender =
                                            geneBeadSeq.length > 0 && isFullGeneVisible
                                                ? isGeneBead
                                                : isGeneStart;

                                        // first bead: white, last bead: black
                                        const originalColor = isFirst ? '#FFFFFF' : isLast ? '#000000' : null;

                                        // const blendIfInvalid = (baseColor) => blendColors(baseColor, '#FFFFFF');

                                        // const geneBeadColor = isValid
                                        //     ? '#FFD700' // gold
                                        //     : isFirst
                                        //         ? blendIfInvalid('#00FF00') // mix green and white
                                        //         : isLast
                                        //             ? blendIfInvalid('#0000FF') // mix blue and white
                                        //             : blendIfInvalid('#FFD700'); // mix gold and white

                                        // Determine the appropriate color with proper priority:
                                        // 1. Custom user color (highest priority)
                                        // 2. Hover/selected state
                                        // 3. Gene bead default color
                                        // 4. Regular bead colors (first/last/default)

                                        // Check if this bead is highlighted from heatmap hover
                                        const isHighlightedFromHeatmap = hoveredBeadsFromHeatmap.includes(index);

                                        let validColor;
                                        if (selectedSphereList[celllineName]?.[index]?.color) {
                                            // User has set a custom color - use it
                                            validColor = selectedSphereList[celllineName][index].color;
                                        } else if (hoveredIndex === index || selectedIndex === index || isHighlightedFromHeatmap) {
                                            // No custom color but hovering/selected or highlighted from heatmap - use hover color
                                            validColor = '#E25822';
                                        } else if (geneBeadRender) {
                                            // No custom color, not hovering, but is gene bead - use gene color
                                            validColor = '#FFD700';
                                        } else if (isFirst) {
                                            // Regular first bead
                                            validColor = '#FFFFFF';
                                        } else if (isLast) {
                                            // Regular last bead
                                            validColor = '#000000';
                                        } else {
                                            // Regular bead
                                            validColor = '#00BFFF';
                                        }

                                        const beadMarker = processedChromosomeData[index].marker;
                                        const isInInputRange =
                                            inputPositions.start !== null &&
                                            inputPositions.end !== null &&
                                            beadMarker >= inputPositions.start &&
                                            beadMarker <= inputPositions.end;
                                        // const currentColor = geneBeadRender
                                        //     ? geneBeadColor
                                        //     : isValid
                                        //         ? validColor
                                        //         : isFirst
                                        //             ? blendIfInvalid('#00FF00') // invalid start bead mix green and white
                                        //             : isLast
                                        //                 ? blendIfInvalid('#0000FF') // invalid end bead mix blue and white
                                        //                 : '#FFFFFF';  // default invalid bead color

                                        const currentColor = isInInputRange ? '#E25822' : validColor;

                                        // Calculate sphere radius based on hover state
                                        const baseRadius = 2.8;
                                        const enlargedRadius = baseRadius * 1.5;
                                        const currentRadius = (hoveredIndex === index || selectedIndex === index || isHighlightedFromHeatmap)
                                            ? enlargedRadius
                                            : baseRadius;

                                        return (
                                            <group
                                                key={index}
                                                position={coord}
                                                onPointerOver={(e) => {
                                                    e.stopPropagation();
                                                    if (hoveredIndex !== index) {
                                                        setBeadInfo({ chr: processedChromosomeData[index].chrid, seq_start: newStart + index * step, seq_end: newStart + index * step + step, beadIndex: index, pairedBeadIndex: null });
                                                        setShowBeadInfo(true);
                                                        setHoveredIndex(index);
                                                        handle3DBeadHover(index);
                                                    }
                                                }}
                                                onPointerOut={(e) => {
                                                    e.stopPropagation();
                                                    if (hoveredIndex === index) {
                                                        setShowBeadInfo(false);
                                                        setHoveredIndex(null);
                                                        handle3DBeadHover(null);
                                                    }
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedIndex(index);
                                                    // Automatically open the ColorPicker after a short delay
                                                    setTimeout(() => {
                                                        openColorPicker();
                                                    }, 100);
                                                }}
                                                onDoubleClick={(e) => {
                                                    e.stopPropagation();
                                                    handleResetSelect(index);
                                                }}
                                            >
                                                {/* Sphere Mesh */}
                                                <mesh>
                                                    <sphereGeometry args={[currentRadius, 32, 32]} />
                                                    <meshStandardMaterial
                                                        receiveShadow
                                                        castShadow
                                                        color={currentColor}
                                                        metalness={0.3}
                                                        roughness={0.1}
                                                        emissiveIntensity={0.3}
                                                    />
                                                </mesh>
                                                {/* Bead Index Label - shown when hovered from heatmap */}
                                                {isHighlightedFromHeatmap && (
                                                    <BeadIndexLabel
                                                        beadIndex={index}
                                                        position={[currentRadius + 8, currentRadius + 8, 0]}
                                                    />
                                                )}
                                                {/* Outline Mesh */}
                                                {/* <mesh>
                                                <sphereGeometry args={[3, 32, 32]} />
                                                <meshBasicMaterial color="white" side={THREE.BackSide} />
                                            </mesh> */}
                                            </group>
                                        );
                                    })}
                                </Canvas>
                            </div>

                            {/* XYZ Axis Indicator - now positioned relative to the canvas container */}
                            <div style={{
                                position: 'absolute',
                                bottom: 20,
                                left: 20,
                                width: 120,
                                height: 120,
                                zIndex: 10
                            }}>
                                <Canvas
                                    camera={{ position: [0, 0, 50], fov: 75 }}
                                    style={{ width: '100%', height: '100%' }}
                                    gl={{ alpha: true }}
                                >
                                    <ambientLight intensity={0.8} />
                                    <directionalLight position={[5, 5, 5]} intensity={1} />
                                    <AxisIndicator cameraRotation={cameraRotation} />
                                </Canvas>
                            </div>
                        </div>
                    </Splitter.Panel>
                    <Splitter.Panel defaultSize="35%" min="35%" max="70%">
                        <Chromosome3DDistance
                            celllineName={celllineName}
                            chromosomeName={chromosomeName}
                            currentChromosomeSequence={currentChromosomeSequence}
                            setShowChromosome3DDistance={setShowChromosome3DDistance}
                            selectedSphereList={selectedSphereList}
                            distributionData={distributionData}
                            setDistributionData={setDistributionData}
                            isExampleMode={isExampleMode}
                        />
                    </Splitter.Panel>
                </Splitter>
            ) : (
                <div style={{ height: '100%', position: 'relative' }}>
                    <div ref={canvasContainerRef} style={{ width: '100%', height: '100%' }}>
                        <Canvas
                            shadows
                            ref={canvasRef}
                            camera={{ position: [0, 0, 230], fov: 75, onUpdate: self => self.updateProjectionMatrix() }}
                            style={{ width: '100%', height: '100%', backgroundColor: '#333' }}
                            onCreated={({ gl, scene, camera }) => {
                                rendererRef.current = { gl, scene, camera };
                            }}
                            gl={{
                                antialias: true,
                                powerPreference: "high-performance",
                                toneMapping: THREE.ACESFilmicToneMapping,
                                colorSpace: THREE.SRGBColorSpace
                            }}
                        >
                            <OrbitControls
                                ref={controlsRef}
                                enableZoom={true}
                                enableRotate={true}
                                enablePan={true}
                                onChange={() => {
                                    if (controlsRef.current) {
                                        const euler = new THREE.Euler().setFromQuaternion(controlsRef.current.object.quaternion);
                                        setCameraRotation([euler.x, euler.y, euler.z]);
                                    }
                                }}
                            />
                            <ambientLight intensity={1} />
                            <directionalLight
                                position={[10, 20, 10]}
                                intensity={3}
                                castShadow
                            />
                            <spotLight
                                position={[30, 50, 50]}
                                angle={0.3}
                                penumbra={1}
                                intensity={3}
                                castShadow
                            />
                            {coordinates.map((coord, index) => {
                                const isFirst = index === 0;
                                const isLast = index === coordinates.length - 1;
                                // const isValid = processedChromosomeData[index].isValid;
                                const isGeneBead = processedChromosomeData[index].isGeneBead;
                                const orientation = processedChromosomeData[index].orientation;

                                const isGeneStart = orientation === "plus"
                                    ? geneBeadSeq[0] === processedChromosomeData[index].marker
                                    : geneBeadSeq[geneBeadSeq.length - 1] === processedChromosomeData[index].marker;

                                // Gene beads shows control
                                const geneBeadRender =
                                    geneBeadSeq.length > 0 && isFullGeneVisible
                                        ? isGeneBead
                                        : isGeneStart;

                                // first bead: white, last bead: black
                                const originalColor = isFirst ? '#FFFFFF' : isLast ? '#000000' : null;

                                // const blendIfInvalid = (baseColor) => blendColors(baseColor, '#FFFFFF');

                                // const geneBeadColor = isValid
                                //     ? '#FFD700' // gold
                                //     : isFirst
                                //         ? blendIfInvalid('#00FF00') // mix green and white
                                //         : isLast
                                //             ? blendIfInvalid('#0000FF') // mix blue and white
                                //             : blendIfInvalid('#FFD700'); // mix gold and white

                                // Determine the appropriate color with proper priority:
                                // 1. Custom user color (highest priority)
                                // 2. Hover/selected state
                                // 3. Gene bead default color
                                // 4. Regular bead colors (first/last/default)

                                // Check if this bead is highlighted from heatmap hover
                                const isHighlightedFromHeatmap = hoveredBeadsFromHeatmap.includes(index);

                                let validColor;
                                if (selectedSphereList[celllineName]?.[index]?.color) {
                                    // User has set a custom color - use it
                                    validColor = selectedSphereList[celllineName][index].color;
                                } else if (hoveredIndex === index || selectedIndex === index || isHighlightedFromHeatmap) {
                                    // No custom color but hovering/selected or highlighted from heatmap - use hover color
                                    validColor = '#E25822';
                                } else if (geneBeadRender) {
                                    // No custom color, not hovering, but is gene bead - use gene color
                                    validColor = '#FFD700';
                                } else if (isFirst) {
                                    // Regular first bead
                                    validColor = '#FFFFFF';
                                } else if (isLast) {
                                    // Regular last bead
                                    validColor = '#000000';
                                } else {
                                    // Regular bead
                                    validColor = '#00BFFF';
                                }

                                const beadMarker = processedChromosomeData[index].marker;
                                const isInInputRange =
                                    inputPositions.start !== null &&
                                    inputPositions.end !== null &&
                                    beadMarker >= inputPositions.start &&
                                    beadMarker <= inputPositions.end;
                                // const currentColor = geneBeadRender
                                //     ? geneBeadColor
                                //     : isValid
                                //         ? validColor
                                //         : isFirst
                                //             ? blendIfInvalid('#00FF00') // invalid start bead mix green and white
                                //             : isLast
                                //                 ? blendIfInvalid('#0000FF') // invalid end bead mix blue and white
                                //                 : '#FFFFFF';  // default invalid bead color

                                const currentColor = isInInputRange ? '#E25822' : validColor;

                                // Calculate sphere radius based on hover state
                                const baseRadius = 2.8;
                                const enlargedRadius = baseRadius * 1.5;
                                const currentRadius = (hoveredIndex === index || selectedIndex === index || isHighlightedFromHeatmap)
                                    ? enlargedRadius
                                    : baseRadius;

                                return (
                                    <group
                                        key={index}
                                        position={coord}
                                        onPointerOver={(e) => {
                                            e.stopPropagation();
                                            if (hoveredIndex !== index) {
                                                setBeadInfo({ chr: processedChromosomeData[index].chrid, seq_start: newStart + index * step, seq_end: newStart + index * step + step, beadIndex: index, pairedBeadIndex: null });
                                                setShowBeadInfo(true);
                                                setHoveredIndex(index);
                                                handle3DBeadHover(index);
                                            }
                                        }}
                                        onPointerOut={(e) => {
                                            e.stopPropagation();
                                            if (hoveredIndex === index) {
                                                setShowBeadInfo(false);
                                                setHoveredIndex(null);
                                                handle3DBeadHover(null);
                                            }
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedIndex(index);
                                            // Automatically open the ColorPicker after a short delay
                                            setTimeout(() => {
                                                openColorPicker();
                                            }, 100);
                                        }}
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            handleResetSelect(index);
                                        }}
                                    >
                                        {/* Sphere Mesh */}
                                        <mesh>
                                            <sphereGeometry args={[currentRadius, 32, 32]} />
                                            <meshStandardMaterial
                                                receiveShadow
                                                castShadow
                                                color={currentColor}
                                                metalness={0.3}
                                                roughness={0.1}
                                                emissiveIntensity={0.3}
                                            />
                                        </mesh>
                                        {/* Bead Index Label - shown when hovered from heatmap */}
                                        {isHighlightedFromHeatmap && (
                                            <BeadIndexLabel
                                                beadIndex={index}
                                                position={[currentRadius + 8, currentRadius + 8, 0]}
                                            />
                                        )}
                                        {/* Outline Mesh */}
                                        {/* <mesh>
                                        <sphereGeometry args={[3, 32, 32]} />
                                        <meshBasicMaterial color="white" side={THREE.BackSide} />
                                    </mesh> */}
                                    </group>
                                );
                            })}
                        </Canvas>
                    </div>

                    {/* XYZ Axis Indicator - now positioned relative to the canvas container */}
                    <div style={{
                        position: 'absolute',
                        bottom: 20,
                        left: 20,
                        width: 120,
                        height: 120,
                        zIndex: 10
                    }}>
                        <Canvas
                            camera={{ position: [0, 0, 50], fov: 75 }}
                            style={{ width: '100%', height: '100%' }}
                            gl={{ alpha: true }}
                        >
                            <ambientLight intensity={0.8} />
                            <directionalLight position={[5, 5, 5]} intensity={1} />
                            <AxisIndicator cameraRotation={cameraRotation} />
                        </Canvas>
                    </div>

                    {/* CurrentChainDistanceHeatmap positioned relative to the canvas container */}
                    {(chromosomeCurrentSampleDistanceVector?.length ?? 0) > 0 && (
                        <div style={{ width: 200, aspectRatio: "1", position: 'absolute', bottom: 10, right: 10, zIndex: 10 }}>
                            <CurrentChainDistanceHeatmap
                                chromosomeCurrentSampleDistanceVector={chromosomeCurrentSampleDistanceVector}
                                onHeatmapHover={handleHeatmapHover}
                                onHeatmapClick={handleHeatmapClick}
                                hoveredHeatmapCoord={hoveredHeatmapCoord}
                                clickedHeatmapCoord={clickedHeatmapCoord}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Tutorial Drawer */}
            <Drawer
                title="How to Generate Distances"
                placement="left"
                width="40.5%"
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                styles={{ body: { padding: 16 } }}
            >
                <div ref={canvasContainerRef} style={{ display: 'none' }} />
                <div ref={colorPickerRef} style={{ display: 'none' }} />
                <div ref={generateDistanceRef} style={{ display: 'none' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '12px' }}>
                    <span>1. Select <strong style={{ color: '#3182bd' }}>first bead</strong> you are interested in</span>
                </div>
                <img
                    src="/Distance_step1.png"
                    alt="Chromosome 3D tutorial"
                    style={{ width: '70%', height: 'auto', borderRadius: 4 }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '12px' }}>
                    <span>2. Change selected bead <strong style={{ color: '#3182bd' }}>color</strong></span>
                </div>
                <img
                    src="/Distance_step2.png"
                    alt="Chromosome 3D tutorial"
                    style={{ width: '70%', height: 'auto', borderRadius: 4 }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '12px' }}>
                    <span>3. Select <strong style={{ color: '#3182bd' }}>Second bead</strong> you are interested in</span>
                </div>
                <img
                    src="/Distance_step3.png"
                    alt="Chromosome 3D tutorial"
                    style={{ width: '70%', height: 'auto', borderRadius: 4 }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '12px' }}>
                    <span>4. Change selected bead <strong style={{ color: '#3182bd' }}>color</strong></span>
                </div>
                <img
                    src="/Distance_step4.png"
                    alt="Chromosome 3D tutorial"
                    style={{ width: '70%', height: 'auto', borderRadius: 4 }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '12px' }}>
                    <span>5. Click <strong style={{ color: '#3182bd' }}>Generate Distance</strong> button</span>
                </div>
                <img
                    src="/Distance_step5.png"
                    alt="Chromosome 3D tutorial"
                    style={{ width: '70%', height: 'auto', borderRadius: 4 }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '12px' }}>
                    <span><strong style={{ color: '#3182bd' }}> Distances across multiple beads are supported; just select as many as beads you want to analyze</strong></span>
                </div>
            </Drawer>
        </div>
    );
};
