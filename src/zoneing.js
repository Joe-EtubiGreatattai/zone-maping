import React, { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import "./zone.css";

const zoningCriteria = [
  { lga: "Ikeja", zone: "A", latitude: 6.6018, longitude: 3.3515 },
  { lga: "Surulere", zone: "B", latitude: 6.5003, longitude: 3.3545 },
  { lga: "Lekki", zone: "C", latitude: 6.4698, longitude: 3.5852 },
  { lga: "Yaba", zone: "D", latitude: 6.5244, longitude: 3.3792 },
  { lga: "Victoria Island", zone: "E", latitude: 6.4281, longitude: 3.4219 },
  { lga: "Ajah", zone: "F", latitude: 6.4671, longitude: 3.6038 },
];

const haversineDistance = (coords1, coords2) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(coords2.latitude - coords1.latitude);
  const dLon = toRad(coords2.longitude - coords1.longitude);
  const lat1 = toRad(coords1.latitude);
  const lat2 = toRad(coords2.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1000;
};

function Zone() {
  const [businesses, setBusinesses] = useState([]);
  const [filteredBusinesses, setFilteredBusinesses] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [availableFilters, setAvailableFilters] = useState({});
  const [activeFilters, setActiveFilters] = useState({});
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showColumnPanel, setShowColumnPanel] = useState(false);
  const [logData, setLogData] = useState({});
  const [selectedColumns, setSelectedColumns] = useState({});
  const [typeOptions, setTypeOptions] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    applyFilters();
  }, [activeFilters, businesses]);

  // Initialize selected columns when headers change
  useEffect(() => {
    if (headers.length > 0) {
      const initialSelectedColumns = {};
      headers.forEach(header => {
        initialSelectedColumns[header] = true;
      });
      setSelectedColumns(initialSelectedColumns);
    }
  }, [headers]);

  // Log the filter data whenever availableFilters changes
  useEffect(() => {
    if (Object.keys(availableFilters).length > 0) {
      console.log("Filter Categories and Values:", availableFilters);
      setLogData(availableFilters);
    }
  }, [availableFilters]);

  const applyFilters = () => {
    let filtered = [...businesses];
    
    // Apply each active filter
    Object.entries(activeFilters).forEach(([category, selectedValues]) => {
      if (selectedValues && selectedValues.length > 0) {
        filtered = filtered.filter(business => {
          // Special handling for types field which might contain multiple types
          if (category === 'types') {
            const businessTypes = business[category]?.toString().split(',').map(type => type.trim());
            return businessTypes && selectedValues.some(value => businessTypes.includes(value));
          } else if (category === 'zone') {
            // Filter by zone
            return business.zone && selectedValues.includes(business.zone);
          } else {
            // Filter by other categories
            const businessValue = business[category]?.toString();
            return businessValue && selectedValues.includes(businessValue);
          }
        });
      }
    });
    
    setFilteredBusinesses(filtered);
    console.log(`After applying filters: ${filtered.length} businesses remaining`);
  };

  const extractFilterOptions = (data, columnHeaders) => {
    const filters = {};
    
    // Get all headers except lat, lng coordinates for potential filtering
    const filterableHeaders = columnHeaders.filter(header => 
      !['lat', 'lng', 'latitude', 'longitude'].includes(header.toLowerCase())
    );
    
    console.log("Filterable headers:", filterableHeaders);
    
    // Process all types separately to handle comma-separated values
    let allTypes = [];
    if (data[0].hasOwnProperty('types')) {
      data.forEach(item => {
        if (item.types) {
          const typeArray = item.types.toString().split(',').map(type => type.trim());
          allTypes = [...allTypes, ...typeArray];
        }
      });
      // Get unique types
      const uniqueTypes = [...new Set(allTypes)].sort();
      setTypeOptions(uniqueTypes);
      console.log(`Found ${uniqueTypes.length} unique types`);
      
      // Only add if there's a reasonable number
      if (uniqueTypes.length > 0 && uniqueTypes.length < Math.min(data.length / 2, 100)) {
        filters['types'] = uniqueTypes;
      }
    }
    
    // For each other filterable column, get unique values
    filterableHeaders.forEach(header => {
      // Skip types as we've already processed it
      if (header === 'types') return;
      
      // Make sure the header exists in the data
      if (!data[0].hasOwnProperty(header)) {
        console.log(`Header ${header} not found in data, skipping`);
        return;
      }
      
      const allValues = data.map(item => item[header]?.toString()).filter(Boolean);
      const uniqueValues = [...new Set(allValues)].sort();
      
      console.log(`Header: ${header}, Unique Values Count: ${uniqueValues.length}`);
      
      // Only add as filter if there's a reasonable number of unique values
      if (uniqueValues.length > 0 && uniqueValues.length < Math.min(data.length / 2, 50)) {
        console.log(`Adding filter for ${header} with ${uniqueValues.length} options`);
        filters[header] = uniqueValues;
      }
    });
    
    return filters;
  };

  const toggleFilterValue = (category, value) => {
    console.log(`Toggling filter: ${category} - ${value}`);
    
    setActiveFilters(prev => {
      const updated = { ...prev };
      
      if (!updated[category]) {
        updated[category] = [value];
      } else if (updated[category].includes(value)) {
        updated[category] = updated[category].filter(v => v !== value);
        if (updated[category].length === 0) {
          delete updated[category];
        }
      } else {
        updated[category] = [...updated[category], value];
      }
      
      console.log("Updated active filters:", updated);
      return updated;
    });
  };

  const toggleColumnSelection = (column) => {
    setSelectedColumns(prev => ({
      ...prev,
      [column]: !prev[column]
    }));
  };

  const selectAllColumns = () => {
    const newSelection = {};
    headers.forEach(header => {
      newSelection[header] = true;
    });
    setSelectedColumns(newSelection);
  };

  const deselectAllColumns = () => {
    const newSelection = {};
    headers.forEach(header => {
      newSelection[header] = false;
    });
    setSelectedColumns(newSelection);
  };

  const clearFilters = () => {
    console.log("Clearing all filters");
    setActiveFilters({});
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    console.log(`Processing file: ${file.name}`);
    setIsProcessing(true);
    setProgress(0);

    const reader = new FileReader();
    reader.readAsBinaryString(file);
    reader.onload = (e) => {
      console.log("File loaded, parsing Excel data");
      const workbook = XLSX.read(e.target.result, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

      if (data.length === 0) {
        console.error("No data found in Excel file");
        setIsProcessing(false);
        return;
      }

      console.log(`Found ${data.length} records in Excel file`);
      
      // Capture all headers dynamically
      const allHeaders = Object.keys(data[0]);
      console.log("Detected headers:", allHeaders);
      
      // Add 'zone' to the headers if not already present
      const updatedHeaders = allHeaders.includes('zone') ? 
        [...allHeaders] : [...allHeaders, 'zone'];
      
      console.log("Updated headers with zone:", updatedHeaders);
      setHeaders(updatedHeaders);

      let processedCount = 0;
      const totalBusinesses = data.length;

      console.log("Starting to process and zone businesses");
      const updatedData = data.map((business) => {
        const { lat, lng } = business;
    
        // Ensure lat and lng are properly parsed numbers
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);
    
        if (isNaN(latitude) || isNaN(longitude)) {
            console.warn("Invalid coordinates found, marking as Unknown zone");
            return { ...business, zone: "Unknown" };
        }
    
        const nearestLGA = zoningCriteria.reduce((closest, lga) => {
            const distance = haversineDistance({ latitude, longitude }, lga);
            return distance < closest.distance ? { ...lga, distance } : closest;
        }, { distance: Infinity });
    
        processedCount++;
        setProgress(Math.floor((processedCount / totalBusinesses) * 100));
        
        return { ...business, zone: nearestLGA.zone };
      });

      setTimeout(() => {
        console.log("Processing complete, updating state");
        setBusinesses(updatedData);
        setFilteredBusinesses(updatedData);
        
        // Extract filters using the updated headers
        console.log("Extracting filter options with headers:", updatedHeaders);
        const filters = extractFilterOptions(updatedData, updatedHeaders);
        console.log("Available filters:", filters);
        setAvailableFilters(filters);
        
        setIsProcessing(false);
        setShowPopup(true);
        // Reset active filters when new file is uploaded
        setActiveFilters({});
      }, 500);
    };

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const exportToExcel = () => {
    console.log(`Exporting ${filteredBusinesses.length} businesses to Excel`);
    
    // Filter out deselected columns from each business record
    const selectedHeaders = Object.entries(selectedColumns)
      .filter(([_, selected]) => selected)
      .map(([header]) => header);
    
    const filteredData = filteredBusinesses.map(business => {
      const filteredBusiness = {};
      selectedHeaders.forEach(header => {
        filteredBusiness[header] = business[header];
      });
      return filteredBusiness;
    });
    
    // Export only the filtered businesses with selected columns
    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Updated Businesses");
    XLSX.writeFile(wb, "updated_businesses.xlsx");
  };

  const getFilterCount = () => {
    return Object.values(activeFilters).reduce((total, values) => total + values.length, 0);
  };

  const getSelectedColumnsCount = () => {
    return Object.values(selectedColumns).filter(selected => selected).length;
  };

  return (
    <div className="app-container-i">
      <h2>Business Zoning</h2>
      
      <div className="upload-container">
        <input 
          type="file" 
          accept=".xlsx,.xls" 
          onChange={handleFileUpload} 
          ref={fileInputRef} 
          id="file-upload"
          className="file-input"
        />
        <label htmlFor="file-upload" className="file-upload-btn">
          Choose Excel File
        </label>
      </div>

      {isProcessing && (
        <div className="progress-container">
          <p>Processing... {progress}%</p>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}

      {showPopup && (
        <div className="popup">
          <div className="popup-content">
            <h3>✅ Zoning Completed!</h3>
            <p>The businesses have been successfully zoned.</p>
            <button onClick={exportToExcel} className="download-btn">Download Updated File</button>
            <button className="close-btn" onClick={() => setShowPopup(false)}>Close</button>
          </div>
        </div>
      )}

      {businesses.length > 0 && (
        <div className="controls-container">
          <div className="action-buttons">
            <button onClick={exportToExcel} className="download-btn">
              <span className="download-icon">⬇️</span> 
              Download Data
            </button>
            
            <button 
              onClick={() => setShowFilterPanel(!showFilterPanel)} 
              className={`filter-toggle-btn ${showFilterPanel ? 'active' : ''}`}
            >
              <span className="filter-icon">🔍</span> 
              Filter Data {getFilterCount() > 0 && `(${getFilterCount()})`}
            </button>
            
           
          </div>
          
          {showFilterPanel && (
            <div className="filter-panel">
              <div className="filter-header">
                <h3>Filter Records</h3>
                {getFilterCount() > 0 && (
                  <button onClick={clearFilters} className="clear-filters-btn">
                    Clear All Filters
                  </button>
                )}
              </div>
              
              <div className="filter-options">
                {Object.entries(availableFilters).map(([category, values]) => (
                  <div key={category} className="filter-category">
                    <h4>{category} ({values.length} options)</h4>
                    <div className="filter-values">
                      {values.map(value => (
                        <label key={`${category}-${value}`} className="filter-checkbox">
                           {value}
                          <input
                            type="checkbox"
                            checked={activeFilters[category]?.includes(value.toString()) || false}
                            onChange={() => toggleFilterValue(category, value.toString())}
                          />
                         
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              
              {Object.keys(availableFilters).length === 0 && (
                <div className="no-filters-message">
                  <p>No suitable filter categories found. Try uploading a file with categorical data.</p>
                </div>
              )}
              
              <div className="filter-stats">
                <p>Showing {filteredBusinesses.length} of {businesses.length} records</p>
              </div>
            </div>
          )}
          
        
        </div>
      )}


      {businesses.length > 0 && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                {headers.filter(header => selectedColumns[header]).map((header, index) => (
                  <th key={index}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredBusinesses.slice(0, 100).map((b, rowIndex) => (
                <tr key={rowIndex}>
                  {headers.filter(header => selectedColumns[header]).map((header, colIndex) => (
                    <td key={colIndex}>{b[header]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {filteredBusinesses.length > 100 && (
            <p className="table-footer">Showing first 100 records of {filteredBusinesses.length} total records</p>
          )}
        </div>
      )}
    </div>
  );
}

export default Zone;