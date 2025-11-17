'use client';

import { useEffect, useRef, useActionState, useOptimistic } from 'react';
import { AppLocation, RouteChange } from '../types';

interface MapComponentProps {
  locations: AppLocation[];
  onLocationAdd?: (location: AppLocation) => void;
  onRouteChange?: (journeyId: string, newWaypoints: AppLocation[]) => Promise<void>;
  editable?: boolean;
  journeyId?: string;
}

export default function MapComponent({ 
  locations, 
  onLocationAdd, 
  onRouteChange, 
  editable = false,
  journeyId 
}: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  
  // React 19 useActionState for route changes
  const [routeState, changeRouteAction, isPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      if (!journeyId || !onRouteChange) return prevState;
      
      try {
        const newWaypoints: AppLocation[] = JSON.parse(formData.get('waypoints') as string);
        await onRouteChange(journeyId, newWaypoints);
        return { success: true, error: null };
      } catch (error) {
        return { success: false, error: 'Failed to update route' };
      }
    },
    { success: false, error: null }
  );

  // React 19 useOptimistic for immediate UI updates
  const [optimisticLocations, setOptimisticLocations] = useOptimistic(
    locations,
    (currentLocations, newLocations: AppLocation[]) => newLocations
  );

  const handleMapClick = (e: React.MouseEvent) => {
    if (!editable || !onLocationAdd) return;
    
    const newLocation: AppLocation = {
      lat: e.clientX,
      lng: e.clientY,
      address: `New Location ${optimisticLocations.length + 1}`
    };
    
    // Optimistically update locations
    setOptimisticLocations([...optimisticLocations, newLocation]);
    onLocationAdd(newLocation);
  };

  return (
    <div className="space-y-4">
      <div 
        ref={mapRef} 
        className="w-full h-96 bg-gray-200 rounded-lg relative"
        onClick={handleMapClick}
      >
        <div className="p-4">
          <p className="text-gray-600">Map View (React 19 Optimistic Updates)</p>
          {optimisticLocations.map((loc, index) => (
            <div key={index} className="text-sm bg-white p-2 m-1 rounded">
              {loc.address}
            </div>
          ))}
        </div>
        {isPending && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <p className="text-white">Updating route...</p>
          </div>
        )}
      </div>

      {routeState.error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {routeState.error}
        </div>
      )}
    </div>
  );
}