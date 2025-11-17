'use client';

import { useActionState, useOptimistic } from 'react';
import { Car, AppLocation, Journey } from '../types';

interface JourneyRequestProps {
  availableCars: Car[];
  onRequestSubmit: (carId: string, destination: AppLocation) => Promise<Journey>;
}

export default function JourneyRequest({ availableCars, onRequestSubmit }: JourneyRequestProps) {
  // React 19 useActionState for form handling
  const [state, submitAction, isPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      const carId = formData.get('carId') as string;
      const destination = formData.get('destination') as string;
      
      if (!carId || !destination) {
        return { error: 'Please select a car and enter destination' };
      }

      try {
        const destinationLocation: AppLocation = {
          lat: 0,
          lng: 0,
          address: destination
        };
        
        await onRequestSubmit(carId, destinationLocation);
        return { success: true, error: null };
      } catch (error) {
        return { success: false, error: 'Failed to request journey' };
      }
    },
    { success: false, error: null }
  );

  // React 19 useOptimistic for instant UI updates
  const [optimisticCars, setOptimisticCars] = useOptimistic(
    availableCars,
    (currentCars, updatedCar: Car) => 
      currentCars.map(car => 
        car.id === updatedCar.id ? updatedCar : car
      )
  );

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Request Journey (React 19)</h2>
      
      <form action={submitAction}>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Select Car</label>
          <select 
            name="carId"
            className="w-full p-2 border rounded-md"
            disabled={isPending}
          >
            <option value="">Choose a car</option>
            {optimisticCars.map(car => (
              <option key={car.id} value={car.id}>
                {car.model} - {car.regNo} {car.status !== 'available' && '(Unavailable)'}
              </option>
            ))}
          </select>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Destination</label>
          <input
            type="text"
            name="destination"
            placeholder="Enter destination address"
            className="w-full p-2 border rounded-md"
            disabled={isPending}
          />
        </div>

        {state.error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {state.error}
          </div>
        )}

        {state.success && (
          <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            Journey requested successfully!
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isPending ? 'Requesting...' : 'Request Journey'}
        </button>
      </form>
    </div>
  );
}