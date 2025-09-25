import React, { useState, useEffect, useRef } from 'react';
import { Select, Button, message, Spin, Tabs, Switch, Tooltip, Tour, Typography, Dropdown, InputNumber, AutoComplete } from 'antd';
import './Styles/App.css';
import { Heatmap } from './hicHeatmap.js';
import { ChromosomeBar } from './chromosomeBar.js';
import { Chromosome3D } from './chromosome3D.js';
import { ProjectIntroduction } from './projectIntroduction.js';
import { PlusOutlined, MinusOutlined, InfoCircleOutlined, ExperimentOutlined, DownloadOutlined, SyncOutlined, FolderViewOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";


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
      key: 'GM12878-chr8-127300000-128300000',
      label: 'GM12878-Chr8-127300000-128300000',
      cellLine: 'GM12878',
      chromosome: 'chr8',
      start: 127300000,
      end: 128300000
    },
    {
      key: 'GM12878-chr8-127200000-127750000',
      label: 'GM12878-Chr8-127200000-127750000',
      cellLine: 'GM12878',
      chromosome: 'chr8',
      start: 127200000,
      end: 127750000
    },
    {
      key: 'IMR90-chr8-127300000-128300000',
      label: 'IMR90-Chr8-127300000-128300000',
      cellLine: 'IMR90',
      chromosome: 'chr8',
      start: 127300000,
      end: 128300000
    },
    {
      key: 'Calu3-chr8-127200000-127750000',
      label: 'Calu3-Chr8-127200000-127750000',
      cellLine: 'Calu3',
      chromosome: 'chr8',
      start: 127200000,
      end: 127750000
    },
    {
      key: 'monocytes-chr8-127200000-127750000',
      label: 'Monocytes-Chr8-127200000-127750000',
      cellLine: 'monocytes',
      chromosome: 'chr8',
      start: 127200000,
      end: 127750000
    }
  ])

  // Create dropdown-safe items (without extra properties that cause React warnings)
  const dropdownExampleDataItems = exampleDataItems.map(({ key, label }) => ({ key, label }));
  const [sampleKeys, setSampleKeys] = useState([0, 1000, 2000]);
  const [exampleDataSet, setExampleDataSet] = useState({
    "GM12878-chr8-127300000-128300000": 4229,
    "GM12878-chr8-127200000-127750000": 4193,
    "IMR90-chr8-127300000-128300000": 1201,
    "Calu3-chr8-127200000-127750000": 1422,
    "monocytes-chr8-127200000-127750000": 2805
  });

  const [ChromosomeDataSpinnerProgress, setChromosomeDataSpinnerProgress] = useState(0);

  // Bintu-related state
  const [bintuCellClusters, setBintuCellClusters] = useState([]);
  const [bintuHeatmaps, setBintuHeatmaps] = useState([]); // Array of Bintu heatmap instances
  const [bintuHeatmapIndex, setBintuHeatmapIndex] = useState(1); // Index for next Bintu heatmap

  // GSE-related state
  const [gseCellLines, getGseCellLines] = useState([]);
  const [gseCellIds, getGseCellIds] = useState([]);
  const [gseChrIds, setGseChrIds] = useState([]);
  const [gseHeatmaps, setGseHeatmaps] = useState([]); // Array of GSE heatmap instances
  const [gseHeatmapIndex, setGseHeatmapIndex] = useState(1); // Index for next GSE heatmap

  // Heatmap Comparison settings
  const [comparisonHeatmapList, setComparisonHeatmapList] = useState([]); // List of comparison heatmaps
  const [comparisonHeatmapIndex, setComparisonHeatmapIndex] = useState(1); // Index of comparison heatmap
  const [comparisonHeatmapCellLines, setComparisonHeatmapCellLines] = useState({}); // Track selected cell lines for each comparison heatmap
  const [comparisonHeatmapUpdateTrigger, setComparisonHeatmapUpdateTrigger] = useState({}); // Trigger updates for comparison heatmaps

  // Unified left panel ordering (Bintu + GSE + Comparison heatmaps)
  // Each item: { type: 'bintu' | 'gse' | 'comparison', id: number, createdAt: number }
  const [leftPanels, setLeftPanels] = useState([]);

  // 3D Chromosome Multiple Components settings
  const [chromosome3DComponents, setChromosome3DComponents] = useState([]); // Array of component configs
  const [chromosome3DComponentIndex, setChromosome3DComponentIndex] = useState(1); // Next component index

  // Tour visibility state - start as false until we check server
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [tourStatusChecked, setTourStatusChecked] = useState(false);

  // Check if scroll buttons should be visible
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const { Title } = Typography;

  const startRef = useRef(0);
  const endRef = useRef(0);
  const scrollContainerRef = useRef(null);

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
      target: () => document.querySelector(".controlGroupText:nth-of-type(3) + .ant-select"),
    },
    {
      title: "New Sample Comparison Button",
      description: "Click this button to add a new heatmap or 3D chromatin strucrute for comparison.",
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

  const addItems = [
    {
      key: 'nonRandomHiCHeatmap',
      label: 'Add non-random HiC Heatmap',
      disabled: !(chromosomeData.length > 0 || comparisonHeatmapList.length > 0),
    },
    {
      key: 'chromosome3d',
      label: 'Add 3D Structure Comparison',
      disabled: !(Object.keys(chromosome3DExampleData).length > 0 || chromosome3DComponents.length > 0)
    }
  ]

  // Add "," to the number by every 3 digits
  const formatNumber = (value) => {
    if (!value) return '';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Scroll functions for horizontal navigation
  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      // Calculate the width of one component
      const totalComponents = 1 + chromosome3DComponents.length; // Original + comparison components
      // const containerWidth = scrollContainerRef.current.offsetWidth;
      const componentWidth = scrollContainerRef.current.scrollWidth / totalComponents;

      scrollContainerRef.current.scrollBy({
        left: -componentWidth,
        behavior: 'smooth'
      });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      // Calculate the width of one component
      const totalComponents = 1 + chromosome3DComponents.length; // Original + comparison components
      // const containerWidth = scrollContainerRef.current.offsetWidth;
      const componentWidth = scrollContainerRef.current.scrollWidth / totalComponents;

      scrollContainerRef.current.scrollBy({
        left: componentWidth,
        behavior: 'smooth'
      });
    }
  };

  // Update scroll button states
  const updateScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      const hasOverflow = scrollWidth > clientWidth;
      const hasEnoughComponents = chromosome3DComponents.length >= 2;

      // Only show gradient effects when there are 3+ components AND there's actual overflow
      setCanScrollLeft(scrollLeft > 0 && hasOverflow && hasEnoughComponents);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1 && hasOverflow && hasEnoughComponents);
      setShowScrollButtons(hasEnoughComponents && hasOverflow);
    }
  };

  useEffect(() => {
    fetch('/api/clearFoldingInputFolderInputContent', { method: 'POST' });
  }, []);

  useEffect(() => {
    if (!isCellLineMode) {
      fetchGeneNameList();
    }
    fetchCellLineList();
    fetchBintuCellClusters();
    fetchGseCellLineOptions();
    // fetchGseCellIdOptions and fetchGseConditions will be called when needed with parameters
  }, []);

  // Add scroll event listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', updateScrollButtons);
      updateScrollButtons(); // Initial check

      // ResizeObserver to update on size changes
      const resizeObserver = new ResizeObserver(updateScrollButtons);
      resizeObserver.observe(container);

      // Handle wheel events for better horizontal scrolling
      const handleWheel = (e) => {
        if (e.deltaY !== 0 && chromosome3DComponents.length >= 2) {
          e.preventDefault();
          container.scrollLeft += e.deltaY;
        }
      };

      container.addEventListener('wheel', handleWheel, { passive: false });

      return () => {
        container.removeEventListener('scroll', updateScrollButtons);
        container.removeEventListener('wheel', handleWheel);
        resizeObserver.disconnect();
      };
    }
  }, [chromosome3DComponents.length]);

  // Update scroll buttons when components change
  useEffect(() => {
    // Use a small delay to ensure DOM has updated
    const timer = setTimeout(() => {
      updateScrollButtons();
    }, 100);

    return () => clearTimeout(timer);
  }, [chromosome3DComponents.length]);

  // Update scroll buttons when chromosome3D data is loaded
  useEffect(() => {
    const timer = setTimeout(() => {
      updateScrollButtons();
    }, 200);

    return () => clearTimeout(timer);
  }, [chromosome3DExampleData, chromosome3DComponents]);

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

  // Check tour status on app load
  useEffect(() => {
    checkTourStatus();
  }, []);

  // Function to check if user has seen tour before
  const checkTourStatus = async () => {
    try {
      const response = await fetch('/api/getTourStatus');
      const data = await response.json();

      // Show tour only if user has never seen it before
      const shouldShowTour = !data.tour_seen;
      setIsTourOpen(shouldShowTour);
      setTourStatusChecked(true);

      // If we're showing the tour for the first time, mark it as seen immediately
      if (shouldShowTour) {
        markTourSeen();
      }
    } catch (error) {
      console.error('Error checking tour status:', error);
      // Default to showing tour if there's an error
      setIsTourOpen(true);
      setTourStatusChecked(true);
    }
  };

  // Function to mark tour as seen (called immediately when tour is shown)
  const markTourSeen = async () => {
    try {
      await fetch('/api/setTourSeen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
    } catch (error) {
      console.error('Error marking tour as seen:', error);
    }
  };

  // Handle tour close (no need to call API since it's already marked as seen)
  const handleTourClose = () => {
    setIsTourOpen(false);
    // No need to call markTourSeen() here since it's already called when tour is first shown
  };

  // useEffect to handle GSE cell line selection changes with resolution
  useEffect(() => {
    // When any GSE heatmap's selectedOrg or resolution changes, fetch cell ID options for each heatmap
    gseHeatmaps.forEach(gseHeatmap => {
      if (gseHeatmap.selectedOrg) {
        fetchGseCellIdOptionsForHeatmap(gseHeatmap.id, gseHeatmap.selectedOrg, gseHeatmap.resolution);
      }
    });
  }, [gseHeatmaps.map(h => `${h.selectedOrg}-${h.resolution}`).join(',')]);

  // useEffect to handle GSE cell selection changes  
  useEffect(() => {
    // When any GSE heatmap's selectedCell changes, fetch condition options
    gseHeatmaps.forEach(gseHeatmap => {
      if (gseHeatmap.selectedOrg && gseHeatmap.selectedCell) {
        fetchGseChrIdOptions(gseHeatmap.selectedOrg, gseHeatmap.selectedCell);
      }
    });
  }, [gseHeatmaps.map(h => `${h.selectedOrg}-${h.selectedCell}`).join(',')]);

  // varify if in example mode
  const isExampleMode = (cellLineName, chromosomeName, selectedChromosomeSequence) => {
    const exampleKey = `${cellLineName}-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}`;
    return exampleDataSet.hasOwnProperty(exampleKey);
  }

  // fetch 3D chromosome data progress
  const progressPolling = (cellLineName, chromosomeName, sequence, sampleId, isExist) => {
    setChromosomeDataSpinnerProgress(5); // Start with 5% to show the progress bar
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
          // Ensure percent is in the correct range (0-100) for the Spin component
          const progressPercent = percent > 1 ? percent : percent * 100;
          setChromosomeDataSpinnerProgress(progressPercent);

          if (percent >= 99) {
            // Progress complete, reset the progress and stop polling
            setChromosomeDataSpinnerProgress(0);
            return;
          }

          const delay = first ? 100 : 10000;
          first = false;

          setTimeout(fetchProgress, delay);
        })
        .catch(error => {
          console.error('Error fetching progress:', error);
          setChromosomeDataSpinnerProgress(0);
        });
    };

    setTimeout(fetchProgress, 10000);
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

    // Check if the componentId represents a 3D chromosome component
    // We need to check both if it exists in the array AND if it's a large timestamp-like number
    // (which indicates it's a newly created 3D component that might not be in the array yet)
    const is3DComponent = componentId !== null && (
      chromosome3DComponents.some(c => c.id === componentId) ||
      (componentId > 1000000000000) // Timestamp-like ID indicates 3D component
    );

    // Determine the cache key pattern:
    // - For original heatmap (componentId = null): use cellLineName (traditional pattern)
    // - For comparison heatmaps (componentId = heatmapId): use HEATMAP-{id} pattern
    // - For 3D chromosome components: use COMPARISON pattern
    let keyPrefix;
    if (is3DComponent) {
      keyPrefix = `${cellLineName}-COMPARISON`;
    } else if (componentId === null) {
      keyPrefix = cellLineName; // Original heatmap
    } else {
      keyPrefix = `${cellLineName}-HEATMAP-${componentId}`; // Comparison heatmap
    }

    // Special handling for 3D components in example mode
    // In example mode, we want to use the best sample ID for the API call,
    // but store the data under the cache key that uses the component's current sampleID
    let cacheKeySampleID = sampleID;
    let apiSampleID = sampleID;

    if (is3DComponent && isExampleMode(cellLineName, chromosomeName, selectedChromosomeSequence)) {
      const component = chromosome3DComponents.find(c => c.id === componentId);
      if (component) {
        // Use component's current sampleID for cache key, but best sample ID for API
        cacheKeySampleID = component.sampleID;
        apiSampleID = sampleID; // This is the best sample ID passed from updateComponentCellLine
      }
    }

    const cacheKey = `${keyPrefix}-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}-${cacheKeySampleID}`;

    const cachedData = is3DComponent ?
      chromosome3DComponents.find(c => c.id === componentId)?.data[cacheKey] :
      chromosome3DExampleData[cacheKey];

    if (cachedData) {
      // Data already exists, no need to fetch
      if (is3DComponent) {
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
      return;
    }

    // Set loading state before fetching
    if (is3DComponent) {
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

    // Determine which API to use based on isExampleMode
    const isExample = isExampleMode(cellLineName, chromosomeName, selectedChromosomeSequence);

    if (isExample) {
      // For example mode, use the existing getExistChromosome3DData API
      // Start progress polling for example data
      progressPolling(cellLineName, chromosomeName, selectedChromosomeSequence, apiSampleID, true);

      fetch('/api/getExistChromosome3DData', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cell_line: cellLineName,
          sample_id: apiSampleID,
          sequences: selectedChromosomeSequence,
          chromosome_name: chromosomeName
        })
      })
        .then(res => res.json())
        .then(data => {
          if (is3DComponent) {
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
            // For heatmaps (including comparison heatmaps), store in chromosome3DExampleData
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
          console.error('Error fetching existing chromosome 3D data:', error);
          if (is3DComponent) {
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
    } else {
      // For non-example mode, use the getChromosome3DData API
      // Start progress polling for non-example data
      progressPolling(cellLineName, chromosomeName, selectedChromosomeSequence, apiSampleID, false);

      fetch('/api/getChromosome3DData', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cell_line: cellLineName,
          chromosome_name: chromosomeName,
          sequences: selectedChromosomeSequence,
          sample_id: apiSampleID
        })
      })
        .then(res => res.json())
        .then(data => {
          if (is3DComponent) {
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
            // For heatmaps (including comparison heatmaps), store in chromosome3DExampleData
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
          if (is3DComponent) {
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
        // Data already exists, ensure loading state is reset
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

  // Bintu-related functions
  const fetchBintuCellClusters = () => {
    fetch('/api/getBintuCellClusters')
      .then(res => res.json())
      .then(data => {
        setBintuCellClusters(data);
      })
      .catch(error => {
        console.error('Error fetching Bintu cell clusters:', error);
        messageApi.open({
          type: 'error',
          content: 'Failed to fetch Bintu cell clusters',
          duration: 3,
        });
      });
  };

  const fetchBintuDistanceMatrix = (cellLine, chrid, startValue, endValue, cellId, bintuId) => {
    // Set loading state for this specific bintu instance
    setBintuHeatmaps(prev => prev.map(bintu => 
      bintu.id === bintuId 
        ? { ...bintu, loading: true } 
        : bintu
    ));

    fetch('/api/getBintuDistanceMatrix', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cell_line: cellLine,
        chrid: chrid,
        start_value: startValue,
        end_value: endValue,
        cell_id: cellId
      })
    })
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to fetch distance matrix');
        }
        return res.json();
      })
      .then(data => {
        // Update the specific Bintu heatmap instance
        setBintuHeatmaps(prev => prev.map(bintu => 
          bintu.id === bintuId 
            ? { 
                ...bintu, 
                data: data,
                loading: false,
                geneList: [] // Will be updated separately
              } 
            : bintu
        ));

        // Fetch gene list for the region
        const sequences = { start: startValue, end: endValue };
        fetch('/api/getGeneList', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            // Backend expects chromosome without 'chr' prefix
            chromosome_name: typeof chrid === 'string' ? chrid.replace(/^chr/i, '') : chrid,
            sequences: sequences
          })
        })
          .then(res => res.json())
          .then(geneData => {
            // Update gene list for this specific instance
            setBintuHeatmaps(prev => prev.map(bintu => 
              bintu.id === bintuId 
                ? { ...bintu, geneList: geneData } 
                : bintu
            ));
          })
          .catch(error => {
            console.error('Error fetching gene list:', error);
          });
      })
      .catch(error => {
        console.error('Error fetching Bintu distance matrix:', error);
        // Set loading to false and clear data on error
        setBintuHeatmaps(prev => prev.map(bintu => 
          bintu.id === bintuId 
            ? { ...bintu, loading: false, data: null } 
            : bintu
        ));
        messageApi.open({
          type: 'error',
          content: 'Failed to fetch Bintu distance matrix',
          duration: 3,
        });
      });
  };

  const handleAddBintuHeatmap = () => {
    // Create a new Bintu heatmap instance
    const newId = bintuHeatmapIndex;
    const newBintuHeatmap = {
      id: newId,
      selectedCluster: null,
      tempCellId: null,
      data: null,
      loading: false,
      geneList: []
    };

    setBintuHeatmaps(prev => [...prev, newBintuHeatmap]);
    setBintuHeatmapIndex(prev => prev + 1);

    // Track creation order so newest appears on the far right
    setLeftPanels(prev => [...prev, { type: 'bintu', id: newId, createdAt: Date.now() }]);
  };

  const handleBintuHeatmapSubmit = (bintuId) => {
    const bintuHeatmap = bintuHeatmaps.find(b => b.id === bintuId);
    if (!bintuHeatmap) return;

    if (!bintuHeatmap.selectedCluster) {
      messageApi.open({
        type: 'warning',
        content: 'Please select a Bintu cluster first',
        duration: 2,
      });
      return;
    }

    if (!bintuHeatmap.tempCellId) {
      messageApi.open({
        type: 'warning',
        content: 'Please enter a cell ID',
        duration: 2,
      });
      return;
    }

    // Parse the selected cluster
    const cluster = bintuCellClusters.find(c => c.value === bintuHeatmap.selectedCluster);
    if (cluster) {
      fetchBintuDistanceMatrix(
        cluster.cell_line,
        cluster.chrid,
        cluster.start_value,
        cluster.end_value,
        bintuHeatmap.tempCellId,
        bintuId
      );
    }
  };

  // Function to update specific Bintu heatmap instance
  const updateBintuHeatmap = (bintuId, updates) => {
    setBintuHeatmaps(prev => prev.map(bintu => 
      bintu.id === bintuId 
        ? { ...bintu, ...updates } 
        : bintu
    ));
  };

  // Function to update specific GSE heatmap instance
  const updateGseHeatmap = (gseId, updates) => {
    setGseHeatmaps(prev => prev.map(gse => 
      gse.id === gseId 
        ? { ...gse, ...updates } 
        : gse
    ));
  };

  // Function to remove a specific Bintu heatmap instance
  const removeBintuHeatmap = (bintuId) => {
    setBintuHeatmaps(prev => prev.filter(bintu => bintu.id !== bintuId));
    // Remove corresponding left panel entry
    setLeftPanels(prev => prev.filter(p => !(p.type === 'bintu' && p.id === bintuId)));
  };

  // GSE-related functions
  const fetchGseCellLineOptions = () => {
    fetch('/api/getGseCellLineOptions')
      .then(res => res.json())
      .then(data => {
        getGseCellLines(data);
      })
      .catch(error => {
        console.error('Error fetching GSE organisms:', error);
        messageApi.open({
          type: 'error',
          content: 'Failed to fetch GSE organisms',
          duration: 3,
        });
      });
  };

  const fetchGseCellIdOptions = (cellLine, resolution = null) => {
    if (!cellLine) {
      getGseCellIds([]);
      return;
    }
    
    const requestBody = { cell_line: cellLine };
    if (resolution) {
      requestBody.resolution = resolution;
    }
    
    fetch('/api/getGseCellIdOptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })
      .then(res => res.json())
      .then(data => {
        getGseCellIds(data);
      })
      .catch(error => {
        console.error('Error fetching GSE cell types:', error);
        messageApi.open({
          type: 'error',
          content: 'Failed to fetch GSE cell types',
          duration: 3,
        });
      });
  };

  // Fetch cell IDs for a specific GSE heatmap
  const fetchGseCellIdOptionsForHeatmap = (gseId, cellLine, resolution = null) => {
    if (!cellLine) {
      updateGseHeatmap(gseId, { cellIds: [] });
      return;
    }
    
    const requestBody = { cell_line: cellLine };
    if (resolution) {
      requestBody.resolution = resolution;
    }
    
    fetch('/api/getGseCellIdOptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })
      .then(res => res.json())
      .then(data => {
        updateGseHeatmap(gseId, { cellIds: data });
      })
      .catch(error => {
        console.error('Error fetching GSE cell types for heatmap:', error);
        messageApi.open({
          type: 'error',
          content: 'Failed to fetch GSE cell types',
          duration: 3,
        });
      });
  };

  const fetchGseChrIdOptions = (cellLine, cellId) => {
    if (!cellLine || !cellId) {
      setGseChrIds([]);
      return;
    }
    
    fetch('/api/getGseChrIdOptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cell_line: cellLine,
        cell_id: cellId
      })
    })
      .then(res => res.json())
      .then(data => {
        setGseChrIds(data);
      })
      .catch(error => {
        console.error('Error fetching GSE conditions:', error);
        messageApi.open({
          type: 'error',
          content: 'Failed to fetch GSE conditions',
          duration: 3,
        });
      });
  };

  const fetchGseDistanceMatrix = (cell_line, cellId, chrid, gseId, startValue = null, endValue = null, resolution = null) => {
    // Set loading state for this specific GSE instance
    setGseHeatmaps(prev => prev.map(gse => 
      gse.id === gseId 
        ? { ...gse, loading: true } 
        : gse
    ));

    const requestBody = {
      cell_line: cell_line,
      cell_id: cellId,
      chrid: chrid
    };

    // Add range parameters if provided
    if (startValue !== null && endValue !== null) {
      requestBody.start_value = startValue;
      requestBody.end_value = endValue;
    }

    // Add resolution parameter if provided
    if (resolution !== null) {
      requestBody.resolution = resolution;
    }

    fetch('/api/getGseDistanceMatrix', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to fetch GSE distance matrix');
        }
        return res.json();
      })
      .then(data => {
        // Update the specific GSE heatmap instance
        setGseHeatmaps(prev => prev.map(gse => 
          gse.id === gseId 
            ? { 
                ...gse, 
                data: data,
                loading: false,
                geneList: [] // Will be updated separately
              } 
            : gse
        ));

        // Fetch gene list for the region using data from GSE response
        if (data && data.start_value && data.end_value) {
          const sequences = { start: data.start_value, end: data.end_value };
          fetch('/api/getGeneList', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              // Backend expects chromosome without 'chr' prefix
              chromosome_name: typeof chrid === 'string' ? chrid.replace(/^chr/i, '') : chrid,
              sequences: sequences
            })
          })
            .then(res => res.json())
            .then(geneData => {
              // Update gene list for this specific instance
              setGseHeatmaps(prev => prev.map(gse => 
                gse.id === gseId 
                  ? { ...gse, geneList: geneData } 
                  : gse
              ));
            })
            .catch(error => {
              console.error('Error fetching gene list:', error);
            });
        }
      })
      .catch(error => {
        console.error('Error fetching GSE distance matrix:', error);
        // Set loading to false and clear data on error
        setGseHeatmaps(prev => prev.map(gse => 
          gse.id === gseId 
            ? { ...gse, loading: false, data: null } 
            : gse
        ));
        messageApi.open({
          type: 'error',
          content: 'Failed to fetch GSE distance matrix',
          duration: 3,
        });
      });
  };

  const handleAddGseHeatmap = () => {
    // Create a new GSE heatmap instance
    const newId = gseHeatmapIndex;
    const newGseHeatmap = {
      id: newId,
      selectedOrg: null,
      selectedCell: null,
      selectedCondition: null,
      tempOrgId: null,
      tempCellId: null,
      tempConditionId: null,
      startValue: null,
      endValue: null,
      resolution: '5000',
      data: null,
      loading: false,
      geneList: [],
      cellIds: []  // Individual cell ID options per heatmap
    };

    setGseHeatmaps(prev => [...prev, newGseHeatmap]);
    setGseHeatmapIndex(prev => prev + 1);

    // Track creation order so newest appears on the far right
    setLeftPanels(prev => [...prev, { type: 'gse', id: newId, createdAt: Date.now() }]);
  };

  const handleGseHeatmapSubmit = (gseId) => {
    const gseHeatmap = gseHeatmaps.find(g => g.id === gseId);
    if (!gseHeatmap) return;

    if (!gseHeatmap.selectedOrg) {
      messageApi.open({
        type: 'warning',
        content: 'Please select a GSE cell line first',
        duration: 2,
      });
      return;
    }

    if (!gseHeatmap.selectedCell) {
      messageApi.open({
        type: 'warning',
        content: 'Please select a GSE cell type first',
        duration: 2,
      });
      return;
    }

    if (!gseHeatmap.selectedCondition) {
      messageApi.open({
        type: 'warning',
        content: 'Please select a GSE chr id first',
        duration: 2,
      });
      return;
    }

    if (gseHeatmap.startValue >= gseHeatmap.endValue && gseHeatmap.startValue !== null && gseHeatmap.endValue !== null) {
      messageApi.open({
        type: 'warning',
        content: 'Start position must be less than end position',
        duration: 2,
      });
      return;
    }

    // Parse the selections to get the actual objects
    const organism = gseCellLines.find(o => o.value === gseHeatmap.selectedOrg);
    const cellType = gseHeatmap.cellIds.find(c => c.value === gseHeatmap.selectedCell);
    const condition = gseChrIds.find(c => c.value === gseHeatmap.selectedCondition);

    console.log(organism, cellType, condition);
    if (!organism || !cellType || !condition) {
      messageApi.open({
        type: 'error',
        content: 'Invalid GSE selections',
        duration: 2,
      });
      return;
    }

    // Extract IDs from the selected objects
    // Use the tempIds if they exist, otherwise use the actual IDs from the objects
    const orgId = gseHeatmap.tempOrgId || organism.id || organism.value;
    const cellId = gseHeatmap.tempCellId || cellType.id || cellType.value;

    // Get chromosome data from user selection
    const chrid = gseHeatmap.selectedCondition; // chrid comes from the selected condition

    fetchGseDistanceMatrix(
      orgId,
      cellId,
      chrid,
      gseId,
      gseHeatmap.startValue,
      gseHeatmap.endValue,
      gseHeatmap.resolution
    );
  };

  // Function to remove a specific GSE heatmap instance
  const removeGseHeatmap = (gseId) => {
    setGseHeatmaps(prev => prev.filter(gse => gse.id !== gseId));
    // Remove corresponding left panel entry
    setLeftPanels(prev => prev.filter(p => !(p.type === 'gse' && p.id === gseId)));
  };

  // Function to update GSE heatmap resolution
  const updateGseHeatmapResolution = (gseId, resolution) => {
    setGseHeatmaps(prev => prev.map(gse => 
      gse.id === gseId 
        ? { ...gse, resolution: resolution } 
        : gse
    ));
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
    const newId = comparisonHeatmapIndex;
    setComparisonHeatmapList((prev) => [...prev, newId]);
    setComparisonHeatmapIndex((prev) => prev + 1);
    // Track in unified order list
    setLeftPanels(prev => [...prev, { type: 'comparison', id: newId, createdAt: Date.now() }]);
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
    // Remove corresponding left panel entry
    setLeftPanels(prev => prev.filter(p => !(p.type === 'comparison' && p.id === index)));
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
    setStartInputValue(null);
    setEndInputValue(null);
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
    // Clear non-random comparison heatmaps and related state
    setComparisonHeatmapList([]);
    setComparisonHeatmapIndex(1);
    setComparisonHeatmapCellLines({});
    setComparisonHeatmapUpdateTrigger({});
    // Clear bintu heatmaps
    setBintuHeatmaps([]);
    // Clear GSE heatmaps
    setGseHeatmaps([]);
    // Clear unified left panels
    setLeftPanels([]);
  }

  const onClickExampleDataItem = ({ key }) => {
    // Find the example data item by key
    const exampleItem = exampleDataItems.find(item => item.key === key);
    if (exampleItem) {
      setCellLineName(exampleItem.cellLine);
      setChromosomeName(exampleItem.chromosome);
      setSelectedChromosomeSequence({ start: exampleItem.start, end: exampleItem.end });
      setStartInputValue(exampleItem.start.toString());
      setEndInputValue(exampleItem.end.toString());
      setHeatmapLoading(true);
      setDistributionData({});
    }
  }

  const onClickAddItems = ({ key }) => {
    if (key === 'nonRandomHiCHeatmap') {
      addNewComparisonHeatmap();
    } else if (key === 'chromosome3d') {
      handleAddChromosome3D();
    } else if (key === 'bintuHeatmap') {
      handleAddBintuHeatmap();
    }
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
      // Set loading state before fetching
      setChromosome3DLoading(true);

      if (!isExampleMode(cellLineName, chromosomeName, selectedChromosomeSequence)) {
        fetchExampleChromos3DData(chromosome3DCellLineName, tempSampleId, "sampleChange", null);
        progressPolling(chromosome3DCellLineName, chromosomeName, selectedChromosomeSequence, tempSampleId, false);
      } else {
        fetchExistChromos3DData(false, tempSampleId, chromosome3DCellLineName, null);
      }
    } else {
      // Data already exists, ensure loading state is reset
      setChromosome3DLoading(false);
    }
  }

  // 3D Original Chromosome sample change
  const originalSampleChange = (key) => {
    setChromosome3DExampleID(key);
    setDistributionData({});
    const cacheKey = `${chromosome3DCellLineName}-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}-${key}`;

    if (!chromosome3DExampleData[cacheKey]) {
      // Set loading state before fetching
      setChromosome3DLoading(true);

      if (!isExampleMode(chromosome3DCellLineName, chromosomeName, selectedChromosomeSequence)) {
        fetchExampleChromos3DData(chromosome3DCellLineName, key, "sampleChange", null);
        progressPolling(chromosome3DCellLineName, chromosomeName, selectedChromosomeSequence, key, false);
      } else {
        fetchExistChromos3DData(false, key, chromosome3DCellLineName, null);
      }
    } else {
      // Data already exists, ensure loading state is reset
      setChromosome3DLoading(false);
    }
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
        // Set loading state before fetching
        setChromosome3DComponents(prev =>
          prev.map(comp =>
            comp.id === componentId
              ? { ...comp, loading: true }
              : comp
          )
        );

        if (!isExampleMode(component.cellLine, chromosomeName, selectedChromosomeSequence)) {
          fetchExampleChromos3DData(component.cellLine, key, "sampleChange", componentId);
          progressPolling(component.cellLine, chromosomeName, selectedChromosomeSequence, key, false);
        } else {
          fetchExistChromos3DData(false, key, component.cellLine, componentId);
        }
      } else {
        // Data already exists, ensure loading state is reset
        setChromosome3DComponents(prev =>
          prev.map(comp =>
            comp.id === componentId
              ? { ...comp, loading: false }
              : comp
          )
        );
      }
    }
  };

  // Add 3D Chromosome Component
  const handleAddChromosome3D = () => {
    const newComponent = {
      id: chromosome3DComponentIndex,
      cellLine: null,
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
      if (isExampleMode(cellLine, chromosomeName, selectedChromosomeSequence)) {
        // In example mode, use the best sample ID for fetching data
        const bestSampleID = exampleDataSet[`${cellLine}-${chromosomeName}-${selectedChromosomeSequence.start}-${selectedChromosomeSequence.end}`];
        fetchExistChromos3DData(false, bestSampleID, cellLine, componentId);
      } else {
        // In non-example mode, use the component's current sample ID
        progressPolling(cellLine, chromosomeName, selectedChromosomeSequence, component.sampleID, false);
        fetchExistChromos3DData(false, component.sampleID, cellLine, componentId);
      }
    }
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
        // Use timestamp as trigger value
        updateTriggers[index] = Date.now();
      });
      setComparisonHeatmapUpdateTrigger(updateTriggers);
    }
  };


  return (
    <div className="App">
      {contextHolder}

      {/* Tour Component - only render after status is checked */}
      {tourStatusChecked && (
        <Tour
          open={isTourOpen}
          onClose={handleTourClose}
          onFinish={handleTourClose} // Also handle when user completes all steps
          steps={steps}
        />
      )}

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

          <Dropdown menu={{ items: dropdownExampleDataItems, onClick: onClickExampleDataItem }} placement="bottom" arrow >
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
                <Dropdown menu={{ items: addItems, onClick: onClickAddItems }} placement="bottom" arrow>
                  <Button id="add-new-heatmap-button" size="small" icon={<PlusOutlined />} />
                </Dropdown>
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
                <Dropdown menu={{ items: addItems, onClick: onClickAddItems }} placement="bottom" arrow>
                  <Button id="add-new-heatmap-button" disabled={chromosomeData.length === 0} size="small" icon={<PlusOutlined />} />
                </Dropdown>
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
          chromosomeName={chromosomeName}
        />
      </div>

      {/* main content part */}
      <div className="content">
        {/* project introduction */}
        {!heatmapLoading &&
          chromosomeData.length === 0 &&
          Object.keys(chromosome3DExampleData).length === 0 &&
          bintuHeatmaps.length === 0 &&
          gseHeatmaps.length === 0 && (
            <div style={{ width: '100%', height: '100%', overflowY: 'scroll' }}>
              <ProjectIntroduction
                exampleDataItems={exampleDataItems}
                setCellLineName={setCellLineName}
                setChromosomeName={setChromosomeName}
                setSelectedChromosomeSequence={setSelectedChromosomeSequence}
                setStartInputValue={setStartInputValue}
                setEndInputValue={setEndInputValue}
                handleAddBintuHeatmap={handleAddBintuHeatmap}
                handleAddGseHeatmap={handleAddGseHeatmap}
              />
            </div>
          )}

        {(heatmapLoading || !(chromosomeData.length === 0 && Object.keys(chromosome3DExampleData).length === 0 && bintuHeatmaps.length === 0 && gseHeatmaps.length === 0)) && (
          <>
            {/* Original Hi-C Heatmap: show spinner only when actually loading; otherwise render only if data exists */}
            {heatmapLoading ? (
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
                  exampleDataSet={exampleDataSet}
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
                  setGeneName={setGeneName}
                  setGeneSize={setGeneSize}
                  setSelectedSphereLists={setSelectedSphereLists}
                  removeComparisonHeatmap={removeComparisonHeatmap}
                  setChromosome3DCellLineName={setChromosome3DCellLineName}
                  setChromosome3DComponents={setChromosome3DComponents}
                  setChromosome3DComponentIndex={setChromosome3DComponentIndex}
                  comparisonHeatmapList={comparisonHeatmapList}
                />
              )
            )}

            {/* Left panels (Bintu + Comparison) rendered by creation order */}
            {[...leftPanels].sort((a, b) => a.createdAt - b.createdAt).map(panel => {
              if (panel.type === 'bintu') {
                const bintuHeatmap = bintuHeatmaps.find(b => b.id === panel.id);
                if (!bintuHeatmap) return null;
                return (
                  bintuHeatmap.loading ? (
                    <Spin key={`bintu-${panel.id}`} spinning={true} size="large" style={{ width: '40vw', height: '100%', borderRight: "1px solid #eaeaea", margin: 0 }} />
                  ) : bintuHeatmap.data ? (
                    <Heatmap
                      key={`bintu-${panel.id}`}
                      comparisonHeatmapId={null}
                      warning={warning}
                      formatNumber={formatNumber}
                      cellLineList={cellLineList}
                      geneList={bintuHeatmap.geneList}
                      cellLineName={bintuHeatmap.data?.cell_line || ''}
                      chromosomeName={bintuHeatmap.data?.chrid || ''}
                      chromosomeData={bintuHeatmap.data?.data || []}
                      currentChromosomeSequence={{ start: bintuHeatmap.data?.start_value || 0, end: bintuHeatmap.data?.end_value || 0 }}
                      setCurrentChromosomeSequence={() => { }}
                      selectedChromosomeSequence={{ start: bintuHeatmap.data?.start_value || 0, end: bintuHeatmap.data?.end_value || 0 }}
                      totalChromosomeSequences={[{ start: bintuHeatmap.data?.start_value || 0, end: bintuHeatmap.data?.end_value || 0 }]}
                      setSelectedChromosomeSequence={() => { }}
                      setChromosome3DExampleID={() => { }}
                      setChromosome3DLoading={() => { }}
                      setGeneName={() => { }}
                      geneName={''}
                      geneSize={{ start: 0, end: 0 }}
                      setChromosome3DExampleData={() => { }}
                      setGeneSize={() => { }}
                      setSelectedSphereLists={() => { }}
                      removeComparisonHeatmap={() => { }}
                      setChromosome3DCellLineName={() => { }}
                      setChromosome3DComponents={() => { }}
                      setChromosome3DComponentIndex={() => { }}
                      comparisonHeatmapList={[]}
                      isBintuMode={true}
                      bintuId={bintuHeatmap.id}
                      bintuStep={bintuHeatmap.data?.step || 30000}
                      isExampleMode={() => false}
                      fetchExistChromos3DData={() => { }}
                      exampleDataSet={{}}
                      progressPolling={() => { }}
                      updateComparisonHeatmapCellLine={() => { }}
                      comparisonHeatmapUpdateTrigger={0}
                      selectedBintuCluster={bintuHeatmap.selectedCluster}
                      setSelectedBintuCluster={(value) => updateBintuHeatmap(bintuHeatmap.id, { selectedCluster: value })}
                      tempBintuCellId={bintuHeatmap.tempCellId}
                      setTempBintuCellId={(value) => updateBintuHeatmap(bintuHeatmap.id, { tempCellId: value })}
                      handleBintuHeatmapSubmit={() => handleBintuHeatmapSubmit(bintuHeatmap.id)}
                      bintuCellClusters={bintuCellClusters}
                      bintuHeatmapLoading={bintuHeatmap.loading}
                      onCloseBintuHeatmap={() => removeBintuHeatmap(bintuHeatmap.id)}
                    />
                  ) : (
                    <Heatmap
                      key={`bintu-${panel.id}`}
                      comparisonHeatmapId={null}
                      warning={warning}
                      formatNumber={formatNumber}
                      cellLineList={cellLineList}
                      geneList={bintuHeatmap.geneList}
                      cellLineName={''}
                      chromosomeName={''}
                      chromosomeData={[]}
                      currentChromosomeSequence={{ start: 0, end: 0 }}
                      setCurrentChromosomeSequence={() => { }}
                      selectedChromosomeSequence={{ start: 0, end: 0 }}
                      totalChromosomeSequences={[{ start: 0, end: 0 }]}
                      setSelectedChromosomeSequence={() => { }}
                      setChromosome3DExampleID={() => { }}
                      setChromosome3DLoading={() => { }}
                      setGeneName={() => { }}
                      geneName={''}
                      geneSize={{ start: 0, end: 0 }}
                      setChromosome3DExampleData={() => { }}
                      setGeneSize={() => { }}
                      setSelectedSphereLists={() => { }}
                      removeComparisonHeatmap={() => { }}
                      setChromosome3DCellLineName={() => { }}
                      setChromosome3DComponents={() => { }}
                      setChromosome3DComponentIndex={() => { }}
                      comparisonHeatmapList={[]}
                      isBintuMode={true}
                      bintuId={bintuHeatmap.id}
                      bintuStep={30000}
                      isExampleMode={() => false}
                      fetchExistChromos3DData={() => { }}
                      exampleDataSet={{}}
                      progressPolling={() => { }}
                      updateComparisonHeatmapCellLine={() => { }}
                      comparisonHeatmapUpdateTrigger={0}
                      selectedBintuCluster={bintuHeatmap.selectedCluster}
                      setSelectedBintuCluster={(value) => updateBintuHeatmap(bintuHeatmap.id, { selectedCluster: value })}
                      tempBintuCellId={bintuHeatmap.tempCellId}
                      setTempBintuCellId={(value) => updateBintuHeatmap(bintuHeatmap.id, { tempCellId: value })}
                      handleBintuHeatmapSubmit={() => handleBintuHeatmapSubmit(bintuHeatmap.id)}
                      bintuCellClusters={bintuCellClusters}
                      bintuHeatmapLoading={bintuHeatmap.loading}
                      onCloseBintuHeatmap={() => removeBintuHeatmap(bintuHeatmap.id)}
                    />
                  )
                );
              }

              if (panel.type === 'gse') {
                const gseHeatmap = gseHeatmaps.find(g => g.id === panel.id);
                if (!gseHeatmap) return null;
                return (
                  gseHeatmap.loading ? (
                    <Spin key={`gse-${panel.id}`} spinning={true} size="large" style={{ width: '40vw', height: '100%', borderRight: "1px solid #eaeaea", margin: 0 }} />
                  ) : gseHeatmap.data ? (
                    <Heatmap
                      key={`gse-${panel.id}`}
                      comparisonHeatmapId={null}
                      warning={warning}
                      formatNumber={formatNumber}
                      cellLineList={cellLineList}
                      geneList={gseHeatmap.geneList}
                      cellLineName={gseHeatmap.data?.cell_line || ''}
                      chromosomeName={gseHeatmap.data?.chrid || ''}
                      chromosomeData={gseHeatmap.data?.data || []}
                      currentChromosomeSequence={{ start: gseHeatmap.data?.start_value || 0, end: gseHeatmap.data?.end_value || 0 }}
                      setCurrentChromosomeSequence={() => { }}
                      selectedChromosomeSequence={{ start: gseHeatmap.data?.start_value || 0, end: gseHeatmap.data?.end_value || 0 }}
                      totalChromosomeSequences={[{ start: gseHeatmap.data?.start_value || 0, end: gseHeatmap.data?.end_value || 0 }]}
                      setSelectedChromosomeSequence={() => { }}
                      setChromosome3DExampleID={() => { }}
                      setChromosome3DLoading={() => { }}
                      setGeneName={() => { }}
                      geneName={''}
                      geneSize={{ start: 0, end: 0 }}
                      setChromosome3DExampleData={() => { }}
                      setGeneSize={() => { }}
                      setSelectedSphereLists={() => { }}
                      removeComparisonHeatmap={() => { }}
                      setChromosome3DCellLineName={() => { }}
                      setChromosome3DComponents={() => { }}
                      setChromosome3DComponentIndex={() => { }}
                      comparisonHeatmapList={[]}
                      isGseMode={true}
                      gseId={gseHeatmap.id}
                      selectedGseOrg={gseHeatmap.selectedOrg}
                      setSelectedGseOrg={(value) => updateGseHeatmap(gseHeatmap.id, { selectedOrg: value })}
                      selectedGseCell={gseHeatmap.selectedCell}
                      setSelectedGseCell={(value) => updateGseHeatmap(gseHeatmap.id, { selectedCell: value })}
                      selectedGseCondition={gseHeatmap.selectedCondition}
                      setSelectedGseCondition={(value) => updateGseHeatmap(gseHeatmap.id, { selectedCondition: value })}
                      gseCellLines={gseCellLines}
                      gseCellIds={gseHeatmap.cellIds}
                      gseChrIds={gseChrIds}
                      tempGseOrgId={gseHeatmap.tempOrgId}
                      setTempGseOrgId={(value) => updateGseHeatmap(gseHeatmap.id, { tempOrgId: value })}
                      tempGseCellId={gseHeatmap.tempCellId}
                      setTempGseCellId={(value) => updateGseHeatmap(gseHeatmap.id, { tempCellId: value })}
                      tempGseConditionId={gseHeatmap.tempConditionId}
                      setTempGseConditionId={(value) => updateGseHeatmap(gseHeatmap.id, { tempConditionId: value })}
                      handleGseHeatmapSubmit={() => handleGseHeatmapSubmit(gseHeatmap.id)}
                      gseHeatmapLoading={gseHeatmap.loading}
                      onCloseGseHeatmap={() => removeGseHeatmap(gseHeatmap.id)}
                      updateGseHeatmapResolution={updateGseHeatmapResolution}
                      gseResolutionValue={gseHeatmap.resolution}
                      gseStartValue={gseHeatmap.startValue}
                      setGseStartValue={(value) => updateGseHeatmap(gseHeatmap.id, { startValue: value })}
                      gseEndValue={gseHeatmap.endValue}
                      setGseEndValue={(value) => updateGseHeatmap(gseHeatmap.id, { endValue: value })}
                      isExampleMode={() => false}
                      fetchExistChromos3DData={() => { }}
                      exampleDataSet={{}}
                      progressPolling={() => { }}
                      updateComparisonHeatmapCellLine={() => { }}
                      comparisonHeatmapUpdateTrigger={0}
                    />
                  ) : (
                    <Heatmap
                      key={`gse-${panel.id}`}
                      comparisonHeatmapId={null}
                      warning={warning}
                      formatNumber={formatNumber}
                      cellLineList={cellLineList}
                      geneList={gseHeatmap.geneList}
                      cellLineName={''}
                      chromosomeName={''}
                      chromosomeData={[]}
                      currentChromosomeSequence={{ start: 0, end: 0 }}
                      setCurrentChromosomeSequence={() => { }}
                      selectedChromosomeSequence={{ start: 0, end: 0 }}
                      totalChromosomeSequences={[{ start: 0, end: 0 }]}
                      setSelectedChromosomeSequence={() => { }}
                      setChromosome3DExampleID={() => { }}
                      setChromosome3DLoading={() => { }}
                      setGeneName={() => { }}
                      geneName={''}
                      geneSize={{ start: 0, end: 0 }}
                      setChromosome3DExampleData={() => { }}
                      setGeneSize={() => { }}
                      setSelectedSphereLists={() => { }}
                      removeComparisonHeatmap={() => { }}
                      setChromosome3DCellLineName={() => { }}
                      setChromosome3DComponents={() => { }}
                      setChromosome3DComponentIndex={() => { }}
                      comparisonHeatmapList={[]}
                      isGseMode={true}
                      gseId={gseHeatmap.id}
                      selectedGseOrg={gseHeatmap.selectedOrg}
                      setSelectedGseOrg={(value) => updateGseHeatmap(gseHeatmap.id, { selectedOrg: value })}
                      selectedGseCell={gseHeatmap.selectedCell}
                      setSelectedGseCell={(value) => updateGseHeatmap(gseHeatmap.id, { selectedCell: value })}
                      selectedGseCondition={gseHeatmap.selectedCondition}
                      setSelectedGseCondition={(value) => updateGseHeatmap(gseHeatmap.id, { selectedCondition: value })}
                      gseCellLines={gseCellLines}
                      gseCellIds={gseHeatmap.cellIds}
                      gseChrIds={gseChrIds}
                      tempGseOrgId={gseHeatmap.tempOrgId}
                      setTempGseOrgId={(value) => updateGseHeatmap(gseHeatmap.id, { tempOrgId: value })}
                      tempGseCellId={gseHeatmap.tempCellId}
                      setTempGseCellId={(value) => updateGseHeatmap(gseHeatmap.id, { tempCellId: value })}
                      tempGseConditionId={gseHeatmap.tempConditionId}
                      setTempGseConditionId={(value) => updateGseHeatmap(gseHeatmap.id, { tempConditionId: value })}
                      handleGseHeatmapSubmit={() => handleGseHeatmapSubmit(gseHeatmap.id)}
                      gseHeatmapLoading={gseHeatmap.loading}
                      onCloseGseHeatmap={() => removeGseHeatmap(gseHeatmap.id)}
                      updateGseHeatmapResolution={updateGseHeatmapResolution}
                      gseResolutionValue={gseHeatmap.resolution}
                      gseStartValue={gseHeatmap.startValue}
                      setGseStartValue={(value) => updateGseHeatmap(gseHeatmap.id, { startValue: value })}
                      gseEndValue={gseHeatmap.endValue}
                      setGseEndValue={(value) => updateGseHeatmap(gseHeatmap.id, { endValue: value })}
                      isExampleMode={() => false}
                      fetchExistChromos3DData={() => { }}
                      exampleDataSet={{}}
                      progressPolling={() => { }}
                      updateComparisonHeatmapCellLine={() => { }}
                      comparisonHeatmapUpdateTrigger={0}
                    />
                  )
                );
              }

              // comparison heatmap panel
              const index = panel.id;
              if (!comparisonHeatmapList.includes(index)) return null;
              return (
                <Heatmap
                  key={`comparison-${index}`}
                  comparisonHeatmapId={index}
                  warning={warning}
                  formatNumber={formatNumber}
                  setChromosome3DExampleData={setChromosome3DExampleData}
                  cellLineList={cellLineList}
                  geneList={geneList}
                  cellLineName={cellLineName}
                  chromosomeName={chromosomeName}
                  chromosomeData={[]}
                  exampleDataSet={exampleDataSet}
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
                  setGeneName={setGeneName}
                  setGeneSize={setGeneSize}
                  setSelectedSphereLists={setSelectedSphereLists}
                  removeComparisonHeatmap={removeComparisonHeatmap}
                  setChromosome3DCellLineName={setChromosome3DCellLineName}
                  updateComparisonHeatmapCellLine={updateComparisonHeatmapCellLine}
                  comparisonHeatmapUpdateTrigger={comparisonHeatmapUpdateTrigger[index]}
                  setChromosome3DComponents={setChromosome3DComponents}
                  setChromosome3DComponentIndex={setChromosome3DComponentIndex}
                  comparisonHeatmapList={comparisonHeatmapList}
                />
              );
            })}

            {/* Multiple 3D chromosome components */}
            {(Object.keys(chromosome3DExampleData).length > 0 || chromosome3DLoading || chromosome3DComponents.length > 0) && (
              <div style={{
                height: '100%',
                width: 'calc(100% - 40vw)',
                flexShrink: 0,
                position: 'relative',
                display: 'flex',
                alignItems: 'center'
              }}>
                {/* Left scroll button */}
                {showScrollButtons && (
                  <Button
                    className="chromosome3d-scroll-button"
                    icon={<LeftOutlined />}
                    onClick={scrollLeft}
                    disabled={!canScrollLeft}
                    style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      zIndex: 1000,
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      border: '1px solid #d9d9d9',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                      cursor: canScrollLeft ? 'pointer' : 'not-allowed'
                    }}
                    size="small"
                  />
                )}

                {/* Scrollable container */}
                <div
                  ref={scrollContainerRef}
                  className={`chromosome3d-scroll-container ${canScrollLeft ? 'can-scroll-left' : ''} ${canScrollRight ? 'can-scroll-right' : ''}`}
                  style={{
                    height: '100%',
                    width: '100%',
                    overflowX: chromosome3DComponents.length >= 2 ? 'auto' : 'hidden',
                    overflowY: 'hidden',
                    display: 'flex',
                    scrollBehavior: 'smooth',
                    scrollbarWidth: 'thin',
                    scrollbarHeight: 'thin'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft') {
                      scrollLeft();
                    } else if (e.key === 'ArrowRight') {
                      scrollRight();
                    }
                  }}
                  tabIndex={0}
                >
                  {/* Original 3D chromosome */}
                  <div style={{
                    width: chromosome3DComponents.length > 0 ? "49.8%" : "100%",
                    marginRight: chromosome3DComponents.length > 0 ? '0.2%' : '0%',
                    flexShrink: 0,
                    minWidth: chromosome3DComponents.length > 0 ? "49.8%" : "auto"
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
                              <InputNumber
                                className="custom-input-number"
                                style={{
                                  width: 120,
                                  borderRadius: 6
                                }}
                                size='small'
                                min={1}
                                max={5000}
                                addonAfter={<PlusOutlined onClick={tempSampleId ? addCustomKey : undefined} style={{ cursor: tempSampleId ? 'pointer' : 'not-allowed', color: tempSampleId ? 'inherit' : '#d9d9d9' }} />}
                                value={tempSampleId}
                                onChange={setTempSampleId}
                              />
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
                                  border: '1px solid #999',
                                }}
                                disabled={Object.keys(chromosome3DExampleData).length === 0 || chromosome3DLoading}
                                size="small"
                                icon={originalChromosomeDistanceDownloadSpinner ? <SyncOutlined spin /> : <DownloadOutlined />}
                              />
                            </Dropdown>
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
                              <span>Sample #{sampleId} (Ens.Rep.)</span>
                            </Tooltip>
                          )
                          : `Sample #${sampleId}`;
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
                                celllineName={cellLineName}
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
                      width: "49.8%",
                      marginRight: '0.2%',
                      flexShrink: 0,
                      minWidth: "49.8%"
                    }}>
                      <Tabs
                        size="small"
                        activeKey={component.sampleID}
                        defaultActiveKey={component.sampleID}
                        style={{ width: '100%', height: '100%' }}
                        onChange={componentSampleChange(component.id)}
                        tabBarExtraContent={
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginRight: '5px' }}>
                            <Tooltip
                              title={
                                <span style={{ color: 'black' }}>
                                  {component.cellLine ?
                                    `${cellLineList.find(cl => cl.value === component.cellLine)?.label || component.cellLine}` :
                                    'No cell line selected'
                                  }
                                </span>
                              }
                              color='white'
                              placement="topRight"
                            >
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
                            </Tooltip>
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

                {/* Right scroll button */}
                {showScrollButtons && (
                  <Button
                    className="chromosome3d-scroll-button"
                    icon={<RightOutlined />}
                    onClick={scrollRight}
                    disabled={!canScrollRight}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      zIndex: 1000,
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      border: '1px solid #d9d9d9',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                      cursor: canScrollRight ? 'pointer' : 'not-allowed'
                    }}
                    size="small"
                  />
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
