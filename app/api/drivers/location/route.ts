import { NextRequest, NextResponse } from 'next/server';
import { readData, writeData, findDriverById } from '../../../lib/demoData';
import { Location } from '../../../types';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

interface UpdateLocationRequest {
  driverId: string;
  location: Location;
}

export async function POST(request: NextRequest) {
  try {
    const { driverId, location }: UpdateLocationRequest = await request.json();

    if (!driverId || !location) {
      return NextResponse.json(
        { error: 'Driver ID and location are required' },
        { status: 400 }
      );
    }

    const data = readData();
    
    const driverIndex = data.drivers.findIndex(driver => driver.id === driverId);
    if (driverIndex === -1) {
      return NextResponse.json(
        { error: 'Driver not found' },
        { status: 404 }
      );
    }

    // Update driver location
    data.drivers[driverIndex].currentLocation = location;

    // Also update car location if driver is currently assigned to a car
    const assignedCars = data.cars.filter(car => car.drivers.includes(driverId));
    assignedCars.forEach(car => {
      const carIndex = data.cars.findIndex(c => c.id === car.id);
      if (carIndex !== -1) {
        data.cars[carIndex].currentLocation = location;
      }
    });

    const success = writeData(data);

    if (success) {
      const response: ApiResponse<{ success: boolean }> = {
        message: 'Location updated successfully',
        data: { success: true }
      };
      return NextResponse.json(response);
    } else {
      return NextResponse.json(
        { error: 'Failed to update location' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error updating location:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update location' },
      { status: 500 }
    );
  }
}