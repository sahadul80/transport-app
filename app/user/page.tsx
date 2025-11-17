'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import { Admin, Driver, LeaveRequest, SystemStats, User, Journey, Car } from '../types';

// Types
interface Location {
  lat: number;
  lng: number;
  address: string;
}

interface DistanceMetrics {
  day: number;
  month: number;
  year: number;
}

interface BaseUser {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'driver' | 'admin';
  designation?: string;
  department?: string;
  isActive: boolean;
}

interface BookingState {
  isBookingAllowed: boolean;
  lastBookingTime: Date | null;
  cooldownRemaining: number;
  hasActiveRequest: boolean;
}

interface BookingRequest {
  userId: string;
  destination: string;
  status: 'requested';
  timestamp: Date;
}

interface ProfileData {
  name: string;
  email: string;
  designation: string;
  department: string;
}

interface RouteChangeRequest {
  journeyId: string;
  newWaypoint: string;
  reason?: string;
}

interface DropoffRequest {
  journeyId: string;
  location?: Location;
  reason?: string;
}

interface ApiDataResponse {
  users?: (User | Admin)[];
  drivers?: Driver[];
  cars?: Car[];
  journeys?: Journey[];
  locations?: Location[];
  leaveRequests?: LeaveRequest[];
  systemStats?: SystemStats;
}

const COOLDOWN_PERIOD = 5 * 60 * 1000; // 5 minutes in milliseconds

