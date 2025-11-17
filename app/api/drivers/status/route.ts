import { NextRequest, NextResponse } from 'next/server';
import { readData, findDriverById, findJourneysByDriverId, findCarsByDriverId, findLeaveRequestsByDriverId } from '../../../lib/demoData';
import { Driver, Journey, Car, LeaveRequest, User, Admin } from '../../../types';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

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
    const driver = findDriverById(data.drivers, driverId);
    if (!driver) {
      return NextResponse.json(
        { error: 'Driver not found' },
        { status: 404 }
      );
    }

    // Get driver's assigned journeys
    const journeys = findJourneysByDriverId(data.journeys, driverId);
    
    // Add user information to journeys
    const journeysWithUserInfo = journeys.map((journey: Journey) => {
      const journeyUser = [...data.users, ...data.drivers].find((u: User | Admin | Driver) => u.id === journey.userId);
      if( journeyUser ) {
        return {
          ...journey,
          userName: journeyUser?.name || 'Unknown User',
          userDesignation: 'designation' in journeyUser ? journeyUser.designation : ''
        };
      } else {
        return journey;
      }
    });

    // Get driver's assigned cars
    const cars = findCarsByDriverId(data.cars, driverId);

    // Get driver's leave requests
    const leaveRequests = findLeaveRequestsByDriverId(data.leaveRequests, driverId);

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