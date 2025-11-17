// app/api/user/location/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readData, writeData } from '../../../lib/demoData';
import { Location } from '../../../types';

interface UpdateLocationRequest {
  userId: string;
  location: Location;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, location }: UpdateLocationRequest = await request.json();

    if (!userId || !location) {
      return NextResponse.json(
        { error: 'User ID and location are required' },
        { status: 400 }
      );
    }

    const data = readData();
    
    // Find user in both users and admins arrays
    const userIndex = data.users.findIndex(user => user.id === userId);
    if (userIndex === -1) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Update user location (add currentLocation property if it doesn't exist)
    const user = data.users[userIndex];
    data.users[userIndex] = {
      ...user,
      currentLocation: location
    };

    const success = writeData(data);

    if (success) {
      return NextResponse.json({
        message: 'User location updated successfully',
        data: { success: true }
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to update user location' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error updating user location:', error);
    return NextResponse.json(
      { error: 'Failed to update user location' },
      { status: 500 }
    );
  }
}