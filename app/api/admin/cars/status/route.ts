import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { FleetData, Car } from '@/app/types';

interface UpdateCarStatusRequest {
  carId: string;
  status: Car['status'];
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

// PUT - Update car status
export async function PUT(request: NextRequest) {
  try {
    const { carId, status }: UpdateCarStatusRequest = await request.json();
    
    if (!carId || !status) {
      return NextResponse.json(
        { error: 'Car ID and status are required' },
        { status: 400 }
      );
    }

    const data = readData();
    
    // Find car
    const carIndex = data.cars.findIndex(c => c.id === carId);
    if (carIndex === -1) {
      return NextResponse.json(
        { error: 'Car not found' },
        { status: 404 }
      );
    }

    // Update car status
    data.cars[carIndex] = {
      ...data.cars[carIndex],
      status
    };

    // Update system stats
    if (data.systemStats) {
      data.systemStats.availableCars = data.cars.filter(c => c.status === 'available').length;
    }

    if (writeData(data)) {
      const response: ApiResponse = {
        message: `Car status updated to ${status}`
      };

      return NextResponse.json(response);
    } else {
      throw new Error('Failed to write data to file');
    }

  } catch (error) {
    console.error('Error updating car status:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update car status' },
      { status: 500 }
    );
  }
}