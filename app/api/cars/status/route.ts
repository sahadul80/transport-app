import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function PUT(request: NextRequest) {
  try {
    const { carId, status } = await request.json();
    
    if (!carId || !status) {
      return NextResponse.json(
        { error: 'Car ID and status are required' },
        { status: 400 }
      );
    }

    // Read demo data
    const filePath = path.join(process.cwd(), 'app', 'data', 'demoData.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContents);

    // Find and update the car
    const carIndex = data.cars.findIndex((c: any) => c.id === carId);
    if (carIndex === -1) {
      return NextResponse.json(
        { error: 'Car not found' },
        { status: 404 }
      );
    }

    // Update car status
    data.cars[carIndex].status = status;

    // Write updated data back to file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    return NextResponse.json({
      message: 'Car status updated successfully',
      car: data.cars[carIndex]
    });

  } catch (error) {
    console.error('Error updating car status:', error);
    return NextResponse.json(
      { error: 'Failed to update car status' },
      { status: 500 }
    );
  }
}