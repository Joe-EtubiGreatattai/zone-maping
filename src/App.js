import React, { useState, useRef, useMemo, useEffect } from "react";
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
  A: "#007BFF",  // Brighter blue
  B: "#FF0000",  // Pure red
  C: "#00C853",  // Bright green
  D: "#FFC107",  // Vibrant yellow
  E: "#8E24AA",  // Deep purple
  F: "#212121",  // Darker gray/black
};

// Helper function to include x-api-key in headers
const fetchWithApiKey = async (url, options = {}) => {
  const headers = {
    ...options.headers,
    'x-api-key': '26a3281bfc65b39527447691941d6a707357a1278b1b2ec91742faec9de53ac8',
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
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
  const [showLogsPopup, setShowLogsPopup] = useState(false);
  const [logs, setLogs] = useState([]); // Default to an empty array
  const [logSearch, setLogSearch] = useState(""); // New state for search query
  const [radius, setRadius] = useState(3000); // State for radius
  const [userRole, setUserRole] = useState(null);

  const mapRef = useRef(null);

  // Base URL for the API
  const API_BASE_URL = "http://api-dev.onthegoafrica.com/zone";

  // Fetch businesses on app load or when logged in
  useEffect(() => {   
    if (isLoggedIn) {
      fetchBusinesses();
    }
  }, [isLoggedIn]);

  const fetchBusinesses = async () => {
    try {
      const response = await fetchWithApiKey(`${API_BASE_URL}/businesses`);
      const data = await response.json();
      if (response.ok) {
        setBusinesses(data.businesses);
      } else {
        console.error('Error fetching businesses:', data.message);
      }
    } catch (error) {
      console.error('Fetch businesses error:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const payload = { username, password };
      const response = await fetchWithApiKey(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok) {
        setIsLoggedIn(true);
        setUserRole(data.role); // Set the user role
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const canUploadFiles = userRole === 'admin' || userRole === 'superadmin';
  const canVerifyBusinesses = userRole === 'admin' || userRole === 'superadmin';
  const canViewLogs = userRole === 'superadmin';

  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    Array.from(files).forEach(file => formData.append('files', file));

    try {
      const response = await fetchWithApiKey(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        // Check if data.businesses is defined and is an array
        if (Array.isArray(data.businesses)) {
          setBusinesses(prev => [...prev, ...data.businesses]);
          setUploadedFiles(prev => [...prev, ...files]);
        } else {
          console.error('Invalid response: businesses array is missing or not iterable');
        }
      } else {
        alert('File upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleVerify = async (businessId) => {
    try {
      const response = await fetchWithApiKey(`${API_BASE_URL}/verify/${businessId}`, {
        method: 'POST',
      });
      const data = await response.json();
      if (response.ok) {
        setBusinesses((prev) =>
          prev.map((b) =>
            b.id === businessId ? { ...b, verified: !b.verified } : b
          )
        );
      } else {
        alert('Verification failed');
      }
    } catch (error) {
      console.error('Verification error:', error);
    }
  };

  const registerBusiness = async (businessId) => {
    try {
      const response = await fetchWithApiKey(`${API_BASE_URL}/register/${businessId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ radius, username }), // Send the radius and username to the backend
      });
      const data = await response.json();
      if (response.ok) {
        setBusinesses(prev => prev.map(b => b.id === businessId ? { ...b, registered: true, radius } : b));
        const registeredBusiness = data.business;
        setMapCenter([registeredBusiness.latitude, registeredBusiness.longitude]);
      } else {
        alert('Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
    }
  };

  const handleUnregister = (businessId) => {
    setSelectedBusinessId(businessId);
    setIsPasswordModalOpen(true);
  };

  const handlePasswordConfirm = async (enteredPassword) => {
    try {
      const response = await fetchWithApiKey(`${API_BASE_URL}/unregister/${selectedBusinessId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: enteredPassword }),
      });
      const data = await response.json();
      if (response.ok) {
        setBusinesses(prev => prev.map(b => b.id === selectedBusinessId ? { ...b, registered: false } : b));
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error('Unregister error:', error);
    }
    setIsPasswordModalOpen(false);
  };

  const fetchLogs = async () => {
    try {
      const response = await fetchWithApiKey(`${API_BASE_URL}/logs`);
      const data = await response.json();

      if (response.ok) {
        let logEntries = [];

        if (Array.isArray(data.logs)) {
          logEntries = data.logs;
        } else if (typeof data.logs === "string") {
          logEntries = data.logs.split("\n").map(log => {
            const match = log.match(/\[(.*?)\]\sSequelize:\sExecuting\s\(default\):\s(.*)/);
            return match ? { timestamp: match[1], query: match[2] } : { timestamp: "Unknown", query: log };
          });
        }

        setLogs(logEntries);
      } else {
        console.error("Error fetching logs:", data.message);
        setLogs([]); // Ensure logs is always an array
      }
    } catch (error) {
      console.error("Fetch logs error:", error);
      setLogs([]); // Prevent `null` issues
    }
  };

  // Filter logs based on search query
  const filteredLogs = Array.isArray(logs) ? logs.filter(
    (log) =>
      log.timestamp.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.query.toLowerCase().includes(logSearch.toLowerCase())
  ) : [];

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

        {canUploadFiles && (
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="upload-button"
            multiple
            ref={fileInputRef}
          />
        )}

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

        <div className="stats-panel">
          <div className="stat-item">
            <span>Radius (meters):</span>
            <input
              type="number"
              value={radius}
              onChange={(e) => setRadius(parseInt(e.target.value, 10))}
              min="100"
              max="10000"
              style={{ width: '60px' }}
            />
          </div>
        </div>

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

        {canViewLogs && (
          <button
            className="toggle-button"
            onClick={() => {
              setShowLogsPopup(true);
              fetchLogs();
            }}
          >
            View Action Logs
          </button>
        )}

        {showLogsPopup && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>Action Logs</h3>
              <input
                type="text"
                placeholder="Search logs..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="log-search-input"
              />
              <div className="logs-table-container">
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>User</th>
                      <th>Query</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.length > 0 ? (
                      filteredLogs.map((log, index) => (
                        <tr key={index} className={index % 2 === 0 ? "even-row" : "odd-row"}>
                          <td>{log.timestamp}</td>
                          <td>{log.username}</td>
                          <td>{log.query}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3" style={{ textAlign: "center", color: "gray" }}>
                          No matching logs found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <button onClick={() => setShowLogsPopup(false)} className="close-button">
                Close
              </button>
            </div>
          </div>
        )}

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
                  <div className="business-status">
                    {business.registered ? "Registered ✅" : "Not Registered ❌"}
                    {business.verified && " | Verified ✅"}
                  </div>
                </div>
                {business.registered ? (
                  <>
                    <button
                      onClick={() => handleUnregister(business.id)}
                      className="unregister-button"
                    >
                      Unregister
                    </button>
                    {canVerifyBusinesses && (
                      <button
                        onClick={() => handleVerify(business.id)}
                        className={`verify-button ${business.verified ? "verified" : ""}`}
                      >
                        {business.verified ? "Unverify" : "Verify"}
                      </button>
                    )}
                  </>
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
                {business.verified && "Verified ✅"}<br />
                {business.registered ? (
                  <>
                    <button
                      onClick={() => handleUnregister(business.id)}
                      className="unregister-button"
                    >
                      Unregister
                    </button>
                    {canVerifyBusinesses && (
                      <button
                        onClick={() => handleVerify(business.id)}
                        className={`verify-button ${business.verified ? "verified" : ""}`}
                      >
                        {business.verified ? "Unverify" : "Verify"}
                      </button>
                    )}
                  </>
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
                  radius={business.radius || 3000}
                  pathOptions={{
                    color: zoneColors[business.zone],
                    fillOpacity: 0.1,
                  }}
                />
              )}
            </Marker>
          ))}
        </MapContainer>
      </div>

      <PasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onConfirm={handlePasswordConfirm}
      />
    </div>
  );
}

export default App;