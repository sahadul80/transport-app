import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Journey, SystemStats, FleetData } from '@/app/types';

interface CancelRequest {
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
    const { journeyId, reason }: CancelRequest = await request.json();
    
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

    // Check if journey can be cancelled
    if (journey.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot cancel a completed journey' },
        { status: 400 }
      );
    }

    if (journey.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Journey is already cancelled' },
        { status: 400 }
      );
    }

    // Update journey status
    data.journeys[journeyIndex] = {
      ...journey,
      status: 'cancelled',
      endTime: new Date().toISOString()
    };

    // Update system stats
    if (data.systemStats) {
      if (journey.status === 'requested') {
        data.systemStats.pendingRequests = Math.max(0, (data.systemStats.pendingRequests || 0) - 1);
      }
      if (journey.status === 'in-progress') {
        data.systemStats.activeJourneys = Math.max(0, (data.systemStats.activeJourneys || 0) - 1);
      }
    }

    if (writeData(data)) {
      const response: ApiResponse<Journey> = {
        message: reason ? `Journey cancelled: ${reason}` : 'Journey cancelled successfully',
        data: data.journeys[journeyIndex]
      };

      return NextResponse.json(response);
    } else {
      throw new Error('Failed to write data to file');
    }

  } catch (error) {
    console.error('Error cancelling journey:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to cancel journey' },
      { status: 500 }
    );
  }
}