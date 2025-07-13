import React, { useMemo, useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import jsPDF from 'jspdf';
import { Canvas } from '@react-three/fiber';
import { Button, Tooltip, ColorPicker, Dropdown } from 'antd';
import { Text, OrbitControls } from '@react-three/drei';
import { BeadDistributionViolinPlot } from './beadDistributionViolinPlot';
import { RollbackOutlined, CaretUpOutlined, DownloadOutlined } from "@ant-design/icons";

export const Chromosome3DDistance = ({ selectedSphereList, setShowChromosome3DDistance, celllineName, chromosomeName, currentChromosomeSequence, distributionData, setDistributionData, isExampleMode }) => {
    const controlsRef = useRef();
    const cameraRef = useRef();
    const rendererRef = useRef();
    const [chromosome3DDistanceBackgroundColor, setChromosome3DDistanceBackgroundColor] = useState('#333333');
    const [loading, setLoading] = useState(false);

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

    const spheresData = useMemo(() => {
        return Object.entries(selectedSphereList[celllineName]).map(([key, { position, color }]) => {
            const { x, y, z } = position;
            return {
                key,
                position: new THREE.Vector3(x, y, z),
                color,
            };
        });
    }, [selectedSphereList]);

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

    useEffect(() => {
        setLoading(true);
        const beadsArray = Object.keys(selectedSphereList[celllineName]);

        if (isExampleMode(celllineName, chromosomeName, currentChromosomeSequence)) {
            fetch('/api/getExistBeadDistribution', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    cell_line: celllineName,
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
            });
        } else {
            if (beadsArray.length < 2 || !currentChromosomeSequence || !celllineName || !chromosomeName) return;
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
            });
        }
    }, [selectedSphereList, celllineName]);

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
        <div style={{ width: '100%', height: '100%', display: 'flex' }}>
            <div style={{ width: '50%', height: '100%' }}>
                <BeadDistributionViolinPlot
                    selectedSphereList={selectedSphereList}
                    distributionData={distributionData}
                    loading={loading}
                />
            </div>
            <div style={{ width: '50%', height: '100%', position: 'relative' }}>
                <div style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    zIndex: 10,
                    display: 'flex',
                    gap: '10px',
                }}>
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
                            dropdownRender={(menu) => (
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
                    style={{ height: 'calc(100% - 2px)', backgroundColor: '#222' }}
                    camera={{ position: [0, 0, 100], fov: 50 }}
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

                    {spheresData.map(({ position, color }, index) => (
                        <group key={index} position={position}>
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

                    {spheresData.map(({ position: positionA }, indexA) => (
                        spheresData.map(({ position: positionB }, indexB) => {
                            if (indexA < indexB) {
                                const distance = positionA.distanceTo(positionB);
                                const midPoint = new THREE.Vector3().addVectors(positionA, positionB).multiplyScalar(0.5);

                                return (
                                    <group key={`${indexA}-${indexB}`}>
                                        <Line start={positionA} end={positionB} />
                                        <Text
                                            position={[midPoint.x, midPoint.y, midPoint.z]}
                                            fontSize={10}
                                            color="white"
                                            anchorX="center"
                                            anchorY="middle"
                                        >
                                            {distance.toFixed(2)}nm
                                        </Text>
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
                            <Text
                                position={[position.x, position.y, position.z]}
                                fontSize={10}
                                color="#DAA520"
                                anchorX="center"
                                anchorY="bottom"
                            >
                                {key}
                            </Text>
                        </group>
                    ))}
                </Canvas>
            </div>
        </div>
    );
};
