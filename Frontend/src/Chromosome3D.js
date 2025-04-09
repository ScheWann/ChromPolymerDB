import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';
import { Button, Tooltip, ColorPicker, Switch, InputNumber, Modal } from 'antd';
import { RollbackOutlined, ClearOutlined, FileImageOutlined, AreaChartOutlined } from "@ant-design/icons";
import { CurrentChainDistanceHeatmap } from './currentChainDistanceHeatmap';
import { Chromosome3DDistance } from './Chromosome3DDistance';
import { SimulatedFqHeatmap } from "./simulatedFqHeatmap";
// import { AvgDistanceHeatmap } from './avgDistanceHeatmap';
import "./Styles/chromosome3D.css";

export const Chromosome3D = ({ chromosome3DExampleData, chromosome3DAvgMatrixData, chromosomeData, validChromosomeValidIbpData, selectedChromosomeSequence, geneSize, formatNumber, celllineName, chromosomeName, currentChromosomeSequence, chromosomefqData, chromosomeCurrentSampleDistanceVector, selectedIndex, setSelectedIndex, selectedSphereList, setSelectedSphereList, handleColorChange, distributionData, setDistributionData, cellLineDict }) => {
    const scaleFactor = 0.15;
    const canvasRef = useRef();
    const controlsRef = useRef();
    const rendererRef = useRef();

    const [hoveredIndex, setHoveredIndex] = useState(null);
    const [showChromosome3DDistance, setShowChromosome3DDistance] = useState(false);
    const [geneBeadSeq, setGeneBeadSeq] = useState([]);
    const [isFullGeneVisible, setIsFullGeneVisible] = useState(true);
    const [beadInfo, setBeadInfo] = useState({ chr: null, seq_start: null, seq_end: null })
    const [showBeadInfo, setShowBeadInfo] = useState(false)
    const [inputPositions, setInputPositions] = useState({ start: null, end: null });
    const [openAvgMatrixModal, setOpenAvgMatrixModal] = useState(false);

    const step = 5000;
    const newStart = Math.ceil(selectedChromosomeSequence.start / step) * step;

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

    const downloadImage = () => {
        if (rendererRef.current && rendererRef.current.gl) {
            const { gl, scene, camera } = rendererRef.current;
            const scale = 4;
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
                flexDirection: 'column'
            }}>
                {/* Container for buttons */}
                <div style={{
                    display: 'flex',
                    gap: '5px',
                    justifyContent: 'flex-end',
                    flexWrap: 'wrap',
                }}>
                    {/* location selection and gene switch function */}
                    <div className='buttonGroup'>
                        <span style={{ color: 'white' }}>Locations: </span>
                        <InputNumber size='small' min={selectedChromosomeSequence.start} max={selectedChromosomeSequence.end} value={inputPositions.start} controls={false} placeholder='start' onChange={value => handleInputLocation(value, 'start')} />
                        <span style={{ color: 'white' }}>~</span>
                        <InputNumber size='small' min={selectedChromosomeSequence.start} max={selectedChromosomeSequence.end} value={inputPositions.end} controls={false} placeholder='end' onChange={value => handleInputLocation(value, 'end')} />
                    </div>
                    {/* icon control group */}
                    <div className='buttonGroup'>
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
                            title="Change the color of selected bead"
                            color='white'
                            overlayInnerStyle={{
                                color: 'black'
                            }}
                        >
                            <ColorPicker
                                value={selectedSphereList[celllineName]?.[selectedIndex]?.color || '#00BFFF'}
                                disabled={selectedIndex === null}
                                presets={presetColors}
                                onChange={handleColorChange}
                            />
                        </Tooltip>
                        <Tooltip
                            title="Clear the bead selections"
                            color='white'
                            overlayInnerStyle={{
                                color: 'black'
                            }}
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
                            title="Restore the original view"
                            color='white'
                            overlayInnerStyle={{
                                color: 'black'
                            }}
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
                            title="Download the 3D chromosome image"
                            color='white'
                            overlayInnerStyle={{
                                color: 'black'
                            }}
                        >
                            <Button
                                style={{
                                    fontSize: 15,
                                    cursor: "pointer",
                                }}
                                icon={<FileImageOutlined />}
                                onClick={downloadImage}
                            />
                        </Tooltip>
                        <Tooltip
                            title="Check the simulated Hi-C heatmap"
                            color='white'
                            overlayInnerStyle={{
                                color: 'black'
                            }}
                        >
                            <Button
                                style={{
                                    fontSize: 10,
                                    cursor: "pointer",
                                }}
                                icon={<AreaChartOutlined />}
                                onClick={() => setOpenAvgMatrixModal(true)}
                            />
                            <Modal
                                destroyOnClose
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
                            title="Generate pairwise distances for selected beads"
                            color='white'
                            overlayInnerStyle={{
                                color: 'black'
                            }}
                        >
                            <Button
                                className={`custom-button ${Object.keys(selectedSphereList[celllineName] || {}).length < 2 ? 'disabled' : ''}`}
                                disabled={Object.keys(selectedSphereList[celllineName] || {}).length < 2}
                                onClick={() => setShowChromosome3DDistance(true)}>
                                Generate Distance
                            </Button>
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
                    gap: 5
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
                        <div className='colorRect' style={{ backgroundColor: '#00FF00' }} />
                        <span>Start Bead</span>
                    </div>
                    <div className='colorLegendWrapper'>
                        <div className='colorRect' style={{ backgroundColor: '#0000FF' }} />
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
                    <div className={`beadInfoContainer ${showBeadInfo ? 'show' : 'hide'}`}>
                        <div className='beadInfoText'>Chromosome: {beadInfo.chr}</div>
                        <div className='beadInfoText'>Start: {formatNumber(beadInfo.seq_start)}</div>
                        <div className='beadInfoText'>End: {formatNumber(beadInfo.seq_end)}</div>
                    </div>
                )}
            </div>

            {showChromosome3DDistance && chromosomeCurrentSampleDistanceVector ? (
                <div style={{ aspectRatio: "1", position: 'absolute', bottom: "calc(35% + 10px)", right: 10, zIndex: 10 }}>
                    <CurrentChainDistanceHeatmap
                        chromosomeCurrentSampleDistanceVector={chromosomeCurrentSampleDistanceVector}
                    />
                </div>) : (<div style={{ aspectRatio: "1", position: 'absolute', bottom: 0, right: 10, zIndex: 10 }}>
                    <CurrentChainDistanceHeatmap
                        chromosomeCurrentSampleDistanceVector={chromosomeCurrentSampleDistanceVector}
                    />
                </div>)}

            <div style={{ height: showChromosome3DDistance ? '65%' : '100%', transition: 'height 0.3s ease' }}>
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

                        // first bead: green, last bead: blue
                        const originalColor = isFirst ? '#00FF00' : isLast ? '#0000FF' : null;

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
                                style={{ pointerEvents: 'none' }}
                                key={index}
                                position={coord}
                                onPointerOver={(e) => {
                                    e.stopPropagation();
                                    setBeadInfo({ chr: processedChromosomeData[index].chrid, seq_start: newStart + index * step, seq_end: newStart + index * step + step });
                                    setShowBeadInfo(true);
                                    setHoveredIndex(index);
                                }}
                                onPointerOut={(e) => {
                                    e.stopPropagation();
                                    setShowBeadInfo(false);
                                    setHoveredIndex(null);
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

            {showChromosome3DDistance && (
                <div style={{ height: '35%', marginTop: 2 }}>
                    <Chromosome3DDistance
                        celllineName={celllineName}
                        chromosomeName={chromosomeName}
                        currentChromosomeSequence={currentChromosomeSequence}
                        setShowChromosome3DDistance={setShowChromosome3DDistance}
                        selectedSphereList={selectedSphereList}
                        distributionData={distributionData}
                        setDistributionData={setDistributionData}
                        cellLineDict={cellLineDict}
                    />
                </div>
            )}
        </div>
    );
};
