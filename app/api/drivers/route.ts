import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Driver, Journey, Car, LeaveRequest, Location, DistanceMetrics } from '../../types';

const dataFilePath = path.join(process.cwd(), 'app', 'data', 'demoData.json');

interface DriverProfileData {
  name: string;
  email: string;
  licenseNo: string;
  licenseExpiry: string;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

const readData = () => {
  try {
    const fileContents = fs.readFileSync(dataFilePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    console.error('Error reading data file:', error);
    throw new Error('Failed to load data');
  }
};

const writeData = (data: any) => {
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing data file:', error);
    throw new Error('Failed to save data');
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get('driverId');
    
    if (!driverId) {
      return NextResponse.json(
        { error: 'Driver ID is required' },
        { status: 400 }
      );
    }

    const data = readData();
    
    // Find driver data
    const driver = data.drivers?.find((d: Driver) => d.id === driverId);
    if (!driver) {
      return NextResponse.json(
        { error: 'Driver not found' },
        { status: 404 }
      );
    }

    // Get driver's assigned journeys
    const journeys = data.journeys?.filter((j: Journey) => j.driverId === driverId) || [];
    
    // Add user information to journeys
    const journeysWithUserInfo = journeys.map((journey: Journey) => {
      const journeyUser = data.users?.find((u: any) => u.id === journey.userId);
      return {
        ...journey,
        userName: journeyUser?.name || 'Unknown User',
        userDesignation: journeyUser?.designation || ''
      };
    });

    // Get driver's assigned cars
    const cars = data.cars?.filter((c: Car) => 
      c.drivers?.includes(driverId)
    ) || [];

    // Get driver's leave requests
    const leaveRequests = data.leaveRequests?.filter((lr: LeaveRequest) => 
      lr.driverId === driverId
    ) || [];

    const response: ApiResponse<{
      driver: Driver;
      journeys: Journey[];
      cars: Car[];
      leaveRequests: LeaveRequest[];
    }> = {
      data: {
        driver,
        journeys: journeysWithUserInfo,
        cars,
        leaveRequests
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching driver data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch driver data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, driverId, ...payload } = await request.json();

    if (!action || !driverId) {
      return NextResponse.json(
        { error: 'Action and driver ID are required' },
        { status: 400 }
      );
    }

    const data = readData();
    let updated = false;

    switch (action) {
      case 'update-location':
        const { location } = payload as { location: Location };
        const driverIndex = data.drivers.findIndex((d: Driver) => d.id === driverId);
        if (driverIndex !== -1) {
          data.drivers[driverIndex].currentLocation = location;
          updated = writeData(data);
        }
        break;

      case 'update-profile':
        const { profileData } = payload as { profileData: Partial<Driver> };
        const profileDriverIndex = data.drivers.findIndex((d: Driver) => d.id === driverId);
        if (profileDriverIndex !== -1) {
          data.drivers[profileDriverIndex] = {
            ...data.drivers[profileDriverIndex],
            ...profileData
          };
          updated = writeData(data);
        }
        break;

      case 'update-journey-status':
        const { journeyId, status } = payload as { journeyId: string; status: Journey['status'] };
        const journeyIndex = data.journeys.findIndex((j: Journey) => j.id === journeyId && j.driverId === driverId);
        if (journeyIndex !== -1) {
          data.journeys[journeyIndex].status = status;
          if (status === 'completed') {
            data.journeys[journeyIndex].endTime = new Date().toISOString();
          } else if (status === 'in-progress') {
            data.journeys[journeyIndex].startTime = new Date().toISOString();
          }
          updated = writeData(data);
        }
        break;

      case 'submit-leave-request':
        const { startDate, endDate, reason } = payload as { 
          startDate: string; 
          endDate: string; 
          reason: string;
        };
        
        const newLeaveRequest: LeaveRequest = {
          id: Date.now().toString(),
          driverId,
          startDate,
          endDate,
          reason,
          status: 'pending',
          submittedAt: new Date().toISOString()
        };

        if (!data.leaveRequests) {
          data.leaveRequests = [];
        }
        data.leaveRequests.push(newLeaveRequest);
        updated = writeData(data);
        break;

      case 'update-distance-metrics':
        const { distanceMetrics } = payload as { distanceMetrics: Partial<DistanceMetrics> };
        const distanceDriverIndex = data.drivers.findIndex((d: Driver) => d.id === driverId);
        if (distanceDriverIndex !== -1) {
          data.drivers[distanceDriverIndex].totalTravelledDistance = {
            ...data.drivers[distanceDriverIndex].totalTravelledDistance,
            ...distanceMetrics
          };
          updated = writeData(data);
        }
        break;

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }

    if (updated) {
      const response: ApiResponse<{ success: boolean }> = {
        message: 'Operation completed successfully',
        data: { success: true }
      };
      return NextResponse.json(response);
    } else {
      return NextResponse.json(
        { error: 'Failed to update data' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in driver API:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}