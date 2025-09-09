import React, { useMemo, useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import jsPDF from 'jspdf';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Button, Tooltip, ColorPicker, Dropdown, Splitter, Slider, Modal, Checkbox, Space } from 'antd';
import { Text, OrbitControls } from '@react-three/drei';
import { BeadDistributionViolinPlot } from './beadDistributionViolinPlot';
import { RollbackOutlined, CaretUpOutlined, DownloadOutlined, SettingOutlined } from "@ant-design/icons";
import "./Styles/chromosome3D.css";

const CameraFacingText = ({ position, children, ...props }) => {
    const textRef = useRef();
    const { camera } = useThree();

    useFrame(() => {
        if (textRef.current) {
            textRef.current.quaternion.copy(camera.quaternion);
        }
    });

    return (
        <Text
            ref={textRef}
            position={position}
            {...props}
        >
            {children}
        </Text>
    );
};

export const Chromosome3DDistance = ({ selectedSphereList, setShowChromosome3DDistance, celllineName, chromosomeName, currentChromosomeSequence, distributionData, setDistributionData, isExampleMode }) => {
    const controlsRef = useRef();
    const cameraRef = useRef();
    const rendererRef = useRef();
    const [chromosome3DDistanceBackgroundColor, setChromosome3DDistanceBackgroundColor] = useState('#333333');
    const [loading, setLoading] = useState(false);
    const [fontSize, setFontSize] = useState(10);
    const [pairFilterModalVisible, setPairFilterModalVisible] = useState(false);
    const [selectedPairs, setSelectedPairs] = useState({});
    const [hasUserModifiedPairs, setHasUserModifiedPairs] = useState(false);
    const [hoveredIndex, setHoveredIndex] = useState(null);
    const [beadInfo, setBeadInfo] = useState({ chr: null, seq_start: null, seq_end: null });
    const [showBeadInfo, setShowBeadInfo] = useState(false);


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

    // Calculate genomic coordinates for beads
    const step = 5000;
    const newStart = useMemo(() => {
        if (!currentChromosomeSequence?.start) return 0;
        return Math.ceil(currentChromosomeSequence.start / step) * step;
    }, [currentChromosomeSequence]);

    const spheresData = useMemo(() => {
        return Object.entries(selectedSphereList[celllineName]).map(([key, { position, color }]) => {
            const { x, y, z } = position;
            const beadIndex = parseInt(key);
            const seq_start = newStart + beadIndex * step;
            const seq_end = seq_start + step;
            return {
                key,
                beadIndex,
                position: new THREE.Vector3(x, y, z),
                color,
                seq_start,
                seq_end,
            };
        });
    }, [selectedSphereList, newStart]);

    const center = useMemo(() => {
        if (spheresData.length === 0) return new THREE.Vector3();
        const group = new THREE.Group();
        spheresData.forEach(({ position }) => {
            const sphere = new THREE.Mesh(
                new THREE.SphereGeometry(2.5, 32, 32),
                new THREE.MeshBasicMaterial()
            );
            sphere.position.copy(position);
            group.add(sphere);
        });

        const box = new THREE.Box3().setFromObject(group);
        const calculatedCenter = new THREE.Vector3();
        box.getCenter(calculatedCenter);
        return calculatedCenter;
    }, [spheresData]);

    // Generate all possible pairs from current beads
    const allPossiblePairs = useMemo(() => {
        const beadsArray = Object.keys(selectedSphereList[celllineName] || {});
        const pairs = [];
        for (let i = 0; i < beadsArray.length; i++) {
            for (let j = i + 1; j < beadsArray.length; j++) {
                // Use smaller number first to match server convention
                const bead1 = parseInt(beadsArray[i]);
                const bead2 = parseInt(beadsArray[j]);
                const smaller = Math.min(bead1, bead2);
                const larger = Math.max(bead1, bead2);
                pairs.push(`${smaller}-${larger}`);
            }
        }

        return pairs;
    }, [selectedSphereList, celllineName]);

    // Initialize selectedPairs when allPossiblePairs changes
    useEffect(() => {
        setSelectedPairs(prev => {
            const newSelectedPairs = {};
            allPossiblePairs.forEach(pair => {
                newSelectedPairs[pair] = prev[pair] !== undefined ? prev[pair] : true;
            });
            
            // Only update if the set of pairs has changed
            const prevPairs = Object.keys(prev);
            const hasChanges = allPossiblePairs.length !== prevPairs.length || allPossiblePairs.some(pair => !prevPairs.includes(pair));

            // Reset user modification flag when bead selection changes
            if (hasChanges) {
                setHasUserModifiedPairs(false);
            }
            
            return hasChanges ? newSelectedPairs : prev;
        });
    }, [allPossiblePairs]);

    // Filter distribution data based on selected pairs
    const filteredDistributionData = useMemo(() => {
        if (!distributionData[celllineName]) return {};
        
        // Only apply filtering if user has actually modified the default selections
        if (!hasUserModifiedPairs) {
            return distributionData; // Show all pairs - original behavior
        }
        
        // Apply filtering only when user has made modifications
        const filtered = {};
        Object.keys(distributionData[celllineName]).forEach(pairKey => {
            if (selectedPairs[pairKey]) {
                filtered[pairKey] = distributionData[celllineName][pairKey];
            }
        });
        
        // Preserve the original structure but replace the specific cell line data
        return {
            ...distributionData,
            [celllineName]: filtered
        };
    }, [distributionData, celllineName, selectedPairs, hasUserModifiedPairs]);

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
            gl.setClearColor(new THREE.Color(chromosome3DDistanceBackgroundColor), 1);
            gl.clear();

            gl.render(scene, exportCamera);

            const buffer = new Uint8ClampedArray(width * height * 4);
            gl.readRenderTargetPixels(renderTarget, 0, 0, width, height, buffer);

            flipY(buffer, width, height);

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            const imageData = new ImageData(buffer, width, height);
            ctx.putImageData(imageData, 0, 0);

            gl.setRenderTarget(originalRenderTarget);
            gl.setSize(originalSize.x, originalSize.y);
            gl.setPixelRatio(originalPixelRatio);

            canvas.toBlob((blob) => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `chromosome_3d_${Date.now()}.png`;
                link.click();
            });

            renderTarget.dispose();
        } else {
            console.error("Renderer not properly initialized for download.");
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
                stencilBuffer: false,
            });
            renderTarget.texture.colorSpace = THREE.SRGBColorSpace;

            const originalRenderTarget = gl.getRenderTarget();
            const originalSize = gl.getSize(new THREE.Vector2());
            const originalPixelRatio = gl.getPixelRatio();

            gl.setRenderTarget(renderTarget);
            gl.setSize(width, height);
            gl.setPixelRatio(1);
            gl.setClearColor(new THREE.Color(chromosome3DDistanceBackgroundColor), 1);
            gl.clear();
            gl.render(scene, exportCamera);

            const buffer = new Uint8ClampedArray(width * height * 4);
            gl.readRenderTargetPixels(renderTarget, 0, 0, width, height, buffer);

            flipY(buffer, width, height);

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.putImageData(new ImageData(buffer, width, height), 0, 0);

            gl.setRenderTarget(originalRenderTarget);
            gl.setSize(originalSize.x, originalSize.y);
            gl.setPixelRatio(originalPixelRatio);

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: width > height ? 'landscape' : 'portrait',
                unit: 'px',
                format: [width, height],
            });

            pdf.addImage(imgData, 'PNG', 0, 0, width, height);
            pdf.save(`chromosome_3d_${Date.now()}.pdf`);

            renderTarget.dispose();
        } else {
            console.error("Renderer not properly initialized for PDF download.");
        }
    };

    useEffect(() => {
        if (rendererRef.current && rendererRef.current.gl) {
            const { gl } = rendererRef.current;
            gl.setClearColor(new THREE.Color(chromosome3DDistanceBackgroundColor), 1);
        }
    }, [chromosome3DDistanceBackgroundColor]);

    const beadsArrayString = useMemo(() => {
        return JSON.stringify(Object.keys(selectedSphereList[celllineName]).sort());
    }, [selectedSphereList, celllineName]);

    useEffect(() => {
        const beadsArray = Object.keys(selectedSphereList[celllineName]);

        // Check if we already have data for this exact set of beads
        const existingData = distributionData[celllineName];

        if (existingData && typeof existingData === 'object' && beadsArray.length > 0) {
            // Generate expected categories (bead pair combinations) for current beads
            const expectedCategories = [];
            for (let i = 0; i < beadsArray.length; i++) {
                for (let j = i + 1; j < beadsArray.length; j++) {
                    expectedCategories.push(`${beadsArray[i]}-${beadsArray[j]}`);
                }
            }

            // Check if all expected categories exist in the existing data
            const hasAllCategories = expectedCategories.every(category =>
                existingData.hasOwnProperty(category) &&
                Array.isArray(existingData[category]) &&
                existingData[category].length > 0
            );

            if (hasAllCategories) {
                setLoading(false);
                return;
            }
        }

        if (beadsArray.length < 2 || !celllineName) {
            // Clear distribution data for this cell line when no beads are selected
            if (beadsArray.length === 0) {
                setDistributionData(prev => {
                    const updated = { ...prev };
                    delete updated[celllineName];
                    return updated;
                });
            }
            setLoading(false);
            return;
        }

        setLoading(true);

        if (isExampleMode(celllineName, chromosomeName, currentChromosomeSequence)) {
            fetch('/api/getExistBeadDistribution', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    cell_line: celllineName,
                    indices: beadsArray,
                    chromosome_name: chromosomeName,
                    sequences: currentChromosomeSequence
                })
            })
                .then(res => res.json())
                .then(data => {
                    setDistributionData(prev => ({
                        ...prev,
                        [celllineName]: data
                    }));
                    setLoading(false);
                })
                .catch(error => {
                    console.error('Error fetching existing bead distribution:', error);
                    setLoading(false);
                });
        } else {
            if (!currentChromosomeSequence || !chromosomeName) {
                setLoading(false);
                return;
            }
            fetch('/api/getBeadDistribution', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    cell_line: celllineName,
                    chromosome_name: chromosomeName,
                    sequences: currentChromosomeSequence,
                    indices: beadsArray
                })
            })
                .then(res => res.json())
                .then(data => {
                    setDistributionData(prev => ({
                        ...prev,
                        [celllineName]: data
                    }));
                    setLoading(false);
                })
                .catch(error => {
                    console.error('Error fetching bead distribution:', error);
                    setLoading(false);
                });
        }
    }, [beadsArrayString, celllineName, chromosomeName, currentChromosomeSequence, isExampleMode]);

    useEffect(() => {
        if (controlsRef.current && center) {
            controlsRef.current.target.copy(center);
            controlsRef.current.update();
        }
    }, [center]);

    const onClickDownloadItem = ({ key }) => {
        if (key === '1') {
            downloadImage();
        }

        if (key === '2') {
            downloadPDF();
        }
    }

    const resetView = () => {
        if (controlsRef.current) {
            controlsRef.current.reset();
            controlsRef.current.target.copy(center);
            controlsRef.current.update();
        }
    };

    const handlePairFilterModalOpen = () => {
        setPairFilterModalVisible(true);
    };

    const handlePairFilterModalClose = () => {
        setPairFilterModalVisible(false);
    };

    const handlePairSelectionChange = (pairKey, checked) => {
        setHasUserModifiedPairs(true);
        setSelectedPairs(prev => ({
            ...prev,
            [pairKey]: checked
        }));
    };

    const handleSelectAllPairs = () => {
        setHasUserModifiedPairs(true);
        const newSelectedPairs = {};
        allPossiblePairs.forEach(pair => {
            newSelectedPairs[pair] = true;
        });
        setSelectedPairs(newSelectedPairs);
    };

    const handleDeselectAllPairs = () => {
        setHasUserModifiedPairs(true);
        const newSelectedPairs = {};
        allPossiblePairs.forEach(pair => {
            newSelectedPairs[pair] = false;
        });
        setSelectedPairs(newSelectedPairs);
    };

    const handleResetToDefault = () => {
        setHasUserModifiedPairs(false);
        const newSelectedPairs = {};
        allPossiblePairs.forEach(pair => {
            newSelectedPairs[pair] = true;
        });
        setSelectedPairs(newSelectedPairs);
    };

    const Line = ({ start, end }) => {
        const geometryRef = useRef();
        useEffect(() => {
            if (geometryRef.current) {
                geometryRef.current.setAttribute(
                    'position',
                    new THREE.Float32BufferAttribute([
                        start.x, start.y, start.z,
                        end.x, end.y, end.z,
                    ], 3)
                );
            }
        }, [start, end]);

        return (
            <line>
                <bufferGeometry ref={geometryRef} />
                <lineBasicMaterial color="white" />
            </line>
        );
    };

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <Splitter
                style={{ height: '100%' }}
                split="vertical"
                resizerStyle={{
                    background: '#d9d9d9',
                    borderLeft: '1px solid #bfbfbf',
                    borderRight: '1px solid #bfbfbf',
                    cursor: 'col-resize',
                    width: '4px',
                    zIndex: 1000
                }}
            >
                <Splitter.Panel
                    defaultSize="50%"
                    min="30%"
                    max="70%"
                    style={{ overflow: 'hidden' }}
                >
                    <div style={{ width: '100%', height: '100%', pointerEvents: 'auto' }}>
                        <BeadDistributionViolinPlot
                            selectedSphereList={selectedSphereList[celllineName] || {}}
                            distributionData={filteredDistributionData}
                            loading={loading}
                        />
                    </div>
                </Splitter.Panel>
                <Splitter.Panel style={{ overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '100%', position: 'relative', pointerEvents: 'auto' }}>
                        <div style={{
                            position: 'absolute',
                            top: 10,
                            right: 10,
                            zIndex: 10,
                            display: 'flex',
                            gap: '10px',
                        }}>
                            <Tooltip
                                title={<span style={{ color: 'black' }}>Adjust font size of distance labels</span>}
                                color='white'
                            >
                                <div style={{
                                    background: 'rgba(255, 255, 255, 0.9)',
                                    padding: '0px 8px',
                                    borderRadius: '6px',
                                    minWidth: '120px',
                                    maxHeight: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <span style={{ fontSize: '12px', color: '#333', fontWeight: '500' }}>Font:</span>
                                    <Slider
                                        min={6}
                                        max={30}
                                        value={fontSize}
                                        onChange={setFontSize}
                                        style={{ flex: 1 }}
                                        tooltip={{ 
                                            formatter: (value) => `${value}px`,
                                            color: 'white',
                                            overlayInnerProps: { 
                                                color: 'black',
                                                fontWeight: '500'
                                            }
                                        }}
                                    />
                                </div>
                            </Tooltip>
                            <Tooltip
                                title={<span style={{ color: 'black' }}>Filter which bead pairs to display</span>}
                                color='white'
                            >
                                <Button
                                    style={{
                                        fontSize: 15,
                                        cursor: "pointer",
                                    }}
                                    icon={<SettingOutlined />}
                                    onClick={handlePairFilterModalOpen}
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
                                title={<span style={{ color: 'black' }}>Download the selected beads and their distance</span>}
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
                                                <span>Background Color: </span>
                                                <ColorPicker
                                                    size="small"
                                                    trigger='hover'
                                                    value={chromosome3DDistanceBackgroundColor}
                                                    style={{ marginRight: 15 }}
                                                    onChange={(color) => {
                                                        setChromosome3DDistanceBackgroundColor(color.toHexString());
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
                                title={<span style={{ color: 'black' }}>Collapse the distance window</span>}
                                color='white'
                            >
                                <Button
                                    style={{
                                        fontSize: 15,
                                        cursor: "pointer",
                                    }}
                                    icon={<CaretUpOutlined />}
                                    onClick={() => setShowChromosome3DDistance(false)}
                                />
                            </Tooltip>
                        </div>

                        <Canvas
                            shadows
                            style={{ height: '100%', backgroundColor: '#222' }}
                            camera={{ position: [0, 0, 1000], fov: 60, near: 0.1, far: 5000 }}
                            onCreated={({ camera, gl, scene }) => {
                                cameraRef.current = camera;
                                rendererRef.current = { gl, scene, camera };
                                if (controlsRef.current) {
                                    controlsRef.current.update();
                                }
                            }}
                        >
                            <OrbitControls
                                ref={controlsRef}
                                enableZoom={true}
                                enableRotate={true}
                                enablePan={false}
                                target={center}
                            />

                            <ambientLight intensity={0.8} />
                            <directionalLight
                                position={[10, 20, 10]}
                                intensity={1}
                                castShadow
                            />
                            <spotLight
                                position={[30, 50, 50]}
                                angle={0.3}
                                penumbra={1}
                                intensity={1}
                                castShadow
                            />

                            {spheresData.map(({ position, color, seq_start, seq_end }, index) => (
                                <group 
                                    key={index} 
                                    position={position}
                                    onPointerOver={(e) => {
                                        e.stopPropagation();
                                        if (hoveredIndex !== index) {
                                            setBeadInfo({ 
                                                chr: chromosomeName, 
                                                seq_start: seq_start, 
                                                seq_end: seq_end 
                                            });
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
                                >
                                    <mesh>
                                        <sphereGeometry args={[2.5, 32, 32]} />
                                        <meshStandardMaterial
                                            receiveShadow
                                            castShadow
                                            color={color}
                                            metalness={0.3}
                                            roughness={0.1}
                                            emissiveIntensity={0.3} />
                                    </mesh>
                                    <mesh>
                                        <sphereGeometry args={[2.7, 32, 32]} />
                                        <meshBasicMaterial color="white" side={THREE.BackSide} />
                                    </mesh>
                                </group>
                            ))}

                            {spheresData.map(({ position: positionA, key: keyA }, indexA) => (
                                spheresData.map(({ position: positionB, key: keyB }, indexB) => {
                                    if (indexA < indexB) {
                                        // Use smaller number first to match server convention
                                        const bead1 = parseInt(keyA);
                                        const bead2 = parseInt(keyB);
                                        const smaller = Math.min(bead1, bead2);
                                        const larger = Math.max(bead1, bead2);
                                        const pairKey = `${smaller}-${larger}`;
                                        
                                        // Show all pairs if user hasn't modified selections, otherwise filter by selection
                                        const shouldShow = !hasUserModifiedPairs || selectedPairs[pairKey];
                                        
                                        if (!shouldShow) return null;
                                        
                                        const distance = positionA.distanceTo(positionB) - 34.3;    // diameter of beads
                                        const midPoint = new THREE.Vector3().addVectors(positionA, positionB).multiplyScalar(0.5);

                                        return (
                                            <group key={`${indexA}-${indexB}`}>
                                                <Line start={positionA} end={positionB} />
                                                <CameraFacingText
                                                    position={[midPoint.x, midPoint.y, midPoint.z]}
                                                    fontSize={fontSize}
                                                    color="white"
                                                    anchorX="center"
                                                    anchorY="middle"
                                                >
                                                    {distance.toFixed(2)}nm
                                                </CameraFacingText>
                                            </group>
                                        );
                                    }
                                    return null;
                                })
                            ))}

                            {spheresData.map(({ position, key, color }) => (
                                <group key={key}>
                                    <mesh position={position}>
                                        <sphereGeometry args={[1, 32, 32]} />
                                        <meshStandardMaterial color={color} />
                                    </mesh>
                                    <CameraFacingText
                                        position={[position.x, position.y + 5, position.z]}
                                        fontSize={fontSize}
                                        color="#DAA520"
                                        anchorX="center"
                                        anchorY="bottom"
                                    >
                                        {key}
                                    </CameraFacingText>
                                </group>
                            ))}
                        </Canvas>

                        {/* Beads hover information */}
                        {showBeadInfo && (
                            <div className={`beadInfoContainer ${showBeadInfo ? 'show' : 'hide'}`} style={{ 
                                position: 'absolute',
                                top: 40,
                                right: 10,
                                userSelect: 'none', 
                                pointerEvents: 'auto' 
                            }}>
                                <div className='beadInfoText'>Chromosome: {beadInfo.chr}</div>
                                <div className='beadInfoText'>Start: {beadInfo.seq_start}</div>
                                <div className='beadInfoText'>End: {beadInfo.seq_end}</div>
                            </div>
                        )}
                    </div>
                </Splitter.Panel>
            </Splitter>

            {/* Pair Filter Modal */}
            <Modal
                title="Filter Bead Pairs"
                open={pairFilterModalVisible}
                onCancel={handlePairFilterModalClose}
                footer={[
                    <Button key="selectAll" onClick={handleSelectAllPairs}>
                        Select All
                    </Button>,
                    <Button key="deselectAll" onClick={handleDeselectAllPairs}>
                        Deselect All
                    </Button>,
                    <Button key="close" type="primary" onClick={handlePairFilterModalClose}>
                        Close
                    </Button>
                ]}
                width={400}
            >
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <p style={{ marginBottom: '16px', color: '#666' }}>
                        Select which bead pairs to display in the visualization and violin plot.
                        {!hasUserModifiedPairs && <span style={{ color: '#52c41a', fontWeight: 'bold' }}> Currently showing all pairs (default behavior).</span>}
                    </p>
                    <Space direction="vertical" style={{ width: '100%' }}>
                        {allPossiblePairs.map(pairKey => (
                            <Checkbox
                                key={pairKey}
                                checked={selectedPairs[pairKey] || false}
                                onChange={(e) => handlePairSelectionChange(pairKey, e.target.checked)}
                            >
                                Bead pair: {pairKey}
                            </Checkbox>
                        ))}
                        {allPossiblePairs.length === 0 && (
                            <p style={{ color: '#999', fontStyle: 'italic' }}>
                                No bead pairs available. Please select at least 2 beads to see pairs.
                            </p>
                        )}
                    </Space>
                </div>
            </Modal>
        </div>
    );
};
