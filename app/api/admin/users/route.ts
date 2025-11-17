import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { User, Admin, FleetData } from '@/app/types';

interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  designation: string;
  department: string;
  role: string;
}

interface UpdateUserStatusRequest {
  userId: string;
  isActive: boolean;
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

// POST - Create new user
export async function POST(request: NextRequest) {
  try {
    const { name, email, password, designation, department, role }: CreateUserRequest = await request.json();
    
    if (!name || !email || !password || !designation || !department) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    const data = readData();
    
    // Check if user already exists
    const existingUser = data.users.find(u => u.email === email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Create new user
    const newUser: User = {
      id: `user-${Date.now()}`,
      email,
      password, // In a real app, this should be hashed
      name,
      role: 'user',
      designation,
      department,
      carsUsed: [],
      totalDistance: { day: 0, month: 0, year: 0 },
      isActive: true
    };

    data.users.push(newUser);

    // Update system stats
    if (data.systemStats) {
      data.systemStats.totalUsers = data.users.length;
    }

    if (writeData(data)) {
      // Return user without password
      const { password: _, ...userWithoutPassword } = newUser;
      
      const response: ApiResponse<typeof userWithoutPassword> = {
        message: 'User created successfully',
        data: userWithoutPassword
      };

      return NextResponse.json(response);
    } else {
      throw new Error('Failed to write data to file');
    }

  } catch (error) {
    console.error('Error creating user:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}