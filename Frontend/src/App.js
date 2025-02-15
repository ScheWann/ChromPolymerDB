import React, { useState, useEffect } from 'react';
import { Select, Input, Button, message, Empty, Spin, Tabs, Switch, Tooltip, Tour, Typography } from 'antd';
import './App.css';
import { Heatmap } from './canvasHeatmap.js';
import { ChromosomeBar } from './chromosomeBar.js';
import { Chromosome3D } from './Chromosome3D.js';
import { ProjectIntroduction } from './projectIntroduction.js';
import { PlusOutlined, MinusOutlined, InfoCircleOutlined, ExperimentOutlined } from "@ant-design/icons";

// Random number generator from 0 to 5000
const getRandomKey = () => Math.floor(Math.random() * 5001);
// const randomKeys = new Array(3).fill(null).map(() => getRandomKey());
const randomKeys = [0, 1, 2];

function App() {
  const [isCellLineMode, setIsCellLineMode] = useState(true);
  const [geneNameList, setGeneNameList] = useState([]);
  const [cellLineList, setCellLineList] = useState([]);
  const [geneList, setGeneList] = useState([]);
  const [chromosList, setChromosList] = useState([]);
  const [cellLineName, setCellLineName] = useState(null);
  const [geneName, setGeneName] = useState(null);
  const [chromosomeName, setChromosomeName] = useState(null);
  const [chromosomeSize, setChromosomeSize] = useState({ start: 0, end: 0 });
  const [geneSize, setGeneSize] = useState({ start: 0, end: 0 });
  const [totalChromosomeSequences, setTotalChromosomeSequences] = useState([]); // First selected cell line ---> chromsome's all sequences
  const [selectedChromosomeSequence, setSelectedChromosomeSequence] = useState({ start: 0, end: 0 }); // Selected sequence range
  const [currentChromosomeSequence, setCurrentChromosomeSequence] = useState(selectedChromosomeSequence); // Current selected sequence range(used for control heatmap's zoom in/out)
  const [chromosomeData, setChromosomeData] = useState([]);
  const [validChromosomeValidIbpData, setValidChromosomeValidIbpData] = useState([]);
  const [chromosome3DExampleID, setChromosome3DExampleID] = useState(0);
  const [chromosome3DExampleData, setChromosome3DExampleData] = useState({});
  const [messageApi, contextHolder] = message.useMessage();
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [chromosome3DLoading, setChromosome3DLoading] = useState(false);
  const [chromosome3DCellLineName, setChromosome3DCellLineName] = useState(null);
  const [cellLineDict, setCellLineDict] = useState({ "K": "K562", "IMR": "IMR90", "GM": "GM12878" });

  // Heatmap Comparison settings
  const [comparisonHeatmapList, setComparisonHeatmapList] = useState([]); // List of comparison heatmaps
  const [comparisonHeatmapIndex, setComparisonHeatmapIndex] = useState(1); // Index of comparison heatmap

  // 3D Chromosome Comparison settings
  const [chromosome3DComparisonShowing, setChromosome3DComparisonShowing] = useState(false);
  const [comparisonCellLine, setComparisonCellLine] = useState(null);
  const [comparisonCellLine3DData, setComparisonCellLine3DData] = useState({});
  const [comparisonCellLine3DSampleID, setComparisonCellLine3DSampleID] = useState(0);
  const [comparisonCellLine3DLoading, setComparisonCellLine3DLoading] = useState(false);


  // Tour visibility state
  const [isTourOpen, setIsTourOpen] = useState(true);

  const { Title } = Typography;

  // Define Tour steps
  const steps = [
    {
      title: "Toggle Mode",
      description: "Switch between Cell Line and Gene fields using this toggle.",
      target: () => document.querySelector(".switchWrapper"),
    },
    {
      title: "Tooltip Icon",
      description: "Hover over this icon for more information about the toggle switch.",
      target: () => document.querySelector("#info-tooltip"),
      placement: "right",
    },
    {
      title: "Cell Line Selector",
      description: "Select a cell line using this dropdown.",
      target: () => document.querySelector(".controlGroupText:first-of-type + .ant-select"),
    },
    {
      title: "Chromosome Selector",
      description: "Choose the chromosome you want to analyze.",
      target: () => document.querySelector(".controlGroupText:nth-of-type(2) + .ant-select"),
    },
    {
      title: "Sequences Input",
      description: "Specify the sequence range using the start and end inputs.",
      target: () => document.querySelector(".controlGroupText:nth-of-type(3) + .ant-input"),
    },
    {
      title: "New Heatmap Comparison Button",
      description: "Click this button to add a new heatmap for comparison.",
      target: () => document.querySelector("#add-new-heatmap-button"),
    },
    {
      title: "Check Button",
      description: "Click this button to fetch the selected data.",
      target: () => document.querySelector("#submit-button"),
    },
    {
      title: "Chromosome Bar",
      cover: (
        <img
          src="/ChromosomeBarTourPic.png"
        />
      ),
      description: (<>This bar visualizes and allows you to select specific sequences on the chromosome.The <span style={{ color: 'green', fontWeight: 'bold' }}>green color</span> shows the valid data, the <span style={{ color: '#999', fontWeight: 'bold' }}>blank area</span> represents the missing data, and the <span style={{ color: 'orange', fontWeight: 'bold' }}>orange color</span> shows your current valid data range with your selected sequences.</>),
      target: () => document.querySelector("#chromosome-bar"), // Targeting ChromosomeBar
      placement: "bottom",
    },
  ];

  // Add "," to the number by every 3 digits
  const formatNumber = (value) => {
    if (!value) return '';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  useEffect(() => {
    if (!isCellLineMode) {
      fetchGeneNameList();
    }
    fetchCellLineList();
  }, []);

  useEffect(() => {
    if (cellLineName && chromosomeName) {
      fetchChromosomeSequences();
    }
  }, [cellLineName, chromosomeName]);

  useEffect(() => {
    if (totalChromosomeSequences.length > 0) {
      if (isCellLineMode) {
        setSelectedChromosomeSequence({ start: totalChromosomeSequences[0].start, end: totalChromosomeSequences[0].end });
      } else {
        setSelectedChromosomeSequence({ start: geneSize.start - 1500000, end: geneSize.end + 1500000 });
      }
    }
  }, [totalChromosomeSequences]);

  const fetchChromosomeSequences = () => {
    fetch('/getChromosSequence', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cell_line: cellLineName, chromosome_name: chromosomeName })
    })
      .then(res => res.json())
      .then(data => {
        setTotalChromosomeSequences(data);
      });
  }

  const fetchGeneNameList = () => {
    fetch('/getGeneNameList')
      .then(res => res.json())
      .then(data => {
        setGeneNameList(data);
      });
  }

  const fetchCellLineList = () => {
    fetch('/getCellLines')
      .then(res => res.json())
      .then(data => {
        setCellLineList(data);
      });
  };

  const fetchChromosomeList = (value) => {
    fetch('/getChromosList', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cell_line: value })
    })
      .then(res => res.json())
      .then(data => {
        setChromosList(data);
      });
  };

  const fetchChromosomeSize = (value) => {
    fetch("/getChromosSize", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ chromosome_name: value })
    })
      .then(res => res.json())
      .then(data => {
        setChromosomeSize({ start: 1, end: data });
      });
  };

  const fetchChromosomeSizeByGeneName = (value) => {
    fetch("/getChromosSizeByGeneName", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ gene_name: value })
    })
      .then(res => res.json())
      .then(data => {
        const chromosomeName = `chr${data.chromosome}`;
        setChromosomeName(chromosomeName);
        fetchChromosomeSize(chromosomeName);
        setSelectedChromosomeSequence({ start: data.start_location - 1500000, end: data.end_location + 1500000 });
        setGeneSize({ start: data.start_location, end: data.end_location });
      })
  }

  const fetchChromosomeData = () => {
    if (selectedChromosomeSequence.end - selectedChromosomeSequence.start > 4000000) {
      warning('overrange');
    } else if (!cellLineName || !chromosomeName) {
      warning('noData');
    } else {
      fetch("/getChromosData", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cell_line: cellLineName, chromosome_name: chromosomeName, sequences: selectedChromosomeSequence })
      })
        .then(res => res.json())
        .then(data => {
          setChromosomeData(data);
          setHeatmapLoading(false);
        });
    }
  };

  const fetchValidChromosomeValidIbpData = () => {
    fetch("/getChromosValidIBPData", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cell_line: cellLineName, chromosome_name: chromosomeName, sequences: selectedChromosomeSequence })
    })
      .then(res => res.json())
      .then(data => {
        setValidChromosomeValidIbpData(data);
      });
  }

  const fetchExampleChromos3DData = (cell_line, sample_id, sampleChange, isComparison) => {
    if (cell_line && chromosomeName && selectedChromosomeSequence) {
      const keyPrefix = isComparison ? `${cell_line}-COMPARISON` : cellLineName;

      const cacheKey = `${keyPrefix}-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}-${sample_id}`;

      const cachedData = isComparison ?
        comparisonCellLine3DData[cacheKey] :
        chromosome3DExampleData[cacheKey];

      if (!cachedData) {
        if (isComparison) {
          setComparisonCellLine3DLoading(true);
        }
      } else {
        return;
      }

      fetch("/getExampleChromos3DData", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cell_line: cell_line,
          chromosome_name: chromosomeName,
          sequences: selectedChromosomeSequence,
          sample_id: sample_id
        })
      })
        .then(res => res.json())
        .then(data => {
          if (isComparison) {
            setComparisonCellLine3DData(prev => ({
              ...prev,
              [cacheKey]: data,
            }));
            setComparisonCellLine3DLoading(false);
          } else {
            setChromosome3DExampleData(prev => ({
              ...prev,
              [cacheKey]: data,
            }));
            if (sampleChange === "submit") {
              setChromosome3DLoading(false);
            }
          }
        });
    }
  };

  const fetchGeneList = () => {
    if (chromosomeName && selectedChromosomeSequence) {
      let filteredChromosomeName = chromosomeName.slice(3);
      fetch("/getGeneList", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chromosome_name: filteredChromosomeName, sequences: selectedChromosomeSequence })
      })
        .then(res => res.json())
        .then(data => {
          setGeneList(data);
        });
    }
  };

  const fetchGeneNameBySearch = (value) => {
    fetch("/geneListSearch", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ search: value })
    })
      .then(res => res.json())
      .then(data => {
        setGeneNameList(data);
      });
  }

  // Warning message
  const warning = (type) => {
    if (type === 'overrange') {
      messageApi.open({
        type: 'warning',
        content: 'Please limits the range to 4,000,000',
        duration: 1.5,
      });
    }
    if (type === 'overSelectedRange') {
      messageApi.open({
        type: 'warning',
        content: 'Please input the range within the selected sequence',
        duration: 1.5,
      });
    }
    if (type === 'smallend') {
      messageApi.open({
        type: 'warning',
        content: 'Please set the end value greater than the start value',
        duration: 1.5,
      });
    }
    if (type === 'noCellLine') {
      messageApi.open({
        type: 'warning',
        content: 'Select cell line first',
        duration: 1.5,
      });
    }
    if (type === 'noData') {
      messageApi.open({
        type: 'warning',
        content: 'Select cell line and chromosome first',
        duration: 1.5,
      });
    }
    if (type === 'noComparison3DData') {
      messageApi.open({
        type: 'warning',
        content: 'No Cell Line with the same chromosome and sequence',
        duration: 1.5,
      });
    }
  };

  // Mode change (Cell Line / Gene)
  const modeChange = checked => {
    setIsCellLineMode(checked);
    setGeneName(null);
    setChromosomeName(null);
    setChromosomeSize({ start: 0, end: 0 });
    setSelectedChromosomeSequence({ start: 0, end: 0 });
    setChromosomeData([]);
    setChromosome3DExampleData({});
    fetchCellLineList();
    if (!checked) {
      fetchGeneNameList();
    }
  };

  // Cell Line selection change
  const cellLineChange = value => {
    setCellLineName(value);
    setChromosomeName(null);
    setChromosomeSize({ start: 0, end: 0 });
    setSelectedChromosomeSequence({ start: 0, end: 0 });
    setGeneName(null);
    setChromosomeData([]);
    setChromosome3DExampleData({});
    setComparisonCellLine3DData({});
    fetchChromosomeList(value);
    setChromosome3DComparisonShowing(false);
  };

  // Gene selection change
  const geneNameChange = value => {
    if (!cellLineName) {
      warning('noCellLine');
    } else {
      setGeneName(value);
      fetchChromosomeSizeByGeneName(value);
    }
  };

  const geneNameSearch = value => {
    fetchGeneNameBySearch(value);
  }

  // Chromosome selection change
  const chromosomeChange = value => {
    setChromosomeName(value);
    setChromosomeData([]);
    setChromosome3DExampleData({});
    setComparisonCellLine3DData({});
    setComparisonCellLine(null);
    setComparisonCellLine3DSampleID(0);
    fetchChromosomeSize(value);
    setChromosome3DComparisonShowing(false);
  };

  // Chromosome sequence change
  const chromosomeSequenceChange = (position, value) => {
    const newValue = value !== "" && !isNaN(value) ? Number(value) : 0;

    setChromosome3DComparisonShowing(false);
    setComparisonCellLine(null);
    setComparisonCellLine3DSampleID(0);
    setComparisonCellLine3DData({});

    setSelectedChromosomeSequence((prevState) => ({
      ...prevState,
      [position]: newValue,
    }));
  };

  // Heatmap Add button click
  const addNewComparisonHeatmap = () => {
    setComparisonHeatmapList((prev) => [...prev, comparisonHeatmapIndex]);
    setComparisonHeatmapIndex((prev) => prev + 1);
  }

  const removeComparisonHeatmap = (index) => {
    setComparisonHeatmapList((prev) => prev.filter((i) => i !== index));
  };

  // 3D Original Chromosome sample change
  const originalSampleChange = (key) => {
    setChromosome3DExampleID(key);
    const cacheKey = `${cellLineName}-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}-${key}`;
    if (!chromosome3DExampleData[cacheKey]) {
      fetchExampleChromos3DData(cellLineName, key, "sampleChange", false);
    };
  };

  // 3D Comparison Chromosome sample change
  const comparisonSampleChange = (key) => {
    setComparisonCellLine3DSampleID(key);
    
    const cacheKey = `${comparisonCellLine}-COMPARISON-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}-${key}`;
    
    setComparisonCellLine3DData(prev => {
      const newData = { ...prev };
      delete newData[cacheKey];
      return newData;
    });

    fetchExampleChromos3DData(comparisonCellLine, key, "sampleChange", true);
  };

  // Add 3D Chromosome Comparison
  const handleAddChromosome3D = () => {
    setChromosome3DComparisonShowing(true);
  };

  // Remove 3D Chromosome Comparison
  const handleRemoveChromosome3D = () => {
    setChromosome3DComparisonShowing(false);
  };

  // Comparison Cell Line change
  const comparisonCellLineChange = (value) => {
    setComparisonCellLine(value);
    setComparisonCellLine3DLoading(true);
    fetchExampleChromos3DData(value, comparisonCellLine3DSampleID, "sampleChange", true);
  };

  // Submit button click
  const submit = () => {
    if (selectedChromosomeSequence.end - selectedChromosomeSequence.start > 4000000) {
      warning('overrange');
    } else if (selectedChromosomeSequence.start >= selectedChromosomeSequence.end) {
      warning('smallend');
    } else if (!cellLineName || !chromosomeName) {
      warning('noData');
    } else {
      setHeatmapLoading(true);
      setCurrentChromosomeSequence(selectedChromosomeSequence);

      setChromosome3DComparisonShowing(false);
      setComparisonCellLine3DSampleID(0);
      setComparisonCellLine3DData({});
      setChromosome3DExampleID(0);
      setChromosome3DExampleData({});
      fetchChromosomeData();
      fetchValidChromosomeValidIbpData();
      fetchGeneList();
    }
  };

  return (
    <div className="App">
      {contextHolder}

      {/* Tour Component */}
      <Tour
        open={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        steps={steps}
      />

      {/* Header Section */}
      <div className="controlHeader">
        <div className="controlGroup">
          <div
            className="switchWrapper"
            style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '10px' }}
          >
            <Title
              level={5}
              style={{ color: '#1890ff', textAlign: 'center', margin: "0px 10px 0px 0px" }}
            >
              <ExperimentOutlined /> ChromPolymerDB
            </Title>
            <Switch
              checkedChildren="Cell Line"
              unCheckedChildren="Gene"
              checked={isCellLineMode}
              onChange={modeChange}
              size="small"
              style={{
                backgroundColor: isCellLineMode ? '#74C365' : '#ED9121',
              }}
            />
            <Tooltip
              title="Toggle to switch between Cell Line and Gene fields."
              color='white'
              overlayInnerStyle={{
                color: 'black'
              }}
            >
              <InfoCircleOutlined
                id="info-tooltip"
                style={{ fontSize: '16px', color: '#999', cursor: 'pointer' }}
              />
            </Tooltip>
          </div>

          {isCellLineMode ? (
            <div className='inputGroup'>
              <span className="controlGroupText">Cell Line:</span>
              <Select
                value={cellLineName}
                size="small"
                style={{
                  width: "18%"
                }}
                onChange={cellLineChange}
                options={cellLineList}
              />
              <span className="controlGroupText">Chromosome:</span>
              <Select
                value={chromosomeName}
                size="small"
                style={{
                  width: "10%"
                }}
                onChange={chromosomeChange}
                options={chromosList}
              />
              <span className="controlGroupText">Sequences:</span>
              <Input size="small" style={{ width: "8%" }} placeholder="Start" onChange={(e) => chromosomeSequenceChange('start', e.target.value)} value={selectedChromosomeSequence.start} />
              <span className="controlGroupText">~</span>
              <Input size="small" style={{ width: "8%" }} placeholder="End" onChange={(e) => chromosomeSequenceChange('end', e.target.value)} value={selectedChromosomeSequence.end} />
              <Tooltip
                title="Add a new heatmap"
                color='white'
                overlayInnerStyle={{
                  color: 'black'
                }}>
                <Button id="add-new-heatmap-button" disabled={!Object.keys(chromosome3DExampleData).length} size="small" icon={<PlusOutlined />} onClick={addNewComparisonHeatmap} />
              </Tooltip>
              <Tooltip
                title="View non-random chromosomal interactions as heatmap"
                color='white'
                overlayInnerStyle={{
                  color: 'black'
                }}>
                <Button id="submit-button" size="small" color="primary" variant="outlined" onClick={submit}>Show Heatmap</Button>
              </Tooltip>
            </div>
          ) : (
            <div className='inputGroup'>
              <span className="controlGroupText">Cell Line:</span>
              <Select
                value={cellLineName}
                size="small"
                style={{
                  width: "18%",
                  marginRight: 20,
                }}
                onChange={cellLineChange}
                options={cellLineList}
              />
              <span className="controlGroupText">Gene:</span>
              <Select
                showSearch
                value={geneName}
                size="small"
                style={{
                  width: "10%",
                  marginRight: 20,
                }}
                onChange={geneNameChange}
                onSearch={geneNameSearch}
                options={geneNameList}
              />
              <Tooltip
                title="Add a new heatmap"
                color='white'
                overlayInnerStyle={{
                  color: 'black'
                }}>
                <Button id="add-new-heatmap-button" disabled={chromosomeData.length === 0} size="small" icon={<PlusOutlined />} onClick={addNewComparisonHeatmap} />
              </Tooltip>
              <Tooltip
                title="View non-random chromosomal interactions as heatmap"
                color='white'
                overlayInnerStyle={{
                  color: 'black'
                }}>
                <Button id="submit-button" size="small" color="primary" variant="outlined" onClick={submit}>Show Heatmap</Button>
              </Tooltip>
            </div>
          )}

          <div className='chromosomeBarColorLegend'>
            <div style={{ display: "flex", alignItems: "center", marginBottom: "5px" }}>
              <div className='chromosomeBarColorRect' style={{ backgroundColor: "#74C365" }}></div>
              <span>Available regions</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", marginBottom: "5px" }}>
              <div className="chromosomeBarColorRect" style={{ backgroundColor: "#FFD700" }}></div>
              <span>Selected region</span>
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div className="chromosomeBarColorRect" style={{ backgroundColor: "#FFFFFF" }}></div>
              <span>Unavailable regions</span>
            </div>
          </div>
        </div>
        <ChromosomeBar
          warning={warning}
          formatNumber={formatNumber}
          selectedChromosomeSequence={selectedChromosomeSequence}
          setSelectedChromosomeSequence={setSelectedChromosomeSequence}
          chromosomeSize={chromosomeSize}
          totalChromosomeSequences={totalChromosomeSequences}
        />
      </div>

      {/* main content part */}
      <div className='content'>
        {/* project introduction */}
        {!heatmapLoading &&
          chromosomeData.length === 0 &&
          Object.keys(chromosome3DExampleData).length === 0 && (
            <ProjectIntroduction />
          )}

        {!(chromosomeData.length === 0 && Object.keys(chromosome3DExampleData).length === 0) && (
          <>
            {/* Original Heatmap */}
            {heatmapLoading ? (
              <Spin spinning={true} size="large" style={{ width: '720px', height: '100%', borderRight: "1px solid #eaeaea", margin: 0 }} />
            ) : (
              chromosomeData.length > 0 && (
                <Heatmap
                  cellLineDict={cellLineDict}
                  comparisonHeatmapId={null}
                  warning={warning}
                  formatNumber={formatNumber}
                  setChromosome3DExampleData={setChromosome3DExampleData}
                  cellLineList={cellLineList}
                  geneList={geneList}
                  cellLineName={cellLineName}
                  chromosomeName={chromosomeName}
                  chromosomeData={chromosomeData}
                  currentChromosomeSequence={currentChromosomeSequence}
                  setCurrentChromosomeSequence={setCurrentChromosomeSequence}
                  geneSize={geneSize}
                  totalChromosomeSequences={totalChromosomeSequences}
                  selectedChromosomeSequence={selectedChromosomeSequence}
                  chromosome3DExampleID={chromosome3DExampleID}
                  geneName={geneName}
                  setSelectedChromosomeSequence={setSelectedChromosomeSequence}
                  setChromosome3DLoading={setChromosome3DLoading}
                  setComparisonCellLine3DData={setComparisonCellLine3DData}
                  setComparisonCellLine3DLoading={setComparisonCellLine3DLoading}
                  setGeneName={setGeneName}
                  setGeneSize={setGeneSize}
                  comparisonHeatmapList={comparisonHeatmapList}
                  removeComparisonHeatmap={removeComparisonHeatmap}
                  setChromosome3DCellLineName={setChromosome3DCellLineName}
                />
              )
            )}

            {/* Comparison Heatmaps */}
            {comparisonHeatmapList.map((index) => (
              <Heatmap
                key={index}
                comparisonHeatmapId={index}
                cellLineDict={cellLineDict}
                warning={warning}
                formatNumber={formatNumber}
                setChromosome3DExampleData={setChromosome3DExampleData}
                cellLineList={cellLineList}
                geneList={geneList}
                cellLineName={cellLineName}
                chromosomeName={chromosomeName}
                chromosomeData={[]}
                currentChromosomeSequence={currentChromosomeSequence}
                setCurrentChromosomeSequence={setCurrentChromosomeSequence}
                setChromosomeData={setChromosomeData}
                geneSize={geneSize}
                totalChromosomeSequences={totalChromosomeSequences}
                selectedChromosomeSequence={selectedChromosomeSequence}
                chromosome3DExampleID={chromosome3DExampleID}
                geneName={geneName}
                setSelectedChromosomeSequence={setSelectedChromosomeSequence}
                setChromosome3DLoading={setChromosome3DLoading}
                setComparisonCellLine3DData={setComparisonCellLine3DData}
                setComparisonCellLine3DLoading={setComparisonCellLine3DLoading}
                setGeneName={setGeneName}
                setGeneSize={setGeneSize}
                comparisonHeatmapList={comparisonHeatmapList}
                removeComparisonHeatmap={removeComparisonHeatmap}
                setChromosome3DCellLineName={setChromosome3DCellLineName}
              />
            ))}

            {/* Original 3D chromosome */}
            {chromosome3DLoading ? (
              <Spin spinning={true} size="large" style={{ width: `calc(max(800px, 100% - ${comparisonHeatmapList.length + 1} * 720px))`, height: '100%', margin: 0 }} />
            ) : (
              Object.keys(chromosome3DExampleData).length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', height: '100%', width: `calc(max(800px, 100% - ${comparisonHeatmapList.length + 1} * 720px))` }}>
                  <div style={{ width: chromosome3DComparisonShowing ? "49.9%" : "100%", minWidth: "800px", marginRight: chromosome3DComparisonShowing ? '0.2%' : '0%' }}>
                    <Tabs
                      size="small"
                      defaultActiveKey={chromosome3DExampleID}
                      style={{ width: '100%', height: '100%' }}
                      onChange={originalSampleChange}
                      tabBarExtraContent={
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginRight: '5px' }}>
                          <div style={{ fontSize: 12, fontWeight: 'bold', marginRight: 10 }}>
                            <span style={{ marginRight: 5 }}>Cell Line:</span>
                            <span>{cellLineDict[chromosome3DCellLineName]}</span>
                          </div>
                          <Tooltip
                            title="Add a second cell line to compare"
                            color='white'
                            overlayInnerStyle={{
                              color: 'black'
                            }}
                          >
                            <Button
                              style={{
                                fontSize: 15,
                                cursor: "pointer",
                                marginRight: 5,
                              }}
                              size="small"
                              icon={<PlusOutlined />}
                              onClick={handleAddChromosome3D}
                            />
                          </Tooltip>
                        </div>
                      }
                      items={randomKeys.map((sampleId, i) => {
                        const cacheKey = `${cellLineName}-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}-${sampleId}`;
                        return {
                          label: `Sample ${i + 1}`,
                          key: sampleId,
                          children: chromosome3DExampleData[cacheKey] ? (
                            <Chromosome3D
                              formatNumber={formatNumber}
                              geneSize={geneSize}
                              chromosome3DExampleData={chromosome3DExampleData[cacheKey]}
                              validChromosomeValidIbpData={validChromosomeValidIbpData}
                              selectedChromosomeSequence={selectedChromosomeSequence}
                            />
                          ) : (
                            <Spin size="large" style={{ margin: '20px 0' }} />
                          )
                        };
                      })}
                    />
                  </div>

                  {/* Comparison 3D chromosome */}
                  {chromosome3DComparisonShowing && (
                    <div style={{ width: "49.9%", minWidth: "800px" }}>
                      <Tabs
                        size="small"
                        defaultActiveKey={chromosome3DExampleID}
                        style={{ width: '100%', height: '100%' }}
                        onChange={comparisonSampleChange}
                        tabBarExtraContent={
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginRight: '5px' }}>
                            <Select
                              value={comparisonCellLine}
                              style={{
                                minWidth: 150,
                                maxWidth: 400,
                                marginRight: 10,
                              }}
                              size="small"
                              onChange={comparisonCellLineChange}
                              options={cellLineList}
                            />
                            <Tooltip
                              title="Collapse the second cell line window"
                              color='white'
                              overlayInnerStyle={{
                                color: 'black'
                              }}
                            >
                              <Button
                                style={{
                                  fontSize: 15,
                                  cursor: 'pointer',
                                }}
                                size="small"
                                icon={<MinusOutlined />}
                                onClick={handleRemoveChromosome3D}
                              />
                            </Tooltip>
                          </div>
                        }

                        items={randomKeys.map((sampleId, i) => {
                          const cacheKey = `${comparisonCellLine}-COMPARISON-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}-${sampleId}`;

                          return {
                            label: `Sample ${i + 1}`,
                            key: sampleId,
                            children: (
                              comparisonCellLine3DLoading && !comparisonCellLine3DData[cacheKey] ? (
                                <Spin size="large" style={{ margin: '20px 0' }} />
                              ) : (
                                <Chromosome3D
                                  formatNumber={formatNumber}
                                  geneSize={geneSize}
                                  chromosome3DExampleData={comparisonCellLine3DData[cacheKey] || []}
                                  validChromosomeValidIbpData={validChromosomeValidIbpData}
                                  selectedChromosomeSequence={selectedChromosomeSequence}
                                />
                              )
                            )
                          };
                        })}
                      />
                    </div>
                  )}
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;