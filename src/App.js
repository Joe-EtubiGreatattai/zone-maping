import React, { useState, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import { motion } from "framer-motion";
import "leaflet/dist/leaflet.css";
import "./App.css";

// Import the logo image
import logo from "./logo.png"; // Ensure the logo.png file is in the src directory
import logo2 from "./otg logo 3.png"; 
// Fix leaflet marker icons
import markerIconPng from "leaflet/dist/images/marker-icon.png";
import markerShadowPng from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIconPng,
  shadowUrl: markerShadowPng,
});

// Zone colors
const zoneColors = {
  A: "#3498db",
  B: "#e74c3c",
  C: "#2ecc71",
  D: "#f1c40f",
  E: "#9b59b6",
  F: "#34495e",
};

// Calculate distance between two coordinates (Haversine formula)
const haversineDistance = (coords1, coords2) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(coords2[0] - coords1[0]);
  const dLon = toRad(coords2[1] - coords1[1]);
  const lat1 = toRad(coords1[0]);
  const lat2 = toRad(coords2[0]);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1000;
};

// Component to handle map functions
function MapController({ centerPosition, zoom }) {
  const map = useMap();
  
  React.useEffect(() => {
    if (centerPosition) {
      map.flyTo(centerPosition, zoom);
    }
  }, [centerPosition, zoom, map]);
  
  return null;
}

// Function to calculate coverage
const calculateCoverage = (businesses, zone) => {
  const zoneBusinesses = businesses.filter(b => b.zone === zone && b.registered);
  const allBusinessesInZone = businesses.filter(b => b.zone === zone);

  if (zoneBusinesses.length === 0) return allBusinessesInZone.length;

  const covered = new Set();
  const needed = [];

  allBusinessesInZone.forEach(business => {
    if (!covered.has(business.id)) {
      const coveringBusiness = zoneBusinesses.find(b => 
        haversineDistance([business.latitude, business.longitude], [b.latitude, b.longitude]) <= 3000
      );

      if (coveringBusiness) {
        covered.add(business.id);
      } else {
        needed.push(business);
      }
    }
  });

  return needed.length;
};

