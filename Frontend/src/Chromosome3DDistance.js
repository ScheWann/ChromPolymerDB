import React, { useMemo, useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Button, Tooltip, Modal } from 'antd';
import { Text, OrbitControls } from '@react-three/drei';
import { BeadDistributionPlot } from './beadDistributionplot';
import { RollbackOutlined, CaretUpOutlined, DownloadOutlined, DotChartOutlined } from "@ant-design/icons";

export const Chromosome3DDistance = ({ selectedSphereList, setShowChromosome3DDistance, celllineName, chromosomeName, currentChromosomeSequence }) => {
    const controlsRef = useRef();
    const cameraRef = useRef();
    const rendererRef = useRef();
    const [openDistrubutionModal, setOpenDistrubutionModal] = useState(false);
    const [distributionData, setDistributionData] = useState([]);

    const spheresData = useMemo(() => {
        return Object.entries(selectedSphereList).map(([key, { position, color }]) => {
            const { x, y, z } = position;
            return {
                key,
                position: new THREE.Vector3(x / 0.15, y / 0.15, z / 0.15),
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

    const download = () => {
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

    const openDistribution = () => {
        setOpenDistrubutionModal(true);
        const beadsArray = Object.keys(selectedSphereList);

        fetch('/getBeadDistribution', {
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
                console.log(data, 'zsy');
                setDistributionData(data);
            });
    };

    useEffect(() => {
        if (controlsRef.current && center) {
            controlsRef.current.target.copy(center);
            controlsRef.current.update();
        }
    }, [center]);

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
        <>
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <div style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    zIndex: 10,
                    display: 'flex',
                    gap: '10px',
                }}>
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
                        title="Download the selected beads and their distance"
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
                            icon={<DownloadOutlined />}
                            onClick={download}
                        />
                    </Tooltip>
                    <Tooltip
                        title="Show distribution of the selected beads"
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
                            icon={<DotChartOutlined />}
                            onClick={openDistribution}
                        />
                    </Tooltip>
                    <Tooltip
                        title="Collapse the distance window"
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
                            icon={<CaretUpOutlined />}
                            onClick={() => setShowChromosome3DDistance(false)}
                        />
                    </Tooltip>
                </div>

                <Modal
                    title="Distribution of the selected beads"
                    width={"40vw"}
                    height={"40vh"}
                    open={openDistrubutionModal}
                    onCancel={() => setOpenDistrubutionModal(false)}
                    footer={[
                        <Button key="back" onClick={() => setOpenDistrubutionModal(false)}>
                            Close
                        </Button>
                    ]}
                >
                    <BeadDistributionPlot
                        selectedSphereList={selectedSphereList}
                        distributionData={distributionData}
                    />
                </Modal>

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
        </>
    );
};
