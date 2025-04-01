import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Polyline, Popup, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Component to handle fitting the map to the route bounds
const FitBoundsToRoute = ({ route }) => {
    const map = useMap();

    useEffect(() => {
        if (route.length > 1) {
            const bounds = L.latLngBounds(
                route.map(business => [business.latitude, business.longitude])
            );
            map.fitBounds(bounds, {
                padding: [50, 50],
                maxZoom: 18,
                animate: true
            });
            
            if (bounds.getNorthEast().distanceTo(bounds.getSouthWest()) < 1000) {
                map.setZoom(16);
            }
        } else if (route.length === 1) {
            map.setView([route[0].latitude, route[0].longitude], 16);
        }
    }, [route, map]);

    return null;
};

const RoutePlanner = ({ businesses, onClose }) => {
    const [startBusiness, setStartBusiness] = useState(null);
    const [numBusinesses, setNumBusinesses] = useState(10);
    const [route, setRoute] = useState([]);
    const [routeDistance, setRouteDistance] = useState(0);
    const [isPlanning, setIsPlanning] = useState(false);
    const [currentStopIndex, setCurrentStopIndex] = useState(0);
    const [completedStops, setCompletedStops] = useState([]);
    const mapRef = useRef(null);

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

    const generateRoute = () => {
        if (!startBusiness) return;

        setIsPlanning(true);

        let availableBusinesses = [...businesses].filter(b => b.id !== startBusiness.id);
        const newRoute = [startBusiness];
        let totalDistance = 0;
        let currentLocation = [startBusiness.latitude, startBusiness.longitude];

        for (let i = 1; i < numBusinesses && availableBusinesses.length > 0; i++) {
            let closestBusiness = null;
            let closestDistance = Infinity;

            availableBusinesses.forEach(business => {
                const businessLocation = [business.latitude, business.longitude];
                const distance = haversineDistance(currentLocation, businessLocation);

                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestBusiness = business;
                }
            });

            if (closestBusiness) {
                newRoute.push(closestBusiness);
                totalDistance += closestDistance;
                currentLocation = [closestBusiness.latitude, closestBusiness.longitude];
                availableBusinesses = availableBusinesses.filter(b => b.id !== closestBusiness.id);
            } else {
                break;
            }
        }

        setRoute(newRoute);
        setRouteDistance(totalDistance);
        setCurrentStopIndex(0);
        setCompletedStops([]);
        setIsPlanning(false);
    };

    useEffect(() => {
        setRoute([]);
        setRouteDistance(0);
        setCurrentStopIndex(0);
        setCompletedStops([]);
    }, [startBusiness]);

    const getRouteCoordinates = () => {
        return route.map(business => [business.latitude, business.longitude]);
    };

    const handleBusinessSelect = (e) => {
        const selectedId = e.target.value;
        if (!selectedId) {
            setStartBusiness(null);
            return;
        }
        const selected = businesses.find(b => b.id === parseInt(selectedId));
        if (selected) setStartBusiness(selected);
    };

    const handleRegister = (businessId) => {
        // In a real app, you would call your API to register the business here
        // For now, we'll just simulate the registration
        
        // Mark as completed
        setCompletedStops(prev => [...prev, businessId]);
        
        // Move to next stop if available
        if (currentStopIndex < route.length - 1) {
            setCurrentStopIndex(prev => prev + 1);
        }
    };

    const handleVerify = (businessId) => {
        // In a real app, you would call your API to verify the business here
        // For now, we'll just simulate the verification
        
        // Mark as completed
        setCompletedStops(prev => [...prev, businessId]);
        
        // Move to next stop if available
        if (currentStopIndex < route.length - 1) {
            setCurrentStopIndex(prev => prev + 1);
        }
    };

    const createNumberedIcon = (number, isCurrent, isCompleted) => {
        return new L.DivIcon({
            className: isCurrent ? 'current-marker' : isCompleted ? 'completed-marker' : 'numbered-marker',
            html: `<div class="marker-number">${number}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 30]
        });
    };

    const startIcon = new L.DivIcon({
        className: 'start-marker',
        html: '<div class="marker-start">Start</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 30]
    });

    const endIcon = new L.DivIcon({
        className: 'end-marker',
        html: '<div class="marker-end">End</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 30]
    });

    return (
        <div className="route-planner-modal">
            <div className="route-planner-header">
                <h3>Route Planner</h3>
                <button onClick={onClose} className="close-route-btn">
                    ×
                </button>
            </div>

            <div className="route-planner-content">
                <div className="route-controls">
                    <div className="form-group">
                        <label>Starting Business:</label>
                        <select
                            value={startBusiness?.id || ""}
                            onChange={handleBusinessSelect}
                        >
                            <option value="">Select a business</option>
                            {businesses.map(business => (
                                <option key={business.id} value={String(business.id)}>
                                    {business.name} (Zone {business.zone})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Number of Businesses to Visit:</label>
                        <input
                            type="number"
                            min="1"
                            max="20"
                            value={numBusinesses}
                            onChange={(e) => {
                                const val = parseInt(e.target.value) || 1;
                                const value = Math.min(20, Math.max(1, val));
                                setNumBusinesses(value);
                            }}
                        />
                    </div>

                    <button
                        onClick={generateRoute}
                        disabled={!startBusiness || isPlanning}
                        className="generate-route-btn"
                    >
                        {isPlanning ? "Planning Route..." : "Generate Route"}
                    </button>
                </div>

                <div className="route-map-container">
                    <MapContainer
                        center={startBusiness ? [startBusiness.latitude, startBusiness.longitude] : [6.5244, 3.3792]}
                        zoom={13}
                        style={{ height: '400px', width: '100%', borderRadius: '8px' }}
                        ref={mapRef}
                    >
                        <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        />
                        
                        <FitBoundsToRoute route={route} />
                        
                        {route.length > 1 && (
                            <Polyline
                                positions={getRouteCoordinates()}
                                color="#3b82f6"
                                weight={5}
                                opacity={0.8}
                                lineCap="round"
                                lineJoin="round"
                                dashArray="5, 5"
                            />
                        )}

                        {route.map((business, index) => {
                            const position = [business.latitude, business.longitude];
                            const isFirst = index === 0;
                            const isLast = index === route.length - 1;
                            const isCurrent = index === currentStopIndex;
                            const isCompleted = completedStops.includes(business.id);

                            return (
                                <Marker
                                    key={`route-marker-${business.id}`}
                                    position={position}
                                    icon={isFirst ? startIcon : 
                                          isLast ? endIcon : 
                                          createNumberedIcon(index + 1, isCurrent, isCompleted)}
                                    zIndexOffset={1000}
                                >
                                    <Popup>
                                        <div>
                                            <strong>{isFirst ? 'START' : isLast ? 'END' : `STOP ${index + 1}`}: {business.name}</strong><br />
                                            Zone: {business.zone}<br />
                                            Address: {business.address}<br />
                                            Status: {isCompleted ? 'Completed' : isCurrent ? 'Current Stop' : 'Pending'}<br />
                                            {index > 0 && (
                                                <>
                                                    Distance from previous: {(
                                                        haversineDistance(
                                                            [route[index - 1].latitude, route[index - 1].longitude],
                                                            position
                                                        ) / 1000
                                                    ).toFixed(2)} km<br />
                                                </>
                                            )}
                                            {index < route.length - 1 && (
                                                <>
                                                    Distance to next: {(
                                                        haversineDistance(
                                                            position,
                                                            [route[index + 1].latitude, route[index + 1].longitude]
                                                        ) / 1000
                                                    ).toFixed(2)} km
                                                </>
                                            )}
                                        </div>
                                        {isCurrent && !isCompleted && (
                                            <div className="route-actions">
                                                <button 
                                                    onClick={() => handleRegister(business.id)}
                                                    className="register-button"
                                                >
                                                    Register
                                                </button>
                                                <button 
                                                    onClick={() => handleVerify(business.id)}
                                                    className="verify-button"
                                                >
                                                    Verify
                                                </button>
                                            </div>
                                        )}
                                    </Popup>
                                </Marker>
                            );
                        })}
                    </MapContainer>
                </div>

                {route.length > 0 && (
                    <div className="route-info">
                        <h4>Route Summary</h4>
                        <div className="route-stats">
                            <div>
                                <span>Total Distance:</span>
                                <span>{(routeDistance / 1000).toFixed(2)} km</span>
                            </div>
                            <div>
                                <span>Number of Stops:</span>
                                <span>{route.length}</span>
                            </div>
                            <div>
                                <span>Completed Stops:</span>
                                <span>{completedStops.length}/{route.length}</span>
                            </div>
                            <div>
                                <span>Current Stop:</span>
                                <span>{currentStopIndex + 1} of {route.length}</span>
                            </div>
                        </div>

                        <div className="route-steps">
                            <h5>Route Steps:</h5>
                            <ol>
                                {route.map((business, index) => {
                                    const distanceFromPrevious = index > 0
                                        ? haversineDistance(
                                            [route[index - 1].latitude, route[index - 1].longitude],
                                            [business.latitude, business.longitude]
                                        ) / 1000
                                        : 0;

                                    const isCurrent = index === currentStopIndex;
                                    const isCompleted = completedStops.includes(business.id);

                                    return (
                                        <li 
                                            key={business.id}
                                            className={`${isCurrent ? 'current-step' : ''} ${isCompleted ? 'completed-step' : ''}`}
                                        >
                                            <strong>{index + 1}. {business.name}</strong> (Zone {business.zone})
                                            {index > 0 && (
                                                <span className="step-distance">
                                                    - {distanceFromPrevious.toFixed(2)} km from previous
                                                </span>
                                            )}
                                            {isCurrent && <span className="current-indicator"> (Current)</span>}
                                            {isCompleted && <span className="completed-indicator"> ✓</span>}
                                        </li>
                                    );
                                })}
                            </ol>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RoutePlanner;