export default function UserDashboard() {
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  
  // State management
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    name: '',
    email: '',
    designation: '',
    department: ''
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [userJourneys, setUserJourneys] = useState<Journey[]>([]);
  const [userCars, setUserCars] = useState<Car[]>([]);
  const [lastJourney, setLastJourney] = useState<Journey | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [bookingState, setBookingState] = useState<BookingState>({
    isBookingAllowed: true,
    lastBookingTime: null,
    cooldownRemaining: 0,
    hasActiveRequest: false
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState<boolean>(false);
  const [isRequestingRouteChange, setIsRequestingRouteChange] = useState<string | null>(null);
  const [isRequestingDropoff, setIsRequestingDropoff] = useState<string | null>(null);
  const [allJourneys, setAllJourneys] = useState<Journey[]>([]);
  const [allCars, setAllCars] = useState<Car[]>([]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // Load user data and check booking status
  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        designation: user.designation || '',
        department: user.department || ''
      });
      loadUserData();
      checkBookingStatus();
    }
  }, [user]);

  // Check booking cooldown timer
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (bookingState.cooldownRemaining > 0) {
      interval = setInterval(() => {
        setBookingState(prev => {
          const newCooldown = prev.cooldownRemaining - 1000;
          if (newCooldown <= 0) {
            return {
              ...prev,
              isBookingAllowed: true,
              cooldownRemaining: 0,
              hasActiveRequest: false
            };
          }
          return {
            ...prev,
            cooldownRemaining: newCooldown
          };
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [bookingState.cooldownRemaining]);

  // API Call: Load all data
  const loadUserData = async (): Promise<void> => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/data');
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Check if data is nested under 'data' property or is the direct response
      const demoData = result.data || result;
      
      if (!demoData) {
        throw new Error('No data received from API');
      }

      // Safely filter journeys for the current user with fallback
      const journeys: Journey[] = (demoData.journeys || []).filter((j: Journey) => j.userId === user?.id);
      setUserJourneys(journeys);
      setAllJourneys(demoData.journeys || []);
      
      if (journeys.length > 0) {
        const last = journeys.sort((a: Journey, b: Journey) => 
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        )[0];
        setLastJourney(last);
      }
      
      // Get cars assigned to the user with safe access
      const userCarsIds = (user as User)?.carsUsed || [];
      const cars: Car[] = (demoData.cars || []).filter((c: Car) => 
        userCarsIds.includes(c.id)
      );
      setUserCars(cars);
      setAllCars(demoData.cars || []);
    } catch (error) {
      console.error('Error loading user data:', error);
      // Fallback to empty data
      setUserJourneys([]);
      setUserCars([]);
      setLastJourney(null);
      setAllJourneys([]);
      setAllCars([]);
    } finally {
      setIsLoading(false);
    }
  };

  // API Call: Update user profile using the dedicated endpoint
  const updateProfile = async (): Promise<void> => {
    try {
      setIsUpdatingProfile(true);
      
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: user?.id,
          email: profileData.email,
          name: profileData.name,
          designation: profileData.designation,
          department: profileData.department
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert('Profile updated successfully');
        setIsEditingProfile(false);
        
        // Reload user data to reflect changes
        loadUserData();
      } else {
        throw new Error(result.error || result.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // API Call: Request transport using dedicated endpoint
  const requestTransport = async (): Promise<void> => {
    const validation = validateBookingRequest();
    if (!validation.isValid) {
      alert(validation.error);
      return;
    }

    setIsSearching(true);
    
    try {
      const response = await fetch('/api/journeys/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.id,
          destination: selectedDestination,
          startLocation: {
            lat: 23.8103,
            lng: 90.4125,
            address: "Paramount BD Head Office, Dhaka"
          },
          notes: "Transport request from user dashboard"
        }),
      });

      const result = await response.json();

      if (response.ok) {
        // Store booking in localStorage
        const bookingRequest: BookingRequest = {
          userId: user?.id || '',
          destination: selectedDestination,
          status: 'requested',
          timestamp: new Date()
        };
        localStorage.setItem(`user_${user?.id}_booking`, JSON.stringify(bookingRequest));

        // Update local state with the new journey
        if (result.data) {
          setUserJourneys(prev => [result.data, ...prev]);
          setAllJourneys(prev => [result.data, ...prev]);
        }

        setBookingState({
          isBookingAllowed: false,
          lastBookingTime: new Date(),
          cooldownRemaining: COOLDOWN_PERIOD,
          hasActiveRequest: true
        });

        alert('Transport request sent to admin. You will be allocated a car and driver soon.');
        setSelectedDestination('');
        setSearchQuery('');
      } else {
        throw new Error(result.error || result.message || 'Failed to request transport');
      }
    } catch (error) {
      console.error('Error requesting transport:', error);
      alert(error instanceof Error ? error.message : 'Failed to request transport. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // API Call: Cancel booking using dedicated endpoint
  const cancelBookingRequest = async (): Promise<void> => {
    if (!window.confirm('Are you sure you want to cancel this booking request?')) {
      return;
    }

    try {
      const requestedJourney = userJourneys.find(j => j.status === 'requested');
      if (!requestedJourney) {
        throw new Error('No active booking request found');
      }

      const response = await fetch('/api/journeys/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          journeyId: requestedJourney.id,
          reason: 'Cancelled by user'
        }),
      });

      const result = await response.json();

      if (response.ok) {
        // Remove from localStorage
        localStorage.removeItem(`user_${user?.id}_booking`);

        // Update local state with the cancelled journey
        if (result.data) {
          setUserJourneys(prev => 
            prev.map(j => 
              j.id === requestedJourney.id ? result.data : j
            )
          );
          setAllJourneys(prev => 
            prev.map(j => 
              j.id === requestedJourney.id ? result.data : j
            )
          );
        }
        
        setBookingState({
          isBookingAllowed: true,
          lastBookingTime: null,
          cooldownRemaining: 0,
          hasActiveRequest: false
        });

        alert('Booking request cancelled successfully.');
      } else {
        throw new Error(result.error || result.message || 'Failed to cancel booking');
      }
    } catch (error) {
      console.error('Error cancelling booking:', error);
      alert(error instanceof Error ? error.message : 'Failed to cancel booking. Please try again.');
    }
  };

  // API Call: Request route change using dedicated endpoint
  const requestRouteChange = async (journeyId: string, newWaypoint: string): Promise<void> => {
    try {
      setIsRequestingRouteChange(journeyId);
      
      const response = await fetch('/api/journeys/route-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          journeyId,
          newWaypoint,
          reason: 'User requested additional stop'
        }),
      });

      const result = await response.json();

      if (response.ok) {
        // For now, we'll update the local state optimistically
        // In a real app, you might want to refetch the journey data
        setUserJourneys(prev => 
          prev.map(j => {
            if (j.id === journeyId) {
              const newWaypointLocation: Location = {
                lat: 0,
                lng: 0,
                address: newWaypoint
              };
              return {
                ...j,
                waypoints: [...j.waypoints, newWaypointLocation],
                routeChanges: [...(j.routeChanges || []), {
                  type: 'waypoint_added',
                  timestamp: new Date().toISOString(),
                  waypoint: newWaypointLocation
                }]
              };
            }
            return j;
          })
        );
        
        alert('Route change request sent to driver');
      } else {
        throw new Error(result.error || result.message || 'Failed to request route change');
      }
    } catch (error) {
      console.error('Error requesting route change:', error);
      alert(error instanceof Error ? error.message : 'Failed to request route change');
    } finally {
      setIsRequestingRouteChange(null);
    }
  };

  // API Call: Request dropoff using dedicated endpoint
  const requestDropoff = async (journeyId: string): Promise<void> => {
    try {
      setIsRequestingDropoff(journeyId);
      
      const response = await fetch('/api/journeys/dropoff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          journeyId,
          reason: 'User requested dropoff'
        }),
      });

      const result = await response.json();

      if (response.ok) {
        // Update local state optimistically
        setUserJourneys(prev => 
          prev.map(j => 
            j.id === journeyId ? { 
              ...j, 
              status: 'completed' as const,
              endTime: new Date().toISOString()
            } : j
          )
        );
        
        alert('Drop-off request sent to driver');
      } else {
        throw new Error(result.error || result.message || 'Failed to request drop-off');
      }
    } catch (error) {
      console.error('Error requesting drop-off:', error);
      alert(error instanceof Error ? error.message : 'Failed to request drop-off');
    } finally {
      setIsRequestingDropoff(null);
    }
  };

  // Helper functions
  const checkBookingStatus = (): void => {
    try {
      const storedBooking = localStorage.getItem(`user_${user?.id}_booking`);
      if (storedBooking) {
        const booking: BookingRequest = JSON.parse(storedBooking);
        const bookingTime = new Date(booking.timestamp);
        const currentTime = new Date();
        const timeDiff = currentTime.getTime() - bookingTime.getTime();

        if (timeDiff < COOLDOWN_PERIOD) {
          setBookingState({
            isBookingAllowed: false,
            lastBookingTime: bookingTime,
            cooldownRemaining: COOLDOWN_PERIOD - timeDiff,
            hasActiveRequest: true
          });
        } else {
          // Clear expired booking
          localStorage.removeItem(`user_${user?.id}_booking`);
        }
      }
    } catch (error) {
      console.error('Error checking booking status:', error);
    }
  };

  const getSearchSuggestions = (query: string): string[] => {
    if (!query) return [];
    
    const allDestinations = userJourneys.map(journey => journey.endLocation.address);
    const uniqueDestinations = [...new Set(allDestinations)];
    
    return uniqueDestinations.filter(dest => 
      dest.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const query = e.target.value;
    setSearchQuery(query);
    setSearchSuggestions(getSearchSuggestions(query));
  };

  const handleSuggestionClick = (suggestion: string): void => {
    setSearchQuery(suggestion);
    setSearchSuggestions([]);
    setSelectedDestination(suggestion);
  };

  const validateBookingRequest = (): { isValid: boolean; error?: string } => {
    if (!selectedDestination) {
      return { isValid: false, error: 'Please select a destination' };
    }

    if (!bookingState.isBookingAllowed) {
      return { isValid: false, error: 'Please wait before making another booking' };
    }

    if (bookingState.hasActiveRequest) {
      return { isValid: false, error: 'You already have an active booking request' };
    }

    return { isValid: true };
  };

  const formatCooldownTime = (milliseconds: number): string => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Derived state
  const completedJourneys = userJourneys.filter(j => j.status === 'completed');
  const activeJourney = userJourneys.find(j => j.status === 'in-progress');
  const requestedJourney = userJourneys.find(j => j.status === 'requested');
  const totalDistance = (user as User)?.totalDistance || { day: 0, month: 0, year: 0 };

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="m-2 sm:m-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-clip-text text-transparent">
                    FleetPro
                  </h1>
                  <p className="text-xs text-tartiary">User Dashboard</p>
                </div>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1">
              {[
                { id: 'dashboard', name: 'Dashboard', icon: '📊' },
                { id: 'profile', name: 'Profile', icon: '👤' },
                { id: 'travel-logs', name: 'Travel Logs', icon: '📝' },
                { id: 'cars', name: 'My Cars', icon: '🚗' },
                { id: 'book-ride', name: 'Book Ride', icon: '📍' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 p-2 rounded-xl font-medium text-sm transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-primary  shadow-lg shadow-blue-500/25'
                      : 'text-secondary hover:text-accent hover:hover:shadow-md'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.name}</span>
                </button>
              ))}
            </nav>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-3 rounded-xl p-2 border border-slate-200">
                <div className="w-8 h-8 rounded-full flex items-center justify-center  text-sm font-medium">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-accent">{user.name}</p>
                  <p className="text-xs text-tartiary">{user.designation}</p>
                </div>
              </div>
              
              <button
                onClick={logout}
                className="bg-primary  p-2 rounded-xl hover:bg-secondary transition-colors shadow-lg flex items-center space-x-2"
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
                <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMobileMenuOpen && (
            <div className="md:hidden p-2 sm:p-4 border-t border-slate-200 backdrop-blur-md rounded-b-2xl shadow-lg">
              <nav className="flex flex-col space-y-2">
                {[
                  { id: 'dashboard', name: 'Dashboard', icon: '📊' },
                  { id: 'profile', name: 'Profile', icon: '👤' },
                  { id: 'travel-logs', name: 'Travel Logs', icon: '📝' },
                  { id: 'cars', name: 'My Cars', icon: '🚗' },
                  { id: 'book-ride', name: 'Book Ride', icon: '📍' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex items-center space-x-3 p-2 sm:p-4 rounded-xl font-medium text-sm transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-primary  shadow-lg shadow-blue-500/25'
                        : 'text-secondary hover:text-accent hover:'
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

      <div className="max-w-7xl mx-auto p-2 sm:p-4">
        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center p-4 sm:p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Welcome Banner */}
        {!isLoading && (
          <div className="rounded-2xl p-2 sm:p-4  shadow-xl">
            <div className="flex flex-col sm:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-2">Welcome, {user.name}! 👋</h2>
                <p className=" opacity-90">
                  {user.designation} • {user.department}
                </p>
              </div>
              <div className="m-2 sm:m-4 flex items-center space-x-4">
                <div className="text-right">
                  <p className=" text-sm">Today's Distance</p>
                  <p className="text-2xl font-bold">{totalDistance.day} km</p>
                </div>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Tab */}
        {!isLoading && activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="rounded-2xl p-6 shadow-lg border border-slate-100 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-tartiary text-sm font-medium">Monthly Distance</p>
                    <p className="text-3xl font-bold text-accent m-1">{totalDistance.month} km</p>
                    <p className="text-green-600 text-sm font-medium m-1 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                      +12% from last month
                    </p>
                  </div>
                  <div className="w-12 h-12  rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl p-6 shadow-lg border border-slate-100 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-tartiary text-sm font-medium">Yearly Distance</p>
                    <p className="text-3xl font-bold text-accent m-1">{totalDistance.year} km</p>
                    <p className="text-tartiary text-sm m-1">Total travel</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl p-6 shadow-lg border border-slate-100 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-tartiary text-sm font-medium">Completed Rides</p>
                    <p className="text-3xl font-bold text-accent m-1">{completedJourneys.length}</p>
                    <p className="text-tartiary text-sm m-1">All time</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl p-6 shadow-lg border border-slate-100 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-tartiary text-sm font-medium">Available Cars</p>
                    <p className="text-3xl font-bold text-accent m-1">{userCars.length}</p>
                    <p className="text-tartiary text-sm m-1">Assigned to you</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Journey & Last Journey */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Active Journey */}
              {activeJourney && (
                <div className="rounded-2xl p-6 shadow-lg border border-slate-100">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-accent">Active Journey</h3>
                    <span className="p-2  text-accent text-sm font-medium rounded-full animate-pulse">
                      Live
                    </span>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-tartiary">From</p>
                        <p className="font-medium text-accent">{activeJourney.startLocation.address}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8  rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-tartiary">To</p>
                        <p className="font-medium text-accent">{activeJourney.endLocation.address}</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                      <div>
                        <p className="text-sm text-tartiary">Distance</p>
                        <p className="font-medium text-accent">{activeJourney.distance} km</p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => requestRouteChange(activeJourney.id, 'New stop requested')}
                          disabled={isRequestingRouteChange === activeJourney.id}
                          className="bg-yellow-500  p-2 rounded-xl hover:bg-yellow-600 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isRequestingRouteChange === activeJourney.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                          <span>Change Route</span>
                        </button>
                        <button
                          onClick={() => requestDropoff(activeJourney.id)}
                          disabled={isRequestingDropoff === activeJourney.id}
                          className="bg-red-500  p-2 rounded-xl hover:bg-red-600 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isRequestingDropoff === activeJourney.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                          )}
                          <span>Drop-off</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Last Journey */}
              {lastJourney && (
                <div className="rounded-2xl p-6 shadow-lg border border-slate-100">
                  <h3 className="text-lg font-semibold text-accent mb-6">Last Journey</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-tartiary">Destination</span>
                      <span className="font-medium text-accent">{lastJourney.endLocation.address}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-tartiary">Date</span>
                      <span className="font-medium text-accent">
                        {formatDate(lastJourney.startTime)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-tartiary">Distance</span>
                      <span className="font-medium text-accent">{lastJourney.distance} km</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-tartiary">Rating</span>
                      <span className="font-medium text-accent">
                        {lastJourney.rating ? (
                          <div className="flex space-x-1">
                            {[...Array(5)].map((_, i) => (
                              <span key={i} className={i < lastJourney.rating! ? 'text-yellow-400' : ''}>
                                ⭐
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-accent">Not rated</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="rounded-2xl p-6 shadow-lg border border-slate-100">
              <h3 className="text-lg font-semibold text-accent mb-6">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => setActiveTab('book-ride')}
                  className="p-6 border-2 border-dashed border-slate-200 rounded-2xl hover:border-blue-500 hover:transition-all duration-300 group text-center"
                >
                  <div className="w-12 h-12  rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:transition-colors">
                    <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-primary group-hover:text-secondary">Book New Ride</span>
                </button>
                
                <button
                  onClick={() => setActiveTab('travel-logs')}
                  className="p-6 border-2 border-dashed border-slate-200 rounded-2xl hover:border-green-500 hover:bg-green-50 transition-all duration-300 group text-center"
                >
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:bg-green-200 transition-colors">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-primary group-hover:text-green-700">View Travel History</span>
                </button>
                
                <button
                  onClick={() => setActiveTab('profile')}
                  className="p-6 border-2 border-dashed border-slate-200 rounded-2xl hover:border-purple-500 hover:bg-purple-50 transition-all duration-300 group text-center"
                >
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:bg-purple-200 transition-colors">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-primary group-hover:text-purple-700">Update Profile</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Profile Tab */}
        {!isLoading && activeTab === 'profile' && (
          <div className="rounded-2xl p-6 shadow-lg border border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
              <h3 className="text-lg font-semibold text-accent">Profile Information</h3>
              <button
                onClick={() => setIsEditingProfile(!isEditingProfile)}
                className="bg-primary p-2 rounded-xl transition-colors shadow-lg flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>{isEditingProfile ? 'Cancel' : 'Edit Profile'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-primary mb-2">Name</label>
                <input
                  type="text"
                  value={profileData.name}
                  onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                  disabled={!isEditingProfile}
                  className="w-full p-2 sm:p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled: transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-primary mb-2">Email</label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                  disabled={!isEditingProfile}
                  className="w-full p-2 sm:p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled: transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-primary mb-2">Designation</label>
                <input
                  type="text"
                  value={profileData.designation}
                  onChange={(e) => setProfileData({...profileData, designation: e.target.value})}
                  disabled={!isEditingProfile}
                  className="w-full p-2 sm:p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled: transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-primary mb-2">Department</label>
                <input
                  type="text"
                  value={profileData.department}
                  onChange={(e) => setProfileData({...profileData, department: e.target.value})}
                  disabled={!isEditingProfile}
                  className="w-full p-2 sm:p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled: transition-colors"
                />
              </div>
            </div>

            {isEditingProfile && (
              <div className="m-2">
                <button
                  onClick={updateProfile}
                  disabled={isUpdatingProfile}
                  className="bg-green-600  p-2 sm:p-4 rounded-xl hover:bg-green-700 transition-colors shadow-lg flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdatingProfile ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  <span>{isUpdatingProfile ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Travel Logs Tab */}
        {!isLoading && activeTab === 'travel-logs' && (
          <div className="rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-accent">Travel History</h3>
            </div>
            {userJourneys.length === 0 ? (
              <div className="p-8 text-center text-tartiary">
                No travel history found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="">
                    <tr>
                      <th className="p-2 sm:p-4 text-left text-xs font-medium text-tartiary uppercase tracking-wider">
                        Date
                      </th>
                      <th className="p-2 sm:p-4 text-left text-xs font-medium text-tartiary uppercase tracking-wider">
                        From → To
                      </th>
                      <th className="p-2 sm:p-4 text-left text-xs font-medium text-tartiary uppercase tracking-wider">
                        Distance
                      </th>
                      <th className="p-2 sm:p-4 text-left text-xs font-medium text-tartiary uppercase tracking-wider">
                        Status
                      </th>
                      <th className="p-2 sm:p-4 text-left text-xs font-medium text-tartiary uppercase tracking-wider">
                        Rating
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {userJourneys.map((journey) => (
                      <tr key={journey.id} className="hover: transition-colors">
                        <td className="p-2 sm:p-4 whitespace-nowrap text-sm text-primary">
                          {formatDate(journey.startTime)}
                        </td>
                        <td className="p-2 sm:p-4 text-sm text-primary">
                          <div className="font-medium">{journey.startLocation.address}</div>
                          <div className="text-tartiary text-xs">→ {journey.endLocation.address}</div>
                        </td>
                        <td className="p-2 sm:p-4 whitespace-nowrap text-sm text-primary">
                          {journey.distance} km
                        </td>
                        <td className="p-2 sm:p-4 whitespace-nowrap">
                          <span className={`p-2 text-xs rounded-full font-medium ${
                            journey.status === 'completed' ? 'bg-green-100 text-green-800' :
                            journey.status === 'in-progress' ? ' text-accent animate-pulse' :
                            journey.status === 'requested' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {journey.status}
                          </span>
                        </td>
                        <td className="p-2 sm:p-4 whitespace-nowrap text-sm text-primary">
                          {journey.rating ? (
                            <div className="flex space-x-1">
                              {[...Array(5)].map((_, i) => (
                                <span key={i} className={i < journey.rating! ? 'text-yellow-400' : ''}>
                                  ⭐
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-accent">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Cars Tab */}
        {!isLoading && activeTab === 'cars' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userCars.length === 0 ? (
              <div className="col-span-full p-8 text-center text-tartiary">
                No cars assigned to you.
              </div>
            ) : (
              userCars.map((car) => (
                <div key={car.id} className="p-6 rounded-2xl shadow-lg border border-slate-100 hover:shadow-xl transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-accent">{car.model}</h4>
                    <span className={`p-2 text-xs rounded-full font-medium ${
                      car.status === 'available' ? 'bg-green-100 text-green-800' :
                      car.status === 'in-use' ? ' text-accent' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {car.status}
                    </span>
                  </div>
                  <div className="space-y-3 text-sm text-secondary">
                    <div className="flex justify-between items-center p-2 border-b border-slate-100">
                      <span>Registration</span>
                      <span className="font-medium text-accent  p-1 rounded-lg">{car.regNo}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 border-b border-slate-100">
                      <span>Cleanliness</span>
                      <span className={`font-medium ${car.isClean ? 'text-green-600' : 'text-red-600'}`}>
                        {car.isClean ? '✅ Clean' : '❌ Needs Cleaning'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-2 border-b border-slate-100">
                      <span>Service</span>
                      <span className={`font-medium ${car.needsServicing ? 'text-red-600' : 'text-green-600'}`}>
                        {car.needsServicing ? '🔧 Needs Service' : '✅ Good'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-2">
                      <span>Location</span>
                      <span className="font-medium text-accent">{car.currentLocation.address}</span>
                    </div>
                  </div>
                  <div className="m-2 border-t border-slate-100">
                    <p className="text-xs text-tartiary mb-2">Total Distance Travelled</p>
                    <div className="flex justify-between text-xs">
                      <span>Day: {car.totalDistanceTravelled.day}km</span>
                      <span>Month: {car.totalDistanceTravelled.month}km</span>
                      <span>Year: {car.totalDistanceTravelled.year}km</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Book Ride Tab */}
        {!isLoading && activeTab === 'book-ride' && (
          <div className="rounded-2xl p-6 shadow-lg border border-slate-100">
            <h3 className="text-lg font-semibold text-accent mb-6 text-center">Book a Ride</h3>
            
            {/* Booking Status Alert */}
            {bookingState.hasActiveRequest && (
              <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-yellow-800">Booking Request Pending</p>
                      <p className="text-yellow-700 text-sm">
                        You have an active booking request. Please wait for admin allocation.
                        {!bookingState.isBookingAllowed && (
                          <span className="font-semibold ml-1">
                            Next booking available in: {formatCooldownTime(bookingState.cooldownRemaining)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={cancelBookingRequest}
                    className="bg-red-500  p-2 rounded-lg hover:bg-red-600 transition-colors text-sm"
                  >
                    Cancel Request
                  </button>
                </div>
              </div>
            )}

            {requestedJourney && (
              <div className="mb-6 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8  rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-accent">Journey Requested</p>
                    <p className="text-secondary text-sm">
                      Your journey to <strong>{requestedJourney.endLocation.address}</strong> is waiting for admin approval.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
              <div>
                {/* Search Destination */}
                <div className="relative">
                  <label className="block text-sm font-medium text-primary mb-2">
                    Enter Destination
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={handleSearchChange}
                      placeholder="Type your destination..."
                      disabled={!bookingState.isBookingAllowed || bookingState.hasActiveRequest}
                      className={`w-full p-2 sm:p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                        (!bookingState.isBookingAllowed || bookingState.hasActiveRequest) ? ' cursor-not-allowed' : ''
                      }`}
                    />
                    {searchSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full m-1 border border-slate-300 rounded-xl shadow-lg overflow-hidden backdrop-blur-xl">
                        {searchSuggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => handleSuggestionClick(suggestion)}
                            disabled={!bookingState.isBookingAllowed}
                            className="w-full text-left p-2 sm:p-4 hover:cursor-pointer hover:scale-95 transition-colors flex items-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            <span>{suggestion}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-tartiary m-1 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {searchSuggestions.length > 0 ? 'Suggestions from your travel history' : 'Start typing to see suggestions from your travel history'}
                  </p>
                </div>

                {/* Selected Destination */}
                {selectedDestination && (
                  <div className="p-4 rounded-xl border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8  rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium ">Selected Destination</p>
                          <p className="text-secondary">{selectedDestination}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedDestination('');
                          setSearchQuery('');
                        }}
                        disabled={!bookingState.isBookingAllowed}
                        className="text-primary hover:text-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {/* Request Button */}
                <div className="flex space-x-4">
                  <button
                    onClick={requestTransport}
                    disabled={!selectedDestination || isSearching || !bookingState.isBookingAllowed || bookingState.hasActiveRequest}
                    className="flex-1 m-2 sm:m-4 p-2 rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center space-x-3 hover:scale-95 hover:border"
                  >
                    {isSearching ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Requesting Transport...</span>
                      </>
                    ) : !bookingState.isBookingAllowed ? (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>
                          Available in {formatCooldownTime(bookingState.cooldownRemaining)}
                        </span>
                      </>
                    ) : bookingState.hasActiveRequest ? (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Request Pending</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span>Request Transport</span>
                      </>
                    )}
                  </button>
                </div>
                {/* Booking Restrictions Info */}
                <div className="p-4 rounded-xl border border-orange-200">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-orange-800">Booking Restrictions</p>
                      <p className="text-orange-700 text-sm">
                        • Only one active booking request allowed at a time<br/>
                        • 5-minute cooldown period between bookings<br/>
                        • Previous booking must be completed or cancelled
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="p-6 rounded-xl">
                <h4 className="text-sm font-medium text-accent mb-3 flex items-center space-x-2">
                  <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>How it works:</span>
                </h4>
                <ul className="text-sm text-secondary space-y-2">
                  <li className="flex items-center space-x-3">
                    <div className="w-6 h-6  rounded-full flex items-center justify-center text-primary text-xs font-medium">1</div>
                    <span>Enter your destination above</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <div className="w-6 h-6  rounded-full flex items-center justify-center text-primary text-xs font-medium">2</div>
                    <span>Click "Request Transport"</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <div className="w-6 h-6  rounded-full flex items-center justify-center text-primary text-xs font-medium">3</div>
                    <span>Wait for admin to allocate car and driver</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <div className="w-6 h-6  rounded-full flex items-center justify-center text-primary text-xs font-medium">4</div>
                    <span>You can make another request after 5 minutes</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <div className="w-6 h-6  rounded-full flex items-center justify-center text-primary text-xs font-medium">5</div>
                    <span>During ride, you can request route changes or drop-off</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}