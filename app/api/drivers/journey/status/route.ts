import { NextRequest, NextResponse } from 'next/server';
import { readData, writeData } from '../../../../lib/demoData';
import { Journey } from '../../../../types';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

interface UpdateJourneyStatusRequest {
  driverId: string;
  journeyId: string;
  status: Journey['status'];
}

export async function POST(request: NextRequest) {
  try {
    const { driverId, journeyId, status }: UpdateJourneyStatusRequest = await request.json();

    if (!driverId || !journeyId || !status) {
      return NextResponse.json(
        { error: 'Driver ID, journey ID, and status are required' },
        { status: 400 }
      );
    }

    const data = readData();
    
    const journeyIndex = data.journeys.findIndex(
      journey => journey.id === journeyId && journey.driverId === driverId
    );

    if (journeyIndex === -1) {
      return NextResponse.json(
        { error: 'Journey not found or driver not authorized' },
        { status: 404 }
      );
    }

    // Update journey status
    data.journeys[journeyIndex] = {
      ...data.journeys[journeyIndex],
      status,
      ...(status === 'completed' && { endTime: new Date().toISOString() }),
      ...(status === 'in-progress' && { startTime: new Date().toISOString() })
    };

    const success = writeData(data);

    if (success) {
      const response: ApiResponse<{ success: boolean }> = {
        message: `Journey ${status} successfully`,
        data: { success: true }
      };
      return NextResponse.json(response);
    } else {
      return NextResponse.json(
        { error: `Failed to update journey status to ${status}` },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error updating journey status:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update journey status' },
      { status: 500 }
    );
  }
}