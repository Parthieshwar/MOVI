// moviResponses.ts
// Regular responses (static reads)
export const moviResponses: { [question: string]: string } = {
    "How many vehicles are not assigned to any trip?":
    "1 vehicle is currently unassigned.",

  "What's the status of the 'North Corridor - Morning Shift - Trip 1'?":
    "The live status of 'North Corridor - Morning Shift - Trip 1' is '00:15 IN'.",

  // Static Read
  "List all stops for 'P002'.":
    "Stops for 'South Corridor Route' (P002): Silk Board, Koramangala, HSR Layout, BTM Layout",

  "Show me all routes that use 'P001'.":
    "Routes using 'North Corridor Route' (P001):\n- North Corridor - Morning Shift\n- North Corridor - Evening Return",
  };

// Consequence-aware messages for actions
export const consequencePrompts: { [question: string]: string } = {
    "Assign vehicle 'KA-05-IJ-7890' and driver 'Amit Singh' to the 'South Corridor - Evening Shift - Trip 1'.":
      "I can assign vehicle 'KA-05-IJ-7890' and driver 'Amit Singh'. However, please be aware the 'South Corridor - Evening Shift - Trip 1' already has 2 employees booked. Assigning this vehicle may override existing allocations. Do you want to proceed?",
  
    "Remove the vehicle from 'East Express - Morning - Trip 2'.":
      "I can remove the vehicle. However, please be aware the 'East Express - Morning - Trip 2' trip is already 25% booked by employees. Removing the vehicle will cancel these bookings and a trip-sheet will fail to generate. Do you want to proceed?",
  
    "Create a new stop called 'Odeon Circle'.":
      "I can create the stop 'Odeon Circle'. This will add a new location to the system. Do you want to proceed?",
  
    "Create a new vehicle 'KA-09-XY-1122' of type 'Bus' with capacity 40.":
      "I can create the vehicle 'KA-09-XY-1122'. Adding a vehicle will increase fleet capacity. Do you want to proceed?"
  };  