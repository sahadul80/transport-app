import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Car, Driver, LeaveRequest, SystemStats, User, Admin, Journey } from '@/app/types';

// Types
interface Location {
  lat: number;
  lng: number;
  address: string;
}

interface FleetData {
  users: (User | Admin)[];
  drivers: Driver[];
  cars: Car[];
  locations: Location[];
  journeys: Journey[];
  leaveRequests: LeaveRequest[];
  systemStats: SystemStats;
}

interface JourneyRequest {
  userId: string;
  destination: string;
  startLocation: Location;
  notes?: string;
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
    const { userId, destination, startLocation, notes }: JourneyRequest = await request.json();
    
    if (!userId || !destination || !startLocation) {
      return NextResponse.json(
        { error: 'User ID, destination, and start location are required' },
        { status: 400 }
      );
    }

    const data = readData();
    
    // Find user
    const user = data.users.find(u => u.id === userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user already has a requested journey
    const existingRequest = data.journeys.find(j => 
      j.userId === userId && j.status === 'requested'
    );
    
    if (existingRequest) {
      return NextResponse.json(
        { error: 'You already have a pending journey request' },
        { status: 409 }
      );
    }

    // Create new journey
    const newJourney: Journey = {
        id: `journey-${Date.now()}`,
        carId: "",
        driverId: "",
        userId: userId,
        userName: user.name,
        driverName: "",
        carModel: "",
        startLocation: startLocation,
        endLocation: {
            lat: 0, // Will be set by admin
            lng: 0,
            address: destination
        },
        waypoints: [],
        status: 'requested',
        startTime: new Date().toISOString(),
        endTime: null,
        distance: 0,
        rating: null,
        routeChanges: [],
        estimatedDuration: 0,
        userDesignation: undefined
    };

    // Add to journeys
    data.journeys.push(newJourney);

    // Update system stats
    if (data.systemStats) {
      data.systemStats.pendingRequests = (data.systemStats.pendingRequests || 0) + 1;
    }

    if (writeData(data)) {
      const response: ApiResponse<Journey> = {
        message: 'Journey request submitted successfully. Waiting for admin allocation.',
        data: newJourney
      };

      return NextResponse.json(response);
    } else {
      throw new Error('Failed to write data to file');
    }

  } catch (error) {
    console.error('Error creating journey request:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create journey request' },
      { status: 500 }
    );
  }
}