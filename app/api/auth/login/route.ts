import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Car, Driver, Journey, LeaveRequest, SystemStats, User, Admin } from '@/app/types';

interface FleetData {
  users: (User | Admin)[];
  drivers: Driver[];
  cars: Car[];
  locations: Location[];
  journeys: Journey[];
  leaveRequests: LeaveRequest[];
  systemStats: SystemStats;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface AuthResponse {
  user: Omit<User | Admin | Driver, 'password'>;
  message: string;
}


// Read and parse the demo data with fallback
const readDemoData = (): FleetData => {
  try {
    const dataFilePath = path.join(process.cwd(), 'app', 'data', 'demoData.json');
    
    // Check if file exists
    if (!fs.existsSync(dataFilePath)) {
      console.warn('demoData.json not found, using default data');
      return null as unknown as FleetData;
    }

    const fileContents = fs.readFileSync(dataFilePath, 'utf8');
    
    // Check if file is empty
    if (!fileContents.trim()) {
      console.warn('demoData.json is empty, using default data');
      return null as unknown as FleetData;
    }

    const demoData = JSON.parse(fileContents);
    
    // Validate the structure
    if (!demoData.users || !demoData.drivers) {
      console.warn('demoData.json has invalid structure, using default data');
      return null as unknown as FleetData;
    }

    return demoData;
  } catch (error) {
    console.error('Error reading demo data, using default data:', error);
    return null as unknown as FleetData;
  }
};

// Combine all users from different arrays into one searchable array
const getAllUsers = (data: FleetData): (User | Admin | Driver)[] => {
  const allUsers: (User | Admin | Driver)[] = [...data.users];
  
  // Add drivers that aren't already in users array
  data.drivers.forEach(driver => {
    if (!allUsers.find(user => user.id === driver.id)) {
      allUsers.push(driver);
    }
  });
  
  return allUsers;
};

// Remove password from user object before sending to client
const sanitizeUser = (user: User | Admin | Driver): Omit<User | Admin | Driver, 'password'> => {
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { email, password }: LoginCredentials = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Read demo data
    const demoData = readDemoData();
    const allUsers = getAllUsers(demoData);

    // Find user by email and password
    const user = allUsers.find(
      u => u.email === email && u.password === password
    );

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Get additional data based on user role
    let userWithAdditionalData: User | Admin | Driver = { ...user };

    // Add role-specific data
    if (user.role === 'driver') {
      const driverData = demoData.drivers.find((d: Driver) => d.id === user.id);
      if (driverData) {
        userWithAdditionalData = { ...userWithAdditionalData, ...driverData };
      }
    } else {
      const userData = demoData.users.find((u: User | Admin) => u.id === user.id);
      if (userData) {
        userWithAdditionalData = { ...userWithAdditionalData, ...userData };
      }
    }

    // Sanitize user data (remove password)
    const sanitizedUser = sanitizeUser(userWithAdditionalData);

    // Log login activity
    console.log(`User logged in: ${user.name} (${user.role})`);

    const response: AuthResponse = {
      user: sanitizedUser,
      message: 'Login successful'
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Login error:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check if service is running and provide stats
export async function GET() {
  try {
    const demoData = readDemoData();
    const allUsers = getAllUsers(demoData);
    
    const regularUsers = demoData.users.filter((u: User | Admin) => u.role === 'user');
    const admins = demoData.users.filter((u: User | Admin) => u.role === 'admin');
    
    return NextResponse.json({
      message: 'Auth service is running',
      stats: {
        totalUsers: allUsers.length,
        regularUsers: regularUsers.length,
        admins: admins.length,
        drivers: demoData.drivers.length,
        availableRoles: ['admin', 'user', 'driver'] as const
      },
      system: demoData.systemStats
    });
  } catch (error) {
    console.error('Service check error:', error);
    return NextResponse.json(
      { error: 'Service unavailable' },
      { status: 503 }
    );
  }
}