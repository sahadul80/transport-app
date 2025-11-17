import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { FleetData } from '@/app/types';

interface UpdateDriverStatusRequest {
  driverId: string;
  onLeave: boolean;
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

// PUT - Update driver leave status
export async function PUT(request: NextRequest) {
  try {
    const { driverId, onLeave }: UpdateDriverStatusRequest = await request.json();
    
    if (!driverId) {
      return NextResponse.json(
        { error: 'Driver ID is required' },
        { status: 400 }
      );
    }

    const data = readData();
    
    // Find driver
    const driverIndex = data.drivers.findIndex(d => d.id === driverId);
    if (driverIndex === -1) {
      return NextResponse.json(
        { error: 'Driver not found' },
        { status: 404 }
      );
    }

    // Update driver status
    data.drivers[driverIndex] = {
      ...data.drivers[driverIndex],
      onLeave
    };

    // Update system stats
    if (data.systemStats) {
      data.systemStats.driversOnLeave = data.drivers.filter(d => d.onLeave).length;
    }

    if (writeData(data)) {
      const response: ApiResponse = {
        message: `Driver ${onLeave ? 'set on leave' : 'activated'} successfully`
      };

      return NextResponse.json(response);
    } else {
      throw new Error('Failed to write data to file');
    }

  } catch (error) {
    console.error('Error updating driver status:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update driver status' },
      { status: 500 }
    );
  }
}