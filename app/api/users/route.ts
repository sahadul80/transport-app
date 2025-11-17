import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const dataFilePath = path.join(process.cwd(), 'app', 'data', 'demoData.json');

const readData = () => {
  try {
    const fileContents = fs.readFileSync(dataFilePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    console.error('Error reading data file:', error);
    return { users: [], drivers: [], cars: [], journeys: [] };
  }
};

const writeData = (data: any) => {
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing data file:', error);
    return false;
  }
};

export async function GET() {
  try {
    const data = readData();
    return NextResponse.json(data.users);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, email, designation, department } = await request.json();
    
    if (!name || !email || !designation || !department) {
      return NextResponse.json(
        { error: 'All required fields must be filled' },
        { status: 400 }
      );
    }

    const data = readData();
    
    // Check if user already exists
    const existingUser = data.users.find((user: any) => user.email === email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Create new user
    const newUser = {
      id: `user-${Date.now()}`,
      name,
      email,
      role: 'user',
      designation,
      department,
      carsUsed: [],
      totalDistance: {
        day: 0,
        month: 0,
        year: 0
      },
      isActive: true
    };

    data.users.push(newUser);

    if (writeData(data)) {
      return NextResponse.json({
        message: 'User created successfully',
        user: newUser
      });
    } else {
      throw new Error('Failed to write data');
    }

  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, name, email, designation, department } = await request.json();
    
    if (!id || !name || !email || !designation || !department) {
      return NextResponse.json(
        { error: 'All required fields must be filled' },
        { status: 400 }
      );
    }

    const data = readData();
    
    // Find user index
    const userIndex = data.users.findIndex((user: any) => user.id === id);
    if (userIndex === -1) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if email is taken by another user
    const emailExists = data.users.some((user: any) => user.email === email && user.id !== id);
    if (emailExists) {
      return NextResponse.json(
        { error: 'Email is already taken by another user' },
        { status: 400 }
      );
    }

    // Update user
    data.users[userIndex] = {
      ...data.users[userIndex],
      name,
      email,
      designation,
      department
    };

    if (writeData(data)) {
      return NextResponse.json({
        message: 'User updated successfully',
        user: data.users[userIndex]
      });
    } else {
      throw new Error('Failed to write data');
    }

  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}