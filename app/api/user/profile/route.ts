import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Car, Journey, LeaveRequest, SystemStats, User, Driver, Admin } from '@/app/types';

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

interface FleetData {
  users: (User | Admin)[];
  drivers: Driver[];
  cars: Car[];
  locations: Location[];
  journeys: Journey[];
  leaveRequests: LeaveRequest[];
  systemStats: SystemStats;
}

interface ProfileUpdateRequest {
  id?: string;
  email?: string;
  name: string;
  designation: string;
  department: string;
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
    // Return empty structure if file doesn't exist or is corrupted
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

// Helper function to find user by ID or email
const findUser = (data: FleetData, identifier: string): User | Driver | Admin | null => {
  // Check in users array
  const user = data.users.find(u => u.id === identifier || u.email === identifier);
  if (user) return user as User | Admin;
  
  // Check in drivers array
  const driver = data.drivers.find(d => d.id === identifier || d.email === identifier);
  if (driver) return driver;
  
  return null;
};

// Helper function to update user in the correct array
const updateUserInData = (data: FleetData, identifier: string, updates: Partial<User | Driver | Admin>): boolean => {
  // Try to update in users array
  const userIndex = data.users.findIndex(u => u.id === identifier || u.email === identifier);
  if (userIndex !== -1) {
    const existing = data.users[userIndex];
    // Apply only User-specific updates when updating users array
    const merged = { ...existing, ...(updates as Partial<User | Admin>) };
    data.users[userIndex] = merged as (User | Admin);
    return true;
  }
  
  // Try to update in drivers array
  const driverIndex = data.drivers.findIndex(d => d.id === identifier || d.email === identifier);
  if (driverIndex !== -1) {
    const existingDriver = data.drivers[driverIndex];
    // Apply only Driver-specific updates when updating drivers array
    const mergedDriver = { ...existingDriver, ...(updates as Partial<Driver>) };
    data.drivers[driverIndex] = mergedDriver;
    return true;
  }
  
  return false;
};

export async function PUT(request: NextRequest) {
  try {
    const { id, email, name, designation, department }: ProfileUpdateRequest = await request.json();
    
    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Validate designation and department
    if (!designation || !department) {
      return NextResponse.json(
        { error: 'Designation and department are required' },
        { status: 400 }
      );
    }

    const data = readData();
    
    // Determine identifier (prefer ID over email for more reliable lookup)
    const identifier = id || email;
    
    // Check if user exists
    const existingUser = findUser(data, identifier);
    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if email is being changed and if new email already exists
    if (email && email !== existingUser.email) {
      const emailExists = findUser(data, email);
      if (emailExists && emailExists.id !== existingUser.id) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 409 }
        );
      }
    }

    // Prepare updates
    const updates: Partial<User | Driver | Admin> = {
      name,
      email: email || existingUser.email, // Use new email if provided, otherwise keep existing
      ...(existingUser.role !== 'driver' && {
        designation,
        department
      })
      // Note: Drivers don't have designation/department in our data structure
    };

    // Update user
    const updateSuccess = updateUserInData(data, identifier, updates);
    
    if (!updateSuccess) {
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      );
    }

    // Write updated data
    if (writeData(data)) {
      // Return updated user (without password)
      const updatedUser = findUser(data, email || existingUser.email);
      if (!updatedUser) {
        throw new Error('Failed to retrieve updated user');
      }

      const { password, ...userWithoutPassword } = updatedUser;
      
      const response: ApiResponse<typeof userWithoutPassword> = {
        message: 'Profile updated successfully',
        data: userWithoutPassword
      };

      return NextResponse.json(response);
    } else {
      throw new Error('Failed to write data to file');
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

// GET endpoint to retrieve user profile
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const email = searchParams.get('email');

    if (!id && !email) {
      return NextResponse.json(
        { error: 'User ID or email is required' },
        { status: 400 }
      );
    }

    const data = readData();
    const identifier = id || email;
    
    if (!identifier) {
      return NextResponse.json(
        { error: 'Invalid identifier' },
        { status: 400 }
      );
    }

    const user = findUser(data, identifier);
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    
    const response: ApiResponse<typeof userWithoutPassword> = {
      data: userWithoutPassword
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

// POST endpoint for additional profile operations (like avatar upload, etc.)
export async function POST(request: NextRequest) {
  try {
    const { action, ...payload } = await request.json();

    switch (action) {
      case 'validate-email':
        const { email } = payload;
        if (!email) {
          return NextResponse.json(
            { error: 'Email is required' },
            { status: 400 }
          );
        }

        const data = readData();
        const existingUser = findUser(data, email);
        
        return NextResponse.json({
          exists: !!existingUser,
          available: !existingUser
        });

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error in profile POST:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}