// Modal component for password input
const PasswordModal = ({ isOpen, onClose, onConfirm }) => {
  const [password, setPassword] = useState("");

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Enter Password to Unregister</h3>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="modal-buttons">
          <button onClick={() => onConfirm(password)}>Confirm</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [businesses, setBusinesses] = useState([]);
  const [activeZone, setActiveZone] = useState("A");
  const [mapCenter, setMapCenter] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAllLocations, setShowAllLocations] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedBusinessId, setSelectedBusinessId] = useState(null);
  const fileInputRef = useRef(null); // Ref for the file input
  const mapRef = useRef(null);

  const handleLogin = (e) => {
    e.preventDefault();
    // Simple login logic (replace with actual authentication logic)
    if (username === "admin" && password === "password") {
      setIsLoggedIn(true);
    } else {
      alert("Invalid credentials");
    }
  };

  const handleFileUpload = (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);
    setUploadedFiles((prevFiles) => [...prevFiles, ...newFiles]);

    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        const parsedData = jsonData.map((item, index) => ({
          id: `${file.name}-${index}`, // Unique ID based on file name and index
          name: item.name,
          address: item.address,
          latitude: parseFloat(item.latitude),
          longitude: parseFloat(item.longitude),
          category: item.category,
          zone: item.zone,
          registered: false,
        }));

        setBusinesses((prevBusinesses) => {
          // Filter out duplicates based on name, latitude, and longitude
          const newBusinesses = parsedData.filter(
            (newBusiness) =>
              !prevBusinesses.some(
                (existingBusiness) =>
                  existingBusiness.name === newBusiness.name &&
                  existingBusiness.latitude === newBusiness.latitude &&
                  existingBusiness.longitude === newBusiness.longitude
              )
          );
          return [...prevBusinesses, ...newBusinesses];
        });
      };
      reader.readAsArrayBuffer(file);
    });

    // Clear the file input after processing
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Reset the file input
    }
  };

  const registerBusiness = (businessId) => {
    setBusinesses((prev) => {
      const updatedBusinesses = prev.map((b) =>
        b.id === businessId ? { ...b, registered: true } : b
      );
      
      // Find the business that was just registered to center the map on it
      const registeredBusiness = updatedBusinesses.find(b => b.id === businessId);
      if (registeredBusiness) {
        setMapCenter([registeredBusiness.latitude, registeredBusiness.longitude]);
      }
      
      return updatedBusinesses;
    });
  };

  const handleUnregister = (businessId) => {
    setSelectedBusinessId(businessId);
    setIsPasswordModalOpen(true);
  };

  const handlePasswordConfirm = (enteredPassword) => {
    if (enteredPassword === "password") { // Replace with actual password validation logic
      setBusinesses((prev) => {
        const updatedBusinesses = prev.map((b) =>
          b.id === selectedBusinessId ? { ...b, registered: false } : b
        );
        return updatedBusinesses;
      });
    } else {
      alert("Incorrect password. Unregistering failed.");
    }
    setIsPasswordModalOpen(false);
  };

  // Calculate registration statistics
  const stats = useMemo(() => {
    if (businesses.length === 0) return { total: 0, totalRegistered: 0, zoneRegistered: 0 };
    
    const totalRegistered = businesses.filter(b => b.registered).length;
    const zoneBusinesses = businesses.filter(b => b.zone === activeZone);
    const zoneRegistered = zoneBusinesses.filter(b => b.registered).length;
    
    return {
      total: businesses.length,
      totalRegistered,
      totalPercentage: Math.round((totalRegistered / businesses.length) * 100),
      zoneTotal: zoneBusinesses.length,
      zoneRegistered,
      zonePercentage: zoneBusinesses.length > 0 ? Math.round((zoneRegistered / zoneBusinesses.length) * 100) : 0
    };
  }, [businesses, activeZone]);

  // Calculate businesses needed for full coverage
  const businessesNeeded = useMemo(() => {
    return calculateCoverage(businesses, activeZone);
  }, [businesses, activeZone]);

  const zones = ["A", "B", "C", "D", "E", "F"];
  
  // Filter businesses by zone and search term
  const filteredBusinesses = useMemo(() => {
    return businesses
      .filter(b => b.zone === activeZone)
      .filter(b => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
          b.name.toLowerCase().includes(term) ||
          b.address.toLowerCase().includes(term) ||
          b.category.toLowerCase().includes(term)
        );
      });
  }, [businesses, activeZone, searchTerm]);

  return (
    <div className="app-container">
      {!isLoggedIn && (
        <div className="login-overlay">
          <div className="login-form">
            <img src={logo2} alt="OTG Business Zone" className="logo" />
            <h2>Login</h2>
            <form onSubmit={handleLogin}>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="submit">Login</button>
            </form>
          </div>
        </div>
      )}
      <div className="sidebar">
        <img src={logo2} alt="OTG Business Zone" className="logo" />
        <h1 className="header">OTG Business Zone Map</h1>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          className="upload-button"
          multiple // Allow multiple file uploads
          ref={fileInputRef} // Attach the ref to the file input
        />
        
        {/* Display uploaded files */}
        {uploadedFiles.length > 0 && (
          <div className="uploaded-files">
            <h3>Uploaded Files:</h3>
            <ul>
              {uploadedFiles.map((file, index) => (
                <li key={index}>{file.name}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Stats Panel */}
        {businesses.length > 0 && (
          <div className="stats-panel">
            <div className="stat-item">
              <span>Total Registered:</span>
              <span className="stat-value">{stats.totalRegistered}/{stats.total} ({stats.totalPercentage}%)</span>
            </div>
            <div className="stat-item">
              <span>Zone {activeZone} Registered:</span>
              <span className="stat-value">{stats.zoneRegistered}/{stats.zoneTotal} ({stats.zonePercentage}%)</span>
            </div>
            <div className="stat-item">
              <span>Businesses Needed for Full Coverage:</span>
              <span className="stat-value">{businessesNeeded}</span>
            </div>
          </div>
        )}
        
        {/* Search Bar */}
        {businesses.length > 0 && (
          <div className="search-container">
            <input
              type="text"
              placeholder="Search businesses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button 
                className="clear-search" 
                onClick={() => setSearchTerm("")}
              >
                ×
              </button>
            )}
          </div>
        )}
        
        {/* Toggle Button */}
        <button
          className="toggle-button"
          onClick={() => setShowAllLocations(!showAllLocations)}
        >
          {showAllLocations ? "Show Selected Zone Only" : "Show All Locations"}
        </button>
        
        <div className="tabs">
          {zones.map((zone) => (
            <button
              key={zone}
              className={`tab-button ${activeZone === zone ? "active" : ""}`}
              onClick={() => setActiveZone(zone)}
              style={{ 
                backgroundColor: activeZone === zone ? zoneColors[zone] : "transparent",
                borderColor: zoneColors[zone],
                color: activeZone === zone ? "#fff" : zoneColors[zone]
              }}
            >
              Zone {zone}
            </button>
          ))}
        </div>
        
        <div className="business-list">
          {filteredBusinesses.length > 0 ? (
            filteredBusinesses.map((business) => (
              <motion.div
                key={business.id}
                className={`business-item ${business.registered ? "registered" : ""}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className="business-info">
                  <div className="business-name">{business.name}</div>
                  <div className="business-category">{business.category}</div>
                </div>
                {business.registered ? (
                  <button
                    onClick={() => handleUnregister(business.id)}
                    className="unregister-button"
                  >
                    Unregister
                  </button>
                ) : (
                  <button
                    onClick={() => registerBusiness(business.id)}
                    className="register-button"
                  >
                    Register
                  </button>
                )}
              </motion.div>
            ))
          ) : (
            <div className="no-results">
              {searchTerm ? "No businesses match your search" : "No businesses in this zone"}
            </div>
          )}
        </div>
      </div>
      <div className="map-container">
        <MapContainer
          center={[6.5244, 3.3792]}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
          ref={mapRef}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {mapCenter && <MapController centerPosition={mapCenter} zoom={16} />}
          {/* Map Markers */}
          {(showAllLocations ? businesses : businesses.filter(b => b.zone === activeZone)).map((business) => (
            <Marker
              key={business.id}
              position={[business.latitude, business.longitude]}
              icon={
                new L.Icon({
                  iconUrl: markerIconPng,
                  shadowUrl: markerShadowPng,
                  iconSize: [25, 41],
                  iconAnchor: [12, 41],
                })
              }
            >
              <Popup>
                <strong>{business.name}</strong><br />
                {business.address}<br />
                Category: {business.category}<br />
                Zone: {business.zone}<br />
                {business.registered ? "Registered ✅" : "Not Registered ❌"}<br />
                {business.registered ? (
                  <button
                    onClick={() => handleUnregister(business.id)}
                    className="unregister-button"
                  >
                    Unregister
                  </button>
                ) : (
                  <button
                    onClick={() => registerBusiness(business.id)}
                    className="register-button"
                  >
                    Register
                  </button>
                )}
              </Popup>
              {business.registered && (
                <Circle
                  center={[business.latitude, business.longitude]}
                  radius={3000} // 3km radius
                  pathOptions={{
                    color: "green",
                    fillOpacity: 0.1,
                  }}
                />
              )}
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Password Modal */}
      <PasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onConfirm={handlePasswordConfirm}
      />
    </div>
  );
}

export default App;