import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Journey, FleetData, Location } from '@/app/types';

interface RouteChangeRequest {
  journeyId: string;
  newWaypoint: string;
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
    const { journeyId, newWaypoint, reason }: RouteChangeRequest = await request.json();
    
    if (!journeyId || !newWaypoint) {
      return NextResponse.json(
        { error: 'Journey ID and new waypoint are required' },
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
        { error: 'Route changes can only be requested for journeys in progress' },
        { status: 400 }
      );
    }

    // Create new waypoint location
    const newWaypointLocation: Location = {
      lat: 0, // You might want to geocode this in a real application
      lng: 0,
      address: newWaypoint
    };

    // Update journey with new waypoint
    const updatedJourney: Journey = {
      ...journey,
      waypoints: [...journey.waypoints, newWaypointLocation],
      routeChanges: [
        ...(journey.routeChanges || []),
        {
          type: 'waypoint_added',
          timestamp: new Date().toISOString(),
          waypoint: newWaypointLocation,
          reason: reason
        }
      ]
    };

    data.journeys[journeyIndex] = updatedJourney;

    if (writeData(data)) {
      const response: ApiResponse<Journey> = {
        message: 'Route change request sent to driver successfully',
        data: updatedJourney
      };

      return NextResponse.json(response);
    } else {
      throw new Error('Failed to write data to file');
    }

  } catch (error) {
    console.error('Error requesting route change:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to request route change' },
      { status: 500 }
    );
  }
}