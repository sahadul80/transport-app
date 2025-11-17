import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Types
interface Location {
  lat: number;
  lng: number;
  address: string;
}

interface DistanceMetrics {
  day: number;
  month: number;
  year: number;
}

interface BaseUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'user' | 'driver' | 'admin';
  isActive: boolean;
}

interface User extends BaseUser {
  role: 'user' | 'admin';
  designation: string;
  department: string;
  carsUsed: string[];
  totalDistance: DistanceMetrics;
}

interface Driver extends BaseUser {
  role: 'driver';
  dob: string;
  licenseNo: string;
  licenseExpiry: string;
  onLeave: boolean;
  salary: number;
  totalLeave: number;
  remainingLeave: number;
  currentLocation: Location;
  totalTravelledDistance: DistanceMetrics;
}

interface Car {
  id: string;
  model: string;
  regNo: string;
  drivers: string[];
  users: string[];
  status: 'available' | 'in-use' | 'servicing' | 'cleaning';
  isClean: boolean;
  needsServicing: boolean;
  totalDistanceTravelled: DistanceMetrics;
  currentLocation: Location;
}

interface Journey {
  id: string;
  carId: string;
  driverId: string;
  userId: string;
  userName: string;
  driverName: string;
  carModel: string;
  startLocation: Location;
  endLocation: Location;
  waypoints: Location[];
  status: 'requested' | 'in-progress' | 'completed' | 'cancelled';
  startTime: string;
  endTime: string | null;
  distance: number;
  rating: number | null;
  routeChanges: any[];
  estimatedDuration: number;
}

interface LeaveRequest {
  id: string;
  driverId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
}

interface SystemStats {
  totalUsers: number;
  totalDrivers: number;
  totalCars: number;
  activeJourneys: number;
  pendingRequests: number;
  availableCars: number;
  driversOnLeave: number;
  monthlyDistance: number;
}

interface FleetData {
  users: User[];
  drivers: Driver[];
  cars: Car[];
  locations: Location[];
  journeys: Journey[];
  leaveRequests: LeaveRequest[];
  systemStats: SystemStats;
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
    throw new Error('Failed to load data');
  }
};

export async function GET() {
  try {
    const data = readData();
    
    // Remove passwords from users and drivers before sending
    const sanitizedData = {
      ...data,
      users: data.users.map(({ password, ...user }) => user),
      drivers: data.drivers.map(({ password, ...driver }) => driver),
      cars: data.cars,
      locations: data.locations,
      journeys: data.journeys,
      leaveRequests: data.leaveRequests,
      systemStats: data.systemStats
    };

    const response: ApiResponse<typeof sanitizedData> = {
      data: sanitizedData
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching data:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}

// POST endpoint to update specific data (for admins)
export async function POST(request: NextRequest) {
  try {
    const { action, data: updateData } = await request.json();

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    const currentData = readData();

    switch (action) {
      case 'update-system-stats':
        if (updateData.systemStats) {
          currentData.systemStats = {
            ...currentData.systemStats,
            ...updateData.systemStats
          };
        }
        break;

      case 'update-data':
        // Replace entire data with provided data
        if (updateData) {
          try {
            fs.writeFileSync(dataFilePath, JSON.stringify(updateData, null, 2));
            const response: ApiResponse<{ updated: boolean }> = {
              message: 'Data updated successfully',
              data: { updated: true }
            };
            return NextResponse.json(response);
          } catch (error) {
            console.error('Error writing data file:', error);
            return NextResponse.json(
              { error: 'Failed to write data to file' },
              { status: 500 }
            );
          }
        } else {
          return NextResponse.json(
            { error: 'No data provided for update' },
            { status: 400 }
          );
        }

      case 'reset-data':
        // In a real app, you might want to restore from a backup
        // For demo purposes, we'll just reload the original file
        break;

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }

    // Write updated data for other actions (update-system-stats, reset-data)
    try {
      fs.writeFileSync(dataFilePath, JSON.stringify(currentData, null, 2));
      
      const response: ApiResponse<{ updated: boolean }> = {
        message: 'Data updated successfully',
        data: { updated: true }
      };

      return NextResponse.json(response);
    } catch (error) {
      console.error('Error writing data file:', error);
      return NextResponse.json(
        { error: 'Failed to write data to file' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error updating data:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update data' },
      { status: 500 }
    );
  }
}