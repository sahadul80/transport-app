'use client';

import { useRef, useActionState, useOptimistic, useState } from 'react';
import { Location, Journey } from '../types';

interface MapComponentProps {
  locations: Location[];
  journey?: Journey;
  onLocationAdd?: (location: Location) => void;
  onRouteChange?: (journeyId: string, newWaypoints: Location[]) => Promise<void>;
  editable?: boolean;
  journeyId?: string;
}

export default function MapComponent({ 
  locations, 
  journey,
  onLocationAdd, 
  onRouteChange, 
  editable = false,
  journeyId 
}: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Use journey waypoints if available, otherwise use locations prop
  const routeWaypoints = journey ? [journey.startLocation, ...journey.waypoints, journey.endLocation] : locations;
  
  const [routeState, changeRouteAction, isPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      if (!journeyId || !onRouteChange) return prevState;
      
      try {
        const newWaypoints: Location[] = JSON.parse(formData.get('waypoints') as string);
        await onRouteChange(journeyId, newWaypoints);
        return { success: true, error: null };
      } catch (error) {
        return { success: false, error: 'Failed to update route' };
      }
    },
    { success: false, error: null }
  );

  const [optimisticWaypoints, setOptimisticWaypoints] = useOptimistic(
    routeWaypoints,
    (currentWaypoints, newWaypoints: Location[]) => newWaypoints
  );

  const handleMapClick = (e: React.MouseEvent) => {
    if (!editable) return;
    
    if (isEditing && selectedLocation !== null) {
      // Update existing waypoint
      const updatedLocation: Location = {
        ...optimisticWaypoints[selectedLocation],
        lat: e.clientX, // In real implementation, convert to actual map coordinates
        lng: e.clientY,
        address: `Updated Location ${selectedLocation + 1}`
      };
      
      const newWaypoints = [...optimisticWaypoints];
      newWaypoints[selectedLocation] = updatedLocation;
      
      // Optimistically update waypoints
      setOptimisticWaypoints(newWaypoints);
      
      // Submit route change
      if (journeyId && onRouteChange) {
        const formData = new FormData();
        formData.set('waypoints', JSON.stringify(newWaypoints));
        changeRouteAction(formData);
      }
      
      setIsEditing(false);
      setSelectedLocation(null);
    } else if (!isEditing && onLocationAdd) {
      // Add new location (for non-journey contexts)
      const newLocation: Location = {
        lat: e.clientX,
        lng: e.clientY,
        address: `New Location ${optimisticWaypoints.length + 1}`
      };
      
      // Optimistically update waypoints
      setOptimisticWaypoints([...optimisticWaypoints, newLocation]);
      onLocationAdd(newLocation);
    }
  };

  const handleWaypointSelect = (index: number) => {
    if (!editable || !journey) return;
    
    setSelectedLocation(index);
    setIsEditing(true);
  };

  const handleWaypointRemove = (index: number) => {
    if (!editable || !journey) return;
    
    // Cannot remove start or end locations in journey context
    if (index === 0 || index === optimisticWaypoints.length - 1) {
      alert('Cannot remove start or end destinations of a journey');
      return;
    }
    
    const newWaypoints = optimisticWaypoints.filter((_, i) => i !== index);
    
    // Optimistically update waypoints
    setOptimisticWaypoints(newWaypoints);
    
    // Submit route change
    if (journeyId && onRouteChange) {
      const formData = new FormData();
      formData.set('waypoints', JSON.stringify(newWaypoints.slice(1, -1))); // Exclude start/end for waypoints
      changeRouteAction(formData);
    }
    
    if (selectedLocation === index) {
      setSelectedLocation(null);
      setIsEditing(false);
    }
  };

  const handleDestinationChange = (newDestination: Location) => {
    if (!editable || !journey) return;
    
    const newWaypoints = [...optimisticWaypoints];
    newWaypoints[newWaypoints.length - 1] = newDestination; // Update end location
    
    // Optimistically update waypoints
    setOptimisticWaypoints(newWaypoints);
    
    // Submit route change
    if (journeyId && onRouteChange) {
      const formData = new FormData();
      formData.set('waypoints', JSON.stringify(newWaypoints.slice(1, -1))); // Exclude start/end for waypoints
      changeRouteAction(formData);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setSelectedLocation(null);
  };

  const handleWaypointDrag = (index: number, e: React.MouseEvent) => {
    if (!editable || !isEditing || selectedLocation !== index) return;
    
    e.stopPropagation();
    
    const updatedLocation: Location = {
      ...optimisticWaypoints[index],
      lat: e.clientX,
      lng: e.clientY,
      address: `Dragged Location ${index + 1}`
    };
    
    const newWaypoints = [...optimisticWaypoints];
    newWaypoints[index] = updatedLocation;
    
    setOptimisticWaypoints(newWaypoints);
  };

  const handleDragEnd = () => {
    if (!editable || selectedLocation === null || !journeyId || !onRouteChange) return;
    
    // Submit final route change after drag ends
    const formData = new FormData();
    formData.set('waypoints', JSON.stringify(
      journey ? optimisticWaypoints.slice(1, -1) : optimisticWaypoints
    ));
    changeRouteAction(formData);
  };

  // Render journey info if available
  const renderJourneyInfo = () => {
    if (!journey) return null;

    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <h3 className="font-semibold text-blue-800 mb-2">Journey Information</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="font-medium">User:</span> {journey.userName}
          </div>
          <div>
            <span className="font-medium">Driver:</span> {journey.driverName}
          </div>
          <div>
            <span className="font-medium">Car:</span> {journey.carModel}
          </div>
          <div>
            <span className="font-medium">Status:</span> 
            <span className={`ml-1 px-2 py-1 rounded text-xs ${
              journey.status === 'completed' ? 'bg-green-100 text-green-800' :
              journey.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
              journey.status === 'requested' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {journey.status}
            </span>
          </div>
          <div className="col-span-2">
            <span className="font-medium">Distance:</span> {(journey.distance / 1000).toFixed(1)} km
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {renderJourneyInfo()}
      
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {journey ? 'Journey Route' : 'Location Map'}
        </h3>
        {isEditing && (
          <div className="flex space-x-2">
            <span className="text-sm text-blue-600">
              Editing: {selectedLocation !== null ? 
                selectedLocation === 0 ? 'Start Location' :
                selectedLocation === optimisticWaypoints.length - 1 ? 'End Location' :
                `Waypoint ${selectedLocation}` 
                : ''}
            </span>
            <button
              onClick={cancelEditing}
              className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div 
        ref={mapRef} 
        className="w-full h-96 bg-gray-200 rounded-lg relative cursor-crosshair"
        onClick={handleMapClick}
        onMouseUp={handleDragEnd}
      >
        <div className="absolute inset-0 p-4">
          <p className="text-gray-600 mb-2">
            {isEditing 
              ? "Click on map to move selected destination" 
              : editable ? "Click on map to add destinations or select existing ones" : "Map View"}
          </p>
          
          {/* Render waypoints as draggable markers */}
          {optimisticWaypoints.map((loc, index) => {
            const isStart = index === 0;
            const isEnd = index === optimisticWaypoints.length - 1;
            const isWaypoint = !isStart && !isEnd;
            
            return (
              <div 
                key={index}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${
                  selectedLocation === index 
                    ? 'bg-blue-500 border-2 border-white shadow-lg' 
                    : isStart ? 'bg-green-500 border-2 border-white' :
                      isEnd ? 'bg-red-500 border-2 border-white' :
                      'bg-yellow-500 border border-white'
                } rounded-full w-6 h-6 cursor-move flex items-center justify-center text-white text-xs font-bold`}
                style={{
                  left: `${loc.lat}px`,
                  top: `${loc.lng}px`
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (editable && journey) {
                    handleWaypointSelect(index);
                  }
                }}
                onMouseDown={(e) => {
                  if (editable && journey) {
                    handleWaypointSelect(index);
                  }
                }}
                onMouseMove={(e) => {
                  if (e.buttons === 1 && isEditing && selectedLocation === index) {
                    handleWaypointDrag(index, e);
                  }
                }}
                title={`${isStart ? 'Start: ' : isEnd ? 'End: ' : 'Waypoint: '}${loc.address}`}
              >
                {isStart ? 'S' : isEnd ? 'E' : index}
              </div>
            );
          })}
          
          {/* Render connection lines between waypoints */}
          {optimisticWaypoints.length > 1 && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {optimisticWaypoints.slice(0, -1).map((loc, index) => (
                <line
                  key={index}
                  x1={loc.lat}
                  y1={loc.lng}
                  x2={optimisticWaypoints[index + 1].lat}
                  y2={optimisticWaypoints[index + 1].lng}
                  stroke="#3B82F6"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
              ))}
            </svg>
          )}
        </div>

        {isPending && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-4 rounded-lg">
              <p className="text-gray-700">Updating route...</p>
            </div>
          </div>
        )}
      </div>

      {/* Waypoints list with controls */}
      <div className="space-y-2">
        <h4 className="font-medium">
          {journey ? 'Route Waypoints:' : 'Locations:'}
        </h4>
        {optimisticWaypoints.map((loc, index) => {
          const isStart = index === 0;
          const isEnd = index === optimisticWaypoints.length - 1;
          const isWaypoint = !isStart && !isEnd;
          
          return (
            <div 
              key={index}
              className={`flex items-center justify-between p-3 border rounded-lg ${
                selectedLocation === index ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-sm ${
                  isStart ? 'bg-green-500' : 
                  isEnd ? 'bg-red-500' : 
                  selectedLocation === index ? 'bg-blue-500' : 'bg-yellow-500'
                }`}>
                  {isStart ? 'S' : isEnd ? 'E' : index}
                </div>
                <div>
                  <p className="font-medium">
                    {isStart ? 'Start: ' : isEnd ? 'End: ' : `Waypoint ${index}: `}
                    {loc.address}
                  </p>
                  <p className="text-sm text-gray-500">
                    Coordinates: {loc.lat.toFixed(1)}, {loc.lng.toFixed(1)}
                  </p>
                </div>
              </div>
              
              {editable && journey && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleWaypointSelect(index)}
                    className={`px-3 py-1 text-sm rounded ${
                      selectedLocation === index 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    } ${(isStart || isEnd) ? 'cursor-not-allowed opacity-50' : ''}`}
                    disabled={isStart || isEnd}
                    title={isStart || isEnd ? 'Start and end points cannot be edited' : 'Edit waypoint'}
                  >
                    {selectedLocation === index ? 'Editing...' : 'Edit'}
                  </button>
                  {isWaypoint && (
                    <button
                      onClick={() => handleWaypointRemove(index)}
                      className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                      disabled={isPending}
                    >
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        
        {optimisticWaypoints.length === 0 && (
          <p className="text-gray-500 text-center py-4">
            No locations added. {editable && 'Click on the map to add locations.'}
          </p>
        )}
      </div>

      {routeState.error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {routeState.error}
        </div>
      )}

      {routeState.success && !isPending && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          Route updated successfully!
        </div>
      )}
    </div>
  );
}