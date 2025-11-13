const API_BASE_URL = 'http://localhost:5000/api';

export interface Stop {
  stop_id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface Path {
  path_id: string;
  path_name: string;
  ordered_list_of_stop_ids: string[];
}

export interface Route {
  route_id: string;
  path_id: string;
  route_display_name: string;
  shift_time: string;
  direction: string;
  start_point: string;
  end_point: string;
  capacity: number;
  allowed_waitlist: number;
  status: 'active' | 'deactivated';
}

export interface Vehicle {
  vehicle_id: string;
  license_plate: string;
  type: string;
  capacity: number;
}

export interface Driver {
  driver_id: string;
  name: string;
  phone_number: string;
}

export interface DailyTrip {
  trip_id: string;
  route_id: string;
  display_name: string;
  booking_status_percentage: number;
  live_status: string;
  route_name?: string;
  deployment_id?: string | null;
  vehicle_id?: string | null;
  driver_id?: string | null;
  license_plate?: string | null;
  vehicle_type?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
}

export interface Deployment {
  deployment_id: string;
  trip_id: string;
  vehicle_id: string | null;
  driver_id: string | null;
}

export interface Stats {
  total_trips: number;
  total_vehicles: number;
  total_drivers: number;
}

// API Functions
export const api = {
  // Stops
  getStops: async (): Promise<Stop[]> => {
    const response = await fetch(`${API_BASE_URL}/stops`);
    if (!response.ok) throw new Error('Failed to fetch stops');
    return response.json();
  },

  // Paths
  getPaths: async (): Promise<Path[]> => {
    const response = await fetch(`${API_BASE_URL}/paths`);
    if (!response.ok) throw new Error('Failed to fetch paths');
    return response.json();
  },

  // Routes
  getRoutes: async (status?: 'active' | 'deactivated'): Promise<Route[]> => {
    const url = status ? `${API_BASE_URL}/routes?status=${status}` : `${API_BASE_URL}/routes`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch routes');
    return response.json();
  },

  createRoute: async (route: Omit<Route, 'route_id'> & { route_id?: string }): Promise<{ success: boolean; message: string }> => {
    const response = await fetch(`${API_BASE_URL}/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(route),
    });
    if (!response.ok) throw new Error('Failed to create route');
    return response.json();
  },

  updateRoute: async (routeId: string, route: Partial<Route>): Promise<{ success: boolean; message: string }> => {
    const response = await fetch(`${API_BASE_URL}/routes/${routeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(route),
    });
    if (!response.ok) throw new Error('Failed to update route');
    return response.json();
  },

  deleteRoute: async (routeId: string): Promise<{ success: boolean; message: string }> => {
    const response = await fetch(`${API_BASE_URL}/routes/${routeId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete route');
    return response.json();
  },

  // Vehicles
  getVehicles: async (): Promise<Vehicle[]> => {
    const response = await fetch(`${API_BASE_URL}/vehicles`);
    if (!response.ok) throw new Error('Failed to fetch vehicles');
    return response.json();
  },

  // Drivers
  getDrivers: async (): Promise<Driver[]> => {
    const response = await fetch(`${API_BASE_URL}/drivers`);
    if (!response.ok) throw new Error('Failed to fetch drivers');
    return response.json();
  },

  // Daily Trips
  getDailyTrips: async (): Promise<DailyTrip[]> => {
    const response = await fetch(`${API_BASE_URL}/daily-trips`);
    if (!response.ok) throw new Error('Failed to fetch daily trips');
    return response.json();
  },

  // Deployments
  getDeployments: async (): Promise<Deployment[]> => {
    const response = await fetch(`${API_BASE_URL}/deployments`);
    if (!response.ok) throw new Error('Failed to fetch deployments');
    return response.json();
  },

  updateDeployment: async (deploymentId: string, deployment: Partial<Deployment>): Promise<{ success: boolean; message: string }> => {
    const response = await fetch(`${API_BASE_URL}/deployments/${deploymentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deployment),
    });
    if (!response.ok) throw new Error('Failed to update deployment');
    return response.json();
  },

  deleteDeployment: async (deploymentId: string): Promise<{ success: boolean; message: string }> => {
    const response = await fetch(`${API_BASE_URL}/deployments/${deploymentId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete deployment');
    return response.json();
  },

  // Stats
  getStats: async (): Promise<Stats> => {
    const response = await fetch(`${API_BASE_URL}/stats`);
    if (!response.ok) throw new Error('Failed to fetch stats');
    return response.json();
  },

  // Export entire SQLite DB
  exportDb: async (): Promise<Blob> => {
    const response = await fetch(`${API_BASE_URL}/export/db`);
    if (!response.ok) throw new Error('Failed to export DB');
    return response.blob();
  },

  // Movi chat endpoint - returns Response for JSON parsing
  sendMoviMessage: async (form: FormData): Promise<Response> => {
    const response = await fetch(`${API_BASE_URL}/movi`, {
      method: 'POST',
      body: form,
    });
    if (!response.ok) throw new Error('Failed to send message to Movi');
    return response;
  },
};