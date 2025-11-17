import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Journey, FleetData } from '@/app/types';

interface DropoffRequest {
  journeyId: string;
  reason?: string;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
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

export async function POST(request: NextRequest) {
  try {
    const { journeyId, reason }: DropoffRequest = await request.json();
    
    if (!journeyId) {
      return NextResponse.json(
        { error: 'Journey ID is required' },
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

    // Check if journey is in progress
    if (journey.status !== 'in-progress') {
      return NextResponse.json(
        { error: 'Drop-off can only be requested for journeys in progress' },
        { status: 400 }
      );
    }

    // Update journey status to completed
    const updatedJourney: Journey = {
      ...journey,
      status: 'completed',
      endTime: new Date().toISOString()
    };

    data.journeys[journeyIndex] = updatedJourney;

    // Update system stats
    if (data.systemStats) {
      data.systemStats.activeJourneys = Math.max(0, (data.systemStats.activeJourneys || 0) - 1);
    }

    if (writeData(data)) {
      const response: ApiResponse<Journey> = {
        message: reason ? `Drop-off requested: ${reason}` : 'Drop-off request sent to driver successfully',
        data: updatedJourney
      };

      return NextResponse.json(response);
    } else {
      throw new Error('Failed to write data to file');
    }

  } catch (error) {
    console.error('Error requesting drop-off:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to request drop-off' },
      { status: 500 }
    );
  }
}