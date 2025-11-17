import { NextRequest, NextResponse } from 'next/server';
import { readData, writeData } from '../../../lib/demoData';
import { Driver } from '../../../types';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

interface UpdateProfileRequest {
  driverId: string;
  profileData: Partial<Driver>;
}

export async function POST(request: NextRequest) {
  try {
    const { driverId, profileData }: UpdateProfileRequest = await request.json();

    if (!driverId || !profileData) {
      return NextResponse.json(
        { error: 'Driver ID and profile data are required' },
        { status: 400 }
      );
    }

    const data = readData();
    
    const driverIndex = data.drivers.findIndex(driver => driver.id === driverId);
    if (driverIndex === -1) {
      return NextResponse.json(
        { error: 'Driver not found' },
        { status: 404 }
      );
    }

    // Update driver profile
    data.drivers[driverIndex] = {
      ...data.drivers[driverIndex],
      ...profileData
    };

    const success = writeData(data);

    if (success) {
      const response: ApiResponse<{ success: boolean }> = {
        message: 'Profile updated successfully',
        data: { success: true }
      };
      return NextResponse.json(response);
    } else {
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error updating profile:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}