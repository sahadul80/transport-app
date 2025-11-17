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

export async function PUT(request: NextRequest) {
  try {
    const { userId, isActive } = await request.json();
    
    if (!userId || typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'User ID and isActive status are required' },
        { status: 400 }
      );
    }

    const data = readData();
    
    // Find user index
    const userIndex = data.users.findIndex((user: any) => user.id === userId);
    if (userIndex === -1) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Update user status
    data.users[userIndex].isActive = isActive;

    if (writeData(data)) {
      return NextResponse.json({
        message: 'User status updated successfully',
        user: data.users[userIndex]
      });
    } else {
      throw new Error('Failed to write data');
    }

  } catch (error) {
    console.error('Error updating user status:', error);
    return NextResponse.json(
      { error: 'Failed to update user status' },
      { status: 500 }
    );
  }
}