import React, { useState, useEffect, useRef } from 'react';
import { Select, Button, message, Spin, Tabs, Switch, Tooltip, Tour, Typography, Dropdown, InputNumber, AutoComplete } from 'antd';
import './App.css';
import { Heatmap } from './canvasHeatmap.js';
import { ChromosomeBar } from './chromosomeBar.js';
import { Chromosome3D } from './Chromosome3D.js';
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
  const [cellLineDict, setCellLineDict] = useState({});
  const [originalChromosomeDistanceDownloadSpinner, setOriginalChromosomeDownloadSpinner] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [selectedSphereLists, setSelectedSphereLists] = useState({});
  const [distributionData, setDistributionData] = useState({});
  const [tempSampleId, setTempSampleId] = useState(null);
  const [exampleDataItems, setExampleDataItems] = useState([
    {
      key: 'GM',
      label: 'GM12878-Chr8-127300000-128300000',
    },
    {
      key: 'IMR',
      label: 'IMR90-Chr8-127300000-128300000',
    },
    {
      key: 'K',
      label: 'K562-Chr8-127300000-128300000',
    }
  ])
  const [sampleKeys, setSampleKeys] = useState([0, 1000, 2000]);
  const [exampleDataBestSampleID, setExampleDataBestSampleID] = useState({ "GM": 2166, "IMR": 1223, "K": 865 }); // Example data best sample ID
  const [ChromosomeDataSpinnerProgress, setChromosomeDataSpinnerProgress] = useState(0);

  // Heatmap Comparison settings
  const [comparisonHeatmapList, setComparisonHeatmapList] = useState([]); // List of comparison heatmaps
  const [comparisonHeatmapIndex, setComparisonHeatmapIndex] = useState(1); // Index of comparison heatmap

  // 3D Chromosome Comparison settings
  const [chromosome3DComparisonShowing, setChromosome3DComparisonShowing] = useState(false);
  const [comparisonCellLine, setComparisonCellLine] = useState(null);
  const [comparisonCellLine3DData, setComparisonCellLine3DData] = useState({});
  const [comparisonCellLine3DSampleID, setComparisonCellLine3DSampleID] = useState(0);
  const [comparisonCellLine3DLoading, setComparisonCellLine3DLoading] = useState(false);
  const [comparisonChromosomeDistanceDownloadSpinner, setComparisonChromosomeDownloadSpinner] = useState(false);

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
    const validCellLines = ['IMR', 'GM', 'K'];
    const isMainCellLineOK = validCellLines.includes(cellLineName);
    const isChromosomeOK = chromosomeName === 'chr8';
    const isSequenceOK = selectedChromosomeSequence.start === 127300000 && selectedChromosomeSequence.end === 128300000;

    return isMainCellLineOK && isChromosomeOK && isSequenceOK;
  }

  useEffect(() => {
    fetch('/cellLineDict.json')
      .then(res => res.json())
      .then(data => {
        setCellLineDict(data);
      })
  }, []);

  // Effect that triggers after selectedChromosomeSequence changes
  useEffect(() => {
    if (isExampleMode(cellLineName, chromosomeName, selectedChromosomeSequence)) {
      setCurrentChromosomeSequence(selectedChromosomeSequence);
      // Call dependent logic after selectedChromosomeSequence has been updated
      fetchChromosomeList(cellLineName);
      fetchChromosomeSize(chromosomeName);

      // Automatically trigger the submit function
      submit();
      setChromosome3DCellLineName(cellLineName)
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
            return;
          }

          const delay = first ? 100 : 1000;
          first = false;

          setTimeout(fetchProgress, delay);
        })
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

  // update comparison part when comparisonCellLine3DSampleID changes
  useEffect(() => {
    const comparisonCacheKey = `${comparisonCellLine}-COMPARISON-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}-${comparisonCellLine3DSampleID}`;

    if (!comparisonCellLine3DData[comparisonCacheKey]) return;

    const selectedBeads = Object.keys(selectedSphereLists[cellLineName] || {});
    if (selectedBeads.length > 0) {
      selectedBeads.forEach((index) => {
        setSelectedSphereLists((prev) => ({
          ...prev,
          [comparisonCellLine]: {
            ...(prev[comparisonCellLine] || {}),
            [index]: {
              position: comparisonCellLine3DData[comparisonCacheKey][index],
              color: prev[cellLineName][index].color,
            },
          },
        }));
      });
    }
  }, [comparisonCellLine3DSampleID, comparisonCellLine3DData]);

  const fetchExistChromos3DData = (isBest, value, cellLineName, isComparison) => {
    const sampleID = isBest ? 0 : value;
    const keyPrefix = isComparison ? `${cellLineName}-COMPARISON` : cellLineName;
    const cacheKey = `${keyPrefix}-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}-${sampleID}`;

    const cachedData = isComparison ?
      comparisonCellLine3DData[cacheKey] :
      chromosome3DExampleData[cacheKey];

    if (!cachedData) {
      if (isComparison) {
        setComparisonCellLine3DLoading(true);
      } else {
        setChromosome3DLoading(true);
      }
    }

    fetch('/api/getExistingChromos3DData', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cell_line: cellLineName, sample_id: value })
    })
      .then(res => res.json())
      .then(data => {
        if (isComparison) {
          setComparisonCellLine3DData(prev => ({
            ...prev,
            [cacheKey]: data["position_data"],
            [cacheKey + "_avg_matrix"]: data["avg_distance_data"],
            [cacheKey + "_fq_data"]: data["fq_data"],
            [cacheKey + "sample_distance_vector"]: data["sample_distance_vector"]
          }));
          setComparisonCellLine3DLoading(false);
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
    fetch('/api/getChromosOriginalValidSequence', {
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
        setCellLineList(data);
      });
  };

  const fetchChromosomeList = (value) => {
    fetch('/api/getChromosList', {
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
    fetch("/api/getChromosSize", {
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
    fetch("/api/getChromosSizeByGeneName", {
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
        fetch('/api/getChromosOriginalValidSequence', {
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

  const fetchChromosomeData = () => {
    if (!cellLineName || !chromosomeName) {
      warning('noData');
    } else {
      fetch("/api/getChromosData", {
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
    fetch("/api/getChromosValidIBPData", {
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
      const keyPrefix = isComparison ? `${cell_line}-COMPARISON` : chromosome3DCellLineName;

      const cacheKey = `${keyPrefix}-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}-${sample_id}`;

      const cachedData = isComparison ?
        comparisonCellLine3DData[cacheKey] :
        chromosome3DExampleData[cacheKey];

      if (!cachedData) {
        if (isComparison) {
          setComparisonCellLine3DLoading(true);
        } else {
          setChromosome3DLoading(true);
        }
      } else {
        return;
      }

      fetch("/api/getExampleChromos3DData", {
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
              [cacheKey]: data["position_data"],
              [cacheKey + "_avg_matrix"]: data["avg_distance_data"],
              [cacheKey + "_fq_data"]: data["fq_data"],
              [cacheKey + "sample_distance_vector"]: data["sample_distance_vector"]
            }));
            setComparisonCellLine3DLoading(false);
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

  const fetchGeneList = () => {
    if (chromosomeName && selectedChromosomeSequence) {
      let filteredChromosomeName = chromosomeName.slice(3);
      fetch("/api/getGeneList", {
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
    fetch("/api/geneListSearch", {
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
    setComparisonCellLine3DData({});
    fetchChromosomeList(value);
    setChromosome3DComparisonShowing(false);
  };

  const handleColorChange = (color) => {
    if (selectedIndex !== null) {
      const originalCoordinates = chromosome3DExampleData[
        `${cellLineName}-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}-${chromosome3DExampleID}`
      ];
      const comparisonCoordinates = comparisonCellLine3DData[
        `${comparisonCellLine}-COMPARISON-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}-${comparisonCellLine3DSampleID}`
      ];

      setSelectedSphereLists((prev) => {
        const updatedOriginal = {
          ...prev[cellLineName],
          [selectedIndex]: {
            ...(prev[cellLineName]?.[selectedIndex] || { position: originalCoordinates?.[selectedIndex] }),
            color: color.toHexString(),
          },
        };

        const updatedComparison = comparisonCoordinates
          ? {
            ...prev[comparisonCellLine],
            [selectedIndex]: {
              ...(prev[comparisonCellLine]?.[selectedIndex] || { position: comparisonCoordinates?.[selectedIndex] }),
              color: color.toHexString(),
            },
          }
          : prev[comparisonCellLine];

        return {
          ...prev,
          ...(cellLineName ? { [cellLineName]: updatedOriginal } : {}),
          ...(comparisonCellLine ? { [comparisonCellLine]: updatedComparison } : {}),
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
    setComparisonCellLine3DData({});
    setComparisonCellLine(null);
    setComparisonCellLine3DSampleID(0);
    fetchChromosomeSize(value);
    setChromosome3DComparisonShowing(false);
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

  const handleStartInputBlur = () => {
    const num = Number(startInputValue);
    if (endRef.current > 0 && !isSequenceInValidRange(num, endRef.current)) {
      warning('invalidRange');
      setStartInputValue(selectedChromosomeSequence.start.toString());
      return;
    }
    startRef.current = num;
    setSelectedChromosomeSequence(prev => ({ ...prev, start: num }));
    setChromosome3DComparisonShowing(false);
    setComparisonCellLine(null);
    setComparisonCellLine3DSampleID(0);
    setComparisonCellLine3DData({});
  };

  const handleEndInputBlur = () => {
    const num = Number(endInputValue);
    if (startRef.current > 0 && !isSequenceInValidRange(startRef.current, num)) {
      warning('invalidRange');
      setEndInputValue(selectedChromosomeSequence.end.toString());
      return;
    }
    endRef.current = num;
    setSelectedChromosomeSequence(prev => ({ ...prev, end: num }));
    setChromosome3DComparisonShowing(false);
    setComparisonCellLine(null);
    setComparisonCellLine3DSampleID(0);
    setComparisonCellLine3DData({});
  }

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

    setChromosome3DComparisonShowing(false);
    setComparisonCellLine(null);
    setComparisonCellLine3DSampleID(0);
    setComparisonCellLine3DData({});
  }

  const handleEndSelect = (value) => {
    const num = Number(value);
    endRef.current = num;
    setEndInputValue(num.toString());
    setSelectedChromosomeSequence(prev => ({ ...prev, end: num }));

    setChromosome3DComparisonShowing(false);
    setComparisonCellLine(null);
    setComparisonCellLine3DSampleID(0);
    setComparisonCellLine3DData({});
  }

  const handleConfirm = () => {
    const startNum = Number(startInputValue);
    const endNum = Number(endInputValue);

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

    startRef.current = startNum;
    endRef.current = endNum;

    setSelectedChromosomeSequence({ start: startNum, end: endNum });
    return true;
  };
  // Heatmap Add button click
  const addNewComparisonHeatmap = () => {
    setComparisonHeatmapList((prev) => [...prev, comparisonHeatmapIndex]);
    setComparisonHeatmapIndex((prev) => prev + 1);
  }

  const removeComparisonHeatmap = (index) => {
    setComparisonHeatmapList((prev) => prev.filter((i) => i !== index));
  };

  // return to introduction page
  const returnIntroPage = () => {
    setCellLineName(null);
    setChromosomeName(null);
    setChromosomeSize({ start: 0, end: 0 });
    setSelectedChromosomeSequence({ start: 0, end: 0 });
    setChromosomeData([]);
    setChromosome3DExampleData({});
    setComparisonCellLine3DData({});
    setComparisonCellLine(null);
    setComparisonCellLine3DSampleID(0);
    setComparisonCellLine3DLoading(false);
    setChromosome3DExampleID(0);
    setChromosome3DLoading(false);
    setHeatmapLoading(false);
    setGeneName(null);
    setGeneSize({ start: 0, end: 0 });
    setGeneList([]);
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
  }

  const onClickOriginalDownloadItems = ({ key }) => {
    if (!isExampleMode(cellLineName, chromosomeName, selectedChromosomeSequence)) {
      if (key === '1') {
        downloadDistance(false, false);
      }
      if (key === '2') {
        downloadPositionData(false, false);
      }
    } else {
      if (key === '1') {
        downloadDistance(false, true);
      }
      if (key === '2') {
        downloadPositionData(false, true);
      }
    }
  }

  const onClickComparisonDownloadItems = ({ key }) => {
    if (key === '1') {
      downloadDistance(true);
    }
    if (key === '2') {
      downloadPositionData(true);
    }
  }

  // Download 5000 samples of beads' distance data
  const downloadDistance = async (isComparison, isExample) => {
    if (isComparison) {
      setComparisonChromosomeDownloadSpinner(true);
    } else {
      setOriginalChromosomeDownloadSpinner(true);
    }

    try {
      const response = await fetch("/api/downloadFullChromosome3dDistanceData", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cell_line: isComparison ? comparisonCellLine : chromosome3DCellLineName,
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
      if (isComparison) {
        a.download = `${comparisonCellLine}_${chromosomeName}_${selectedChromosomeSequence.start}_${selectedChromosomeSequence.end}.npz`;
      } else {
        a.download = `${chromosome3DCellLineName}_${chromosomeName}_${selectedChromosomeSequence.start}_${selectedChromosomeSequence.end}.npz`;
      }
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
    } finally {
      if (isComparison) {
        setComparisonChromosomeDownloadSpinner(false);
      } else {
        setOriginalChromosomeDownloadSpinner(false);
      }
    }
  };

  // Download 5000 samples of beads' position data (.csv)
  const downloadPositionData = async (isComparison, is_example) => {
    if (isComparison) {
      setComparisonChromosomeDownloadSpinner(true);
    } else {
      setOriginalChromosomeDownloadSpinner(true);
    }

    try {
      const response = await fetch("/api/downloadFullChromosome3dPositionData", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cell_line: isComparison ? comparisonCellLine : chromosome3DCellLineName,
          chromosome_name: chromosomeName,
          sequences: selectedChromosomeSequence,
          is_example: is_example
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
      if (isComparison) {
        a.download = `${comparisonCellLine}_${chromosomeName}_${selectedChromosomeSequence.start}_${selectedChromosomeSequence.end}.csv`;
      } else {
        a.download = `${chromosome3DCellLineName}_${chromosomeName}_${selectedChromosomeSequence.start}_${selectedChromosomeSequence.end}.csv`;
      }
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
    } finally {
      if (isComparison) {
        setComparisonChromosomeDownloadSpinner(false);
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
        fetchExampleChromos3DData(chromosome3DCellLineName, tempSampleId, "sampleChange", false);
        progressPolling(chromosome3DCellLineName, chromosomeName, selectedChromosomeSequence, tempSampleId, false);
      } else {
        fetchExistChromos3DData(false, tempSampleId, chromosome3DCellLineName, false);
        progressPolling(chromosome3DCellLineName, 'chr8', [127300000, 128300000], tempSampleId, true);
      }
    }
  }

  // 3D Original Chromosome sample change
  const originalSampleChange = (key) => {
    setChromosome3DExampleID(key);
    const cacheKey = `${chromosome3DCellLineName}-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}-${key}`;
    if (!chromosome3DExampleData[cacheKey]) {
      if (!isExampleMode(chromosome3DCellLineName, chromosomeName, selectedChromosomeSequence)) {
        fetchExampleChromos3DData(chromosome3DCellLineName, key, "sampleChange", false);
        progressPolling(chromosome3DCellLineName, chromosomeName, selectedChromosomeSequence, key, false);
      } else {
        fetchExistChromos3DData(false, key, chromosome3DCellLineName, false);
        progressPolling(chromosome3DCellLineName, 'chr8', [127300000, 128300000], key, true);
      }
    };
  };

  // 3D Comparison Chromosome sample change
  const comparisonSampleChange = (key) => {
    setComparisonCellLine3DSampleID(key);
    const cacheKey = `${comparisonCellLine}-COMPARISON-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}-${key}`;
    if (!comparisonCellLine3DData[cacheKey]) {
      if (!isExampleMode(comparisonCellLine, chromosomeName, selectedChromosomeSequence)) {
        fetchExampleChromos3DData(comparisonCellLine, key, "sampleChange", true);
        progressPolling(comparisonCellLine, chromosomeName, selectedChromosomeSequence, key, false);
      } else {
        fetchExistChromos3DData(false, key, comparisonCellLine, true);
        progressPolling(comparisonCellLine, 'chr8', [127300000, 128300000], key, true);
      }
    };
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

    const isExample = isExampleMode(value, chromosomeName, selectedChromosomeSequence);
    if (!isExample) {
      fetchExampleChromos3DData(value, comparisonCellLine3DSampleID, "sampleChange", true);
      progressPolling(value, chromosomeName, selectedChromosomeSequence, comparisonCellLine3DSampleID, false);
    } else {
      fetchExistChromos3DData(true, exampleDataBestSampleID[value], value, true);
      progressPolling(value, 'chr8', [127300000, 128300000], exampleDataBestSampleID[value], true);
    }
  };

  // Submit button click
  const submit = () => {
    if (!handleConfirm()) return;
    if (selectedChromosomeSequence.start > selectedChromosomeSequence.end) {
      warning('smallend');
    } else if (!cellLineName || !chromosomeName) {
      warning('noData');
    } else {
      setHeatmapLoading(true);
      if (!isExampleMode(cellLineName, chromosomeName, selectedChromosomeSequence)) {
        setCurrentChromosomeSequence(selectedChromosomeSequence);
      }

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
                  // onBlur={handleStartInputBlur}
                  onSearch={onStartSearch}
                  onSelect={handleStartSelect}
                  onFocus={() => {
                    if (endRef.current > 0) {
                      onStartSearch(startRef.current.toString());
                    }
                  }}
                  // value={selectedChromosomeSequence.start?.toString() || ""}
                  value={startInputValue}
                />
                <span className="controlGroupText">~</span>
                <AutoComplete
                  size="small"
                  options={endSequencesOptions}
                  style={{ width: "8%" }}
                  placeholder="End"
                  onChange={onEndChange}
                  // onBlur={handleEndInputBlur}
                  onSearch={onEndSearch}
                  onSelect={handleEndSelect}
                  onFocus={() => {
                    if (startRef.current > 0) {
                      onEndSearch(endRef.current.toString());
                    }
                  }}
                  // value={selectedChromosomeSequence.end?.toString() || ""}
                  value={endInputValue}
                />
                <Tooltip
                  title="Add a new heatmap"
                  color='white'
                  overlayInnerStyle={{
                    color: 'black'
                  }}>
                  <Button id="add-new-heatmap-button" disabled={!chromosomeData.length} size="small" icon={<PlusOutlined />} onClick={addNewComparisonHeatmap} />
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
              />
            </div>
          )}

        {!(chromosomeData.length === 0 && Object.keys(chromosome3DExampleData).length === 0) && (
          <>
            {/* Original Heatmap */}
            {(heatmapLoading || chromosomeData.length === 0) ? (
              <Spin spinning={true} size="large" style={{ width: '40vw', height: '100%', borderRight: "1px solid #eaeaea", margin: 0 }} />
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
                  setComparisonCellLine3DData={setComparisonCellLine3DData}
                  setComparisonCellLine3DLoading={setComparisonCellLine3DLoading}
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
                cellLineDict={cellLineDict}
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
                setComparisonCellLine3DData={setComparisonCellLine3DData}
                setComparisonCellLine3DLoading={setComparisonCellLine3DLoading}
                setGeneName={setGeneName}
                setGeneSize={setGeneSize}
                setSelectedSphereLists={setSelectedSphereLists}
                removeComparisonHeatmap={removeComparisonHeatmap}
                setChromosome3DCellLineName={setChromosome3DCellLineName}
              />
            ))}

            {/* Original 3D chromosome */}
            {(Object.keys(chromosome3DExampleData).length > 0 || chromosome3DLoading) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', height: '100%', width: 'calc(100% - 40vw)', flexShrink: 0 }}>
                <div style={{ width: chromosome3DComparisonShowing ? "49.9%" : "100%", marginRight: chromosome3DComparisonShowing ? '0.2%' : '0%', flexShrink: 0 }}>
                  <Tabs
                    size="small"
                    activeKey={chromosome3DExampleID}
                    defaultActiveKey={chromosome3DExampleID}
                    style={{ width: '100%', height: '100%' }}
                    onChange={originalSampleChange}
                    tabBarExtraContent={
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <div style={{ fontSize: 11, fontWeight: 'bold', marginRight: 5, display: 'flex', alignItems: 'center' }}>
                          <span style={{ lineHeight: 'normal' }}>{cellLineDict[chromosome3DCellLineName]}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', marginRight: 5 }}>
                          <Tooltip
                            title="Add a new sample ID"
                            color='white'
                            overlayInnerStyle={{
                              color: 'black'
                            }}
                          >
                            <InputNumber style={{ width: 120 }} size='small' min={1} max={5000} addonAfter={<PlusOutlined onClick={addCustomKey} />} value={tempSampleId} onChange={setTempSampleId} />
                          </Tooltip>
                        </div>
                        <Tooltip
                          title={
                            <span>
                              Download <span style={{ color: '#3457D5', fontWeight: 'bold' }}>5000</span> chromosomal bead distance matrix (.npz).<br />
                              <span style={{ color: '#3457D5', fontWeight: 'bold' }}>Note:</span> It may take
                              <span style={{ color: '#dd1c77', fontWeight: 'bold' }}> 10 minutes </span> to download the data.
                            </span>
                          }
                          color='white'
                          overlayInnerStyle={{
                            color: 'black'
                          }}
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
                    items={sampleKeys.map((sampleId, i) => {
                      const cacheKey = `${chromosome3DCellLineName}-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}-${sampleId}`;
                      const label = sampleId === 0
                        ? (
                          <Tooltip
                            title={
                              <span>
                                Most representative single-cell structure (<span style={{ color: '#3457D5', fontWeight: 'bold' }}>highest correlation</span> with average)
                              </span>
                            }
                            color='white'
                            overlayInnerStyle={{
                              color: 'black'
                            }}
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
                              cellLineDict={cellLineDict}
                              isExampleMode={isExampleMode}
                            />
                          )
                        )
                      };
                    })}
                  />
                </div>

                {/* Comparison 3D chromosome */}
                {chromosome3DComparisonShowing && (
                  <div style={{ width: "49.9%", flexShrink: 0 }}>
                    <Tabs
                      size="small"
                      activeKey={comparisonCellLine3DSampleID}
                      defaultActiveKey={comparisonCellLine3DSampleID}
                      style={{ width: '100%', height: '100%' }}
                      onChange={comparisonSampleChange}
                      tabBarExtraContent={
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginRight: '5px' }}>
                          <Select
                            value={comparisonCellLine}
                            style={{
                              minWidth: 150,
                              maxWidth: 150,
                              marginRight: 5,
                            }}
                            size="small"
                            onChange={comparisonCellLineChange}
                            options={cellLineList}
                          />
                          <Tooltip
                            title={
                              <span>
                                Download <span style={{ color: '#3457D5', fontWeight: 'bold' }}>5000</span> chromosomal bead distance matrix (.npz).<br />
                                <span style={{ color: '#3457D5', fontWeight: 'bold' }}>Note:</span> It may take
                                <span style={{ color: '#dd1c77', fontWeight: 'bold' }}> 10 minutes </span> to download the data.
                              </span>
                            }
                            color='white'
                            overlayInnerStyle={{
                              color: 'black'
                            }}
                          >
                            <Dropdown menu={{ items: downloadItems, onClick: onClickComparisonDownloadItems }} placement="bottomRight" arrow>
                              <Button
                                style={{
                                  fontSize: 15,
                                  cursor: "pointer",
                                  marginRight: 5,
                                }}
                                disabled={Object.keys(comparisonCellLine3DData).length === 0}
                                size="small"
                                icon={comparisonChromosomeDistanceDownloadSpinner ? <SyncOutlined spin /> : <DownloadOutlined />}
                              />
                            </Dropdown>
                          </Tooltip>
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

                      items={sampleKeys.map((sampleId, i) => {
                        const cacheKey = `${comparisonCellLine}-COMPARISON-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}-${sampleId}`;
                        const label = sampleId === 0
                          ? (
                            <Tooltip
                              title={
                                <span>
                                  Most representative single-cell structure (<span style={{ color: '#3457D5', fontWeight: 'bold' }}>highest correlation</span> with average)
                                </span>
                              }
                              color='white'
                              overlayInnerStyle={{
                                color: 'black'
                              }}
                            >
                              <span>Sample {sampleId} (Ens.Rep.)</span>
                            </Tooltip>
                          )
                          : `Sample ${sampleId}`;
                        return {
                          label: label,
                          key: sampleId,
                          children: (
                            comparisonCellLine3DLoading ? (
                              <Spin size="large" style={{ margin: '20px 0' }} percent={ChromosomeDataSpinnerProgress} />
                            ) : (
                              <Chromosome3D
                                formatNumber={formatNumber}
                                celllineName={comparisonCellLine}
                                chromosomeName={chromosomeName}
                                currentChromosomeSequence={currentChromosomeSequence}
                                geneSize={geneSize}
                                chromosomeData={chromosomeData}
                                chromosome3DExampleData={comparisonCellLine3DData[cacheKey] || []}
                                chromosome3DAvgMatrixData={comparisonCellLine3DData[cacheKey + "_avg_matrix"]}
                                chromosomefqData={comparisonCellLine3DData[cacheKey + "_fq_data"]}
                                chromosomeCurrentSampleDistanceVector={comparisonCellLine3DData[cacheKey + "sample_distance_vector"]}
                                validChromosomeValidIbpData={validChromosomeValidIbpData}
                                selectedChromosomeSequence={selectedChromosomeSequence}
                                selectedIndex={selectedIndex}
                                setSelectedIndex={setSelectedIndex}
                                selectedSphereList={selectedSphereLists}
                                setSelectedSphereList={setSelectedSphereLists}
                                handleColorChange={handleColorChange}
                                distributionData={distributionData}
                                setDistributionData={setDistributionData}
                                cellLineDict={cellLineDict}
                                isExampleMode={isExampleMode}
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
            }
          </>
        )}
      </div>
    </div>
  );
}

export default App;
