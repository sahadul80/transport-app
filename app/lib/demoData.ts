import fs from 'fs';
import path from 'path';
import { FleetData, Driver, Journey, Car, LeaveRequest, Location } from '../types';

const dataFilePath = path.join(process.cwd(), 'app', 'data', 'demoData.json');

export function readData(): FleetData {
  try {
    const fileContents = fs.readFileSync(dataFilePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    console.error('Error reading data file:', error);
    throw new Error('Failed to load data');
  }
}

export function writeData(data: FleetData): boolean {
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing data file:', error);
    throw new Error('Failed to save data');
  }
}

export function findDriverById(drivers: Driver[], driverId: string): Driver | undefined {
  return drivers.find(driver => driver.id === driverId);
}

export function findJourneysByDriverId(journeys: Journey[], driverId: string): Journey[] {
  return journeys.filter(journey => journey.driverId === driverId);
}

export function findCarsByDriverId(cars: Car[], driverId: string): Car[] {
  return cars.filter(car => car.drivers?.includes(driverId));
}

export function findLeaveRequestsByDriverId(leaveRequests: LeaveRequest[], driverId: string): LeaveRequest[] {
  return leaveRequests.filter(request => request.driverId === driverId);
}