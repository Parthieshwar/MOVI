import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bus, Users, MapPin, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { MoviChat } from "@/components/Movi/MoviChat";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TripData {
  trip_id: string;
  route_id: string;
  display_name: string;
  booking_status_percentage: number;
  live_status: string;
  route_name: string;
  deployment_id: string | null;
  vehicle_id: string | null;
  driver_id: string | null;
  license_plate: string | null;
  vehicle_type: string | null;
  driver_name: string | null;
  driver_phone: string | null;
}

const BusDashboard = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<TripData | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const UNASSIGNED_VALUE = "__unassigned";
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(UNASSIGNED_VALUE);
  const [selectedDriverId, setSelectedDriverId] = useState<string>(UNASSIGNED_VALUE);

  // Fetch trips data
  const { data: trips = [], isLoading: tripsLoading } = useQuery<TripData[]>({
    queryKey: ["daily-trips"],
    queryFn: api.getDailyTrips,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: api.getStats,
  });

  // Fetch vehicles and drivers for edit dialog
  const { data: vehicles = [] } = useQuery({ queryKey: ["vehicles"], queryFn: api.getVehicles });
  const { data: drivers = [] } = useQuery({ queryKey: ["drivers"], queryFn: api.getDrivers });

  // Delete deployment mutation
  const deleteDeploymentMutation = useMutation({
    mutationFn: (deploymentId: string) => api.deleteDeployment(deploymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-trips"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast({
        title: "Success",
        description: "Deployment removed successfully",
      });
      setDeleteDialogOpen(false);
      setSelectedTrip(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove deployment",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (trip: TripData) => {
    if (trip.deployment_id) {
      setSelectedTrip(trip);
      setDeleteDialogOpen(true);
    } else {
      toast({
        title: "Info",
        description: "No deployment to remove for this trip",
      });
    }
  };

  const handleDeleteConfirm = () => {
    if (selectedTrip?.deployment_id) {
      deleteDeploymentMutation.mutate(selectedTrip.deployment_id);
    }
  };

  const handleEditClick = (trip: TripData) => {
    if (!trip.deployment_id) {
      toast({ title: "Info", description: "No deployment to edit for this trip" });
      return;
    }
    setSelectedTrip(trip);
    setSelectedVehicleId(trip.vehicle_id || UNASSIGNED_VALUE);
    setSelectedDriverId(trip.driver_id || UNASSIGNED_VALUE);
    setEditDialogOpen(true);
  };

  const updateDeploymentMutation = useMutation({
    mutationFn: () => api.updateDeployment(selectedTrip!.deployment_id!, {
      vehicle_id: selectedVehicleId === UNASSIGNED_VALUE ? null : selectedVehicleId,
      driver_id: selectedDriverId === UNASSIGNED_VALUE ? null : selectedDriverId,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-trips"] });
      toast({ title: "Success", description: "Deployment updated" });
      setEditDialogOpen(false);
      setSelectedTrip(null);
      setSelectedVehicleId(UNASSIGNED_VALUE);
      setSelectedDriverId(UNASSIGNED_VALUE);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update", variant: "destructive" });
    },
  });

  const getStatusColor = (status: string) => {
    if (status.includes("IN")) {
      return "bg-success text-success-foreground";
    }
    if (status.includes("OUT")) {
      return "bg-warning text-warning-foreground";
    }
    if (status === "Scheduled" || status === "En Route") {
      return "bg-blue-500 text-white";
    }
    return "bg-muted text-muted-foreground";
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Bus Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Monitor daily operations and trip assignments</p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-success" /> Live
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-border bg-gradient-to-br from-card to-secondary/30 shadow-md transition-all hover:shadow-xl hover:-translate-y-0.5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Trips
              </CardTitle>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {stats?.total_trips ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">Active today</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-gradient-to-br from-card to-accent/20 shadow-md transition-all hover:shadow-xl hover:-translate-y-0.5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Vehicles
              </CardTitle>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                <Bus className="h-5 w-5 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {stats?.total_vehicles ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">In fleet</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-gradient-to-br from-card to-success/20 shadow-md transition-all hover:shadow-xl hover:-translate-y-0.5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Drivers
              </CardTitle>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <Users className="h-5 w-5 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {stats?.total_drivers ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">Available</p>
            </CardContent>
          </Card>
        </div>

        {/* Trips Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-foreground">Today's Trips</h2>
            <span className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground">Updated just now</span>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/60">
                  <TableHead className="font-semibold">Trip Name</TableHead>
                  <TableHead className="font-semibold">Vehicle</TableHead>
                  <TableHead className="font-semibold">Driver</TableHead>
                  <TableHead className="font-semibold">Route</TableHead>
                  <TableHead className="font-semibold">Booking Status</TableHead>
                  <TableHead className="font-semibold">Live Status</TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tripsLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground py-6"
                    >
                      Loading trips...
                    </TableCell>
                  </TableRow>
                ) : trips.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground py-6"
                    >
                      No trips available.
                    </TableCell>
                  </TableRow>
                ) : (
                  trips.map((trip, index) => (
                    <TableRow
                      key={trip.trip_id}
                      className={cn(
                        index % 2 === 0 ? "bg-background" : "bg-secondary/10",
                        "hover:bg-secondary/40 transition-colors"
                      )}
                    >
                      <TableCell className="font-medium">
                        {trip.display_name}
                      </TableCell>
                      <TableCell>
                        {trip.license_plate ? (
                          <div>
                            <div className="font-medium">{trip.license_plate}</div>
                            <div className="text-xs text-muted-foreground">
                              {trip.vehicle_type}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {trip.driver_name ? (
                          <div>
                            <div className="font-medium">{trip.driver_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {trip.driver_phone}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>{trip.route_name || "N/A"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Progress value={trip.booking_status_percentage} className="w-24" />
                          <span className="text-sm font-medium tabular-nums">{trip.booking_status_percentage}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(trip.live_status)}>
                          {trip.live_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-primary/10 hover:text-primary rounded-full"
                            onClick={() => handleEditClick(trip)}
                            disabled={!trip.deployment_id}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive rounded-full"
                            onClick={() => handleDeleteClick(trip)}
                            disabled={!trip.deployment_id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <MoviChat />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Deployment?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the vehicle and driver assignment for trip{" "}
              <strong>{selectedTrip?.display_name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Deployment Dialog */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setSelectedTrip(null);
            setSelectedVehicleId(UNASSIGNED_VALUE);
            setSelectedDriverId(UNASSIGNED_VALUE);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Deployment</DialogTitle>
            <DialogDescription>
              Assign vehicle and driver for <strong>{selectedTrip?.display_name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vehicle</Label>
                <Select
                  value={selectedVehicleId}
                  onValueChange={(value) => setSelectedVehicleId(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
                    {(Array.isArray(vehicles) ? vehicles : []).map((v: any) => (
                      <SelectItem key={v.vehicle_id} value={v.vehicle_id}>
                        {v.license_plate} ({v.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Driver</Label>
                <Select
                  value={selectedDriverId}
                  onValueChange={(value) => setSelectedDriverId(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select driver" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
                    {(Array.isArray(drivers) ? drivers : []).map((d: any) => (
                      <SelectItem key={d.driver_id} value={d.driver_id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setSelectedTrip(null);
                setSelectedVehicleId(UNASSIGNED_VALUE);
                setSelectedDriverId(UNASSIGNED_VALUE);
              }}
              className="rounded-full"
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => updateDeploymentMutation.mutate()}
              className="rounded-full bg-white text-foreground hover:bg-muted"
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default BusDashboard;