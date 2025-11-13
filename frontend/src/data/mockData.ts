export interface Route {
  id: string;
  name: string;
  direction: "LOGIN" | "LOGOUT";
  shiftTime: string;
  startPoint: string;
  endPoint: string;
  capacity: number;
  allowedWaitlist: number;
  isActive: boolean;
}

export interface Trip {
  id: string;
  name: string;
  vehicle: string;
  driver: {
    name: string;
    phone: string;
  };
  bookingStatus: number;
  liveStatus: string;
  route: string;
}

export const mockRoutes: Route[] = [
  {
    id: "76913",
    name: "Path2 - 19:45",
    direction: "LOGIN",
    shiftTime: "19:45",
    startPoint: "Gavipuram",
    endPoint: "Peenya",
    capacity: 6,
    allowedWaitlist: 0,
    isActive: true,
  },
  {
    id: "76915",
    name: "Path1 - 22:00",
    direction: "LOGIN",
    shiftTime: "22:00",
    startPoint: "Gavipuram",
    endPoint: "Temple",
    capacity: 8,
    allowedWaitlist: 2,
    isActive: true,
  },
  {
    id: "76924",
    name: "Paradise - 05:00",
    direction: "LOGOUT",
    shiftTime: "05:00",
    startPoint: "BTM",
    endPoint: "HosKote",
    capacity: 6,
    allowedWaitlist: 1,
    isActive: true,
  },
  {
    id: "76930",
    name: "Express - 08:00",
    direction: "LOGIN",
    shiftTime: "08:00",
    startPoint: "Whitefield",
    endPoint: "MG Road",
    capacity: 12,
    allowedWaitlist: 3,
    isActive: true,
  },
  {
    id: "76935",
    name: "Night Shift - 23:30",
    direction: "LOGOUT",
    shiftTime: "23:30",
    startPoint: "Electronic City",
    endPoint: "Koramangala",
    capacity: 10,
    allowedWaitlist: 2,
    isActive: true,
  },
  {
    id: "76940",
    name: "Morning Route - 06:00",
    direction: "LOGIN",
    shiftTime: "06:00",
    startPoint: "Marathahalli",
    endPoint: "HSR Layout",
    capacity: 8,
    allowedWaitlist: 1,
    isActive: false,
  },
];

export const mockTrips: Trip[] = [
  {
    id: "T001",
    name: "Bulk - 00:01",
    vehicle: "MH-12-3456",
    driver: {
      name: "Amit Kumar",
      phone: "+91 98765 43210",
    },
    bookingStatus: 25,
    liveStatus: "IN",
    route: "Path2 - 19:45",
  },
  {
    id: "T002",
    name: "Bulk - 00:02",
    vehicle: "MH-12-7890",
    driver: {
      name: "Suresh Reddy",
      phone: "+91 98765 43211",
    },
    bookingStatus: 60,
    liveStatus: "OUT",
    route: "Path1 - 22:00",
  },
  {
    id: "T003",
    name: "Express - 00:03",
    vehicle: "KA-01-5678",
    driver: {
      name: "Rajesh Sharma",
      phone: "+91 98765 43212",
    },
    bookingStatus: 85,
    liveStatus: "IN",
    route: "Express - 08:00",
  },
  {
    id: "T004",
    name: "Night - 00:04",
    vehicle: "KA-05-9012",
    driver: {
      name: "Prakash Singh",
      phone: "+91 98765 43213",
    },
    bookingStatus: 40,
    liveStatus: "IDLE",
    route: "Night Shift - 23:30",
  },
];

export const dashboardStats = {
  totalTrips: 24,
  totalVehicles: 18,
  totalDrivers: 22,
};
