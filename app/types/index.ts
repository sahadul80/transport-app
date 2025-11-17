import { ReactNode } from "react";

// Base interfaces
export interface BaseUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'user' | 'driver' | 'admin';
  isActive: boolean;
}

export interface Location {
  lat: number;
  lng: number;
  address: string;
}

export interface DistanceMetrics {
  day: number;
  month: number;
  year: number;
}

// User types
export interface User extends BaseUser {
  role: 'user';
  designation: string;
  department: string;
  currentLocation?: Location;
  carsUsed: string[];
  totalDistance: DistanceMetrics;
}

export interface Admin extends BaseUser {
  role: 'admin';
  designation: string;
  department: string;
  currentLocation?: Location;
  carsUsed: string[];
  totalDistance: DistanceMetrics;
}

export interface Driver extends BaseUser {
  role: 'driver';
  dob: string;
  licenseNo: string;
  licenseExpiry: string;
  onLeave: boolean;
  salary: number;
  totalLeave: number;
  remainingLeave: number;
  currentLocation: Location;
  totalTravelledDistance: DistanceMetrics;
}

// Car types
export interface Car {
  id: string;
  model: string;
  regNo: string;
  drivers: string[];
  users: string[];
  status: 'available' | 'in-use' | 'servicing' | 'cleaning';
  isClean: boolean;
  needsServicing: boolean;
  totalDistanceTravelled: DistanceMetrics;
  currentLocation: Location;
}

// Journey types
export interface Journey {
  userDesignation: ReactNode;
  id: string;
  carId: string;
  driverId: string;
  userId: string;
  userName: string;
  driverName: string;
  carModel: string;
  startLocation: Location;
  endLocation: Location;
  waypoints: Location[];
  status: 'requested' | 'in-progress' | 'completed' | 'cancelled';
  startTime: string;
  endTime: string | null;
  distance: number;
  rating: number | null;
  routeChanges: RouteChange[];
  estimatedDuration: number;
}

export interface RouteChange {
  type: 'waypoint_added' | 'waypoint_removed' | 'destination_changed';
  timestamp: string;
  waypoint?: Location;
  reason?: string;
}

// Leave Request types
export interface LeaveRequest {
  id: string;
  driverId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
}

// System Stats types
export interface SystemStats {
  totalUsers: number;
  totalDrivers: number;
  totalCars: number;
  activeJourneys: number;
  pendingRequests: number;
  availableCars: number;
  driversOnLeave: number;
  monthlyDistance: number;
}

// Main data structure
export interface FleetData {
  users: (User | Admin)[];
  drivers: Driver[];
  cars: Car[];
  locations: Location[];
  journeys: Journey[];
  leaveRequests: LeaveRequest[];
  systemStats: SystemStats;
}

// Authentication types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: Omit<User | Admin | Driver, 'password'>;
  message: string;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// Dashboard stats types
export interface DashboardStats {
  totalJourneys: number;
  completedJourneys: number;
  activeJourneys: number;
  totalDistance: number;
  availableCars: number;
  driversAvailable: number;
}

// Form types
export interface JourneyRequest {
  userId: string;
  startLocation: Location;
  endLocation: Location;
  waypoints?: Location[];
  preferredTime?: string;
  specialRequirements?: string;
}

export interface LeaveApplication {
  driverId: string;
  startDate: string;
  endDate: string;
  reason: string;
}

// Filter types
export interface UserFilters {
  department?: string;
  role?: string;
  isActive?: boolean;
}

export interface CarFilters {
  status?: string;
  needsServicing?: boolean;
  isClean?: boolean;
}

export interface JourneyFilters {
  status?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  driverId?: string;
  userId?: string;
}

// Search types
export interface SearchCriteria {
  query: string;
  type: 'users' | 'drivers' | 'cars' | 'journeys';
  filters?: any;
}

// Notification types
export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  userId?: string;
  driverId?: string;
}

// Map related types
export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface Route {
  points: Location[];
  distance: number;
  duration: number;
  polyline: string;
}

// Report types
export interface DistanceReport {
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  totalDistance: number;
  byUser: { userId: string; userName: string; distance: number }[];
  byDriver: { driverId: string; driverName: string; distance: number }[];
  byCar: { carId: string; carModel: string; distance: number }[];
}

export interface UtilizationReport {
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  carUtilization: { carId: string; carModel: string; utilization: number }[];
  driverUtilization: { driverId: string; driverName: string; utilization: number }[];
}