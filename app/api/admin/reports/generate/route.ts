import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { FleetData, Journey, User, Driver, Car } from '@/app/types';

interface GenerateReportRequest {
  reportType: string;
  format?: string;
  startDate?: string;
  endDate?: string;
}

interface ReportData {
  reportType: string;
  generatedAt: string;
  period: string;
  summary: any;
  data: any; // allow object or array depending on report type (e.g. excel returns an object)
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

// POST - Generate reports
export async function POST(request: NextRequest) {
  try {
    const { reportType, format, startDate, endDate }: GenerateReportRequest = await request.json();
    
    if (!reportType) {
      return NextResponse.json(
        { error: 'Report type is required' },
        { status: 400 }
      );
    }

    const data = readData();
    const now = new Date();
    let reportData: ReportData;

    switch (reportType) {
      case 'monthly':
        reportData = generateMonthlyReport(data, now);
        break;
      
      case 'driver':
        reportData = generateDriverReport(data, now);
        break;
      
      case 'maintenance':
        reportData = generateMaintenanceReport(data, now);
        break;
      
      case 'excel':
        reportData = generateExcelReport(data, now);
        break;
      
      case 'pdf':
        reportData = generatePdfReport(data, now);
        break;
      
      case 'custom':
        reportData = generateCustomReport(data, now, startDate, endDate);
        break;
      
      default:
        return NextResponse.json(
          { error: 'Invalid report type' },
          { status: 400 }
        );
    }

    const response: ApiResponse<ReportData> = {
      message: `${reportType} report generated successfully`,
      data: reportData
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error generating report:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}

// Helper functions for different report types
function generateMonthlyReport(data: FleetData, now: Date): ReportData {
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  const monthlyJourneys = data.journeys.filter(j => {
    const journeyDate = new Date(j.startTime);
    return journeyDate.getMonth() === currentMonth && journeyDate.getFullYear() === currentYear;
  });

  const completedJourneys = monthlyJourneys.filter(j => j.status === 'completed');
  const totalDistance = completedJourneys.reduce((sum, j) => sum + j.distance, 0);
  const totalUsers = data.users.length;
  const activeUsers = data.users.filter(u => u.isActive).length;

  return {
    reportType: 'monthly',
    generatedAt: now.toISOString(),
    period: `${now.toLocaleString('default', { month: 'long' })} ${currentYear}`,
    summary: {
      totalJourneys: monthlyJourneys.length,
      completedJourneys: completedJourneys.length,
      cancelledJourneys: monthlyJourneys.filter(j => j.status === 'cancelled').length,
      totalDistance,
      averageDistance: completedJourneys.length > 0 ? totalDistance / completedJourneys.length : 0,
      totalUsers,
      activeUsers,
      userActivityRate: totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0
    },
    data: monthlyJourneys.map(j => ({
      id: j.id,
      userName: j.userName,
      driverName: j.driverName,
      carModel: j.carModel,
      startLocation: j.startLocation.address,
      endLocation: j.endLocation.address,
      distance: j.distance,
      status: j.status,
      startTime: j.startTime,
      endTime: j.endTime
    }))
  };
}

function generateDriverReport(data: FleetData, now: Date): ReportData {
  const driverPerformance = data.drivers.map(driver => {
    const driverJourneys = data.journeys.filter(j => j.driverId === driver.id);
    const completedJourneys = driverJourneys.filter(j => j.status === 'completed');
    const totalDistance = completedJourneys.reduce((sum, j) => sum + j.distance, 0);
    
    return {
      driverId: driver.id,
      driverName: driver.name,
      licenseNo: driver.licenseNo,
      onLeave: driver.onLeave,
      totalJourneys: driverJourneys.length,
      completedJourneys: completedJourneys.length,
      completionRate: driverJourneys.length > 0 ? (completedJourneys.length / driverJourneys.length) * 100 : 0,
      totalDistance,
      averageDistance: completedJourneys.length > 0 ? totalDistance / completedJourneys.length : 0,
      monthlyDistance: driver.totalTravelledDistance?.month || 0,
      salary: driver.salary
    };
  });

  return {
    reportType: 'driver',
    generatedAt: now.toISOString(),
    period: 'All Time',
    summary: {
      totalDrivers: data.drivers.length,
      activeDrivers: data.drivers.filter(d => !d.onLeave).length,
      driversOnLeave: data.drivers.filter(d => d.onLeave).length,
      averageCompletionRate: driverPerformance.reduce((sum, d) => sum + d.completionRate, 0) / driverPerformance.length,
      totalDistanceCovered: driverPerformance.reduce((sum, d) => sum + d.totalDistance, 0)
    },
    data: driverPerformance
  };
}

function generateMaintenanceReport(data: FleetData, now: Date): ReportData {
  const maintenanceData = data.cars.map(car => {
    const carJourneys = data.journeys.filter(j => j.carId === car.id);
    const completedJourneys = carJourneys.filter(j => j.status === 'completed');
    const totalDistance = completedJourneys.reduce((sum, j) => sum + j.distance, 0);
    
    return {
      carId: car.id,
      carModel: car.model,
      regNo: car.regNo,
      status: car.status,
      isClean: car.isClean,
      needsServicing: car.needsServicing,
      totalJourneys: carJourneys.length,
      totalDistance,
      monthlyDistance: car.totalDistanceTravelled?.month || 0,
      utilizationRate: data.journeys.length > 0 ? (carJourneys.length / data.journeys.length) * 100 : 0
    };
  });

  return {
    reportType: 'maintenance',
    generatedAt: now.toISOString(),
    period: 'Current Status',
    summary: {
      totalCars: data.cars.length,
      availableCars: data.cars.filter(c => c.status === 'available').length,
      inUseCars: data.cars.filter(c => c.status === 'in-use').length,
      servicingCars: data.cars.filter(c => c.status === 'servicing').length,
      carsNeedingService: data.cars.filter(c => c.needsServicing).length,
      carsNeedingCleaning: data.cars.filter(c => !c.isClean).length
    },
    data: maintenanceData
  };
}

function generateExcelReport(data: FleetData, now: Date): ReportData {
  // Comprehensive data for Excel export
  return {
    reportType: 'excel',
    generatedAt: now.toISOString(),
    period: 'Complete Data Export',
    summary: {
      totalUsers: data.users.length,
      totalDrivers: data.drivers.length,
      totalCars: data.cars.length,
      totalJourneys: data.journeys.length,
      systemStats: data.systemStats
    },
    data: {
      users: data.users.map(u => ({ ...u, password: undefined })), // Remove passwords
      drivers: data.drivers.map(d => ({ ...d, password: undefined })), // Remove passwords
      cars: data.cars,
      journeys: data.journeys,
      systemStats: data.systemStats
    }
  };
}

function generatePdfReport(data: FleetData, now: Date): ReportData {
  // Summary data for PDF report
  return {
    reportType: 'pdf',
    generatedAt: now.toISOString(),
    period: 'System Summary',
    summary: {
      ...data.systemStats,
      userActivity: {
        total: data.users.length,
        active: data.users.filter(u => u.isActive).length,
        inactive: data.users.filter(u => !u.isActive).length
      },
      fleetStatus: {
        total: data.cars.length,
        available: data.cars.filter(c => c.status === 'available').length,
        inUse: data.cars.filter(c => c.status === 'in-use').length,
        servicing: data.cars.filter(c => c.status === 'servicing').length
      },
      journeyStats: {
        total: data.journeys.length,
        completed: data.journeys.filter(j => j.status === 'completed').length,
        inProgress: data.journeys.filter(j => j.status === 'in-progress').length,
        requested: data.journeys.filter(j => j.status === 'requested').length,
        cancelled: data.journeys.filter(j => j.status === 'cancelled').length
      }
    },
    data: []
  };
}

function generateCustomReport(data: FleetData, now: Date, startDate?: string, endDate?: string): ReportData {
  let filteredJourneys = data.journeys;

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    filteredJourneys = data.journeys.filter(j => {
      const journeyDate = new Date(j.startTime);
      return journeyDate >= start && journeyDate <= end;
    });
  }

  const totalDistance = filteredJourneys.reduce((sum, j) => sum + j.distance, 0);
  const completedJourneys = filteredJourneys.filter(j => j.status === 'completed');

  return {
    reportType: 'custom',
    generatedAt: now.toISOString(),
    period: startDate && endDate ? `${startDate} to ${endDate}` : 'All Time',
    summary: {
      period: startDate && endDate ? `${startDate} to ${endDate}` : 'All Time',
      totalJourneys: filteredJourneys.length,
      completedJourneys: completedJourneys.length,
      completionRate: filteredJourneys.length > 0 ? (completedJourneys.length / filteredJourneys.length) * 100 : 0,
      totalDistance,
      averageDistance: completedJourneys.length > 0 ? totalDistance / completedJourneys.length : 0,
      uniqueUsers: new Set(filteredJourneys.map(j => j.userId)).size,
      uniqueDrivers: new Set(filteredJourneys.map(j => j.driverId)).size
    },
    data: filteredJourneys
  };
}