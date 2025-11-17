import { NextRequest, NextResponse } from 'next/server';
import { readData, writeData } from '../../../lib/demoData';
import { LeaveRequest } from '../../../types';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

interface SubmitLeaveRequest {
  driverId: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export async function POST(request: NextRequest) {
  try {
    const { driverId, startDate, endDate, reason }: SubmitLeaveRequest = await request.json();

    if (!driverId || !startDate || !endDate || !reason) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start >= end) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      );
    }

    const data = readData();
    
    // Check if driver exists
    const driver = data.drivers.find(d => d.id === driverId);
    if (!driver) {
      return NextResponse.json(
        { error: 'Driver not found' },
        { status: 404 }
      );
    }

    // Create new leave request
    const newLeaveRequest: LeaveRequest = {
      id: Date.now().toString(),
      driverId,
      startDate,
      endDate,
      reason,
      status: 'pending',
      submittedAt: new Date().toISOString()
    };

    // Add to leave requests array
    if (!data.leaveRequests) {
      data.leaveRequests = [];
    }
    data.leaveRequests.push(newLeaveRequest);

    const success = writeData(data);

    if (success) {
      const response: ApiResponse<{ success: boolean; leaveRequest: LeaveRequest }> = {
        message: 'Leave request submitted successfully',
        data: {
          success: true,
          leaveRequest: newLeaveRequest
        }
      };
      return NextResponse.json(response);
    } else {
      return NextResponse.json(
        { error: 'Failed to submit leave request' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error submitting leave request:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to submit leave request' },
      { status: 500 }
    );
  }
}