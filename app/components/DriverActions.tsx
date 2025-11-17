'use client';

import { useActionState, useOptimistic } from 'react';
import { Car, Journey } from '../types';

interface DriverActionsProps {
  car: Car;
  pendingJourneys: Journey[];
  onCarStatusUpdate: (carId: string, updates: Partial<Car>) => Promise<{ success: boolean }>;
  onJourneyAccept: (journeyId: string) => Promise<{ success: boolean }>;
}

export default function DriverActions({ 
  car, 
  pendingJourneys, 
  onCarStatusUpdate, 
  onJourneyAccept 
}: DriverActionsProps) {
  // Optimistic updates for car status
  const [optimisticCar, updateOptimisticCar] = useOptimistic(
    car,
    (currentCar, updates: Partial<Car>) => ({
      ...currentCar,
      ...updates
    })
  );

  // Action for car status updates
  const [statusState, updateStatusAction, isStatusPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      const field = formData.get('field') as string;
      const value = formData.get('value') as string;
      
      try {
        const updates = { [field]: value === 'true' };
        updateOptimisticCar(updates);
        await onCarStatusUpdate(optimisticCar.id, updates);
        return { success: true, error: null };
      } catch (error) {
        return { success: false, error: 'Failed to update status' };
      }
    },
    { success: false, error: null }
  );

  return (
    <>
      {/* Car Status */}
      <div className="bg-white p-4 rounded-lg shadow-md">
        <h3 className="font-bold mb-4">Car Status</h3>
        <div className="space-y-3">
          <form action={updateStatusAction}>
            <input type="hidden" name="field" value="isClean" />
            <input type="hidden" name="value" value={(!optimisticCar.isClean).toString()} />
            <div className="flex justify-between items-center">
              <span>Cleanliness:</span>
              <button 
                type="submit"
                disabled={isStatusPending}
                className={`px-3 py-1 rounded ${
                  optimisticCar.isClean ? 'bg-green-500' : 'bg-red-500'
                } text-white disabled:opacity-50`}
              >
                {optimisticCar.isClean ? 'Clean' : 'Not Clean'}
                {isStatusPending && '...'}
              </button>
            </div>
          </form>

          <form action={updateStatusAction}>
            <input type="hidden" name="field" value="needsServicing" />
            <input type="hidden" name="value" value={(!optimisticCar.needsServicing).toString()} />
            <div className="flex justify-between items-center">
              <span>Servicing:</span>
              <button 
                type="submit"
                disabled={isStatusPending}
                className={`px-3 py-1 rounded ${
                  optimisticCar.needsServicing ? 'bg-red-500' : 'bg-green-500'
                } text-white disabled:opacity-50`}
              >
                {optimisticCar.needsServicing ? 'Requested' : 'Request Service'}
                {isStatusPending && '...'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Journey Requests */}
      <div className="bg-white p-4 rounded-lg shadow-md">
        <h3 className="font-bold mb-4">Journey Requests</h3>
        {pendingJourneys.length === 0 ? (
          <p className="text-gray-600">No pending requests</p>
        ) : (
          pendingJourneys.map(journey => (
            <JourneyRequestItem 
              key={journey.id} 
              journey={journey} 
              onAccept={onJourneyAccept}
            />
          ))
        )}
      </div>
    </>
  );
}

function JourneyRequestItem({ journey, onAccept }: { 
  journey: Journey; 
  onAccept: (journeyId: string) => Promise<{ success: boolean }>;
}) {
  const [state, acceptAction, isPending] = useActionState(
    async (prevState: any) => {
      try {
        await onAccept(journey.id);
        return { success: true, error: null };
      } catch (error) {
        return { success: false, error: 'Failed to accept journey' };
      }
    },
    { success: false, error: null }
  );

  return (
    <div className="border-b py-2">
      <p>From: {journey.startLocation.address}</p>
      <p>To: {journey.endLocation.address}</p>
      <form action={acceptAction}>
        <button 
          type="submit"
          disabled={isPending}
          className="bg-blue-500 text-white px-3 py-1 rounded mt-2 disabled:bg-gray-400"
        >
          {isPending ? 'Accepting...' : 'Accept'}
        </button>
      </form>
    </div>
  );
}