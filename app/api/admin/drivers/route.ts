import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Driver, FleetData } from '@/app/types';

interface CreateDriverRequest {
  name: string;
  email: string;
  password: string;
  dob: string;
  licenseNo: string;
  licenseExpiry: string;
  salary: number;
  totalLeave: number;
  role: 'driver';
}

interface UpdateDriverRequest {
  id: string;
  name: string;
  email: string;
  dob: string;
  licenseNo: string;
  licenseExpiry: string;
  salary: number;
  totalLeave: number;
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

// POST - Create new driver
export async function POST(request: NextRequest) {
  try {
    const { name, email, password, dob, licenseNo, licenseExpiry, salary, totalLeave }: CreateDriverRequest = await request.json();
    
    if (!name || !email || !password || !dob || !licenseNo || !licenseExpiry) {
      return NextResponse.json(
        { error: 'All required fields must be filled' },
        { status: 400 }
      );
    }

    const data = readData();
    
    // Check if driver already exists
    const existingDriver = data.drivers.find(d => d.email === email);
    if (existingDriver) {
      return NextResponse.json(
        { error: 'Driver with this email already exists' },
        { status: 409 }
      );
    }

    // Check if license number already exists
    const existingLicense = data.drivers.find(d => d.licenseNo === licenseNo);
    if (existingLicense) {
      return NextResponse.json(
        { error: 'Driver with this license number already exists' },
        { status: 409 }
      );
    }

    // Create new driver
    const newDriver: Driver = {
      id: `driver-${Date.now()}`,
      email,
      password, // In a real app, this should be hashed
      name,
      role: 'driver',
      dob,
      licenseNo,
      licenseExpiry,
      onLeave: false,
      salary: salary || 0,
      totalLeave: totalLeave || 20,
      remainingLeave: totalLeave || 20,
      currentLocation: {
        lat: 23.8103,
        lng: 90.4125,
        address: "Paramount BD Head Office, Dhaka"
      },
      totalTravelledDistance: { day: 0, month: 0, year: 0 },
      isActive: true
    };

    data.drivers.push(newDriver);

    // Update system stats
    if (data.systemStats) {
      data.systemStats.totalDrivers = data.drivers.length;
    }

    if (writeData(data)) {
      // Return driver without password
      const { password: _, ...driverWithoutPassword } = newDriver;
      
      const response: ApiResponse<typeof driverWithoutPassword> = {
        message: 'Driver created successfully',
        data: driverWithoutPassword
      };

      return NextResponse.json(response);
    } else {
      throw new Error('Failed to write data to file');
    }

  } catch (error) {
    console.error('Error creating driver:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create driver' },
      { status: 500 }
    );
  }
}

// PUT - Update driver
export async function PUT(request: NextRequest) {
  try {
    const { id, name, email, dob, licenseNo, licenseExpiry, salary, totalLeave }: UpdateDriverRequest = await request.json();
    
    if (!id || !name || !email || !dob || !licenseNo || !licenseExpiry) {
      return NextResponse.json(
        { error: 'All required fields must be filled' },
        { status: 400 }
      );
    }

    const data = readData();
    
    // Find driver
    const driverIndex = data.drivers.findIndex(d => d.id === id);
    if (driverIndex === -1) {
      return NextResponse.json(
        { error: 'Driver not found' },
        { status: 404 }
      );
    }

    const existingDriver = data.drivers[driverIndex];

    // Check if email is being changed and if it already exists
    if (email !== existingDriver.email) {
      const emailExists = data.drivers.find(d => d.email === email && d.id !== id);
      if (emailExists) {
        return NextResponse.json(
          { error: 'Driver with this email already exists' },
          { status: 409 }
        );
      }
    }

    // Check if license number is being changed and if it already exists
    if (licenseNo !== existingDriver.licenseNo) {
      const licenseExists = data.drivers.find(d => d.licenseNo === licenseNo && d.id !== id);
      if (licenseExists) {
        return NextResponse.json(
          { error: 'Driver with this license number already exists' },
          { status: 409 }
        );
      }
    }

    // Update driver
    const updatedDriver: Driver = {
      ...existingDriver,
      name,
      email,
      dob,
      licenseNo,
      licenseExpiry,
      salary: salary || existingDriver.salary,
      totalLeave: totalLeave || existingDriver.totalLeave,
      remainingLeave: totalLeave || existingDriver.remainingLeave
    };

    data.drivers[driverIndex] = updatedDriver;

    if (writeData(data)) {
      // Return driver without password
      const { password: _, ...driverWithoutPassword } = updatedDriver;
      
      const response: ApiResponse<typeof driverWithoutPassword> = {
        message: 'Driver updated successfully',
        data: driverWithoutPassword
      };

      return NextResponse.json(response);
    } else {
      throw new Error('Failed to write data to file');
    }

  } catch (error) {
    console.error('Error updating driver:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update driver' },
      { status: 500 }
    );
  }
}