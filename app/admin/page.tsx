'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import { User, Driver, Car, Journey, SystemStats } from '../types';

export default function AdminDashboard() {
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Data states
  const [users, setUsers] = useState<User[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats>({
    totalUsers: 0,
    totalDrivers: 0,
    totalCars: 0,
    activeJourneys: 0,
    pendingRequests: 0,
    availableCars: 0,
    driversOnLeave: 0,
    monthlyDistance: 0
  });

  // Management states
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null);
  const [assigningCar, setAssigningCar] = useState(false);
  const [selectedCar, setSelectedCar] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Form states for adding/editing
  const [showUserForm, setShowUserForm] = useState(false);
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState('');

  // Form data states
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    designation: '',
    department: '',
    password: '' // Added for new user creation
  });

  const [driverFormData, setDriverFormData] = useState({
    name: '',
    email: '',
    dob: '',
    licenseNo: '',
    licenseExpiry: '',
    salary: 0,
    totalLeave: 20,
    password: '' // Added for new driver creation
  });

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else if (user && (user.role as string) !== 'admin') {
      router.push('/login');
    }
  }, [isAuthenticated, user, router]);

  // Load all data
  useEffect(() => {
    if (user && (user.role as string) === 'admin') {
      loadAdminData();
    }
  }, [user]);

  const loadAdminData = async (): Promise<void> => {
    try {
      setIsLoading(true);
      console.log('Loading admin data...');
      
      const response = await fetch('/api/data');
      if (!response.ok) {
        throw new Error(`Failed to load data: ${response.status}`);
      }
      
      const result = await response.json();
      const demoData = result.data || result;
      console.log('Loaded demo data:', demoData);
      
      // Ensure all users have isActive property
      const usersWithActiveStatus = (demoData.users || []).map((user: User) => ({
        ...user,
        isActive: user.isActive !== undefined ? user.isActive : true
      }));
      
      setUsers(usersWithActiveStatus);
      setDrivers(demoData.drivers || []);
      setCars(demoData.cars || []);
      
      // Enhance journeys with user, driver, and car info
      const enhancedJourneys = (demoData.journeys || []).map((journey: Journey) => {
        const journeyUser = demoData.users.find((u: User) => u.id === journey.userId);
        const journeyDriver = demoData.drivers.find((d: Driver) => d.id === journey.driverId);
        const journeyCar = demoData.cars.find((c: Car) => c.id === journey.carId);
        
        return {
          ...journey,
          userName: journeyUser?.name || 'Unknown User',
          driverName: journeyDriver?.name || 'Unassigned',
          carModel: journeyCar?.model || 'Unknown Car'
        };
      });
      
      setJourneys(enhancedJourneys);
      console.log('Enhanced journeys:', enhancedJourneys);
      
      // Calculate system stats
      const stats: SystemStats = {
        totalUsers: demoData.users?.length || 0,
        totalDrivers: demoData.drivers?.length || 0,
        totalCars: demoData.cars?.length || 0,
        activeJourneys: enhancedJourneys.filter((j: Journey) => j.status === 'in-progress').length,
        pendingRequests: enhancedJourneys.filter((j: Journey) => j.status === 'requested').length,
        availableCars: demoData.cars?.filter((c: Car) => c.status === 'available').length || 0,
        driversOnLeave: demoData.drivers?.filter((d: Driver) => d.onLeave).length || 0,
        monthlyDistance: (demoData.users || []).reduce((sum: number, u: User) => sum + (u.totalDistance?.month || 0), 0)
      };
      
      setSystemStats(stats);
      console.log('System stats:', stats);
      
    } catch (error) {
      console.error('Error loading admin data:', error);
      alert('Failed to load admin data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // User Management Functions
  const handleAddUser = () => {
    setEditingUser(null);
    setUserFormData({
      name: '',
      email: '',
      designation: '',
      department: '',
      password: ''
    });
    setShowUserForm(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setUserFormData({
      name: user.name,
      email: user.email,
      designation: user.designation,
      department: user.department,
      password: '' // Don't show existing password
    });
    setShowUserForm(true);
  };

  // API Call: Save user using dedicated endpoint
  const handleSaveUser = async () => {
    if (!userFormData.name || !userFormData.email || !userFormData.designation || !userFormData.department) {
      alert('Please fill all required fields');
      return;
    }

    // For new users, password is required
    if (!editingUser && !userFormData.password) {
      alert('Please set a password for the new user');
      return;
    }

    try {
      let response;
      
      if (editingUser) {
        // Update existing user
        response = await fetch('/api/user/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: editingUser.id,
            email: userFormData.email,
            name: userFormData.name,
            designation: userFormData.designation,
            department: userFormData.department
          }),
        });
      } else {
        // Create new user - we'll need to create a separate endpoint for this
        response = await fetch('/api/admin/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: userFormData.name,
            email: userFormData.email,
            password: userFormData.password,
            designation: userFormData.designation,
            department: userFormData.department,
            role: 'user'
          }),
        });
      }

      const result = await response.json();

      if (response.ok) {
        alert(editingUser ? 'User updated successfully!' : 'User added successfully!');
        setShowUserForm(false);
        setEditingUser(null);
        setUserFormData({
          name: '',
          email: '',
          designation: '',
          department: '',
          password: ''
        });
        await loadAdminData();
      } else {
        throw new Error(result.error || result.message || 'Failed to save user');
      }
    } catch (error) {
      console.error('Error saving user:', error);
      alert(error instanceof Error ? error.message : 'Failed to save user. Please try again.');
    }
  };

  // API Call: Toggle user status
  const handleDisableUser = async (userId: string, isActive: boolean) => {
    if (!window.confirm(`Are you sure you want to ${isActive ? 'disable' : 'enable'} this user?`)) {
      return;
    }

    try {
      const response = await fetch('/api/admin/users/status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          isActive: !isActive
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert(`User ${isActive ? 'disabled' : 'enabled'} successfully!`);
        await loadAdminData();
      } else {
        throw new Error(result.error || result.message || 'Failed to update user status');
      }
    } catch (error) {
      console.error('Error updating user status:', error);
      alert(error instanceof Error ? error.message : 'Failed to update user status. Please try again.');
    }
  };

  // Driver Management Functions
  const handleAddDriver = () => {
    setEditingDriver(null);
    setDriverFormData({
      name: '',
      email: '',
      dob: '',
      licenseNo: '',
      licenseExpiry: '',
      salary: 0,
      totalLeave: 20,
      password: ''
    });
    setShowDriverForm(true);
  };

  const handleEditDriver = (driver: Driver) => {
    setEditingDriver(driver);
    setDriverFormData({
      name: driver.name,
      email: driver.email,
      dob: driver.dob,
      licenseNo: driver.licenseNo,
      licenseExpiry: driver.licenseExpiry,
      salary: driver.salary,
      totalLeave: driver.totalLeave,
      password: '' // Don't show existing password
    });
    setShowDriverForm(true);
  };

  // API Call: Save driver using dedicated endpoint
  const handleSaveDriver = async () => {
    if (!driverFormData.name || !driverFormData.email || !driverFormData.licenseNo || !driverFormData.licenseExpiry) {
      alert('Please fill all required fields');
      return;
    }

    // For new drivers, password is required
    if (!editingDriver && !driverFormData.password) {
      alert('Please set a password for the new driver');
      return;
    }

    try {
      let response;
      
      if (editingDriver) {
        // Update existing driver
        response = await fetch('/api/admin/drivers', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: editingDriver.id,
            name: driverFormData.name,
            email: driverFormData.email,
            dob: driverFormData.dob,
            licenseNo: driverFormData.licenseNo,
            licenseExpiry: driverFormData.licenseExpiry,
            salary: driverFormData.salary,
            totalLeave: driverFormData.totalLeave
          }),
        });
      } else {
        // Create new driver
        response = await fetch('/api/admin/drivers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: driverFormData.name,
            email: driverFormData.email,
            password: driverFormData.password,
            dob: driverFormData.dob,
            licenseNo: driverFormData.licenseNo,
            licenseExpiry: driverFormData.licenseExpiry,
            salary: driverFormData.salary,
            totalLeave: driverFormData.totalLeave,
            role: 'driver'
          }),
        });
      }

      const result = await response.json();

      if (response.ok) {
        alert(editingDriver ? 'Driver updated successfully!' : 'Driver added successfully!');
        setShowDriverForm(false);
        setEditingDriver(null);
        setDriverFormData({
          name: '',
          email: '',
          dob: '',
          licenseNo: '',
          licenseExpiry: '',
          salary: 0,
          totalLeave: 20,
          password: ''
        });
        await loadAdminData();
      } else {
        throw new Error(result.error || result.message || 'Failed to save driver');
      }
    } catch (error) {
      console.error('Error saving driver:', error);
      alert(error instanceof Error ? error.message : 'Failed to save driver. Please try again.');
    }
  };

  // API Call: Assign car and driver to journey
  const assignCarAndDriver = async (journeyId: string): Promise<void> => {
    if (!selectedCar || !selectedDriver) {
      alert('Please select both a car and a driver');
      return;
    }

    setAssigningCar(true);

    try {
      const response = await fetch('/api/admin/journeys/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          journeyId,
          carId: selectedCar,
          driverId: selectedDriver
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert('Car and driver assigned successfully!');
        setSelectedJourney(null);
        setSelectedCar('');
        setSelectedDriver('');
        await loadAdminData();
      } else {
        throw new Error(result.error || result.message || 'Failed to assign car and driver');
      }
    } catch (error) {
      console.error('Error assigning car and driver:', error);
      alert(error instanceof Error ? error.message : 'Failed to assign car and driver');
    } finally {
      setAssigningCar(false);
    }
  };

  // API Call: Update car status
  const updateCarStatus = async (carId: string, status: Car['status']): Promise<void> => {
    setUpdatingStatus(`car-${carId}`);
    
    try {
      const response = await fetch('/api/admin/cars/status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          carId,
          status
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert(`Car status updated to ${status}`);
        await loadAdminData();
      } else {
        throw new Error(result.error || result.message || 'Failed to update car status');
      }
    } catch (error) {
      console.error('Error updating car status:', error);
      alert(error instanceof Error ? error.message : 'Failed to update car status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  // API Call: Update driver status (leave)
  const updateDriverStatus = async (driverId: string, onLeave: boolean): Promise<void> => {
    setUpdatingStatus(`driver-${driverId}`);
    
    try {
      const response = await fetch('/api/admin/drivers/status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driverId,
          onLeave
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert(`Driver status updated to ${onLeave ? 'on leave' : 'active'}`);
        await loadAdminData();
      } else {
        throw new Error(result.error || result.message || 'Failed to update driver status');
      }
    } catch (error) {
      console.error('Error updating driver status:', error);
      alert(error instanceof Error ? error.message : 'Failed to update driver status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  // API Call: Cancel journey
  const cancelJourney = async (journeyId: string): Promise<void> => {
    if (!window.confirm('Are you sure you want to cancel this journey?')) {
      return;
    }

    setUpdatingStatus(`journey-${journeyId}`);
    
    try {
      const response = await fetch('/api/journeys/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          journeyId,
          reason: 'Cancelled by admin'
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert('Journey cancelled successfully');
        await loadAdminData();
      } else {
        throw new Error(result.error || result.message || 'Failed to cancel journey');
      }
    } catch (error) {
      console.error('Error cancelling journey:', error);
      alert(error instanceof Error ? error.message : 'Failed to cancel journey');
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Report Functions
  const generateReport = async (type: string) => {
    setReportType(type);
    
    try {
      const response = await fetch('/api/admin/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportType: type,
          format: type === 'custom' ? 'excel' : type
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert(`${type.toUpperCase()} report generated successfully!`);
        console.log('Report generated:', result);
        setShowReportModal(false);
      } else {
        throw new Error(result.error || result.message || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      alert(error instanceof Error ? error.message : 'Failed to generate report. Please try again.');
    }
  };

  const handleQuickReport = (type: string) => {
    setReportType(type);
    setShowReportModal(true);
  };

  // Helper Functions
  const getAvailableCars = (): Car[] => {
    return cars.filter(car => car.status === 'available');
  };

  const getAvailableDrivers = (): Driver[] => {
    return drivers.filter(driver => !driver.onLeave);
  };

  const getPendingJourneys = (): Journey[] => {
    return journeys.filter(journey => journey.status === 'requested');
  };

  const getActiveJourneys = (): Journey[] => {
    return journeys.filter(journey => journey.status === 'in-progress');
  };

  if (!isAuthenticated || (user?.role as string) !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading system data...</p>
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-clip-text text-transparent">
                    FleetPro
                  </h1>
                  <p className="text-xs text-accent">Admin Dashboard</p>
                </div>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1">
              {[
                { id: 'dashboard', name: 'Dashboard', icon: '📊' },
                { id: 'journeys', name: 'Journeys', icon: '🚗' },
                { id: 'users', name: 'Users', icon: '👥' },
                { id: 'drivers', name: 'Drivers', icon: '👤' },
                { id: 'cars', name: 'Cars', icon: '🔑' },
                { id: 'reports', name: 'Reports', icon: '📈' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium text-sm transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-primary  shadow-lg shadow-purple-500/25'
                      : 'text-secondary hover:text-primary hover:hover:shadow-md'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.name}</span>
                </button>
              ))}
            </nav>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-3 rounded-xl px-4 py-2 border border-slate-200">
                <div className="w-8 h-8 rounded-full flex items-center justify-center  text-sm font-medium">
                  {(user?.name?.charAt(0) ?? '').toUpperCase()}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-primary">{user?.name ?? 'Admin'}</p>
                  <p className="text-xs text-accent">System Administrator</p>
                </div>
              </div>
              
              <button
                onClick={() => logout()}
                className="bg-primary  px-4 py-2 rounded-xl hover:bg-secondary transition-colors shadow-lg flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Logout</span>
              </button>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-lg bg-background hover:bg-foreground transition-colors"
              >
                <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-slate-200 backdrop-blur-md rounded-b-2xl shadow-lg">
              <nav className="flex flex-col space-y-2">
                {[
                  { id: 'dashboard', name: 'Dashboard', icon: '📊' },
                  { id: 'journeys', name: 'Journeys', icon: '🚗' },
                  { id: 'users', name: 'Users', icon: '👥' },
                  { id: 'drivers', name: 'Drivers', icon: '👤' },
                  { id: 'cars', name: 'Cars', icon: '🔑' },
                  { id: 'reports', name: 'Reports', icon: '📈' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-primary  shadow-lg shadow-purple-500/25'
                        : 'text-secondary hover:text-primary hover:bg-background'
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

      {/* Modals */}
      {/* Add/Edit User Modal */}
      {showUserForm && (
        <div className="fixed inset-0  bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-primary mb-4">
              {editingUser ? 'Edit User' : 'Add New User'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-tartiary mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({...userFormData, name: e.target.value})}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                  placeholder="Enter full name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-tartiary mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({...userFormData, email: e.target.value})}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                  placeholder="Enter email address"
                />
              </div>
              
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-tartiary mb-2">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({...userFormData, password: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                    placeholder="Set password"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-tartiary mb-2">
                  Designation *
                </label>
                <input
                  type="text"
                  value={userFormData.designation}
                  onChange={(e) => setUserFormData({...userFormData, designation: e.target.value})}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                  placeholder="Enter designation"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-tartiary mb-2">
                  Department *
                </label>
                <input
                  type="text"
                  value={userFormData.department}
                  onChange={(e) => setUserFormData({...userFormData, department: e.target.value})}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                  placeholder="Enter department"
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleSaveUser}
                className="flex-1 bg-primary  py-3 px-6 rounded-xl hover:bg-secondary transition-colors"
              >
                {editingUser ? 'Update User' : 'Add User'}
              </button>
              <button
                onClick={() => {
                  setShowUserForm(false);
                  setEditingUser(null);
                }}
                className="flex-1 bg-tartiary  py-3 px-6 rounded-xl hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Driver Modal */}
      {showDriverForm && (
        <div className="fixed inset-0  bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-primary mb-4">
              {editingDriver ? 'Edit Driver' : 'Add New Driver'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-tartiary mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={driverFormData.name}
                  onChange={(e) => setDriverFormData({...driverFormData, name: e.target.value})}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                  placeholder="Enter full name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-tartiary mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={driverFormData.email}
                  onChange={(e) => setDriverFormData({...driverFormData, email: e.target.value})}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                  placeholder="Enter email address"
                />
              </div>
              
              {!editingDriver && (
                <div>
                  <label className="block text-sm font-medium text-tartiary mb-2">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={driverFormData.password}
                    onChange={(e) => setDriverFormData({...driverFormData, password: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                    placeholder="Set password"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-tartiary mb-2">
                  Date of Birth *
                </label>
                <input
                  type="date"
                  value={driverFormData.dob}
                  onChange={(e) => setDriverFormData({...driverFormData, dob: e.target.value})}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-tartiary mb-2">
                  License Number *
                </label>
                <input
                  type="text"
                  value={driverFormData.licenseNo}
                  onChange={(e) => setDriverFormData({...driverFormData, licenseNo: e.target.value})}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                  placeholder="Enter license number"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-tartiary mb-2">
                  License Expiry *
                </label>
                <input
                  type="date"
                  value={driverFormData.licenseExpiry}
                  onChange={(e) => setDriverFormData({...driverFormData, licenseExpiry: e.target.value})}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-tartiary mb-2">
                  Salary ($)
                </label>
                <input
                  type="number"
                  value={driverFormData.salary}
                  onChange={(e) => setDriverFormData({...driverFormData, salary: Number(e.target.value)})}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                  placeholder="Enter salary"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-tartiary mb-2">
                  Total Leave Days
                </label>
                <input
                  type="number"
                  value={driverFormData.totalLeave}
                  onChange={(e) => setDriverFormData({...driverFormData, totalLeave: Number(e.target.value)})}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                  placeholder="Enter total leave days"
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleSaveDriver}
                className="flex-1 bg-primary  py-3 px-6 rounded-xl hover:bg-secondary transition-colors"
              >
                {editingDriver ? 'Update Driver' : 'Add Driver'}
              </button>
              <button
                onClick={() => {
                  setShowDriverForm(false);
                  setEditingDriver(null);
                }}
                className="flex-1 bg-tartiary  py-3 px-6 rounded-xl hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Journey Assignment Modal */}
      {selectedJourney && (
        <div className="fixed inset-0  bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-primary mb-4">
              Assign Car & Driver
            </h3>
            <p className="text-secondary mb-2">
              <strong>User:</strong> {selectedJourney.userName}
            </p>
            <p className="text-secondary mb-4">
              <strong>Route:</strong> {selectedJourney.startLocation.address} → {selectedJourney.endLocation.address}
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-tartiary mb-2">
                  Select Car
                </label>
                <select
                  value={selectedCar}
                  onChange={(e) => setSelectedCar(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                >
                  <option value="">Choose a car</option>
                  {getAvailableCars().map((car) => (
                    <option key={car.id} value={car.id}>
                      {car.model} ({car.regNo}) - {car.status}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-tartiary mb-2">
                  Select Driver
                </label>
                <select
                  value={selectedDriver}
                  onChange={(e) => setSelectedDriver(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                >
                  <option value="">Choose a driver</option>
                  {getAvailableDrivers().map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name} - {driver.licenseNo}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => assignCarAndDriver(selectedJourney.id)}
                disabled={!selectedCar || !selectedDriver || assigningCar}
                className="flex-1 bg-primary  py-3 px-6 rounded-xl hover:bg-secondary disabled:bg-foreground disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {assigningCar ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Assigning...
                  </>
                ) : (
                  'Assign'
                )}
              </button>
              <button
                onClick={() => {
                  setSelectedJourney(null);
                  setSelectedCar('');
                  setSelectedDriver('');
                }}
                className="flex-1 bg-tartiary  py-3 px-6 rounded-xl hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0  bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-primary mb-4">
              Generate {reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-tartiary mb-2">
                  Report Period
                </label>
                <select className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors">
                  <option value="month">This Month</option>
                  <option value="quarter">This Quarter</option>
                  <option value="year">This Year</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
              
              {reportType === 'custom' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-tartiary mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-tartiary mb-2">
                      End Date
                    </label>
                    <input
                      type="date"
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-tartiary mb-2">
                      Report Format
                    </label>
                    <select className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors">
                      <option value="excel">Excel Spreadsheet</option>
                      <option value="pdf">PDF Document</option>
                      <option value="csv">CSV File</option>
                    </select>
                  </div>
                </>
              )}
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => generateReport(reportType)}
                className="flex-1 bg-primary  py-3 px-6 rounded-xl hover:bg-secondary transition-colors"
              >
                Generate Report
              </button>
              <button
                onClick={() => setShowReportModal(false)}
                className="flex-1 bg-tartiary  py-3 px-6 rounded-xl hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Banner */}
        <div className="rounded-2xl p-6 mb-8  shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">System Overview 👑</h2>
              <p className="opacity-90">
                Complete fleet management and monitoring dashboard
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex items-center space-x-4">
              <div className="text-right">
                <p className="text-purple-200 text-sm">Total Monthly Distance</p>
                <p className="text-2xl font-bold">{systemStats.monthlyDistance} km</p>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* System Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="rounded-2xl p-6 shadow-lg border border-slate-100 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-accent text-sm font-medium">Total Users</p>
                    <p className="text-3xl font-bold text-primary mt-2">{systemStats.totalUsers}</p>
                    <p className="text-green-600 text-sm font-medium mt-2 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                      Active users
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl p-6 shadow-lg border border-slate-100 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-accent text-sm font-medium">Total Drivers</p>
                    <p className="text-3xl font-bold text-primary mt-2">{systemStats.totalDrivers}</p>
                    <p className="text-accent text-sm mt-2">
                      {systemStats.driversOnLeave} on leave
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl p-6 shadow-lg border border-slate-100 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-accent text-sm font-medium">Fleet Cars</p>
                    <p className="text-3xl font-bold text-primary mt-2">{systemStats.totalCars}</p>
                    <p className="text-green-600 text-sm font-medium mt-2">
                      {systemStats.availableCars} available
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl p-6 shadow-lg border border-slate-100 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-accent text-sm font-medium">Active Journeys</p>
                    <p className="text-3xl font-bold text-primary mt-2">{systemStats.activeJourneys}</p>
                    <p className="text-orange-600 text-sm font-medium mt-2">
                      {systemStats.pendingRequests} pending
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions & Pending Requests */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Quick Actions */}
              <div className="rounded-2xl p-6 shadow-lg border border-slate-100">
                <h3 className="text-lg font-semibold text-primary mb-6">Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => setActiveTab('journeys')}
                    className="p-4 border-2 border-dashed border-slate-200 rounded-2xl hover:border-purple-500 hover:bg-purple-50 transition-all duration-300 group text-center"
                  >
                    <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:bg-secondary transition-colors">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-tartiary group-hover:text-purple-700">Manage Journeys</span>
                  </button>
                  
                  <button
                    onClick={() => setActiveTab('cars')}
                    className="p-4 border-2 border-dashed border-slate-200 rounded-2xl hover:border-blue-500 hover:bg-secondary transition-all duration-300 group text-center"
                  >
                    <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:bg-secondary transition-colors">
                      <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-tartiary group-hover:text-secondary">Manage Cars</span>
                  </button>
                  
                  <button
                    onClick={() => setActiveTab('drivers')}
                    className="p-4 border-2 border-dashed border-slate-200 rounded-2xl hover:border-green-500 hover:bg-green-50 transition-all duration-300 group text-center"
                  >
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:bg-green-200 transition-colors">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-tartiary group-hover:text-green-700">Manage Drivers</span>
                  </button>
                  
                  <button
                    onClick={() => setActiveTab('reports')}
                    className="p-4 border-2 border-dashed border-slate-200 rounded-2xl hover:border-orange-500 hover:bg-orange-50 transition-all duration-300 group text-center"
                  >
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:bg-orange-200 transition-colors">
                      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-tartiary group-hover:text-orange-700">View Reports</span>
                  </button>
                </div>
              </div>

              {/* Pending Journey Requests */}
              <div className="rounded-2xl p-6 shadow-lg border border-slate-100">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-primary">Pending Requests</h3>
                  <span className="px-3 py-1 bg-orange-100 text-orange-800 text-sm font-medium rounded-full">
                    {getPendingJourneys().length} pending
                  </span>
                </div>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {getPendingJourneys().slice(0, 5).map((journey) => (
                    <div key={journey.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-xl">
                      <div className="flex-1">
                        <p className="font-medium text-primary">{journey.userName}</p>
                        <p className="text-sm text-accent">
                          {journey.startLocation.address} → {journey.endLocation.address}
                        </p>
                        <p className="text-xs text-primary">
                          {new Date(journey.startTime).toLocaleDateString()} • {journey.distance} km
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedJourney(journey)}
                        className="bg-primary  px-4 py-2 rounded-xl hover:bg-secondary transition-colors text-sm"
                      >
                        Assign
                      </button>
                    </div>
                  ))}
                  {getPendingJourneys().length === 0 && (
                    <p className="text-center text-accent py-4">No pending journey requests</p>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="rounded-2xl shadow-lg border border-slate-100">
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-lg font-semibold text-primary">Recent Activity</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-background">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-accent uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-accent uppercase tracking-wider">
                        Driver
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-accent uppercase tracking-wider">
                        Car
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-accent uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-accent uppercase tracking-wider">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {journeys.slice(0, 5).map((journey) => (
                      <tr key={journey.id} className="hover:bg-background transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                          {journey.userName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                          {journey.driverName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                          {journey.carModel}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                            journey.status === 'completed' ? 'bg-green-100 text-green-800' :
                            journey.status === 'in-progress' ? 'bg-primary text-accent' :
                            journey.status === 'requested' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {journey.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                          {new Date(journey.startTime).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Journeys Tab */}
        {activeTab === 'journeys' && (
          <div className="space-y-6">
            {/* Journeys Management */}
            <div className="rounded-2xl shadow-lg border border-slate-100">
              <div className="p-6 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-lg font-semibold text-primary">Journey Management</h3>
                  <div className="flex space-x-2 mt-4 sm:mt-0">
                    <button 
                      onClick={() => loadAdminData()}
                      className="bg-primary  px-4 py-2 rounded-xl hover:bg-accent transition-colors text-sm"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-background">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-accent uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-accent uppercase tracking-wider">
                        Driver
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-accent uppercase tracking-wider">
                        Car
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-accent uppercase tracking-wider">
                        Route
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-accent uppercase tracking-wider">
                        Distance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-accent uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-accent uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {journeys.map((journey) => (
                      <tr key={journey.id} className="hover:bg-background transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                          {journey.userName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                          {journey.driverName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                          {journey.carModel}
                        </td>
                        <td className="px-6 py-4 text-sm text-primary">
                          <div className="font-medium">{journey.startLocation.address}</div>
                          <div className="text-accent text-xs">→ {journey.endLocation.address}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                          {journey.distance} km
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                            journey.status === 'completed' ? 'bg-green-100 text-green-800' :
                            journey.status === 'in-progress' ? 'bg-primary text-accent' :
                            journey.status === 'requested' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {journey.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                          <div className="flex space-x-2">
                            {journey.status === 'requested' && (
                              <button
                                onClick={() => setSelectedJourney(journey)}
                                className="text-purple-600 hover:text-purple-800 text-xs"
                              >
                                Assign
                              </button>
                            )}
                            {journey.status !== 'completed' && journey.status !== 'cancelled' && (
                              <button
                                onClick={() => cancelJourney(journey.id)}
                                disabled={updatingStatus === `journey-${journey.id}`}
                                className="text-red-600 hover:text-red-800 text-xs disabled:opacity-50"
                              >
                                {updatingStatus === `journey-${journey.id}` ? 'Cancelling...' : 'Cancel'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Users Management */}
            <div className="rounded-2xl shadow-lg border border-slate-100">
              <div className="p-6 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-lg font-semibold text-primary">User Management</h3>
                  <div className="flex space-x-2 mt-4 sm:mt-0">
                    <button 
                      onClick={() => loadAdminData()}
                      className="bg-primary  px-4 py-2 rounded-xl hover:bg-accent transition-colors text-sm"
                    >
                      Refresh
                    </button>
                    <button 
                      onClick={handleAddUser}
                      className="bg-primary  px-4 py-2 rounded-xl hover:bg-secondary transition-colors text-sm"
                    >
                      Add User
                    </button>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-background">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-accent uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-accent uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-accent uppercase tracking-wider">
                        Designation
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-accent uppercase tracking-wider">
                        Department
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-accent uppercase tracking-wider">
                        Monthly Distance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-accent uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-accent uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-background transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                          {user.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                          {user.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                          {user.designation}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                          {user.department}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                          {user.totalDistance?.month || 0} km
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                            user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEditUser(user)}
                              className="text-secondary hover:text-accent text-xs"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDisableUser(user.id, user.isActive)}
                              className={`text-xs ${
                                user.isActive 
                                  ? 'text-red-600 hover:text-red-800' 
                                  : 'text-green-600 hover:text-green-800'
                              }`}
                            >
                              {user.isActive ? 'Disable' : 'Enable'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Drivers Tab */}
        {activeTab === 'drivers' && (
          <div className="space-y-6">
            {/* Drivers Management */}
            <div className="rounded-2xl shadow-lg border border-slate-100">
              <div className="p-6 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-lg font-semibold text-primary">Driver Management</h3>
                  <div className="flex space-x-2 mt-4 sm:mt-0">
                    <button 
                      onClick={() => loadAdminData()}
                      className="bg-primary  px-4 py-2 rounded-xl hover:bg-accent transition-colors text-sm"
                    >
                      Refresh
                    </button>
                    <button 
                      onClick={handleAddDriver}
                      className="bg-primary  px-4 py-2 rounded-xl hover:bg-secondary transition-colors text-sm"
                    >
                      Add Driver
                    </button>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-background">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-accent uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-accent uppercase tracking-wider">
                        License
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-accent uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-accent uppercase tracking-wider">
                        Salary
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-accent uppercase tracking-wider">
                        Leave Balance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-accent uppercase tracking-wider">
                        Monthly Distance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-accent uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {drivers.map((driver) => (
                      <tr key={driver.id} className="hover:bg-background transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                          {driver.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                          {driver.licenseNo}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                            driver.onLeave ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {driver.onLeave ? 'On Leave' : 'Active'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                          ${driver.salary}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                          {driver.remainingLeave}/{driver.totalLeave} days
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                          {driver.totalTravelledDistance?.month || 0} km
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => updateDriverStatus(driver.id, !driver.onLeave)}
                              disabled={updatingStatus === `driver-${driver.id}`}
                              className={`px-3 py-1 text-xs rounded-full ${
                                driver.onLeave 
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                                  : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                              } disabled:opacity-50`}
                            >
                              {updatingStatus === `driver-${driver.id}` ? 'Updating...' : (driver.onLeave ? 'Activate' : 'Set Leave')}
                            </button>
                            <button
                              onClick={() => handleEditDriver(driver)}
                              className="text-secondary hover:text-accent text-xs"
                            >
                              Edit
                            </button>
                          </div>
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
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cars.map((car) => (
                <div key={car.id} className="p-6 rounded-2xl shadow-lg border border-slate-100 hover:shadow-xl transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-primary">{car.model}</h4>
                    <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                      car.status === 'available' ? 'bg-green-100 text-green-800' :
                      car.status === 'in-use' ? 'bg-primary text-accent' :
                      car.status === 'servicing' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {car.status}
                    </span>
                  </div>
                  <div className="space-y-3 text-sm text-secondary">
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span>Registration</span>
                      <span className="font-medium text-primary bg-background px-2 py-1 rounded-lg">{car.regNo}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span>Cleanliness</span>
                      <span className={`font-medium ${car.isClean ? 'text-green-600' : 'text-red-600'}`}>
                        {car.isClean ? '✅ Clean' : '❌ Needs Cleaning'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span>Service</span>
                      <span className={`font-medium ${car.needsServicing ? 'text-red-600' : 'text-green-600'}`}>
                        {car.needsServicing ? '🔧 Needs Service' : '✅ Good'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span>Assigned Drivers</span>
                      <span className="font-medium text-primary">{car.drivers.length}</span>
                    </div>
                  </div>
                  {car.totalDistanceTravelled && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-xs text-accent mb-2">Total Distance Travelled</p>
                      <div className="flex justify-between text-xs">
                        <span>Day: {car.totalDistanceTravelled.day}km</span>
                        <span>Month: {car.totalDistanceTravelled.month}km</span>
                        <span>Year: {car.totalDistanceTravelled.year}km</span>
                      </div>
                    </div>
                  )}
                  <div className="mt-4 flex space-x-2">
                    <button
                      onClick={() => updateCarStatus(car.id, 'available')}
                      disabled={updatingStatus === `car-${car.id}` || car.status === 'available'}
                      className="flex-1 bg-green-600  py-2 px-4 rounded-xl hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      {updatingStatus === `car-${car.id}` ? 'Updating...' : 'Available'}
                    </button>
                    <button
                      onClick={() => updateCarStatus(car.id, 'servicing')}
                      disabled={updatingStatus === `car-${car.id}` || car.status === 'servicing'}
                      className="flex-1 bg-red-600  py-2 px-4 rounded-xl hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      {updatingStatus === `car-${car.id}` ? 'Updating...' : 'Service'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            {/* Analytics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="rounded-2xl p-6 shadow-lg border border-slate-100">
                <h4 className="text-lg font-semibold text-primary mb-4">Usage Statistics</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-secondary">Total Journeys</span>
                    <span className="font-semibold">{journeys.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Completed</span>
                    <span className="font-semibold text-green-600">
                      {journeys.filter(j => j.status === 'completed').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Cancelled</span>
                    <span className="font-semibold text-red-600">
                      {journeys.filter(j => j.status === 'cancelled').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Success Rate</span>
                    <span className="font-semibold">
                      {journeys.length > 0 ? ((journeys.filter(j => j.status === 'completed').length / journeys.length) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl p-6 shadow-lg border border-slate-100">
                <h4 className="text-lg font-semibold text-primary mb-4">Fleet Utilization</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-secondary">Available Cars</span>
                    <span className="font-semibold text-green-600">
                      {cars.filter(c => c.status === 'available').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">In Use</span>
                    <span className="font-semibold text-secondary">
                      {cars.filter(c => c.status === 'in-use').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Under Maintenance</span>
                    <span className="font-semibold text-red-600">
                      {cars.filter(c => c.status === 'servicing').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Utilization Rate</span>
                    <span className="font-semibold">
                      {cars.length > 0 ? ((cars.filter(c => c.status === 'in-use').length / cars.length) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl p-6 shadow-lg border border-slate-100">
                <h4 className="text-lg font-semibold text-primary mb-4">Driver Performance</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-secondary">Active Drivers</span>
                    <span className="font-semibold">
                      {drivers.filter(d => !d.onLeave).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">On Leave</span>
                    <span className="font-semibold text-orange-600">
                      {drivers.filter(d => d.onLeave).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Avg. Monthly Distance</span>
                    <span className="font-semibold">
                      {drivers.length > 0 ? Math.round(drivers.reduce((sum, d) => sum + (d.totalTravelledDistance?.month || 0), 0) / drivers.length) : 0} km
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Availability</span>
                    <span className="font-semibold text-green-600">
                      {drivers.length > 0 ? ((drivers.filter(d => !d.onLeave).length / drivers.length) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Reports */}
            <div className="rounded-2xl shadow-lg border border-slate-100">
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-lg font-semibold text-primary">System Reports</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-primary">Quick Reports</h4>
                    <button 
                      onClick={() => handleQuickReport('monthly')}
                      className="w-full text-left p-4 border border-slate-200 rounded-xl hover:bg-background transition-colors"
                    >
                      <div className="font-medium text-primary">Monthly Journey Report</div>
                      <div className="text-sm text-secondary">Complete analysis of all journeys this month</div>
                    </button>
                    <button 
                      onClick={() => handleQuickReport('driver')}
                      className="w-full text-left p-4 border border-slate-200 rounded-xl hover:bg-background transition-colors"
                    >
                      <div className="font-medium text-primary">Driver Performance Report</div>
                      <div className="text-sm text-secondary">Driver efficiency and distance analysis</div>
                    </button>
                    <button 
                      onClick={() => handleQuickReport('maintenance')}
                      className="w-full text-left p-4 border border-slate-200 rounded-xl hover:bg-background transition-colors"
                    >
                      <div className="font-medium text-primary">Fleet Maintenance Report</div>
                      <div className="text-sm text-secondary">Car status and maintenance requirements</div>
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="font-semibold text-primary">Export Options</h4>
                    <button 
                      onClick={() => generateReport('excel')}
                      className="w-full text-left p-4 border border-slate-200 rounded-xl hover:bg-background transition-colors"
                    >
                      <div className="font-medium text-primary">Export to Excel</div>
                      <div className="text-sm text-secondary">All system data in spreadsheet format</div>
                    </button>
                    <button 
                      onClick={() => generateReport('pdf')}
                      className="w-full text-left p-4 border border-slate-200 rounded-xl hover:bg-background transition-colors"
                    >
                      <div className="font-medium text-primary">PDF Report</div>
                      <div className="text-sm text-secondary">Formatted PDF with charts and analysis</div>
                    </button>
                    <button 
                      onClick={() => handleQuickReport('custom')}
                      className="w-full text-left p-4 border border-slate-200 rounded-xl hover:bg-background transition-colors"
                    >
                      <div className="font-medium text-primary">Custom Report</div>
                      <div className="text-sm text-secondary">Create a custom report with specific filters</div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}