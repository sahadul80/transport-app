import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function PUT(request: NextRequest) {
  try {
    const { journeyId, carId, driverId } = await request.json();
    
    if (!journeyId || !carId || !driverId) {
      return NextResponse.json(
        { error: 'Journey ID, Car ID, and Driver ID are required' },
        { status: 400 }
      );
    }

    // Read demo data
    const filePath = path.join(process.cwd(), 'app', 'data', 'demoData.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContents);

    // Find and update the journey
    const journeyIndex = data.journeys.findIndex((j: any) => j.id === journeyId);
    if (journeyIndex === -1) {
      return NextResponse.json(
        { error: 'Journey not found' },
        { status: 404 }
      );
    }

    // Update journey
    data.journeys[journeyIndex] = {
      ...data.journeys[journeyIndex],
      carId,
      driverId,
      status: 'in-progress'
    };

    // Update car status
    const carIndex = data.cars.findIndex((c: any) => c.id === carId);
    if (carIndex !== -1) {
      data.cars[carIndex].status = 'in-use';
    }

    // Write updated data back to file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    return NextResponse.json({
      message: 'Car and driver assigned successfully',
      journey: data.journeys[journeyIndex]
    });

  } catch (error) {
    console.error('Error assigning car and driver:', error);
    return NextResponse.json(
      { error: 'Failed to assign car and driver' },
      { status: 500 }
    );
  }
}