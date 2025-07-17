import React, { useState, useEffect, useRef } from 'react';
import { Select, Button, message, Spin, Tabs, Switch, Tooltip, Tour, Typography, Dropdown, InputNumber, AutoComplete } from 'antd';
import './Styles/App.css';
import { Heatmap } from './hicHeatmap.js';
import { ChromosomeBar } from './chromosomeBar.js';
import { Chromosome3D } from './chromosome3D.js';
import { ProjectIntroduction } from './projectIntroduction.js';
import { PlusOutlined, MinusOutlined, InfoCircleOutlined, ExperimentOutlined, DownloadOutlined, SyncOutlined, FolderViewOutlined } from "@ant-design/icons";


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
  const [totalOriginalChromosomeValidSequences, setTotalOriginalChromosomeValidSequences] = useState([]); // chromsome's all original valid sequences
  const [totalChromosomeSequences, setTotalChromosomeSequences] = useState([]); // First selected sequence ---> chromsome's all merged valid sequences
  const [selectedChromosomeSequence, setSelectedChromosomeSequence] = useState({ start: 0, end: 0 }); // Selected sequence range
  const [currentChromosomeSequence, setCurrentChromosomeSequence] = useState(selectedChromosomeSequence); // Current selected sequence range(used for control heatmap's zoom in/out)
  const [startSequencesOptions, setStartSequencesOptions] = useState([]); // Options for the start sequences input
  const [endSequencesOptions, setEndSequencesOptions] = useState([]); // Options for the end sequences input
  const [startInputValue, setStartInputValue] = useState(null);
  const [endInputValue, setEndInputValue] = useState(null);
  const [chromosomeData, setChromosomeData] = useState([]);
  const [validChromosomeValidIbpData, setValidChromosomeValidIbpData] = useState([]);
  const [chromosome3DExampleID, setChromosome3DExampleID] = useState(0);
  const [chromosome3DExampleData, setChromosome3DExampleData] = useState({});
  const [messageApi, contextHolder] = message.useMessage();
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [chromosome3DLoading, setChromosome3DLoading] = useState(false);
  const [chromosome3DCellLineName, setChromosome3DCellLineName] = useState(null);
  const [originalChromosomeDistanceDownloadSpinner, setOriginalChromosomeDownloadSpinner] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [selectedSphereLists, setSelectedSphereLists] = useState({});
  const [distributionData, setDistributionData] = useState({});
  const [tempSampleId, setTempSampleId] = useState(null);
  const [exampleDataItems, setExampleDataItems] = useState([
    {
      key: 'GM12878',
      label: 'GM12878-Chr8-127300000-128300000',
    },
    {
      key: 'IMR90',
      label: 'IMR90-Chr8-127300000-128300000',
    },
    {
      key: 'NHEK',
      label: 'NHEK-Chr8-127300000-128300000',
    }
  ])
  const [sampleKeys, setSampleKeys] = useState([0, 1000, 2000]);
  const [exampleDataBestSampleID, setExampleDataBestSampleID] = useState({ "GM12878": 4229, "IMR90": 559, "NHEK": 4225 }); // Example data best sample ID
  const [ChromosomeDataSpinnerProgress, setChromosomeDataSpinnerProgress] = useState(0);

  // Heatmap Comparison settings
  const [comparisonHeatmapList, setComparisonHeatmapList] = useState([]); // List of comparison heatmaps
  const [comparisonHeatmapIndex, setComparisonHeatmapIndex] = useState(1); // Index of comparison heatmap
  const [comparisonHeatmapCellLines, setComparisonHeatmapCellLines] = useState({}); // Track selected cell lines for each comparison heatmap
  const [comparisonHeatmapUpdateTrigger, setComparisonHeatmapUpdateTrigger] = useState({}); // Trigger updates for comparison heatmaps

  // 3D Chromosome Multiple Components settings
  const [chromosome3DComponents, setChromosome3DComponents] = useState([]); // Array of component configs
  const [chromosome3DComponentIndex, setChromosome3DComponentIndex] = useState(1); // Next component index

  // Tour visibility state
  const [isTourOpen, setIsTourOpen] = useState(true);

  const { Title } = Typography;

  const startRef = useRef(0);
  const endRef = useRef(0);

  // Define Tour steps
  const steps = [
    {
      title: "Tutorial",
      description: "Tutorial for a quick overview of this database’s purpose and key features.",
      target: () => document.querySelector(".projectTutorial"),
    },
    {
      title: "Toggle Mode",
      description: "Switch between Cell Line and Gene fields using this toggle.",
      target: () => document.querySelector(".switchWrapper"),
    },
    {
      title: "Example Data",
      description: "Click here to load example data.",
      target: () => document.querySelector(".exampleData"),
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
      title: "Genomic Locations Input",
      description: "Specify the genomic location using the start and end inputs.",
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

  // varify if in example mode
  const isExampleMode = (cellLineName, chromosomeName, selectedChromosomeSequence) => {
    const validCellLines = ['GM12878', 'IMR90', 'NHEK'];
    const isMainCellLineOK = validCellLines.includes(cellLineName);
    const isChromosomeOK = chromosomeName === 'chr8';
    const isSequenceOK = selectedChromosomeSequence.start === 127300000 && selectedChromosomeSequence.end === 128300000;

    return isMainCellLineOK && isChromosomeOK && isSequenceOK;
  }

  useEffect(() => {
    fetch('/api/clearFoldingInputFolderInputContent', { method: 'POST' });
  }, []);

  // Effect that triggers after selectedChromosomeSequence changes
  useEffect(() => {
    if (isExampleMode(cellLineName, chromosomeName, selectedChromosomeSequence)) {
      setCurrentChromosomeSequence(selectedChromosomeSequence);
      // Call dependent logic after selectedChromosomeSequence has been updated
      fetchChromosomeList(cellLineName);
      fetchChromosomeSize(chromosomeName);

      setChromosome3DComponents([]);
      setChromosome3DComponentIndex(1);
      setChromosome3DExampleID(0);
      setChromosome3DExampleData({});
      fetchChromosomeData(selectedChromosomeSequence);
      fetchValidChromosomeValidIbpData(selectedChromosomeSequence);
      fetchGeneList(selectedChromosomeSequence);
      setChromosome3DCellLineName(cellLineName);
    }
  }, [selectedChromosomeSequence]);

  useEffect(() => {
    if (!isCellLineMode) {
      fetchGeneNameList();
    }
    fetchCellLineList();
  }, []);

  useEffect(() => {
    if (cellLineName && chromosomeName) {
      fetchOriginalValidChromosomeSequences();
      fetchMergedValidChromosomeSequences();
    }
  }, [cellLineName, chromosomeName]);

  useEffect(() => {
    if (totalChromosomeSequences.length > 0) {
      if (!isExampleMode(cellLineName, chromosomeName, selectedChromosomeSequence)) {
        if (!isCellLineMode) {
          const matchedSeq = totalOriginalChromosomeValidSequences.find(seq =>
            seq.start <= geneSize.start && seq.end >= geneSize.end
          );
          if (matchedSeq) {
            setSelectedChromosomeSequence({ start: matchedSeq.start, end: matchedSeq.end });
          } else {
            warning('noCoveredGene');
          }
        }
      }
    }
  }, [totalChromosomeSequences, totalOriginalChromosomeValidSequences]);

  // fetch 3D chromosome data progress
  const progressPolling = (cellLineName, chromosomeName, sequence, sampleId, isExist) => {
    setChromosomeDataSpinnerProgress(0);
    let first = true;

    const fetchProgress = () => {
      fetch(
        `/api/getExample3DProgress`
        + `?cell_line=${cellLineName}`
        + `&chromosome_name=${chromosomeName}`
        + `&start=${sequence.start}`
        + `&end=${sequence.end}`
        + `&sample_id=${sampleId}`
        + `&is_exist=${isExist}`
      )
        .then(res => res.json())
        .then(({ percent }) => {
          setChromosomeDataSpinnerProgress(percent);

          if (percent >= 99) {
            // Progress complete, reset the progress and stop polling
            setChromosomeDataSpinnerProgress(0);
            return;
          }

          const delay = first ? 100 : 1000;
          first = false;

          setTimeout(fetchProgress, delay);
        })
        .catch(error => {
          console.error('Error fetching progress:', error);
          setChromosomeDataSpinnerProgress(0);
        });
    };

    setTimeout(fetchProgress, 100);
  }

  // update original part when chromosome3DExampleID changes
  useEffect(() => {
    const originalCacheKey = `${cellLineName}-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}-${chromosome3DExampleID}`;

    if (!chromosome3DExampleData[originalCacheKey]) return;

    const selectedBeads = Object.keys(selectedSphereLists[cellLineName] || {});
    if (selectedBeads.length > 0) {
      selectedBeads.forEach((index) => {
        setSelectedSphereLists((prev) => ({
          ...prev,
          [cellLineName]: {
            ...(prev[cellLineName] || {}),
            [index]: {
              position: chromosome3DExampleData[originalCacheKey][index],
              color: prev[cellLineName][index].color,
            },
          },
        }));
      });
    }
  }, [chromosome3DExampleID, chromosome3DExampleData]);

  // update multiple chromosome3D components when sample IDs change
  useEffect(() => {
    chromosome3DComponents.forEach((component) => {
      const comparisonCacheKey = `${component.cellLine}-COMPARISON-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}-${component.sampleID}`;

      if (!component.data[comparisonCacheKey]) return;

      const selectedBeads = Object.keys(selectedSphereLists[cellLineName] || {});
      if (selectedBeads.length > 0) {
        selectedBeads.forEach((index) => {
          setSelectedSphereLists((prev) => ({
            ...prev,
            [component.cellLine]: {
              ...(prev[component.cellLine] || {}),
              [index]: {
                position: component.data[comparisonCacheKey][index],
                color: prev[cellLineName][index].color,
              },
            },
          }));
        });
      }
    });
  }, [chromosome3DComponents, selectedSphereLists[cellLineName]]);

  const fetchExistChromos3DData = (isBest, value, cellLineName, componentId = null) => {
    const sampleID = isBest ? 0 : value;
    const isComparison = componentId !== null;
    const keyPrefix = isComparison ? `${cellLineName}-COMPARISON` : cellLineName;
    const cacheKey = `${keyPrefix}-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}-${sampleID}`;

    const cachedData = isComparison ?
      chromosome3DComponents.find(c => c.id === componentId)?.data[cacheKey] :
      chromosome3DExampleData[cacheKey];

    if (cachedData) {
      // Data already exists, no need to fetch
      return;
    }

    // Set loading state before fetching
    if (isComparison) {
      setChromosome3DComponents(prev => 
        prev.map(comp => 
          comp.id === componentId 
            ? { ...comp, loading: true }
            : comp
        )
      );
    } else {
      setChromosome3DLoading(true);
    }

    fetch('/api/getExistChromosome3DData', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cell_line: cellLineName, sample_id: value })
    })
      .then(res => res.json())
      .then(data => {
        if (isComparison) {
          // Update the specific component's data
          setChromosome3DComponents(prev => 
            prev.map(comp => 
              comp.id === componentId 
                ? { 
                    ...comp, 
                    data: {
                      ...comp.data,
                      [cacheKey]: data["position_data"],
                      [cacheKey + "_avg_matrix"]: data["avg_distance_data"],
                      [cacheKey + "_fq_data"]: data["fq_data"],
                      [cacheKey + "sample_distance_vector"]: data["sample_distance_vector"]
                    },
                    loading: false
                  }
                : comp
            )
          );
        } else {
          setChromosome3DExampleData(prev => ({
            ...prev,
            [cacheKey]: data["position_data"],
            [cacheKey + "_avg_matrix"]: data["avg_distance_data"],
            [cacheKey + "_fq_data"]: data["fq_data"],
            [cacheKey + "sample_distance_vector"]: data["sample_distance_vector"]
          }));
          setChromosome3DLoading(false);
        }
      })
      .catch(error => {
        console.error('Error fetching chromosome 3D data:', error);
        // Reset loading state on error
        if (isComparison) {
          setChromosome3DComponents(prev => 
            prev.map(comp => 
              comp.id === componentId 
                ? { ...comp, loading: false }
                : comp
            )
          );
        } else {
          setChromosome3DLoading(false);
        }
      });
  }

  const fetchMergedValidChromosomeSequences = () => {
    fetch('/api/getChromosMergedValidSequence', {
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

  const fetchOriginalValidChromosomeSequences = () => {
    fetch('/api/getChromosomeOriginalValidSequence', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cell_line: cellLineName, chromosome_name: chromosomeName })
    })
      .then(res => res.json())
      .then(data => {
        setTotalOriginalChromosomeValidSequences(data);
      });
  }

  const fetchGeneNameList = () => {
    fetch('/api/getGeneNameList')
      .then(res => res.json())
      .then(data => {
        setGeneNameList(data);
      });
  }

  const fetchCellLineList = () => {
    fetch('/api/getCellLines')
      .then(res => res.json())
      .then(data => {
        // Sort the data alphabetically by label
        const sortedData = data.sort((a, b) => {
          if (a.label && b.label) {
            return a.label.localeCompare(b.label);
          }
          return 0;
        });
        setCellLineList(sortedData);
      });
  };

  const fetchChromosomeList = (value) => {
    fetch('/api/getChromosomesList', {
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
    fetch("/api/getChromosomeSize", {
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
    fetch("/api/getChromosomeSizeByGeneName", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ gene_name: value })
    })
      .then(res => res.json())
      .then(data => {
        if (!data) {
          warning('noCoveredGene');
          return;
        }
        setGeneName(value);
        const chromosomeName = `chr${data.chromosome}`;
        fetchChromosomeSize(chromosomeName);
        setChromosomeName(chromosomeName);
        fetch('/api/getChromosomeOriginalValidSequence', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ cell_line: cellLineName, chromosome_name: chromosomeName })
        })
          .then(res => res.json())
          .then(totalSeqs => {
            setTotalOriginalChromosomeValidSequences(totalSeqs);
            const matchedSeq = totalSeqs.find(seq =>
              seq.start <= data.start_location && seq.end >= data.end_location
            );
            if (matchedSeq) {
              setSelectedChromosomeSequence({ start: matchedSeq.start, end: matchedSeq.end });
              setGeneSize({ start: data.start_location, end: data.end_location });
            } else {
              warning('noCoveredGene');
            }
          });
      })
  }

  const fetchChromosomeData = (sequence) => {
    if (!cellLineName || !chromosomeName) {
      warning('noData');
    } else {
      fetch("/api/getChromosData", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cell_line: cellLineName, chromosome_name: chromosomeName, sequences: sequence })
      })
        .then(res => res.json())
        .then(data => {
          setChromosomeData(data);
          setHeatmapLoading(false);
        });
    }
  };

  const fetchValidChromosomeValidIbpData = (sequence) => {
    fetch("/api/getChromosValidIBPData", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cell_line: cellLineName, chromosome_name: chromosomeName, sequences: sequence })
    })
      .then(res => res.json())
      .then(data => {
        setValidChromosomeValidIbpData(data);
      });
  }

  const fetchExampleChromos3DData = (cell_line, sample_id, sampleChange, componentId = null) => {
    if (cell_line && chromosomeName && selectedChromosomeSequence) {
      const isComparison = componentId !== null;
      const keyPrefix = isComparison ? `${cell_line}-COMPARISON` : chromosome3DCellLineName;

      const cacheKey = `${keyPrefix}-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}-${sample_id}`;

      const cachedData = isComparison ?
        chromosome3DComponents.find(c => c.id === componentId)?.data[cacheKey] :
        chromosome3DExampleData[cacheKey];

      if (!cachedData) {
        if (isComparison) {
          setChromosome3DComponents(prev => 
            prev.map(comp => 
              comp.id === componentId 
                ? { ...comp, loading: true }
                : comp
            )
          );
        } else {
          setChromosome3DLoading(true);
        }
      } else {
        return;
      }

      fetch("/api/getChromosome3DData", {
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
            setChromosome3DComponents(prev => 
              prev.map(comp => 
                comp.id === componentId 
                  ? { 
                      ...comp, 
                      data: {
                        ...comp.data,
                        [cacheKey]: data["position_data"],
                        [cacheKey + "_avg_matrix"]: data["avg_distance_data"],
                        [cacheKey + "_fq_data"]: data["fq_data"],
                        [cacheKey + "sample_distance_vector"]: data["sample_distance_vector"]
                      },
                      loading: false
                    }
                  : comp
              )
            );
          } else {
            setChromosome3DExampleData(prev => ({
              ...prev,
              [cacheKey]: data["position_data"],
              [cacheKey + "_avg_matrix"]: data["avg_distance_data"],
              [cacheKey + "_fq_data"]: data["fq_data"],
              [cacheKey + "sample_distance_vector"]: data["sample_distance_vector"]
            }));
            setChromosome3DLoading(false);
          }
        });
    }
  };

  const fetchGeneList = (sequence) => {
    if (chromosomeName && sequence) {
      let filteredChromosomeName = chromosomeName.slice(3);
      fetch("/api/getGeneList", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chromosome_name: filteredChromosomeName, sequences: sequence })
      })
        .then(res => res.json())
        .then(data => {
          setGeneList(data);
        });
    }
  };

  const fetchGeneNameBySearch = (value) => {
    fetch("/api/geneNamesListSearch", {
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
    if (type === 'overRegion') {
      messageApi.open({
        type: 'warning',
        content: 'Selected region is out of bounds',
        duration: 1.5,
      });
    }
    if (type === 'noCoveredGene') {
      messageApi.open({
        type: 'warning',
        content: 'No valid sequence found for the selected gene',
        duration: 1.5,
      });
    }
    if (type === 'invalidRange') {
      messageApi.open({
        type: 'warning',
        content: 'Please input the valid range',
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
    setStartInputValue(null);
    setEndInputValue(null);
    setStartSequencesOptions([]);
    setEndSequencesOptions([]);
    setChromosomeData([]);
    setChromosome3DExampleData({});
    setChromosome3DComponents([]);
    setDistributionData({});
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
    setStartInputValue(null);
    setEndInputValue(null);
    setStartSequencesOptions([]);
    setEndSequencesOptions([]);
    setGeneName(null);
    setChromosomeData([]);
    setChromosome3DExampleData({});
    setChromosome3DComponents([]);
    setDistributionData({});
    fetchChromosomeList(value);
  };

  const handleColorChange = (color) => {
    if (selectedIndex !== null) {
      const originalCoordinates = chromosome3DExampleData[
        `${cellLineName}-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}-${chromosome3DExampleID}`
      ];

      setSelectedSphereLists((prev) => {
        const updatedOriginal = {
          ...prev[cellLineName],
          [selectedIndex]: {
            ...(prev[cellLineName]?.[selectedIndex] || { position: originalCoordinates?.[selectedIndex] }),
            color: color.toHexString(),
          },
        };

        // Update all comparison components
        const updatedComponents = {};
        chromosome3DComponents.forEach((component) => {
          const comparisonCoordinates = component.data[
            `${component.cellLine}-COMPARISON-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}-${component.sampleID}`
          ];
          
          if (comparisonCoordinates) {
            updatedComponents[component.cellLine] = {
              ...prev[component.cellLine],
              [selectedIndex]: {
                ...(prev[component.cellLine]?.[selectedIndex] || { position: comparisonCoordinates?.[selectedIndex] }),
                color: color.toHexString(),
              },
            };
          }
        });

        return {
          ...prev,
          ...(cellLineName ? { [cellLineName]: updatedOriginal } : {}),
          ...updatedComponents,
        };
      });
    }
  };

  // Gene selection change
  const geneNameChange = value => {
    if (!cellLineName) {
      warning('noCellLine');
    } else {
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
    setChromosome3DComponents([]);
    // Clear distribution data when chromosome changes
    setDistributionData({});
    fetchChromosomeSize(value);
  };

  // Chromosome sequence change
  const onlyDigits = (text) => /^\d*$/.test(text);

  const isSequenceInValidRange = (start, end) => {
    if (start > end) return false;

    for (const seq of totalOriginalChromosomeValidSequences) {
      if (seq.start <= start && seq.end >= end) {
        return true;
      }
    }
    return false;
  };

  const onStartChange = (value) => {
    if (!onlyDigits(value)) return;
    setStartInputValue(value);
  };

  const onEndChange = (value) => {
    if (!onlyDigits(value)) return;
    setEndInputValue(value);
  };

  const onStartSearch = (text) => {
    if (!onlyDigits(text)) {
      return;
    }

    let cleanValue = text;
    if (text.length > 1 && text.startsWith('0')) {
      cleanValue = String(Number(text));
    }

    const num = cleanValue === '' ? 0 : Number(cleanValue);
    const currentEnd = endRef.current;

    let filtered;

    if (currentEnd > 0) {
      filtered = totalOriginalChromosomeValidSequences.filter(seq =>
        seq.end === currentEnd &&
        seq.start < currentEnd
      );
    } else {
      const greater = totalOriginalChromosomeValidSequences.filter(seq =>
        seq.start > num
      );

      const smallerCandidates = totalOriginalChromosomeValidSequences.filter(seq =>
        seq.start <= num
      );

      const closestSmaller = smallerCandidates.length > 0
        ? smallerCandidates.reduce((prev, curr) => (curr.start > prev.start ? curr : prev))
        : null;

      filtered = [...greater];
      if (closestSmaller) {
        const alreadyInList = filtered.some(seq => seq.start === closestSmaller.start);
        if (!alreadyInList) {
          filtered.unshift(closestSmaller);
        }
      }
    }

    setStartSequencesOptions(filtered.map(seq => ({ value: seq.start.toString() })));
  };

  const onEndSearch = (text) => {
    if (!onlyDigits(text)) {
      return;
    }

    let cleanValue = text;
    if (text.length > 1 && text.startsWith('0')) {
      cleanValue = String(Number(text));
    }

    const num = cleanValue === '' ? 0 : Number(cleanValue);
    const currentStart = startRef.current;

    let filtered;

    if (startRef.current > 0) {
      filtered = totalOriginalChromosomeValidSequences.filter(seq =>
        seq.start === currentStart &&
        seq.end > num
      );
    } else {
      filtered = totalOriginalChromosomeValidSequences.filter(seq =>
        seq.end > num
      );
    }

    setEndSequencesOptions(filtered.map(seq => ({ value: seq.end.toString() })));
  };

  const handleStartSelect = (value) => {
    const num = Number(value);
    startRef.current = num;
    setStartInputValue(num.toString());
    setSelectedChromosomeSequence(prev => ({ ...prev, start: num }));

    setChromosome3DComponents([]);
    setDistributionData({});
  }

  const handleEndSelect = (value) => {
    const num = Number(value);
    endRef.current = num;
    setEndInputValue(num.toString());
    setSelectedChromosomeSequence(prev => ({ ...prev, end: num }));

    setChromosome3DComponents([]);
    setDistributionData({});
  }

  const handleSubmitExceptions = () => {
    if (!isCellLineMode) {
      // In gene mode, use the selectedChromosomeSequence values
      if (!cellLineName || !chromosomeName) {
        warning('noData');
        return false;
      }
      if (!selectedChromosomeSequence.start || !selectedChromosomeSequence.end) {
        warning('invalidRange');
        return false;
      }

      startRef.current = selectedChromosomeSequence.start;
      endRef.current = selectedChromosomeSequence.end;
      setCurrentChromosomeSequence(selectedChromosomeSequence);
      return true;
    }

    const startNum = Number(startInputValue);
    const endNum = Number(endInputValue);

    if (!isExampleMode(cellLineName, chromosomeName, selectedChromosomeSequence)) {
      if (!startNum || !endNum) {
        warning('invalidRange');
        return false;
      }
      if (startNum >= endNum) {
        warning('smallend');
        return false;
      }
      if (!isSequenceInValidRange(startNum, endNum)) {
        warning('overRegion');
        return false;
      }
      if (!cellLineName || !chromosomeName) {
        warning('noData');
        return false;
      }
    }

    startRef.current = startNum;
    endRef.current = endNum;

    setSelectedChromosomeSequence({ start: startNum, end: endNum });
    setCurrentChromosomeSequence({ start: startNum, end: endNum });
    return true;
  };

  // Heatmap Add button click
  const addNewComparisonHeatmap = () => {
    setComparisonHeatmapList((prev) => [...prev, comparisonHeatmapIndex]);
    setComparisonHeatmapIndex((prev) => prev + 1);
  }

  const removeComparisonHeatmap = (index) => {
    setComparisonHeatmapList((prev) => prev.filter((i) => i !== index));
    setComparisonHeatmapCellLines((prev) => {
      const newCellLines = { ...prev };
      delete newCellLines[index];
      return newCellLines;
    });
    setComparisonHeatmapUpdateTrigger((prev) => {
      const newTriggers = { ...prev };
      delete newTriggers[index];
      return newTriggers;
    });
  };

  // Update comparison heatmap cell line selection
  const updateComparisonHeatmapCellLine = (index, cellLine) => {
    setComparisonHeatmapCellLines((prev) => ({
      ...prev,
      [index]: cellLine
    }));
  };

  // return to introduction page
  const returnIntroPage = () => {
    setCellLineName(null);
    setChromosomeName(null);
    setChromosomeSize({ start: 0, end: 0 });
    setSelectedChromosomeSequence({ start: 0, end: 0 });
    setChromosomeData([]);
    setChromosome3DExampleData({});
    setChromosome3DComponents([]);
    setChromosome3DComponentIndex(1);
    setChromosome3DExampleID(0);
    setChromosome3DLoading(false);
    setHeatmapLoading(false);
    setGeneName(null);
    setGeneSize({ start: 0, end: 0 });
    setGeneList([]);
    setDistributionData({});
  }

  const downloadItems = [
    {
      key: '1',
      label: 'Distance data',
    },
    {
      key: '2',
      label: 'Position data'
    },
  ]

  const onClickExampleDataItem = ({ key }) => {
    setCellLineName(key);
    setChromosomeName('chr8');
    setSelectedChromosomeSequence({ start: 127300000, end: 128300000 });
    setStartInputValue('127300000');
    setEndInputValue('128300000');
    setHeatmapLoading(true);
    setDistributionData({});
  }

  const onClickOriginalDownloadItems = ({ key }) => {
    if (!isExampleMode(cellLineName, chromosomeName, selectedChromosomeSequence)) {
      if (key === '1') {
        downloadDistance(null, false);
      }
      if (key === '2') {
        downloadPositionData(null, false);
      }
    } else {
      if (key === '1') {
        downloadDistance(null, true);
      }
      if (key === '2') {
        downloadPositionData(null, true);
      }
    }
  }

  const onClickComponentDownloadItems = (componentId) => ({ key }) => {
    if (key === '1') {
      downloadDistance(componentId);
    }
    if (key === '2') {
      downloadPositionData(componentId);
    }
  }

  // Download 5000 samples of beads' distance data
  const downloadDistance = async (componentId, isExample = false) => {
    const isOriginal = componentId === null;
    let targetCellLine;
    
    if (!isOriginal) {
      // Update specific component's download spinner
      setChromosome3DComponents(prev => 
        prev.map(comp => 
          comp.id === componentId 
            ? { ...comp, downloadSpinner: true }
            : comp
        )
      );
      targetCellLine = chromosome3DComponents.find(c => c.id === componentId)?.cellLine;
    } else {
      setOriginalChromosomeDownloadSpinner(true);
      targetCellLine = chromosome3DCellLineName;
    }

    try {
      const response = await fetch("/api/downloadFullChromosome3DDistanceData", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cell_line: targetCellLine,
          chromosome_name: chromosomeName,
          sequences: selectedChromosomeSequence,
          is_example: isExample
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch file");

      const reader = response.body.getReader();
      const stream = new ReadableStream({
        start(controller) {
          function push() {
            reader.read().then(({ done, value }) => {
              if (done) {
                controller.close();
                return;
              }
              controller.enqueue(value);
              push();
            });
          }
          push();
        },
      });

      const blob = await new Response(stream).blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `${targetCellLine}_${chromosomeName}_${selectedChromosomeSequence.start}_${selectedChromosomeSequence.end}.npz`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
    } finally {
      if (!isOriginal) {
        setChromosome3DComponents(prev => 
          prev.map(comp => 
            comp.id === componentId 
              ? { ...comp, downloadSpinner: false }
              : comp
          )
        );
      } else {
        setOriginalChromosomeDownloadSpinner(false);
      }
    }
  };

  // Download 5000 samples of beads' position data (.csv)
  const downloadPositionData = async (componentId, isExample = false) => {
    const isOriginal = componentId === null;
    let targetCellLine;
    
    if (!isOriginal) {
      setChromosome3DComponents(prev => 
        prev.map(comp => 
          comp.id === componentId 
            ? { ...comp, downloadSpinner: true }
            : comp
        )
      );
      targetCellLine = chromosome3DComponents.find(c => c.id === componentId)?.cellLine;
    } else {
      setOriginalChromosomeDownloadSpinner(true);
      targetCellLine = chromosome3DCellLineName;
    }

    try {
      const response = await fetch("/api/downloadFullChromosome3DPositionData", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cell_line: targetCellLine,
          chromosome_name: chromosomeName,
          sequences: selectedChromosomeSequence,
          is_example: isExample
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch file");

      const reader = response.body.getReader();
      const stream = new ReadableStream({
        start(controller) {
          function push() {
            reader.read().then(({ done, value }) => {
              if (done) {
                controller.close();
                return;
              }
              controller.enqueue(value);
              push();
            });
          }
          push();
        },
      });

      const blob = await new Response(stream).blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `${targetCellLine}_${chromosomeName}_${selectedChromosomeSequence.start}_${selectedChromosomeSequence.end}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
    } finally {
      if (!isOriginal) {
        setChromosome3DComponents(prev => 
          prev.map(comp => 
            comp.id === componentId 
              ? { ...comp, downloadSpinner: false }
              : comp
          )
        );
      } else {
        setOriginalChromosomeDownloadSpinner(false);
      }
    }
  }

  // add custom sample id by users and fetch data
  const addCustomKey = () => {
    setSampleKeys((prev) => [...prev, tempSampleId]);
    setChromosome3DExampleID(tempSampleId);
    const cacheKey = `${chromosome3DCellLineName}-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}-${tempSampleId}`;
    if (!chromosome3DExampleData[cacheKey]) {
      if (!isExampleMode(cellLineName, chromosomeName, selectedChromosomeSequence)) {
        fetchExampleChromos3DData(chromosome3DCellLineName, tempSampleId, "sampleChange", null);
        progressPolling(chromosome3DCellLineName, chromosomeName, selectedChromosomeSequence, tempSampleId, false);
      } else {
        fetchExistChromos3DData(false, tempSampleId, chromosome3DCellLineName, null);
        // No progress polling needed for fetchExistChromos3DData since it returns immediately
      }
    }
  }

  // 3D Original Chromosome sample change
  const originalSampleChange = (key) => {
    setChromosome3DExampleID(key);
    setDistributionData({});
    const cacheKey = `${chromosome3DCellLineName}-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}-${key}`;
    if (!chromosome3DExampleData[cacheKey]) {
      if (!isExampleMode(chromosome3DCellLineName, chromosomeName, selectedChromosomeSequence)) {
        fetchExampleChromos3DData(chromosome3DCellLineName, key, "sampleChange", null);
        progressPolling(chromosome3DCellLineName, chromosomeName, selectedChromosomeSequence, key, false);
      } else {
        fetchExistChromos3DData(false, key, chromosome3DCellLineName, null);
        // No progress polling needed for fetchExistChromos3DData since it returns immediately
      }
    };
  };

  // 3D Comparison Chromosome sample change
  const componentSampleChange = (componentId) => (key) => {
    setChromosome3DComponents(prev => 
      prev.map(comp => 
        comp.id === componentId 
          ? { ...comp, sampleID: key }
          : comp
      )
    );
    setDistributionData({});
    
    const component = chromosome3DComponents.find(c => c.id === componentId);
    if (component) {
      const cacheKey = `${component.cellLine}-COMPARISON-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}-${key}`;
      if (!component.data[cacheKey]) {
        if (!isExampleMode(component.cellLine, chromosomeName, selectedChromosomeSequence)) {
          fetchExampleChromos3DData(component.cellLine, key, "sampleChange", componentId);
          // Note: progressPolling function may need to be updated to handle componentId
        } else {
          fetchExistChromos3DData(false, key, component.cellLine, componentId);
        }
      }
    }
  };

  // Add 3D Chromosome Component
  const handleAddChromosome3D = () => {
    const newComponent = {
      id: chromosome3DComponentIndex,
      cellLine: cellLineList[0]?.value || null, // Default to first cell line
      sampleID: 0,
      data: {},
      loading: false,
      downloadSpinner: false
    };
    
    setChromosome3DComponents(prev => [...prev, newComponent]);
    setChromosome3DComponentIndex(prev => prev + 1);
  };

  // Remove 3D Chromosome Component
  const handleRemoveChromosome3D = (componentId) => {
    setChromosome3DComponents(prev => prev.filter(comp => comp.id !== componentId));
    setDistributionData(prev => {
      const newData = { ...prev };
      // Remove data for the removed component
      chromosome3DComponents.forEach(comp => {
        if (comp.id === componentId) {
          delete newData[comp.cellLine];
        }
      });
      return newData;
    });
  };

  // Update Cell Line for a specific component
  const updateComponentCellLine = (componentId, cellLine) => {
    setChromosome3DComponents(prev => 
      prev.map(comp => 
        comp.id === componentId 
          ? { ...comp, cellLine, loading: true }
          : comp
      )
    );
    
    // Fetch data for the new cell line
    const component = chromosome3DComponents.find(c => c.id === componentId);
    if (component) {
      fetchExistChromos3DData(false, component.sampleID, cellLine, componentId);
      if (isExampleMode(cellLine, chromosomeName, currentChromosomeSequence)) {
        const key = exampleDataBestSampleID[cellLine];
        fetchExistChromos3DData(false, key, cellLine, componentId);
      }
    }
  };

  // Update Sample ID for a specific component
  const updateComponentSampleID = (componentId, sampleID) => {
    setChromosome3DComponents(prev => 
      prev.map(comp => 
        comp.id === componentId 
          ? { ...comp, sampleID }
          : comp
      )
    );
  };

  // Submit button click
  const submit = () => {
    if (!handleSubmitExceptions()) return;

    setHeatmapLoading(true);

    setChromosome3DComponents([]);
    setChromosome3DComponentIndex(1);
    setChromosome3DExampleID(0);
    setChromosome3DExampleData({});

    const newSequence = { start: startRef.current, end: endRef.current };

    if (!isExampleMode(cellLineName, chromosomeName, newSequence)) {
      setCurrentChromosomeSequence(newSequence);
    }

    fetchChromosomeData(newSequence);
    fetchValidChromosomeValidIbpData(newSequence);
    fetchGeneList(newSequence);

    // Trigger updates for all existing comparison heatmaps
    if (comparisonHeatmapList.length > 0) {
      const updateTriggers = {};
      comparisonHeatmapList.forEach(index => {
        updateTriggers[index] = Date.now(); // Use timestamp as trigger value
      });
      setComparisonHeatmapUpdateTrigger(updateTriggers);
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
          <Title
            level={5}
            style={{ color: '#1890ff', textAlign: 'center', margin: "0px 0px 0px 10px", zIndex: 10, cursor: 'pointer' }}
            onClick={returnIntroPage}
          >
            <ExperimentOutlined /> ChromPolymerDB
          </Title>
          <div
            className="switchWrapper"
            style={{ display: 'flex', alignItems: 'center', gap: '5px', zIndex: 10, marginLeft: '10px' }}
          >
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
              title={<span style={{ color: 'black' }}>Toggle to switch between Cell Line and Gene fields.</span>}
              color='white'
            >
              <InfoCircleOutlined
                id="info-tooltip"
                style={{ fontSize: '16px', color: '#999', cursor: 'pointer' }}
              />
            </Tooltip>
          </div>

          <Dropdown menu={{ items: exampleDataItems, onClick: onClickExampleDataItem }} placement="bottom" arrow >
            <Button className='exampleData' size='small' type='primary' variant="outlined" icon={<FolderViewOutlined />} iconPosition="end" style={{ marginLeft: 10, zIndex: 10 }} />
          </Dropdown>

          {isCellLineMode ? (
            <div className="inputGroup">
              <div className="inputGroupContentinLargeScreen">
                <span className="controlGroupText">Cell Line:</span>
                <Select
                  value={cellLineName}
                  size="small"
                  style={{
                    width: "18%"
                  }}
                  onChange={cellLineChange}
                  options={cellLineList}
                  optionRender={(option) => (
                    <Tooltip title={<span style={{ color: 'black' }}>{option.label}</span>} color='white' placement="right">
                      <div>{option.label}</div>
                    </Tooltip>
                  )}
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
                <AutoComplete
                  size="small"
                  options={startSequencesOptions}
                  style={{ width: "8%" }}
                  placeholder="Start"
                  onChange={onStartChange}
                  onSearch={onStartSearch}
                  onSelect={handleStartSelect}
                  onFocus={() => {
                    if (endRef.current > 0) {
                      onStartSearch(startRef.current.toString());
                    }
                  }}
                  value={startInputValue}
                />
                <span className="controlGroupText">~</span>
                <AutoComplete
                  size="small"
                  options={endSequencesOptions}
                  style={{ width: "8%" }}
                  placeholder="End"
                  onChange={onEndChange}
                  onSearch={onEndSearch}
                  onSelect={handleEndSelect}
                  onFocus={() => {
                    if (startRef.current > 0) {
                      onEndSearch(endRef.current.toString());
                    }
                  }}
                  value={endInputValue}
                />
                <Tooltip
                  title={<span style={{ color: 'black' }}>Add a new heatmap</span>}
                  color='white'
                >
                  <Button id="add-new-heatmap-button" disabled={!chromosomeData.length} size="small" icon={<PlusOutlined />} onClick={addNewComparisonHeatmap} />
                </Tooltip>
                <Tooltip
                  title={<span style={{ color: 'black' }}>View non-random chromosomal interactions as heatmap</span>}
                  color='white'
                >
                  <Button id="submit-button" size="small" color="primary" variant="outlined" onClick={submit}>Show Heatmap</Button>
                </Tooltip>
              </div>
            </div>
          ) : (
            <div className="inputGroup">
              <div className="inputGroupContentinLargeScreen">
                <span className="controlGroupText">Cell Line:</span>
                <Select
                  value={cellLineName}
                  size="small"
                  style={{
                    width: "18%"
                  }}
                  onChange={cellLineChange}
                  options={cellLineList}
                  optionRender={(option) => (
                    <Tooltip title={<span style={{ color: 'black' }}>{option.label}</span>} color='white' placement="right">
                      <div>{option.label}</div>
                    </Tooltip>
                  )}
                />
                <span className="controlGroupText">Gene:</span>
                <Select
                  showSearch
                  value={geneName}
                  size="small"
                  style={{
                    width: "10%"
                  }}
                  onChange={geneNameChange}
                  onSearch={geneNameSearch}
                  options={geneNameList}
                />
                <Tooltip
                  title={<span style={{ color: 'black' }}>Add a new heatmap</span>}
                  color='white'
                >
                  <Button id="add-new-heatmap-button" disabled={chromosomeData.length === 0} size="small" icon={<PlusOutlined />} onClick={addNewComparisonHeatmap} />
                </Tooltip>
                <Tooltip
                  title={<span style={{ color: 'black' }}>View non-random chromosomal interactions as heatmap</span>}
                  color='white'
                >
                  <Button id="submit-button" size="small" color="primary" variant="outlined" onClick={submit}>Show Heatmap</Button>
                </Tooltip>
              </div>
            </div>
          )}

          <div className="chromosomeBarColorLegend">
            <div className='chromosomeBarColorLegendItem' style={{ marginBottom: '5px' }}>
              <div className="chromosomeBarColorRect" style={{ backgroundColor: "#4daf4a" }}></div>
              <span>Available regions</span>
            </div>
            <div className='chromosomeBarColorLegendItem' style={{ marginBottom: '5px' }}>
              <div className="chromosomeBarColorRect" style={{ backgroundColor: "#FFC107" }}></div>
              <span>Selected region</span>
            </div>
            <div className='chromosomeBarColorLegendItem'>
              <div className="chromosomeBarColorRect" style={{ backgroundColor: "#FFFFFF" }}></div>
              <span>Unavailable regions</span>
            </div>
          </div>
        </div>
        <ChromosomeBar
          warning={warning}
          formatNumber={formatNumber}
          startRef={startRef}
          endRef={endRef}
          selectedChromosomeSequence={selectedChromosomeSequence}
          setSelectedChromosomeSequence={setSelectedChromosomeSequence}
          setStartInputValue={setStartInputValue}
          setEndInputValue={setEndInputValue}
          chromosomeSize={chromosomeSize}
          totalChromosomeSequences={totalChromosomeSequences}
          totalOriginalChromosomeValidSequences={totalOriginalChromosomeValidSequences}
        />
      </div>

      {/* main content part */}
      <div className="content">
        {/* project introduction */}
        {!heatmapLoading &&
          chromosomeData.length === 0 &&
          Object.keys(chromosome3DExampleData).length === 0 && (
            <div style={{ width: '100%', height: '100%', overflowY: 'scroll' }}>
              <ProjectIntroduction
                exampleDataItems={exampleDataItems}
                setCellLineName={setCellLineName}
                setChromosomeName={setChromosomeName}
                setSelectedChromosomeSequence={setSelectedChromosomeSequence}
                setStartInputValue={setStartInputValue}
                setEndInputValue={setEndInputValue}
              />
            </div>
          )}

        {(heatmapLoading || !(chromosomeData.length === 0 && Object.keys(chromosome3DExampleData).length === 0)) && (
          <>
            {/* Original Heatmap */}
            {(heatmapLoading || chromosomeData.length === 0) ? (
              <Spin spinning={true} size="large" style={{ width: '40vw', height: '100%', borderRight: "1px solid #eaeaea", margin: 0 }} />
            ) : (
              chromosomeData.length > 0 && (
                <Heatmap
                  comparisonHeatmapId={null}
                  warning={warning}
                  formatNumber={formatNumber}
                  setChromosome3DExampleData={setChromosome3DExampleData}
                  cellLineList={cellLineList}
                  geneList={geneList}
                  cellLineName={cellLineName}
                  chromosomeName={chromosomeName}
                  chromosomeData={chromosomeData}
                  exampleDataBestSampleID={exampleDataBestSampleID}
                  isExampleMode={isExampleMode}
                  progressPolling={progressPolling}
                  fetchExistChromos3DData={fetchExistChromos3DData}
                  currentChromosomeSequence={currentChromosomeSequence}
                  setCurrentChromosomeSequence={setCurrentChromosomeSequence}
                  geneSize={geneSize}
                  totalChromosomeSequences={totalChromosomeSequences}
                  selectedChromosomeSequence={selectedChromosomeSequence}
                  setChromosome3DExampleID={setChromosome3DExampleID}
                  geneName={geneName}
                  setSelectedChromosomeSequence={setSelectedChromosomeSequence}
                  setChromosome3DLoading={setChromosome3DLoading}
                  setComparisonCellLine3DData={() => {}} // Legacy compatibility - no longer used
                  setComparisonCellLine3DLoading={() => {}} // Legacy compatibility - no longer used
                  setGeneName={setGeneName}
                  setGeneSize={setGeneSize}
                  setSelectedSphereLists={setSelectedSphereLists}
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
                warning={warning}
                formatNumber={formatNumber}
                setChromosome3DExampleData={setChromosome3DExampleData}
                cellLineList={cellLineList}
                geneList={geneList}
                cellLineName={cellLineName}
                chromosomeName={chromosomeName}
                chromosomeData={[]}
                exampleDataBestSampleID={exampleDataBestSampleID}
                isExampleMode={isExampleMode}
                progressPolling={progressPolling}
                fetchExistChromos3DData={fetchExistChromos3DData}
                currentChromosomeSequence={currentChromosomeSequence}
                setCurrentChromosomeSequence={setCurrentChromosomeSequence}
                setChromosomeData={setChromosomeData}
                geneSize={geneSize}
                totalChromosomeSequences={totalChromosomeSequences}
                selectedChromosomeSequence={selectedChromosomeSequence}
                setChromosome3DExampleID={setChromosome3DExampleID}
                geneName={geneName}
                setSelectedChromosomeSequence={setSelectedChromosomeSequence}
                setChromosome3DLoading={setChromosome3DLoading}
                setComparisonCellLine3DData={() => {}} // Legacy compatibility - no longer used
                setComparisonCellLine3DLoading={() => {}} // Legacy compatibility - no longer used
                setGeneName={setGeneName}
                setGeneSize={setGeneSize}
                setSelectedSphereLists={setSelectedSphereLists}
                removeComparisonHeatmap={removeComparisonHeatmap}
                setChromosome3DCellLineName={setChromosome3DCellLineName}
                updateComparisonHeatmapCellLine={updateComparisonHeatmapCellLine}
                comparisonHeatmapUpdateTrigger={comparisonHeatmapUpdateTrigger[index]}
              />
            ))}

            {/* Multiple 3D chromosome components */}
            {(Object.keys(chromosome3DExampleData).length > 0 || chromosome3DLoading || chromosome3DComponents.length > 0) && (
              <div style={{ 
                height: '100%', 
                width: 'calc(100% - 40vw)', 
                flexShrink: 0,
                overflowX: 'auto',
                display: 'flex'
              }}>
                {/* Original 3D chromosome */}
                <div style={{ 
                  width: chromosome3DComponents.length > 0 ? "49.9%" : "100%", 
                  marginRight: chromosome3DComponents.length > 0 ? '0.2%' : '0%', 
                  flexShrink: 0,
                  minWidth: chromosome3DComponents.length > 0 ? "49.9%" : "auto"
                }}>
                  <Tabs
                    size="small"
                    activeKey={chromosome3DExampleID}
                    defaultActiveKey={chromosome3DExampleID}
                    style={{ width: '100%', height: '100%' }}
                    onChange={originalSampleChange}
                    tabBarExtraContent={
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <div style={{ fontSize: 11, fontWeight: 'bold', marginRight: 5, display: 'flex', alignItems: 'center' }}>
                          <span style={{ lineHeight: 'normal' }}>{chromosome3DCellLineName}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', marginRight: 5 }}>
                          <Tooltip
                            title={<span style={{ color: 'black' }}>Add a new sample ID</span>}
                            color='white'
                          >
                            <InputNumber style={{ width: 120 }} size='small' min={1} max={5000} addonAfter={<PlusOutlined onClick={addCustomKey} />} value={tempSampleId} onChange={setTempSampleId} />
                          </Tooltip>
                        </div>
                        <Tooltip
                          title={
                            <span style={{ color: 'black' }}>
                              Download <span style={{ color: '#3457D5', fontWeight: 'bold' }}>5000</span> chromosomal bead distance matrix (.npz).<br />
                              <span style={{ color: '#3457D5', fontWeight: 'bold' }}>Note:</span> It may take
                              <span style={{ color: '#dd1c77', fontWeight: 'bold' }}> 10 minutes </span> to download the data.
                            </span>
                          }
                          color='white'
                        >
                          <Dropdown menu={{ items: downloadItems, onClick: onClickOriginalDownloadItems }} placement="bottomRight" arrow>
                            <Button
                              style={{
                                fontSize: 15,
                                cursor: "pointer",
                                marginRight: 5,
                              }}
                              disabled={Object.keys(chromosome3DExampleData).length === 0 || chromosome3DLoading}
                              size="small"
                              icon={originalChromosomeDistanceDownloadSpinner ? <SyncOutlined spin /> : <DownloadOutlined />}
                            />
                          </Dropdown>
                        </Tooltip>
                        <Tooltip
                          title={<span style={{ color: 'black' }}>Add a cell line to compare</span>}
                          color='white'
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
                    items={sampleKeys.map((sampleId, i) => {
                      const cacheKey = `${chromosome3DCellLineName}-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}-${sampleId}`;
                      const label = sampleId === 0
                        ? (
                          <Tooltip
                            title={
                              <span style={{ color: 'black' }}>
                                Most representative single-cell structure (<span style={{ color: '#3457D5', fontWeight: 'bold' }}>highest correlation</span> with average)
                              </span>
                            }
                            color='white'
                          >
                            <span>Sample {sampleId} (Ens.Rep.)</span>
                          </Tooltip>
                        )
                        : `Sample ${sampleId}`;
                      return {
                        label: label,
                        key: sampleId,
                        disabled: chromosome3DLoading,
                        children: (
                          chromosome3DLoading ? (
                            <Spin size="large" style={{ margin: '20px 0' }} percent={ChromosomeDataSpinnerProgress} />
                          ) : (
                            <Chromosome3D
                              formatNumber={formatNumber}
                              celllineName={chromosome3DCellLineName}
                              chromosomeName={chromosomeName}
                              currentChromosomeSequence={currentChromosomeSequence}
                              geneSize={geneSize}
                              chromosomeData={chromosomeData}
                              chromosome3DExampleData={chromosome3DExampleData[cacheKey] || []}
                              chromosome3DAvgMatrixData={chromosome3DExampleData[cacheKey + "_avg_matrix"]}
                              chromosomefqData={chromosome3DExampleData[cacheKey + "_fq_data"]}
                              chromosomeCurrentSampleDistanceVector={chromosome3DExampleData[cacheKey + "sample_distance_vector"]}
                              validChromosomeValidIbpData={validChromosomeValidIbpData}
                              selectedChromosomeSequence={selectedChromosomeSequence}
                              selectedIndex={selectedIndex}
                              setSelectedIndex={setSelectedIndex}
                              selectedSphereList={selectedSphereLists}
                              setSelectedSphereList={setSelectedSphereLists}
                              handleColorChange={handleColorChange}
                              distributionData={distributionData}
                              setDistributionData={setDistributionData}
                              isExampleMode={isExampleMode}
                            />
                          )
                        )
                      };
                    })}
                  />
                </div>

                {/* Comparison 3D chromosome */}
                                {/* Multiple comparison 3D chromosomes */}
                {chromosome3DComponents.map((component) => (
                  <div key={component.id} style={{ 
                    width: "49.9%", 
                    marginRight: '0.2%', 
                    flexShrink: 0,
                    minWidth: "49.9%"
                  }}>
                    <Tabs
                      size="small"
                      activeKey={component.sampleID}
                      defaultActiveKey={component.sampleID}
                      style={{ width: '100%', height: '100%' }}
                      onChange={componentSampleChange(component.id)}
                      tabBarExtraContent={
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginRight: '5px' }}>
                          <Select
                            value={component.cellLine}
                            style={{
                              minWidth: 150,
                              maxWidth: 150,
                              marginRight: 5,
                            }}
                            size="small"
                            onChange={(value) => updateComponentCellLine(component.id, value)}
                            options={cellLineList}
                            optionRender={(option) => (
                              <Tooltip title={<span style={{ color: 'black' }}>{option.label}</span>} color='white' placement="right">
                                <div>{option.label}</div>
                              </Tooltip>
                            )}
                          />
                          <Tooltip
                            title={
                              <span style={{ color: 'black' }}>
                                Download <span style={{ color: '#3457D5', fontWeight: 'bold' }}>5000</span> chromosomal bead distance matrix (.npz).<br />
                                <span style={{ color: '#3457D5', fontWeight: 'bold' }}>Note:</span> It may take
                                <span style={{ color: '#dd1c77', fontWeight: 'bold' }}> 10 minutes </span> to download the data.
                              </span>
                            }
                            color='white'
                          >
                            <Dropdown menu={{ items: downloadItems, onClick: onClickComponentDownloadItems(component.id) }} placement="bottomRight" arrow>
                              <Button
                                style={{
                                  fontSize: 15,
                                  cursor: "pointer",
                                  marginRight: 5,
                                }}
                                disabled={Object.keys(component.data).length === 0}
                                size="small"
                                icon={component.downloadSpinner ? <SyncOutlined spin /> : <DownloadOutlined />}
                              />
                            </Dropdown>
                          </Tooltip>
                          <Tooltip
                            title={<span style={{ color: 'black' }}>Remove this cell line</span>}
                            color='white'
                          >
                            <Button
                              style={{
                                fontSize: 15,
                                cursor: 'pointer',
                              }}
                              size="small"
                              icon={<MinusOutlined />}
                              onClick={() => handleRemoveChromosome3D(component.id)}
                            />
                          </Tooltip>
                        </div>
                      }

                      items={sampleKeys.map((sampleId, i) => {
                        const cacheKey = `${component.cellLine}-COMPARISON-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}-${sampleId}`;
                        const label = sampleId === 0
                          ? (
                            <Tooltip
                              title={
                                <span style={{ color: 'black' }}>
                                  Most representative single-cell structure (<span style={{ color: '#3457D5', fontWeight: 'bold' }}>highest correlation</span> with average)
                                </span>
                              }
                              color='white'
                            >
                              <span>Sample {sampleId} (Ens.Rep.)</span>
                            </Tooltip>
                          )
                          : `Sample ${sampleId}`;
                        return {
                          label: label,
                          key: sampleId,
                          children: (
                            component.loading ? (
                              <Spin size="large" style={{ margin: '20px 0' }} percent={ChromosomeDataSpinnerProgress} />
                            ) : (
                              <Chromosome3D
                                formatNumber={formatNumber}
                                celllineName={component.cellLine}
                                chromosomeName={chromosomeName}
                                currentChromosomeSequence={currentChromosomeSequence}
                                geneSize={geneSize}
                                chromosomeData={chromosomeData}
                                chromosome3DExampleData={component.data[cacheKey] || []}
                                chromosome3DAvgMatrixData={component.data[cacheKey + "_avg_matrix"]}
                                chromosomefqData={component.data[cacheKey + "_fq_data"]}
                                chromosomeCurrentSampleDistanceVector={component.data[cacheKey + "sample_distance_vector"]}
                                validChromosomeValidIbpData={validChromosomeValidIbpData}
                                selectedChromosomeSequence={selectedChromosomeSequence}
                                selectedIndex={selectedIndex}
                                setSelectedIndex={setSelectedIndex}
                                selectedSphereList={selectedSphereLists}
                                setSelectedSphereList={setSelectedSphereLists}
                                handleColorChange={handleColorChange}
                                distributionData={distributionData}
                                setDistributionData={setDistributionData}
                                isExampleMode={isExampleMode}
                              />
                            )
                          )
                        };
                      })}
                    />
                  </div>
                ))}
              </div>
            )
            }
          </>
        )}
      </div>
    </div>
  );
}

export default App;
