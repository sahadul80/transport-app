import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { FleetData } from '@/app/types';

interface UpdateUserStatusRequest {
  userId: string;
  isActive: boolean;
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

// PUT - Update user status
export async function PUT(request: NextRequest) {
  try {
    const { userId, isActive }: UpdateUserStatusRequest = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const data = readData();
    
    // Find user
    const userIndex = data.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Update user status
    data.users[userIndex] = {
      ...data.users[userIndex],
      isActive
    };

    if (writeData(data)) {
      const response: ApiResponse = {
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`
      };

      return NextResponse.json(response);
    } else {
      throw new Error('Failed to write data to file');
    }

  } catch (error) {
    console.error('Error updating user status:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update user status' },
      { status: 500 }
    );
  }
}