import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { FleetData, Journey, Car, Driver, User } from '@/app/types';

interface AssignJourneyRequest {
  journeyId: string;
  carId: string;
  driverId: string;
}

interface ApiResponse {
  message?: string;
  error?: string;
}

const dataFilePath = path.join(process.cwd(), 'app', 'data', 'demoData.json');

const readData = (): FleetData => {
  try {
    const fileContents = fs.readFileSync(dataFilePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    console.error('Error reading data file:', error);
    return { 
      users: [], 
      drivers: [], 
      cars: [], 
      locations: [], 
      journeys: [], 
      leaveRequests: [], 
      systemStats: {
        totalUsers: 0,
        totalDrivers: 0,
        totalCars: 0,
        activeJourneys: 0,
        pendingRequests: 0,
        availableCars: 0,
        driversOnLeave: 0,
        monthlyDistance: 0
      } 
    };
  }
};

const writeData = (data: FleetData): boolean => {
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing data file:', error);
    return false;
  }
};

// POST - Assign car and driver to journey
export async function POST(request: NextRequest) {
  try {
    const { journeyId, carId, driverId }: AssignJourneyRequest = await request.json();
    
    if (!journeyId || !carId || !driverId) {
      return NextResponse.json(
        { error: 'Journey ID, Car ID, and Driver ID are required' },
        { status: 400 }
      );
    }

    const data = readData();
    
    // Find journey
    const journeyIndex = data.journeys.findIndex(j => j.id === journeyId);
    if (journeyIndex === -1) {
      return NextResponse.json(
        { error: 'Journey not found' },
        { status: 404 }
      );
    }

    const journey = data.journeys[journeyIndex];

    // Check if journey is in requested status
    if (journey.status !== 'requested') {
      return NextResponse.json(
        { error: 'Can only assign car and driver to requested journeys' },
        { status: 400 }
      );
    }

    // Find car
    const car = data.cars.find(c => c.id === carId);
    if (!car) {
      return NextResponse.json(
        { error: 'Car not found' },
        { status: 404 }
      );
    }

    // Check if car is available
    if (car.status !== 'available') {
      return NextResponse.json(
        { error: 'Car is not available' },
        { status: 400 }
      );
    }

    // Find driver
    const driver = data.drivers.find(d => d.id === driverId);
    if (!driver) {
      return NextResponse.json(
        { error: 'Driver not found' },
        { status: 404 }
      );
    }

    // Check if driver is available
    if (driver.onLeave) {
      return NextResponse.json(
        { error: 'Driver is on leave' },
        { status: 400 }
      );
    }

    // Update car status
    const carIndex = data.cars.findIndex(c => c.id === carId);
    if (carIndex !== -1) {
      data.cars[carIndex] = {
        ...data.cars[carIndex],
        status: 'in-use'
      };
    }

    // Update journey with assignment
    const updatedJourney: Journey = {
      ...journey,
      carId,
      driverId,
      driverName: driver.name,
      carModel: car.model,
      status: 'in-progress'
    };

    data.journeys[journeyIndex] = updatedJourney;

    // Update system stats
    if (data.systemStats) {
      data.systemStats.pendingRequests = data.journeys.filter(j => j.status === 'requested').length;
      data.systemStats.activeJourneys = data.journeys.filter(j => j.status === 'in-progress').length;
      data.systemStats.availableCars = data.cars.filter(c => c.status === 'available').length;
    }

    if (writeData(data)) {
      const response: ApiResponse = {
        message: 'Car and driver assigned successfully'
      };

      return NextResponse.json(response);
    } else {
      throw new Error('Failed to write data to file');
    }

  } catch (error) {
    console.error('Error assigning car and driver:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to assign car and driver' },
      { status: 500 }
    );
  }
}