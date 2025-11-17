'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import { Driver, Journey, Car, LeaveRequest, User as BaseUser, Location, DistanceMetrics } from '../types';

// Define missing types
interface DriverProfileData {
  name: string;
  email: string;
  licenseNo: string;
  licenseExpiry: string;
}

export default function DriverDashboard() {
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Driver state
  const [driverData, setDriverData] = useState<Driver | null>(null);
  const [profileData, setProfileData] = useState<DriverProfileData>({
    name: '',
    email: '',
    licenseNo: '',
    licenseExpiry: ''
  });
  
  // Location state
  const [currentLocation, setCurrentLocation] = useState<Location>({
    lat: 0,
    lng: 0,
    address: 'Location not available'
  });
  
  // Data state
  const [assignedJourneys, setAssignedJourneys] = useState<Journey[]>([]);
  const [assignedCars, setAssignedCars] = useState<Car[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  
  // Form states
  const [leaveRequest, setLeaveRequest] = useState({
    startDate: '',
    endDate: '',
    reason: ''
  });
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Redirect if not authenticated or not driver
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, user, router]);

  // Load driver data
  useEffect(() => {
    if (user) {
      loadDriverData();
    }
  }, [user]);

  const loadDriverData = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/drivers?driverId=${user?.id}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch driver data');
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      if (result.data) {
        const { driver, journeys, cars, leaveRequests } = result.data;
        
        setDriverData(driver);
        setProfileData({
          name: driver.name,
          email: driver.email,
          licenseNo: driver.licenseNo || '',
          licenseExpiry: driver.licenseExpiry || ''
        });
        
        if (driver.currentLocation) {
          setCurrentLocation(driver.currentLocation);
        }
        
        setAssignedJourneys(journeys || []);
        setAssignedCars(cars || []);
        setLeaveRequests(leaveRequests || []);
      }
      
    } catch (error) {
      console.error('Error loading driver data:', error);
      // Set fallback data for demo
      setDriverData({
        id: user?.id || '',
        email: user?.email || '',
        name: user?.name || 'Driver',
        role: 'driver',
        isActive: true,
        dob: '1990-01-01',
        licenseNo: 'DRV123456',
        licenseExpiry: '2025-12-31',
        onLeave: false,
        salary: 25000,
        totalLeave: 20,
        remainingLeave: 15,
        currentLocation: {
          lat: 23.8103,
          lng: 90.4125,
          address: 'Dhaka, Bangladesh'
        },
        totalTravelledDistance: {
          day: 45,
          month: 1200,
          year: 14500
        }
      } as Driver);
    } finally {
      setIsLoading(false);
    }
  };

  // Improved geolocation function with better error handling
  const updateCurrentLocation = async (): Promise<void> => {
    // Reset previous errors
    setLocationError(null);

    if (!navigator.geolocation) {
      const error = 'Geolocation is not supported by your browser';
      setLocationError(error);
      alert(error);
      return;
    }

    setIsUpdatingLocation(true);
    
    // Configure geolocation options
    const geolocationOptions = {
      enableHighAccuracy: true,
      timeout: 15000, // 15 seconds
      maximumAge: 60000 // 1 minute
    };

    const handleGeolocationSuccess = async (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      
      let newLocation: Location = {
        lat: latitude,
        lng: longitude,
        address: 'Getting address...'
      };
      
      try {
        const address = await getAddressFromCoordinates(latitude, longitude);
        newLocation.address = address;
        
        // Use the dedicated location endpoint
        const response = await fetch('/api/drivers/location', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            driverId: user?.id,
            location: newLocation
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update location');
        }

        const result = await response.json();
        
        if (result.data?.success) {
          alert('Location updated successfully!');
          setCurrentLocation(newLocation);
          if (driverData) {
            setDriverData({
              ...driverData,
              currentLocation: newLocation
            });
          }
        } else {
          throw new Error(result.error || 'Failed to update location');
        }
      } catch (error) {
        console.error('Error updating location:', error);
        const errorMsg = 'Location updated locally (demo mode)';
        setLocationError(errorMsg);
        alert(errorMsg);
        setCurrentLocation(newLocation);
        if (driverData) {
          setDriverData({
            ...driverData,
            currentLocation: newLocation
          });
        }
      } finally {
        setIsUpdatingLocation(false);
      }
    };

    const handleGeolocationError = (error: GeolocationPositionError) => {
      let errorMessage = 'Unable to retrieve your location. ';
      
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage += 'Please enable location services in your browser settings and allow location access for this website.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage += 'Location information is unavailable. Please check your device settings.';
          break;
        case error.TIMEOUT:
          errorMessage += 'Location request timed out. Please try again.';
          break;
        default:
          errorMessage += 'An unknown error occurred.';
          break;
      }
      
      console.error('Geolocation error:', error);
      setLocationError(errorMessage);
      alert(errorMessage);
      setIsUpdatingLocation(false);
    };

    // Get current position with proper error handling
    navigator.geolocation.getCurrentPosition(
      handleGeolocationSuccess,
      handleGeolocationError,
      geolocationOptions
    );
  };

  // Improved address lookup with fallbacks
  const getAddressFromCoordinates = async (lat: number, lng: number): Promise<string> => {
    // First try: Use browser's built-in geocoding if available
    if ('geocoder' in window) {
      try {
        // @ts-ignore - geocoder might not be available in all browsers
        const geocoder = new window.Geocoder();
        if (geocoder) {
          return new Promise((resolve) => {
            geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
              if (status === 'OK' && results[0]) {
                resolve(results[0].formatted_address);
              } else {
                resolve(getFallbackAddress(lat, lng));
              }
            });
          });
        }
      } catch (error) {
        console.log('Browser geocoding not available, using fallback');
      }
    }

    // Second try: OpenStreetMap Nominatim API
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.display_name) {
          return data.display_name;
        }
      }
    } catch (error) {
      console.error('Error with OpenStreetMap API:', error);
    }

    // Final fallback
    return getFallbackAddress(lat, lng);
  };

  const getFallbackAddress = (lat: number, lng: number): string => {
    // Simple fallback based on coordinates
    const addresses = [
      'Commercial Area, Downtown',
      'Business District Center',
      'Main Street Location',
      'City Center Point',
      'Urban Zone Location'
    ];
    
    // Use coordinates to pick a "consistent" fallback address
    const index = Math.abs(Math.floor(lat + lng)) % addresses.length;
    return addresses[index];
  };

  const updateProfile = async (): Promise<void> => {
    try {
      // Use the dedicated profile endpoint
      const response = await fetch('/api/drivers/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driverId: user?.id,
          profileData: profileData
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }

      const result = await response.json();
      
      if (result.data?.success) {
        alert('Profile updated successfully');
        setIsEditingProfile(false);
        if (driverData) {
          setDriverData({
            ...driverData,
            ...profileData
          });
        }
      } else {
        throw new Error(result.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Profile updated locally (demo mode)');
      setIsEditingProfile(false);
      if (driverData) {
        setDriverData({
          ...driverData,
          ...profileData
        });
      }
    }
  };

  const updateJourneyStatus = async (journeyId: string, status: Journey['status']): Promise<void> => {
    try {
      // Use the dedicated journey status endpoint
      const response = await fetch('/api/drivers/journey/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driverId: user?.id,
          journeyId,
          status
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update journey status to ${status}`);
      }

      const result = await response.json();
      
      if (result.data?.success) {
        alert(`Journey ${status} successfully`);
        await loadDriverData(); // Reload data to get updated journey list
      } else {
        throw new Error(result.error || `Failed to update journey status to ${status}`);
      }
    } catch (error) {
      console.error('Error updating journey status:', error);
      alert(`Journey status updated to ${status} locally (demo mode)`);
      // Update locally
      const updatedJourneys = assignedJourneys.map(journey => 
        journey.id === journeyId ? { ...journey, status } : journey
      );
      setAssignedJourneys(updatedJourneys);
    }
  };

  const submitLeaveRequest = async (): Promise<void> => {
    if (!leaveRequest.startDate || !leaveRequest.endDate || !leaveRequest.reason) {
      alert('Please fill in all leave request fields');
      return;
    }

    // Validate dates
    const startDate = new Date(leaveRequest.startDate);
    const endDate = new Date(leaveRequest.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (startDate < today) {
      alert('Start date cannot be in the past');
      return;
    }

    if (endDate <= startDate) {
      alert('End date must be after start date');
      return;
    }

    setIsSubmittingLeave(true);

    try {
      // Use the dedicated leave endpoint
      const response = await fetch('/api/drivers/leave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driverId: user?.id,
          startDate: leaveRequest.startDate,
          endDate: leaveRequest.endDate,
          reason: leaveRequest.reason
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit leave request');
      }

      const result = await response.json();
      
      if (result.data?.success) {
        alert('Leave request submitted successfully');
        setLeaveRequest({
          startDate: '',
          endDate: '',
          reason: ''
        });
        // Add the new leave request to the list
        if (result.data.leaveRequest) {
          setLeaveRequests(prev => [result.data.leaveRequest, ...prev]);
        }
      } else {
        throw new Error(result.error || 'Failed to submit leave request');
      }
    } catch (error) {
      console.error('Error submitting leave request:', error);
      alert('Leave request submitted locally (demo mode)');
      const newLeaveRequest: LeaveRequest = {
        id: Date.now().toString(),
        driverId: user?.id || '',
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        reason: leaveRequest.reason,
        status: 'pending',
        submittedAt: new Date().toISOString()
      };
      setLeaveRequests(prev => [newLeaveRequest, ...prev]);
      setLeaveRequest({
        startDate: '',
        endDate: '',
        reason: ''
      });
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const calculateEarnings = (): number => {
    if (!driverData?.totalTravelledDistance) return 0;
    return (driverData.totalTravelledDistance as DistanceMetrics).month * 0.5;
  };

  // Loading states
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center ">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto"></div>
          <p className="mt-4 text-steel-50">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (isLoading || !driverData) {
    return (
      <div className="min-h-screen flex items-center justify-center ">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto"></div>
          <p className="mt-4 text-steel-50">Loading driver data...</p>
        </div>
      </div>
    );
  }

  const activeJourney = assignedJourneys.find(j => j.status === 'in-progress');
  const requestedJourneys = assignedJourneys.filter(j => j.status === 'requested');
  const completedJourneys = assignedJourneys.filter(j => j.status === 'completed');
  const totalDistance = driverData.totalTravelledDistance as DistanceMetrics;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto p-2 sm:p-4">
          <div className="flex justify-between items-center h-auto">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 " fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-primary">
                    FleetPro
                  </h1>
                  <p className="text-xs text-steel-300">Driver Dashboard</p>
                </div>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1">
              {[
                { id: 'dashboard', name: 'Dashboard', icon: '📊' },
                { id: 'journeys', name: 'My Journeys', icon: '🚗' },
                { id: 'cars', name: 'Assigned Cars', icon: '🔑' },
                { id: 'leave', name: 'Leave', icon: '🏖️' },
                { id: 'profile', name: 'Profile', icon: '👤' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium text-sm transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-accent-primary  shadow-lg shadow-blue-500/25'
                      : 'text-steel-50 hover:text-steel-100 hover: hover:shadow-md'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.name}</span>
                </button>
              ))}
            </nav>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-3  rounded-xl px-4 py-2 border border-steel-200">
                <div className="w-8 h-8 rounded-full flex items-center justify-center  text-sm font-medium">
                  {driverData.name?.charAt(0).toUpperCase()}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-primary">{driverData.name}</p>
                  <p className="text-xs text-steel-300">Professional Driver</p>
                </div>
              </div>
              
              <button
                onClick={logout}
                className="  px-4 py-2 rounded-xl hover: transition-colors shadow-lg flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Logout</span>
              </button>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-lg  hover: transition-colors"
              >
                <svg className="w-6 h-6 text-steel-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-steel-200  rounded-b-2xl shadow-lg">
              <nav className="flex flex-col space-y-2">
                {[
                  { id: 'dashboard', name: 'Dashboard', icon: '📊' },
                  { id: 'journeys', name: 'My Journeys', icon: '🚗' },
                  { id: 'cars', name: 'Assigned Cars', icon: '🔑' },
                  { id: 'leave', name: 'Leave', icon: '🏖️' },
                  { id: 'profile', name: 'Profile', icon: '👤' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-accent-primary  shadow-lg shadow-blue-500/25'
                        : 'text-steel-50 hover:text-steel-100 hover:'
                    }`}
                  >
                    <span className="text-lg">{tab.icon}</span>
                    <span>{tab.name}</span>
                  </button>
                ))}
              </nav>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Banner */}
        <div className="rounded-2xl p-6 mb-8  shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Welcome, {driverData.name}! 👋</h2>
              <p className="text-steel-100 opacity-90">
                {driverData.onLeave ? '🚫 Currently on Leave' : '✅ Available for Journeys'} • 
                License: {driverData.licenseNo} • 
                Expires: {new Date(driverData.licenseExpiry).toLocaleDateString()}
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex items-center space-x-4">
              <div className="text-right">
                <p className="text-steel-200 text-sm">Today's Distance</p>
                <p className="text-2xl font-bold">{totalDistance.day} km</p>
              </div>
              <div className="w-12 h-12  rounded-xl flex items-center justify-center backdrop-blur-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Current Location Card */}
        <div className=" rounded-2xl p-6 shadow-lg border border-steel-200 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12  rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-steel-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-primary">Current Location</h3>
                <p className="text-steel-50">{currentLocation.address}</p>
                <p className="text-sm text-steel-300">
                  Lat: {currentLocation.lat.toFixed(4)}, Lng: {currentLocation.lng.toFixed(4)}
                </p>
                {locationError && (
                  <p className="text-sm text-red-500 mt-2">{locationError}</p>
                )}
              </div>
            </div>
            <button
              onClick={updateCurrentLocation}
              disabled={isUpdatingLocation}
              className="mt-4 md:mt-0 bg-accent-primary  px-6 py-3 rounded-xl hover: disabled: transition-colors shadow-lg flex items-center space-x-2"
            >
              {isUpdatingLocation ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Update Location</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className=" rounded-2xl p-6 shadow-lg border border-steel-200 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-steel-300 text-sm font-medium">Monthly Distance</p>
                    <p className="text-3xl font-bold text-primary mt-2">{totalDistance.month} km</p>
                    <p className="text-green-600 text-sm font-medium mt-2 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                      +8% from last month
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className=" rounded-2xl p-6 shadow-lg border border-steel-200 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-steel-300 text-sm font-medium">Estimated Earnings</p>
                    <p className="text-3xl font-bold text-primary mt-2">${calculateEarnings().toFixed(2)}</p>
                    <p className="text-steel-300 text-sm mt-2">This month</p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className=" rounded-2xl p-6 shadow-lg border border-steel-200 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-steel-300 text-sm font-medium">Completed Journeys</p>
                    <p className="text-3xl font-bold text-primary mt-2">{completedJourneys.length}</p>
                    <p className="text-steel-300 text-sm mt-2">All time</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className=" rounded-2xl p-6 shadow-lg border border-steel-200 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-steel-300 text-sm font-medium">Available Leave</p>
                    <p className="text-3xl font-bold text-primary mt-2">{driverData.remainingLeave} days</p>
                    <p className="text-steel-300 text-sm mt-2">Out of {driverData.totalLeave} total</p>
                  </div>
                  <div className="w-12 h-12  rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 " fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Journey & Assigned Cars */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Active Journey */}
              {activeJourney ? (
                <div className=" rounded-2xl p-6 shadow-lg border border-steel-200">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-primary">Active Journey</h3>
                    <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full animate-pulse">
                      In Progress
                    </span>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8  rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 " fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-steel-300">Passenger</p>
                        <p className="font-medium text-primary">{activeJourney.userName}</p>
                        <p className="text-xs text-steel-300">{activeJourney.userDesignation}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-steel-300">From</p>
                        <p className="font-medium text-primary">{activeJourney.startLocation.address}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-steel-300">To</p>
                        <p className="font-medium text-primary">{activeJourney.endLocation.address}</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-steel-100">
                      <div>
                        <p className="text-sm text-steel-300">Distance</p>
                        <p className="font-medium text-primary">{activeJourney.distance} km</p>
                      </div>
                      <button
                        onClick={() => updateJourneyStatus(activeJourney.id, 'completed')}
                        className="bg-green-600  px-6 py-2 rounded-xl hover:bg-green-700 transition-colors"
                      >
                        Complete Journey
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className=" rounded-2xl p-6 shadow-lg border border-steel-200">
                  <h3 className="text-lg font-semibold text-primary mb-4">No Active Journey</h3>
                  <p className="text-steel-50 mb-4">You don't have any active journeys at the moment.</p>
                  <button
                    onClick={() => setActiveTab('journeys')}
                    className="bg-accent-primary  px-4 py-2 rounded-xl hover: transition-colors"
                  >
                    View Assigned Journeys
                  </button>
                </div>
              )}

              {/* Assigned Cars */}
              <div className=" rounded-2xl p-6 shadow-lg border border-steel-200">
                <h3 className="text-lg font-semibold text-primary mb-6">Assigned Cars</h3>
                <div className="space-y-4">
                  {assignedCars.slice(0, 2).map((car) => (
                    <div key={car.id} className="flex items-center justify-between p-4 border border-steel-200 rounded-xl">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10  rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-steel-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-primary">{car.model}</p>
                          <p className="text-sm text-steel-300">{car.regNo}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        car.status === 'available' ? 'bg-green-100 text-green-800' :
                        car.status === 'in-use' ? ' ' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {car.status}
                      </span>
                    </div>
                  ))}
                  {assignedCars.length > 2 && (
                    <button
                      onClick={() => setActiveTab('cars')}
                      className="w-full text-center text-accent-primary hover: py-2"
                    >
                      View all {assignedCars.length} cars ›
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className=" rounded-2xl p-6 shadow-lg border border-steel-200">
              <h3 className="text-lg font-semibold text-primary mb-6">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => setActiveTab('journeys')}
                  className="p-6 border-2 border-dashed border-steel-200 rounded-2xl hover:border-green-500 hover:bg-green-50 transition-all duration-300 group text-center"
                >
                  <div className="w-12 h-12  rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:bg-green-200 transition-colors">
                    <svg className="w-6 h-6 text-steel-50 group-hover:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-steel-100 group-hover:text-green-700">View Journeys</span>
                </button>
                
                <button
                  onClick={() => setActiveTab('cars')}
                  className="p-6 border-2 border-dashed border-steel-200 rounded-2xl hover:border-blue-500 hover: transition-all duration-300 group text-center"
                >
                  <div className="w-12 h-12  rounded-xl flex items-center justify-center mx-auto mb-3 group-hover: transition-colors">
                    <svg className="w-6 h-6 text-steel-50 group-hover:" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-steel-100 group-hover:">Manage Cars</span>
                </button>
                
                <button
                  onClick={() => setActiveTab('leave')}
                  className="p-6 border-2 border-dashed border-steel-200 rounded-2xl hover:border-orange-500 hover:bg-orange-50 transition-all duration-300 group text-center"
                >
                  <div className="w-12 h-12  rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:bg-orange-200 transition-colors">
                    <svg className="w-6 h-6 text-steel-50 group-hover:text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-steel-100 group-hover:text-orange-700">Request Leave</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Journeys Tab */}
        {activeTab === 'journeys' && (
          <div className="space-y-6">
            {/* Requested Journeys */}
            {requestedJourneys.length > 0 && (
              <div className=" rounded-2xl shadow-lg border border-steel-200">
                <div className="p-6 border-b border-steel-200">
                  <h3 className="text-lg font-semibold text-primary">New Journey Requests</h3>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {requestedJourneys.map((journey) => (
                      <div key={journey.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border border-steel-200 rounded-xl">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <div className="w-8 h-8  rounded-full flex items-center justify-center">
                              <svg className="w-4 h-4 " fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                            <div>
                              <p className="font-medium text-primary">{journey.userName}</p>
                              <p className="text-sm text-steel-300">{journey.userDesignation}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-steel-300">From</p>
                              <p className="font-medium text-primary">{journey.startLocation.address}</p>
                            </div>
                            <div>
                              <p className="text-steel-300">To</p>
                              <p className="font-medium text-primary">{journey.endLocation.address}</p>
                            </div>
                          </div>
                          <div className="mt-2 text-sm text-steel-300">
                            Distance: {journey.distance} km • 
                            Requested: {new Date(journey.startTime).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="mt-4 md:mt-0 flex space-x-2">
                          <button
                            onClick={() => updateJourneyStatus(journey.id, 'in-progress')}
                            className="bg-green-600  px-4 py-2 rounded-xl hover:bg-green-700 transition-colors"
                          >
                            Start Journey
                          </button>
                          <button
                            onClick={() => updateJourneyStatus(journey.id, 'cancelled')}
                            className="bg-red-600  px-4 py-2 rounded-xl hover:bg-red-700 transition-colors"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* All Journeys Table */}
            <div className=" rounded-2xl shadow-lg border border-steel-200">
              <div className="p-6 border-b border-steel-200">
                <h3 className="text-lg font-semibold text-primary">All Journeys</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-steel-200">
                  <thead className="">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-steel-300 uppercase tracking-wider">
                        Passenger
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-steel-300 uppercase tracking-wider">
                        Route
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-steel-300 uppercase tracking-wider">
                        Distance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-steel-300 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-steel-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-steel-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className=" divide-y divide-steel-200">
                    {assignedJourneys.map((journey) => (
                      <tr key={journey.id} className="hover: transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <p className="text-sm font-medium text-primary">{journey.userName}</p>
                            <p className="text-sm text-steel-300">{journey.userDesignation}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-primary">
                          <div className="font-medium">{journey.startLocation.address}</div>
                          <div className="text-steel-300 text-xs">→ {journey.endLocation.address}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                          {journey.distance} km
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                          {new Date(journey.startTime).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                            journey.status === 'completed' ? 'bg-green-100 text-green-800' :
                            journey.status === 'in-progress' ? '  animate-pulse' :
                            journey.status === 'requested' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {journey.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                          {journey.status === 'requested' && (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => updateJourneyStatus(journey.id, 'in-progress')}
                                className="text-green-600 hover:text-green-800"
                              >
                                Start
                              </button>
                              <button
                                onClick={() => updateJourneyStatus(journey.id, 'cancelled')}
                                className="text-red-600 hover:text-red-800"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                          {journey.status === 'in-progress' && (
                            <button
                              onClick={() => updateJourneyStatus(journey.id, 'completed')}
                              className=" hover:"
                            >
                              Complete
                            </button>
                          )}
                          {journey.status === 'completed' && (
                            <span className="text-steel-400">Completed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Cars Tab */}
        {activeTab === 'cars' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assignedCars.map((car) => (
              <div key={car.id} className=" p-6 rounded-2xl shadow-lg border border-steel-200 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-primary">{car.model}</h4>
                  <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                    car.status === 'available' ? 'bg-green-100 text-green-800' :
                    car.status === 'in-use' ? ' ' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {car.status}
                  </span>
                </div>
                <div className="space-y-3 text-sm text-steel-50">
                  <div className="flex justify-between items-center py-2 border-b border-steel-100">
                    <span>Registration</span>
                    <span className="font-medium text-primary  px-2 py-1 rounded-lg">{car.regNo}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-steel-100">
                    <span>Cleanliness</span>
                    <span className={`font-medium ${car.isClean ? 'text-green-600' : 'text-red-600'}`}>
                      {car.isClean ? '✅ Clean' : '❌ Needs Cleaning'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-steel-100">
                    <span>Service</span>
                    <span className={`font-medium ${car.needsServicing ? 'text-red-600' : 'text-green-600'}`}>
                      {car.needsServicing ? '🔧 Needs Service' : '✅ Good'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span>Location</span>
                    <span className="font-medium text-primary">{car.currentLocation.address}</span>
                  </div>
                </div>
                {car.totalDistanceTravelled && (
                  <div className="mt-4 pt-4 border-t border-steel-100">
                    <p className="text-xs text-steel-300 mb-2">Total Distance Travelled</p>
                    <div className="flex justify-between text-xs">
                      <span>Day: {(car.totalDistanceTravelled as DistanceMetrics).day}km</span>
                      <span>Month: {(car.totalDistanceTravelled as DistanceMetrics).month}km</span>
                      <span>Year: {(car.totalDistanceTravelled as DistanceMetrics).year}km</span>
                    </div>
                  </div>
                )}
                <div className="mt-4 flex space-x-2">
                  <button className="flex-1 bg-accent-primary  py-2 px-4 rounded-xl hover: transition-colors text-sm">
                    Report Issue
                  </button>
                  <button className="flex-1   py-2 px-4 rounded-xl hover: transition-colors text-sm">
                    Service Request
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Leave Tab */}
        {activeTab === 'leave' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Leave Request Form */}
            <div className=" rounded-2xl p-6 shadow-lg border border-steel-200">
              <h3 className="text-lg font-semibold text-primary mb-6">Request Leave</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-steel-100 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={leaveRequest.startDate}
                    onChange={(e) => setLeaveRequest({...leaveRequest, startDate: e.target.value})}
                    className="w-full px-4 py-3 border border-steel-300 rounded-xl focus:ring-2 focus:ring-accent-primary focus:border-accent-primary transition-colors"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-steel-100 mb-2">End Date</label>
                  <input
                    type="date"
                    value={leaveRequest.endDate}
                    onChange={(e) => setLeaveRequest({...leaveRequest, endDate: e.target.value})}
                    className="w-full px-4 py-3 border border-steel-300 rounded-xl focus:ring-2 focus:ring-accent-primary focus:border-accent-primary transition-colors"
                    min={leaveRequest.startDate || new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-steel-100 mb-2">Reason</label>
                  <textarea
                    value={leaveRequest.reason}
                    onChange={(e) => setLeaveRequest({...leaveRequest, reason: e.target.value})}
                    rows={4}
                    className="w-full px-4 py-3 border border-steel-300 rounded-xl focus:ring-2 focus:ring-accent-primary focus:border-accent-primary transition-colors"
                    placeholder="Please provide a reason for your leave request..."
                  />
                </div>
                <button
                  onClick={submitLeaveRequest}
                  disabled={isSubmittingLeave}
                  className="w-full bg-green-600  py-3 px-6 rounded-xl hover:bg-green-700 disabled: transition-colors shadow-lg flex items-center justify-center space-x-2"
                >
                  {isSubmittingLeave ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <span>Submit Leave Request</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Leave Status & History */}
            <div className=" rounded-2xl p-6 shadow-lg border border-steel-200">
              <h3 className="text-lg font-semibold text-primary mb-6">Leave Status & History</h3>
              <div className="space-y-4">
                {/* Leave Balance */}
                <div className=" p-4 rounded-xl border border-steel-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-steel-100">Leave Balance</p>
                      <p className="text-2xl font-bold text-primary">
                        {driverData.remainingLeave} <span className="text-sm font-normal text-steel-50">/ {driverData.totalLeave} days</span>
                      </p>
                    </div>
                    <div className="w-12 h-12  rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 " fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Leave Requests */}
                <div>
                  <h4 className="text-sm font-medium text-steel-100 mb-3">Recent Requests</h4>
                  <div className="space-y-3">
                    {leaveRequests.map((request) => (
                      <div key={request.id} className="flex items-center justify-between p-3 border border-steel-200 rounded-xl">
                        <div>
                          <p className="text-sm font-medium text-primary">
                            {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-steel-300">{request.reason}</p>
                          <p className="text-xs text-steel-400">
                            Submitted: {new Date(request.submittedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          request.status === 'approved' ? 'bg-green-100 text-green-800' :
                          request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {request.status}
                        </span>
                      </div>
                    ))}
                    {leaveRequests.length === 0 && (
                      <p className="text-sm text-steel-300 text-center py-4">No leave requests found.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className=" rounded-2xl p-6 shadow-lg border border-steel-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
              <h3 className="text-lg font-semibold text-primary">Driver Profile</h3>
              <button
                onClick={() => setIsEditingProfile(!isEditingProfile)}
                className="bg-accent-primary  px-6 py-2 rounded-xl hover: transition-colors shadow-lg mt-4 sm:mt-0 flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>{isEditingProfile ? 'Cancel' : 'Edit Profile'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-steel-100 mb-2">Full Name</label>
                <input
                  type="text"
                  value={profileData.name}
                  onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                  disabled={!isEditingProfile}
                  className="w-full px-4 py-3 border border-steel-300 rounded-xl focus:ring-2 focus:ring-accent-primary focus:border-accent-primary disabled: transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-steel-100 mb-2">Email</label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                  disabled={!isEditingProfile}
                  className="w-full px-4 py-3 border border-steel-300 rounded-xl focus:ring-2 focus:ring-accent-primary focus:border-accent-primary disabled: transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-steel-100 mb-2">License Number</label>
                <input
                  type="text"
                  value={profileData.licenseNo}
                  onChange={(e) => setProfileData({...profileData, licenseNo: e.target.value})}
                  disabled={!isEditingProfile}
                  className="w-full px-4 py-3 border border-steel-300 rounded-xl focus:ring-2 focus:ring-accent-primary focus:border-accent-primary disabled: transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-steel-100 mb-2">License Expiry</label>
                <input
                  type="date"
                  value={profileData.licenseExpiry}
                  onChange={(e) => setProfileData({...profileData, licenseExpiry: e.target.value})}
                  disabled={!isEditingProfile}
                  className="w-full px-4 py-3 border border-steel-300 rounded-xl focus:ring-2 focus:ring-accent-primary focus:border-accent-primary disabled: transition-colors"
                />
              </div>
            </div>

            {/* Read-only Information */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 p-4  rounded-xl">
              <div>
                <p className="text-sm text-steel-300">Date of Birth</p>
                <p className="font-medium text-primary">{new Date(driverData.dob).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-steel-300">Salary</p>
                <p className="font-medium text-primary">${driverData.salary}/month</p>
              </div>
              <div>
                <p className="text-sm text-steel-300">Employment Status</p>
                <p className="font-medium text-primary">{driverData.onLeave ? 'On Leave' : 'Active'}</p>
              </div>
            </div>

            {isEditingProfile && (
              <div className="mt-6">
                <button
                  onClick={updateProfile}
                  className="bg-green-600  px-6 py-3 rounded-xl hover:bg-green-700 transition-colors shadow-lg flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Save Changes</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}