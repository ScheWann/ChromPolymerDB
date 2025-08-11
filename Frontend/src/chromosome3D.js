import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { jsPDF } from "jspdf";
import { OrbitControls } from '@react-three/drei';
import { Button, Tooltip, ColorPicker, Switch, InputNumber, Modal, Dropdown, Splitter, Tour } from 'antd';
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

export const Chromosome3D = ({ chromosome3DExampleData, validChromosomeValidIbpData, selectedChromosomeSequence, geneSize, formatNumber, celllineName, chromosomeName, currentChromosomeSequence, chromosomefqData, chromosomeCurrentSampleDistanceVector, selectedIndex, setSelectedIndex, selectedSphereList, setSelectedSphereList, handleColorChange, distributionData, setDistributionData, isExampleMode }) => {
    const scaleFactor = 0.15;
    const canvasRef = useRef();
    const controlsRef = useRef();
    const rendererRef = useRef();

    // Tour related refs and state
    const canvasContainerRef = useRef();
    const colorPickerRef = useRef();
    const generateDistanceRef = useRef();
    const [tourOpen, setTourOpen] = useState(false);
    const [tourCurrent, setTourCurrent] = useState(0);

    const [hoveredIndex, setHoveredIndex] = useState(null);
    const [showChromosome3DDistance, setShowChromosome3DDistance] = useState(false);
    const [geneBeadSeq, setGeneBeadSeq] = useState([]);
    const [isFullGeneVisible, setIsFullGeneVisible] = useState(true);
    const [beadInfo, setBeadInfo] = useState({ chr: null, seq_start: null, seq_end: null })
    const [showBeadInfo, setShowBeadInfo] = useState(false)
    const [inputPositions, setInputPositions] = useState({ start: null, end: null });
    const [openAvgMatrixModal, setOpenAvgMatrixModal] = useState(false);
    const [chromosome3DBackgroundColor, setChromosome3DBackgroundColor] = useState('#333333');
    const [cameraRotation, setCameraRotation] = useState([0, 0, 0]);

    // Tour steps configuration
    const tourSteps = [
        {
            title: 'Select Beads',
            description: 'Select beads by clicking on them in the 3D visualization.',
            target: () => canvasContainerRef.current,
        },
        {
            title: 'Change beads color',
            description: 'Use this color picker to change the color of selected beads.',
            target: () => colorPickerRef.current,
        },
        {
            title: 'Generate Distance',
            description: 'After selecting at least two beads, click this button to generate distance calculations.',
            target: () => generateDistanceRef.current,
        },
    ];

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
        setSelectedSphereList((prev) =>
            Object.keys(prev).reduce((acc, key) => {
                acc[key] = {};
                return acc;
            }, {})
        );
        // Clear distribution data when beads are reset
        setDistributionData({});
    };

    const handleResetSelect = (index) => {
        if (selectedSphereList[celllineName]?.[index]?.color) {
            // Reset the sphere's color
            setSelectedSphereList((prev) => {
                const updatedList = { ...prev };
                delete updatedList[index];
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
                zIndex: 10,
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
                        <Tooltip
                            title={<span style={{ color: 'black' }}>Change the color of selected bead</span>}
                            color='white'
                        >
                            <div ref={colorPickerRef}>
                                <ColorPicker
                                    value={selectedSphereList[celllineName]?.[selectedIndex]?.color || '#00BFFF'}
                                    disabled={selectedIndex === null}
                                    presets={presetColors}
                                    onChange={handleColorChange}
                                />
                            </div>
                        </Tooltip>
                        <Tooltip
                            title={<span style={{ color: 'black' }}>Clear the bead selections</span>}
                            color='white'
                        >
                            <Button
                                style={{
                                    fontSize: 15,
                                    cursor: "pointer",
                                }}
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
                                        setTourOpen(true);
                                        setTourCurrent(0);
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
                    marginTop: 15,
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
                        <div className='beadInfoText'>Start: {formatNumber(beadInfo.seq_start)}</div>
                        <div className='beadInfoText'>End: {formatNumber(beadInfo.seq_end)}</div>
                    </div>
                )}
            </div>

            {showChromosome3DDistance ? (
                <Splitter layout="vertical" style={{ height: '100%' }}>
                    <Splitter.Panel defaultSize="65%" min="45%" max="70%">
                        <div style={{ height: '100%', position: 'relative' }}>
                            {/* CurrentChainDistanceHeatmap positioned relative to the canvas panel */}
                            {(chromosomeCurrentSampleDistanceVector?.length ?? 0) > 0 && (
                                <div style={{ aspectRatio: "1", position: 'absolute', bottom: 10, right: 10, zIndex: 10 }}>
                                    <CurrentChainDistanceHeatmap
                                        chromosomeCurrentSampleDistanceVector={chromosomeCurrentSampleDistanceVector}
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

                                        const baseColor = selectedSphereList[celllineName]?.[index]?.color ||
                                            (hoveredIndex === index || selectedIndex === index
                                                ? '#E25822'
                                                : isFirst || isLast
                                                    ? originalColor
                                                    : '#00BFFF');

                                        const validColor = geneBeadRender ? '#FFD700' : baseColor;

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

                                        return (
                                            <group
                                                key={index}
                                                position={coord}
                                                onPointerOver={(e) => {
                                                    e.stopPropagation();
                                                    if (hoveredIndex !== index) {
                                                        setBeadInfo({ chr: processedChromosomeData[index].chrid, seq_start: newStart + index * step, seq_end: newStart + index * step + step });
                                                        setShowBeadInfo(true);
                                                        setHoveredIndex(index);
                                                    }
                                                }}
                                                onPointerOut={(e) => {
                                                    e.stopPropagation();
                                                    if (hoveredIndex === index) {
                                                        setShowBeadInfo(false);
                                                        setHoveredIndex(null);
                                                    }
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedIndex(index);
                                                }}
                                                onDoubleClick={(e) => {
                                                    e.stopPropagation();
                                                    handleResetSelect(index);
                                                }}
                                            >
                                                {/* Sphere Mesh */}
                                                <mesh>
                                                    <sphereGeometry args={[2.8, 32, 32]} />
                                                    <meshStandardMaterial
                                                        receiveShadow
                                                        castShadow
                                                        color={currentColor}
                                                        metalness={0.3}
                                                        roughness={0.1}
                                                        emissiveIntensity={0.3}
                                                    />
                                                </mesh>
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

                                const baseColor = selectedSphereList[celllineName]?.[index]?.color ||
                                    (hoveredIndex === index || selectedIndex === index
                                        ? '#E25822'
                                        : isFirst || isLast
                                            ? originalColor
                                            : '#00BFFF');

                                const validColor = geneBeadRender ? '#FFD700' : baseColor;

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

                                return (
                                    <group
                                        key={index}
                                        position={coord}
                                        onPointerOver={(e) => {
                                            e.stopPropagation();
                                            if (hoveredIndex !== index) {
                                                setBeadInfo({ chr: processedChromosomeData[index].chrid, seq_start: newStart + index * step, seq_end: newStart + index * step + step });
                                                setShowBeadInfo(true);
                                                setHoveredIndex(index);
                                            }
                                        }}
                                        onPointerOut={(e) => {
                                            e.stopPropagation();
                                            if (hoveredIndex === index) {
                                                setShowBeadInfo(false);
                                                setHoveredIndex(null);
                                            }
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedIndex(index);
                                        }}
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            handleResetSelect(index);
                                        }}
                                    >
                                        {/* Sphere Mesh */}
                                        <mesh>
                                            <sphereGeometry args={[2.8, 32, 32]} />
                                            <meshStandardMaterial
                                                receiveShadow
                                                castShadow
                                                color={currentColor}
                                                metalness={0.3}
                                                roughness={0.1}
                                                emissiveIntensity={0.3}
                                            />
                                        </mesh>
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
                    <div style={{ aspectRatio: "1", position: 'absolute', bottom: 10, right: 10, zIndex: 10 }}>
                        <CurrentChainDistanceHeatmap
                            chromosomeCurrentSampleDistanceVector={chromosomeCurrentSampleDistanceVector}
                        />
                    </div>
                </div>
            )}

            {/* Tour Component */}
            <Tour
                open={tourOpen}
                onClose={() => setTourOpen(false)}
                steps={tourSteps}
                current={tourCurrent}
                onChange={setTourCurrent}
                mask={{
                    style: {
                        boxShadow: 'inset 0 0 15px #fff',
                    },
                }}
                closeIcon={
                    <span style={{
                        color: '#1890ff',
                        fontWeight: 'bold',
                        width: 'auto',
                        height: 'auto',
                        lineHeight: '1'
                    }}>Skip</span>
                }
                zIndex={10000}
            />
        </div>
    );
};
