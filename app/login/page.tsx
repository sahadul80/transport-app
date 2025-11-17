'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import { Driver, User, Admin, Car, Journey, Location, LeaveRequest, SystemStats } from '../types';

interface DemoUser {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'driver' | 'admin';
  designation?: string;
  department?: string;
  currentLocation?: Location;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
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

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [drivers, setDrivers] = useState<DemoUser[]>([]);
  const [isLoadingDemoUsers, setIsLoadingDemoUsers] = useState(true);
  const [apiError, setApiError] = useState<string>('');
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);

  // Geolocation consent states - moved BEFORE login
  const [showGeolocationConsent, setShowGeolocationConsent] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [pendingLogin, setPendingLogin] = useState<{email: string; password: string} | null>(null);
  const [geolocationAllowed, setGeolocationAllowed] = useState<boolean | null>(null);

  const { login, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    const loadDemoUsers = async () => {
      try {
        const response = await fetch('/api/data');
        const result: ApiResponse<ApiDataResponse> = await response.json();

        if (response.ok && result.data) {
          const usersData = result.data.users || [];
          const driversData = result.data.drivers || [];

          const transformedUsers: DemoUser[] = usersData.map(user => ({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            designation: 'designation' in user ? user.designation : undefined,
            department: 'department' in user ? user.department : undefined,
            currentLocation: 'currentLocation' in user ? (user as any).currentLocation : undefined,
          }));

          const transformedDrivers: DemoUser[] = driversData.map(driver => ({
            id: driver.id,
            email: driver.email,
            name: driver.name,
            role: 'driver',
            designation: 'Driver',
            department: 'Transport',
            currentLocation: driver.currentLocation,
          }));

          setUsers(transformedUsers);
          setDrivers(transformedDrivers);
          setApiError('');
        } else {
          throw new Error(result.error || `Failed to fetch data: ${response.status}`);
        }
      } catch (error) {
        console.error('Failed to load demo users:', error);
        setApiError('Failed to load demo accounts from API. Please try refreshing the page.');
        setUsers([]);
        setDrivers([]);
      } finally {
        setIsLoadingDemoUsers(false);
      }
    };

    loadDemoUsers();
  }, []);

  // Countdown for geolocation consent
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (showGeolocationConsent && countdown > 0) {
      timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
    } else if (showGeolocationConsent && countdown === 0) {
      handleGeolocationDeny();
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showGeolocationConsent, countdown]);

  const updateUserLocation = async (userId: string, role: 'user' | 'driver') => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported');
      return;
    }

    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const newLocation: Location = { lat: latitude, lng: longitude, address: 'Getting address...' };

          try {
            const address = await getAddressFromCoordinates(latitude, longitude);
            newLocation.address = address;

            const endpoint = role === 'driver' ? '/api/drivers/location' : '/api/user/location';
            await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ [`${role}Id`]: userId, location: newLocation }),
            });

            console.log(`Updated ${role} location:`, newLocation);
          } catch (err) {
            console.error(`Error updating ${role} location:`, err);
          } finally {
            resolve();
          }
        },
        (err) => {
          console.error('Geolocation error:', err);
          resolve();
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  };

  const getAddressFromCoordinates = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      if (response.ok) {
        const data = await response.json();
        return data.display_name || 'Address not found';
      }
    } catch (err) {
      console.error('Reverse geocoding error:', err);
    }
    // fallback
    const addresses = [
      'Commercial Area, Downtown',
      'Business District Center',
      'Main Street Location',
      'City Center Point',
      'Urban Zone Location'
    ];
    return addresses[Math.floor(Math.random() * addresses.length)];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    // Check if this is a user or driver that needs location
    const allUsers = [...users, ...drivers];
    const user = allUsers.find(u => u.email === email);
    
    if (user && (user.role === 'user' || user.role === 'driver')) {
      // Show geolocation consent BEFORE login
      setPendingLogin({ email, password });
      setShowGeolocationConsent(true);
      setCountdown(10);
      return; // Don't proceed with login yet
    }

    // For admins or if geolocation already decided, proceed with login
    await performLogin(email, password);
  };

  const performLogin = async (email: string, password: string, updateLocationForUser?: {id: string; role: 'user' | 'driver'}) => {
    setIsLoading(true);

    try {
      const success = await login({ email, password });

      if (success) {
        // Update location if allowed and user/driver
        if (updateLocationForUser && geolocationAllowed) {
          setIsUpdatingLocation(true);
          try {
            await updateUserLocation(updateLocationForUser.id, updateLocationForUser.role);
          } catch (err) {
            console.error('Location update failed:', err);
          } finally {
            setIsUpdatingLocation(false);
          }
        }
        router.push('/');
      } else {
        setError('Invalid email or password. Use demo accounts for testing.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeolocationAllow = async () => {
    setGeolocationAllowed(true);
    setShowGeolocationConsent(false);
    
    if (pendingLogin) {
      const allUsers = [...users, ...drivers];
      const user = allUsers.find(u => u.email === pendingLogin.email);
      
      if (user && (user.role === 'user' || user.role === 'driver')) {
        await performLogin(pendingLogin.email, pendingLogin.password, {
          id: user.id,
          role: user.role
        });
      } else {
        await performLogin(pendingLogin.email, pendingLogin.password);
      }
    }
    setPendingLogin(null);
  };

  const handleGeolocationDeny = () => {
    setGeolocationAllowed(false);
    setShowGeolocationConsent(false);
    
    if (pendingLogin) {
      performLogin(pendingLogin.email, pendingLogin.password);
    }
    setPendingLogin(null);
  };

  const fillDemoCredentials = (user: DemoUser) => {
    setEmail(user.email);
    setPassword('password123');
    setError('');

    setTimeout(() => {
      const submitButton = document.querySelector('button[type="submit"]') as HTMLButtonElement;
      submitButton?.click();
    }, 100);
  };

  // Group demo users by role for better organization
  const groupedUsers = {
    'Administrators': users.filter(user => user.role === 'admin'),
    'Managers & Employees': users.filter(user => user.role === 'user'),
    'Drivers': drivers
  };

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'user': return 'User';
      case 'driver': return 'Driver';
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return '  border border-steel-200';
      case 'user': return '  border border-steel-200';
      case 'driver': return '  border border-steel-200';
      default: return '  border border-steel-200';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case 'user':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case 'driver':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      {/* Geolocation Consent Modal - Now shows BEFORE login */}
      {showGeolocationConsent && (
        <div className="fixed inset-0 bg-opacity-50 backdrop-blur-xl flex items-center justify-center z-50 p-2 sm:p-4">
          <div className=" rounded-2xl shadow-xl max-w-md w-full p-2 sm:p-4 animate-in fade-in duration-300">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center m-2">
                <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold ">Location Access Required</h3>
                <p className="text-sm ">For better service experience</p>
              </div>
            </div>
            
            <div className="mb-6">
              <p className=" mb-4">
                To provide you with the best service, we need access to your location. This helps us:
              </p>
              
              <ul className="text-sm  mb-4 space-y-2">
                <li className="flex items-center">
                  <svg className="w-4 h-4 text-green-500 m-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Find optimal pickup locations
                </li>
                <li className="flex items-center">
                  <svg className="w-4 h-4 text-green-500 m-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Provide accurate arrival times
                </li>
                <li className="flex items-center">
                  <svg className="w-4 h-4 text-green-500 m-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Enhance route planning
                </li>
              </ul>
              
              <div className="border border-blue-200 rounded-lg p-2 sm:p-4 mb-4">
                <div className="flex items-center text-sm text-secondary">
                  <svg className="w-4 h-4 m-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Your location data is only used for service optimization and is never shared with third parties.</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-yellow-800 font-medium bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                  Auto-deny in: <span className="font-mono bg-yellow-100 p-1 rounded">{countdown}s</span>
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={handleGeolocationAllow}
                    className="p-2 text-primary text-primary text-sm font-medium rounded-lg hover:text-secondary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors hover:cursor-pointer"
                  >
                    Allow
                  </button>
                  <button
                    onClick={handleGeolocationDeny}
                    className="p-2   text-sm font-medium rounded-lg hover: focus:outline-none focus:ring-2 focus:ring-steel-500 focus:ring-offset-2 transition-colors hover:cursor-pointer"
                  >
                    Deny
                  </button>
                </div>
              </div>
            </div>
            
            <div className="text-xs  text-center">
              You can change location permissions anytime in your browser settings.
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-6xl">
        <div className="flex flex-col sm:flex-row items-center justify-center m-2 sm:m-4 sm:gap-4">
          <div className="rounded-full flex items-center justify-center shadow-lg">
            <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold ">
            Paramount BD Fleet Management
          </h1>
        </div>
        
        <div className=" rounded-2xl shadow-xl overflow-hidden">
          <div className="md:flex">
            {/* Login Form */}
            <div className="md:w-1/2 p-2 sm:p-4">
              <div className="m-2 sm:m-4 flex flex-col sm:flex-row sm:justify-between">
                <h2 className="text-2xl font-bold ">Welcome</h2>
                <p className=" m-1">Sign in to your account</p>
              </div>

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium  mb-2">
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="appearance-none rounded-lg relative block w-full p-2 sm:p-4 border border-steel-300 placeholder-steel-500  focus:outline-none focus:ring-2 focus:ring-steel-500 focus:border-steel-500 transition-colors sm:text-sm"
                    placeholder="Enter your company email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium  mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="appearance-none rounded-lg relative block w-full p-2 sm:p-4 border border-steel-300 placeholder-steel-500  focus:outline-none focus:ring-2 focus:ring-steel-500 focus:border-steel-500 transition-colors sm:text-sm"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 p-2 sm:p-4 border border-red-200 animate-pulse">
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-red-400 m-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-sm text-red-700 font-medium">{error}</div>
                    </div>
                  </div>
                )}
                <div>
                  <button
                    type="submit"
                    disabled={isLoading || isUpdatingLocation}
                    className="group relative w-full flex justify-center p-2 sm:p-4 border border-transparent text-sm font-medium rounded-lg text-primary  hover: focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-steel-500 disabled: disabled:cursor-not-allowed transition-colors shadow-sm transform hover:scale-105 duration-200"
                  >
                    {isLoading || isUpdatingLocation ? (
                      <div className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {isUpdatingLocation ? 'Updating Location...' : 'Signing in...'}
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <svg className="w-5 h-5 m-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                        Sign in to Dashboard
                      </div>
                    )}
                  </button>
                </div>
              </form>

              <div className="p-2 sm:p-4 m-2 sm:m-4 rounded-lg border border-steel-200">
                <div className="flex items-start">
                  <svg className="h-5 w-5 m-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <div className="text-sm">
                    <strong>Location Consent:</strong> User and Driver accounts will prompt for location access before login for better service experience.
                  </div>
                </div>
              </div>

              {/* System Status */}
              <div className="p-2 sm:p-4 m-2 sm:m-4 rounded-lg border border-steel-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium ">System Status</span>
                  <span className="flex items-center text-green-600 text-sm font-medium">
                    <span className="w-2 h-2 bg-green-500 rounded-full m-1 animate-pulse"></span>
                    Operational
                  </span>
                </div>
                <div className="text-xs ">
                  Connected to demo database • {users.length + drivers.length} accounts available • All systems normal
                </div>
              </div>

              {/* Quick Info Cards */}
              <div className="m-2 sm:m-4">
                <h3 className="text-sm font-medium m-2">Role-Based Access</h3>
                <div className="grid grid-cols-1 gap-2 sm:gap-4 sm:grid-cols-3">
                  <div className=" p-2 sm:p-4 rounded-lg border border-steel-200 transition-transform hover:scale-105 duration-200">
                    <div className="flex items-center mb-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center m-1">
                        {getRoleIcon('admin')}
                      </div>
                      <div className="font-semibold text-sm">Admin</div>
                    </div>
                    <div className=" text-xs">Full System Access & Management</div>
                  </div>
                  <div className="p-2 sm:p-4 rounded-lg border border-steel-200 transition-transform hover:scale-105 duration-200">
                    <div className="flex items-center mb-2">
                      <div className="w-8 h-8  rounded-lg flex items-center justify-center m-1">
                        {getRoleIcon('user')}
                      </div>
                      <div className=" font-semibold text-sm">User</div>
                    </div>
                    <div className=" text-xs">Book & Manage Rides</div>
                  </div>
                  <div className=" p-2 sm:p-4 rounded-lg border border-steel-200 transition-transform hover:scale-105 duration-200">
                    <div className="flex items-center mb-2">
                      <div className="w-8 h-8  rounded-lg flex items-center justify-center m-1">
                        {getRoleIcon('driver')}
                      </div>
                      <div className=" font-semibold text-sm">Driver</div>
                    </div>
                    <div className=" text-xs">Manage Journeys & Routes</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Demo Credentials */}
            <div className="md:w-1/2 p-2 sm:p-4 border-l border-steel-200">
              <div className=" rounded-lg p-2 sm:p-4 shadow-sm">
                <h3 className="text-xl font-semibold flex items-center">
                  <svg className="w-5 h-5  m-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Demo Accounts
                </h3>
                <p className="text-sm  mb-4">
                  Choose any demo account to explore the system. All accounts use the same password for testing.
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 text-yellow-600 m-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="text-sm font-medium text-yellow-800">
                      Default Password: <span className="font-mono bg-yellow-100 p-1 rounded border">password123</span>
                    </span>
                  </div>
                </div>
              </div>

              {apiError && (
                <div className="rounded-lg bg-red-50 p-2 sm:p-4 border border-red-200 mb-4">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-red-400 m-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-red-700 font-medium">{apiError}</div>
                  </div>
                </div>
              )}

              {isLoadingDemoUsers ? (
                <div className="flex justify-center items-center p-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-steel-600"></div>
                  <span className="ml-3 text-sm ">Loading demo accounts...</span>
                </div>
              ) : users.length === 0 && drivers.length === 0 ? (
                <div className="text-center p-12">
                  <svg className="mx-auto h-12 w-12 " fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h3 className="m-1 text-sm font-medium ">No demo accounts available</h3>
                  <p className="m-1 text-sm ">
                    Unable to load demo accounts from the server. Please try refreshing the page.
                  </p>
                </div>
              ) : (
                <div className="max-h-[60vh] overflow-y-auto m-2 sm:m-4">
                  {Object.entries(groupedUsers).map(([group, groupUsers]) => (
                    groupUsers.length > 0 && (
                      <div key={group} className="rounded-lg p-2 m-2 shadow-sm border border-steel-200">
                        <h4 className="text-sm font-semibold m-2 flex items-center">
                          <span className={`inline-block w-3 h-3 rounded-full${
                            group === 'Administrators' ? '' :
                            group === 'Managers & Employees' ? '' :
                            ''
                          }`}></span>
                          {group} ({groupUsers.length})
                        </h4>
                        <div className="space-y-2">
                          {groupUsers.map((user) => (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => fillDemoCredentials(user)}
                              className="w-full text-left p-2 text-sm  rounded-lg border border-steel-200 hover:border-steel-300 hover: transition-all duration-200 shadow-sm group transform hover:scale-[1.02]"
                            >
                              <div className="flex justify-between items-start mb-1">
                                <div className="font-semibold  group-hover:">
                                  {user.name}
                                </div>
                                <span className={`text-xs p-1 rounded-full flex items-center ${getRoleColor(user.role)}`}>
                                  <span className="m-1">{getRoleIcon(user.role)}</span>
                                  {getRoleDisplay(user.role)}
                                </span>
                              </div>
                              <div className=" text-xs mb-1">
                                {user.designation} {user.department && `• ${user.department}`}
                              </div>
                              <div className=" text-xs flex items-center truncate">
                                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 7.89a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <span className="truncate">{user.email}</span>
                              </div>
                              {user.currentLocation && (
                                <div className=" text-xs flex items-center m-1">
                                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  <span className="truncate">{user.currentLocation.address}</span>
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="m-2 text-center">
          <p className="text-sm ">
            Paramount BD Fleet Management System • v2.0
          </p>
          <p className="text-xs  m-1">
            For demonstration purposes only
          </p>
        </div>
      </div>
    </div>
  );
}